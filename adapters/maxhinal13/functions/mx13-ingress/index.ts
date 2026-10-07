import postgres from 'npm:postgres@3.4.9';
import { PostgresMeshStore } from '../../src/store.ts';
import { NODE_DEFINITIONS } from '../../src/nodes.ts';
import { PINNED_PROJECT_REFS } from '../../src/peers.ts';
import { handleIngress } from '../../src/ingress.ts';
import { readIdentity, runBootstrap } from '../../src/bootstrap.ts';
import { readBoundedJson } from '../../src/http.ts';

const MAX_BODY_BYTES=1_800_000;
const url=Deno.env.get('SUPABASE_URL')??'';
const hostname=new URL(url).hostname;
const ref=hostname.split('.')[0];
const HOST=ref===PINNED_PROJECT_REFS.WITNESS?'WITNESS':ref===PINNED_PROJECT_REFS['pantry-gate']?'pantry-gate':null;
if(!HOST)throw new Error('UNEXPECTED_PROJECT_REF');
const dbUrl=Deno.env.get('SUPABASE_DB_URL');
if(!dbUrl)throw new Error('MISSING_LOCAL_DB_URL');
const sql=postgres(dbUrl,{max:1,idle_timeout:5,connect_timeout:10,prepare:false,ssl:'require'});
const store=new PostgresMeshStore(sql,HOST,NODE_DEFINITIONS.filter(n=>n.host===HOST).map(n=>n.id));

function code(err:unknown):string{
 const msg=err instanceof Error?err.message:'UNKNOWN_ERROR';
 if(/^[A-Z][A-Z0-9_]{2,72}$/.test(msg))return msg;
 return 'INTERNAL_FAILURE';
}

Deno.serve(async(req:Request)=>{
 try {
   const query=new URL(req.url).searchParams;
   if(req.method==='GET'&&query.get('identity')==='1'){
     const data=await readIdentity(sql,HOST);
     return Response.json(data,{headers:{'Cache-Control':'no-store'}});
   }
   if(req.method!=='POST')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
   const body=await readBoundedJson(req,MAX_BODY_BYTES);
   if(body?.schema==='maxhinal13.bootstrap/v0'){
     if(body.action!=='identity-bootstrap'&&body.action!=='sync-peers')throw new Error('UNKNOWN_OPERATOR_ACTION');
     const result=await runBootstrap(sql,HOST,body.action,req.headers.get('x-mx13-operator')??'',fetch);
     return Response.json(result,{headers:{'Cache-Control':'no-store'}});
   }
   const result=await handleIngress(body,{store});
   return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){
   const reason=code(error);
   const unauthorized=reason==='UNAUTHORIZED_OPERATOR';
   const missing=reason==='IDENTITY_BOOTSTRAP_INCOMPLETE';
   const server=reason==='INTERNAL_FAILURE'||reason==='MISSING_LOCAL_DB_URL'||reason==='REMOTE_IDENTITY_UNAVAILABLE';
   const http=unauthorized?401:missing?503:server?503:400;
   if(server)console.error('MAXHINAL13_INTERNAL',reason);
   return Response.json({ok:false,error:reason},{status:http,headers:{'Cache-Control':'no-store'}});
 }
});
