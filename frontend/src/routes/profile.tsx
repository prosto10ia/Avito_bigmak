import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
  const query = useQuery({
    queryKey: ['profile', profile.id, profile.role],
    queryFn: api.dashboard,
  });
  useEffect(() => {
    if (query.data?.profile) switchRole(query.data.profile);
  }, [query.data?.profile, switchRole]);
  const mutation = useMutation({ mutationFn: api.switchRole, onSuccess: switchRole });
  const dashboardProfile = query.data?.profile ?? profile;
  return (
    <div className="page">
      <span className="eyebrow">Демо-панель жюри</span>
      <h2>Профиль</h2>
      <section className="panel profile-card">
        <div className="profile-avatar">{dashboardProfile.full_name.slice(0, 1)}</div>
        <h3>{dashboardProfile.full_name}</h3>
        <p className="muted">{dashboardProfile.job_title}</p>
        <div className="profile-grid">
          <div>
            <span>Роль</span>
            <strong>{roleLabel(dashboardProfile.role)}</strong>
          </div>
          <div>
            <span>Команда</span>
            <strong>{dashboardProfile.team}</strong>
          </div>
          <div>
            <span>Кластер</span>
            <strong>{dashboardProfile.cluster}</strong>
          </div>
          <div>
            <span>Наставник</span>
            <strong>{dashboardProfile.mentor_name}</strong>
          </div>
          <div>
            <span>Руководитель</span>
            <strong>{dashboardProfile.manager_name}</strong>
          </div>
          <div>
            <span>Доступ</span>
            <strong>hack-and-change-2026</strong>
          </div>
        </div>
      </section>
      {query.isLoading && (
        <div className="empty" role="status">
          Загружаем прогресс и награды…
        </div>
      )}
      {query.isError && (
        <div className="error" role="alert">
          Не удалось загрузить детали прогресса. Показаны данные текущего профиля.
        </div>
      )}
      <details className="panel">
        <summary>Показать прогресс и награды</summary>
        <div className="profile-grid">
          <div>
            <span>Уровень</span>
            <strong>{dashboardProfile.level}</strong>
          </div>
          <div>
            <span>Опыт</span>
            <strong>{dashboardProfile.xp} XP</strong>
          </div>
          <div>
            <span>Маскот</span>
            <strong>{dashboardProfile.mascot_stage}</strong>
          </div>
          <div>
            <span>Серия</span>
            <strong>{dashboardProfile.streak_days} дн.</strong>
          </div>
          <div>
            <span>Daily Pulse</span>
            <strong>
              {dashboardProfile.pulse_completed_today ? 'Заполнен сегодня' : 'Ещё не заполнен'}
            </strong>
          </div>
        </div>
        {query.data?.active_nodes.length ? (
          <div>
            <p className="muted">Ближайшие награды</p>
            {query.data.active_nodes.map((node) => (
              <p key={node.id}>
                {node.title} · +{node.xp_reward} XP
              </p>
            ))}
          </div>
        ) : (
          <p className="muted">Активных наград пока нет.</p>
        )}
      </details>
      <div className="section-head">
        <h3>Переключение роли</h3>
        <span className="muted">одно нажатие</span>
      </div>
      <RoleSwitcherBadge
        currentRole={dashboardProfile.role}
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
