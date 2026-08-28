import { describe, expect, it } from 'vitest';
import { parseCollarReply } from '../src/game/collar-parser';

describe('爆炸项圈回复解析', () => {
  it('解析剪线、保险、接受和发言格式', () => {
    expect(
      parseCollarReply(
        '**【剪线： 3号-红线】** 【使用保险】 【接受剪线】 【公开发言】我认为三号在撒谎',
      ),
    ).toMatchObject([
      { kind: 'cut_wire', targetSeat: 3, wire: 'red' },
      { kind: 'use_insurance' },
      { kind: 'accept_cut' },
      { kind: 'collar_speech', text: '我认为三号在撒谎' },
    ]);
  });

  it('不会把普通讨论误当作不可逆行动', () => {
    expect(parseCollarReply('我想剪 3 号红线，但还没决定。')).toEqual([]);
  });
});
