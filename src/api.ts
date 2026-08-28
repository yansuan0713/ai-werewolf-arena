import type {
  CollarGameState,
  CollarParsedAction,
  CreateCollarGameInput,
} from './shared/collar-types';
import type { CreateGameInput, GameState, ParsedAction } from './shared/types';

type ViewFields = { pendingPlayerIds: string[]; canUndo: boolean };
export type GameView = GameState & ViewFields;
export type CollarGameView = CollarGameState & ViewFields;
export type AnyGameView = GameView | CollarGameView;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `请求失败 (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const api = {
  list: () => request<AnyGameView[]>('/api/games'),
  get: (id: string) => request<AnyGameView>(`/api/games/${id}`),
  create: (data: CreateGameInput) =>
    request<GameView>('/api/games', { method: 'POST', body: JSON.stringify(data) }),
  createCollar: (data: CreateCollarGameInput) =>
    request<CollarGameView>('/api/collar-games', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  importSave: (data: unknown) =>
    request<AnyGameView>('/api/games/import', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/api/games/${id}`, { method: 'DELETE' }),
  prompt: (id: string, playerId: string) =>
    request<{ prompt: string }>(`/api/games/${id}/prompt/${playerId}`, { method: 'POST' }),
  collarPrompt: (id: string, playerId: string) =>
    request<{ prompt: string }>(`/api/collar-games/${id}/prompt/${playerId}`, {
      method: 'POST',
    }),
  parse: (raw: string, loose = false) =>
    request<{ actions: ParsedAction[] }>('/api/parse', {
      method: 'POST',
      body: JSON.stringify({ raw, loose }),
    }),
  parseCollar: (raw: string) =>
    request<{ actions: CollarParsedAction[] }>('/api/collar-parse', {
      method: 'POST',
      body: JSON.stringify({ raw }),
    }),
  submit: (id: string, playerId: string, action: ParsedAction, raw: string) =>
    request<GameView>(`/api/games/${id}/actions`, {
      method: 'POST',
      body: JSON.stringify({ playerId, action, raw }),
    }),
  submitCollar: (id: string, playerId: string, action: CollarParsedAction, raw: string) =>
    request<CollarGameView>(`/api/collar-games/${id}/actions`, {
      method: 'POST',
      body: JSON.stringify({ playerId, action, raw }),
    }),
  advance: (id: string, options: object = {}) =>
    request<GameView>(`/api/games/${id}/advance`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),
  advanceCollar: (id: string) =>
    request<CollarGameView>(`/api/collar-games/${id}/advance`, {
      method: 'POST',
      body: '{}',
    }),
  undo: (id: string) =>
    request<AnyGameView>(`/api/games/${id}/undo`, { method: 'POST', body: '{}' }),
};
