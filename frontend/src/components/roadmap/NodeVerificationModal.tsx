import { useState } from 'react';
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
  const value = isQuiz ? answers.join(' | ') : content;
  const secret = inspectForSecrets(value);
  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="node-modal-title">
        <button className="close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <span className="eyebrow">
          {node.node_type === 'service_action' ? 'Проверка доступа' : 'Шаг адаптации'}
        </span>
        <h2 id="node-modal-title">{node.title}</h2>
        <p className="muted">{node.description}</p>
        {isServiceAction && (
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
        {isQuiz ? (
          <div className="quiz-fields">
            {['Какой дашборд проверяем?', 'Где смотреть ошибки?', 'Что отправить наставнику?'].map(
              (label, index) => (
                <label key={label}>
                  {label}
                  <input
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
          node.node_type === 'guide' && (
            <>
              <label>
                Лог `avito-cli status --check`
                <textarea
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
        {secret.blocked && !resultTicket && (
          <div className="error" role="alert">
            {secret.reason} Отправка заблокирована локально.
          </div>
        )}
        {error && !resultTicket && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!resultTicket && !isServiceAction && (
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
      </section>
    </div>
  );
}
