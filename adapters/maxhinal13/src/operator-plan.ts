import {PINNED_PROJECT_REFS} from './peers.ts';
export const FUNCTIONS=['mx13-genesis','mx13-ingress','mx13-worker','mx13-status'] as const;
export function operatorPlan(){
 return {schema:'maxhinal13.operator-plan/v0',mutation:false,projects:PINNED_PROJECT_REFS,functions:FUNCTIONS,
  prerequisites:['official Supabase CLI authentication in operator environment','host-scoped DB credentials from secure environment',
   'MX13_OPERATOR_DIR outside repository, mode 0700','exact original MX13_INVITATION_PATH for route'],
  steps:['deploy reviewed functions to existing hosts','temporary per-host 256-bit capabilities; SHA256+expiry in DB',
   'host-local identity genesis','destination-validated public peer sync','revoke temporary capabilities',
   'signed 01→01 HOLD','signed 01→02→01 HTTPS round trip','alternating 13-node route','cold replay and advisors'],
  claims:{local_simulation:true,live_two_host:false,live_thirteen_node:false,pulse_observed:false,host_outage_tested:false}};
}
