import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Dashboard from '../routes';
const data = {
  profile: {
    id: 'u',
    full_name: 'Иван',
    role: 'intern',
    job_title: 'Dev',
    team: 'T',
    cluster: 'Auto',
    mentor_name: 'М',
    manager_name: 'Р',
    xp: 120,
    level: 2,
    mascot_stage: 'chick',
    streak_days: 3,
    pulse_completed_today: false,
  },
  active_nodes: [
    {
      id: 'n',
      period: 'week_1',
      title: 'Войти в команду',
      description: 'Первый шаг',
      node_type: 'guide',
      xp_reward: 20,
      order_index: 1,
      status: 'active',
      verification_config: {},
    },
  ],
  upcoming_events: [],
  pulse: { completed_today: false },
};
describe('dashboard', () => {
  it('renders loading and API data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(data)));
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Войти в команду')).toBeInTheDocument());
    vi.restoreAllMocks();
  });

  it('opens and submits Daily Pulse from the dashboard', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ status: 'recorded', xp_awarded: 15, streak_days: 4 }));
      }
      return new Response(JSON.stringify(data));
    });
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Заполнить Daily Pulse/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /Заполнить Daily Pulse/ }));
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить чек-ин/ }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true),
    );
    vi.restoreAllMocks();
  });
});
