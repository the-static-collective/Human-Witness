import test from 'node:test';
import assert from 'node:assert/strict';
import {pairFixture} from './fixtures/pair.ts';
import {pumpOne} from '../src/worker.ts';
import {sealCrossingEnvelope} from '../src/relatte_v0.ts';
import {replayTraces} from '../src/trace-replay.ts';

async function completed(){
 const f=await pairFixture();assert.equal((await pumpOne(f.a,{store:f.stores[0],fetch:f.network})).ok,true);
 const traces=[await f.stores[0].readTrace(f.a,f.envelope.crossing_id),await f.stores[1].readTrace(f.b,f.envelope.crossing_id)];
 return {traces,fingerprints:Object.fromEntries([...f.stores[0].peers].map(([id,p])=>[id,p.fingerprint]))};
}
test('cold replay verifies sender and destination records without promoting simulation to LIVE',async()=>{
 const f=await completed(), report=await replayTraces(f.traces,f.fingerprints);
 assert.equal(report.verified_crossings,1);assert.equal(report.verified_holds,1);assert.equal(report.verified_dispositions,1);
 assert.equal(report.live_two_host_proven,false);assert.equal(report.source_bytes_rehashed,false);
});
test('cold replay refuses tampered or substituted receipts and contradictory duplicate',async()=>{
 for(const tamper of ['signature','fingerprint','duplicate','duplicate-tamper']){
  const f=await completed();
  if(tamper==='signature')f.traces[0].signed_hold.note='invented history';
  if(tamper==='duplicate-tamper')f.traces[1].signed_hold.note='tampered duplicate';
  if(tamper==='fingerprint')f.fingerprints['mx13:02-gate']='sha256:'+'0'.repeat(64);
  if(tamper==='duplicate')f.traces[1].signed_disposition=null;
  await assert.rejects(()=>replayTraces(f.traces,f.fingerprints),/TRACE_/);
 }
});
test('cold replay leaves an absent return unobserved and refuses forged parent ancestry',async()=>{
 const f=await pairFixture();const trace=await f.stores[0].readTrace(f.a,f.envelope.crossing_id);
 const fingerprints=Object.fromEntries([...f.stores[0].peers].map(([id,p])=>[id,p.fingerprint]));
 const report=await replayTraces([trace],fingerprints);assert.equal(report.unresolved.length,1);
 assert.equal(report.verified_dispositions,0);
});

test('cold replay refuses signed but unobserved parent history',async()=>{
 const f=await pairFixture();const {signing,crossing_id,...draft}=f.envelope;
 const crossing=await sealCrossingEnvelope({...draft,parents:['relatte-receipt-v0:'+'a'.repeat(64)]},f.keys[0]);
 const trace={...await f.stores[0].readTrace(f.a,f.envelope.crossing_id),signed_crossing:crossing};
 const fps=Object.fromEntries([...f.stores[0].peers].map(([id,p])=>[id,p.fingerprint]));
 await assert.rejects(()=>replayTraces([trace],fps),/TRACE_PARENT_UNOBSERVED/);
});
