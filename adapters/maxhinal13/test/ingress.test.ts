import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { FakeMeshStore } from '../src/store.ts';
import { generateP256KeyPair, sealCrossingEnvelope, publicKeyFingerprint, verifyReceipt } from '../src/relatte_v0.ts';
import { sha256Address } from '../src/payload.ts';

async function loadIngress() {
  try { return await import('../src/ingress.ts'); }
  catch (error) { assert.fail(`ingress module unavailable: ${error}`); }
}

async function setup(opts:any={}) {
  const src=await generateP256KeyPair();
  const dst=await generateP256KeyPair();
  const store=new FakeMeshStore();
  const source='mx13:01-witness';
  const dest='mx13:02-gate';
  const privateJwk=await crypto.subtle.exportKey('jwk',dst.privateKey);
  store.keys.set(dest,{nodeId:dest,keyVersion:1,publicJwk:dst.publicKeyJwk,privateJwk,fingerprint:publicKeyFingerprint(dst.publicKeyJwk)});
  store.peers.set(source,{nodeId:source,hostId:'WITNESS',publicJwk:src.publicKeyJwk,fingerprint:publicKeyFingerprint(src.publicKeyJwk),ingressUrl:'https://example.test/ingress',active:true});
  const bytes=opts.bytes??Buffer.from('MAXHINAL-13 particular');
  const address=await sha256Address(bytes);
  const at=opts.createdAt??new Date().toISOString();
  const envelope=await sealCrossingEnvelope({
    schema:'relatte.crossing-envelope/v0',protocol_version:'0',source_particular:address,source_world:source,
    source_history_head:null,parents:['relatte-receipt-v0:'+'f'.repeat(64)],declared_kind:'MX13_PARTICULAR',
    payload_refs:[{address,byte_length:bytes.length,role:'particular',media_type:'application/octet-stream',observed_name:'sample.bin'}],
    requested_effect:{destination_disposition:'local'},capability_ref:null,
    privacy_policy:{field:'bounded',retention:'decay-after-export'},audience_policy:{destination:dest},return_address:source,
    created_at:at,extensions:{mx13:{route_index:1,salvage_eligible:false}},
  },src);
  const req={schema:'maxhinal13.ingress/v0',destination_node_id:dest,envelope,payload_b64:bytes.toString('base64')};
  return {store,src,dst,source,dest,bytes,address,envelope,req};
}

test('ingress commits signed HOLD before local constitution and preserves exact bytes', async () => {
  const {handleIngress}=await loadIngress();
  const f=await setup();
  const result=await handleIngress(f.req,{store:f.store,now:()=>new Date(),evaluate:undefined});
  assert.equal(result.state,'RESOLVED');
  assert.equal(result.replayed,false);
  assert.equal(result.hold_receipt.kind,'MX13_HOLD');
  assert.equal(result.hold_receipt.semantic_effect,'none');
  assert.equal(result.disposition_receipt.kind,'MX13_ADMIT');
  assert.equal(await verifyReceipt(result.hold_receipt),true);
  assert.equal(await verifyReceipt(result.disposition_receipt),true);
  assert.equal(f.store.inbound.size,1);
  assert.equal(f.store.receipts.size,2);
  assert.equal((await f.store.getPayload(f.dest,f.address))?.byteLength,f.bytes.length);
});

test('ingress refuses unknown source and wrong destination without durable state', async () => {
  const {handleIngress}=await loadIngress();
  const f=await setup();
  f.store.peers.clear();
  await assert.rejects(()=>handleIngress(f.req,{store:f.store,now:()=>new Date()}),/UNKNOWN_SOURCE/);
  assert.equal(f.store.inbound.size,0);
  const g=await setup();
  g.req.destination_node_id='mx13:03-dead-letter';
  await assert.rejects(()=>handleIngress(g.req,{store:g.store,now:()=>new Date()}),/UNKNOWN_DESTINATION/);
  assert.equal(g.store.inbound.size,0);
});

test('ingress refuses signature tamper, hash mismatch, oversized, stale, and source spoof', async () => {
  const {handleIngress}=await loadIngress();
  const a=await setup();
  a.req.envelope.declared_kind='EVIL_ADMIT';
  await assert.rejects(()=>handleIngress(a.req,{store:a.store,now:()=>new Date()}),/INVALID_SIGNATURE/);
  const b=await setup(); b.req.payload_b64=Buffer.from('changed').toString('base64');
  await assert.rejects(()=>handleIngress(b.req,{store:b.store,now:()=>new Date()}),/PAYLOAD_ADDRESS_MISMATCH|PAYLOAD_LENGTH_MISMATCH/);
  const c=await setup(); c.req.payload_b64=Buffer.alloc(1_048_577).toString('base64');
  await assert.rejects(()=>handleIngress(c.req,{store:c.store,now:()=>new Date()}),/PAYLOAD_TOO_LARGE/);
  const d=await setup({createdAt:new Date(Date.now()-301_000).toISOString()});
  await assert.rejects(()=>handleIngress(d.req,{store:d.store,now:()=>new Date()}),/STALE_ENVELOPE/);
  const e=await setup(); e.req.envelope.source_world='mx13:13-misspeldd-maxhinal';
  await assert.rejects(()=>handleIngress(e.req,{store:e.store,now:()=>new Date()}),/INVALID_SIGNATURE|SOURCE_IDENTITY_MISMATCH|UNKNOWN_SOURCE/);
  for(const f of [a,b,c,d,e])assert.equal(f.store.inbound.size,0);
});

test('duplicate delivery after terminal disposition is idempotent', async () => {
  const {handleIngress}=await loadIngress();
  const f=await setup();
  const first=await handleIngress(f.req,{store:f.store,now:()=>new Date()});
  const second=await handleIngress(f.req,{store:f.store,now:()=>new Date()});
  assert.equal(second.replayed,true);
  assert.equal(second.hold_receipt.receipt_id,first.hold_receipt.receipt_id);
  assert.equal(second.disposition_receipt.receipt_id,first.disposition_receipt.receipt_id);
  assert.equal(f.store.receipts.size,2);
});

test('crash after HOLD resumes the same receipt without manufacturing a second HOLD', async () => {
  const {handleIngress}=await loadIngress();
  const f=await setup();
  await assert.rejects(()=>handleIngress(f.req,{store:f.store,now:()=>new Date(),evaluate:()=>{throw new Error('synthetic crash')}}),/synthetic crash/);
  const holdBefore=(await f.store.getInbound(f.dest,f.envelope.crossing_id))?.holdReceiptId;
  assert.equal(f.store.inbound.size,1);
  assert.equal(f.store.receipts.size,1);
  const recovered=await handleIngress(f.req,{store:f.store,now:()=>new Date()});
  assert.equal(recovered.hold_receipt.receipt_id,holdBefore);
  assert.equal(f.store.receipts.size,2);
});
