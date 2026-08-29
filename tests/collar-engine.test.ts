import { describe, expect, it } from 'vitest';
import {
  advanceCollarGame,
  confirmCollarBriefing,
  createCollarGame,
  generateCollarPrompt,
  submitCollarAction,
} from '../src/game/collar-engine';
import type { CollarGameState, CollarParsedAction, Wire } from '../src/shared/collar-types';

const create = () =>
  createCollarGame({
    title: '测试项圈局',
    players: Array.from({ length: 4 }, (_, index) => ({
      name: `P${index + 1}`,
      modelLabel: `M${index + 1}`,
    })),
  });
const action = (
  kind: CollarParsedAction['kind'],
  extra: Partial<CollarParsedAction> = {},
): CollarParsedAction => ({ kind, matched: kind, ...extra });
const speakAll = (game: CollarGameState) => {
  for (const player of game.players.filter((item) => item.alive))
    submitCollarAction(game, player.id, action('collar_speech', { text: `${player.seat}号发言` }));
};
const briefAll = (game: CollarGameState) => {
  for (const player of game.players.filter((item) => !game.briefedPlayerIds.includes(item.id)))
    confirmCollarBriefing(game, player.id);
};

describe('爆炸项圈规则引擎', () => {
  it('完整走完开场、轮流剪线并产生最后幸存者', () => {
    const game = create();
    game.players.forEach((player) => {
      player.lethalWire = 'red';
      player.safeWireHint = 'blue';
    });
    briefAll(game);
    advanceCollarGame(game);
    expect(game.phase).toBe('opening_speech');
    speakAll(game);
    advanceCollarGame(game);

    while (game.phase !== 'ended') {
      const operator = game.players.find((player) => player.id === game.currentOperatorId)!;
      submitCollarAction(game, operator.id, action('collar_speech', { text: '轮到我剪线' }));
      advanceCollarGame(game);
      const target = game.players.find((player) => player.alive && player.id !== operator.id)!;
      submitCollarAction(
        game,
        operator.id,
        action('cut_wire', { targetSeat: target.seat, wire: 'red' }),
      );
      advanceCollarGame(game);
      submitCollarAction(game, target.id, action('accept_cut'));
      advanceCollarGame(game);
      if (game.phase !== 'ended') advanceCollarGame(game);
    }

    expect(game.players.filter((player) => player.alive)).toHaveLength(1);
    expect(game.winnerPlayerId).toBe(game.players.find((player) => player.alive)?.id);
    expect(game.publicLog.filter((log) => log.message.includes('项圈爆炸'))).toHaveLength(3);
  });

  it('未逐席确认私人简报时禁止开局，并持久记录确认进度', () => {
    const game = create();
    confirmCollarBriefing(game, game.players[0].id);
    expect(game.briefedPlayerIds).toEqual([game.players[0].id]);
    expect(() => advanceCollarGame(game)).toThrow('仍有 3 名玩家未行动');
    briefAll(game);
    expect(game.briefedPlayerIds).toHaveLength(4);
    advanceCollarGame(game);
    expect(game.phase).toBe('opening_speech');
  });

  it('安全线被剪断后公开记录且不能重复剪', () => {
    const game = create();
    const [operator, target] = game.players;
    target.lethalWire = 'red';
    target.safeWireHint = 'blue';
    game.started = true;
    game.turn = 1;
    game.phase = 'cut';
    game.currentOperatorId = operator.id;
    submitCollarAction(
      game,
      operator.id,
      action('cut_wire', { targetSeat: target.seat, wire: 'blue' }),
    );
    advanceCollarGame(game);
    submitCollarAction(game, target.id, action('accept_cut'));
    advanceCollarGame(game);
    expect(target.alive).toBe(true);
    expect(target.cutWires).toEqual(['blue']);
    expect(game.publicLog.at(-1)?.message).toContain('线路安全');
    game.phase = 'cut';
    game.turn += 1;
    game.pendingCut = undefined;
    expect(() =>
      submitCollarAction(
        game,
        operator.id,
        action('cut_wire', { targetSeat: target.seat, wire: 'blue' }),
      ),
    ).toThrow('已经被剪断');
  });

  it('保险会阻止剪线并且只能使用一次', () => {
    const game = create();
    const [operator, target] = game.players;
    game.started = true;
    game.turn = 1;
    game.phase = 'defense';
    game.currentOperatorId = operator.id;
    game.pendingCut = { operatorId: operator.id, targetId: target.id, wire: 'red' };
    submitCollarAction(game, target.id, action('use_insurance'));
    advanceCollarGame(game);
    expect(target.insuranceAvailable).toBe(false);
    expect(target.cutWires).toEqual([]);
    expect(target.alive).toBe(true);
    game.phase = 'defense';
    game.turn += 1;
    expect(() => submitCollarAction(game, target.id, action('use_insurance'))).toThrow(
      '保险已经使用',
    );
  });

  it('拒绝自剪、无效线色和已淘汰玩家行动', () => {
    const game = create();
    const operator = game.players[0];
    game.started = true;
    game.turn = 1;
    game.phase = 'cut';
    game.currentOperatorId = operator.id;
    expect(() =>
      submitCollarAction(
        game,
        operator.id,
        action('cut_wire', { targetSeat: operator.seat, wire: 'red' }),
      ),
    ).toThrow('不能剪自己的项圈');
    expect(() =>
      submitCollarAction(
        game,
        operator.id,
        action('cut_wire', { targetSeat: 2, wire: 'purple' as Wire }),
      ),
    ).toThrow('有效线色');
    operator.alive = false;
    expect(() =>
      submitCollarAction(game, operator.id, action('cut_wire', { targetSeat: 2, wire: 'red' })),
    ).toThrow('已淘汰玩家不能行动');
  });

  it('玩家 Prompt 只包含本人的安全提示和私人扫描', () => {
    const game = create();
    const player = game.players[0];
    const other = game.players[2];
    player.safeWireHint = 'blue';
    player.lethalWire = 'red';
    player.intel = { targetPlayerId: game.players[1].id, safeWire: 'yellow' };
    other.lethalWire = 'yellow';
    const prompt = generateCollarPrompt(game, player.id);
    expect(prompt).toContain('你的项圈已确认安全线：蓝线');
    expect(prompt).toContain('2号 P2 的黄线已确认安全');
    expect(prompt).not.toContain('3号 P3 的致命线');
    expect(prompt).not.toContain('完整主持状态');
    expect(prompt).toContain('<public_game_content>');
  });
});
