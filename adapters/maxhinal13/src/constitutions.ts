import type { LocalDisposition, NodeId } from './model.ts';
import { nodeDefinition } from './nodes.ts';

export interface DescendantSpec {
  kind: string;
  parent_refs: string[];
  claims_byte_identity?: boolean;
  authority?: boolean;
  body?: Record<string,unknown>;
}

export interface ConstitutionContext {
  nodeId: NodeId;
  envelope: any;
  payloadAddress: string;
  observedFilename: string;
  detectedMediaType: string;
  priorReceiptIds: string[];
  routeIndex: number;
}

export interface ConstitutionResult {
  disposition: LocalDisposition;
  semanticEffect: string;
  descendantSpecs: DescendantSpec[];
  notes: string[];
  routeForwardAllowed: boolean;
}

function result(disposition: LocalDisposition, semanticEffect: string, descendantSpecs: DescendantSpec[]=[], notes: string[]=[]): ConstitutionResult {
  return {disposition,semanticEffect,descendantSpecs,notes,routeForwardAllowed:true};
}

export function evaluateConstitution(ctx: ConstitutionContext): ConstitutionResult {
  const def=nodeDefinition(ctx.nodeId);
  const parents=Array.isArray(ctx.envelope?.parents) ? ctx.envelope.parents.filter((x:any)=>typeof x==='string') : [];
  const lineage=[...new Set([...parents,...ctx.priorReceiptIds])];
  switch (ctx.nodeId) {
    case 'mx13:01-witness':
      return result('FORWARD','witness-only',[],['observed attributable arrival; no downstream judgment']);
    case 'mx13:02-gate':
      if (lineage.length===0) return result('REFUSE','ancestry-required',[],['refused rather than guessing ancestry']);
      return result('ADMIT','pedigree-checked',[],[`exact payload address ${ctx.payloadAddress}`]);
    case 'mx13:03-dead-letter':
      return result('FORWARD','no-failure-observed',[],['successful delivery recorded without erasing possible future failure evidence']);
    case 'mx13:04-compost-monk':
      if (lineage.length===0) return result('REFUSE','lineage-required',[],['DERIVATION != ORIGINAL']);
      return result('ADMIT','composted-with-lineage',[{kind:'compost-descendant',parent_refs:lineage,claims_byte_identity:false,authority:false,body:{source_address:ctx.payloadAddress}}],['derived form is not source particular']);
    case 'mx13:05-mirrorgoat':
      return result('RETURN','local-reflection',[{kind:'mirror-descendant',parent_refs:lineage,claims_byte_identity:false,authority:false,body:{frame:'mx13:05-mirrorgoat'}}],['RETURN != IDENTITY']);
    case 'mx13:06-contrary':
      return result('ADMIT','lawful-disagreement',[{kind:'contrary-valuation',parent_refs:lineage,claims_byte_identity:false,authority:false,body:{valuation:'contrary-local'}}],['agreement is not required for successful crossing']);
    case 'mx13:07-lantern-eater':
      return result('ADMIT','reduced-context-view',[{kind:'reduced-context-descendant',parent_refs:lineage,claims_byte_identity:false,authority:false,body:{omitted:['observed_filename','presentation_labels'],source_address:ctx.payloadAddress}}],['omitted explanatory metadata only']);
    case 'mx13:08-pirate-clerk': {
      const salvage=Boolean(ctx.envelope?.extensions?.mx13?.salvage_eligible || ctx.envelope?.extensions?.mx13?.abandoned);
      if (!salvage) return result('REFUSE','salvage-not-authorized',[],['custody does not manufacture ownership']);
      return result('ADMIT','bounded-salvage-custody',[],['custody accepted; ownership remains unclaimed']);
    }
    case 'mx13:09-choir-of-one':
      return result('ADMIT','plural-composition',[{kind:'choir-composition',parent_refs:lineage,claims_byte_identity:false,authority:false,body:{voices:lineage}}],['composition does not imply consensus']);
    case 'mx13:10-bone-orchard':
      return result('ADMIT','descendant-index',[{kind:'descendant-index-event',parent_refs:lineage,claims_byte_identity:false,authority:false,body:{source_address:ctx.payloadAddress}}],['future descendants may not rewrite ancestor meaning']);
    case 'mx13:11-oracl':
      return result('FORWARD','advisory-only',[{kind:'oracle-advisory',parent_refs:lineage,claims_byte_identity:false,authority:false,body:{advisory:true}}],['prediction/interpretation has no admission authority']);
    case 'mx13:12-ferryman':
      return result('FORWARD','transit-only',[],['ferryman may transport but never constitute destination meaning']);
    case 'mx13:13-misspeldd-maxhinal':
      return result('ADMIT','malformed-form-preserved',[],[`preserved observed mismatch ${ctx.observedFilename} / ${ctx.detectedMediaType}`,'correction would require a distinct descendant']);
    default: {
      const _never: never = ctx.nodeId;
      throw new Error(`UNKNOWN_DESTINATION:${_never}`);
    }
  }
}
