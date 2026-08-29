export const COLLAR_MODE = 'exploding_collar' as const;
export const COLLAR_SCHEMA_VERSION = 1;
export const WIRES = ['red', 'blue', 'yellow'] as const;
export type Wire = (typeof WIRES)[number];
export const WIRE_NAMES: Record<Wire, string> = {
  red: '红线',
  blue: '蓝线',
  yellow: '黄线',
};

export const COLLAR_PHASES = [
  'setup',
  'opening_speech',
  'turn_speech',
  'cut',
  'defense',
  'resolution',
  'ended',
] as const;
export type CollarPhase = (typeof COLLAR_PHASES)[number];
export const COLLAR_PHASE_NAMES: Record<CollarPhase, string> = {
  setup: '入场确认',
  opening_speech: '开场陈述',
  turn_speech: '操作者发言',
  cut: '选择剪线',
  defense: '目标应对',
  resolution: '公开结算',
  ended: '游戏结束',
};

export const COLLAR_ACTION_KINDS = [
  'collar_speech',
  'cut_wire',
  'use_insurance',
  'accept_cut',
] as const;
export type CollarActionKind = (typeof COLLAR_ACTION_KINDS)[number];

export interface CollarIntel {
  targetPlayerId: string;
  safeWire: Wire;
}

export interface CollarPlayer {
  id: string;
  seat: number;
  name: string;
  modelLabel: string;
  alive: boolean;
  lethalWire: Wire;
  safeWireHint: Wire;
  intel: CollarIntel;
  insuranceAvailable: boolean;
  cutWires: Wire[];
  deathTurn?: number;
}

export interface CollarParsedAction {
  kind: CollarActionKind;
  targetSeat?: number;
  wire?: Wire;
  text?: string;
  matched: string;
}

export interface CollarActionRecord {
  id: string;
  turn: number;
  phase: CollarPhase;
  playerId: string;
  action: CollarParsedAction;
  raw: string;
  timestamp: string;
  result?: string;
}

export interface CollarLogEntry {
  id: string;
  timestamp: string;
  turn: number;
  phase: CollarPhase;
  message: string;
}

export interface PendingCut {
  operatorId: string;
  targetId: string;
  wire: Wire;
}

export interface CollarGameConfig {
  insuranceEnabled: boolean;
}

export interface CollarGameState {
  mode: typeof COLLAR_MODE;
  schemaVersion: number;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  phase: CollarPhase;
  turn: number;
  started: boolean;
  players: CollarPlayer[];
  briefedPlayerIds: string[];
  config: CollarGameConfig;
  currentOperatorId?: string;
  pendingCut?: PendingCut;
  actions: CollarActionRecord[];
  publicLog: CollarLogEntry[];
  privateLogs: Record<string, CollarLogEntry[]>;
  godLog: CollarLogEntry[];
  winnerPlayerId?: string;
  winReason?: string;
}

export interface CollarPlayerDraft {
  name: string;
  modelLabel: string;
}

export interface CreateCollarGameInput {
  title?: string;
  players: CollarPlayerDraft[];
  config?: Partial<CollarGameConfig>;
}

export const isCollarGame = (game: unknown): game is CollarGameState =>
  typeof game === 'object' &&
  game !== null &&
  'mode' in game &&
  (game as { mode?: unknown }).mode === COLLAR_MODE;
