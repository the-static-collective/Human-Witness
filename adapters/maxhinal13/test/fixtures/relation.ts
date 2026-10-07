import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {pairFixture} from './pair.ts';
import {edge,proposeEdge,decideEdge,backpressure,validateEdge} from '../../src/sinew.ts';
import {handleIngress} from '../../src/ingress.ts';
import {pumpOne} from '../../src/worker.ts';
import {sealCrossingEnvelope} from '../../src/relatte_v0.ts';
import {replayTraces} from '../../src/trace-replay.ts';

export async function relationWitness(){
 const f=await pairFixture();f.stores[0].outbox.clear();
 const network=async(_url:any,opts:any)=>{
  const req=JSON.parse(opts.body), dest=req.destination_node_id;
  return new Response(JSON.stringify(await handleIngress(req,{store:f.stores[dest===f.a?0:1]})));
 };
 const noParent=await edge({source_node:f.a,destination_node:f.b,reason:'unpedigreed relation probe',parent_ref:null});
 const refused=await proposeEdge(f.stores[0],noParent);
 assert.equal((await pumpOne(f.a,{store:f.stores[0],fetch:network})).error,'DESTINATION_REMAINS_HELD');
 assert.equal((await f.stores[1].getInbound(f.b,refused.crossingId)).state,'HOLD');
 await assert.rejects(()=>decideEdge(f.stores[1],f.b,refused.crossingId,'ACCEPT','local operator'),/CANNOT_BYPASS/);
 const holding=await decideEdge(f.stores[1],f.b,refused.crossingId,'HOLD','local operator');
 const refusal=await decideEdge(f.stores[1],f.b,refused.crossingId,'REFUSE','local operator');
 assert.equal((await pumpOne(f.a,{store:f.stores[0],fetch:network})).ok,true);
 assert.equal((await decideEdge(f.stores[1],f.b,refused.crossingId,'REFUSE','local operator')).receipt_id,refusal.receipt_id);
 await assert.rejects(()=>decideEdge(f.stores[1],f.b,refused.crossingId,'ACCEPT','local operator'),/TERMINAL_DISPOSITION_IMMUTABLE/);
 // A separate witnessed subject supplies honest source-local ancestry for the new proposal.
 const {signing,crossing_id,...draft}=f.envelope;
 const root=await sealCrossingEnvelope({...draft,audience_policy:{destination:f.a}},f.keys[0]);
 const local=await handleIngress({schema:'maxhinal13.ingress/v0',destination_node_id:f.a,envelope:root,payload_b64:Buffer.from(f.bytes).toString('base64')},{store:f.stores[0]});
 const good=await edge({source_node:f.a,destination_node:f.b,reason:'bounded relation to locally witnessed parent',parent_ref:local.disposition_receipt!.receipt_id});
 const accepted=await proposeEdge(f.stores[0],good);
 assert.equal((await pumpOne(f.a,{store:f.stores[0],fetch:network})).error,'DESTINATION_REMAINS_HELD');
 const acceptance=await decideEdge(f.stores[1],f.b,accepted.crossingId,'ACCEPT','destination operator');
 assert.equal(acceptance.extensions.sinew.decision,'ACCEPT');assert.equal(acceptance.kind,'MX13_ADMIT');
 assert.equal((await pumpOne(f.a,{store:f.stores[0],fetch:network})).ok,true);
 const returned=await proposeEdge(f.stores[1],await edge({source_node:f.b,destination_node:f.a,reason:'return attributable relation',parent_ref:acceptance.receipt_id}));
 assert.equal((await pumpOne(f.b,{store:f.stores[1],fetch:network})).error,'DESTINATION_REMAINS_HELD');
 const returnDecision=await decideEdge(f.stores[0],f.a,returned.crossingId,'ACCEPT','witness operator');
 assert.equal(returnDecision.kind,'MX13_FORWARD'); // Witness's ACCEPT cannot manufacture ADMIT.
 assert.equal((await pumpOne(f.b,{store:f.stores[1],fetch:network})).ok,true);
 const traces=[await f.stores[0].readTrace(f.a,root.crossing_id),await f.stores[1].readTrace(f.b,refused.crossingId),
  await f.stores[0].readTrace(f.a,accepted.crossingId),await f.stores[1].readTrace(f.b,returned.crossingId)];
 const fingerprints=Object.fromEntries([...f.stores[0].peers].map(([n,p])=>[n,p.fingerprint]));
 return {f,traces,fingerprints,holding};
}
