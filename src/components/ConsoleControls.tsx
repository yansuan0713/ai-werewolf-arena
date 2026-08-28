import type { GameView } from '../api';
import type { Phase } from '../shared/types';

const roundStages: Array<{ label: string; phases: Phase[] }> = [
  { label: '确认', phases: ['setup'] },
  { label: '夜幕', phases: ['night_wolf', 'night_seer', 'night_witch'] },
  { label: '黎明', phases: ['dawn', 'last_words'] },
  { label: '发言', phases: ['day_speech', 'runoff_speech'] },
  { label: '投票', phases: ['day_vote', 'runoff_vote'] },
  { label: '结算', phases: ['hunter_action', 'ended'] },
];

export function PhaseRail({ phase }: { phase: Phase }) {
  const active = Math.max(
    0,
    roundStages.findIndex((stage) => stage.phases.includes(phase)),
  );
  return (
    <ol className="phase-rail" aria-label="当前回合阶段进度">
      {roundStages.map((stage, index) => (
        <li
          key={stage.label}
          className={index === active ? 'active' : index < active ? 'complete' : ''}
          aria-current={index === active ? 'step' : undefined}
        >
          <i>{index < active ? '✓' : index + 1}</i>
          <span>{stage.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function ConsoleNav({ pendingCount }: { pendingCount: number }) {
  const destinations = [
    { id: 'round-overview', label: '本轮' },
    { id: 'player-seats', label: '席位' },
    { id: 'action-desk', label: '行动' },
    { id: 'game-logs', label: '记录' },
  ];
  const jump = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <nav className="console-nav" aria-label="主持台快捷导航">
      <div className={pendingCount ? 'nav-status waiting' : 'nav-status ready'}>
        <i aria-hidden="true" />
        {pendingCount ? `尚有 ${pendingCount} 位玩家待行动` : '本阶段信息已收齐'}
      </div>
      <div className="nav-links">
        {destinations.map((destination) => (
          <button
            key={destination.id}
            onClick={() => jump(destination.id)}
            aria-label={`前往${destination.label}`}
          >
            {destination.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function PendingQueue({
  players,
  onSelect,
}: {
  players: GameView['players'];
  onSelect: (playerId: string) => void;
}) {
  if (!players.length) return null;
  return (
    <div className="pending-queue" aria-label="待行动玩家快捷定位">
      <span>等待行动</span>
      {players.map((player) => (
        <button key={player.id} onClick={() => onSelect(player.id)}>
          <i>{player.seat}</i>
          {player.name}
        </button>
      ))}
    </div>
  );
}

export function ActionSteps({
  hasPrompt,
  hasReply,
  hasCandidate,
}: {
  hasPrompt: boolean;
  hasReply: boolean;
  hasCandidate: boolean;
}) {
  const current = hasCandidate || hasReply ? 2 : hasPrompt ? 1 : 0;
  const steps = [
    { label: '提示词', complete: hasPrompt, active: current === 0 },
    { label: 'AI 回复', complete: hasReply, active: current === 1 },
    { label: '确认行动', complete: false, active: current === 2 },
  ];
  return (
    <ol className="action-steps" aria-label="行动提交流程">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={step.complete ? 'complete' : step.active ? 'active' : ''}
          aria-current={step.active ? 'step' : undefined}
        >
          <i>{step.complete ? '✓' : index + 1}</i>
          {step.label}
        </li>
      ))}
    </ol>
  );
}

export function ExportMenu({
  game,
  onDownload,
}: {
  game: GameView;
  onDownload: (kind: 'public.md' | 'full.md' | 'save') => void;
}) {
  return (
    <details className="export-menu">
      <summary className="ghost">导出与备份</summary>
      <div className="export-popover">
        <button onClick={() => onDownload('public.md')}>
          <b>公开战报</b>
          <span>仅包含已公开信息</span>
        </button>
        <button onClick={() => onDownload('save')}>
          <b>完整存档</b>
          <span>用于本机备份与恢复</span>
        </button>
        {game.phase === 'ended' && (
          <button onClick={() => onDownload('full.md')}>
            <b>完整复盘</b>
            <span>包含身份与私人行动</span>
          </button>
        )}
      </div>
    </details>
  );
}

export function PrivacyCurtain({ onReveal }: { onReveal: () => void }) {
  return (
    <div
      className="privacy-curtain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-title"
    >
      <div className="privacy-mark" aria-hidden="true">
        隐
      </div>
      <p className="eyebrow">暂离席位</p>
      <h1 id="privacy-title">上帝视角已遮挡</h1>
      <p>身份、行动与日志仍安全保存在本机。</p>
      <button className="primary large" onClick={onReveal} autoFocus>
        返回控制台
      </button>
    </div>
  );
}
