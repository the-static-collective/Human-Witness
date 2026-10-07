import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const crossing = JSON.parse(await readFile(new URL('../fixtures/relatte/sb001-signed-crossing.json', import.meta.url), 'utf8'));
const receipt = JSON.parse(await readFile(new URL('../fixtures/relatte/sb001-release-receipt.json', import.meta.url), 'utf8'));

async function loadProtocol() {
  try { return await import('../src/relatte_v0.ts'); }
  catch (error) { assert.fail(`reLATTE v0 module unavailable: ${error}`); }
}

test('reLATTE v0 verifies pinned SB-001 crossing and receipt', async () => {
  const p = await loadProtocol();
  assert.equal(await p.verifyCrossingEnvelope(crossing), true);
  assert.equal(await p.verifyReceipt(receipt), true);
});

test('reLATTE v0 rejects signed semantic mutation', async () => {
  const p = await loadProtocol();
  const mutated = structuredClone(crossing);
  mutated.requested_effect = { destination_disposition: 'ADMIT' };
  assert.equal(await p.verifyCrossingEnvelope(mutated), false);
});

test('newly sealed crossing verifies and never exports private d', async () => {
  const p = await loadProtocol();
  const keys = await p.generateP256KeyPair();
  const draft = structuredClone(crossing);
  delete draft.crossing_id;
  delete draft.signing;
  draft.created_at = '2026-10-07T01:00:00.000Z';
  const sealed = await p.sealCrossingEnvelope(draft, keys);
  assert.equal(await p.verifyCrossingEnvelope(sealed), true);
  assert.equal('d' in sealed.signing.public_key, false);
});

test('public key fingerprint is deterministic', async () => {
  const p = await loadProtocol();
  const a = p.publicKeyFingerprint(crossing.signing.public_key);
  const b = p.publicKeyFingerprint(structuredClone(crossing.signing.public_key));
  assert.equal(a, b);
  assert.match(a, /^sha256:[0-9a-f]{64}$/);
});
