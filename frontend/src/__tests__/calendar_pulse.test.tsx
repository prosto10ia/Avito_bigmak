import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Calendar from '../routes/calendar';
const calendar = { events: [], summary: null };
describe('calendar and pulse', () => {
  it('submits Daily Pulse with blockers and disables it for today', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async (input) =>
          new Response(
            String(input).endsWith('/calendar')
              ? JSON.stringify(calendar)
              : JSON.stringify({ status: 'completed', xp_awarded: 15, streak_days: 4 }),
            { status: 200 },
          ),
      );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Calendar />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Daily Pulse' }));
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: 'Нет доступа к сервису' }));
    await user.click(screen.getByRole('button', { name: /Сохранить чек-ин/ }));
    expect(await screen.findByRole('button', { name: 'Daily Pulse' })).toBeDisabled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/pulse'))).toBe(true);
    fetchMock.mockRestore();
  });
});
