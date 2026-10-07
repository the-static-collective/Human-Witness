import {keyMaterial} from './worker.ts';
import {validateEdge} from './sinew.ts';
import type { CrossingEnvelopeV0, NodeId, ReceiptV0, P256KeyMaterial } from './model.ts';
import type { MeshStore, StoredNodeKey } from './store.ts';
import { isNodeId, nodeDefinition } from './nodes.ts';
import { verifyCrossingEnvelope, publicKeyFingerprint, sealReceipt, verifyReceipt } from './relatte_v0.ts';
import { verifyPayload, assertFreshTimestamp, sha256Address } from './payload.ts';
import { evaluateConstitution, type ConstitutionContext, type ConstitutionResult } from './constitutions.ts';

export interface IngressRequestV0 {
  schema: 'maxhinal13.ingress/v0';
  destination_node_id: NodeId;
  envelope: CrossingEnvelopeV0;
  payload_b64: string;
}
export interface IngressResponseV0 {
  crossing_id: string;
  hold_receipt: ReceiptV0;
  disposition_receipt?: ReceiptV0;
  state: 'HOLD' | 'RESOLVED';
  replayed: boolean;
}
export interface IngressDeps {
  store: MeshStore;
  now?: () => Date;
  evaluate?: (ctx: ConstitutionContext) => ConstitutionResult;
}

function receiptDraft(envelope:CrossingEnvelopeV0,dest:NodeId,kind:string,semanticEffect:string,pre:unknown,post:unknown,descendants:string[],note:string,at:string,extension:Record<string,unknown>):Record<string,unknown>{
  return {
    schema:'relatte.receipt/v0',crossing_id:envelope.crossing_id,world_id:dest,receiver_particular:envelope.source_particular,
    kind,semantic_effect:semanticEffect,contract_ref:'maxhinal13.constitution/v0',pre_state_ref:pre,post_state_ref:post,
    descendant_refs:descendants,residual_refs:[envelope.payload_refs[0]?.address],note,created_at:at,
    extensions:{mx13:extension},
  };
}
async function existingResponse(store:MeshStore,dest:NodeId,existing:any):Promise<IngressResponseV0>{
  const hold=await store.getReceipt(dest,existing.holdReceiptId);
  if (!hold) throw new Error('MISSING_DURABLE_HOLD');
  const disposition=existing.dispositionReceiptId?await store.getReceipt(dest,existing.dispositionReceiptId):null;
  if (existing.state==='RESOLVED' && !disposition) throw new Error('MISSING_DURABLE_DISPOSITION');
  return {crossing_id:existing.crossingId,hold_receipt:hold, ...(disposition?{disposition_receipt:disposition}:{}),state:existing.state,replayed:true};
}

export async function handleIngress(req: IngressRequestV0, deps: IngressDeps): Promise<IngressResponseV0> {
  if (req?.schema!=='maxhinal13.ingress/v0') throw new Error('INVALID_INGRESS_SCHEMA');
  const dest=req.destination_node_id;
  if (!isNodeId(dest)) throw new Error('UNKNOWN_DESTINATION');
  const e=req.envelope;
  if (!e || e.schema!=='relatte.crossing-envelope/v0') throw new Error('INVALID_CROSSING');
  if (e.audience_policy?.destination!==dest) throw new Error('UNKNOWN_DESTINATION');
  if (typeof e.source_world!=='string' || !isNodeId(e.source_world)) throw new Error('UNKNOWN_SOURCE');
  const source=e.source_world as NodeId;
  const peer=await deps.store.loadPeer(source);
  if (!peer || !peer.active) throw new Error('UNKNOWN_SOURCE');
  if (!(await verifyCrossingEnvelope(e))) throw new Error('INVALID_SIGNATURE');
  if (publicKeyFingerprint(e.signing.public_key)!==peer.fingerprint) throw new Error('SOURCE_KEY_MISMATCH');
  if((e.requested_effect as {destination_disposition?:unknown}|null)?.destination_disposition!=='local'||e.capability_ref!==null)throw Error('ROUTER_CANNOT_ADMIT');
  const {bytes,address}=await verifyPayload(e,req.payload_b64);
  if(e.declared_kind==='SINEW_PROPOSED_EDGE'){
    const proposal=await validateEdge(bytes,source,dest), proof=(e.extensions?.sinew as {parent_receipt?:ReceiptV0}|undefined)?.parent_receipt;
    if(proposal.created_at!==e.created_at)throw Error('RELATION_TIME_MISMATCH');
    if(JSON.stringify(e.parents)!==JSON.stringify(proposal.parent_ref?[proposal.parent_ref]:[])||e.source_history_head!==proposal.parent_ref)throw Error('RELATION_PARENT_SCOPE_MISMATCH');
    if(proposal.parent_ref&&(!proof||(proof.extensions.mx13 as {stage?:string}|undefined)?.stage!=='LOCAL_DISPOSITION'||proof.receipt_id!==proposal.parent_ref||proof.world_id!==source||!(await verifyReceipt(proof))||publicKeyFingerprint(proof.signing.public_key)!==peer.fingerprint))throw Error('RELATION_PARENT_PROOF_INVALID');
    if(!proposal.parent_ref&&proof!=null)throw Error('RELATION_PARENT_PROOF_INVALID');
  }
  let localKey:StoredNodeKey;
  try { localKey=await deps.store.loadNodeKey(dest); }
  catch { throw new Error('UNKNOWN_DESTINATION'); }
  if (localKey.nodeId!==dest) throw new Error('UNKNOWN_DESTINATION');
  const existing=await deps.store.getInbound(dest,e.crossing_id);
  if (existing?.state==='RESOLVED') return existingResponse(deps.store,dest,existing);
  const now=(deps.now??(()=>new Date()))();
  if (!existing) assertFreshTimestamp(e.created_at,now);
  const keys=await keyMaterial(localKey,dest);
  const ref=e.payload_refs[0] as any;
  let holdReceipt:ReceiptV0;
  if (existing) {
    holdReceipt=await deps.store.getReceipt(dest,existing.holdReceiptId);
    if (!holdReceipt) throw new Error('MISSING_DURABLE_HOLD');
  } else {
    holdReceipt=await sealReceipt(receiptDraft(e,dest,'MX13_HOLD','none',e.crossing_id,`mx13:hold:${e.crossing_id}`,[],
      'RECEIVE -> HOLD; destination disposition is null',now.toISOString(),{stage:'HOLD',destination_disposition:null,mandatory_hold:true,authority:'none'}),keys);
    const accepted=await deps.store.beginHold(dest,{crossingId:e.crossing_id,sourceNodeId:source,envelope:e,
      payload:{address,bytes,byteLength:bytes.length,observedName:ref.observed_name??'unnamed',detectedMediaType:ref.media_type??'application/octet-stream'},holdReceipt});
    if (!accepted.created) {
      holdReceipt=await deps.store.getReceipt(dest,accepted.inbound.holdReceiptId);
      if (!holdReceipt) throw new Error('MISSING_DURABLE_HOLD');
      if (accepted.inbound.state==='RESOLVED')return existingResponse(deps.store,dest,accepted.inbound);
    }
  }

  if(e.declared_kind==='SINEW_PROPOSED_EDGE'){
    return {crossing_id:e.crossing_id,hold_receipt:holdReceipt,state:'HOLD',replayed:!!existing};
  }
  const result=(deps.evaluate??evaluateConstitution)({
    nodeId:dest,envelope:e,payloadAddress:address,observedFilename:ref.observed_name??'unnamed',
    detectedMediaType:ref.media_type??'application/octet-stream',priorReceiptIds:e.parents.filter((x:any)=>typeof x==='string'),
    routeIndex:Number((e.extensions as any)?.mx13?.route_index??0),
  });
  const descendantRefs:string[]=[];
  for (const child of result.descendantSpecs) descendantRefs.push(`mx13:descendant:${await sha256Address(new TextEncoder().encode(JSON.stringify(child)))}`);
  const dispositionReceipt=await sealReceipt(receiptDraft(e,dest,`MX13_${result.disposition}`,result.semanticEffect,holdReceipt.receipt_id,
    result.disposition==='ADMIT'?`mx13:constituted:${e.crossing_id}`:null,descendantRefs,result.notes.join('; '),now.toISOString(),
    {stage:'LOCAL_DISPOSITION',disposition:result.disposition,law:nodeDefinition(dest).law,
      route_forward_allowed:result.routeForwardAllowed,authority:'destination-local-only',descendant_specs:result.descendantSpecs}),keys);
  const events:Array<{class:string;body:Record<string,unknown>}>=result.descendantSpecs.map((child,index)=>({class:'descendant-spec',body:{child_ref:descendantRefs[index],spec:child}}));
  events.push({class:'local-disposition',body:{disposition:result.disposition,semantic_effect:result.semanticEffect}});
  const ancestry=[{child_ref:dispositionReceipt.receipt_id,parent_ref:holdReceipt.receipt_id,relation:'resolves-hold'},
    ...result.descendantSpecs.flatMap((child,index)=>child.parent_refs.map(parent_ref=>({child_ref:descendantRefs[index],parent_ref,relation:'derived-from'})))];
  try { await deps.store.persistDisposition(dest,e.crossing_id,dispositionReceipt,events,ancestry); }
  catch(error){
    if ((error as Error).message==='TERMINAL_DISPOSITION_IMMUTABLE'){
      const latest=await deps.store.getInbound(dest,e.crossing_id);
      if(latest?.state==='RESOLVED')return existingResponse(deps.store,dest,latest);
    }
    throw error;
  }
  return {crossing_id:e.crossing_id,hold_receipt:holdReceipt,disposition_receipt:dispositionReceipt,state:'RESOLVED',replayed:false};
}
