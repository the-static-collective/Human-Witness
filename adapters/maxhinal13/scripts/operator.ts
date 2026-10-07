/** Scoped Deno operator. Secrets enter through its local environment/storage, never argv or stdout. */
import {Buffer} from 'node:buffer';
import {randomBytes,createHash} from 'node:crypto';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PINNED_PROJECT_REFS,validateIdentityBundle,type HostId} from '../src/peers.ts';
import {operatorPlan,FUNCTIONS} from '../src/operator-plan.ts';
import {sanitizePublicStatus} from '../src/status.ts';
import {NODE_DEFINITIONS} from '../src/nodes.ts';
import {replayTraces} from '../src/trace-replay.ts';
import type {TransportTrace} from '../src/store.ts';

const hosts=Object.keys(PINNED_PROJECT_REFS) as HostId[];
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const adapter=resolve(root,'adapters/maxhinal13');
const mode=Deno.args[0]??'plan';
const endpoint=(h:HostId,name:string)=>`https://${PINNED_PROJECT_REFS[h]}.supabase.co/functions/v1/${name}`;
function required(name:string){const v=Deno.env.get(name);if(!v)throw Error('MISSING_'+name);return v;}
async function body(response:Response){
 if(!response.ok)throw Error('HOST_HTTP_'+response.status);
 const text=await response.text();if(text.length>1_000_000)throw Error('HOST_REPLY_TOO_LARGE');
 return JSON.parse(text);
}
async function publicIdentity(){
 const records=[];
 for(const h of hosts){const response=await fetch(endpoint(h,'mx13-genesis')+'?identity=1',{redirect:'error',signal:AbortSignal.timeout(10000)});
  records.push(...await validateIdentityBundle(await body(response),h));}
 if(new Set(records.map(r=>r.fingerprint)).size!==13)throw Error('IDENTITY_COLLISION');
 return Object.fromEntries(records.map(r=>[r.node_id,r.fingerprint]));
}
async function safeStatus(){
 const status:any={schema:'maxhinal13.safe-status/v0',observed_at:new Date().toISOString(),mutation:false,hosts:{}};
 for(const h of hosts){
  try{let jwt:string|undefined;try{jwt=Deno.env.get(h==='WITNESS'?'MX13_WITNESS_STATUS_JWT':'MX13_PANTRY_STATUS_JWT');}catch{/* Unconfigured read-only status remains UNKNOWN. */}
   const headers:Record<string,string>=jwt?{Authorization:'Bearer '+jwt}:{};
   status.hosts[h]=sanitizePublicStatus(await body(await fetch(endpoint(h,'mx13-status'),{headers,redirect:'error',signal:AbortSignal.timeout(10000)})),h);}
  catch{status.hosts[h]={observation:'UNKNOWN',reason:'STATUS_UNAVAILABLE'};}
 }
 return status;
}
async function deploy(){
 // CLI staging contains only reviewed source. No operator credentials or payloads are copied.
 const stage=await Deno.makeTempDir({prefix:'mx13-cli-deploy-'});
 try{
  await Deno.mkdir(stage+'/supabase/functions',{recursive:true});
  const copy=async(from:string,to:string)=>{await Deno.mkdir(to,{recursive:true});for await(const entry of Deno.readDir(from)){
    if(entry.isDirectory)await copy(from+'/'+entry.name,to+'/'+entry.name);else if(entry.isFile)await Deno.copyFile(from+'/'+entry.name,to+'/'+entry.name);}};
  await copy(adapter+'/functions',stage+'/supabase/functions');await copy(adapter+'/src',stage+'/supabase/src');
  await Deno.copyFile(adapter+'/deno.json',stage+'/supabase/functions/deno.json');
  await Deno.copyFile(adapter+'/deno.lock',stage+'/supabase/functions/deno.lock');
  await Deno.writeTextFile(stage+'/supabase/config.toml','project_id = "maxhinal13"\n[functions.mx13-status]\nverify_jwt = true\n');
  for(const h of hosts)for(const name of FUNCTIONS){
   const result=await new Deno.Command('supabase',{args:['functions','deploy',name,'--project-ref',PINNED_PROJECT_REFS[h],
     ...(name==='mx13-status'?[]:['--no-verify-jwt']),'--use-api','--workdir',stage],stdout:'null',stderr:'null'}).output();
   if(!result.success)throw Error('SCOPED_DEPLOY_FAILED');
  }
  return {schema:'maxhinal13.deployment/v0',projects:PINNED_PROJECT_REFS,functions:FUNCTIONS,crossing_claim:'UNPROVEN'};
 }finally{await Deno.remove(stage,{recursive:true});}
}
async function withCapabilities<T>(action:(call:(h:HostId,name:string,value:unknown)=>Promise<any>)=>Promise<T>):Promise<T>{
 const dir=resolve(required('MX13_OPERATOR_DIR'));
 if(relative(root,dir)===''||(!relative(root,dir).startsWith('..')&&!relative(root,dir).startsWith('/')))throw Error('OPERATOR_STORAGE_MUST_BE_OUTSIDE_REPOSITORY');
 await Deno.mkdir(dir,{recursive:true,mode:0o700});
 const realDir=await Deno.realPath(dir), realRoot=await Deno.realPath(root);
 const rel=relative(realRoot,realDir);
 if(rel===''||(!rel.startsWith('..')&&!rel.startsWith('/')))throw Error('OPERATOR_STORAGE_MUST_BE_OUTSIDE_REPOSITORY');
 const info=await Deno.lstat(dir);
 if(!info.isDirectory||info.isSymlink||(info.mode!==null&&(info.mode&0o077)!==0))throw Error('OPERATOR_STORAGE_NOT_PRIVATE');
 const {default:postgres}=await import('npm:postgres@3.4.9');
 const connections:any[]=[];const activated:Array<{sql:any;hash:string;path:string}>=[];const tokens=new Map<HostId,string>();
 try{
  for(const h of hosts){
   const name=h==='WITNESS'?'MX13_WITNESS_DB_URL':'MX13_PANTRY_DB_URL';
   const dbUrl=required(name), parsed=new URL(dbUrl), ref=PINNED_PROJECT_REFS[h];
   if(!['postgres:','postgresql:'].includes(parsed.protocol)||
     !(parsed.hostname===`db.${ref}.supabase.co` || (parsed.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(parsed.username).endsWith('.'+ref))))
    throw Error('DATABASE_HOST_SCOPE_MISMATCH');
   const sql=postgres(dbUrl,{max:1,prepare:false,ssl:'require',connect_timeout:10});connections.push(sql);
   const token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('hex');
   const path=dir+'/'+ref+'-'+crypto.randomUUID()+'.json';
   await Deno.writeTextFile(path,JSON.stringify({project_ref:ref,token}),{mode:0o600,createNew:true});
   activated.push({sql,hash,path});
   const rows=await sql.unsafe(`insert into mx13_host.operator_capabilities(id,token_hash,active,expires_at)
    values('default',$1,true,now()+interval '30 minutes') on conflict(id) do update
    set token_hash=excluded.token_hash,active=true,expires_at=excluded.expires_at
    where not operator_capabilities.active or operator_capabilities.expires_at<now() returning id`,[hash]);
   if(rows.length!==1)throw Error('OPERATOR_CAPABILITY_ALREADY_ACTIVE');tokens.set(h,token);
  }
  const call=async(h:HostId,name:string,value:unknown)=>body(await fetch(endpoint(h,name),{method:'POST',redirect:'error',
    headers:{'Content-Type':'application/json','x-mx13-operator':tokens.get(h)!},body:JSON.stringify(value),signal:AbortSignal.timeout(30000)}));
  return await action(call);
 }finally{
  let failed=false;
  for(const item of activated){
   try{await item.sql.unsafe("update mx13_host.operator_capabilities set active=false where id='default' and token_hash=$1",[item.hash]);await Deno.remove(item.path);}
   catch{failed=true;}
  }
  for(const sql of connections)await sql.end({timeout:5});
  if(failed)throw Error('OPERATOR_REVOCATION_FAILED_TOKENS_EXPIRE_WITHIN_30_MINUTES');
 }
}
async function bootstrap(){
 return withCapabilities(async call=>{
  for(const h of hosts)await call(h,'mx13-genesis',{schema:'maxhinal13.genesis/v0',action:'bootstrap'});
  const fingerprints=await publicIdentity();
  for(const h of hosts)await call(h,'mx13-genesis',{schema:'maxhinal13.genesis/v0',action:'sync-peers'});
  return {schema:'maxhinal13.bootstrap-observation/v0',fingerprints,private_keys:'generated only inside their respective hosts',crossing_claim:'UNPROVEN'};
 });
}
async function route(full:boolean){
 const bytes=await Deno.readFile(required('MX13_INVITATION_PATH'));
 if(bytes.length!==670478||createHash('sha256').update(bytes).digest('hex')!=='af82b9a3b2d5eeb1ce3d58038b3415ca62f0815bd6f0a04662ec8cf5b773d171')throw Error('INVITATION_PARTICULAR_MISMATCH');
 const fingerprints=await publicIdentity();
 return withCapabilities(async call=>{
  const traces:TransportTrace[]=[];const observed:any[]=[];
  const invoke=async(h:HostId,value:unknown)=>{const data=await call(h,'mx13-worker',value);observed.push({host:h,url:endpoint(h,'mx13-worker'),action:(value as any).action,at:new Date().toISOString()});return data;};
  const seed=await invoke('WITNESS',{schema:'maxhinal13.worker/v0',action:'seed',payload_b64:Buffer.from(bytes).toString('base64')});
  let crossing=seed.crossing_id;
  const total=full?13:3;
  for(let i=0;i<total;i++){
   const source=i===0?NODE_DEFINITIONS[0]:i===2&&!full?NODE_DEFINITIONS[1]:NODE_DEFINITIONS[i-1];
   if(i>0){const dest=!full&&i===2?NODE_DEFINITIONS[0]:NODE_DEFINITIONS[i];
    const next=await invoke(source.host,{schema:'maxhinal13.worker/v0',action:!full&&i===2?'probe-return':'advance',
      source_node_id:source.id,next_node_id:dest.id,inbound_crossing_id:crossing});crossing=next.crossing_id;}
   const result=await invoke(source.host,{schema:'maxhinal13.worker/v0',action:'pump',source_node_id:source.id});
   if(!result.ok||result.crossing_id!==crossing)throw Error('ROUTE_STOPPED_UNVERIFIED_PRIOR_HOP');
   const trace=await invoke(source.host,{schema:'maxhinal13.worker/v0',action:'trace',source_node_id:source.id,inbound_crossing_id:crossing});
   traces.push(trace);await replayTraces(traces,fingerprints); // No advancement without verified prior receipts.
  }
  const replay=await replayTraces(traces,fingerprints);
  const evidence={schema:'maxhinal13.operator-https-observation/v0',observed_at:new Date().toISOString(),fingerprints,traces,observed,replay,
    claims:{local_simulation:false,live_two_host:true,live_thirteen_node:full,pulse_observed:false,host_outage_tested:false},
    claim_limit:'operator observed actual pinned HTTPS plus host-local signed receipts; replay alone is not network observation'};
  const output=resolve(required('MX13_EVIDENCE_OUTPUT'));
  await Deno.writeTextFile(output,JSON.stringify(evidence,null,2)+'\n',{mode:0o600,createNew:true});
  return {status:'PASS',evidence_path:output,claims:evidence.claims};
 });
}
async function sinew(){
 const prior=JSON.parse(await Deno.readTextFile(required('MX13_PARENT_TRACE_PATH')));
 const fingerprints=await publicIdentity();await replayTraces(prior.traces,fingerprints);
 const root=prior.traces.findLast((t:TransportTrace)=>t.signed_disposition?.world_id==='mx13:01-witness');
 if(!root?.signed_disposition)throw Error('SINEW_SOURCE_PARENT_UNOBSERVED');
 return withCapabilities(async call=>{
  const traces:TransportTrace[]=[...prior.traces];const observations:any[]=[];
  const invoke=async(h:HostId,value:unknown)=>{const data=await call(h,'mx13-worker',value);
   observations.push({host:h,url:endpoint(h,'mx13-worker'),action:(value as any).action,at:new Date().toISOString()});return data;};
  const perform=async(source:typeof NODE_DEFINITIONS[number],dest:typeof NODE_DEFINITIONS[number],parent:string|null,decision:'REFUSE'|'ACCEPT',reason:string)=>{
   const proposal=await invoke(source.host,{schema:'maxhinal13.worker/v0',action:'edge-propose',source_node_id:source.id,next_node_id:dest.id,edge:{parent_ref:parent,reason}});
   const held=await invoke(source.host,{schema:'maxhinal13.worker/v0',action:'pump',source_node_id:source.id});
   if(held.crossing_id!==proposal.crossing_id||held.error!=='DESTINATION_REMAINS_HELD')throw Error('SINEW_EXPECTED_DURABLE_HOLD');
   await invoke(dest.host,{schema:'maxhinal13.worker/v0',action:'edge-disposition',source_node_id:dest.id,inbound_crossing_id:proposal.crossing_id,decision,actor:'explicit destination-scoped operator'});
   const returned=await invoke(source.host,{schema:'maxhinal13.worker/v0',action:'pump',source_node_id:source.id});
   if(!returned.ok||returned.crossing_id!==proposal.crossing_id)throw Error('SINEW_STOPPED_UNVERIFIED_RETURN');
   const trace=await invoke(source.host,{schema:'maxhinal13.worker/v0',action:'trace',source_node_id:source.id,inbound_crossing_id:proposal.crossing_id});
   traces.push(trace);await replayTraces(traces,fingerprints);return trace.signed_disposition.receipt_id;
  };
  const a=NODE_DEFINITIONS[0],b=NODE_DEFINITIONS[1];
  await perform(a,b,null,'REFUSE','Explicitly refused unpedigreed relation; no implicit ancestry');
  const accepted=await perform(a,b,root.signed_disposition.receipt_id,'ACCEPT','Bounded proposal linked to witnessed local parent');
  await perform(b,a,accepted,'ACCEPT','Return attributable relation without conferring admission authority');
  const evidence={schema:'maxhinal13.sinew-https-observation/v0',observed_at:new Date().toISOString(),traces,fingerprints,observations,
   replay:await replayTraces(traces,fingerprints),claims:{sinew_two_host:true,live_thirteen_node:false,pulse_observed:false,host_outage_tested:false}};
  const output=resolve(required('MX13_EVIDENCE_OUTPUT'));await Deno.writeTextFile(output,JSON.stringify(evidence,null,2)+'\n',{mode:0o600,createNew:true});
  return {status:'PASS',evidence_path:output,claims:evidence.claims};
 });
}

try{
 if(mode==='plan'||Deno.args.includes('--dry-run'))console.log(JSON.stringify(operatorPlan(),null,2));
 else if(mode==='status')console.log(JSON.stringify(await safeStatus(),null,2));
 else if(mode==='deploy')console.log(JSON.stringify(await deploy(),null,2));
 else if(mode==='bootstrap')console.log(JSON.stringify(await bootstrap(),null,2));
 else if(mode==='sinew')console.log(JSON.stringify(await sinew(),null,2));
 else if(mode==='two-host'||mode==='thirteen')console.log(JSON.stringify(await route(mode==='thirteen'),null,2));
 else throw Error('UNKNOWN_OPERATOR_MODE');
}catch(error){
 const reason=error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'OPERATOR_OPERATION_FAILED';
 console.error(reason);Deno.exit(1); // Never print database connection diagnostics or raw capability values.
}
