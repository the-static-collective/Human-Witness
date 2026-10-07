import test from 'node:test';
import assert from 'node:assert/strict';
import {pairFixture} from './fixtures/pair.ts';
import {pulse,PulseObserver,PULSE_TTL_MS} from '../src/pneuma.ts';

const boot='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
test('PNEUMA missing, stale, reconnect, reboot and recovery remain observer-local',async()=>{
 const f=await pairFixture(), observer=new PulseObserver({[f.a]:f.stores[0].keys.get(f.a).fingerprint});
 const now=new Date();
 assert.equal((await observer.observe(f.a,null,now)).state,'UNKNOWN');
 assert.equal((await observer.observe(f.a,await pulse(f.stores[0],f.a,boot,1,now),now)).state,'RECOVERING');
 assert.equal((await observer.observe(f.a,await pulse(f.stores[0],f.a,boot,2,now),now)).state,'PULSING');
 assert.equal(observer.estimate(f.a,new Date(now.getTime()+PULSE_TTL_MS+1)),'UNKNOWN');
 assert.equal((await observer.observe(f.a,await pulse(f.stores[0],f.a,'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',1,now),now)).state,'RECOVERING');
 assert.equal((await observer.observe(f.a,null,now)).state,'UNKNOWN');
 assert.equal(f.stores[0].inbound.size,0); // Presence cannot admit or execute anything.
});
test('PNEUMA signatures and epochs cannot impersonate another node or replay presence',async()=>{
 const f=await pairFixture(), observer=new PulseObserver({[f.a]:f.stores[0].keys.get(f.a).fingerprint});
 const p=await pulse(f.stores[0],f.a,boot,1);
 await observer.observe(f.a,p);assert.equal((await observer.observe(f.a,p)).state,'UNKNOWN');
 p.note='pretend admission';await assert.rejects(()=>observer.observe(f.a,p),/INVALID_OR_UNPINNED_PULSE/);
 const quiet=await pulse(f.stores[1],f.b,boot,1);
 await assert.rejects(()=>observer.observe(f.a,quiet),/INVALID_OR_UNPINNED_PULSE/);
});
test('pulse absence does not alter durable receipt replay or outbox custody',async()=>{
 const f=await pairFixture();const before=await f.stores[0].readTrace(f.a,f.envelope.crossing_id);
 await pulse(f.stores[0],f.a,boot,1);
 assert.deepEqual(await f.stores[0].readTrace(f.a,f.envelope.crossing_id),before);
});

test('PNEUMA stale same-boot reconnect recovers; quiet has no authority',async()=>{
 const f=await pairFixture();f.stores[0].outbox.clear();
 const observer=new PulseObserver({[f.a]:f.stores[0].keys.get(f.a).fingerprint});const now=new Date();
 assert.equal((await observer.observe(f.a,await pulse(f.stores[0],f.a,boot,1,now),now)).state,'QUIET');
 const later=new Date(now.getTime()+PULSE_TTL_MS+1);assert.equal(observer.estimate(f.a,later),'UNKNOWN');
 assert.equal((await observer.observe(f.a,await pulse(f.stores[0],f.a,boot,2,later),later)).state,'RECOVERING');
 assert.equal((await observer.observe(f.a,await pulse(f.stores[0],f.a,boot,3,later),later)).state,'QUIET');
});
