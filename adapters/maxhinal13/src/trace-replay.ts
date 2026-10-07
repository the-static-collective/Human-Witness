/** Independent receipt replay: no database, live host, pulse, or original media dependency. */
import type {TransportTrace} from './store.ts';
import {isNodeId,nodeDefinition} from './nodes.ts';
import {verifyCrossingEnvelope,verifyReceipt,publicKeyFingerprint} from './relatte_v0.ts';

export interface ReplayReport {
  verified_crossings:number; verified_holds:number; verified_dispositions:number;
  unresolved:string[]; ancestry:Record<string,string[]>;
  live_two_host_proven:false; live_thirteen_node_proven:false; source_bytes_rehashed:false;
}
export async function replayTraces(traces:TransportTrace[],fingerprints:Record<string,string>):Promise<ReplayReport>{
 const report:ReplayReport={verified_crossings:0,verified_holds:0,verified_dispositions:0,
  unresolved:[],ancestry:{},live_two_host_proven:false,live_thirteen_node_proven:false,source_bytes_rehashed:false};
 const receipts=new Map<string,any>(), seen=new Map<string,string>();
 for(const trace of traces){
  const x=trace.signed_crossing;
  if(!isNodeId(trace.node_id)||nodeDefinition(trace.node_id).host!==trace.host_id)throw Error('TRACE_WRONG_LOCAL_HOST');
  if(!(await verifyCrossingEnvelope(x)))throw Error('TRACE_CROSSING_SIGNATURE');
  const dest=x.audience_policy?.destination;
  if(!isNodeId(dest)||!isNodeId(x.source_world))throw Error('TRACE_UNKNOWN_WORLD');
  if(publicKeyFingerprint(x.signing.public_key)!==fingerprints[x.source_world])throw Error('TRACE_SOURCE_KEY_SUBSTITUTION');
  if(trace.node_id!==dest && trace.node_id!==x.source_world)throw Error('TRACE_WRONG_CUSTODIAN');
  const particular=x.source_particular;
  if(x.payload_refs.length!==1||x.payload_refs[0].address!==particular)throw Error('TRACE_SOURCE_ADDRESS_MISMATCH');
  const previous=seen.get(x.crossing_id);
  const claim=JSON.stringify({hold:trace.signed_hold?.receipt_id??null,disposition:trace.signed_disposition?.receipt_id??null});
  const duplicate=previous===claim;
  if(previous!==undefined&&!duplicate)throw Error('TRACE_DUPLICATE_CONFLICT');
  seen.set(x.crossing_id,claim);if(!duplicate)report.verified_crossings++;
  const hold=trace.signed_hold, disp=trace.signed_disposition;
  if(!hold){if(disp)throw Error('TRACE_DISPOSITION_WITHOUT_HOLD');if(!report.unresolved.includes(x.crossing_id))report.unresolved.push(x.crossing_id);continue;}
  for(const receipt of [hold,disp]){
   if(!receipt)continue;
   if(!(await verifyReceipt(receipt))||receipt.world_id!==dest||receipt.crossing_id!==x.crossing_id||
     receipt.receiver_particular!==particular||publicKeyFingerprint(receipt.signing.public_key)!==fingerprints[dest])throw Error('TRACE_RECEIPT_BINDING_OR_SIGNATURE');
   receipts.set(receipt.receipt_id,receipt);
  }
  const h=hold.extensions.mx13 as any;
  if(hold.kind!=='MX13_HOLD'||hold.semantic_effect!=='none'||h?.mandatory_hold!==true||h?.destination_disposition!==null)throw Error('TRACE_MANDATORY_HOLD_MISSING');
  if(!duplicate)report.verified_holds++;
  for(const observation of trace.relation_observations??[]){
   if(x.declared_kind!=='SINEW_PROPOSED_EDGE'||!(await verifyReceipt(observation))||observation.world_id!==dest||observation.crossing_id!==x.crossing_id||
      observation.receiver_particular!==particular||observation.pre_state_ref!==hold.receipt_id||publicKeyFingerprint(observation.signing.public_key)!==fingerprints[dest]||
      observation.kind!=='MX13_EDGE_HOLD'||observation.semantic_effect!=='none'||(observation.extensions.sinew as {decision?:string}|undefined)?.decision!=='HOLD')throw Error('TRACE_RELATION_OBSERVATION_INVALID');
   report.ancestry[observation.receipt_id]=[hold.receipt_id,x.crossing_id];
  }
  if(!disp){if(!report.unresolved.includes(x.crossing_id))report.unresolved.push(x.crossing_id);continue;}
  const d=disp.extensions.mx13 as any;
  if(d?.stage!=='LOCAL_DISPOSITION'||disp.pre_state_ref!==hold.receipt_id||disp.kind!==`MX13_${d.disposition}`||
     disp.created_at<hold.created_at)throw Error('TRACE_DISPOSITION_ORDER');
  if(['mx13:01-witness','mx13:11-oracl','mx13:12-ferryman'].includes(dest)&&d.disposition==='ADMIT')throw Error('TRACE_FORBIDDEN_ADMISSION_AUTHORITY');
  if(x.declared_kind==='SINEW_PROPOSED_EDGE'&&((disp.extensions.sinew as {edge_id?:string}|undefined)?.edge_id!==(x.extensions.sinew as {edge_id?:string}|undefined)?.edge_id||
    !['ACCEPT','REFUSE'].includes(((disp.extensions.sinew as {decision?:string}|undefined)?.decision??''))))throw Error('TRACE_RELATION_DECISION_MISMATCH');
  if(!duplicate)report.verified_dispositions++;
  report.ancestry[disp.receipt_id]=[hold.receipt_id,x.crossing_id,...x.parents.filter((p):p is string=>typeof p==='string')];
 }
 for(const trace of traces){
  const x=trace.signed_crossing;
  for(const parent of x.parents){
   if(typeof parent!=='string'||!receipts.has(parent))throw Error('TRACE_PARENT_UNOBSERVED');
   const receipt=receipts.get(parent);
   if(receipt.world_id!==x.source_world||(x.declared_kind!=='SINEW_PROPOSED_EDGE'&&receipt.receiver_particular!==x.source_particular))throw Error('TRACE_PARENT_SCOPE_MISMATCH');
  }
 }
 return report;
}
