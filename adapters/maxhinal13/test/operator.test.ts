import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash,randomBytes } from 'node:crypto';

test('operator capability verifier accepts only a 256-bit base64url token matching stored SHA-256',async()=>{
  const { verifyOperatorCapability }=await import('../src/operator.ts');
  const token=randomBytes(32).toString('base64url');
  const hash=createHash('sha256').update(token).digest('hex');
  assert.equal(await verifyOperatorCapability(token,hash),true);
  assert.equal(await verifyOperatorCapability(token+'bad',hash),false);
  assert.equal(await verifyOperatorCapability('A'.repeat(43),hash),false);
  assert.equal(await verifyOperatorCapability('abc',hash),false);
  assert.equal(await verifyOperatorCapability(token,'not hex'),false);
});
