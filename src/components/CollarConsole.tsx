import { useState } from 'react';
import { api, type CollarGameView } from '../api';
import {
  COLLAR_PHASE_NAMES,
  WIRES,
  WIRE_NAMES,
  type CollarActionKind,
  type CollarParsedAction,
} from '../shared/collar-types';
import { ActionSteps, ConsoleNav, ExportMenu, PrivacyCurtain } from './ConsoleControls';
import { CollarLogs } from './CollarLogs';
import { AnimatedNumber } from './motion/AnimatedNumber';

const actionNames: Record<CollarActionKind, string> = {
  collar_speech: '公开发言',
  cut_wire: '剪线',
  use_insurance: '使用保险',
  accept_cut: '接受剪线',
};
const phaseGuidance: Record<CollarGameView['phase'], string> = {
  setup: '逐席生成并确认私人线索。全部完成前，系统不会解锁第一轮。',
  opening_speech: '每名存活玩家完成一段公开开场陈述，私人线索不会自动公开。',
  turn_speech: '当前操作者先公开发言，为本轮剪线制造信息与判断。',
  cut: '当前操作者选择另一名存活玩家及一根尚未剪断的线路。',
  defense: '目标决定使用一次保险取消剪线，或接受本次剪线。',
  resolution: '确认本轮公开结算后，系统会轮换到下一名操作者。',
  ended: '对局已经结束，可以导出完整复盘查看所有线路与私人情报。',
};

const phaseKinds = (phase: CollarGameView['phase']): CollarActionKind[] => {
  if (phase === 'opening_speech' || phase === 'turn_speech') return ['collar_speech'];
  if (phase === 'cut') return ['cut_wire'];
  if (phase === 'defense') return ['use_insurance', 'accept_cut'];
  return [];
};

function CollarPhaseRail({ phase }: { phase: CollarGameView['phase'] }) {
  const stages = [
    { label: '确认', phases: ['setup'] },
    { label: '开场', phases: ['opening_speech'] },
    { label: '发言', phases: ['turn_speech'] },
    { label: '剪线', phases: ['cut'] },
    { label: '应对', phases: ['defense'] },
    { label: '结算', phases: ['resolution', 'ended'] },
  ];
  const active = Math.max(
    0,
    stages.findIndex((stage) => stage.phases.includes(phase)),
  );
  return (
    <ol className="phase-rail collar-phase-rail" aria-label="爆炸项圈阶段进度">
      {stages.map((stage, index) => (
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

export function CollarConsole({
  game,
  busy,
  update,
}: {
  game: CollarGameView;
  busy: boolean;
  update: (fn: () => Promise<CollarGameView>) => void;
}) {
  const [reveal, setReveal] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const pending = game.pendingPlayerIds || [];
  const actionable =
    game.phase === 'setup' ? [] : game.players.filter((player) => pending.includes(player.id));
  const operator = game.players.find((player) => player.id === game.currentOperatorId);
  const cutTarget = game.players.find((player) => player.id === game.pendingCut?.targetId);
  const winner = game.players.find((player) => player.id === game.winnerPlayerId);
  const briefed = game.briefedPlayerIds.length;
  const submitted = new Set(
    game.actions
      .filter((record) => record.turn === game.turn && record.phase === game.phase)
      .map((record) => record.playerId),
  ).size;
  const expected = game.phase === 'setup' ? game.players.length : submitted + pending.length;
  const completed = game.phase === 'setup' ? briefed : submitted;
  const progress = expected ? Math.round((completed / expected) * 100) : 100;
  const advance = () => {
    if (game.phase === 'setup' && !confirm('全部私人简报均已逐席确认。现在正式解锁项圈？')) return;
    update(() => api.advanceCollar(game.id));
  };
  const undo = () => {
    if (!confirm('撤销最近一次行动或阶段推进？当前状态会回到操作之前。')) return;
    update(async () => api.undo(game.id) as Promise<CollarGameView>);
  };
  const download = (kind: 'public.md' | 'full.md' | 'save') => {
    if (kind === 'save' && !confirm('完整存档包含致命线、私人扫描和原始回复。确认保存到本机？'))
      return;
    window.location.href = `/api/games/${game.id}/export/${kind}`;
  };
  return (
    <div className="console collar-console">
      {privacy && <PrivacyCurtain onReveal={() => setPrivacy(false)} />}
      <section className="phase-hero collar-hero" id="round-overview">
        <div className="phase-copy">
          <p className="eyebrow">爆炸项圈 · {game.title}</p>
          <div className="phase-heading">
            <span aria-hidden="true">⌁</span>
            <div>
              <small>第 {game.turn || 1} 轮 · 当前阶段</small>
              <h1>{COLLAR_PHASE_NAMES[game.phase]}</h1>
            </div>
          </div>
          <p className="phase-brief collar-brief">
            <span>此刻要做</span>
            {phaseGuidance[game.phase]}
          </p>
          <p className="phase-hint collar-hint">
            {pending.length && game.phase !== 'setup'
              ? `等待 ${actionable.map((player) => `${player.seat}号`).join('、')} 完成行动`
              : game.phase === 'ended'
                ? `${winner?.seat}号 ${winner?.name} 成为最后幸存者`
                : game.phase === 'resolution'
                  ? '本轮结果已公开，确认后开始下一轮'
                  : '所需信息已收齐，由主持人推进'}
          </p>
        </div>
        <div className="round-summary collar-summary">
          <div className="metric">
            <small>幸存</small>
            <strong>
              <AnimatedNumber
                value={game.players.filter((player) => player.alive).length}
                duration={0.45}
                startOnView={false}
              />
            </strong>
            <span>/ {game.players.length} 人</span>
          </div>
          <div className="metric">
            <small>当前操作者</small>
            <strong>{operator ? `${operator.seat}` : '—'}</strong>
            <span>{operator?.name || '尚未确定'}</span>
          </div>
          <div className="progress-track" aria-label={`本阶段行动完成 ${progress}%`}>
            <i style={{ width: `${progress}%` }} />
          </div>
          <small className="progress-caption">
            {game.phase === 'setup'
              ? `私人简报 ${briefed}/${game.players.length}`
              : expected
                ? `行动 ${completed}/${expected}`
                : '等待主持人确认'}
          </small>
        </div>
        <CollarPhaseRail phase={game.phase} />
      </section>
      <ConsoleNav pendingCount={pending.length} />
      {winner && (
        <div className="winner collar-winner">
          <b>
            {winner.seat}号 {winner.name} 获胜
          </b>
          <span>{game.winReason}</span>
        </div>
      )}
      <div className="toolbar">
        <div>
          <button
            className={reveal ? 'toggle active' : 'toggle'}
            onClick={() => setReveal((current) => !current)}
          >
            <i /> 私人线路 {reveal ? '已显示' : '已隐藏'}
          </button>
          <span className="autosave">已自动存档</span>
        </div>
        <div>
          <button
            className="ghost privacy-button"
            onClick={() => {
              setReveal(false);
              setPrivacy(true);
            }}
          >
            隐私遮罩
          </button>
          {game.canUndo && (
            <button className="ghost" disabled={busy} onClick={undo}>
              撤销上一步
            </button>
          )}
          <ExportMenu game={game} onDownload={download} />
        </div>
      </div>
      {game.phase === 'setup' && (
        <div className="setup-notice collar-setup">
          <b>
            逐一确认私人线索 · {briefed}/{game.players.length}
          </b>
          <span>生成后请核对接收方，再点“确认已交接”。全部席位确认前无法正式开始。</span>
        </div>
      )}
      <section className="players" id="player-seats">
        <div className="section-title">
          <div>
            <p className="eyebrow">项圈状态</p>
            <h2>幸存者席位</h2>
          </div>
          <span>{game.players.filter((player) => player.alive).length} 人仍在场</span>
        </div>
        <div className="player-grid collar-player-grid">
          {game.players.map((player) => {
            const intelTarget = game.players.find(
              (item) => item.id === player.intel.targetPlayerId,
            );
            return (
              <article
                key={player.id}
                className={`player-card collar-player ${!player.alive ? 'dead' : ''} ${pending.includes(player.id) && game.phase !== 'setup' ? 'pending' : ''}`}
              >
                <div className="seat">{player.seat}</div>
                <div className="player-info">
                  <h3>{player.name}</h3>
                  <p>{player.modelLabel}</p>
                </div>
                <div className="role">{player.insuranceAvailable ? '保险可用' : '保险已用'}</div>
                <div className="wire-strip" aria-label={`${player.seat}号项圈线路`}>
                  {WIRES.map((wire) => (
                    <i
                      key={wire}
                      className={`${wire} ${player.cutWires.includes(wire) ? 'cut' : ''}`}
                      title={`${WIRE_NAMES[wire]}${player.cutWires.includes(wire) ? '已剪断' : '未剪'}`}
                    />
                  ))}
                </div>
                <small className="life">
                  {player.alive ? '存活' : `第 ${player.deathTurn} 轮爆炸淘汰`}
                </small>
                {(reveal || game.phase === 'ended') && (
                  <div className="collar-secrets">
                    <span>致命：{WIRE_NAMES[player.lethalWire]}</span>
                    <span>自知安全：{WIRE_NAMES[player.safeWireHint]}</span>
                    <span>
                      扫描：{intelTarget?.seat}号 {WIRE_NAMES[player.intel.safeWire]}安全
                    </span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <div className="main-grid">
        <section className="action-zone" id="action-desk">
          <div className="section-title">
            <div>
              <p className="eyebrow">主持案台</p>
              <h2>行动工作台</h2>
            </div>
            <span>
              {actionable.length
                ? `等待 ${actionable.map((player) => `${player.seat}号`).join('、')}`
                : game.phase === 'setup'
                  ? '等待主持人确认开局'
                  : '本阶段行动已收齐'}
            </span>
          </div>
          {game.pendingCut && (
            <div className={`cut-order ${game.phase === 'resolution' ? 'resolved' : ''}`}>
              <span>本轮剪线</span>
              <b>
                {operator?.seat}号 → {cutTarget?.seat}号 · {WIRE_NAMES[game.pendingCut.wire]}
              </b>
              <small>
                {game.phase === 'defense'
                  ? '等待目标决定是否使用保险'
                  : game.phase === 'resolution'
                    ? '结算已写入公共记录'
                    : '剪线尚未结算'}
              </small>
            </div>
          )}
          {game.phase === 'setup' ? (
            <div className="briefing-grid">
              {game.players.map((player) => (
                <CollarBriefingCard
                  key={player.id}
                  game={game}
                  player={player}
                  confirmed={game.briefedPlayerIds.includes(player.id)}
                  update={update}
                />
              ))}
            </div>
          ) : actionable.length ? (
            <div className="action-stack">
              {actionable.map((player) => (
                <CollarActionPanel
                  key={`${game.phase}-${player.id}`}
                  game={game}
                  player={player}
                  update={update}
                />
              ))}
            </div>
          ) : (
            <div className="ready">
              <span>✓</span>
              <div>
                <b>{game.phase === 'ended' ? '对局已经结束' : '本阶段已准备就绪'}</b>
                <p>
                  {game.phase === 'ended'
                    ? '可导出完整复盘查看所有致命线与私人情报。'
                    : game.phase === 'resolution'
                      ? '检查公开结算后，推进到下一位操作者。'
                      : '由主持人确认后推进状态机。'}
                </p>
              </div>
            </div>
          )}
          {game.phase !== 'ended' && (
            <button
              className="advance collar-advance"
              disabled={busy || pending.length > 0}
              onClick={advance}
            >
              <span>{busy ? '处理中…' : '推进至下一阶段'}</span>
              <b>→</b>
            </button>
          )}
        </section>
        <aside className="side-panel">
          <section className="collar-rules-card">
            <p className="eyebrow">本局规则</p>
            <ul>
              <li>三根线路，一根致命</li>
              <li>每人一条自身安全提示</li>
              <li>每人一条他人安全扫描</li>
              <li>{game.config.insuranceEnabled ? '每人一次剪线保险' : '本局关闭剪线保险'}</li>
              <li>最后一名幸存者获胜</li>
            </ul>
          </section>
          <CollarLogs game={game} />
        </aside>
      </div>
    </div>
  );
}

function CollarBriefingCard({
  game,
  player,
  confirmed,
  update,
}: {
  game: CollarGameView;
  player: CollarGameView['players'][number];
  confirmed: boolean;
  update: (fn: () => Promise<CollarGameView>) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const generate = async () => {
    setWorking(true);
    try {
      const response = await api.collarPrompt(game.id, player.id);
      setPrompt(response.prompt);
      try {
        await navigator.clipboard.writeText(response.prompt);
        setMessage('私人简报已生成并复制');
      } catch {
        setMessage('私人简报已生成，可手动复制');
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  };
  const confirmDelivery = () => {
    if (!confirm(`确认私人简报只交接给 ${player.seat}号 ${player.name}？`)) return;
    update(() => api.confirmCollarBriefing(game.id, player.id));
  };
  return (
    <article className={`briefing-card ${confirmed ? 'confirmed' : ''}`}>
      <div>
        <span>{player.seat}</span>
        <b>{player.name}</b>
        <small>{confirmed ? '✓ 已完成隔离交接' : player.modelLabel}</small>
      </div>
      {!confirmed && (
        <div className="briefing-actions">
          <button className="secondary" disabled={working} onClick={generate}>
            {prompt ? '重新生成并复制' : '生成私人简报'}
          </button>
          <button
            className="confirm-briefing"
            disabled={!prompt || working}
            onClick={confirmDelivery}
          >
            确认已交接
          </button>
        </div>
      )}
      {prompt && (
        <details>
          <summary>检查简报内容</summary>
          <textarea readOnly value={prompt} aria-label={`${player.seat}号私人简报`} />
        </details>
      )}
      {message && <p className="inline-message">{message}</p>}
    </article>
  );
}

function CollarActionPanel({
  game,
  player,
  update,
}: {
  game: CollarGameView;
  player: CollarGameView['players'][number];
  update: (fn: () => Promise<CollarGameView>) => void;
}) {
  const kinds = phaseKinds(game.phase).filter(
    (item) => item !== 'use_insurance' || player.insuranceAvailable,
  );
  const [prompt, setPrompt] = useState('');
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState<CollarParsedAction[]>([]);
  const [selected, setSelected] = useState(0);
  const [manual, setManual] = useState(false);
  const [kind, setKind] = useState<CollarActionKind>(kinds[0] || 'collar_speech');
  const [target, setTarget] = useState('');
  const [wire, setWire] = useState<(typeof WIRES)[number]>('red');
  const [text, setText] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [canLooseRetry, setCanLooseRetry] = useState(false);
  const generate = async () => {
    setWorking(true);
    try {
      const response = await api.collarPrompt(game.id, player.id);
      setPrompt(response.prompt);
      try {
        await navigator.clipboard.writeText(response.prompt);
        setMessage('提示词已生成并复制到剪贴板');
      } catch {
        setMessage('提示词已生成；自动复制失败，可使用复制按钮');
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage('已复制到剪贴板');
    } catch {
      setMessage('复制失败，请手动选择文本');
    }
  };
  const parse = async (loose = false) => {
    setWorking(true);
    try {
      const response = await api.parseCollar(raw, loose);
      setParsed(response.actions);
      setSelected(0);
      setCanLooseRetry(!loose && !response.actions.length);
      setMessage(
        response.actions.length
          ? `${loose ? '宽松模式' : '严格模式'}识别到 ${response.actions.length} 个候选行动`
          : loose
            ? '宽松模式仍未识别，请手动选择'
            : '严格模式未识别，可宽松重试或手动选择',
      );
      if (loose && !response.actions.length) setManual(true);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  };
  const submit = () => {
    let action = parsed[selected];
    if (manual) {
      action = {
        kind,
        matched: `主持人手动确认：${actionNames[kind]}`,
        ...(kind === 'collar_speech' ? { text } : {}),
        ...(kind === 'cut_wire' ? { targetSeat: Number(target), wire } : {}),
      };
    }
    if (!action) {
      setMessage('请先解析或手动选择行动');
      return;
    }
    if (!confirm(`确认提交 ${player.seat}号的“${actionNames[action.kind]}”？`)) return;
    update(() => api.submitCollar(game.id, player.id, action!, raw));
  };
  return (
    <article className="action-panel collar-action-panel" id={`action-${player.id}`}>
      <div className="action-head">
        <div className="mini-seat">{player.seat}</div>
        <div>
          <h3>{player.name}</h3>
          <p>{player.modelLabel}</p>
        </div>
        <span>{game.phase === 'defense' ? '目标应对' : '待确认'}</span>
      </div>
      <ActionSteps
        hasPrompt={Boolean(prompt)}
        hasReply={Boolean(raw.trim())}
        hasCandidate={manual || parsed.length > 0}
      />
      <div className="prompt-row">
        <button className="secondary" disabled={working} onClick={generate}>
          生成并复制提示词
        </button>
        <button className="ghost" disabled={!prompt} onClick={copy}>
          再次复制
        </button>
      </div>
      {prompt && (
        <textarea className="prompt-output" readOnly value={prompt} aria-label="项圈玩家提示词" />
      )}
      <label>
        粘贴 AI 回复
        <textarea
          value={raw}
          onChange={(event) => {
            setRaw(event.target.value);
            setCanLooseRetry(false);
          }}
          placeholder="把对应 AI 网页的回复粘贴到这里…"
        />
      </label>
      <div className="parse-row">
        <button className="secondary" disabled={!raw || working} onClick={() => parse(false)}>
          解析回复
        </button>
        {canLooseRetry && (
          <button className="secondary" disabled={working} onClick={() => parse(true)}>
            宽松重试
          </button>
        )}
        <button className="link-btn" onClick={() => setManual((current) => !current)}>
          {manual ? '使用解析结果' : '无法解析？手动选择'}
        </button>
      </div>
      {message && <p className="inline-message">{message}</p>}
      {parsed.length > 0 && !manual && (
        <div className="parsed">
          <b>解析预览（尚未执行）</b>
          {parsed.map((action, index) => (
            <label key={index} className={selected === index ? 'selected' : ''}>
              <input
                type="radio"
                checked={selected === index}
                onChange={() => setSelected(index)}
              />
              <span>
                {actionNames[action.kind]}
                {action.targetSeat ? ` → ${action.targetSeat}号 ${WIRE_NAMES[action.wire!]}` : ''}
                {action.text ? `：${action.text}` : ''}
              </span>
              <code>{action.matched}</code>
            </label>
          ))}
        </div>
      )}
      {manual && (
        <div className="manual">
          <b>主持人手动指定行动</b>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as CollarActionKind)}
          >
            {kinds.map((item) => (
              <option key={item} value={item}>
                {actionNames[item]}
              </option>
            ))}
          </select>
          {kind === 'collar_speech' && (
            <textarea value={text} onChange={(event) => setText(event.target.value)} />
          )}
          {kind === 'cut_wire' && (
            <>
              <select value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="">选择目标</option>
                {game.players
                  .filter((item) => item.alive && item.id !== player.id)
                  .map((item) => (
                    <option key={item.id} value={item.seat}>
                      {item.seat}号 {item.name}
                    </option>
                  ))}
              </select>
              <select value={wire} onChange={(event) => setWire(event.target.value as typeof wire)}>
                {WIRES.map((item) => (
                  <option key={item} value={item}>
                    {WIRE_NAMES[item]}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}
      <button
        className="confirm"
        disabled={working || (!manual && !parsed.length)}
        onClick={submit}
      >
        确认并提交行动
      </button>
    </article>
  );
}
