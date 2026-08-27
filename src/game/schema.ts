import {
  ACTION_KINDS,
  GAME_SCHEMA_VERSION,
  PHASES,
  ROLES,
  type GameState,
} from '../shared/types.js';

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const requireValue: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(`存档格式错误：${message}`);
};

export function normalizeGameState(input: unknown, expectedId?: string): GameState {
  requireValue(isRecord(input), '根节点必须是对象');
  const value = structuredClone(input);
  const version = value.schemaVersion ?? 0;
  requireValue(Number.isInteger(version) && Number(version) >= 0, 'schemaVersion 非法');
  requireValue(
    Number(version) <= GAME_SCHEMA_VERSION,
    `存档版本 ${version} 高于当前支持版本 ${GAME_SCHEMA_VERSION}`,
  );

  if (version === 0) {
    value.schemaVersion = GAME_SCHEMA_VERSION;
    value.config = {
      nightDeathLastWords: true,
      firstNightSelfSave: true,
      revealOnDeath: false,
      ...(isRecord(value.config) ? value.config : {}),
    };
    if (isRecord(value.currentNight) && !Array.isArray(value.currentNight.deaths))
      value.currentNight.deaths = [];
    if (!Array.isArray(value.runoffSeats)) value.runoffSeats = [];
  }

  requireValue(value.schemaVersion === GAME_SCHEMA_VERSION, '无法迁移存档版本');
  requireValue(typeof value.id === 'string' && /^[a-zA-Z0-9-]+$/.test(value.id), 'id 非法');
  requireValue(!expectedId || value.id === expectedId, '存档 ID 与文件名不一致');
  requireValue(typeof value.title === 'string', 'title 必须是字符串');
  requireValue(
    typeof value.createdAt === 'string' && typeof value.updatedAt === 'string',
    '时间字段非法',
  );
  requireValue(PHASES.includes(value.phase as (typeof PHASES)[number]), 'phase 非法');
  requireValue(Number.isInteger(value.day) && Number(value.day) >= 0, 'day 非法');
  requireValue(typeof value.started === 'boolean', 'started 必须是布尔值');
  requireValue(Array.isArray(value.players) && value.players.length >= 5, 'players 至少需要 5 项');

  const ids = new Set<string>(),
    seats = new Set<number>();
  for (const player of value.players) {
    requireValue(isRecord(player), 'player 必须是对象');
    requireValue(typeof player.id === 'string' && Boolean(player.id), 'player.id 非法');
    requireValue(
      Number.isInteger(player.seat) && Number(player.seat) > 0 && !seats.has(Number(player.seat)),
      'player.seat 非法或重复',
    );
    requireValue(!ids.has(player.id), 'player.id 重复');
    requireValue(
      typeof player.name === 'string' && typeof player.modelLabel === 'string',
      '玩家名称或模型标签非法',
    );
    requireValue(ROLES.includes(player.role as (typeof ROLES)[number]), '玩家身份非法');
    requireValue(typeof player.alive === 'boolean', 'player.alive 必须是布尔值');
    ids.add(player.id);
    seats.add(Number(player.seat));
  }

  requireValue(isRecord(value.config), 'config 非法');
  requireValue(
    ['nightDeathLastWords', 'firstNightSelfSave', 'revealOnDeath'].every(
      (key) => typeof (value.config as RecordValue)[key] === 'boolean',
    ),
    'config 非法',
  );
  requireValue(
    isRecord(value.witch) &&
      typeof value.witch.antidoteAvailable === 'boolean' &&
      typeof value.witch.poisonAvailable === 'boolean',
    'witch 非法',
  );
  requireValue(
    isRecord(value.currentNight) && Array.isArray(value.currentNight.deaths),
    'currentNight 非法',
  );
  for (const key of ['wolfTarget', 'poisonedSeat', 'savedSeat']) {
    const seat = value.currentNight[key];
    if (seat !== undefined && seat !== null)
      requireValue(Number.isInteger(seat) && seats.has(Number(seat)), `currentNight.${key} 非法`);
  }
  requireValue(
    value.currentNight.deaths.every((seat) => Number.isInteger(seat) && seats.has(Number(seat))),
    'currentNight.deaths 非法',
  );
  requireValue(
    Array.isArray(value.actions) &&
      Array.isArray(value.publicLog) &&
      Array.isArray(value.godLog) &&
      Array.isArray(value.runoffSeats),
    '行动或日志数组非法',
  );
  requireValue(
    value.runoffSeats.every((seat) => Number.isInteger(seat) && seats.has(Number(seat))),
    'runoffSeats 非法',
  );
  requireValue(isRecord(value.privateLogs), 'privateLogs 非法');
  const validateLogs = (logs: unknown[], label: string) => {
    for (const log of logs) {
      requireValue(isRecord(log), `${label} 日志项非法`);
      requireValue(
        typeof log.id === 'string' &&
          typeof log.timestamp === 'string' &&
          Number.isInteger(log.day) &&
          PHASES.includes(log.phase as (typeof PHASES)[number]) &&
          typeof log.message === 'string',
        `${label} 日志项非法`,
      );
    }
  };
  validateLogs(value.publicLog, 'publicLog');
  validateLogs(value.godLog, 'godLog');
  for (const id of ids) {
    requireValue(Array.isArray(value.privateLogs[id]), `缺少玩家 ${id} 的私人日志`);
    validateLogs(value.privateLogs[id], `privateLogs.${id}`);
  }
  for (const record of value.actions) {
    requireValue(
      isRecord(record) && ids.has(String(record.playerId)) && isRecord(record.action),
      '行动记录非法',
    );
    requireValue(
      ACTION_KINDS.includes(record.action.kind as (typeof ACTION_KINDS)[number]),
      '行动类型非法',
    );
    requireValue(
      typeof record.id === 'string' &&
        Number.isInteger(record.day) &&
        PHASES.includes(record.phase as (typeof PHASES)[number]) &&
        typeof record.raw === 'string' &&
        typeof record.timestamp === 'string' &&
        typeof record.action.matched === 'string',
      '行动记录字段非法',
    );
    if (record.action.targetSeat !== undefined)
      requireValue(
        Number.isInteger(record.action.targetSeat) && seats.has(Number(record.action.targetSeat)),
        '行动目标座位非法',
      );
  }
  if (value.pendingHunterId !== undefined)
    requireValue(
      typeof value.pendingHunterId === 'string' && ids.has(value.pendingHunterId),
      'pendingHunterId 非法',
    );
  if (value.winner !== undefined)
    requireValue(value.winner === 'good' || value.winner === 'wolves', 'winner 非法');
  if (value.phase === 'ended')
    requireValue(value.winner === 'good' || value.winner === 'wolves', '已结束对局必须包含 winner');
  return value as unknown as GameState;
}
