import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type GameView } from '../server/app';
import { GameStore } from '../server/store';
import type { CreateGameInput } from '../src/shared/types';

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true }))));

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  expect(response.ok).toBe(true);
  return response.json() as Promise<T>;
}

describe('GameView API', () => {
  it('两狼局提交第一名狼人后，响应仍将另一名狼人标为 pending', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'werewolf-api-'));
    dirs.push(dir);
    const server = createApp(new GameStore(dir)).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const input: CreateGameInput = {
        title: '接口回归测试',
        assignment: 'manual',
        players: ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager', 'villager'].map(
          (role, index) => ({
            name: `P${index + 1}`,
            modelLabel: 'test',
            role: role as CreateGameInput['players'][number]['role'],
          }),
        ),
      };
      const created = await json<GameView>(`${base}/api/games`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      expect(created.pendingPlayerIds).toHaveLength(7);
      expect(created.canUndo).toBe(false);

      const started = await json<GameView>(`${base}/api/games/${created.id}/advance`, {
        method: 'POST',
        body: '{}',
      });
      expect(started.canUndo).toBe(true);
      const wolves = started.players.filter((player) => player.role === 'wolf');
      expect(started.pendingPlayerIds).toEqual(wolves.map((player) => player.id));

      const afterFirstWolf = await json<GameView>(`${base}/api/games/${created.id}/actions`, {
        method: 'POST',
        body: JSON.stringify({
          playerId: wolves[0].id,
          raw: '【击杀：3号】',
          action: { kind: 'kill', targetSeat: 3, matched: '【击杀：3号】' },
        }),
      });
      expect(afterFirstWolf.pendingPlayerIds).toEqual([wolves[1].id]);
      expect(afterFirstWolf.canUndo).toBe(true);

      const undone = await json<GameView>(`${base}/api/games/${created.id}/undo`, {
        method: 'POST',
        body: '{}',
      });
      expect(undone.pendingPlayerIds).toEqual(wolves.map((player) => player.id));
      expect(undone.actions).toHaveLength(0);
      expect(undone.canUndo).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('拒绝非法 POST body 且不修改对局存档', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'werewolf-validation-'));
    dirs.push(dir);
    const store = new GameStore(dir);
    const server = createApp(store).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const send = (url: string, body: unknown) => fetch(`${base}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await send('/api/games', { assignment: 'manual', players: [] })).status).toBe(400);
      expect(await store.list()).toHaveLength(0);
      const input: CreateGameInput = {
        assignment: 'manual',
        players: ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager', 'villager'].map((role, index) => ({ name: `P${index + 1}`, modelLabel: 'test', role: role as CreateGameInput['players'][number]['role'] })),
      };
      const created = await json<GameView>(`${base}/api/games`, { method: 'POST', body: JSON.stringify(input) });
      const started = await json<GameView>(`${base}/api/games/${created.id}/advance`, { method: 'POST', body: '{}' });
      const wolf = started.players.find((player) => player.role === 'wolf')!;
      expect((await send(`/api/games/${created.id}/actions`, { playerId: wolf.id, raw: 'hack', action: { kind: 'hack', matched: 'hack' } })).status).toBe(400);
      expect((await send(`/api/games/${created.id}/actions`, { playerId: wolf.id, raw: '【击杀：0号】', action: { kind: 'kill', targetSeat: 0, matched: '【击杀：0号】' } })).status).toBe(400);
      expect((await send(`/api/games/${created.id}/advance`, { wolfResolution: -1 })).status).toBe(400);
      expect((await send('/api/parse', { raw: 42 })).status).toBe(400);
      expect((await store.get(created.id)).actions).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });
});
