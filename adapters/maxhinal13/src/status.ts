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
