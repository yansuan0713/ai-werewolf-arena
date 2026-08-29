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
import { fullMarkdown, publicMarkdown } from '../src/game/reports.js';
import {
  advanceCollarGame,
  collarFullReport,
  collarPendingPlayerIds,
  collarPublicReport,
  createCollarGame,
  confirmCollarBriefing,
  generateCollarPrompt,
  submitCollarAction,
} from '../src/game/collar-engine.js';
import { parseCollarReply } from '../src/game/collar-parser.js';
import { collarFullMarkdown, collarPublicMarkdown } from '../src/game/collar-reports.js';
import { isCollarGame, type CollarGameState } from '../src/shared/collar-types.js';
import type { AnyGameState } from '../src/shared/game-types.js';
import type { GameState } from '../src/shared/types.js';
import { cloneAnyImportedGame } from './import-game.js';
import { GameStore } from './store.js';
import {
  validateActionBody,
  validateAdvanceBody,
  validateCollarActionBody,
  validateCreateCollarGameInput,
  validateCreateGameInput,
  validateParseBody,
} from './validation.js';

export type GameView = GameState & { pendingPlayerIds: string[]; canUndo: boolean };
export type CollarGameView = CollarGameState & {
  pendingPlayerIds: string[];
  canUndo: boolean;
};
export type AnyGameView = GameView | CollarGameView;

export function toGameView(game: GameState, canUndo = false): GameView {
  return { ...game, pendingPlayerIds: pendingPlayerIds(game), canUndo };
}

export function toCollarGameView(game: CollarGameState, canUndo = false): CollarGameView {
  return { ...game, pendingPlayerIds: collarPendingPlayerIds(game), canUndo };
}

export function toAnyGameView(game: AnyGameState, canUndo = false): AnyGameView {
  return isCollarGame(game) ? toCollarGameView(game, canUndo) : toGameView(game, canUndo);
}

const asWerewolf = (game: AnyGameState): GameState => {
  if (isCollarGame(game)) throw new Error('该接口不适用于爆炸项圈模式');
  return game;
};
const asCollar = (game: AnyGameState): CollarGameState => {
  if (!isCollarGame(game)) throw new Error('该接口仅适用于爆炸项圈模式');
  return game;
};

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
  app.use(express.json({ limit: '5mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get(
    '/api/games',
    asyncRoute(async (_req, res) => {
      const games = await store.list();
      res.json(
        await Promise.all(
          games.map(async (game) => toAnyGameView(game, await store.canUndo(game.id))),
        ),
      );
    }),
  );
  app.post(
    '/api/games',
    asyncRoute(async (req, res) => {
      const game = await store.save(createGame(validateCreateGameInput(req.body)));
      res.status(201).json(toGameView(asWerewolf(game)));
    }),
  );
  app.post(
    '/api/collar-games',
    asyncRoute(async (req, res) => {
      const game = await store.save(createCollarGame(validateCreateCollarGameInput(req.body)));
      res.status(201).json(toCollarGameView(asCollar(game)));
    }),
  );
  app.post(
    '/api/games/import',
    asyncRoute(async (req, res) => {
      const game = await store.save(cloneAnyImportedGame(req.body));
      res.status(201).json(toAnyGameView(game));
    }),
  );
  app.get(
    '/api/games/:id',
    asyncRoute(async (req, res) => {
      const id = param(req.params.id);
      res.json(toAnyGameView(await store.get(id), await store.canUndo(id)));
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
      const game = asWerewolf(await store.get(param(req.params.id)));
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
    '/api/collar-games/:id/prompt/:playerId',
    asyncRoute(async (req, res) => {
      const playerId = param(req.params.playerId);
      const game = asCollar(await store.get(param(req.params.id)));
      const prompt = generateCollarPrompt(game, playerId);
      game.privateLogs[playerId].push({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        turn: game.turn,
        phase: game.phase,
        message: `已生成 ${game.phase} 阶段提示词`,
      });
      await store.save(game);
      res.json({ prompt });
    }),
  );
  app.post(
    '/api/collar-games/:id/briefings/:playerId/confirm',
    asyncRoute(async (req, res) => {
      const game = asCollar(await store.get(param(req.params.id)));
      const next = confirmCollarBriefing(structuredClone(game), param(req.params.playerId));
      const saved = asCollar(await store.save(next, { undo: game }));
      res.json(toCollarGameView(saved, true));
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
    '/api/collar-parse',
    asyncRoute(async (req, res) => {
      const { raw, loose } = validateParseBody(req.body);
      res.json({ actions: parseCollarReply(raw, { loose }) });
    }),
  );
  app.post(
    '/api/games/:id/actions',
    asyncRoute(async (req, res) => {
      const game = asWerewolf(await store.get(param(req.params.id)));
      const { playerId, action, raw } = validateActionBody(req.body);
      const next = submitAction(structuredClone(game), playerId, action, raw);
      const saved = asWerewolf(await store.save(next, { undo: game }));
      res.json(toGameView(saved, true));
    }),
  );
  app.post(
    '/api/collar-games/:id/actions',
    asyncRoute(async (req, res) => {
      const game = asCollar(await store.get(param(req.params.id)));
      const { playerId, action, raw } = validateCollarActionBody(req.body);
      const next = submitCollarAction(structuredClone(game), playerId, action, raw);
      const saved = asCollar(await store.save(next, { undo: game }));
      res.json(toCollarGameView(saved, true));
    }),
  );
  app.post(
    '/api/games/:id/advance',
    asyncRoute(async (req, res) => {
      const game = asWerewolf(await store.get(param(req.params.id)));
      const next = advanceGame(structuredClone(game), validateAdvanceBody(req.body));
      res.json(toGameView(asWerewolf(await store.save(next, { undo: game })), true));
    }),
  );
  app.post(
    '/api/collar-games/:id/advance',
    asyncRoute(async (req, res) => {
      const game = asCollar(await store.get(param(req.params.id)));
      const next = advanceCollarGame(structuredClone(game));
      const saved = asCollar(await store.save(next, { undo: game }));
      res.json(toCollarGameView(saved, true));
    }),
  );
  app.post(
    '/api/games/:id/undo',
    asyncRoute(async (req, res) => {
      const restored = await store.undo(param(req.params.id));
      res.json(toAnyGameView(restored, false));
    }),
  );
  app.get(
    '/api/games/:id/export/public',
    asyncRoute(async (req, res) => {
      const game = await store.get(param(req.params.id));
      res.setHeader('Content-Disposition', `attachment; filename="${game.id}-public.json"`);
      res.json(isCollarGame(game) ? collarPublicReport(game) : publicReport(game));
    }),
  );
  app.get(
    '/api/games/:id/export/full',
    asyncRoute(async (req, res) => {
      const game = await store.get(param(req.params.id));
      res.setHeader('Content-Disposition', `attachment; filename="${game.id}-full.json"`);
      res.json(isCollarGame(game) ? collarFullReport(game) : fullReport(game));
    }),
  );
  app.get(
    '/api/games/:id/export/save',
    asyncRoute(async (req, res) => {
      const game = await store.get(param(req.params.id));
      res.setHeader('Content-Disposition', `attachment; filename="${game.id}-save.json"`);
      res.json(game);
    }),
  );
  app.get(
    '/api/games/:id/export/public.md',
    asyncRoute(async (req, res) => {
      const game = await store.get(param(req.params.id));
      res
        .type('text/markdown')
        .setHeader('Content-Disposition', `attachment; filename="${game.id}-public.md"`);
      res.send(isCollarGame(game) ? collarPublicMarkdown(game) : publicMarkdown(game));
    }),
  );
  app.get(
    '/api/games/:id/export/full.md',
    asyncRoute(async (req, res) => {
      const game = await store.get(param(req.params.id));
      res
        .type('text/markdown')
        .setHeader('Content-Disposition', `attachment; filename="${game.id}-full.md"`);
      res.send(isCollarGame(game) ? collarFullMarkdown(game) : fullMarkdown(game));
    }),
  );

  if (staticDir) {
    app.use(express.static(staticDir));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }
  return app;
}
