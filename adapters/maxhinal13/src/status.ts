import {nodeDefinition,isNodeId} from './nodes.ts';
import type { MeshStore, HostStatusV0 } from './store.ts';

/** Read-only projection; no payload or credential fields are returned. */
export async function readHostStatus(store:MeshStore):Promise<HostStatusV0> {
  const state=await store.readStatus();
  return {
    hostId:state.hostId,
    localNodeIds:[...state.localNodeIds],
    publicFingerprints:{...state.publicFingerprints},
    pendingOutboxCount:state.pendingOutboxCount,
    unresolvedHoldCount:state.unresolvedHoldCount,
    recentReceiptIds:[...state.recentReceiptIds],
    failedTransportCount:state.failedTransportCount,
    latestDurableCrossingTimestamps:{...state.latestDurableCrossingTimestamps},
    forbiddenBypassObserved:state.forbiddenBypassObserved,
  };
}

/** The operator never echoes arbitrary host reply fields. Invalid views become UNKNOWN. */
export function sanitizePublicStatus(input:unknown,host:'WITNESS'|'pantry-gate'):HostStatusV0 {
 const s=input as HostStatusV0;
 const count=(value:unknown)=>{if(!Number.isSafeInteger(value)||Number(value)<0)throw Error('INVALID_PUBLIC_STATUS');return Number(value);};
 if(!s||s.hostId!==host||!Array.isArray(s.localNodeIds)||s.localNodeIds.some(id=>!isNodeId(id)||nodeDefinition(id).host!==host))throw Error('INVALID_PUBLIC_STATUS');
 const publicFingerprints:Record<string,string>={}, latestDurableCrossingTimestamps:Record<string,string|null>={};
 for(const id of s.localNodeIds){
  const fp=s.publicFingerprints?.[id];if(fp!==undefined){if(!/^sha256:[a-f0-9]{64}$/.test(fp))throw Error('INVALID_PUBLIC_STATUS');publicFingerprints[id]=fp;}
  const time=s.latestDurableCrossingTimestamps?.[id];
  if(time!==undefined&&time!==null&&!Number.isFinite(Date.parse(time)))throw Error('INVALID_PUBLIC_STATUS');
  latestDurableCrossingTimestamps[id]=time??null;
 }
 if(!Array.isArray(s.recentReceiptIds)||s.recentReceiptIds.length>20||s.recentReceiptIds.some(id=>!/^relatte-receipt-v0:[a-f0-9]{64}$/.test(id)))throw Error('INVALID_PUBLIC_STATUS');
 return {hostId:host,localNodeIds:s.localNodeIds,publicFingerprints,pendingOutboxCount:count(s.pendingOutboxCount),
  unresolvedHoldCount:count(s.unresolvedHoldCount),recentReceiptIds:s.recentReceiptIds,failedTransportCount:count(s.failedTransportCount),
  latestDurableCrossingTimestamps,forbiddenBypassObserved:s.forbiddenBypassObserved===true};
}
