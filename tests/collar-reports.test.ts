import { describe, expect, it } from 'vitest';
import { createCollarGame } from '../src/game/collar-engine';
import { collarFullMarkdown, collarPublicMarkdown } from '../src/game/collar-reports';

const create = () =>
  createCollarGame({
    players: Array.from({ length: 4 }, (_, index) => ({
      name: `P${index + 1}`,
      modelLabel: `M${index + 1}`,
    })),
  });

describe('爆炸项圈战报', () => {
  it('进行中的公开战报不泄露致命线和私人扫描', () => {
    const game = create();
    const report = collarPublicMarkdown(game);
    expect(report).not.toContain('自身安全提示');
    expect(report).not.toContain('私人扫描');
    expect(report).not.toContain('项圈与私人线索');
    expect(report).toContain('本战报不包含致命线');
  });

  it('完整复盘仅在结束后开放并包含所有线路', () => {
    const game = create();
    expect(() => collarFullMarkdown(game)).toThrow('游戏结束后');
    game.players.slice(1).forEach((player) => {
      player.alive = false;
      player.deathTurn = 1;
    });
    game.phase = 'ended';
    game.winnerPlayerId = game.players[0].id;
    game.winReason = '最后幸存者';
    const report = collarFullMarkdown(game);
    expect(report).toContain('致命线');
    expect(report).toContain('自身安全提示');
    expect(report).toContain('私人扫描');
  });
});
