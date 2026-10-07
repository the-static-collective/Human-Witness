import {edge,proposeEdge,decideEdge,type EdgeDecision} from './sinew.ts';
import type {MeshStore} from './store.ts';
import type {NodeId} from './model.ts';
import {nodeDefinition,isNodeId} from './nodes.ts';
import {decodePayloadB64} from './payload.ts';
import {seedMx13001} from './seed.ts';
import {ROUTE,enqueueForward,pumpOne} from './worker.ts';
import {verifyReceipt,publicKeyFingerprint} from './relatte_v0.ts';

type Host='WITNESS'|'pantry-gate';
export interface WorkerCommand { schema:'maxhinal13.worker/v0'; action:'seed'|'pump'|'advance'|'trace'|'probe-return'|'edge-propose'|'edge-disposition';
  payload_b64?:string;source_node_id?:NodeId;next_node_id?:NodeId;inbound_crossing_id?:string;edge?:{reason:string;parent_ref:string|null};decision?:EdgeDecision;actor?:string }

/** Host-scoped operator actions. Credentials are checked by the Edge wrapper. */
export async function runWorkerCommand(store:MeshStore,host:Host,command:WorkerCommand,fetcher:typeof fetch):Promise<Record<string,unknown>>{
  if(command?.schema!=='maxhinal13.worker/v0')throw new Error('INVALID_WORKER_SCHEMA');
  if(command.action==='seed'){
    if(host!=='WITNESS')throw new Error('SOURCE_NODE_NOT_ON_HOST');
    if(typeof command.payload_b64!=='string')throw new Error('INVALID_SEED_PAYLOAD');
    const queued=await seedMx13001(store,decodePayloadB64(command.payload_b64));
    return {schema:'maxhinal13.worker-result/v0',action:'seed',crossing_id:queued.crossingId,
      destination_node_id:queued.destinationNodeId,outbox_state:queued.state,admission:'not_attempted'};
  }
  const source=command.source_node_id;
  if(!isNodeId(source)||nodeDefinition(source).host!==host)throw new Error('SOURCE_NODE_NOT_ON_HOST');
  if(command.action==='edge-propose'){
    if(!isNodeId(command.next_node_id)||!command.edge)throw Error('INVALID_RELATION');
    const proposed=await edge({source_node:source,destination_node:command.next_node_id,reason:command.edge.reason,parent_ref:command.edge.parent_ref});
    const queued=await proposeEdge(store,proposed);return {schema:'maxhinal13.edge-proposal-result/v0',edge:proposed,crossing_id:queued.crossingId};
  }
  if(command.action==='edge-disposition'){
    const receipt=await decideEdge(store,source,command.inbound_crossing_id!,command.decision!,command.actor!);return {schema:'maxhinal13.edge-decision-result/v0',receipt};
  }
  if(command.action==='trace'){
    if(!/^relatte-crossing-v0:[0-9a-f]{64}$/.test(command.inbound_crossing_id??''))throw Error('INVALID_INBOUND_CROSSING_ID');
    return {schema:'maxhinal13.transport-trace/v0',...await store.readTrace(source,command.inbound_crossing_id!)};
  }
  if(command.action==='pump'){
    const outcome=await pumpOne(source,{store,fetch:fetcher});
    return {schema:'maxhinal13.worker-result/v0',action:'pump',source_node_id:source,
      crossing_id:outcome.crossingId,ok:outcome.ok,error:outcome.error??null,
      destination_node_id:outcome.destinationNodeId??null};
  }
  if(command.action!=='advance'&&command.action!=='probe-return')throw new Error('UNKNOWN_WORKER_ACTION');
  const index=ROUTE.indexOf(source);
  const roundTrip=command.action==='probe-return';
  if(roundTrip ? (source!==ROUTE[1]||command.next_node_id!==ROUTE[0]) : (index<0||index===ROUTE.length-1||command.next_node_id!==ROUTE[index+1]))
    throw new Error('ROUTE_NEXT_NODE_MISMATCH');
  if(!/^relatte-crossing-v0:[0-9a-f]{64}$/.test(command.inbound_crossing_id??''))
    throw new Error('INVALID_INBOUND_CROSSING_ID');
  const inbound=await store.getInbound(source,command.inbound_crossing_id!);
  if(!inbound||inbound.state!=='RESOLVED'||!inbound.dispositionReceiptId)throw new Error('INBOUND_NOT_RESOLVED');
  const routeMetadata=inbound.envelope.extensions.mx13 as {route_index?:unknown}|undefined;
  if(routeMetadata?.route_index!==index)throw new Error('ROUTE_INDEX_MISMATCH');
  const receipt=await store.getReceipt(source,inbound.dispositionReceiptId);
  if(!receipt||!(await verifyReceipt(receipt)))throw new Error('INVALID_LOCAL_RECEIPT');
  const storedKey=await store.loadNodeKey(source);
  if(publicKeyFingerprint(receipt.signing.public_key)!==storedKey.fingerprint)throw new Error('LOCAL_RECEIPT_KEY_MISMATCH');
  const queued=await enqueueForward(source,command.next_node_id!,inbound.dispositionReceiptId,roundTrip?0:index+1,store);
  return {schema:'maxhinal13.worker-result/v0',action:command.action,source_node_id:source,
    destination_node_id:queued.destinationNodeId,crossing_id:queued.crossingId,outbox_state:queued.state,
    parent_receipt_id:inbound.dispositionReceiptId};
}
