/** Typed proposed relations. Destination decisions are explicit and remain local. */
import {Buffer} from 'node:buffer';
import type {NodeId,ReceiptV0} from './model.ts';
import type {MeshStore} from './store.ts';
import {isNodeId} from './nodes.ts';
import {canonicalize,sealCrossingEnvelope,sealReceipt,verifyReceipt,publicKeyFingerprint} from './relatte_v0.ts';
import {sha256Address} from './payload.ts';
import {keyMaterial} from './worker.ts';
import {evaluateConstitution} from './constitutions.ts';

export interface ProposedEdge {
 schema:'maxhinal13.proposed-edge/v0';edge_id:string;source_node:NodeId;destination_node:NodeId;
 reason:string;scope:'bounded-relation-evidence';payload_kind:'attributable-relation';parent_ref:string|null;
 proposer_identity:NodeId;created_at:string;
}
export type EdgeDecision='ACCEPT'|'REFUSE'|'HOLD';
const FIELDS=['schema','edge_id','source_node','destination_node','reason','scope','payload_kind','parent_ref','proposer_identity','created_at'].sort();
async function identity(edge:Omit<ProposedEdge,'edge_id'>){return 'sinew-edge-v0:'+(await sha256Address(new TextEncoder().encode(canonicalize(edge)))).split(':')[1];}
export async function edge(fields:Omit<ProposedEdge,'schema'|'edge_id'|'scope'|'payload_kind'|'proposer_identity'|'created_at'>,now=new Date()):Promise<ProposedEdge>{
 const body={...fields,schema:'maxhinal13.proposed-edge/v0' as const,scope:'bounded-relation-evidence' as const,
   payload_kind:'attributable-relation' as const,proposer_identity:fields.source_node,created_at:now.toISOString()};
 const value={...body,edge_id:await identity(body)};
 return validateEdge(new TextEncoder().encode(JSON.stringify(value)),fields.source_node,fields.destination_node);
}
export async function validateEdge(bytes:Uint8Array,source:NodeId,destination:NodeId):Promise<ProposedEdge>{
 if(bytes.length>8192)throw Error('RELATION_TOO_LARGE');
 let p:ProposedEdge;try{p=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('INVALID_RELATION');}
 if(!p||Object.keys(p).sort().join('|')!==FIELDS.join('|')||p.schema!=='maxhinal13.proposed-edge/v0'||
   !isNodeId(source)||!isNodeId(destination)||p.source_node!==source||p.destination_node!==destination||p.proposer_identity!==source||
   p.scope!=='bounded-relation-evidence'||p.payload_kind!=='attributable-relation'||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>1024||
   (p.parent_ref!==null&&!/^relatte-receipt-v0:[a-f0-9]{64}$/.test(p.parent_ref))||typeof p.created_at!=='string'||!Number.isFinite(Date.parse(p.created_at))||new Date(p.created_at).toISOString()!==p.created_at)throw Error('INVALID_RELATION_OR_AUTHORITY');
 const {edge_id,...body}=p;if(edge_id!==await identity(body))throw Error('RELATION_ID_MISMATCH');return p;
}
export async function proposeEdge(store:MeshStore,p:ProposedEdge){
 const bytes=new TextEncoder().encode(JSON.stringify(p));await validateEdge(bytes,p.source_node,p.destination_node);
 const local=await store.loadNodeKey(p.source_node);
 const prior=p.parent_ref?await store.getReceipt(p.source_node,p.parent_ref):null;
 if(p.parent_ref&&(!prior||prior.extensions.mx13?.stage!=='LOCAL_DISPOSITION'||prior.kind!==`MX13_${prior.extensions.mx13?.disposition}`||prior.world_id!==p.source_node||!(await verifyReceipt(prior))||publicKeyFingerprint(prior.signing.public_key)!==local.fingerprint))throw Error('RELATION_PARENT_NOT_IN_LOCAL_CUSTODY');
 const address=await sha256Address(bytes),keys=await keyMaterial(local,p.source_node);
 const signed=await sealCrossingEnvelope({schema:'relatte.crossing-envelope/v0',protocol_version:'0',source_particular:address,source_world:p.source_node,
  source_history_head:p.parent_ref,parents:p.parent_ref?[p.parent_ref]:[],declared_kind:'SINEW_PROPOSED_EDGE',
  payload_refs:[{address,byte_length:bytes.length,role:'particular',media_type:'application/json',observed_name:'proposed-edge.json'}],
  requested_effect:{destination_disposition:'local'},capability_ref:null,privacy_policy:null,audience_policy:{destination:p.destination_node},
  return_address:p.source_node,created_at:p.created_at,extensions:{sinew:{edge_id:p.edge_id,proposal_is_not_acceptance:true,parent_receipt:prior}}},keys);
 await store.putPayload(p.source_node,{address,bytes,byteLength:bytes.length,observedName:'proposed-edge.json',detectedMediaType:'application/json'});
 return store.enqueueOutbox(p.source_node,{crossingId:signed.crossing_id,destinationNodeId:p.destination_node,envelope:signed,payloadAddress:address});
}
export async function decideEdge(store:MeshStore,dest:NodeId,crossing:string,decision:EdgeDecision,actor:string):Promise<ReceiptV0>{
 if(!['ACCEPT','REFUSE','HOLD'].includes(decision)||typeof actor!=='string'||!actor.trim()||actor.length>256)throw Error('EXPLICIT_DESTINATION_EDGE_DECISION_REQUIRED');
 const inbound=await store.getInbound(dest,crossing);
 if(!inbound||inbound.envelope.declared_kind!=='SINEW_PROPOSED_EDGE')throw Error('RELATION_NOT_OBSERVED');
 const material=await store.getPayload(dest,inbound.envelope.source_particular);if(!material)throw Error('RELATION_PAYLOAD_UNOBSERVED');
 const p=await validateEdge(material.bytes,inbound.sourceNodeId,dest);
 if(inbound.state==='RESOLVED'){
  const current=await store.getReceipt(dest,inbound.dispositionReceiptId!);
  if(current?.extensions.sinew?.decision!==decision)throw Error('TERMINAL_DISPOSITION_IMMUTABLE');return current;
 }
 const hold=await store.getReceipt(dest,inbound.holdReceiptId);if(!hold)throw Error('MISSING_DURABLE_HOLD');
 const local=await store.loadNodeKey(dest), keys=await keyMaterial(local,dest);
 const native=evaluateConstitution({nodeId:dest,envelope:inbound.envelope,payloadAddress:material.address,observedFilename:material.observedName,
  detectedMediaType:material.detectedMediaType,priorReceiptIds:p.parent_ref?[p.parent_ref]:[],routeIndex:0});
 if(decision==='ACCEPT'&&['REFUSE','RETURN','HOLD','EXPIRE'].includes(native.disposition))throw Error('RELATION_CANNOT_BYPASS_DESTINATION_POLICY');
 const disposition=decision==='ACCEPT'?native.disposition:decision==='REFUSE'?'REFUSE':'HOLD';
 const receipt=await sealReceipt({schema:'relatte.receipt/v0',crossing_id:crossing,world_id:dest,receiver_particular:material.address,
   kind:decision==='HOLD'?'MX13_EDGE_HOLD':`MX13_${disposition}`,semantic_effect:decision==='HOLD'?'none':'destination-local-relation-only',
   contract_ref:'SINEW-001',pre_state_ref:hold.receipt_id,post_state_ref:null,descendant_refs:[],residual_refs:[material.address],
   note:'explicit destination operator decision; actor declaration is not identity authentication',created_at:new Date().toISOString(),
   extensions:{mx13:{stage:decision==='HOLD'?'RELATION_DISPOSITION':'LOCAL_DISPOSITION',disposition,route_forward_allowed:native.routeForwardAllowed},
     sinew:{edge_id:p.edge_id,decision,actor,scope:p.scope,authority:'destination-local-relation-only'}}},keys);
 if(publicKeyFingerprint(receipt.signing.public_key)!==local.fingerprint)throw Error('NODE_KEY_SCOPE_VIOLATION');
 if(decision==='HOLD')await store.recordObservation(dest,crossing,receipt,'edge-disposition');
 else await store.persistDisposition(dest,crossing,receipt,[{class:'edge-disposition',body:{receipt_id:receipt.receipt_id,edge_id:p.edge_id,decision}}],
   [{child_ref:receipt.receipt_id,parent_ref:hold.receipt_id,relation:'destination-local-edge-decision'}]);
 return receipt;
}
export async function backpressure(store:MeshStore,node:NodeId,now=new Date()){
 const s=await store.readNodeStatus(node);
 return {...s,pending_age_ms:s.oldest_pending_at?Math.max(0,now.getTime()-Date.parse(s.oldest_pending_at)):null,
  next_safe_action:s.held_count?'inspect HOLD; explicit destination decision':s.outbox_pending_count?'inspect attempts; explicit bounded retry':'no pending action observed',
  authority:'observational-only',automatic_admission:false};
}
