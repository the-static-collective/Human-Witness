import test from 'node:test';
import assert from 'node:assert/strict';
import {generateP256KeyPair,publicKeyFingerprint} from '../src/relatte_v0.ts';
import {NODE_DEFINITIONS} from '../src/nodes.ts';
import {sha256Token} from '../src/store.ts';
import {Buffer} from 'node:buffer';
const FIXTURE_OPERATOR=Buffer.alloc(32,0x5a).toString('base64url');

async function identity(host:'WITNESS'|'pantry-gate'){
 const nodes=[];
 for(const n of NODE_DEFINITIONS.filter(x=>x.host===host)){
  const k=await generateP256KeyPair();nodes.push({node_id:n.id,host_id:host,key_version:1,public_jwk:k.publicKeyJwk,fingerprint:publicKeyFingerprint(k.publicKeyJwk)});
 }
 return {schema:'maxhinal13.identity/v0',host_id:host,nodes};
}
class Sql {
 identities=new Map<string,any>();peers=new Map<string,any>();
 tokenHash=sha256Token(FIXTURE_OPERATOR);
 async begin<T>(f:(q:Sql)=>Promise<T>){return f(this)}
 async unsafe(query:string,params:any[]=[]){
  if(query.includes('operator_capabilities'))return [{token_hash:this.tokenHash}];
  if(query.includes('pg_advisory_xact_lock'))return [];
  if(query.includes('select node_id,key_version,public_jwk,fingerprint from mx13_host.node_keys'))return [...this.identities.values()];
  if(query.includes('insert into mx13_host.node_keys')){
   const [node_id,key_version,public_jwk,private_jwk,fingerprint]=params;
   this.identities.set(node_id,{node_id,key_version,public_jwk:JSON.parse(public_jwk),private_jwk:JSON.parse(private_jwk),fingerprint});return [];
  }
  if(query.includes('select node_id,fingerprint from mx13_host.peers'))return [...this.peers.values()].map(x=>({node_id:x.nodeId,fingerprint:x.fingerprint}));
  if(query.includes('insert into mx13_host.peers')){
   const [nodeId,hostId,publicJwk,fingerprint,ingressUrl]=params;
   if(!this.peers.has(nodeId))this.peers.set(nodeId,{nodeId,hostId,publicJwk:JSON.parse(publicJwk),fingerprint,ingressUrl});
   return [];
  }
  throw Error('UNEXPECTED_SQL:'+query);
 }
}

test('bootstrap rejects request without host local capability',async()=>{
 const {runBootstrap}=await import('../src/bootstrap.ts');const sql=new Sql();
 await assert.rejects(()=>runBootstrap(sql,'WITNESS','identity-bootstrap','wrong',async()=>{throw Error('must not fetch')}),/UNAUTHORIZED_OPERATOR/);
 assert.equal(sql.identities.size,0);
});
test('bootstrap generates local keys and exposes public-only identity metadata',async()=>{
 const {runBootstrap,readIdentity}=await import('../src/bootstrap.ts');const sql=new Sql();
 const first=await runBootstrap(sql,'WITNESS','identity-bootstrap',FIXTURE_OPERATOR,async()=>{throw Error('must not fetch')});
 assert.equal(first.nodes.length,7);
 assert.equal(JSON.stringify(first).includes('private_jwk'),false);
 assert.equal([...sql.identities.values()].every(x=>typeof x.private_jwk.d==='string'),true);
 const again=await readIdentity(sql,'WITNESS');
 assert.deepEqual(again.nodes.map(x=>x.fingerprint),first.nodes.map(x=>x.fingerprint));
});
test('sync only trusts pinned peer identities and forbids implicit rotation',async()=>{
 const {runBootstrap}=await import('../src/bootstrap.ts');const sql=new Sql();
 const remote=await identity('pantry-gate');
 await runBootstrap(sql,'WITNESS','identity-bootstrap',FIXTURE_OPERATOR,async()=>{throw Error('must not fetch')});
 let uri='';
 const result=await runBootstrap(sql,'WITNESS','sync-peers',FIXTURE_OPERATOR,async(url)=>{
  uri=url;return {ok:true,status:200,json:async()=>remote};
 });
 assert.equal(uri,'https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/mx13-ingress?identity=1');
 assert.equal(result.count,13);assert.equal(sql.peers.size,13);
 const changed=structuredClone(remote);changed.nodes[0].fingerprint='sha256:'+'9'.repeat(64);
 await assert.rejects(()=>runBootstrap(sql,'WITNESS','sync-peers',FIXTURE_OPERATOR,async()=>({ok:true,status:200,json:async()=>changed})),/IDENTITY_FINGERPRINT_MISMATCH/);
 assert.equal(sql.peers.size,13);
});
