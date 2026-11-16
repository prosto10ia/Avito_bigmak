import { useState } from 'react';
import { EscalationSuggestionSchema } from '../../types/domain';
import { z } from 'zod';
type Escalation = z.infer<typeof EscalationSuggestionSchema>;
export function EscalationCard({ escalation }: { escalation: Escalation }) {
  const [copied, setCopied] = useState(false);
  const copyDraft = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(escalation.draft_message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <aside className="panel escalation-card">
      <strong>Нужна помощь наставника</strong>
      <p>{escalation.draft_message}</p>
      <div className="escalation-chain">Наставник → Руководитель → HR BP</div>
      <div className="actions">
        <button
          className="secondary"
          type="button"
          onClick={() => void copyDraft()}
          aria-label="Скопировать черновик сообщения для эскалации"
        >
          {copied ? 'Скопировано' : 'Скопировать черновик'}
        </button>
        <a
          className="button-link"
          href={`https://mattermost.example/${escalation.mattermost_handle}`}
          target="_blank"
          rel="noreferrer"
        >
          Открыть Mattermost
        </a>
      </div>
    </aside>
  );
}
