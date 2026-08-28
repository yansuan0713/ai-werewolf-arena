import { useMemo, useState } from 'react';
import type { CollarGameView } from '../api';
import { COLLAR_PHASE_NAMES } from '../shared/collar-types';

type LogTab = 'public' | 'private' | 'god';

export function CollarLogs({ game }: { game: CollarGameView }) {
  const [tab, setTab] = useState<LogTab>('public');
  const [selectedPrivate, setSelectedPrivate] = useState(game.players[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const logs = useMemo(() => {
    const source =
      tab === 'public'
        ? game.publicLog
        : tab === 'god'
          ? game.godLog
          : game.privateLogs[selectedPrivate] || [];
    const needle = query.trim().toLocaleLowerCase('zh-CN');
    return source
      .filter((log) =>
        needle
          ? `第 ${log.turn} 轮 ${COLLAR_PHASE_NAMES[log.phase]} ${log.message}`
              .toLocaleLowerCase('zh-CN')
              .includes(needle)
          : true,
      )
      .slice()
      .reverse();
  }, [game, query, selectedPrivate, tab]);
  const counts: Record<LogTab, number> = {
    public: game.publicLog.length,
    private: (game.privateLogs[selectedPrivate] || []).length,
    god: game.godLog.length,
  };
  return (
    <section className="logs collar-logs" id="game-logs">
      <div className="tabs" role="tablist" aria-label="爆炸项圈日志类型">
        {(['public', 'private', 'god'] as const).map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? 'active' : ''}
            onClick={() => {
              setTab(item);
              setQuery('');
            }}
          >
            {item === 'public' ? '公共' : item === 'private' ? '私人' : '主持'}
            <i>{counts[item]}</i>
          </button>
        ))}
      </div>
      {tab === 'private' && (
        <select
          className="log-player"
          value={selectedPrivate}
          onChange={(event) => {
            setSelectedPrivate(event.target.value);
            setQuery('');
          }}
          aria-label="选择项圈私人日志玩家"
        >
          {game.players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.seat}号 {player.name}
            </option>
          ))}
        </select>
      )}
      <div className="log-search">
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索当前日志"
          aria-label="搜索项圈日志"
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="清除项圈日志搜索">
            ×
          </button>
        )}
      </div>
      <div className="log-result-meta" aria-live="polite">
        <span>{query ? `找到 ${logs.length} 条` : `共 ${logs.length} 条记录`}</span>
        <small>最新在前</small>
      </div>
      <div className="log-list">
        {logs.map((log) => (
          <div key={log.id}>
            <time>
              第 {log.turn} 轮 · {COLLAR_PHASE_NAMES[log.phase]}
            </time>
            <p>{log.message}</p>
          </div>
        ))}
        {!logs.length && (
          <div className="log-empty">
            <b>{query ? '没有匹配的日志' : '暂无记录'}</b>
            <span>{query ? '换一个关键词试试' : '推进对局后，记录会显示在这里'}</span>
          </div>
        )}
      </div>
    </section>
  );
}
