import { NavLink } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  CircleUserRound,
  House,
  Map,
  MessageCircle,
  ShieldAlert,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type {
  ConflictWarning,
  ProposedMCPAction,
  RoadmapNode,
  Role,
  SourceCitation,
} from '../../types/domain';
import { roleLabel } from '../../api/client';
import { platformLabel } from '../../lib/platform';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <header className="topbar">
        <div>
          <span className="eyebrow">AI-buddy · synthetic demo</span>
          <h1>Путь стажёра</h1>
        </div>
        <span className="demo-label">
          <span>Данные синтетические</span> · {platformLabel()}
        </span>
      </header>
      <main>{children}</main>
    </div>
  );
}
export function BottomNav({ activeTab }: { activeTab: string }) {
  const links = [
    ['/', 'Домой', House],
    ['/roadmap', 'Путь', Map],
    ['/chat', 'AI-помощник', MessageCircle],
    ['/calendar', 'Календарь', CalendarDays],
    ['/profile', 'Профиль', CircleUserRound],
  ] as const;
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {links.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} className={activeTab === to ? 'active' : ''}>
          <Icon size={19} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
export function MascotProgressHeader({
  xp,
  level,
  mascotStage,
  streakDays,
}: {
  xp: number;
  level: number;
  mascotStage: string;
  streakDays: number;
}) {
  return (
    <section className="mascot-card">
      <div className="mascot">
        {mascotStage === 'legend'
          ? '🦊'
          : mascotStage === 'wingman'
            ? '🦅'
            : mascotStage === 'chick'
              ? '🐣'
              : '🥚'}
      </div>
      <div>
        <span className="eyebrow">Твой маскот</span>
        <h2>Уровень {level}</h2>
        <p>
          {xp} XP · серия {streakDays} дн.
        </p>
        <progress value={xp % 100} max="100" aria-label={`${xp} из 100 XP до следующего уровня`} />
      </div>
    </section>
  );
}
export function RoadmapNodeCard({
  node,
  onSelect,
}: {
  node: RoadmapNode;
  onSelect: (node: RoadmapNode) => void;
}) {
  return (
    <button
      className={`node-card node-${node.status}`}
      onClick={() => onSelect(node)}
      disabled={node.status === 'locked'}
      aria-label={`${node.title}, статус ${node.status}`}
    >
      <span className="node-icon">
        {node.status === 'done' ? (
          <Check size={18} />
        ) : node.node_type === 'quiz' ? (
          '✦'
        ) : node.node_type === 'service_action' ? (
          '↗'
        ) : (
          '○'
        )}
      </span>
      <span>
        <strong>{node.title}</strong>
        <small>{node.description}</small>
      </span>
      <b>+{node.xp_reward} XP</b>
    </button>
  );
}
export function ActionRequestWidget({
  action,
  onConfirm,
  onCancel,
  isLoading,
  resultTicket,
}: {
  action: ProposedMCPAction;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  resultTicket?: string;
}) {
  return (
    <div className="action-widget">
      <span className="eyebrow">Симулированное действие</span>
      <h3>{resultTicket ? `Заявка ${resultTicket} создана` : action.title}</h3>
      <p>{resultTicket ? 'Действие подтверждено в демо-среде.' : action.summary}</p>
      {!resultTicket && (
        <div className="actions">
          <button onClick={onCancel} className="secondary">
            Отмена
          </button>
          <button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Отправляем…' : 'Подтвердить'}
          </button>
        </div>
      )}
    </div>
  );
}
export function SourceLinkChip({ source }: { source: SourceCitation }) {
  return (
    <a className="source-chip" href={source.source_url} target="_blank" rel="noreferrer">
      {source.doc_title} · {source.version_date}
    </a>
  );
}
export function ConflictWarningBanner({ conflict }: { conflict: ConflictWarning }) {
  return (
    <aside className="warning" role="alert">
      <ShieldAlert size={18} />
      <div>
        <strong>Найдена коллизия в документации</strong>
        <p>{conflict.summary}</p>
      </div>
    </aside>
  );
}
export function DailyPulseModal({
  isOpen,
  onClose,
  onSubmit,
  disabled = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (score: number, blockerTags: string[]) => void;
  disabled?: boolean;
}) {
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const blockerOptions = ['Долго жду ревью', 'Нет доступа к сервису', 'Сложная документация'];
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="pulse-title">
        <button className="close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 id="pulse-title">Как прошёл день?</h2>
        <div className="score-row">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              aria-pressed={selectedScore === score}
              className={selectedScore === score ? 'selected' : ''}
              onClick={() => setSelectedScore(score)}
            >
              {score}
            </button>
          ))}
        </div>
        {selectedScore !== null && selectedScore <= 2 && (
          <div className="tag-list">
            <p className="muted">Что мешает двигаться дальше?</p>
            {blockerOptions.map((tag) => (
              <button
                key={tag}
                className={tags.includes(tag) ? 'selected' : 'secondary'}
                onClick={() =>
                  setTags((current) =>
                    current.includes(tag)
                      ? current.filter((item) => item !== tag)
                      : [...current, tag],
                  )
                }
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        <button
          disabled={disabled || selectedScore === null}
          onClick={() => selectedScore && onSubmit(selectedScore, tags)}
        >
          {disabled ? 'Сегодня уже заполнено' : 'Сохранить чек-ин · +15 XP'}
        </button>
      </section>
    </div>
  );
}
export function RoleSwitcherBadge({
  currentRole,
  onSwitchRole,
}: {
  currentRole: Role;
  onSwitchRole: (role: Role) => void;
}) {
  return (
    <label className="role-switcher">
      Роль{' '}
      <select
        value={currentRole}
        onChange={(e) => onSwitchRole(e.target.value as Role)}
        aria-label="Демо-роль"
      >
        {(['intern', 'buddy', 'manager'] as Role[]).map((role) => (
          <option key={role} value={role}>
            {roleLabel(role)}
          </option>
        ))}
      </select>
    </label>
  );
}
