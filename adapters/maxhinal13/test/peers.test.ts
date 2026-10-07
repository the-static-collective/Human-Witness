import test from 'node:test';
import assert from 'node:assert/strict';
import {generateP256KeyPair, publicKeyFingerprint} from '../src/relatte_v0.ts';
import {NODE_DEFINITIONS} from '../src/nodes.ts';

async function loadPeers(){return await import('../src/peers.ts')}
async function identity(host:'WITNESS'|'pantry-gate'){
 const rows=[];
 for(const n of NODE_DEFINITIONS.filter(x=>x.host===host)){
  const k=await generateP256KeyPair();
  rows.push({node_id:n.id,host_id:host,key_version:1,public_jwk:k.publicKeyJwk,fingerprint:publicKeyFingerprint(k.publicKeyJwk)});
 }
 return {schema:'maxhinal13.identity/v0',host_id:host,nodes:rows};
}
test('peer bootstrap accepts only pinned full seven and six node bundles',async()=>{
 const {validateIdentityBundle}=await loadPeers();
 const w=await identity('WITNESS'); const p=await identity('pantry-gate');
 assert.equal((await validateIdentityBundle(w,'WITNESS')).length,7);
 assert.equal((await validateIdentityBundle(p,'pantry-gate')).length,6);
 const truncated={...w,nodes:w.nodes.slice(1)};
 await assert.rejects(()=>validateIdentityBundle(truncated,'WITNESS'),/IDENTITY_BUNDLE_INCOMPLETE/);
 await assert.rejects(()=>validateIdentityBundle(w,'pantry-gate'),/IDENTITY_HOST_MISMATCH/);
});
test('peer bootstrap rejects forged public fingerprint and private material',async()=>{
 const {validateIdentityBundle}=await loadPeers();
 const w=await identity('WITNESS');
 const forged=structuredClone(w); forged.nodes[0].fingerprint='sha256:'+'f'.repeat(64);
 await assert.rejects(()=>validateIdentityBundle(forged,'WITNESS'),/IDENTITY_FINGERPRINT_MISMATCH/);
 const leaked=structuredClone(w); (leaked.nodes[0].public_jwk as any).d='notprivate';
 await assert.rejects(()=>validateIdentityBundle(leaked,'WITNESS'),/PRIVATE_KEY_MATERIAL/);
});
test('peer sync refuses changing an existing fingerprint (rotation ceremony required)',async()=>{
 const {validateIdentityBundle, preparePeerSync}=await loadPeers();
 const w=await validateIdentityBundle(await identity('WITNESS'),'WITNESS');
 const p=await validateIdentityBundle(await identity('pantry-gate'),'pantry-gate');
 const peers=preparePeerSync(w,p,new Map());
 assert.equal(peers.length,13);
 assert.equal(peers.filter((x:any)=>x.hostId==='WITNESS').length,7);
 assert.equal(peers.filter((x:any)=>x.hostId==='pantry-gate').length,6);
 const first=peers[0];
 assert.throws(()=>preparePeerSync(w,p,new Map([[first.nodeId,'sha256:'+'0'.repeat(64)]])),/PEER_KEY_ROTATION_REQUIRES_CEREMONY/);
 assert.equal(peers.every((x:any)=>!('d' in x.publicJwk)),true);
});
