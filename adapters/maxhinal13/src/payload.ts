import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

export const MAX_PAYLOAD_BYTES = 1_048_576;
export const MAX_CLOCK_SKEW_SECONDS = 300;
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function decodePayloadB64(value: string): Uint8Array {
  if (typeof value !== 'string' || !BASE64_RE.test(value)) throw new Error('INVALID_PAYLOAD_BASE64');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error('INVALID_PAYLOAD_BASE64');
  if (bytes.length > MAX_PAYLOAD_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
  return new Uint8Array(bytes);
}

export async function sha256Address(bytes: Uint8Array): Promise<string> {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export async function verifyPayload(envelope: any, payloadB64: string): Promise<{bytes: Uint8Array; address: string}> {
  const bytes = decodePayloadB64(payloadB64);
  if (!Array.isArray(envelope?.payload_refs) || envelope.payload_refs.length !== 1) throw new Error('INVALID_PAYLOAD_REF_COUNT');
  const ref = envelope.payload_refs[0];
  const address = await sha256Address(bytes);
  if (typeof ref?.address !== 'string' || ref.address !== address) throw new Error('PAYLOAD_ADDRESS_MISMATCH');
  if (typeof ref?.byte_length !== 'number' || ref.byte_length !== bytes.length) throw new Error('PAYLOAD_LENGTH_MISMATCH');
  return {bytes, address};
}

export function assertFreshTimestamp(createdAt: string, now: Date): void {
  if (typeof createdAt !== 'string' || !ISO_RE.test(createdAt)) throw new Error('INVALID_TIMESTAMP');
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) throw new Error('INVALID_TIMESTAMP');
  if (Math.abs(now.getTime() - t) > MAX_CLOCK_SKEW_SECONDS * 1000) throw new Error('STALE_ENVELOPE');
}
