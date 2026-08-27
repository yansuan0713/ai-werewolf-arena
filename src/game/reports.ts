import { PHASE_NAMES, ROLE_NAMES, type GameState } from '../shared/types.js';

const md = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
const playerName = (game: GameState, id: string) => {
  const player = game.players.find((item) => item.id === id);
  return player ? `${player.seat}号 ${player.name}` : '未知玩家';
};

export function publicMarkdown(game: GameState): string {
  const lines = [
    `# ${md(game.title)}：公开战报`,
    '',
    `- 状态：${game.phase === 'ended' ? '已结束' : '进行中'}`,
    `- 当前：第 ${game.day} 天 / ${PHASE_NAMES[game.phase]}`,
    `- 胜负：${game.winner ? (game.winner === 'good' ? '好人阵营' : '狼人阵营') : '尚未结束'}`,
    '',
    '## 玩家',
    '',
    '| 座位 | 玩家 | 模型标签 | 状态 | 公开身份 |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const player of game.players) {
    const role =
      game.phase === 'ended' || (!player.alive && game.config.revealOnDeath)
        ? ROLE_NAMES[player.role]
        : '未公开';
    lines.push(
      `| ${player.seat} | ${md(player.name)} | ${md(player.modelLabel)} | ${player.alive ? '存活' : '死亡'} | ${role} |`,
    );
  }
  lines.push('', '## 公共时间线', '');
  if (!game.publicLog.length) lines.push('- 暂无公共记录');
  for (const log of game.publicLog)
    lines.push(`- 第 ${log.day} 天 · ${PHASE_NAMES[log.phase]}：${md(log.message)}`);
  lines.push('', '> 本战报仅包含游戏中已经公开的信息。');
  return `${lines.join('\n')}\n`;
}

export function fullMarkdown(game: GameState): string {
  if (game.phase !== 'ended') throw new Error('完整复盘只能在游戏结束后导出');
  const lines = [
    `# ${md(game.title)}：完整复盘`,
    '',
    `- 胜方：${game.winner === 'good' ? '好人阵营' : '狼人阵营'}`,
    `- 原因：${md(game.winReason)}`,
    '',
    '## 身份',
    '',
    '| 座位 | 玩家 | 模型标签 | 身份 | 死亡情况 |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const player of game.players)
    lines.push(
      `| ${player.seat} | ${md(player.name)} | ${md(player.modelLabel)} | ${ROLE_NAMES[player.role]} | ${player.alive ? '存活' : md(player.deathCause || '未知')} |`,
    );
  lines.push('', '## 完整行动记录', '');
  if (!game.actions.length) lines.push('- 暂无行动');
  for (const record of game.actions) {
    lines.push(
      `- 第 ${record.day} 天 · ${PHASE_NAMES[record.phase]} · ${md(playerName(game, record.playerId))}：${md(record.action.matched || record.action.kind)}`,
    );
    if (record.result) lines.push(`  - 结算：${md(record.result)}`);
    if (record.raw && record.raw !== record.action.matched)
      lines.push(`  - 原始回复：${md(record.raw)}`);
  }
  lines.push('', '## 公共时间线', '');
  for (const log of game.publicLog)
    lines.push(`- 第 ${log.day} 天 · ${PHASE_NAMES[log.phase]}：${md(log.message)}`);
  lines.push('', '> 完整复盘包含身份与私人行动，请勿默认公开。');
  return `${lines.join('\n')}\n`;
}
