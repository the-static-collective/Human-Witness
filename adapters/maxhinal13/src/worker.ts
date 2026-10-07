import { Buffer } from 'node:buffer';
import type { NodeId, CrossingEnvelopeV0, P256KeyMaterial } from './model.ts';
import type { MeshStore, PayloadRecord, StoredNodeKey } from './store.ts';
import { publicKeyFingerprint, sealCrossingEnvelope, verifyReceipt, verifyCrossingEnvelope } from './relatte_v0.ts';
import { nodeDefinition } from './nodes.ts';
import {PINNED_PROJECT_REFS} from './peers.ts';

export const ROUTE:readonly NodeId[]=[
  'mx13:01-witness','mx13:02-gate','mx13:03-dead-letter','mx13:04-compost-monk',
  'mx13:05-mirrorgoat','mx13:06-contrary','mx13:07-lantern-eater','mx13:08-pirate-clerk',
  'mx13:09-choir-of-one','mx13:10-bone-orchard','mx13:11-oracl','mx13:12-ferryman',
  'mx13:13-misspeldd-maxhinal',
];
export interface WorkerDeps {store:MeshStore;fetch:typeof fetch;now?:()=>Date}
export interface WorkerResult {ok:boolean;crossingId:string;error?:string;destinationNodeId?:NodeId}

export async function keyMaterial(record:StoredNodeKey,expectedNode?:NodeId):Promise<P256KeyMaterial>{
  if((expectedNode&&record.nodeId!==expectedNode)||publicKeyFingerprint(record.publicJwk)!==record.fingerprint||record.privateJwk?.x!==record.publicJwk.x||record.privateJwk?.y!==record.publicJwk.y)throw Error('NODE_KEY_SCOPE_VIOLATION');
  if(!record.privateJwk?.d)throw new Error('NODE_PRIVATE_KEY_MISSING');
  const privateKey=await crypto.subtle.importKey('jwk',record.privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const publicKey=await crypto.subtle.importKey('jwk',record.publicJwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  return {privateKey,publicKey,publicKeyJwk:record.publicJwk};
}
export async function createNextCrossing(
  source:NodeId,dest:NodeId,payload:PayloadRecord,parentReceiptIds:string[],routeIndex:number,
  keys:P256KeyMaterial,priorDisposition:string,
):Promise<CrossingEnvelopeV0>{
  if(!Number.isSafeInteger(routeIndex)||routeIndex<0||routeIndex>13)throw new Error('INVALID_ROUTE_INDEX');
  if(parentReceiptIds.length===0 || parentReceiptIds.some(id=>!/^relatte-receipt-v0:[0-9a-f]{64}$/.test(id)))throw new Error('PARENT_RECEIPT_REQUIRED');
  if(!['ADMIT','REFUSE','RETURN','FORWARD'].includes(priorDisposition))throw new Error('FORWARD_REQUIRES_TERMINAL_RECEIPT');
  nodeDefinition(source);nodeDefinition(dest);
  return sealCrossingEnvelope({
    schema:'relatte.crossing-envelope/v0',protocol_version:'0',source_particular:payload.address,source_world:source,
    source_history_head:parentReceiptIds.at(-1)!,parents:[...parentReceiptIds],declared_kind:'MX13_EXACT_PARTICULAR',
    payload_refs:[{address:payload.address,byte_length:payload.byteLength,role:'particular',
      media_type:payload.detectedMediaType,observed_name:payload.observedName}],
    requested_effect:{destination_disposition:'local'},capability_ref:null,
    privacy_policy:{field:'bounded',retention:'decay-after-export'},audience_policy:{destination:dest},return_address:source,
    created_at:new Date().toISOString(),extensions:{mx13:{route_index:routeIndex,route_forward_after_local_disposition:priorDisposition,
      claim_limit:'signed onward transport; no automatic admission'}},
  },keys);
}
export async function enqueueForward(source:NodeId,dest:NodeId,localReceiptId:string,routeIndex:number,store:MeshStore){
  if(!localReceiptId)throw new Error('PARENT_RECEIPT_REQUIRED');
  const local=await store.getReceipt(source,localReceiptId);
  if(!local ||local.world_id!==source||local.kind!=='MX13_'+local.extensions?.mx13?.disposition||
     local.extensions?.mx13?.stage!=='LOCAL_DISPOSITION'||local.extensions?.mx13?.route_forward_allowed!==true)
     throw new Error('FORWARD_NOT_AUTHORIZED_BY_LOCAL_RECEIPT');
  const payloadAddress=local.residual_refs?.find((v:any)=>typeof v==='string'&&v.startsWith('sha256:'));
  const payload=payloadAddress?await store.getPayload(source,payloadAddress):null;
  if(!payload)throw new Error('SOURCE_PAYLOAD_NOT_IN_CUSTODY');
  const record=await store.loadNodeKey(source);
  if(!(await verifyReceipt(local))||publicKeyFingerprint(local.signing.public_key)!==record.fingerprint)throw Error('LOCAL_RECEIPT_KEY_OR_SIGNATURE_MISMATCH');
  const key=await keyMaterial(record,source);
  const crossing=await createNextCrossing(source,dest,payload,[localReceiptId],routeIndex,key,local.extensions.mx13.disposition);
  return store.enqueueOutbox(source,{crossingId:crossing.crossing_id,destinationNodeId:dest,envelope:crossing,payloadAddress});
}
function assertPeerReceipt(peerFingerprint:string,receipt:any,dest:NodeId,crossingId:string,kind:'HOLD'|'DISPOSITION',holdId?:string){
  if(receipt?.world_id!==dest ||receipt.crossing_id!==crossingId)throw new Error('INVALID_REMOTE_RECEIPT');
  if(publicKeyFingerprint(receipt.signing?.public_key)!==peerFingerprint)throw new Error('REMOTE_KEY_MISMATCH');
  if(kind==='HOLD'){
    if(receipt.kind!=='MX13_HOLD'||receipt.semantic_effect!=='none'||receipt.extensions?.mx13?.mandatory_hold!==true||
       receipt.extensions?.mx13?.destination_disposition!==null)throw new Error('INVALID_REMOTE_HOLD');
  }else{
    const disposition=receipt.extensions?.mx13?.disposition;
    if(!['ADMIT','REFUSE','RETURN','FORWARD','HOLD','EXPIRE'].includes(disposition)||receipt.kind!==`MX13_${disposition}`||
      (disposition==='ADMIT'&&['mx13:01-witness','mx13:11-oracl','mx13:12-ferryman'].includes(dest))||receipt.pre_state_ref!==holdId ||receipt.extensions?.mx13?.stage!=='LOCAL_DISPOSITION')throw new Error('INVALID_REMOTE_DISPOSITION');
  }
}
export async function pumpOne(source:NodeId,deps:WorkerDeps):Promise<WorkerResult>{
  const work=await deps.store.claimOutbox(source);
  if(!work)return {ok:false,crossingId:'',error:'OUTBOX_EMPTY'};
  if(work.state!=='PENDING')return {ok:false,crossingId:work.crossingId,error:'OUTBOX_NOT_PENDING'};
  try{
    const local=await deps.store.loadNodeKey(source);
    if(work.envelope.source_world!==source||work.envelope.audience_policy?.destination!==work.destinationNodeId||work.envelope.crossing_id!==work.crossingId||
      publicKeyFingerprint(work.envelope.signing.public_key)!==local.fingerprint||!(await verifyCrossingEnvelope(work.envelope)))throw Error('OUTBOX_SOURCE_SIGNATURE_OR_SCOPE');
    const dest=work.destinationNodeId;
    const peer=await deps.store.loadPeer(dest);
    if(!peer?.active)throw new Error('UNKNOWN_DESTINATION');
    const expectedHost=nodeDefinition(dest).host;
    const pinnedUrl=`https://${PINNED_PROJECT_REFS[expectedHost]}.supabase.co/functions/v1/mx13-ingress`;
    if(peer.hostId!==expectedHost || peer.ingressUrl!==pinnedUrl)throw new Error('UNTRUSTED_PEER_ENDPOINT');
    const payload=await deps.store.getPayload(source,work.payloadAddress);
    if(!payload)throw new Error('SOURCE_PAYLOAD_NOT_IN_CUSTODY');
    const endpoint=peer.ingressUrl;
    const body={schema:'maxhinal13.ingress/v0',destination_node_id:dest,envelope:work.envelope,
      payload_b64:Buffer.from(payload.bytes).toString('base64')};
    const response=await deps.fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('REMOTE_HTTP_'+response.status);
    const r:any=await response.json();
    if(r.hold_receipt?.receiver_particular!==work.payloadAddress ||
       (r.disposition_receipt && r.disposition_receipt.receiver_particular!==work.payloadAddress))
       throw new Error('REMOTE_SOURCE_MISMATCH');
    if(r.crossing_id!==work.crossingId||!r.hold_receipt)throw new Error('INVALID_REMOTE_RECEIPT');
    assertPeerReceipt(peer.fingerprint,r.hold_receipt,dest,work.crossingId,'HOLD');
    if(!(await verifyReceipt(r.hold_receipt)))throw new Error('INVALID_REMOTE_SIGNATURE');
    await deps.store.recordHeldAcknowledgement(source,work.crossingId,r.hold_receipt);
    if(r.state!=='RESOLVED'||!r.disposition_receipt)throw new Error('DESTINATION_REMAINS_HELD');
    assertPeerReceipt(peer.fingerprint,r.disposition_receipt,dest,work.crossingId,'DISPOSITION',r.hold_receipt.receipt_id);
    if(!(await verifyReceipt(r.disposition_receipt)))throw new Error('INVALID_REMOTE_SIGNATURE');
    await deps.store.recordAcknowledgement(source,work.crossingId,r.hold_receipt,r.disposition_receipt);
    await deps.store.recordAttempt(source,work.crossingId,{ok:true,at:(deps.now??(()=>new Date()))().toISOString()});
    await deps.store.completeOutbox(source,work.crossingId);
    return {ok:true,crossingId:work.crossingId,destinationNodeId:dest};
  }catch(error){
    const message=error instanceof Error?error.message:'';
    const code=/^[A-Z][A-Z0-9_]{2,80}$/.test(message)?message:'TRANSPORT_FAILED';
    await deps.store.recordAttempt(source,work.crossingId,{ok:false,error:code,at:(deps.now??(()=>new Date()))().toISOString()});
    return {ok:false,crossingId:work.crossingId,error:code};
  }
}
