import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '../routes';
import Chat from '../routes/chat';
import Calendar from '../routes/calendar';
import Profile from '../routes/profile';
import Roadmap from '../routes/roadmap';

const profile = {
  id: 'usr_intern_1',
  full_name: 'Иван Петров',
  role: 'intern',
  job_title: 'Стажёр-разработчик',
  team: 'Платформа',
  cluster: 'Auto',
  mentor_name: 'Анна Смирнова',
  manager_name: 'Олег Кузнецов',
  xp: 120,
  level: 2,
  mascot_stage: 'chick',
  streak_days: 3,
  pulse_completed_today: false,
} as const;

const node = {
  id: 'node-1',
  period: 'week_1',
  title: 'Первый шаг',
  description: 'Проверь окружение',
  node_type: 'guide',
  xp_reward: 20,
  order_index: 1,
  status: 'active',
  verification_config: {},
};

const dashboard = {
  profile,
  active_nodes: [node],
  upcoming_events: [
    {
      id: 'event-1',
      title: 'Встреча с наставником',
      event_type: 'one_on_one',
      starts_at: new Date().toISOString(),
      duration_min: 30,
      agenda: 'План на неделю',
    },
  ],
  pulse: { completed_today: false },
};

const roadmap = {
  nodes: [node, { ...node, id: 'locked-1', title: 'Заблокированный шаг', status: 'locked' }],
  progress: { xp: 120, level: 2, mascot_stage: 'chick', streak_days: 3 },
};

function renderRoute(ui: React.ReactNode, initialEntries = ['/']) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('interactive UI polish', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opens dashboard task, meeting details, roadmap and quick links', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(dashboard)));
    const user = userEvent.setup();
    renderRoute(<Dashboard />);
    await user.click(await screen.findByRole('link', { name: /Открыть шаг «Первый шаг»/ }));
    expect(screen.getByRole('link', { name: /Открыть шаг/ })).toHaveAttribute(
      'href',
      '/roadmap?node=node-1#node-node-1',
    );
    const mascotLink = screen.getByRole('link', { name: /Открыть дорожную карту/ });
    await user.click(mascotLink);
    fireEvent.keyDown(mascotLink, { key: 'Enter' });
    await user.click(screen.getByRole('button', { name: /Встреча с наставником/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('План на неделю');
    await user.click(screen.getByRole('button', { name: 'Закрыть детали встречи' }));
    expect(screen.getByRole('link', { name: 'Быстрый переход в чат' })).toHaveAttribute(
      'href',
      '/chat',
    );
    vi.restoreAllMocks();
  });

  it('shows locked roadmap explanation and submits an active guide', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(roadmap)));
    const user = userEvent.setup();
    renderRoute(<Roadmap />);
    await user.click(await screen.findByRole('button', { name: /Заблокированный шаг/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Этот шаг пока закрыт');
    await user.click(screen.getByLabelText('Закрыть'));
    await user.click(screen.getByRole('button', { name: /Первый шаг/ }));
    await user.click(screen.getByText('Предзаполнить демо-лог'));
    expect(screen.getByRole('button', { name: 'Отправить на проверку' })).toBeEnabled();
    vi.restoreAllMocks();
  });

  it('opens a requested roadmap task from the dashboard URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(roadmap)));
    renderRoute(<Roadmap />, ['/roadmap?node=node-1#node-node-1']);
    expect(await screen.findByRole('dialog', { name: 'Первый шаг' })).toBeInTheDocument();
  });

  it('renders user chat messages, local source preview and cancellation', async () => {
    const response = {
      reply: 'Ответ из демо-RAG',
      sources: [
        {
          id: 'source-1',
          doc_title: 'Демо-плейбук',
          source_url: 'https://docs.avito.example/playbook',
          source_scope: 'playbook_global',
          version_date: '2026-01-01',
          content: 'Синтетический фрагмент документа',
        },
      ],
      conflict_warning: null,
      escalation: null,
      proposed_mcp_action: {
        tool_name: 'request_service_access',
        title: 'Доступ в Jira',
        summary: 'Auto · read',
        payload: {},
        idempotency_key: 'action-1',
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response)));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const user = userEvent.setup();
    renderRoute(<Chat />);
    await user.type(screen.getByLabelText('Вопрос помощнику'), 'Где посмотреть инструкцию?');
    await user.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(await screen.findByText('Где посмотреть инструкцию?')).toBeInTheDocument();
    expect(await screen.findByText('Ответ из демо-RAG')).toBeInTheDocument();
    await user.click(screen.getByText('Показать фрагмент синтетического демодокумента'));
    expect(screen.getByText('Синтетический фрагмент документа')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.getByRole('status')).toHaveTextContent('Действие отменено');
    vi.restoreAllMocks();
  });

  it('switches calendar month, selects today and opens event details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ events: dashboard.upcoming_events, summary: null })),
    );
    const user = userEvent.setup();
    renderRoute(<Calendar />);
    await screen.findByText('Встреча с наставником');
    await user.click(screen.getByRole('button', { name: 'Предыдущий месяц' }));
    await user.click(screen.getByRole('button', { name: 'Следующий месяц' }));
    await user.click(screen.getByRole('button', { name: 'Сегодня' }));
    await user.click(
      screen.getByRole('button', { name: /Открыть событие: Встреча с наставником/ }),
    );
    expect(
      within(screen.getByRole('dialog', { name: 'Встреча с наставником' })).getByText(
        'План на неделю',
      ),
    ).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('reveals profile rewards and reports role switch state', async () => {
    const manager = { ...profile, role: 'manager', job_title: 'Руководитель' };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async (_input, init) =>
          new Response(JSON.stringify(init?.method === 'POST' ? manager : dashboard)),
      );
    const user = userEvent.setup();
    renderRoute(<Profile />);
    await screen.findByText('Иван Петров');
    await user.click(screen.getByText('Показать прогресс и награды'));
    expect(screen.getByText('120 XP')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Демо-роль' }), 'manager');
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true),
    );
    vi.restoreAllMocks();
  });
});
