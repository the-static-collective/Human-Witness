import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import type { NodeId, ReceiptV0, CrossingEnvelopeV0 } from './model.ts';
import { nodeSchema, nodeDefinition } from './nodes.ts';

export interface StoredNodeKey {
  nodeId: NodeId;
  keyVersion: number;
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
  fingerprint: string;
}
export interface PeerRecord {
  nodeId: NodeId;
  hostId: 'WITNESS' | 'pantry-gate';
  publicJwk: JsonWebKey;
  fingerprint: string;
  ingressUrl: string;
  active: boolean;
}
export interface PayloadRecord {
  address: string;
  bytes: Uint8Array;
  byteLength: number;
  observedName: string;
  detectedMediaType: string;
}
export interface BeginHoldInput {
  crossingId: string;
  sourceNodeId: NodeId;
  envelope: CrossingEnvelopeV0;
  payload: PayloadRecord;
  holdReceipt: any;
}
export interface InboundRecord {
  crossingId: string;
  sourceNodeId: NodeId;
  state: 'HOLD' | 'RESOLVED';
  holdReceiptId: string;
  dispositionReceiptId: string | null;
  envelope: CrossingEnvelopeV0;
}
export interface OutboxInput {
  crossingId: string;
  destinationNodeId: NodeId;
  envelope: CrossingEnvelopeV0;
  payloadAddress: string;
}
export interface AttemptRecord { ok: boolean; error?: string | null; at?: string; }
export interface OutboxRecord extends OutboxInput {
  state: 'PENDING' | 'COMPLETE';
  attempts: number;
  lastError: string | null;
  attemptHistory: AttemptRecord[];
}
export interface HostStatusV0 {
  hostId: string;
  localNodeIds: NodeId[];
  publicFingerprints: Record<string,string>;
  pendingOutboxCount: number;
  unresolvedHoldCount: number;
  recentReceiptIds: string[];
  failedTransportCount: number;
  latestDurableCrossingTimestamps: Record<string,string|null>;
  forbiddenBypassObserved: boolean;
}
export interface NodeStatus {
 node_id:NodeId; held_count:number; outbox_pending_count:number;
 oldest_pending_at:string|null; last_receipt_id:string|null;
}
export interface TransportTrace {
  node_id:NodeId; host_id:string; signed_crossing:CrossingEnvelopeV0;
  signed_hold:ReceiptV0|null; signed_disposition:ReceiptV0|null; attempts:AttemptRecord[]; relation_observations?:ReceiptV0[];
}
export interface MeshStore {
  loadNodeKey(nodeId: NodeId): Promise<StoredNodeKey>;
  loadPeer(nodeId: NodeId): Promise<PeerRecord | null>;
  putPayload(nodeId: NodeId, payload: PayloadRecord): Promise<void>;
  getPayload(nodeId: NodeId, address: string): Promise<PayloadRecord | null>;
  beginHold(nodeId: NodeId, input: BeginHoldInput): Promise<{created:boolean; inbound:InboundRecord}>;
  getInbound(nodeId: NodeId, crossingId: string): Promise<InboundRecord | null>;
  getReceipt(nodeId: NodeId, receiptId: string): Promise<any | null>;
  persistDisposition(nodeId: NodeId, crossingId: string, receipt: any, events: any[], ancestry: any[]): Promise<InboundRecord>;
  enqueueOutbox(nodeId: NodeId, input: OutboxInput): Promise<OutboxRecord>;
  claimOutbox(nodeId: NodeId, crossingId?: string): Promise<OutboxRecord | null>;
  recordAttempt(nodeId: NodeId, crossingId: string, attempt: AttemptRecord): Promise<OutboxRecord>;
  completeOutbox(nodeId: NodeId, crossingId: string): Promise<OutboxRecord>;
  readStatus(): Promise<HostStatusV0>;
  readNodeStatus(node:NodeId):Promise<NodeStatus>;
  recordObservation(node:NodeId,crossing:string,receipt:ReceiptV0,kind:string):Promise<void>;
  recordHeldAcknowledgement(node:NodeId,crossing:string,hold:ReceiptV0):Promise<void>;
  recordAcknowledgement(nodeId:NodeId,crossingId:string,hold:ReceiptV0,disposition:ReceiptV0):Promise<void>;
  readTrace(nodeId:NodeId,crossingId:string):Promise<TransportTrace>;
}

function bytesEqual(a: Uint8Array,b: Uint8Array): boolean {
  return a.length===b.length && a.every((v,i)=>v===b[i]);
}
function payloadKey(nodeId:NodeId,address:string){return `${nodeId}\u0000${address}`;}
function crossingKey(nodeId:NodeId,id:string){return `${nodeId}\u0000${id}`;}

export class FakeMeshStore implements MeshStore {
  keys=new Map<NodeId,StoredNodeKey>();
  peers=new Map<NodeId,PeerRecord>();
  payloads=new Map<string,PayloadRecord>();
  inbound=new Map<string,InboundRecord>();
  receipts=new Map<string,any>();
  outbox=new Map<string,OutboxRecord>();
  heldAcknowledgements=new Map<string,ReceiptV0>();
  observations:Array<{node:NodeId;crossing:string;receipt:ReceiptV0;kind:string}>=[];
  acknowledgements=new Map<string,{hold:ReceiptV0;disposition:ReceiptV0}>();
  events:any[]=[];
  ancestry:any[]=[];
  hostId='FAKE';
  localNodeIds:NodeId[]=[];

  async loadNodeKey(nodeId:NodeId){const v=this.keys.get(nodeId);if(!v)throw new Error('NODE_KEY_NOT_FOUND');return structuredClone(v);}
  async loadPeer(nodeId:NodeId){const v=this.peers.get(nodeId);return v?structuredClone(v):null;}
  async putPayload(nodeId:NodeId,payload:PayloadRecord){
    const key=payloadKey(nodeId,payload.address); const existing=this.payloads.get(key);
    if(existing && !bytesEqual(existing.bytes,payload.bytes)) throw new Error('PAYLOAD_ADDRESS_COLLISION');
    if(!existing)this.payloads.set(key,{...payload,bytes:new Uint8Array(payload.bytes)});
  }
  async getPayload(nodeId:NodeId,address:string){const v=this.payloads.get(payloadKey(nodeId,address));return v?{...v,bytes:new Uint8Array(v.bytes)}:null;}
  async beginHold(nodeId:NodeId,input:BeginHoldInput){
    const key=crossingKey(nodeId,input.crossingId); const existing=this.inbound.get(key);
    if(existing)return {created:false,inbound:structuredClone(existing)};
    await this.putPayload(nodeId,input.payload);
    const rec:InboundRecord={crossingId:input.crossingId,sourceNodeId:input.sourceNodeId,state:'HOLD',holdReceiptId:input.holdReceipt.receipt_id,dispositionReceiptId:null,envelope:structuredClone(input.envelope)};
    this.receipts.set(input.holdReceipt.receipt_id,structuredClone(input.holdReceipt)); this.inbound.set(key,rec);
    return {created:true,inbound:structuredClone(rec)};
  }
  async getInbound(nodeId:NodeId,crossingId:string){const v=this.inbound.get(crossingKey(nodeId,crossingId));return v?structuredClone(v):null;}
  async getReceipt(_nodeId:NodeId,receiptId:string){const v=this.receipts.get(receiptId);return v?structuredClone(v):null;}
  async persistDisposition(nodeId:NodeId,crossingId:string,receipt:any,events:any[],ancestry:any[]){
    const key=crossingKey(nodeId,crossingId); const rec=this.inbound.get(key); if(!rec)throw new Error('INBOUND_NOT_FOUND');
    if(rec.state==='RESOLVED')throw new Error('TERMINAL_DISPOSITION_IMMUTABLE');
    this.receipts.set(receipt.receipt_id,structuredClone(receipt)); this.events.push(...structuredClone(events)); this.ancestry.push(...structuredClone(ancestry));
    rec.state='RESOLVED'; rec.dispositionReceiptId=receipt.receipt_id; this.inbound.set(key,rec); return structuredClone(rec);
  }
  async enqueueOutbox(nodeId:NodeId,input:OutboxInput){
    const key=crossingKey(nodeId,input.crossingId); const existing=this.outbox.get(key); if(existing)return structuredClone(existing);
    const rec:OutboxRecord={...structuredClone(input),state:'PENDING',attempts:0,lastError:null,attemptHistory:[]}; this.outbox.set(key,rec); return structuredClone(rec);
  }
  async claimOutbox(nodeId:NodeId,crossingId?:string){
    if(crossingId){const v=this.outbox.get(crossingKey(nodeId,crossingId));return v?structuredClone(v):null;}
    for(const [key,v] of this.outbox)if(key.startsWith(`${nodeId}\u0000`)&&v.state==='PENDING')return structuredClone(v); return null;
  }
  async recordAttempt(nodeId:NodeId,crossingId:string,attempt:AttemptRecord){
    const key=crossingKey(nodeId,crossingId); const rec=this.outbox.get(key); if(!rec)throw new Error('OUTBOX_NOT_FOUND');
    rec.attempts++; rec.lastError=attempt.ok?null:(attempt.error??'transport failure'); rec.attemptHistory.push({...attempt,at:attempt.at??new Date().toISOString()}); return structuredClone(rec);
  }
  async completeOutbox(nodeId:NodeId,crossingId:string){const key=crossingKey(nodeId,crossingId);const rec=this.outbox.get(key);if(!rec)throw new Error('OUTBOX_NOT_FOUND');rec.state='COMPLETE';rec.lastError=null;return structuredClone(rec);}
  async recordObservation(node:NodeId,crossing:string,receipt:ReceiptV0,kind:string){
    this.receipts.set(receipt.receipt_id,structuredClone(receipt));
    if(!this.observations.some(o=>o.receipt.receipt_id===receipt.receipt_id))this.observations.push({node,crossing,receipt:structuredClone(receipt),kind});
  }
  async recordHeldAcknowledgement(node:NodeId,crossing:string,hold:ReceiptV0){const prior=this.heldAcknowledgements.get(crossingKey(node,crossing));if(prior&&prior.receipt_id!==hold.receipt_id)throw Error('ACKNOWLEDGEMENT_CONFLICT');this.heldAcknowledgements.set(crossingKey(node,crossing),structuredClone(hold));}
  async recordAcknowledgement(node:NodeId,crossing:string,hold:ReceiptV0,disposition:ReceiptV0){
    const id=crossingKey(node,crossing), prior=this.acknowledgements.get(id);
    if(prior && (prior.hold.receipt_id!==hold.receipt_id || prior.disposition.receipt_id!==disposition.receipt_id))throw Error('ACKNOWLEDGEMENT_CONFLICT');
    this.acknowledgements.set(id,structuredClone({hold,disposition}));
  }
  async readTrace(node:NodeId,crossing:string):Promise<TransportTrace>{
    const inbound=await this.getInbound(node,crossing), outbound=await this.claimOutbox(node,crossing);
    if(!inbound&&!outbound)throw Error('CROSSING_NOT_OBSERVED');
    const ack=this.acknowledgements.get(crossingKey(node,crossing));
    return {node_id:node,host_id:this.hostId,signed_crossing:(inbound?.envelope??outbound!.envelope),
      signed_hold:inbound?await this.getReceipt(node,inbound.holdReceiptId):ack?.hold??this.heldAcknowledgements.get(crossingKey(node,crossing))??null,
      signed_disposition:inbound?.dispositionReceiptId?await this.getReceipt(node,inbound.dispositionReceiptId):ack?.disposition??null,
      attempts:outbound?.attemptHistory??[],relation_observations:this.observations.filter(o=>o.node===node&&o.crossing===crossing).map(o=>structuredClone(o.receipt))};
  }
  async readNodeStatus(node:NodeId):Promise<NodeStatus>{
    const holds=[...this.inbound].filter(([id,r])=>id.startsWith(node+'\0')&&r.state==='HOLD');
    const pending=[...this.outbox].filter(([id,r])=>id.startsWith(node+'\0')&&r.state==='PENDING');
    const last=[...this.receipts.values()].filter(r=>r.world_id===node).at(-1);
    return {node_id:node,held_count:holds.length,outbox_pending_count:pending.length,oldest_pending_at:pending[0]?.[1].envelope.created_at??null,last_receipt_id:last?.receipt_id??null};
  }
  async readStatus():Promise<HostStatusV0>{
    const pending=[...this.outbox.values()].filter(x=>x.state==='PENDING'); const holds=[...this.inbound.values()].filter(x=>x.state==='HOLD');
    return {hostId:this.hostId,localNodeIds:[...this.localNodeIds],publicFingerprints:Object.fromEntries([...this.keys].map(([k,v])=>[k,v.fingerprint])),pendingOutboxCount:pending.length,unresolvedHoldCount:holds.length,recentReceiptIds:[...this.receipts.keys()].slice(-20),failedTransportCount:[...this.outbox.values()].reduce((n,x)=>n+x.attemptHistory.filter(a=>!a.ok).length,0),latestDurableCrossingTimestamps:{},forbiddenBypassObserved:false};
  }
}

export interface SqlClientLike {
  unsafe(query:string,params?:unknown[]):Promise<any[]>;
  begin?<T>(fn:(sql:SqlClientLike)=>Promise<T>):Promise<T>;
}

function schemaFor(nodeId:NodeId):string{return nodeSchema(nodeId);}
function toBytes(v:any):Uint8Array{return v instanceof Uint8Array?new Uint8Array(v):new Uint8Array(Buffer.from(v));}

export class PostgresMeshStore implements MeshStore {
  private sql: SqlClientLike;
  private hostId: 'WITNESS'|'pantry-gate';
  private localNodeIds: NodeId[];
  constructor(sql:SqlClientLike, hostId:'WITNESS'|'pantry-gate', localNodeIds:NodeId[]) { this.sql=sql; this.hostId=hostId; this.localNodeIds=localNodeIds; }
  private schema(node:NodeId){
    if(!this.localNodeIds.includes(node)||nodeDefinition(node).host!==this.hostId)throw Error('NODE_KEY_SCOPE_VIOLATION');
    return schemaFor(node);
  }
  private async tx<T>(fn:(sql:SqlClientLike)=>Promise<T>):Promise<T>{return this.sql.begin?this.sql.begin(fn):fn(this.sql);}
  async loadNodeKey(nodeId:NodeId):Promise<StoredNodeKey>{
    this.schema(nodeId);
    const rows=await this.sql.unsafe('select node_id,key_version,public_jwk,private_jwk,fingerprint from mx13_host.node_keys where node_id=$1 and active=true',[nodeId]); const r=rows[0]; if(!r)throw new Error('NODE_KEY_NOT_FOUND');
    return {nodeId:r.node_id,keyVersion:r.key_version,publicJwk:r.public_jwk,privateJwk:r.private_jwk,fingerprint:r.fingerprint};
  }
  async loadPeer(nodeId:NodeId):Promise<PeerRecord|null>{
    const rows=await this.sql.unsafe('select node_id,host_id,public_jwk,fingerprint,ingress_url,active from mx13_host.peers where node_id=$1',[nodeId]); const r=rows[0]; if(!r)return null;
    return {nodeId:r.node_id,hostId:r.host_id,publicJwk:r.public_jwk,fingerprint:r.fingerprint,ingressUrl:r.ingress_url,active:r.active};
  }
  async putPayload(nodeId:NodeId,payload:PayloadRecord):Promise<void>{
    const s=this.schema(nodeId); await this.sql.unsafe(`insert into ${s}.payloads(address,bytes,byte_length,observed_name,detected_media_type) values($1,$2,$3,$4,$5) on conflict(address) do nothing`,[payload.address,Buffer.from(payload.bytes),payload.byteLength,payload.observedName,payload.detectedMediaType]);
    const rows=await this.sql.unsafe(`select bytes,byte_length from ${s}.payloads where address=$1`,[payload.address]); if(!rows[0]||rows[0].byte_length!==payload.byteLength||!bytesEqual(toBytes(rows[0].bytes),payload.bytes))throw new Error('PAYLOAD_ADDRESS_COLLISION');
  }
  async getPayload(nodeId:NodeId,address:string):Promise<PayloadRecord|null>{
    const s=this.schema(nodeId); const rows=await this.sql.unsafe(`select address,bytes,byte_length,observed_name,detected_media_type from ${s}.payloads where address=$1`,[address]); const r=rows[0]; return r?{address:r.address,bytes:toBytes(r.bytes),byteLength:r.byte_length,observedName:r.observed_name,detectedMediaType:r.detected_media_type}:null;
  }
  async beginHold(nodeId:NodeId,input:BeginHoldInput):Promise<{created:boolean;inbound:InboundRecord}>{
    const s=this.schema(nodeId); return this.tx(async sql=>{
      await sql.unsafe('select pg_advisory_xact_lock(hashtext($1))',[input.crossingId]);
      const existing=await sql.unsafe(`select crossing_id,source_node_id,state,hold_receipt_id,disposition_receipt_id,envelope from ${s}.inbox where crossing_id=$1 for update`,[input.crossingId]);
      if(existing[0])return {created:false,inbound:{crossingId:existing[0].crossing_id,sourceNodeId:existing[0].source_node_id,state:existing[0].state,holdReceiptId:existing[0].hold_receipt_id,dispositionReceiptId:existing[0].disposition_receipt_id,envelope:existing[0].envelope}};
      await sql.unsafe(`insert into ${s}.payloads(address,bytes,byte_length,observed_name,detected_media_type) values($1,$2,$3,$4,$5) on conflict(address) do nothing`,[input.payload.address,Buffer.from(input.payload.bytes),input.payload.byteLength,input.payload.observedName,input.payload.detectedMediaType]);
      const check=await sql.unsafe(`select bytes,byte_length from ${s}.payloads where address=$1`,[input.payload.address]); if(!check[0]||check[0].byte_length!==input.payload.byteLength||!bytesEqual(toBytes(check[0].bytes),input.payload.bytes))throw new Error('PAYLOAD_ADDRESS_COLLISION');
      await sql.unsafe(`insert into ${s}.receipts(receipt_id,kind,body) values($1,$2,$3::jsonb)`,[input.holdReceipt.receipt_id,input.holdReceipt.kind,JSON.stringify(input.holdReceipt)]);
      await sql.unsafe(`insert into ${s}.inbox(crossing_id,source_node_id,state,hold_receipt_id,envelope,payload_address) values($1,$2,'HOLD',$3,$4::jsonb,$5)`,[input.crossingId,input.sourceNodeId,input.holdReceipt.receipt_id,JSON.stringify(input.envelope),input.payload.address]);
      return {created:true,inbound:{crossingId:input.crossingId,sourceNodeId:input.sourceNodeId,state:'HOLD',holdReceiptId:input.holdReceipt.receipt_id,dispositionReceiptId:null,envelope:input.envelope}};
    });
  }
  async getInbound(nodeId:NodeId,crossingId:string):Promise<InboundRecord|null>{const s=this.schema(nodeId);const rows=await this.sql.unsafe(`select crossing_id,source_node_id,state,hold_receipt_id,disposition_receipt_id,envelope from ${s}.inbox where crossing_id=$1`,[crossingId]);const r=rows[0];return r?{crossingId:r.crossing_id,sourceNodeId:r.source_node_id,state:r.state,holdReceiptId:r.hold_receipt_id,dispositionReceiptId:r.disposition_receipt_id,envelope:r.envelope}:null;}
  async getReceipt(nodeId:NodeId,receiptId:string):Promise<any|null>{const s=this.schema(nodeId);const rows=await this.sql.unsafe(`select body from ${s}.receipts where receipt_id=$1`,[receiptId]);return rows[0]?.body??null;}
  async persistDisposition(nodeId:NodeId,crossingId:string,receipt:any,events:any[],ancestry:any[]):Promise<InboundRecord>{
    const s=this.schema(nodeId); return this.tx(async sql=>{
      const rows=await sql.unsafe(`select crossing_id,source_node_id,state,hold_receipt_id,disposition_receipt_id,envelope from ${s}.inbox where crossing_id=$1 for update`,[crossingId]);const r=rows[0];if(!r)throw new Error('INBOUND_NOT_FOUND');if(r.state==='RESOLVED')throw new Error('TERMINAL_DISPOSITION_IMMUTABLE');
      await sql.unsafe(`insert into ${s}.receipts(receipt_id,kind,body) values($1,$2,$3::jsonb)`,[receipt.receipt_id,receipt.kind,JSON.stringify(receipt)]);
      for(const e of events)await sql.unsafe(`insert into ${s}.constitution_events(event_id,crossing_id,class,body) values($1,$2,$3,$4::jsonb)`,[e.event_id??randomUUID(),crossingId,e.class??'constitution',JSON.stringify(e.body??e)]);
      for(const a of ancestry)await sql.unsafe(`insert into ${s}.ancestry(child_ref,parent_ref,relation) values($1,$2,$3) on conflict do nothing`,[a.child_ref,a.parent_ref,a.relation]);
      await sql.unsafe(`update ${s}.inbox set state='RESOLVED',disposition_receipt_id=$2,updated_at=now() where crossing_id=$1`,[crossingId,receipt.receipt_id]);
      return {crossingId:r.crossing_id,sourceNodeId:r.source_node_id,state:'RESOLVED',holdReceiptId:r.hold_receipt_id,dispositionReceiptId:receipt.receipt_id,envelope:r.envelope};
    });
  }
  async enqueueOutbox(nodeId:NodeId,input:OutboxInput):Promise<OutboxRecord>{const s=this.schema(nodeId);await this.sql.unsafe(`insert into ${s}.outbox(crossing_id,destination_node_id,envelope,payload_address,state) values($1,$2,$3::jsonb,$4,'PENDING') on conflict(crossing_id) do nothing`,[input.crossingId,input.destinationNodeId,JSON.stringify(input.envelope),input.payloadAddress]);return (await this.claimOutbox(nodeId,input.crossingId))!;}
  async claimOutbox(nodeId:NodeId,crossingId?:string):Promise<OutboxRecord|null>{const s=this.schema(nodeId);const rows=await this.sql.unsafe(crossingId?`select * from ${s}.outbox where crossing_id=$1`:`select * from ${s}.outbox where state='PENDING' order by created_at limit 1`,crossingId?[crossingId]:[]);const r=rows[0];if(!r)return null;const hist=await this.sql.unsafe(`select body from ${s}.constitution_events where crossing_id=$1 and class='transport-attempt' order by created_at,event_id`,[r.crossing_id]);return {crossingId:r.crossing_id,destinationNodeId:r.destination_node_id,envelope:r.envelope,payloadAddress:r.payload_address,state:r.state,attempts:r.attempts,lastError:r.last_error,attemptHistory:hist.map(x=>x.body)};}
  async recordAttempt(nodeId:NodeId,crossingId:string,attempt:AttemptRecord):Promise<OutboxRecord>{const s=this.schema(nodeId);await this.tx(async sql=>{await sql.unsafe(`update ${s}.outbox set attempts=attempts+1,last_error=$2,updated_at=now() where crossing_id=$1`,[crossingId,attempt.ok?null:(attempt.error??'transport failure')]);await sql.unsafe(`insert into ${s}.constitution_events(event_id,crossing_id,class,body) values($1,$2,'transport-attempt',$3::jsonb)`,[randomUUID(),crossingId,JSON.stringify({...attempt,at:attempt.at??new Date().toISOString()})]);});return (await this.claimOutbox(nodeId,crossingId))!;}
  async completeOutbox(nodeId:NodeId,crossingId:string):Promise<OutboxRecord>{const s=this.schema(nodeId);await this.sql.unsafe(`update ${s}.outbox set state='COMPLETE',last_error=null,updated_at=now() where crossing_id=$1`,[crossingId]);return (await this.claimOutbox(nodeId,crossingId))!;}
  async recordObservation(node:NodeId,crossing:string,receipt:ReceiptV0,kind:string){
    const schema=this.schema(node);
    await this.tx(async sql=>{
      await sql.unsafe(`insert into ${schema}.receipts(receipt_id,kind,body) values($1,$2,$3::jsonb) on conflict(receipt_id) do nothing`,[receipt.receipt_id,receipt.kind,JSON.stringify(receipt)]);
      await sql.unsafe(`insert into ${schema}.constitution_events(event_id,crossing_id,class,body) values($1,$2,$3,$4::jsonb)`,[randomUUID(),crossing,kind,JSON.stringify({receipt_id:receipt.receipt_id})]);
    });
  }
  async recordHeldAcknowledgement(node:NodeId,crossing:string,hold:ReceiptV0){
    const schema=this.schema(node);
    await this.tx(async sql=>{
      await sql.unsafe('select pg_advisory_xact_lock(hashtext($1))',[node+crossing]);
      const prior=await sql.unsafe(`select body from ${schema}.constitution_events where crossing_id=$1 and class='transport-hold-acknowledgement'`,[crossing]);
      if(prior[0]){if(prior[0].body.receipt_id!==hold.receipt_id)throw Error('ACKNOWLEDGEMENT_CONFLICT');return;}
      await sql.unsafe(`insert into ${schema}.receipts(receipt_id,kind,body) values($1,$2,$3::jsonb) on conflict(receipt_id) do nothing`,[hold.receipt_id,hold.kind,JSON.stringify(hold)]);
      await sql.unsafe(`insert into ${schema}.constitution_events(event_id,crossing_id,class,body) values($1,$2,'transport-hold-acknowledgement',$3::jsonb)`,[randomUUID(),crossing,JSON.stringify({receipt_id:hold.receipt_id})]);
    });
  }
  async recordAcknowledgement(node:NodeId,crossing:string,hold:ReceiptV0,disposition:ReceiptV0){
    const schema=this.schema(node);
    await this.tx(async sql=>{
      await sql.unsafe('select pg_advisory_xact_lock(hashtext($1))',[node+crossing]);
      const previous=await sql.unsafe(`select body from ${schema}.constitution_events where crossing_id=$1 and class='transport-acknowledgement'`,[crossing]);
      if(previous[0]){
        const ack=previous[0].body;
        if(ack.hold_receipt_id!==hold.receipt_id || ack.disposition_receipt_id!==disposition.receipt_id)throw Error('ACKNOWLEDGEMENT_CONFLICT');
        return;
      }
      for(const receipt of [hold,disposition])await sql.unsafe(`insert into ${schema}.receipts(receipt_id,kind,body) values($1,$2,$3::jsonb) on conflict(receipt_id) do nothing`,[receipt.receipt_id,receipt.kind,JSON.stringify(receipt)]);
      await sql.unsafe(`insert into ${schema}.constitution_events(event_id,crossing_id,class,body) values($1,$2,'transport-acknowledgement',$3::jsonb)`,
        [randomUUID(),crossing,JSON.stringify({hold_receipt_id:hold.receipt_id,disposition_receipt_id:disposition.receipt_id})]);
    });
  }
  async readTrace(node:NodeId,crossing:string):Promise<TransportTrace>{
    const schema=this.schema(node), inbound=await this.getInbound(node,crossing), outbound=await this.claimOutbox(node,crossing);
    if(!inbound&&!outbound)throw Error('CROSSING_NOT_OBSERVED');
    const rows=await this.sql.unsafe(`select body from ${schema}.constitution_events where crossing_id=$1 and class='transport-acknowledgement'`,[crossing]);
    const held=await this.sql.unsafe(`select body from ${schema}.constitution_events where crossing_id=$1 and class='transport-hold-acknowledgement'`,[crossing]);
    const observations=await this.sql.unsafe(`select r.body from ${schema}.constitution_events e join ${schema}.receipts r on r.receipt_id=e.body->>'receipt_id' where e.crossing_id=$1 and e.class='edge-disposition' order by e.created_at,e.event_id`,[crossing]);
    const holdId=inbound?.holdReceiptId??rows[0]?.body.hold_receipt_id??held[0]?.body.receipt_id;
    const dispId=inbound?.dispositionReceiptId??rows[0]?.body.disposition_receipt_id;
    return {node_id:node,host_id:this.hostId,signed_crossing:inbound?.envelope??outbound!.envelope,
      signed_hold:holdId?await this.getReceipt(node,holdId):null,signed_disposition:dispId?await this.getReceipt(node,dispId):null,
      attempts:outbound?.attemptHistory??[],relation_observations:observations.map(o=>o.body)};
  }
  async readNodeStatus(node:NodeId):Promise<NodeStatus>{
    const schema=this.schema(node);
    const [held,pending,last]=await Promise.all([
      this.sql.unsafe(`select count(*)::int n from ${schema}.inbox where state='HOLD'`),
      this.sql.unsafe(`select count(*)::int n,min(created_at)::text oldest from ${schema}.outbox where state='PENDING'`),
      this.sql.unsafe(`select receipt_id from ${schema}.receipts order by created_at desc,receipt_id desc limit 1`)]);
    return {node_id:node,held_count:held[0]?.n??0,outbox_pending_count:pending[0]?.n??0,
      oldest_pending_at:pending[0]?.oldest??null,last_receipt_id:last[0]?.receipt_id??null};
  }
  async readStatus():Promise<HostStatusV0>{
    const fps=await this.sql.unsafe('select node_id,fingerprint from mx13_host.node_keys where active=true order by node_id'); let pending=0,holds=0,failed=0;const receipts:string[]=[];const latest:Record<string,string|null>={};
    for(const id of this.localNodeIds){const s=this.schema(id);const [p,h,f,rr,ll]=await Promise.all([this.sql.unsafe(`select count(*)::int n from ${s}.outbox where state='PENDING'`),this.sql.unsafe(`select count(*)::int n from ${s}.inbox where state='HOLD'`),this.sql.unsafe(`select count(*)::int n from ${s}.constitution_events where class='transport-attempt' and coalesce((body->>'ok')::boolean,false)=false`),this.sql.unsafe(`select receipt_id from ${s}.receipts order by created_at desc limit 3`),this.sql.unsafe(`select max(updated_at)::text t from ${s}.inbox`)]);pending+=p[0]?.n??0;holds+=h[0]?.n??0;failed+=f[0]?.n??0;receipts.push(...rr.map(x=>x.receipt_id));latest[id]=ll[0]?.t??null;}
    return {hostId:this.hostId,localNodeIds:[...this.localNodeIds],publicFingerprints:Object.fromEntries(fps.map(x=>[x.node_id,x.fingerprint])),pendingOutboxCount:pending,unresolvedHoldCount:holds,recentReceiptIds:receipts.slice(0,20),failedTransportCount:failed,latestDurableCrossingTimestamps:latest,forbiddenBypassObserved:false};
  }
}

export function sha256Token(value:string):string{return createHash('sha256').update(value,'utf8').digest('hex');}
