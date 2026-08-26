import { describe, expect, it } from 'vitest';
import { advanceGame, submitAction } from '../src/game/engine';
import type { ParsedAction } from '../src/shared/types';
import { gameAt } from './helpers';

const action = (kind: ParsedAction['kind'], targetSeat?: number, extra: Partial<ParsedAction> = {}): ParsedAction => ({ kind, targetSeat, matched: kind, ...extra });

describe('完整对局流程', () => {
  it('走完两夜、发言、投票、查验和用毒后正确判定好人胜利', () => {
    const game = gameAt('setup');
    game.config.nightDeathLastWords = false;
    advanceGame(game);
    const [wolf1, wolf2] = game.players.filter((player) => player.role === 'wolf');
    const seer = game.players.find((player) => player.role === 'seer')!;
    const witch = game.players.find((player) => player.role === 'witch')!;

    submitAction(game, wolf1.id, action('kill', 6));
    submitAction(game, wolf2.id, action('kill', 6));
    advanceGame(game);
    submitAction(game, seer.id, action('inspect', 1));
    advanceGame(game);
    submitAction(game, witch.id, action('no_medicine'));
    advanceGame(game);
    advanceGame(game);
    expect(game.phase).toBe('day_speech');
    expect(game.players.find((player) => player.seat === 6)?.alive).toBe(false);

    game.players.filter((player) => player.alive).forEach((player) =>
      submitAction(game, player.id, action('speech', undefined, { text: `${player.seat}号发言` })),
    );
    advanceGame(game);
    game.players.filter((player) => player.alive).forEach((player) =>
      submitAction(game, player.id, action('vote', player.seat === 1 ? 2 : 1)),
    );
    advanceGame(game);
    expect(game.phase).toBe('night_wolf');
    expect(game.day).toBe(2);
    expect(wolf1.alive).toBe(false);

    submitAction(game, wolf2.id, action('kill', 7));
    advanceGame(game);
    submitAction(game, seer.id, action('inspect', 2));
    advanceGame(game);
    submitAction(game, witch.id, action('poison', 2));
    advanceGame(game);
    advanceGame(game);

    expect(game.phase).toBe('ended');
    expect(game.winner).toBe('good');
    expect(wolf2.deathCause).toBe('poison');
    expect(game.actions).toHaveLength(19);
  });
});
