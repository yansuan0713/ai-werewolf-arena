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
import type { GameState } from '../src/shared/types.js';
import { GameStore } from './store.js';
import { validateActionBody, validateAdvanceBody, validateCreateGameInput, validateParseBody } from './validation.js';

export type GameView = GameState & { pendingPlayerIds: string[]; canUndo: boolean };

export function toGameView(game: GameState, canUndo = false): GameView {
  return { ...game, pendingPlayerIds: pendingPlayerIds(game), canUndo };
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
    asyncRoute(async (_req, res) => {
      const games = await store.list();
      res.json(await Promise.all(games.map(async game => toGameView(game, await store.canUndo(game.id)))));
    }),
  );
  app.post(
    '/api/games',
    asyncRoute(async (req, res) => {
      const game = await store.save(createGame(validateCreateGameInput(req.body)));
      res.status(201).json(toGameView(game));
    }),
  );
  app.get(
    '/api/games/:id',
    asyncRoute(async (req, res) => {
      const id = param(req.params.id);
      res.json(toGameView(await store.get(id), await store.canUndo(id)));
    }),
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
    asyncRoute(async (req, res) => {
      const { raw, loose } = validateParseBody(req.body);
      res.json({ actions: parseReply(raw, { loose }) });
    }),
  );
  app.post(
    '/api/games/:id/actions',
    asyncRoute(async (req, res) => {
      const game = await store.get(param(req.params.id));
      const { playerId, action, raw } = validateActionBody(req.body);
      const next = submitAction(structuredClone(game), playerId, action, raw);
      const saved = await store.save(next, { undo: game });
      res.json(toGameView(saved, true));
    }),
  );
  app.post(
    '/api/games/:id/advance',
    asyncRoute(async (req, res) => {
      const game = await store.get(param(req.params.id));
      const next = advanceGame(structuredClone(game), validateAdvanceBody(req.body));
      res.json(toGameView(await store.save(next, { undo: game }), true));
    }),
  );
  app.post(
    '/api/games/:id/undo',
    asyncRoute(async (req, res) => {
      const restored = await store.undo(param(req.params.id));
      res.json(toGameView(restored, false));
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
