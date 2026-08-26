import { ACTION_KINDS, ROLES, type CreateGameInput, type ParsedAction } from '../src/shared/types.js';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function assertValid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`请求参数错误：${message}`);
}

function assertRecord(value: unknown, message: string): asserts value is UnknownRecord {
  assertValid(isRecord(value), message);
}

const hasOwn = (value: UnknownRecord, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const isPositiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

export function validateCreateGameInput(body: unknown): CreateGameInput {
  assertRecord(body, 'body 必须是对象');
  assertValid(body.assignment === 'random' || body.assignment === 'manual', 'assignment 必须是 random 或 manual');
  assertValid(Array.isArray(body.players) && body.players.length >= 5, 'players 必须是至少包含 5 项的数组');
  assertValid(!hasOwn(body, 'title') || typeof body.title === 'string', 'title 必须是字符串');

  body.players.forEach((player, index) => {
    assertRecord(player, `players[${index}] 必须是对象`);
    assertValid(typeof player.name === 'string', `players[${index}].name 必须是字符串`);
    assertValid(typeof player.modelLabel === 'string', `players[${index}].modelLabel 必须是字符串`);
    assertValid(!hasOwn(player, 'role') || ROLES.includes(player.role as (typeof ROLES)[number]), `players[${index}].role 非法`);
    assertValid(body.assignment !== 'manual' || ROLES.includes(player.role as (typeof ROLES)[number]), `手动分配时 players[${index}].role 必填`);
  });

  if (hasOwn(body, 'config')) {
    assertRecord(body.config, 'config 必须是对象');
    for (const key of ['nightDeathLastWords', 'firstNightSelfSave', 'revealOnDeath']) {
      assertValid(!hasOwn(body.config, key) || typeof body.config[key] === 'boolean', `config.${key} 必须是布尔值`);
    }
  }
  return body as unknown as CreateGameInput;
}

export function validateParseBody(body: unknown): { raw: string; loose: boolean } {
  assertRecord(body, 'body 必须是对象');
  assertValid(typeof body.raw === 'string', 'raw 必须是字符串');
  assertValid(!hasOwn(body, 'loose') || typeof body.loose === 'boolean', 'loose 必须是布尔值');
  return { raw: body.raw, loose: body.loose === true };
}

export function validateActionBody(body: unknown): { playerId: string; raw: string; action: ParsedAction } {
  assertRecord(body, 'body 必须是对象');
  assertValid(typeof body.playerId === 'string' && Boolean(body.playerId.trim()), 'playerId 必须是非空字符串');
  assertValid(typeof body.raw === 'string', 'raw 必须是字符串');
  assertRecord(body.action, 'action 必须是对象');
  assertValid(ACTION_KINDS.includes(body.action.kind as (typeof ACTION_KINDS)[number]), 'action.kind 非法');
  assertValid(typeof body.action.matched === 'string', 'action.matched 必须是字符串');
  assertValid(!hasOwn(body.action, 'targetSeat') || isPositiveInteger(body.action.targetSeat), 'action.targetSeat 必须是正整数');
  assertValid(!hasOwn(body.action, 'text') || typeof body.action.text === 'string', 'action.text 必须是字符串');
  assertValid(!hasOwn(body.action, 'abstain') || typeof body.action.abstain === 'boolean', 'action.abstain 必须是布尔值');

  const targetKinds = ['kill', 'inspect', 'antidote', 'poison', 'shoot'];
  assertValid(!targetKinds.includes(String(body.action.kind)) || isPositiveInteger(body.action.targetSeat), `${body.action.kind} 行动必须包含有效 targetSeat`);
  if (body.action.kind === 'vote') {
    const hasTarget = isPositiveInteger(body.action.targetSeat);
    const abstains = body.action.abstain === true;
    assertValid(hasTarget !== abstains, 'vote 行动必须在 targetSeat 和 abstain=true 中二选一');
  }
  return { playerId: body.playerId, raw: body.raw, action: body.action as unknown as ParsedAction };
}

export function validateAdvanceBody(body: unknown): { wolfResolution?: number | null } {
  if (body === undefined) return {};
  assertRecord(body, 'body 必须是对象');
  if (!hasOwn(body, 'wolfResolution')) return {};
  assertValid(body.wolfResolution === null || isPositiveInteger(body.wolfResolution), 'wolfResolution 必须是 null 或正整数');
  return { wolfResolution: body.wolfResolution as number | null };
}
