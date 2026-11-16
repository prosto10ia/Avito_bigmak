import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import Chat from '../routes/chat';
const response = {
  reply: 'Используй кластерную инструкцию.',
  sources: [
    {
      id: 's1',
      doc_title: 'Playbook',
      source_url: 'https://example.com',
      source_scope: 'playbook_global',
      version_date: '2026-01-01',
    },
  ],
  conflict_warning: {
    topic_key: 'deploy',
    summary: 'Версии расходятся',
    playbook_claim: 'A',
    cluster_claim: 'B',
    recommended_source_url: 'https://example.com',
  },
  escalation: null,
  proposed_mcp_action: {
    tool_name: 'request_service_access',
    title: 'Доступ в Jira',
    summary: 'Auto · read',
    payload: {},
    idempotency_key: 'key-1',
  },
};
it('renders conflict and confirms MCP action once', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(
      async (input) =>
        new Response(
          String(input).endsWith('/chat/message')
            ? JSON.stringify(response)
            : JSON.stringify({ status: 'completed', external_ticket_id: 'ACC-2026-001' }),
          { status: 200 },
        ),
    );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Запросить доступ в Jira' }));
  await screen.findByText('Найдена коллизия в документации');
  const confirm = await screen.findByRole('button', { name: 'Подтвердить' });
  await user.click(confirm);
  await waitFor(() => expect(screen.getByText(/ACC-2026-001/)).toBeInTheDocument());
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/mcp/execute'))).toHaveLength(
    1,
  );
  fetchMock.mockRestore();
});
