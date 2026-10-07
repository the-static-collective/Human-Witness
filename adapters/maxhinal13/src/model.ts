export type NodeId =
  | 'mx13:01-witness'
  | 'mx13:02-gate'
  | 'mx13:03-dead-letter'
  | 'mx13:04-compost-monk'
  | 'mx13:05-mirrorgoat'
  | 'mx13:06-contrary'
  | 'mx13:07-lantern-eater'
  | 'mx13:08-pirate-clerk'
  | 'mx13:09-choir-of-one'
  | 'mx13:10-bone-orchard'
  | 'mx13:11-oracl'
  | 'mx13:12-ferryman'
  | 'mx13:13-misspeldd-maxhinal';

export type LocalDisposition = 'ADMIT' | 'REFUSE' | 'RETURN' | 'FORWARD' | 'HOLD' | 'EXPIRE';

export interface SigningBlock {
  algorithm: 'ECDSA-P256-SHA256';
  public_key: JsonWebKey;
  signature: string;
  domain: 'relatte.crossing-signature/v0' | 'relatte.receipt-signature/v0';
}

export interface CrossingEnvelopeV0 {
  schema: 'relatte.crossing-envelope/v0';
  crossing_id: string;
  protocol_version: '0';
  source_particular: string;
  source_world: string;
  source_history_head: string | null;
  parents: unknown[];
  declared_kind: string;
  payload_refs: Array<Record<string, unknown>>;
  requested_effect: unknown;
  capability_ref: unknown;
  privacy_policy: unknown;
  audience_policy: {destination?: NodeId} | null;
  return_address: unknown;
  created_at: string;
  signing: SigningBlock;
  extensions: Record<string, unknown>;
}

export type CrossingDraftV0 = Omit<CrossingEnvelopeV0, 'crossing_id' | 'signing'>;

export interface ReceiptV0 {
  schema: 'relatte.receipt/v0';
  receipt_id: string;
  crossing_id: string;
  world_id: string;
  receiver_particular: string;
  kind: string;
  semantic_effect: string;
  contract_ref: unknown;
  pre_state_ref: unknown;
  post_state_ref: unknown;
  descendant_refs: unknown[];
  residual_refs: unknown[];
  note: unknown;
  created_at: string;
  signing: SigningBlock;
  extensions: Record<string, unknown>;
}

export type ReceiptDraftV0 = Omit<ReceiptV0, 'receipt_id' | 'signing'>;

export interface P256KeyMaterial {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
}
