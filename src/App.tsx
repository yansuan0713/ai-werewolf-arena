import { useEffect, useMemo, useState } from 'react';
import { api, type GameView } from './api';
import {
  ActionSteps,
  ConsoleNav,
  ExportMenu,
  PendingQueue,
  PhaseRail,
  PrivacyCurtain,
} from './components/ConsoleControls';
import { GameLogs } from './components/GameLogs';
import {
  PHASE_NAMES,
  ROLE_NAMES,
  ROLES,
  type ActionKind,
  type CreateGameInput,
  type ParsedAction,
  type PlayerDraft,
} from './shared/types';

const DEFAULT_PLAYERS: PlayerDraft[] = Array.from({ length: 7 }, (_, i) => ({
  name: `玩家 ${i + 1}`,
  modelLabel: 'AI 网页',
  role: ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager', 'villager'][
    i
  ] as PlayerDraft['role'],
}));
const actionNames: Record<ActionKind, string> = {
  kill: '击杀',
  inspect: '查验',
  antidote: '使用解药',
  poison: '使用毒药',
  no_medicine: '不开药',
  none: '无行动',
  vote: '投票',
  speech: '公开发言',
  last_words: '遗言',
  shoot: '开枪',
  no_shoot: '不开枪',
};
const allowedKinds = (phase: GameView['phase']): ActionKind[] => {
  const map: Partial<Record<GameView['phase'], ActionKind[]>> = {
    night_wolf: ['kill'],
    night_seer: ['inspect'],
    night_witch: ['antidote', 'poison', 'no_medicine'],
    last_words: ['last_words'],
    day_speech: ['speech'],
    day_vote: ['vote'],
    runoff_speech: ['speech'],
    runoff_vote: ['vote'],
    hunter_action: ['shoot', 'no_shoot'],
  };
  return map[phase] || [];
};

function App() {
  const [games, setGames] = useState<GameView[]>([]),
    [game, setGame] = useState<GameView | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const loadList = async () => {
    try {
      setGames(await api.list());
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const selectGame = (next: GameView | null) => {
    setGame(next);
    if (next) localStorage.setItem('ai-werewolf-current-game', next.id);
    else localStorage.removeItem('ai-werewolf-current-game');
  };
  const open = async (id: string) => {
    try {
      selectGame(await api.get(id));
      setError('');
    } catch (e) {
      localStorage.removeItem('ai-werewolf-current-game');
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void loadList();
    const id = localStorage.getItem('ai-werewolf-current-game');
    if (id)
      void api
        .get(id)
        .then((next) => {
          setGame(next);
          setError('');
        })
        .catch((e) => {
          localStorage.removeItem('ai-werewolf-current-game');
          setError((e as Error).message);
        });
  }, []);
  const remove = async (id: string) => {
    if (!confirm('确定永久删除这局本地存档？此操作无法撤销。')) return;
    try {
      await api.delete(id);
      if (game?.id === id) selectGame(null);
      await loadList();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const update = async (fn: () => Promise<GameView>) => {
    setBusy(true);
    setError('');
    try {
      const next = await fn();
      setGame(next);
      await loadList();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => selectGame(null)}>
          <span className="moon">夜</span>
          <span>
            <b>月下议事厅</b>
            <small>AI 狼人杀 · 本地主持台</small>
          </span>
        </button>
        {game && (
          <button className="ghost" onClick={() => selectGame(null)}>
            ← 对局大厅
          </button>
        )}
        <div className="local-badge">
          <i /> 本机运行 · 无 API
        </div>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}
      <main>
        {game ? (
          <GameConsole game={game} busy={busy} update={update} />
        ) : (
          <Lobby
            games={games}
            onOpen={open}
            onDelete={remove}
            onCreated={(g) => {
              selectGame(g);
              void loadList();
            }}
            setError={setError}
          />
        )}
      </main>
      <footer>月下议事厅 · 数据只保存在本机 · 非任何模型厂商官方产品</footer>
    </div>
  );
}

function Lobby({
  games,
  onOpen,
  onDelete,
  onCreated,
  setError,
}: {
  games: GameView[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onCreated: (g: GameView) => void;
  setError: (s: string) => void;
}) {
  const [creating, setCreating] = useState(false),
    [importing, setImporting] = useState(false);
  const importSave = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      const data = JSON.parse(await file.text()) as unknown;
      onCreated(await api.importSave(data));
    } catch (e) {
      setError(e instanceof SyntaxError ? '所选文件不是有效的 JSON 存档' : (e as Error).message);
    } finally {
      setImporting(false);
    }
  };
  return (
    <div className="lobby">
      <section className="hero">
        <div>
          <p className="eyebrow">今夜开局</p>
          <h1>
            七席已备，
            <br />
            <em>等你落座开局。</em>
          </h1>
          <p>
            免费、本地、半自动的多 AI 狼人杀主持工具。你掌握规则与确认权，模型只负责思考和发言。
          </p>
          <div className="actions">
            <button className="primary large" onClick={() => setCreating(true)}>
              ＋ 新建 7 人对局
            </button>
            <label className="ghost">
              {importing ? '导入中…' : '导入完整存档'}
              <input
                hidden
                type="file"
                accept="application/json,.json"
                disabled={importing}
                aria-label="选择要导入的完整存档"
                onChange={(e) => {
                  const input = e.currentTarget;
                  void importSave(input.files?.[0]).finally(() => {
                    input.value = '';
                  });
                }}
              />
            </label>
          </div>
        </div>
        <div className="sigil">
          <span>7</span>
          <small>经典七人局</small>
        </div>
      </section>
      {creating && (
        <CreateForm onCancel={() => setCreating(false)} onCreated={onCreated} setError={setError} />
      )}
      <section className="saved">
        <div className="section-title">
          <div>
            <p className="eyebrow">续局</p>
            <h2>本地存档</h2>
          </div>
          <span>{games.length} 局</span>
        </div>
        {!games.length ? (
          <div className="empty">还没有存档。新建一局，座位已按经典 7 人配置准备好。</div>
        ) : (
          <div className="game-grid">
            {games.map((g) => (
              <article className="save-card" key={g.id}>
                <div>
                  <span className={`phase-dot ${g.phase === 'ended' ? 'ended' : ''}`} />
                  <small>{PHASE_NAMES[g.phase]}</small>
                </div>
                <h3>{g.title}</h3>
                <p>
                  第 {g.day || 0} 天 · {g.players.filter((p) => p.alive).length}/{g.players.length}{' '}
                  人存活
                </p>
                <time>{new Date(g.updatedAt).toLocaleString()}</time>
                <div className="actions">
                  <button className="primary" onClick={() => onOpen(g.id)}>
                    继续对局
                  </button>
                  <button className="danger-text" onClick={() => onDelete(g.id)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CreateForm({
  onCancel,
  onCreated,
  setError,
}: {
  onCancel: () => void;
  onCreated: (g: GameView) => void;
  setError: (s: string) => void;
}) {
  const [players, setPlayers] = useState(DEFAULT_PLAYERS),
    [title, setTitle] = useState('七人经典局'),
    [assignment, setAssignment] = useState<'random' | 'manual'>('random'),
    [lastWords, setLastWords] = useState(true),
    [selfSave, setSelfSave] = useState(true),
    [revealOnDeath, setRevealOnDeath] = useState(false),
    [saving, setSaving] = useState(false);
  const change = (i: number, key: keyof PlayerDraft, value: string) =>
    setPlayers((v) => v.map((p, n) => (n === i ? { ...p, [key]: value } : p)));
  const create = async () => {
    setSaving(true);
    try {
      const input: CreateGameInput = {
        title,
        players,
        assignment,
        config: { nightDeathLastWords: lastWords, firstNightSelfSave: selfSave, revealOnDeath },
      };
      onCreated(await api.create(input));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <section className="modal">
        <div className="modal-head">
          <div>
            <p className="eyebrow">开一局</p>
            <h2>新建对局</h2>
          </div>
          <button className="icon-btn" onClick={onCancel}>
            ×
          </button>
        </div>
        <label>
          对局名称
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="segmented">
          <button
            className={assignment === 'random' ? 'active' : ''}
            onClick={() => setAssignment('random')}
          >
            随机分配身份
          </button>
          <button
            className={assignment === 'manual' ? 'active' : ''}
            onClick={() => setAssignment('manual')}
          >
            手动分配身份
          </button>
        </div>
        <div className="player-editor">
          {players.map((p, i) => (
            <div className="editor-row" key={i}>
              <b>{i + 1}</b>
              <input
                aria-label={`${i + 1}号名称`}
                value={p.name}
                onChange={(e) => change(i, 'name', e.target.value)}
              />
              <input
                aria-label={`${i + 1}号模型标签`}
                value={p.modelLabel}
                onChange={(e) => change(i, 'modelLabel', e.target.value)}
              />
              {assignment === 'manual' && (
                <select value={p.role} onChange={(e) => change(i, 'role', e.target.value)}>
                  {ROLES.map((r) => (
                    <option value={r} key={r}>
                      {ROLE_NAMES[r]}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={lastWords}
            onChange={(e) => setLastWords(e.target.checked)}
          />
          夜间死亡玩家拥有遗言
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={selfSave}
            onChange={(e) => setSelfSave(e.target.checked)}
          />
          首夜允许女巫自救
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={revealOnDeath}
            onChange={(e) => setRevealOnDeath(e.target.checked)}
          />
          死亡时公开身份
        </label>
        <p className="form-note">狼人再次平票时无人出局；其他规则采用经典 7 人局默认值。</p>
        <div className="modal-actions">
          <button className="ghost" onClick={onCancel}>
            取消
          </button>
          <button className="primary" disabled={saving} onClick={create}>
            {saving ? '创建中…' : '创建并确认身份'}
          </button>
        </div>
      </section>
    </div>
  );
}

function GameConsole({
  game,
  busy,
  update,
}: {
  game: GameView;
  busy: boolean;
  update: (fn: () => Promise<GameView>) => void;
}) {
  const [reveal, setReveal] = useState(false),
    [privacy, setPrivacy] = useState(false),
    [wolfResolution, setWolfResolution] = useState('');
  const pending = game.pendingPlayerIds || [];
  const voteCounts = useMemo(() => {
    const phase = game.phase === 'runoff_vote' ? 'runoff_vote' : 'day_vote';
    const out: Record<number, number> = {};
    game.actions
      .filter(
        (a) =>
          a.day === game.day && a.phase === phase && a.action.kind === 'vote' && !a.action.abstain,
      )
      .forEach((a) => (out[a.action.targetSeat!] = (out[a.action.targetSeat!] || 0) + 1));
    return out;
  }, [game]);
  const advance = () => {
    if (game.phase === 'setup' && !confirm('身份已确认？正式开始后将进入第一夜。')) return;
    const opts =
      game.phase === 'night_wolf' && wolfResolution
        ? { wolfResolution: wolfResolution === 'none' ? null : Number(wolfResolution) }
        : {};
    update(() => api.advance(game.id, opts));
  };
  const undo = () => {
    if (!confirm('撤销最近一次已确认行动或阶段推进？当前状态会回到该操作之前。')) return;
    update(() => api.undo(game.id));
  };
  const download = (kind: 'public.md' | 'full.md' | 'save') => {
    if (kind === 'save' && !confirm('完整存档包含全部身份、私人行动和 AI 回复。确认保存到本机？'))
      return;
    window.location.href = `/api/games/${game.id}/export/${kind}`;
  };
  const actionable = game.players.filter((p) => pending.includes(p.id));
  const submittedThisPhase = new Set(
    game.actions
      .filter((action) => action.day === game.day && action.phase === game.phase)
      .map((action) => action.playerId),
  ).size;
  const expectedThisPhase = game.phase === 'setup' ? 0 : submittedThisPhase + pending.length;
  const progress = expectedThisPhase
    ? Math.round((submittedThisPhase / expectedThisPhase) * 100)
    : 100;
  const shield = () => {
    setReveal(false);
    setPrivacy(true);
  };
  const focusAction = (playerId: string) => {
    document
      .getElementById(`action-${playerId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div className="console">
      {privacy && <PrivacyCurtain onReveal={() => setPrivacy(false)} />}
      <section
        id="round-overview"
        className={`phase-hero ${game.phase.startsWith('night') ? 'night' : 'day'}`}
      >
        <div className="phase-copy">
          <p className="eyebrow">{game.title}</p>
          <div className="phase-heading">
            <span aria-hidden="true">{game.phase.startsWith('night') ? '☾' : '◉'}</span>
            <div>
              <small>第 {game.day || 1} 天 · 当前阶段</small>
              <h1>{PHASE_NAMES[game.phase]}</h1>
            </div>
          </div>
          {pending.length ? (
            <PendingQueue players={actionable} onSelect={focusAction} />
          ) : (
            <p className="phase-hint">
              {game.phase === 'ended'
                ? '对局已经完成，可以导出完整复盘'
                : '所需信息已收齐，由上帝确认后推进'}
            </p>
          )}
        </div>
        <div className="round-summary">
          <div className="metric">
            <small>存活</small>
            <strong>{game.players.filter((player) => player.alive).length}</strong>
            <span>/ {game.players.length} 人</span>
          </div>
          <div className="metric">
            <small>行动进度</small>
            <strong>
              {expectedThisPhase ? `${submittedThisPhase}/${expectedThisPhase}` : '—'}
            </strong>
            <span>{pending.length ? `还差 ${pending.length} 人` : '已就绪'}</span>
          </div>
          <div className="progress-track" aria-label={`本阶段行动完成 ${progress}%`}>
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
        <PhaseRail phase={game.phase} />
      </section>
      <ConsoleNav pendingCount={pending.length} />
      {game.winner && (
        <div className={`winner ${game.winner}`}>
          <b>{game.winner === 'good' ? '好人阵营胜利' : '狼人阵营胜利'}</b>
          <span>{game.winReason}</span>
        </div>
      )}
      <div className="toolbar">
        <div>
          <button
            className={reveal ? 'toggle active' : 'toggle'}
            onClick={() => setReveal(!reveal)}
          >
            <i /> 上帝视角身份 {reveal ? '已开启' : '已关闭'}
          </button>
          <span className="autosave">已自动存档</span>
        </div>
        <div>
          <button className="ghost privacy-button" onClick={shield}>
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
        <div className="setup-notice">
          <b>正式开始前身份确认</b>
          <span>
            上帝请核对所有座位、名称、模型标签和身份。玩家 Prompt 仍只会显示其本人应知内容。
          </span>
        </div>
      )}
      <section className="players" id="player-seats">
        <div className="section-title">
          <div>
            <p className="eyebrow">在座诸位</p>
            <h2>玩家席位</h2>
          </div>
          <span>{game.players.filter((p) => p.alive).length} 人存活</span>
        </div>
        <div className="player-grid">
          {game.players.map((p) => (
            <article
              key={p.id}
              className={`player-card ${!p.alive ? 'dead' : ''} ${pending.includes(p.id) ? 'pending' : ''}`}
            >
              <div className="seat">{p.seat}</div>
              <div className="player-info">
                <h3>{p.name}</h3>
                <p>{p.modelLabel}</p>
              </div>
              <div className="role">
                {reveal || game.phase === 'ended' || (!p.alive && game.config.revealOnDeath)
                  ? ROLE_NAMES[p.role]
                  : '身份隐藏'}
              </div>
              <small className="life">
                {p.alive ? '存活' : `死亡 · ${p.deathCause || '未知'}`}
              </small>
            </article>
          ))}
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
                ? `等待 ${actionable.map((p) => p.seat + '号').join('、')}`
                : '本阶段行动已收齐'}
            </span>
          </div>
          {actionable.length ? (
            <div className="action-stack">
              {actionable.map((p) => (
                <ActionPanel key={`${game.phase}-${p.id}`} game={game} player={p} update={update} />
              ))}
            </div>
          ) : (
            <div className="ready">
              <span>✓</span>
              <div>
                <b>{game.phase === 'ended' ? '对局已经结束' : '本阶段已准备就绪'}</b>
                <p>
                  {game.phase === 'ended'
                    ? '可导出完整复盘查看所有身份与行动。'
                    : '检查日志后，由上帝推进到下一阶段。'}
                </p>
              </div>
            </div>
          )}
          {game.phase === 'night_wolf' && pending.length === 0 && (
            <label className="resolution">
              狼人意见不一致时的上帝裁定（意见一致可不选）
              <select value={wolfResolution} onChange={(e) => setWolfResolution(e.target.value)}>
                <option value="">按一致意见结算</option>
                <option value="none">空刀</option>
                {game.players
                  .filter((p) => p.alive && p.role !== 'wolf')
                  .map((p) => (
                    <option key={p.id} value={p.seat}>
                      {p.seat}号 {p.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {game.phase !== 'ended' && (
            <button
              className="advance"
              disabled={busy || (!['setup', 'dawn'].includes(game.phase) && pending.length > 0)}
              onClick={advance}
            >
              <span>{busy ? '处理中…' : `推进至下一阶段`}</span>
              <b>→</b>
            </button>
          )}
        </section>
        <aside className="side-panel">
          {['day_vote', 'runoff_vote'].includes(game.phase) && (
            <section className="vote-box">
              <p className="eyebrow">票型</p>
              <h3>实时票型</h3>
              {Object.keys(voteCounts).length ? (
                Object.entries(voteCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([s, c]) => (
                    <div className="vote-row" key={s}>
                      <span>
                        {s}号 {game.players.find((p) => p.seat === +s)?.name}
                      </span>
                      <b>{c} 票</b>
                    </div>
                  ))
              ) : (
                <p className="muted">尚无已确认投票</p>
              )}
            </section>
          )}
          <GameLogs game={game} />
        </aside>
      </div>
    </div>
  );
}

function ActionPanel({
  game,
  player,
  update,
}: {
  game: GameView;
  player: GameView['players'][number];
  update: (fn: () => Promise<GameView>) => void;
}) {
  const [prompt, setPrompt] = useState(''),
    [raw, setRaw] = useState(''),
    [parsed, setParsed] = useState<ParsedAction[]>([]),
    [selected, setSelected] = useState(0),
    [manual, setManual] = useState(false),
    [kind, setKind] = useState<ActionKind>(allowedKinds(game.phase)[0] || 'none'),
    [target, setTarget] = useState(''),
    [text, setText] = useState(''),
    [working, setWorking] = useState(false),
    [message, setMessage] = useState(''),
    [canLooseRetry, setCanLooseRetry] = useState(false);
  const gen = async () => {
    setWorking(true);
    try {
      const r = await api.prompt(game.id, player.id);
      setPrompt(r.prompt);
      try {
        await navigator.clipboard.writeText(r.prompt);
        setMessage('提示词已生成并复制到剪贴板');
      } catch {
        setMessage('提示词已生成；自动复制失败，可使用右侧复制按钮');
      }
    } catch (e) {
      setMessage((e as Error).message);
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
  const parseWithMode = async (loose = false) => {
    setWorking(true);
    try {
      const r = await api.parse(raw, loose);
      setParsed(r.actions);
      setSelected(0);
      setCanLooseRetry(!loose && !r.actions.length);
      setMessage(
        r.actions.length
          ? `${loose ? '宽松模式' : '严格模式'}识别到 ${r.actions.length} 个候选行动`
          : loose
            ? '宽松模式仍未识别，请手动选择'
            : '严格模式未识别，可宽松重试或手动选择',
      );
      if (loose && !r.actions.length) setManual(true);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setWorking(false);
    }
  };
  const submit = () => {
    let action = parsed[selected];
    if (manual) {
      action = {
        kind,
        matched: `上帝手动确认：${actionNames[kind]}`,
        ...(['speech', 'last_words'].includes(kind) ? { text } : {}),
        ...(['kill', 'inspect', 'antidote', 'poison', 'shoot'].includes(kind) ||
        (kind === 'vote' && target !== 'abstain')
          ? { targetSeat: Number(target) }
          : {}),
        ...(kind === 'vote' && target === 'abstain' ? { abstain: true } : {}),
      };
    }
    if (!action) {
      setMessage('请先解析或手动选择一个行动');
      return;
    }
    if (
      !confirm(`确认提交 ${player.seat}号的“${actionNames[action.kind]}”行动？提交后将写入存档。`)
    )
      return;
    update(() => api.submit(game.id, player.id, action!, raw));
  };
  const needsTarget = ['kill', 'inspect', 'antidote', 'poison', 'vote', 'shoot'].includes(kind);
  return (
    <article className="action-panel" id={`action-${player.id}`}>
      <div className="action-head">
        <div className="mini-seat">{player.seat}</div>
        <div>
          <h3>{player.name}</h3>
          <p>
            {ROLE_NAMES[player.role]} · {player.modelLabel}
          </p>
        </div>
        <span>待确认</span>
      </div>
      <ActionSteps
        hasPrompt={Boolean(prompt)}
        hasReply={Boolean(raw.trim())}
        hasCandidate={manual || parsed.length > 0}
      />
      <div className="prompt-row">
        <button className="secondary" disabled={working} onClick={gen}>
          生成并复制提示词
        </button>
        <button className="ghost" disabled={!prompt} onClick={copy}>
          一键复制
        </button>
      </div>
      {prompt && (
        <textarea className="prompt-output" readOnly value={prompt} aria-label="生成的玩家提示词" />
      )}
      <label>
        粘贴 AI 回复
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setCanLooseRetry(false);
          }}
          placeholder="把对应 AI 网页的回复粘贴到这里…"
        />
      </label>
      <div className="parse-row">
        <button
          className="secondary"
          disabled={!raw || working}
          onClick={() => parseWithMode(false)}
        >
          解析回复
        </button>
        {canLooseRetry && (
          <button className="secondary" disabled={working} onClick={() => parseWithMode(true)}>
            宽松重试
          </button>
        )}
        <button className="link-btn" onClick={() => setManual(!manual)}>
          {manual ? '使用解析结果' : '无法解析？手动选择'}
        </button>
      </div>
      {message && <p className="inline-message">{message}</p>}
      {parsed.length > 0 && !manual && (
        <div className="parsed">
          <b>解析预览（尚未执行）</b>
          {parsed.map((a, i) => (
            <label key={i} className={selected === i ? 'selected' : ''}>
              <input type="radio" checked={selected === i} onChange={() => setSelected(i)} />
              <span>
                {actionNames[a.kind]}{' '}
                {a.targetSeat
                  ? `→ ${a.targetSeat}号`
                  : a.abstain
                    ? '→ 弃票'
                    : a.text
                      ? `：${a.text}`
                      : ''}
              </span>
              <code>{a.matched}</code>
            </label>
          ))}
        </div>
      )}
      {manual && (
        <div className="manual">
          <b>上帝手动指定行动</b>
          <select value={kind} onChange={(e) => setKind(e.target.value as ActionKind)}>
            {allowedKinds(game.phase).map((k) => (
              <option key={k} value={k}>
                {actionNames[k]}
              </option>
            ))}
          </select>
          {needsTarget && (
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">选择目标</option>
              {kind === 'vote' && <option value="abstain">弃票</option>}
              {game.players
                .filter(
                  (p) =>
                    p.alive &&
                    (kind !== 'inspect' || p.id !== player.id) &&
                    (game.phase !== 'runoff_vote' || game.runoffSeats.includes(p.seat)),
                )
                .map((p) => (
                  <option key={p.id} value={p.seat}>
                    {p.seat}号 {p.name}
                  </option>
                ))}
            </select>
          )}
          {['speech', 'last_words'].includes(kind) && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="输入确认后的发言内容"
            />
          )}
        </div>
      )}
      <button
        className="confirm"
        disabled={
          manual
            ? (needsTarget && !target) || (['speech', 'last_words'].includes(kind) && !text)
            : !parsed.length
        }
        onClick={submit}
      >
        确认并提交行动
      </button>
    </article>
  );
}
export default App;
