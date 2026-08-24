import { createGame } from '../src/game/engine';
import type { GameState, Phase, Role } from '../src/shared/types';
export const roles:Role[]=['wolf','wolf','seer','witch','hunter','villager','villager'];
export function gameAt(phase:Phase):GameState{const g=createGame({title:'测试局',assignment:'manual',players:roles.map((role,i)=>({name:`P${i+1}`,modelLabel:`M${i+1}`,role}))});g.started=phase!=='setup';g.day=phase==='setup'?0:1;g.phase=phase;return g;}
