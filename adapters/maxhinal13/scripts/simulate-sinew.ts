/** Explicit local simulation; the output contains public signatures, never private fixtures. */
import {writeFile} from 'node:fs/promises';
import {relationWitness} from '../test/fixtures/relation.ts';
import {replayTraces} from '../src/trace-replay.ts';
if(!process.argv.includes('--simulation-only'))throw Error('SIMULATION_ONLY_FLAG_REQUIRED');
const output=process.argv[2];if(!output||output.startsWith('--'))throw Error('EVIDENCE_OUTPUT_PATH_REQUIRED');
const w=await relationWitness();
const evidence={schema:'maxhinal13.sinew-simulation/v0',observed_at:new Date().toISOString(),
 traces:w.traces,fingerprints:w.fingerprints,replay:await replayTraces(w.traces,w.fingerprints),
 claims:{local_simulation:true,live_two_host:false,live_thirteen_node:false,pulse_observed:false,host_outage_tested:false}};
await writeFile(output,JSON.stringify(evidence,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:'PASS',evidence_path:output,claims:evidence.claims}));
