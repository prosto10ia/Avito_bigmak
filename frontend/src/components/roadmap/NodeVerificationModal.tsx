import { useEffect, useState } from 'react';
import type { RoadmapNode } from '../../types/domain';
import { inspectForSecrets } from '../../lib/guardrails';
import { ActionRequestWidget } from '../ui';

export function NodeVerificationModal({
  node,
  onClose,
  onVerify,
  isLoading,
  error,
  resultTicket,
}: {
  node: RoadmapNode;
  onClose: () => void;
  onVerify: (artifactType: string, content: string) => void;
  isLoading: boolean;
  error?: string;
  resultTicket?: string;
}) {
  const [content, setContent] = useState('');
  const [answers, setAnswers] = useState(['', '', '']);
  const isQuiz = node.node_type === 'quiz';
  const isServiceAction = node.node_type === 'service_action';
  const isReadOnly = node.status !== 'active';
  const statusLabel =
    node.status === 'locked'
      ? 'Заблокирован'
      : node.status === 'waiting_approval'
        ? 'Ожидает проверки наставника'
        : node.status === 'done'
          ? 'Завершён'
          : 'Доступен для прохождения';
  const value = isQuiz ? answers.join(' | ') : content;
  const secret = inspectForSecrets(value);

  useEffect(() => {
    setContent('');
    setAnswers(['', '', '']);
  }, [node.id]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="node-modal-title"
        aria-describedby="node-modal-description"
      >
        <button className="close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <span className="eyebrow">
          {isServiceAction ? 'Проверка доступа' : 'Шаг адаптации'} · {statusLabel}
        </span>
        <h2 id="node-modal-title">{node.title}</h2>
        <p id="node-modal-description" className="muted">
          {node.description}
        </p>
        {node.status === 'locked' && (
          <div className="panel" role="status">
            <strong>Этот шаг пока закрыт</strong>
            <p className="muted">
              Сначала заверши предыдущий шаг маршрута. После подтверждения зависимости узел
              откроется автоматически.
            </p>
          </div>
        )}
        {node.status === 'waiting_approval' && (
          <div className="panel" role="status">
            <strong>Артефакт уже отправлен</strong>
            <p className="muted">Дождись проверки наставника — повторная отправка недоступна.</p>
          </div>
        )}
        {node.status === 'done' && (
          <div className="panel" role="status">
            <strong>Шаг выполнен · +{node.xp_reward} XP</strong>
            {node.verified_artifact && (
              <p className="muted">Артефакт сохранён для демо-проверки.</p>
            )}
            {node.verification_feedback && <p className="muted">{node.verification_feedback}</p>}
          </div>
        )}
        {isServiceAction && !isReadOnly && (
          <ActionRequestWidget
            action={{
              tool_name: 'request_service_access',
              title: 'Запросить доступ в Jira',
              summary: 'Jira · Auto · read. Заявка будет создана в офлайн-демо.',
              payload: { service_name: 'jira', project_key: 'AUTO', access_level: 'read' },
              idempotency_key: `roadmap:${node.id}`,
            }}
            onConfirm={() => onVerify('service_access', '')}
            onCancel={onClose}
            isLoading={isLoading}
            resultTicket={resultTicket}
          />
        )}
        {!isReadOnly && isQuiz ? (
          <div className="quiz-fields">
            {['Какой дашборд проверяем?', 'Где смотреть ошибки?', 'Что отправить наставнику?'].map(
              (label, index) => (
                <label key={label} htmlFor={`quiz-answer-${index}`}>
                  {label}
                  <input
                    id={`quiz-answer-${index}`}
                    value={answers[index]}
                    onChange={(event) =>
                      setAnswers((current) =>
                        current.map((item, i) => (i === index ? event.target.value : item)),
                      )
                    }
                  />
                </label>
              ),
            )}
          </div>
        ) : (
          !isReadOnly &&
          node.node_type === 'guide' && (
            <>
              <label htmlFor="node-artifact-content">
                Лог `avito-cli status --check`
                <textarea
                  id="node-artifact-content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Вставь вывод команды или описание скриншота"
                />
              </label>
              <button
                className="secondary"
                onClick={() => setContent('avito-cli: OK\nstash_ssh: authenticated')}
              >
                Предзаполнить демо-лог
              </button>
            </>
          )
        )}
        {resultTicket && !isServiceAction && (
          <div className="panel" role="status">
            <strong>Заявка {resultTicket} создана</strong>
            <p className="muted">Действие подтверждено в офлайн-демо.</p>
          </div>
        )}
        {secret.blocked && !resultTicket && !isReadOnly && (
          <div className="error" role="alert">
            {secret.reason} Отправка заблокирована локально.
          </div>
        )}
        {error && !resultTicket && !isReadOnly && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!resultTicket && !isServiceAction && !isReadOnly && (
          <div className="actions">
            <button className="secondary" onClick={onClose}>
              Отмена
            </button>
            <button
              onClick={() =>
                onVerify(
                  isQuiz
                    ? 'quiz_answers'
                    : node.node_type === 'guide'
                      ? 'cli_log'
                      : 'service_access',
                  value,
                )
              }
              disabled={
                isLoading || secret.blocked || (!value && node.node_type !== 'service_action')
              }
            >
              {isLoading ? 'Проверяем…' : 'Отправить на проверку'}
            </button>
          </div>
        )}
        {resultTicket && !isServiceAction && (
          <div className="actions">
            <button onClick={onClose}>Готово</button>
          </div>
        )}
        {isReadOnly && (
          <div className="actions">
            <button onClick={onClose}>Закрыть</button>
          </div>
        )}
      </section>
    </div>
  );
}
