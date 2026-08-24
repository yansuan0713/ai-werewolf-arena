import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import {
  advanceGame,
  createGame,
  fullReport,
  generatePrompt,
  pendingPlayerIds,
  publicReport,
  submitAction,
} from '../src/game/engine.js';
import { parseReply } from '../src/game/parser.js';
import type { CreateGameInput, GameState, ParsedAction } from '../src/shared/types.js';
import { GameStore } from './store.js';

export type GameView = GameState & { pendingPlayerIds: string[] };

export function toGameView(game: GameState): GameView {
  return { ...game, pendingPlayerIds: pendingPlayerIds(game) };
}

const param = (value: string | string[]) => (Array.isArray(value) ? value[0] : value);
const asyncRoute =
  (fn: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response) => {
    fn(req, res).catch((error: unknown) =>
      res.status(400).json({ error: error instanceof Error ? error.message : '未知错误' }),
    );
  };

export function createApp(store = new GameStore(), staticDir?: string) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get(
    '/api/games',
    asyncRoute(async (_req, res) => res.json((await store.list()).map(toGameView))),
  );
  app.post(
    '/api/games',
    asyncRoute(async (req, res) => {
      const game = await store.save(createGame(req.body as CreateGameInput));
      res.status(201).json(toGameView(game));
    }),
  );
  app.get(
    '/api/games/:id',
    asyncRoute(async (req, res) => res.json(toGameView(await store.get(param(req.params.id))))),
  );
  app.delete(
    '/api/games/:id',
    asyncRoute(async (req, res) => {
      await store.delete(param(req.params.id));
      res.status(204).end();
    }),
  );
  app.post(
    '/api/games/:id/prompt/:playerId',
    asyncRoute(async (req, res) => {
      const playerId = param(req.params.playerId);
      const game = await store.get(param(req.params.id));
      const prompt = generatePrompt(game, playerId);
      game.privateLogs[playerId].push({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        day: game.day,
        phase: game.phase,
        message: `已生成 ${game.phase} 阶段提示词`,
      });
      await store.save(game);
      res.json({ prompt });
    }),
  );
  app.post(
    '/api/parse',
    asyncRoute(async (req, res) =>
      res.json({ actions: parseReply(String(req.body.raw || '')) }),
    ),
  );
  app.post(
    '/api/games/:id/actions',
    asyncRoute(async (req, res) => {
      const game = await store.get(param(req.params.id));
      const saved = await store.save(
        submitAction(
          game,
          String(req.body.playerId),
          req.body.action as ParsedAction,
          String(req.body.raw || ''),
        ),
      );
      res.json(toGameView(saved));
    }),
  );
  app.post(
    '/api/games/:id/advance',
    asyncRoute(async (req, res) => {
      const game = await store.get(param(req.params.id));
      res.json(toGameView(await store.save(advanceGame(game, req.body || {}))));
    }),
  );
  app.get(
    '/api/games/:id/export/public',
    asyncRoute(async (req, res) => {
      const game = await store.get(param(req.params.id));
      res.setHeader('Content-Disposition', `attachment; filename="${game.id}-public.json"`);
      res.json(publicReport(game));
    }),
  );
  app.get(
    '/api/games/:id/export/full',
    asyncRoute(async (req, res) => {
      const game = await store.get(param(req.params.id));
      res.setHeader('Content-Disposition', `attachment; filename="${game.id}-full.json"`);
      res.json(fullReport(game));
    }),
  );

  if (staticDir) {
    app.use(express.static(staticDir));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }
  return app;
}
