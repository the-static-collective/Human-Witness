import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { FakeMeshStore } from '../src/store.ts';
import { generateP256KeyPair, sealReceipt, sealCrossingEnvelope, publicKeyFingerprint, verifyCrossingEnvelope } from '../src/relatte_v0.ts';
import { sha256Address } from '../src/payload.ts';

async function fixture(){
 const from='mx13:05-mirrorgoat',to='mx13:06-contrary';
 const source=await generateP256KeyPair(),dest=await generateP256KeyPair();
 const s=new FakeMeshStore();
 const privateJwk=await crypto.subtle.exportKey('jwk',source.privateKey);
 s.keys.set(from,{nodeId:from,keyVersion:1,publicJwk:source.publicKeyJwk,privateJwk,fingerprint:publicKeyFingerprint(source.publicKeyJwk)});
 s.peers.set(to,{nodeId:to,hostId:'pantry-gate',publicJwk:dest.publicKeyJwk,fingerprint:publicKeyFingerprint(dest.publicKeyJwk),ingressUrl:'https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/mx13-ingress',active:true});
 const bytes=Buffer.from('sample');const address=await sha256Address(bytes);
 await s.putPayload(from,{address,bytes,byteLength:bytes.length,observedName:'sample.png',detectedMediaType:'image/jpeg'});
 const local=await sealReceipt({schema:'relatte.receipt/v0',crossing_id:'relatte-crossing-v0:'+'1'.repeat(64),world_id:from,receiver_particular:address,kind:'MX13_RETURN',semantic_effect:'local-reflection',contract_ref:'maxhinal13.constitution/v0',pre_state_ref:null,post_state_ref:null,descendant_refs:[],residual_refs:[address],note:null,created_at:new Date().toISOString(),extensions:{mx13:{stage:'LOCAL_DISPOSITION',disposition:'RETURN',route_forward_allowed:true}}},source);
 s.receipts.set(local.receipt_id,local);
 return {s,from,to,source,dest,bytes,address,local};
}

test('worker builds a signed distinct route-forward crossing from a local RETURN',async()=>{
 const {createNextCrossing}=await import('../src/worker.ts'); const f=await fixture();
 const envelope=await createNextCrossing(f.from,f.to,{address:f.address,bytes:f.bytes,byteLength:f.bytes.length,observedName:'sample.png',detectedMediaType:'image/jpeg'},[f.local.receipt_id],5,f.source,'RETURN');
 assert.equal(await verifyCrossingEnvelope(envelope),true);
 assert.equal(envelope.source_world,f.from);
 assert.equal((envelope.audience_policy as any).destination,f.to);
 assert.deepEqual(envelope.parents,[f.local.receipt_id]);
 assert.equal((envelope.payload_refs[0] as any).address,f.address);
 assert.equal((envelope.extensions as any).mx13.route_forward_after_local_disposition,'RETURN');
});
test('worker sends pending envelope to HTTP ingress and verifies remote receipt',async()=>{
 const {pumpOne,enqueueForward}=await import('../src/worker.ts'); const f=await fixture();
 await enqueueForward(f.from,f.to,f.local.receipt_id,5,f.s);
 let visited='';
 const goodFetch=async(url:string,opt:any)=>{
   visited=url;const request=JSON.parse(opt.body);assert.equal(request.destination_node_id,f.to);
   const hold=await sealReceipt({schema:'relatte.receipt/v0',crossing_id:request.envelope.crossing_id,world_id:f.to,receiver_particular:f.address,kind:'MX13_HOLD',semantic_effect:'none',contract_ref:'maxhinal13.constitution/v0',pre_state_ref:null,post_state_ref:null,descendant_refs:[],residual_refs:[f.address],note:null,created_at:new Date().toISOString(),extensions:{mx13:{stage:'HOLD',destination_disposition:null,mandatory_hold:true}}},f.dest);
   const disp=await sealReceipt({schema:'relatte.receipt/v0',crossing_id:request.envelope.crossing_id,world_id:f.to,receiver_particular:f.address,kind:'MX13_ADMIT',semantic_effect:'local',contract_ref:'maxhinal13.constitution/v0',pre_state_ref:hold.receipt_id,post_state_ref:null,descendant_refs:[],residual_refs:[f.address],note:null,created_at:new Date().toISOString(),extensions:{mx13:{stage:'LOCAL_DISPOSITION',disposition:'ADMIT'}}},f.dest);
   return {ok:true,status:200,json:async()=>({crossing_id:request.envelope.crossing_id,hold_receipt:hold,disposition_receipt:disp,state:'RESOLVED',replayed:false})};
 };
 const r=await pumpOne(f.from,{store:f.s,fetch:goodFetch as any,now:()=>new Date()});
 assert.equal(r.ok,true);
 assert.equal(visited,f.s.peers.get(f.to)?.ingressUrl);
 assert.equal((await f.s.claimOutbox(f.from,r.crossingId))?.state,'COMPLETE');
});
test('worker retains signed pending outbox when remote request fails',async()=>{
 const {pumpOne,enqueueForward}=await import('../src/worker.ts'); const f=await fixture();
 const out=await enqueueForward(f.from,f.to,f.local.receipt_id,5,f.s);
 const badFetch=async()=>{throw Error('synthetic network outage')};
 const fail=await pumpOne(f.from,{store:f.s,fetch:badFetch as any});
 assert.equal(fail.ok,false);
 const item=await f.s.claimOutbox(f.from,out.crossingId);
 assert.equal(item?.state,'PENDING');assert.equal(item?.attempts,1);
 assert.equal(item?.crossingId,out.crossingId);
});
test('worker rejects receipt signed by an unrelated world',async()=>{
 const {pumpOne,enqueueForward}=await import('../src/worker.ts'); const f=await fixture();
 await enqueueForward(f.from,f.to,f.local.receipt_id,5,f.s);
 const wrong=await generateP256KeyPair();
 const response=async(_url:string,opt:any)=>{
  const request=JSON.parse(opt.body);
  const hold=await sealReceipt({schema:'relatte.receipt/v0',crossing_id:request.envelope.crossing_id,world_id:f.to,receiver_particular:f.address,kind:'MX13_HOLD',semantic_effect:'none',contract_ref:null,pre_state_ref:null,post_state_ref:null,descendant_refs:[],residual_refs:[f.address],note:null,created_at:new Date().toISOString(),extensions:{mx13:{stage:'HOLD',destination_disposition:null,mandatory_hold:true}}},wrong);
  return {ok:true,status:200,json:async()=>({crossing_id:request.envelope.crossing_id,hold_receipt:hold,state:'HOLD',replayed:false})};
 };
 const result=await pumpOne(f.from,{store:f.s,fetch:response as any});
 assert.equal(result.ok,false);assert.equal(result.error,'REMOTE_KEY_MISMATCH');
});
test('worker rejects destination receipts that identify a different source particular',async()=>{
 const {pumpOne,enqueueForward}=await import('../src/worker.ts');const f=await fixture();
 await enqueueForward(f.from,f.to,f.local.receipt_id,5,f.s);
 const forged=async(_url:string,opt:any)=>{
  const req=JSON.parse(opt.body);const fakeAddress='sha256:'+'a'.repeat(64);
  const hold=await sealReceipt({schema:'relatte.receipt/v0',crossing_id:req.envelope.crossing_id,world_id:f.to,
   receiver_particular:fakeAddress,kind:'MX13_HOLD',semantic_effect:'none',contract_ref:null,
   pre_state_ref:null,post_state_ref:null,descendant_refs:[],residual_refs:[fakeAddress],note:null,
   created_at:new Date().toISOString(),extensions:{mx13:{stage:'HOLD',destination_disposition:null,mandatory_hold:true}}},f.dest);
  const disp=await sealReceipt({schema:'relatte.receipt/v0',crossing_id:req.envelope.crossing_id,world_id:f.to,
   receiver_particular:fakeAddress,kind:'MX13_ADMIT',semantic_effect:'local',contract_ref:null,
   pre_state_ref:hold.receipt_id,post_state_ref:null,descendant_refs:[],residual_refs:[fakeAddress],note:null,
   created_at:new Date().toISOString(),extensions:{mx13:{stage:'LOCAL_DISPOSITION',disposition:'ADMIT'}}},f.dest);
  return {ok:true,status:200,json:async()=>({crossing_id:req.envelope.crossing_id,hold_receipt:hold,disposition_receipt:disp,state:'RESOLVED'})};
 };
 const r=await pumpOne(f.from,{store:f.s,fetch:forged as any});
 assert.equal(r.ok,false);assert.equal(r.error,'REMOTE_SOURCE_MISMATCH');
});

test('worker refuses a peer-registry endpoint redirected to an unrelated Supabase project',async()=>{
 const {pumpOne,enqueueForward}=await import('../src/worker.ts');const f=await fixture();
 await enqueueForward(f.from,f.to,f.local.receipt_id,5,f.s);
 const p=f.s.peers.get(f.to)!;
 p.ingressUrl='https://attacker.supabase.co/functions/v1/mx13-ingress';
 f.s.peers.set(f.to,p);
 let calls=0;
 const r=await pumpOne(f.from,{store:f.s,fetch:(async()=>{calls++;throw Error('SHOULD_NOT_SEND')}) as any});
 assert.equal(r.ok,false);
 assert.equal(r.error,'UNTRUSTED_PEER_ENDPOINT');
 assert.equal(calls,0);
});
