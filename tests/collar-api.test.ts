import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type CollarGameView } from '../server/app';
import { GameStore } from '../server/store';

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

describe('爆炸项圈 API', () => {
  it('创建、推进、生成私密 Prompt、提交行动并恢复存档', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'collar-api-'));
    dirs.push(dir);
    const store = new GameStore(dir);
    const server = createApp(store).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const created = await json<CollarGameView>(`${base}/api/collar-games`, {
        method: 'POST',
        body: JSON.stringify({
          title: '接口项圈局',
          players: Array.from({ length: 4 }, (_, index) => ({
            name: `P${index + 1}`,
            modelLabel: 'test',
          })),
        }),
      });
      expect(created.mode).toBe('exploding_collar');
      expect(created.pendingPlayerIds).toHaveLength(4);

      const opening = await json<CollarGameView>(`${base}/api/collar-games/${created.id}/advance`, {
        method: 'POST',
        body: '{}',
      });
      expect(opening.phase).toBe('opening_speech');
      expect(opening.pendingPlayerIds).toHaveLength(4);

      const promptResponse = await fetch(
        `${base}/api/collar-games/${created.id}/prompt/${opening.players[0].id}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      );
      const prompt = (await promptResponse.json()).prompt as string;
      expect(prompt).toContain('你的项圈已确认安全线');
      expect(prompt).not.toContain('完整主持状态');

      const afterSpeech = await json<CollarGameView>(
        `${base}/api/collar-games/${created.id}/actions`,
        {
          method: 'POST',
          body: JSON.stringify({
            playerId: opening.players[0].id,
            raw: '【公开发言】先听大家的线索',
            action: {
              kind: 'collar_speech',
              text: '先听大家的线索',
              matched: '【公开发言】先听大家的线索',
            },
          }),
        },
      );
      expect(afterSpeech.pendingPlayerIds).toHaveLength(3);
      expect(afterSpeech.publicLog.at(-1)?.message).toContain('先听大家的线索');

      const restored = await store.get(created.id);
      expect(restored.mode).toBe('exploding_collar');
      expect(restored.actions).toHaveLength(1);

      const publicReport = await fetch(`${base}/api/games/${created.id}/export/public`);
      const publicText = await publicReport.text();
      expect(publicText).not.toContain('lethalWire');
      expect(publicText).not.toContain('safeWireHint');

      const save = await (await fetch(`${base}/api/games/${created.id}/export/save`)).json();
      const imported = await json<CollarGameView>(`${base}/api/games/import`, {
        method: 'POST',
        body: JSON.stringify(save),
      });
      expect(imported.id).not.toBe(created.id);
      expect(imported.mode).toBe('exploding_collar');
      expect(imported.players.map((player) => player.id)).not.toEqual(
        created.players.map((player) => player.id),
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('拒绝非法建局和非法剪线 body', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'collar-validation-'));
    dirs.push(dir);
    const server = createApp(new GameStore(dir)).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const badCreate = await fetch(`${base}/api/collar-games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: [] }),
      });
      expect(badCreate.status).toBe(400);
      const badParse = await fetch(`${base}/api/collar-parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: 7 }),
      });
      expect(badParse.status).toBe(400);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
