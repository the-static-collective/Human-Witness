import {readFile} from 'node:fs/promises';
import {replayTraces} from '../src/trace-replay.ts';
const input=JSON.parse(await readFile(process.argv[2],'utf8'));
console.log(JSON.stringify(await replayTraces(input.traces,input.fingerprints),null,2));
