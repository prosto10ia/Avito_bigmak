import { describe, expect, it } from 'vitest';
import { useAuthStore } from '../store/useAuthStore';
describe('auth store', () => {
  it('switches demo role and identity', () => {
    useAuthStore
      .getState()
      .switchRole({ ...useAuthStore.getState().profile, id: 'usr_buddy_1', role: 'buddy' });
    expect(useAuthStore.getState().role).toBe('buddy');
    expect(useAuthStore.getState().userId).toBe('usr_buddy_1');
    useAuthStore
      .getState()
      .setProfile({ ...useAuthStore.getState().profile, id: 'usr_intern_1', role: 'intern' });
    expect(useAuthStore.getState().role).toBe('intern');
  });
});
