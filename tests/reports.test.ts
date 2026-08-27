import { describe, expect, it } from 'vitest';
import { fullMarkdown, publicMarkdown } from '../src/game/reports';
import { gameAt } from './helpers';

describe('Markdown 战报', () => {
  it('进行中的公开战报不泄露身份、夜间行动或私人查验', () => {
    const game = gameAt('day_speech'),
      seer = game.players.find((player) => player.role === 'seer')!,
      wolf = game.players.find((player) => player.role === 'wolf')!;
    game.actions.push({
      id: 'secret',
      day: 1,
      phase: 'night_seer',
      playerId: seer.id,
      action: { kind: 'inspect', targetSeat: wolf.seat, matched: `【查验：${wolf.seat}号】` },
      raw: '私人分析',
      timestamp: new Date().toISOString(),
      result: `${wolf.seat}号是狼人`,
    });
    game.publicLog.push({
      id: 'html',
      day: 1,
      phase: 'day_speech',
      timestamp: new Date().toISOString(),
      message: '<script>alert(1)</script>',
    });
    const report = publicMarkdown(game);
    expect(report).not.toContain('私人分析');
    expect(report).not.toContain('查验');
    expect(report).not.toContain(`${wolf.seat}号是狼人`);
    expect(report).not.toContain('| 狼人 |');
    expect(report).not.toContain('<script>');
    expect(report).toContain('&lt;script&gt;');
  });
  it('完整复盘仅在结束后生成并包含身份与行动', () => {
    const game = gameAt('day_speech');
    expect(() => fullMarkdown(game)).toThrow('游戏结束后');
    game.phase = 'ended';
    game.winner = 'good';
    game.winReason = '所有狼人均已死亡';
    game.actions.push({
      id: 'vote',
      day: 1,
      phase: 'day_vote',
      playerId: game.players[2].id,
      action: { kind: 'vote', targetSeat: 1, matched: '【投票：1号】' },
      raw: '分析后投票',
      timestamp: new Date().toISOString(),
    });
    const report = fullMarkdown(game);
    expect(report).toContain('| 狼人 |');
    expect(report).toContain('【投票：1号】');
    expect(report).toContain('分析后投票');
  });
});
