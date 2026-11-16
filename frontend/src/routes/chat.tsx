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
  const [messages, setMessages] = useState<ChatResponse[]>([]);
  const [actionResult, setActionResult] = useState<Record<string, string>>({});
  const chat = useMutation({
    mutationFn: api.chatMessage,
    onSuccess: (response) => {
      setMessages((current) => [...current, response]);
      setText('');
    },
  });
  const execute = useMutation({
    mutationFn: api.executeMcp,
    onSuccess: (response, variables) =>
      setActionResult((current) => ({
        ...current,
        [variables.idempotency_key]:
          response.external_ticket_id ?? response.ticket_id ?? 'подтверждено',
      })),
  });
  const send = (message = text) => {
    if (!message.trim()) return;
    if (inspectForSecrets(message).blocked) {
      setLocalError('Сообщение заблокировано локально: обнаружен приватный ключ или секрет.');
      return;
    }
    setLocalError('');
    chat.mutate(message);
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
      <div className="chat-list">
        {messages.length === 0 && (
          <div className="empty">Спроси про адаптацию, документы или заявку в сервис.</div>
        )}
        {messages.map((message, index) => (
          <article className="chat-message" key={`${message.reply}-${index}`}>
            {message.conflict_warning && (
              <ConflictWarningBanner conflict={message.conflict_warning} />
            )}
            <p>{message.reply}</p>
            <div>
              {message.sources.map((source) => (
                <SourceLinkChip key={source.id} source={source} />
              ))}
            </div>
            {message.escalation && <EscalationCard escalation={message.escalation} />}
            {message.proposed_mcp_action && (
              <ActionRequestWidget
                action={message.proposed_mcp_action}
                onCancel={() => undefined}
                isLoading={execute.isPending}
                resultTicket={actionResult[message.proposed_mcp_action.idempotency_key]}
                onConfirm={() => execute.mutate(message.proposed_mcp_action)}
              />
            )}
          </article>
        ))}
      </div>
      {(localError || chat.error) && (
        <div className="error" role="alert">
          {localError ||
            (chat.error instanceof ApiError && chat.error.status === 403
              ? 'Доступ ограничен политикой RBAC/ABAC для роли стажёра.'
              : chat.error instanceof ApiError && chat.error.status === 422
                ? 'Сообщение заблокировано: обнаружен секрет.'
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
