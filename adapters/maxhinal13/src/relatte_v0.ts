import { Buffer } from 'node:buffer';
/**
 * Compatibility adapter for reLATTE v0 at
 * 5d96af53a730b0ce3111e8551e62030596815069.
 * reLATTE remains the canonical protocol owner.
 */
import { createHash } from 'node:crypto';
import type { CrossingDraftV0, CrossingEnvelopeV0, P256KeyMaterial, ReceiptDraftV0, ReceiptV0 } from './model.ts';

export const CROSSING_ID_DOMAIN = 'reLATTE-CrossingEnvelope-v0|';
export const CROSSING_SIGNATURE_DOMAIN = 'reLATTE-CrossingSignature-v0|';
export const RECEIPT_ID_DOMAIN = 'reLATTE-Receipt-v0|';
export const RECEIPT_SIGNATURE_DOMAIN = 'reLATTE-ReceiptSignature-v0|';
export const P256_ALGORITHM = 'ECDSA-P256-SHA256';
export const CROSSING_SIGNING_DOMAIN = 'relatte.crossing-signature/v0';
export const RECEIPT_SIGNING_DOMAIN = 'relatte.receipt-signature/v0';

const CROSSING_KEYS = new Set([
  'schema','crossing_id','protocol_version','source_particular','source_world','source_history_head','parents',
  'declared_kind','payload_refs','requested_effect','capability_ref','privacy_policy','audience_policy',
  'return_address','created_at','signing','extensions',
]);
const RECEIPT_KEYS = new Set([
  'schema','receipt_id','crossing_id','world_id','receiver_particular','kind','semantic_effect','contract_ref',
  'pre_state_ref','post_state_ref','descendant_refs','residual_refs','note','created_at','signing','extensions',
]);
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const B64URL_RE = /^[A-Za-z0-9_-]+$/;

function record(value: unknown, code = 'INVALID_TYPE'): Record<string, any> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(code);
  return value as Record<string, any>;
}
function assertKeys(value: Record<string, any>, allowed: Set<string>, code: string) {
  for (const k of Object.keys(value)) if (!allowed.has(k)) throw new Error(code);
}
function requiredString(value: Record<string, any>, key: string): string {
  const v=value[key]; if (typeof v !== 'string' || v.length===0) throw new Error(`INVALID_${key.toUpperCase()}`); return v;
}
function normalizedPublicJwk(value: JsonWebKey): JsonWebKey {
  if (value.d !== undefined) throw new Error('PRIVATE_KEY_MATERIAL');
  if (value.kty !== 'EC' || value.crv !== 'P-256' || typeof value.x !== 'string' || typeof value.y !== 'string') throw new Error('INVALID_PUBLIC_KEY');
  for (const coord of [value.x,value.y]) {
    if (!B64URL_RE.test(coord)) throw new Error('INVALID_PUBLIC_KEY');
    const bytes=Buffer.from(coord,'base64url');
    if (bytes.length !== 32 || bytes.toString('base64url') !== coord) throw new Error('INVALID_PUBLIC_KEY');
  }
  return {kty:'EC',crv:'P-256',x:value.x,y:value.y};
}
function signingIdentity(value: unknown, domain: string) {
  const s=record(value);
  for (const k of Object.keys(s)) if (!['algorithm','public_key','signature','domain'].includes(k)) throw new Error('UNEXPECTED_SIGNING_FIELD');
  if (s.algorithm !== P256_ALGORITHM || s.domain !== domain) throw new Error('INVALID_SIGNING');
  return {algorithm:P256_ALGORITHM, public_key: normalizedPublicJwk(record(s.public_key) as JsonWebKey), domain};
}
function validateJson(value: unknown, seen=new WeakSet<object>(), depth=0): void {
  if (depth>100) throw new Error('DEPTH_LIMIT_EXCEEDED');
  if (value === undefined) throw new Error('UNDEFINED_VALUE');
  if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) throw new Error('INVALID_NUMBER');
  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') throw new Error('UNSUPPORTED_TYPE');
  if (typeof value === 'object' && value !== null) {
    if (seen.has(value)) throw new Error('CYCLIC_VALUE');
    seen.add(value);
    if (Array.isArray(value)) for (const v of value) validateJson(v, seen, depth+1);
    else for (const v of Object.values(value as Record<string,unknown>)) validateJson(v, seen, depth+1);
    seen.delete(value);
  }
}
export function canonicalize(value: unknown): string {
  validateJson(value);
  if (value === null || typeof value !== 'object') {
    const s=JSON.stringify(value); if (s===undefined) throw new Error('CANONICALIZATION_FAILED'); return s;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj=value as Record<string,unknown>;
  return `{${Object.keys(obj).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}
function domainBytes(domain: string, value: unknown): Uint8Array { return Buffer.from(domain + canonicalize(value),'utf8'); }
function sha256Hex(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex'); }
function validateTimestamp(value: string) { if (!TIMESTAMP_RE.test(value)) throw new Error('INVALID_TIMESTAMP'); }

export function constructCrossingIdentityBody(value: unknown): Record<string,unknown> {
  const e=record(value); validateJson(e); assertKeys(e,CROSSING_KEYS,'UNEXPECTED_CROSSING_FIELD');
  if (e.schema !== 'relatte.crossing-envelope/v0') throw new Error('INVALID_SCHEMA');
  if (e.protocol_version !== '0') throw new Error('INVALID_PROTOCOL_VERSION');
  const created_at=requiredString(e,'created_at'); validateTimestamp(created_at);
  if (!Array.isArray(e.payload_refs) || !Array.isArray(e.parents)) throw new Error('INVALID_ARRAY');
  return {
    schema:'relatte.crossing-envelope/v0', protocol_version:'0', source_particular:requiredString(e,'source_particular'),
    source_world:requiredString(e,'source_world'), source_history_head:e.source_history_head ?? null, parents:e.parents ?? [],
    declared_kind:requiredString(e,'declared_kind'), payload_refs:e.payload_refs, requested_effect:e.requested_effect ?? null,
    capability_ref:e.capability_ref ?? null, privacy_policy:e.privacy_policy ?? null, audience_policy:e.audience_policy ?? null,
    return_address:e.return_address ?? null, created_at,
    signing:signingIdentity(e.signing,CROSSING_SIGNING_DOMAIN), extensions:record(e.extensions ?? {}),
  };
}
export function computeCrossingId(value: unknown): string { return `relatte-crossing-v0:${sha256Hex(domainBytes(CROSSING_ID_DOMAIN, constructCrossingIdentityBody(value)))}`; }
export function crossingSignatureBytes(value: unknown): Uint8Array {
  const body=constructCrossingIdentityBody(value); return domainBytes(CROSSING_SIGNATURE_DOMAIN,{crossing_id:computeCrossingId(value),...body});
}
export function constructReceiptIdentityBody(value: unknown): Record<string,unknown> {
  const r=record(value); validateJson(r); assertKeys(r,RECEIPT_KEYS,'UNEXPECTED_RECEIPT_FIELD');
  if (r.schema !== 'relatte.receipt/v0') throw new Error('INVALID_SCHEMA');
  const created_at=requiredString(r,'created_at'); validateTimestamp(created_at);
  if (!Array.isArray(r.descendant_refs ?? []) || !Array.isArray(r.residual_refs ?? [])) throw new Error('INVALID_ARRAY');
  return {
    schema:'relatte.receipt/v0', crossing_id:requiredString(r,'crossing_id'), world_id:requiredString(r,'world_id'),
    receiver_particular:requiredString(r,'receiver_particular'), kind:requiredString(r,'kind'), semantic_effect:requiredString(r,'semantic_effect'),
    contract_ref:r.contract_ref ?? null, pre_state_ref:r.pre_state_ref ?? null, post_state_ref:r.post_state_ref ?? null,
    descendant_refs:r.descendant_refs ?? [], residual_refs:r.residual_refs ?? [], note:r.note ?? null, created_at,
    signing:signingIdentity(r.signing,RECEIPT_SIGNING_DOMAIN), extensions:record(r.extensions ?? {}),
  };
}
export function computeReceiptId(value: unknown): string { return `relatte-receipt-v0:${sha256Hex(domainBytes(RECEIPT_ID_DOMAIN, constructReceiptIdentityBody(value)))}`; }
export function receiptSignatureBytes(value: unknown): Uint8Array {
  const body=constructReceiptIdentityBody(value); return domainBytes(RECEIPT_SIGNATURE_DOMAIN,{receipt_id:computeReceiptId(value),...body});
}
function sigBytes(value: string): Uint8Array {
  if (!B64URL_RE.test(value)) throw new Error('INVALID_SIGNATURE');
  const b=Buffer.from(value,'base64url'); if (b.length!==64 || b.toString('base64url')!==value) throw new Error('INVALID_SIGNATURE'); return b;
}
async function importVerify(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk',normalizedPublicJwk(jwk),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
}
async function sign(key: CryptoKey, bytes: Uint8Array): Promise<string> {
  const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new Uint8Array(bytes)); return Buffer.from(sig).toString('base64url');
}
export async function generateP256KeyPair(): Promise<P256KeyMaterial> {
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']) as CryptoKeyPair;
  const publicKeyJwk=normalizedPublicJwk(await crypto.subtle.exportKey('jwk',pair.publicKey));
  return {privateKey:pair.privateKey,publicKey:pair.publicKey,publicKeyJwk};
}
export async function sealCrossingEnvelope(draft: CrossingDraftV0 | Record<string,any>, keys: P256KeyMaterial): Promise<CrossingEnvelopeV0> {
  const {crossing_id:_id,signing:_signing,...body}=draft as any;
  const envelope:any={...body,crossing_id:'pending',signing:{algorithm:P256_ALGORITHM,public_key:normalizedPublicJwk(keys.publicKeyJwk),signature:'pending',domain:CROSSING_SIGNING_DOMAIN}};
  envelope.crossing_id=computeCrossingId(envelope);
  envelope.signing.signature=await sign(keys.privateKey,crossingSignatureBytes(envelope));
  return envelope as CrossingEnvelopeV0;
}
export async function verifyCrossingEnvelope(value: unknown): Promise<boolean> {
  try {
    const e=record(value); if (e.crossing_id!==computeCrossingId(e)) return false;
    const s=record(e.signing); if (s.algorithm!==P256_ALGORITHM || s.domain!==CROSSING_SIGNING_DOMAIN) return false;
    const key=await importVerify(s.public_key as JsonWebKey);
    return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,new Uint8Array(sigBytes(requiredString(s,'signature'))),new Uint8Array(crossingSignatureBytes(e)));
  } catch { return false; }
}
export async function sealReceipt(draft: ReceiptDraftV0 | Record<string,any>, keys: P256KeyMaterial): Promise<ReceiptV0> {
  const {receipt_id:_id,signing:_signing,...body}=draft as any;
  const receipt:any={...body,receipt_id:'pending',signing:{algorithm:P256_ALGORITHM,public_key:normalizedPublicJwk(keys.publicKeyJwk),signature:'pending',domain:RECEIPT_SIGNING_DOMAIN}};
  receipt.receipt_id=computeReceiptId(receipt);
  receipt.signing.signature=await sign(keys.privateKey,receiptSignatureBytes(receipt));
  return receipt as ReceiptV0;
}
export async function verifyReceipt(value: unknown): Promise<boolean> {
  try {
    const r=record(value); if (r.receipt_id!==computeReceiptId(r)) return false;
    const s=record(r.signing); if (s.algorithm!==P256_ALGORITHM || s.domain!==RECEIPT_SIGNING_DOMAIN) return false;
    const key=await importVerify(s.public_key as JsonWebKey);
    return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,new Uint8Array(sigBytes(requiredString(s,'signature'))),new Uint8Array(receiptSignatureBytes(r)));
  } catch { return false; }
}
export function publicKeyFingerprint(jwk: JsonWebKey): string {
  return `sha256:${sha256Hex(Buffer.from(canonicalize(normalizedPublicJwk(jwk)),'utf8'))}`;
}
