import test from 'node:test';
import assert from 'node:assert/strict';

async function load() {
  try {
    return {
      nodes: await import('../src/nodes.ts'),
      constitutions: await import('../src/constitutions.ts'),
    };
  } catch (error) {
    assert.fail(`constitution modules unavailable: ${error}`);
  }
}

const expected = [
  ['mx13:01-witness','THE WITNESS','WITNESS','WITNESS != JUDGE','FORWARD'],
  ['mx13:02-gate','THE GATE','pantry-gate','PRESENCE != PEDIGREE','ADMIT'],
  ['mx13:03-dead-letter','DEAD LETTER','WITNESS','FAILURE != ABSENCE','FORWARD'],
  ['mx13:04-compost-monk','COMPOST MONK','pantry-gate','DERIVATION != ORIGINAL','ADMIT'],
  ['mx13:05-mirrorgoat','MIRRORGØAT','WITNESS','RETURN != IDENTITY','RETURN'],
  ['mx13:06-contrary','THE CONTRARY','pantry-gate','AGREEMENT != SUCCESS','ADMIT'],
  ['mx13:07-lantern-eater','LANTERN EATER','WITNESS','OMITTED EXPLANATION != CHANGED PARTICULAR','ADMIT'],
  ['mx13:08-pirate-clerk','PIRATE CLERK','pantry-gate','CUSTODY != OWNERSHIP','REFUSE'],
  ['mx13:09-choir-of-one','CHOIR-OF-ONE','WITNESS','COMPOSITION != CONSENSUS','ADMIT'],
  ['mx13:10-bone-orchard','BONE ORCHARD','pantry-gate','DESCENDANT != RETROACTIVE CAUSE','ADMIT'],
  ['mx13:11-oracl','ORACL','WITNESS','ORACLE != AUTHORITY','FORWARD'],
  ['mx13:12-ferryman','FERRYMAN','pantry-gate','FERRYMAN != DESTINATION','FORWARD'],
  ['mx13:13-misspeldd-maxhinal','MISSPELDD MAXHINAL','WITNESS','CORRECTION != FIDELITY','ADMIT'],
] as const;

function ctx(nodeId: string) {
  return {
    nodeId,
    envelope: {
      crossing_id:'relatte-crossing-v0:'+'1'.repeat(64),
      parents:['relatte-receipt-v0:'+'2'.repeat(64)],
      extensions:{mx13:{salvage_eligible:false}},
    },
    payloadAddress:'sha256:af82b9a3b2d5eeb1ce3d58038b3415ca62f0815bd6f0a04662ec8cf5b773d171',
    observedFilename:'1000018575.png',
    detectedMediaType:'image/jpeg',
    priorReceiptIds:['relatte-receipt-v0:'+'2'.repeat(64)],
    routeIndex:1,
  };
}

test('all thirteen nodes pin name host law and expected MX13-001 disposition', async () => {
  const {nodes,constitutions}=await load();
  assert.equal(nodes.NODE_IDS.length,13);
  for (const [id,name,host,law,disposition] of expected) {
    const def=nodes.nodeDefinition(id);
    assert.equal(def.name,name);
    assert.equal(def.host,host);
    assert.equal(def.law,law);
    const result=constitutions.evaluateConstitution(ctx(id));
    assert.equal(result.disposition,disposition,id);
    assert.equal(result.routeForwardAllowed,true,id);
  }
});

test('gate refuses missing ancestry instead of guessing', async () => {
  const {constitutions}=await load();
  const c=ctx('mx13:02-gate'); c.priorReceiptIds=[]; c.envelope.parents=[];
  const result=constitutions.evaluateConstitution(c);
  assert.equal(result.disposition,'REFUSE');
  assert.match(result.semanticEffect,/ancestry-required/);
});

test('specialized descendants preserve restriction semantics', async () => {
  const {constitutions}=await load();
  const compost=constitutions.evaluateConstitution(ctx('mx13:04-compost-monk'));
  assert.equal(compost.descendantSpecs.length,1);
  assert.equal(compost.descendantSpecs[0].parent_refs.length>0,true);
  const mirror=constitutions.evaluateConstitution(ctx('mx13:05-mirrorgoat'));
  assert.equal(mirror.disposition,'RETURN');
  assert.equal(mirror.descendantSpecs[0].claims_byte_identity,false);
  const oracle=constitutions.evaluateConstitution(ctx('mx13:11-oracl'));
  assert.equal(oracle.descendantSpecs[0].authority,false);
  const ferryman=constitutions.evaluateConstitution(ctx('mx13:12-ferryman'));
  assert.notEqual(ferryman.disposition,'ADMIT');
});

test('pirate cannot synthesize ownership and misspeldd preserves media mismatch', async () => {
  const {constitutions}=await load();
  const pirate=constitutions.evaluateConstitution(ctx('mx13:08-pirate-clerk'));
  assert.equal(pirate.disposition,'REFUSE');
  assert.equal(pirate.notes.some((n:string)=>n.includes('ownership')),true);
  const misspeldd=constitutions.evaluateConstitution(ctx('mx13:13-misspeldd-maxhinal'));
  assert.equal(misspeldd.disposition,'ADMIT');
  assert.equal(misspeldd.notes.some((n:string)=>n.includes('1000018575.png') && n.includes('image/jpeg')),true);
  assert.equal(misspeldd.descendantSpecs.length,0);
});
