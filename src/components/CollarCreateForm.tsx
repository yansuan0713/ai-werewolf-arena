import { useState } from 'react';
import { api, type CollarGameView } from '../api';
import type { CollarPlayerDraft } from '../shared/collar-types';

const defaults = (): CollarPlayerDraft[] =>
  Array.from({ length: 5 }, (_, index) => ({
    name: `玩家 ${index + 1}`,
    modelLabel: 'AI 网页',
  }));

export function CollarCreateForm({
  onCancel,
  onCreated,
  setError,
}: {
  onCancel: () => void;
  onCreated: (game: CollarGameView) => void;
  setError: (message: string) => void;
}) {
  const [title, setTitle] = useState('爆炸项圈 · 生存局');
  const [players, setPlayers] = useState(defaults);
  const [insuranceEnabled, setInsuranceEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const change = (index: number, key: keyof CollarPlayerDraft, value: string) =>
    setPlayers((current) =>
      current.map((player, position) =>
        position === index ? { ...player, [key]: value } : player,
      ),
    );
  const resize = (count: number) => {
    setPlayers((current) =>
      Array.from({ length: count }, (_, index) =>
        current[index] ? current[index] : { name: `玩家 ${index + 1}`, modelLabel: 'AI 网页' },
      ),
    );
  };
  const create = async () => {
    setSaving(true);
    try {
      onCreated(await api.createCollar({ title, players, config: { insuranceEnabled } }));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <section className="modal collar-create">
        <div className="modal-head">
          <div>
            <p className="eyebrow">独立模式</p>
            <h2>新建爆炸项圈</h2>
          </div>
          <button className="icon-btn" onClick={onCancel} aria-label="关闭建局窗口">
            ×
          </button>
        </div>
        <div className="collar-rule-note">
          <b>最后一名幸存者获胜</b>
          <p>
            每个项圈有红、蓝、黄三根线，其中一根致命。玩家拥有私人安全提示和一次保险，通过发言、情报与剪线淘汰对手。
          </p>
        </div>
        <label>
          对局名称
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          玩家人数
          <select
            aria-label="爆炸项圈玩家人数"
            value={players.length}
            onChange={(event) => resize(Number(event.target.value))}
          >
            {[4, 5, 6, 7, 8].map((count) => (
              <option key={count} value={count}>
                {count} 人
              </option>
            ))}
          </select>
        </label>
        <div className="player-editor collar-editor">
          {players.map((player, index) => (
            <div className="editor-row" key={index}>
              <b>{index + 1}</b>
              <input
                aria-label={`项圈模式${index + 1}号名称`}
                value={player.name}
                onChange={(event) => change(index, 'name', event.target.value)}
              />
              <input
                aria-label={`项圈模式${index + 1}号模型标签`}
                value={player.modelLabel}
                onChange={(event) => change(index, 'modelLabel', event.target.value)}
              />
            </div>
          ))}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={insuranceEnabled}
            onChange={(event) => setInsuranceEnabled(event.target.checked)}
          />
          每名玩家拥有一次剪线保险
        </label>
        <p className="form-note">
          致命线、安全提示和私人扫描线索均由本机随机生成，不会出现在其他玩家 Prompt 中。
        </p>
        <div className="modal-actions">
          <button className="ghost" onClick={onCancel}>
            取消
          </button>
          <button className="primary" disabled={saving} onClick={create}>
            {saving ? '创建中…' : '创建并检查项圈'}
          </button>
        </div>
      </section>
    </div>
  );
}
