import test from 'node:test';
import assert from 'node:assert/strict';
import {pairFixture} from './fixtures/pair.ts';
import {pumpOne} from '../src/worker.ts';
import {verifyHopHistories} from '../src/trace-replay.ts';

async function observed(){
 const f=await pairFixture();assert.equal((await pumpOne(f.a,{store:f.stores[0],fetch:f.network})).ok,true);
 return {f,source:await f.stores[0].readTrace(f.a,f.envelope.crossing_id),destination:await f.stores[1].readTrace(f.b,f.envelope.crossing_id),
  fingerprints:Object.fromEntries([...f.stores[0].peers].map(([id,p])=>[id,p.fingerprint])),
  expected:{crossing_id:f.envelope.crossing_id,source_node:f.a,destination_node:f.b,particular:f.address}};
}
test('hop verification compares independent host custody and preserves REFUSE without inferring LIVE',async()=>{
 const w=await observed(), report=await verifyHopHistories(w.expected,w.source,w.destination,[],w.fingerprints);
 assert.equal(report.verified_crossings,1);assert.equal(report.verified_dispositions,1);
 assert.equal(w.destination.signed_disposition!.kind,'MX13_REFUSE');assert.equal(report.live_two_host_proven,false);
});
test('hop verification refuses a sender copy substituted for destination history and unexpected crossings or particulars',async()=>{
 const w=await observed();
 await assert.rejects(()=>verifyHopHistories(w.expected,w.source,w.source,[],w.fingerprints),/HOP_DESTINATION_CUSTODY_REQUIRED/);
 await assert.rejects(()=>verifyHopHistories({...w.expected,crossing_id:'relatte-crossing-v0:'+'0'.repeat(64)},w.source,w.destination,[],w.fingerprints),/HOP_CROSSING_MISMATCH/);
 await assert.rejects(()=>verifyHopHistories({...w.expected,particular:'sha256:'+'0'.repeat(64)},w.source,w.destination,[],w.fingerprints),/HOP_PARTICULAR_MISMATCH/);
});
test('hop verification refuses absent or tampered destination receipts before advancement',async()=>{
 const w=await observed(), missing=structuredClone(w.destination);missing.signed_disposition=null;
 await assert.rejects(()=>verifyHopHistories(w.expected,w.source,missing,[],w.fingerprints),/HOP_HISTORY_UNRESOLVED/);
 const tampered=structuredClone(w.destination);tampered.signed_hold!.note='invented independent history';
 await assert.rejects(()=>verifyHopHistories(w.expected,w.source,tampered,[],w.fingerprints),/TRACE_RECEIPT_BINDING_OR_SIGNATURE/);
});
