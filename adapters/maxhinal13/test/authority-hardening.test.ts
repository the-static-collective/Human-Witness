import test from 'node:test';
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {pairFixture} from './fixtures/pair.ts';
import {handleIngress} from '../src/ingress.ts';
import {sealCrossingEnvelope,sealReceipt} from '../src/relatte_v0.ts';
import {pumpOne,keyMaterial} from '../src/worker.ts';
import {authorizeHostOperator} from '../src/operator.ts';
import {sha256Token} from '../src/store.ts';
import {randomBytes} from 'node:crypto';

test('signed requests cannot turn represented authority into local admission',async()=>{
 for(const change of [{requested_effect:{destination_disposition:'ADMIT'}},{capability_ref:'global-execute'}]){
  const f=await pairFixture(),{signing,crossing_id,...draft}=f.envelope;
  const bad=await sealCrossingEnvelope({...draft,...change},f.keys[0]);
  await assert.rejects(()=>handleIngress({schema:'maxhinal13.ingress/v0',destination_node_id:f.b,envelope:bad,payload_b64:Buffer.from(f.bytes).toString('base64')},{store:f.stores[1]}),/ROUTER_CANNOT_ADMIT/);
  assert.equal(f.stores[1].inbound.size,0);
 }
});
test('operator replay after expiry or revocation refuses before any bootstrap work',async()=>{
 const token=randomBytes(32).toString('base64url');let active=true, expired=false;
 const sql={async unsafe(q:string){assert.match(q,/active=true/);assert.match(q,/expires_at>now/);return active&&!expired?[{token_hash:sha256Token(token)}]:[];}};
 await authorizeHostOperator(sql,token);active=false;await assert.rejects(()=>authorizeHostOperator(sql,token),/UNAUTHORIZED_OPERATOR/);
 active=true;expired=true;await assert.rejects(()=>authorizeHostOperator(sql,token),/UNAUTHORIZED_OPERATOR/);
});
test('a node cannot use a sibling signing identity even on the same physical host',async()=>{
 const f=await pairFixture(),record=await f.stores[0].loadNodeKey(f.a);
 await assert.rejects(()=>keyMaterial({...record,nodeId:'mx13:03-dead-letter'},f.a),/NODE_KEY_SCOPE_VIOLATION/);
 await assert.rejects(()=>keyMaterial({...record,privateJwk:{...record.privateJwk,x:'substituted'}},f.a),/NODE_KEY_SCOPE_VIOLATION/);
});
test('tampered durable outbox refuses before network and retains safe error evidence',async()=>{
 const f=await pairFixture();[...f.stores[0].outbox.values()][0].envelope.source_world=f.b;
 let calls=0;const result=await pumpOne(f.a,{store:f.stores[0],fetch:async()=>{calls++;throw Error('must not run');}});
 assert.equal(calls,0);assert.equal(result.error,'OUTBOX_SOURCE_SIGNATURE_OR_SCOPE');
 assert.equal((await f.stores[0].claimOutbox(f.a,f.envelope.crossing_id)).state,'PENDING');
});
test('unreachable host failure cannot leak network credential diagnostics',async()=>{
 const f=await pairFixture();const result=await pumpOne(f.a,{store:f.stores[0],fetch:async()=>{throw Error('postgres://operator:secret@host/path');}});
 assert.equal(result.error,'TRANSPORT_FAILED');assert.equal(JSON.stringify(await f.stores[0].readTrace(f.a,f.envelope.crossing_id)).includes('secret'),false);
});
