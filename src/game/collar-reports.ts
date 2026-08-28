import { COLLAR_PHASE_NAMES, WIRE_NAMES, type CollarGameState } from '../shared/collar-types.js';

const md = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');

export function collarPublicMarkdown(game: CollarGameState): string {
  const winner = game.players.find((player) => player.id === game.winnerPlayerId);
  const lines = [
    `# ${md(game.title)}：公开战报`,
    '',
    '- 模式：爆炸项圈',
    `- 状态：${game.phase === 'ended' ? '已结束' : '进行中'}`,
    `- 当前：第 ${game.turn} 轮 / ${COLLAR_PHASE_NAMES[game.phase]}`,
    `- 胜者：${winner ? `${winner.seat}号 ${md(winner.name)}` : '尚未结束'}`,
    '',
    '## 玩家',
    '',
    '| 座位 | 玩家 | 模型标签 | 状态 | 已剪断线路 | 保险 |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const player of game.players)
    lines.push(
      `| ${player.seat} | ${md(player.name)} | ${md(player.modelLabel)} | ${player.alive ? '存活' : '淘汰'} | ${player.cutWires.length ? player.cutWires.map((wire) => WIRE_NAMES[wire]).join('、') : '无'} | ${player.insuranceAvailable ? '可用' : '已用'} |`,
    );
  lines.push('', '## 公共时间线', '');
  if (!game.publicLog.length) lines.push('- 暂无公共记录');
  for (const log of game.publicLog)
    lines.push(`- 第 ${log.turn} 轮 · ${COLLAR_PHASE_NAMES[log.phase]}：${md(log.message)}`);
  lines.push('', '> 本战报不包含致命线、私人安全线或扫描线索。');
  return `${lines.join('\n')}\n`;
}

export function collarFullMarkdown(game: CollarGameState): string {
  if (game.phase !== 'ended') throw new Error('完整复盘只能在游戏结束后导出');
  const winner = game.players.find((player) => player.id === game.winnerPlayerId)!;
  const lines = [
    `# ${md(game.title)}：完整复盘`,
    '',
    `- 胜者：${winner.seat}号 ${md(winner.name)}`,
    `- 原因：${md(game.winReason)}`,
    '',
    '## 项圈与私人线索',
    '',
    '| 座位 | 玩家 | 致命线 | 自身安全提示 | 私人扫描 | 保险 |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const player of game.players) {
    const target = game.players.find((item) => item.id === player.intel.targetPlayerId)!;
    lines.push(
      `| ${player.seat} | ${md(player.name)} | ${WIRE_NAMES[player.lethalWire]} | ${WIRE_NAMES[player.safeWireHint]} | ${target.seat}号的${WIRE_NAMES[player.intel.safeWire]}安全 | ${player.insuranceAvailable ? '未使用' : '已使用'} |`,
    );
  }
  lines.push('', '## 完整行动记录', '');
  for (const record of game.actions) {
    const player = game.players.find((item) => item.id === record.playerId)!;
    lines.push(
      `- 第 ${record.turn} 轮 · ${COLLAR_PHASE_NAMES[record.phase]} · ${player.seat}号 ${md(player.name)}：${md(record.action.matched)}`,
    );
    if (record.raw && record.raw !== record.action.matched)
      lines.push(`  - 原始回复：${md(record.raw)}`);
  }
  lines.push('', '> 完整复盘含有全部私人信息，请勿默认公开。');
  return `${lines.join('\n')}\n`;
}
