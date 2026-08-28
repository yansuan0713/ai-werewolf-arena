import {
  COLLAR_ACTION_KINDS,
  COLLAR_MODE,
  COLLAR_PHASES,
  COLLAR_SCHEMA_VERSION,
  WIRES,
  type CollarGameState,
} from '../shared/collar-types.js';

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const requireValue: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(`爆炸项圈存档格式错误：${message}`);
};

export function normalizeCollarGameState(input: unknown, expectedId?: string): CollarGameState {
  requireValue(isRecord(input), '根节点必须是对象');
  const value = structuredClone(input);
  requireValue(value.mode === COLLAR_MODE, 'mode 非法');
  requireValue(value.schemaVersion === COLLAR_SCHEMA_VERSION, 'schemaVersion 不受支持');
  requireValue(typeof value.id === 'string' && /^[a-zA-Z0-9-]+$/.test(value.id), 'id 非法');
  requireValue(!expectedId || value.id === expectedId, '存档 ID 与文件名不一致');
  requireValue(typeof value.title === 'string', 'title 必须是字符串');
  requireValue(
    typeof value.createdAt === 'string' && typeof value.updatedAt === 'string',
    '时间字段非法',
  );
  requireValue(COLLAR_PHASES.includes(value.phase as (typeof COLLAR_PHASES)[number]), 'phase 非法');
  requireValue(Number.isInteger(value.turn) && Number(value.turn) >= 0, 'turn 非法');
  requireValue(typeof value.started === 'boolean', 'started 非法');
  requireValue(
    Array.isArray(value.players) && value.players.length >= 4 && value.players.length <= 8,
    'players 必须包含 4 至 8 项',
  );

  const ids = new Set<string>();
  const seats = new Set<number>();
  for (const player of value.players) {
    requireValue(isRecord(player), 'player 必须是对象');
    requireValue(typeof player.id === 'string' && Boolean(player.id), 'player.id 非法');
    requireValue(!ids.has(player.id), 'player.id 重复');
    requireValue(
      Number.isInteger(player.seat) && Number(player.seat) > 0 && !seats.has(Number(player.seat)),
      'player.seat 非法或重复',
    );
    requireValue(
      typeof player.name === 'string' && typeof player.modelLabel === 'string',
      '玩家名称或模型标签非法',
    );
    requireValue(typeof player.alive === 'boolean', 'player.alive 非法');
    requireValue(WIRES.includes(player.lethalWire as (typeof WIRES)[number]), 'lethalWire 非法');
    requireValue(
      WIRES.includes(player.safeWireHint as (typeof WIRES)[number]) &&
        player.safeWireHint !== player.lethalWire,
      'safeWireHint 非法',
    );
    requireValue(typeof player.insuranceAvailable === 'boolean', 'insuranceAvailable 非法');
    requireValue(
      Array.isArray(player.cutWires) &&
        player.cutWires.every((wire) => WIRES.includes(wire as (typeof WIRES)[number])) &&
        new Set(player.cutWires).size === player.cutWires.length,
      'cutWires 非法',
    );
    requireValue(
      !player.alive || !player.cutWires.includes(player.lethalWire),
      '存活玩家不能已剪断致命线',
    );
    requireValue(isRecord(player.intel), 'intel 非法');
    ids.add(player.id);
    seats.add(Number(player.seat));
  }
  for (const player of value.players) {
    requireValue(
      ids.has(String(player.intel.targetPlayerId)) &&
        player.intel.targetPlayerId !== player.id &&
        WIRES.includes(player.intel.safeWire as (typeof WIRES)[number]),
      'intel 目标或线色非法',
    );
    const target = value.players.find((item) => item.id === player.intel.targetPlayerId);
    requireValue(target && player.intel.safeWire !== target.lethalWire, 'intel 不能指向致命线');
  }
  requireValue(
    isRecord(value.config) && typeof value.config.insuranceEnabled === 'boolean',
    'config 非法',
  );
  requireValue(
    Array.isArray(value.actions) && Array.isArray(value.publicLog) && Array.isArray(value.godLog),
    '行动或日志数组非法',
  );
  requireValue(isRecord(value.privateLogs), 'privateLogs 非法');
  for (const id of ids)
    requireValue(Array.isArray(value.privateLogs[id]), `缺少玩家 ${id} 私人日志`);
  for (const action of value.actions) {
    requireValue(
      isRecord(action) && isRecord(action.action) && ids.has(String(action.playerId)),
      '行动记录非法',
    );
    requireValue(
      COLLAR_ACTION_KINDS.includes(action.action.kind as (typeof COLLAR_ACTION_KINDS)[number]) &&
        typeof action.id === 'string' &&
        Number.isInteger(action.turn) &&
        COLLAR_PHASES.includes(action.phase as (typeof COLLAR_PHASES)[number]) &&
        typeof action.raw === 'string' &&
        typeof action.timestamp === 'string' &&
        typeof action.action.matched === 'string',
      '行动字段非法',
    );
    if (action.action.targetSeat !== undefined)
      requireValue(
        Number.isInteger(action.action.targetSeat) && seats.has(Number(action.action.targetSeat)),
        '行动目标座位非法',
      );
    if (action.action.wire !== undefined)
      requireValue(WIRES.includes(action.action.wire as (typeof WIRES)[number]), '行动线色非法');
    if (action.action.kind === 'cut_wire')
      requireValue(
        Number.isInteger(action.action.targetSeat) &&
          WIRES.includes(action.action.wire as (typeof WIRES)[number]),
        '剪线行动缺少目标或线色',
      );
  }
  const validateLogs = (logs: unknown[]) => {
    for (const log of logs)
      requireValue(
        isRecord(log) &&
          typeof log.id === 'string' &&
          typeof log.timestamp === 'string' &&
          Number.isInteger(log.turn) &&
          COLLAR_PHASES.includes(log.phase as (typeof COLLAR_PHASES)[number]) &&
          typeof log.message === 'string',
        '日志项非法',
      );
  };
  validateLogs(value.publicLog);
  validateLogs(value.godLog);
  for (const id of ids) validateLogs(value.privateLogs[id] as unknown[]);
  if (value.currentOperatorId !== undefined)
    requireValue(ids.has(String(value.currentOperatorId)), 'currentOperatorId 非法');
  if (value.pendingCut !== undefined) {
    requireValue(isRecord(value.pendingCut), 'pendingCut 非法');
    requireValue(
      ids.has(String(value.pendingCut.operatorId)) &&
        ids.has(String(value.pendingCut.targetId)) &&
        value.pendingCut.operatorId !== value.pendingCut.targetId &&
        WIRES.includes(value.pendingCut.wire as (typeof WIRES)[number]),
      'pendingCut 字段非法',
    );
  }
  if (value.winnerPlayerId !== undefined)
    requireValue(
      ids.has(String(value.winnerPlayerId)) &&
        value.players.find((player) => player.id === value.winnerPlayerId)?.alive === true,
      'winnerPlayerId 非法',
    );
  if (value.phase === 'ended') requireValue(Boolean(value.winnerPlayerId), '结束状态缺少胜者');
  return value as unknown as CollarGameState;
}
