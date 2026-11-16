import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ActionRequestWidget, ConflictWarningBanner, SourceLinkChip } from '../components/ui';
import { EscalationCard } from '../components/chat/EscalationCard';
import { createApiClient, ApiError, type ChatResponse } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { inspectForSecrets } from '../lib/guardrails';
const api = createApiClient(() => ({
  userId: useAuthStore.getState().userId,
  role: useAuthStore.getState().role,
}));
const chips = [
  'Заявка на отгул',
  'Запросить доступ в Jira',
  'Как катить на staging в кластере Auto?',
  'Какие зарплатные вилки у сеньоров?',
  'Как настроить кастомный шардинг в закрытом контуре?',
];
export default function Chat() {
  const [text, setText] = useState('');
  const [localError, setLocalError] = useState('');
  const [messages, setMessages] = useState<
    Array<{ kind: 'user'; text: string } | { kind: 'assistant'; response: ChatResponse }>
  >([]);
  const [actionResult, setActionResult] = useState<Record<string, string>>({});
  const [cancelledActions, setCancelledActions] = useState<Record<string, boolean>>({});
  const [copiedAnswer, setCopiedAnswer] = useState<number | null>(null);
  const chat = useMutation({
    mutationFn: api.chatMessage,
    onSuccess: (response) => {
      setMessages((current) => [...current, { kind: 'assistant', response }]);
      setText('');
    },
  });
  const execute = useMutation({
    mutationFn: api.executeMcp,
    onSuccess: (response, variables) => {
      const ticket = response.external_ticket_id ?? response.ticket_id;
      if (!ticket) {
        setLocalError('Сервис не вернул номер заявки; действие не подтверждено.');
        return;
      }
      setActionResult((current) => ({ ...current, [variables.idempotency_key]: ticket }));
    },
  });
  const send = (message = text) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || chat.isPending) return;
    if (inspectForSecrets(trimmedMessage).blocked) {
      setLocalError('Сообщение заблокировано локально: обнаружен приватный ключ или секрет.');
      return;
    }
    setLocalError('');
    setMessages((current) => [...current, { kind: 'user', text: trimmedMessage }]);
    chat.mutate(trimmedMessage);
  };
  const copyAnswer = async (answer: string, index: number) => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(answer);
      setCopiedAnswer(index);
    } catch {
      setLocalError('Не удалось скопировать ответ. Выдели текст вручную.');
    }
  };
  return (
    <div className="page">
      <span className="eyebrow">Контекстный RAG · Human-in-the-loop</span>
      <h2>AI-помощник</h2>
      <div className="chip-row">
        {chips.map((chip) => (
          <button
            className="chip"
            key={chip}
            onClick={() => {
              setText(chip);
              send(chip);
            }}
          >
            {chip}
          </button>
        ))}
      </div>
      <div className="chat-list" aria-live="polite">
        {messages.length === 0 && (
          <div className="empty">Спроси про адаптацию, документы или заявку в сервис.</div>
        )}
        {messages.map((message, index) =>
          message.kind === 'user' ? (
            <article className="chat-message user-message" key={`user-${index}`}>
              <p>{message.text}</p>
            </article>
          ) : (
            <article className="chat-message" key={`assistant-${index}`}>
              {message.response.conflict_warning && (
                <ConflictWarningBanner conflict={message.response.conflict_warning} />
              )}
              <span className="source-chip">
                {message.response.llm_mode === 'ollama'
                  ? 'Ollama · Qwen2.5:3b'
                  : 'Резервный offline-режим'}
              </span>
              <p>{message.response.reply}</p>
              <div className="actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => void copyAnswer(message.response.reply, index)}
                  aria-label="Скопировать ответ помощника"
                >
                  {copiedAnswer === index ? 'Ответ скопирован' : 'Скопировать ответ'}
                </button>
              </div>
              <div>
                {message.response.sources.map((source) => (
                  <span key={source.id}>
                    <SourceLinkChip source={source} />
                    {typeof source.content === 'string' && source.content.trim() && (
                      <details className="source-preview">
                        <summary>Показать фрагмент синтетического демодокумента</summary>
                        <p>{source.content}</p>
                      </details>
                    )}
                  </span>
                ))}
              </div>
              {message.response.escalation && (
                <EscalationCard escalation={message.response.escalation} />
              )}
              {message.response.proposed_mcp_action &&
                (cancelledActions[message.response.proposed_mcp_action.idempotency_key] ? (
                  <div className="empty" role="status">
                    Действие отменено. Никаких изменений не выполнено.
                  </div>
                ) : (
                  <ActionRequestWidget
                    action={message.response.proposed_mcp_action}
                    onCancel={() =>
                      setCancelledActions((current) => ({
                        ...current,
                        [message.response.proposed_mcp_action!.idempotency_key]: true,
                      }))
                    }
                    isLoading={execute.isPending}
                    resultTicket={
                      actionResult[message.response.proposed_mcp_action.idempotency_key]
                    }
                    onConfirm={() => {
                      setLocalError('');
                      execute.mutate(message.response.proposed_mcp_action!);
                    }}
                  />
                ))}
            </article>
          ),
        )}
        {chat.isPending && (
          <div className="empty" role="status">
            Помощник готовит ответ…
          </div>
        )}
      </div>
      {(localError || chat.error || execute.error) && (
        <div className="error" role="alert">
          {localError ||
            (chat.error instanceof ApiError && chat.error.status === 403
              ? 'Доступ ограничен политикой RBAC/ABAC для роли стажёра.'
              : chat.error instanceof ApiError && chat.error.status === 422
                ? 'Сообщение заблокировано: обнаружен секрет.'
                : execute.error
                  ? 'Не удалось подтвердить действие. Ничего не изменено, попробуй ещё раз.'
                  : 'Не удалось получить ответ. Попробуй ещё раз.')}
        </div>
      )}
      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <label className="sr-only" htmlFor="chat-input">
          Вопрос помощнику
        </label>
        <textarea
          id="chat-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Напиши вопрос…"
          rows={2}
        />
        <button disabled={chat.isPending || !text.trim()}>
          {chat.isPending ? 'Думаю…' : 'Отправить'}
        </button>
      </form>
    </div>
  );
}
