import { useState } from 'react';
import { EscalationSuggestionSchema } from '../../types/domain';
import { z } from 'zod';
type Escalation = z.infer<typeof EscalationSuggestionSchema>;
export function EscalationCard({ escalation }: { escalation: Escalation }) {
  const [copied, setCopied] = useState(false);
  return (
    <aside className="panel escalation-card">
      <strong>Нужна помощь наставника</strong>
      <p>{escalation.draft_message}</p>
      <div className="escalation-chain">Наставник → Руководитель → HR BP</div>
      <div className="actions">
        <button
          className="secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(escalation.draft_message);
            setCopied(true);
          }}
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
