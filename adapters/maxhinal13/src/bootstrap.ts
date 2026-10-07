import type { SqlClientLike } from './store.ts';
import { ensureLocalIdentities, type PublicNodeIdentity } from './identity.ts';
import { NODE_DEFINITIONS } from './nodes.ts';
import { authorizeHostOperator } from './operator.ts';
import {PINNED_PROJECT_REFS, validateIdentityBundle, preparePeerSync, type HostId, type IdentityBundleV0} from './peers.ts';

export type BootstrapAction='identity-bootstrap'|'sync-peers';
export interface BootstrapResult {schema:'maxhinal13.bootstrap-result/v0';host_id:HostId;action:BootstrapAction;count:number;nodes?:PublicNodeIdentity[]}

export async function readIdentity(sql:SqlClientLike,host:HostId):Promise<IdentityBundleV0>{
  const rows=await sql.unsafe('select node_id,key_version,public_jwk,fingerprint from mx13_host.node_keys where active=true order by node_id');
  const local=NODE_DEFINITIONS.filter(n=>n.host===host);
  const publicNodes=local.map(n=>{
    const r=rows.find((x:any)=>x.node_id===n.id);
    if(!r)throw new Error('IDENTITY_BOOTSTRAP_INCOMPLETE');
    return {node_id:n.id,host_id:host,key_version:Number(r.key_version),public_jwk:r.public_jwk,fingerprint:r.fingerprint};
  });
  await validateIdentityBundle({schema:'maxhinal13.identity/v0',host_id:host,nodes:publicNodes},host);
  return {schema:'maxhinal13.identity/v0',host_id:host,nodes:publicNodes};
}

export async function runBootstrap(sql:SqlClientLike,host:HostId,action:BootstrapAction,token:string,fetcher:typeof fetch):Promise<BootstrapResult>{
  await authorizeHostOperator(sql,token);
  if(action==='identity-bootstrap'){
    const identities=await ensureLocalIdentities(sql,host);
    return {schema:'maxhinal13.bootstrap-result/v0',host_id:host,action,count:identities.length,nodes:identities};
  }
  if(action!=='sync-peers')throw new Error('UNKNOWN_OPERATOR_ACTION');
  const local=await readIdentity(sql,host);
  const remoteHost:HostId=host==='WITNESS'?'pantry-gate':'WITNESS';
  const remoteRef=PINNED_PROJECT_REFS[remoteHost];
  const target=`https://${remoteRef}.supabase.co/functions/v1/mx13-ingress?identity=1`;
  const response=await fetcher(target,{method:'GET',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('REMOTE_IDENTITY_UNAVAILABLE');
  const remote=await validateIdentityBundle(await response.json(),remoteHost);
  const witness=host==='WITNESS'?local.nodes:remote;
  const pantry=host==='pantry-gate'?local.nodes:remote;
  const operation=async(tx:SqlClientLike)=>{
    await tx.unsafe('select pg_advisory_xact_lock(hashtext($1))',['maxhinal13-peers']);
    const existing=await tx.unsafe('select node_id,fingerprint from mx13_host.peers');
    const current=new Map<string,string>(existing.map((x:any)=>[x.node_id,x.fingerprint]));
    const peers=preparePeerSync(witness,pantry,current);
    for(const peer of peers){
      await tx.unsafe(`insert into mx13_host.peers(node_id,host_id,public_jwk,fingerprint,ingress_url)
        values($1,$2,$3::jsonb,$4,$5) on conflict(node_id) do nothing`,
      [peer.nodeId,peer.hostId,JSON.stringify(peer.publicJwk),peer.fingerprint,peer.ingressUrl]);
    }
    const final=await tx.unsafe('select node_id,fingerprint from mx13_host.peers');
    const finalMap=new Map<string,string>(final.map((x:any)=>[x.node_id,x.fingerprint]));
    for(const peer of peers){
      if(finalMap.get(peer.nodeId)!==peer.fingerprint)throw new Error('PEER_KEY_ROTATION_REQUIRES_CEREMONY');
    }
    return peers;
  };
  const peers=sql.begin?await sql.begin(operation):await operation(sql);
  return {schema:'maxhinal13.bootstrap-result/v0',host_id:host,action,count:peers.length};
}
