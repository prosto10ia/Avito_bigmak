import { describe, expect, it, vi } from 'vitest';
import { createApiClient, DEMO_ACCESS_CODE } from '../api/client';
const auth = () => ({ userId: 'usr_intern_1' as const, role: 'intern' as const });
const dashboard = {
  profile: {
    id: 'u',
    full_name: 'Иван',
    role: 'intern',
    job_title: 'Dev',
    team: 'T',
    cluster: 'Auto',
    mentor_name: 'М',
    manager_name: 'Р',
    xp: 1,
    level: 1,
    mascot_stage: 'egg',
    streak_days: 1,
    pulse_completed_today: false,
  },
  active_nodes: [],
  upcoming_events: [],
  pulse: { completed_today: false },
};
describe('api client', () => {
  it('sends required headers and validates response', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(dashboard), { status: 200 }));
    await createApiClient(auth).dashboard();
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get('X-Demo-Access-Code')).toBe(DEMO_ACCESS_CODE);
    expect(headers.get('X-User-Role')).toBe('intern');
    fetchMock.mockRestore();
  });
  it('rejects HTTP errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Нет доступа', code: 'RBAC_ROLE_DENIED' }), {
        status: 403,
      }),
    );
    await expect(createApiClient(auth).dashboard()).rejects.toMatchObject({
      status: 403,
      code: 'RBAC_ROLE_DENIED',
    });
    vi.restoreAllMocks();
  });
});
