import type { NodeId } from './model.ts';

export interface NodeDefinition {
  id: NodeId;
  name: string;
  host: 'WITNESS' | 'pantry-gate';
  law: string;
}

export const NODE_DEFINITIONS: readonly NodeDefinition[] = [
  {id:'mx13:01-witness',name:'THE WITNESS',host:'WITNESS',law:'WITNESS != JUDGE'},
  {id:'mx13:02-gate',name:'THE GATE',host:'pantry-gate',law:'PRESENCE != PEDIGREE'},
  {id:'mx13:03-dead-letter',name:'DEAD LETTER',host:'WITNESS',law:'FAILURE != ABSENCE'},
  {id:'mx13:04-compost-monk',name:'COMPOST MONK',host:'pantry-gate',law:'DERIVATION != ORIGINAL'},
  {id:'mx13:05-mirrorgoat',name:'MIRRORGØAT',host:'WITNESS',law:'RETURN != IDENTITY'},
  {id:'mx13:06-contrary',name:'THE CONTRARY',host:'pantry-gate',law:'AGREEMENT != SUCCESS'},
  {id:'mx13:07-lantern-eater',name:'LANTERN EATER',host:'WITNESS',law:'OMITTED EXPLANATION != CHANGED PARTICULAR'},
  {id:'mx13:08-pirate-clerk',name:'PIRATE CLERK',host:'pantry-gate',law:'CUSTODY != OWNERSHIP'},
  {id:'mx13:09-choir-of-one',name:'CHOIR-OF-ONE',host:'WITNESS',law:'COMPOSITION != CONSENSUS'},
  {id:'mx13:10-bone-orchard',name:'BONE ORCHARD',host:'pantry-gate',law:'DESCENDANT != RETROACTIVE CAUSE'},
  {id:'mx13:11-oracl',name:'ORACL',host:'WITNESS',law:'ORACLE != AUTHORITY'},
  {id:'mx13:12-ferryman',name:'FERRYMAN',host:'pantry-gate',law:'FERRYMAN != DESTINATION'},
  {id:'mx13:13-misspeldd-maxhinal',name:'MISSPELDD MAXHINAL',host:'WITNESS',law:'CORRECTION != FIDELITY'},
] as const;

export const NODE_IDS = NODE_DEFINITIONS.map(n => n.id) as readonly NodeId[];
const BY_ID = new Map<NodeId, NodeDefinition>(NODE_DEFINITIONS.map(n => [n.id,n]));

export function isNodeId(value: unknown): value is NodeId {
  return typeof value === 'string' && BY_ID.has(value as NodeId);
}

export function nodeDefinition(nodeId: NodeId): NodeDefinition {
  const value=BY_ID.get(nodeId);
  if (!value) throw new Error('UNKNOWN_DESTINATION');
  return value;
}

export function nodeSchema(nodeId: NodeId): string {
  const index=NODE_IDS.indexOf(nodeId)+1;
  if (index<1) throw new Error('UNKNOWN_DESTINATION');
  return `mx13_n${String(index).padStart(2,'0')}`;
}
