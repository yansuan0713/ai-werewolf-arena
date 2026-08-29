import { randomUUID } from 'node:crypto';
import { normalizeGameState } from '../src/game/schema.js';
import { normalizeCollarGameState } from '../src/game/collar-schema.js';
import {
  COLLAR_SCHEMA_VERSION,
  isCollarGame,
  type CollarGameState,
  type CollarLogEntry,
} from '../src/shared/collar-types.js';
import type { AnyGameState } from '../src/shared/game-types.js';
import { GAME_SCHEMA_VERSION, type GameState, type LogEntry } from '../src/shared/types.js';

const renewLogs = (logs: LogEntry[]) => logs.map((log) => ({ ...log, id: randomUUID() }));

export function cloneImportedGame(input: unknown): GameState {
  const source = normalizeGameState(input);
  const idMap = new Map(source.players.map((player) => [player.id, randomUUID()]));
  const timestamp = new Date().toISOString();
  return {
    ...source,
    schemaVersion: GAME_SCHEMA_VERSION,
    id: randomUUID(),
    title: `${source.title}（导入）`,
    createdAt: timestamp,
    updatedAt: timestamp,
    players: source.players.map((player) => ({ ...player, id: idMap.get(player.id)! })),
    actions: source.actions.map((action) => ({
      ...action,
      id: randomUUID(),
      playerId: idMap.get(action.playerId)!,
    })),
    publicLog: renewLogs(source.publicLog),
    godLog: renewLogs(source.godLog),
    privateLogs: Object.fromEntries(
      source.players.map((player) => [
        idMap.get(player.id)!,
        renewLogs(source.privateLogs[player.id]),
      ]),
    ),
    pendingHunterId: source.pendingHunterId ? idMap.get(source.pendingHunterId) : undefined,
  };
}

const renewCollarLogs = (logs: CollarLogEntry[]) =>
  logs.map((log) => ({ ...log, id: randomUUID() }));

export function cloneImportedCollarGame(input: unknown): CollarGameState {
  const source = normalizeCollarGameState(input);
  const idMap = new Map(source.players.map((player) => [player.id, randomUUID()]));
  const timestamp = new Date().toISOString();
  return {
    ...source,
    schemaVersion: COLLAR_SCHEMA_VERSION,
    id: randomUUID(),
    title: `${source.title}（导入）`,
    createdAt: timestamp,
    updatedAt: timestamp,
    players: source.players.map((player) => ({
      ...player,
      id: idMap.get(player.id)!,
      intel: {
        ...player.intel,
        targetPlayerId: idMap.get(player.intel.targetPlayerId)!,
      },
    })),
    actions: source.actions.map((action) => ({
      ...action,
      id: randomUUID(),
      playerId: idMap.get(action.playerId)!,
    })),
    publicLog: renewCollarLogs(source.publicLog),
    godLog: renewCollarLogs(source.godLog),
    privateLogs: Object.fromEntries(
      source.players.map((player) => [
        idMap.get(player.id)!,
        renewCollarLogs(source.privateLogs[player.id]),
      ]),
    ),
    briefedPlayerIds: source.briefedPlayerIds.map((playerId) => idMap.get(playerId)!),
    currentOperatorId: source.currentOperatorId ? idMap.get(source.currentOperatorId) : undefined,
    pendingCut: source.pendingCut
      ? {
          ...source.pendingCut,
          operatorId: idMap.get(source.pendingCut.operatorId)!,
          targetId: idMap.get(source.pendingCut.targetId)!,
        }
      : undefined,
    winnerPlayerId: source.winnerPlayerId ? idMap.get(source.winnerPlayerId) : undefined,
  };
}

export function cloneAnyImportedGame(input: unknown): AnyGameState {
  return isCollarGame(input) ? cloneImportedCollarGame(input) : cloneImportedGame(input);
}
