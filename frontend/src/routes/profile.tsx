import { useMutation } from '@tanstack/react-query';
import { createApiClient, roleLabel } from '../api/client';
import { RoleSwitcherBadge } from '../components/ui';
import { useAuthStore } from '../store/useAuthStore';
const api = createApiClient(() => ({
  userId: useAuthStore.getState().userId,
  role: useAuthStore.getState().role,
}));
export default function Profile() {
  const profile = useAuthStore((state) => state.profile);
  const switchRole = useAuthStore((state) => state.switchRole);
  const mutation = useMutation({ mutationFn: api.switchRole, onSuccess: switchRole });
  return (
    <div className="page">
      <span className="eyebrow">Демо-панель жюри</span>
      <h2>Профиль</h2>
      <section className="panel profile-card">
        <div className="profile-avatar">{profile.full_name.slice(0, 1)}</div>
        <h3>{profile.full_name}</h3>
        <p className="muted">{profile.job_title}</p>
        <div className="profile-grid">
          <div>
            <span>Роль</span>
            <strong>{roleLabel(profile.role)}</strong>
          </div>
          <div>
            <span>Команда</span>
            <strong>{profile.team}</strong>
          </div>
          <div>
            <span>Кластер</span>
            <strong>{profile.cluster}</strong>
          </div>
          <div>
            <span>Наставник</span>
            <strong>{profile.mentor_name}</strong>
          </div>
          <div>
            <span>Руководитель</span>
            <strong>{profile.manager_name}</strong>
          </div>
          <div>
            <span>Доступ</span>
            <strong>hack-and-change-2026</strong>
          </div>
        </div>
      </section>
      <div className="section-head">
        <h3>Переключение роли</h3>
        <span className="muted">одно нажатие</span>
      </div>
      <RoleSwitcherBadge
        currentRole={profile.role}
        onSwitchRole={(role) => mutation.mutate(role)}
      />
      {mutation.isPending && (
        <div className="empty" role="status">
          Переключаем демо-профиль…
        </div>
      )}
      {mutation.isError && (
        <div className="error" role="alert">
          Не удалось переключить роль.
        </div>
      )}
      <p className="muted synthetic-note">
        Синтетические данные для офлайн-демо. Это не production-аутентификация.
      </p>
    </div>
  );
}
