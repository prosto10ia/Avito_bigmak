import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Roadmap from '../routes/roadmap';
import { calculateMascotStage, canUnlockNode } from '../lib/gamification';
import { inspectForSecrets } from '../lib/guardrails';
const node = {
  id: 'n1',
  period: 'week_1',
  title: 'Настрой avito-cli и ключи в Stash',
  description: 'Проверка CLI',
  node_type: 'guide',
  xp_reward: 50,
  order_index: 1,
  status: 'active',
  verification_config: {},
};
const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
describe('roadmap', () => {
  it('calculates mascot stages and dependency unlocks', () => {
    expect(calculateMascotStage(0)).toBe('egg');
    expect(calculateMascotStage(600)).toBe('legend');
    expect(
      canUnlockNode(
        { ...node, status: 'locked', verification_config: { depends_on_node_id: 'n0' } } as never,
        { n0: 'done' },
      ),
    ).toBe(true);
  });
  it('blocks private keys and verifies a node once', async () => {
    expect(inspectForSecrets('-----BEGIN OPENSSH PRIVATE KEY-----').blocked).toBe(true);
    expect(inspectForSecrets('avito-cli: OK').blocked).toBe(false);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input) =>
        new Response(
          String(input).endsWith('/roadmap')
            ? JSON.stringify({
                nodes: [node],
                progress: { xp: 120, level: 2, mascot_stage: 'chick', streak_days: 3 },
              })
            : JSON.stringify({ status: 'done', xp_awarded: 50 }),
          { status: 200 },
        ),
    );
    wrap(<Roadmap />);
    await userEvent.setup().click(await screen.findByRole('button', { name: /Настрой avito-cli/ }));
    await userEvent.setup().click(screen.getByText('Предзаполнить демо-лог'));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Отправить на проверку' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    fetchMock.mockRestore();
  });
});
