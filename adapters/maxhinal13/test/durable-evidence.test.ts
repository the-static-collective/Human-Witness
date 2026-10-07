import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {replayTraces} from '../src/trace-replay.ts';

test('durable SINEW specimen cold-replays independently and contains no private operator or payload material',async()=>{
 const evidence=JSON.parse(await readFile(new URL('../evidence/sinew-001.simulation.json',import.meta.url),'utf8'));
 const replay=await replayTraces(evidence.traces,evidence.fingerprints);
 const expected=JSON.parse(await readFile(new URL('../evidence/sinew-001.cold-replay.json',import.meta.url),'utf8'));
 assert.deepEqual(replay,expected);assert.equal(evidence.claims.live_two_host,false);
 const forbidden=new Set(['d','private_jwk','password','token','raw_token','service_role','payload_b64','bytes']);
 const scan=(v:unknown)=>{if(v&&typeof v==='object')for(const [k,value] of Object.entries(v)){assert.equal(forbidden.has(k),false,'private field '+k);scan(value);}};
 scan(evidence);
});
