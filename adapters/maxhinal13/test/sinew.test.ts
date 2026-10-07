import test from 'node:test';
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {pairFixture} from './fixtures/pair.ts';
import {edge,proposeEdge,decideEdge,backpressure,validateEdge} from '../src/sinew.ts';
import {handleIngress} from '../src/ingress.ts';
import {pumpOne} from '../src/worker.ts';
import {sealCrossingEnvelope} from '../src/relatte_v0.ts';
import {replayTraces} from '../src/trace-replay.ts';

import {relationWitness} from './fixtures/relation.ts';

test('SINEW simulated 01→02→01 keeps refusal, HOLD, explicit acceptance and native authority distinct',async()=>{
 const w=await relationWitness(), report=await replayTraces(w.traces,w.fingerprints);
 assert.equal(report.verified_crossings,4);assert.equal(report.verified_dispositions,4);
 assert.ok(report.ancestry[w.holding.receipt_id]);assert.equal(report.live_two_host_proven,false);
 assert.equal((await backpressure(w.f.stores[1],w.f.b)).automatic_admission,false);
});
test('SINEW rejects authority fields, wrong parent custody, malformed time and forged parent proof before HOLD',async()=>{
 const f=await pairFixture();const p=await edge({source_node:f.a,destination_node:f.b,reason:'bounded',parent_ref:null});
 for(const changed of [{...p,authority:'ADMIT'},{...p,created_at:'2026-99-99Tbad'},{...p,scope:'global-authority'}]){
  await assert.rejects(()=>validateEdge(Buffer.from(JSON.stringify(changed)),f.a,f.b),/INVALID_RELATION/);
 }
 await assert.rejects(async()=>proposeEdge(f.stores[0],await edge({source_node:f.a,destination_node:f.b,reason:'no fabricated custody',parent_ref:'relatte-receipt-v0:'+'a'.repeat(64)})),/PARENT_NOT_IN_LOCAL_CUSTODY/);
 const q=await proposeEdge(f.stores[0],p);const {signing,crossing_id,...draft}=q.envelope;
 const forged=await sealCrossingEnvelope({...draft,source_history_head:'relatte-receipt-v0:'+'a'.repeat(64)},f.keys[0]);
 const payload=await f.stores[0].getPayload(f.a,q.payloadAddress);
 await assert.rejects(()=>handleIngress({schema:'maxhinal13.ingress/v0',destination_node_id:f.b,envelope:forged,payload_b64:Buffer.from(payload!.bytes).toString('base64')},{store:f.stores[1]}),/PARENT_SCOPE/);
 assert.equal(f.stores[1].inbound.size,0);
});
test('SINEW relation backlog remains pending and observable without a destination decision',async()=>{
 const f=await pairFixture();f.stores[0].outbox.clear();
 const q=await proposeEdge(f.stores[0],await edge({source_node:f.a,destination_node:f.b,reason:'wait for human',parent_ref:null}));
 await pumpOne(f.a,{store:f.stores[0],fetch:f.network});
 const pressure=await backpressure(f.stores[1],f.b);assert.equal(pressure.held_count,1);assert.equal(pressure.automatic_admission,false);
 assert.equal((await f.stores[0].claimOutbox(f.a,q.crossingId)).state,'PENDING');
 const trace=await f.stores[0].readTrace(f.a,q.crossingId);assert.ok(trace.signed_hold);assert.equal(trace.signed_disposition,null);
});
