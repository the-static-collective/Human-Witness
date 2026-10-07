import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../fixtures/mx13/invitation-manifest.json', import.meta.url), 'utf8'));

async function loadPayload() {
  try { return await import('../src/payload.ts'); }
  catch (error) { assert.fail(`payload module unavailable: ${error}`); }
}

test('INVITATION manifest pins exact observed particular', () => {
  assert.equal(manifest.byte_length, 670478);
  assert.equal(manifest.address, 'sha256:af82b9a3b2d5eeb1ce3d58038b3415ca62f0815bd6f0a04662ec8cf5b773d171');
  assert.equal(manifest.observed_name, '1000018575.png');
  assert.equal(manifest.detected_media_type, 'image/jpeg');
  assert.equal(manifest.filename_media_type_mismatch, true);
  assert.equal(manifest.bytes_vendored_in_repository, false);
});

test('verifyPayload accepts exact bytes and address', async () => {
  const p = await loadPayload();
  const bytes = Buffer.from('maxhinal');
  const address = await p.sha256Address(bytes);
  const envelope = { payload_refs: [{ address, byte_length: bytes.length, role: 'particular', media_type: 'application/octet-stream' }] };
  const result = await p.verifyPayload(envelope, bytes.toString('base64'));
  assert.equal(result.address, address);
  assert.deepEqual(Buffer.from(result.bytes), bytes);
});

test('verifyPayload rejects content-address mismatch', async () => {
  const p = await loadPayload();
  const bytes = Buffer.from('maxhinal');
  const envelope = { payload_refs: [{ address: 'sha256:' + '0'.repeat(64), byte_length: bytes.length }] };
  await assert.rejects(() => p.verifyPayload(envelope, bytes.toString('base64')), /PAYLOAD_ADDRESS_MISMATCH/);
});

test('verifyPayload rejects 1,048,577 bytes', async () => {
  const p = await loadPayload();
  const bytes = Buffer.alloc(1_048_577, 1);
  const envelope = { payload_refs: [{ address: 'sha256:' + '0'.repeat(64), byte_length: bytes.length }] };
  await assert.rejects(() => p.verifyPayload(envelope, bytes.toString('base64')), /PAYLOAD_TOO_LARGE/);
});

test('decodePayloadB64 rejects malformed base64', async () => {
  const p = await loadPayload();
  assert.throws(() => p.decodePayloadB64('***not-base64***'), /INVALID_PAYLOAD_BASE64/);
});

test('assertFreshTimestamp rejects +/-301 seconds', async () => {
  const p = await loadPayload();
  const now = new Date('2026-10-07T01:00:00.000Z');
  assert.throws(() => p.assertFreshTimestamp('2026-10-07T00:54:59.000Z', now), /STALE_ENVELOPE/);
  assert.throws(() => p.assertFreshTimestamp('2026-10-07T01:05:01.000Z', now), /STALE_ENVELOPE/);
  assert.doesNotThrow(() => p.assertFreshTimestamp('2026-10-07T00:55:00.000Z', now));
  assert.doesNotThrow(() => p.assertFreshTimestamp('2026-10-07T01:05:00.000Z', now));
});
