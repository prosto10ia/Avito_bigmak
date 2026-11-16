import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createApiClient, roleLabel } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { MascotProgressHeader } from '../components/ui';

const api = createApiClient(() => ({
  userId: useAuthStore.getState().userId,
  role: useAuthStore.getState().role,
}));
export default function Dashboard() {
  const profile = useAuthStore((s) => s.profile);
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard,
  });
  const data = query.data;
  const setProfile = useAuthStore((s) => s.setProfile);
  useEffect(() => {
    if (data?.profile) setProfile(data.profile);
  }, [data?.profile, setProfile]);
  return (
    <div className="page">
      {query.isLoading && (
        <div className="empty" role="status">
          Загружаем твой прогресс…
        </div>
      )}
      {query.isError && (
        <div className="error" role="alert">
          Не удалось загрузить дашборд. Проверь соединение и повтори попытку.
        </div>
      )}
      {data && (
        <>
          <p className="muted">
            {roleLabel(profile.role)}, {profile.full_name}
          </p>
          <MascotProgressHeader
            xp={data.mascot?.xp ?? data.profile.xp}
            level={data.mascot?.level ?? data.profile.level}
            mascotStage={data.mascot?.mascot_stage ?? data.profile.mascot_stage}
            streakDays={data.mascot?.streak_days ?? data.profile.streak_days}
          />
          <div className="section-head">
            <h3>Ближайшие шаги</h3>
            <span className="muted">{data.active_nodes.length} активных</span>
          </div>
          <div className="node-list">
            {data.active_nodes.map((node) => (
              <div className="panel" key={node.id}>
                <strong>{node.title}</strong>
                <p className="muted">{node.description}</p>
              </div>
            ))}
          </div>
          <div className="section-head">
            <h3>Следующие встречи</h3>
          </div>
          {data.upcoming_events.length ? (
            data.upcoming_events.map((event) => (
              <div className="event" key={event.id}>
                <strong>{event.title}</strong>
                <div className="muted">{new Date(event.starts_at).toLocaleString('ru-RU')}</div>
              </div>
            ))
          ) : (
            <div className="empty">Встреч пока нет — отличный момент для фокуса.</div>
          )}
        </>
      )}
    </div>
  );
}
