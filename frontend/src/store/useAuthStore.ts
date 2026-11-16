import { create } from 'zustand';
import type { Role, UserProfile } from '../types/domain';

const demoProfile: UserProfile = {
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
};
type AuthState = {
  profile: UserProfile;
  userId: string;
  role: Role;
  setProfile: (profile: UserProfile) => void;
  switchRole: (profile: UserProfile) => void;
};
export const useAuthStore = create<AuthState>((set) => ({
  profile: demoProfile,
  userId: demoProfile.id,
  role: demoProfile.role,
  setProfile: (profile) => set({ profile, userId: profile.id, role: profile.role }),
  switchRole: (profile) => set({ profile, userId: profile.id, role: profile.role }),
}));
