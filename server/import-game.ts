import { randomUUID } from 'node:crypto';
import { normalizeGameState } from '../src/game/schema.js';
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
