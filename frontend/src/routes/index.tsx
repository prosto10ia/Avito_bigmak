import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createApiClient, roleLabel } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { DailyPulseModal, MascotProgressHeader } from '../components/ui';

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
  const queryClient = useQueryClient();
  const [pulseOpen, setPulseOpen] = useState(false);
  const pulse = useMutation({
    mutationFn: api.submitPulse,
    onSuccess: (result) => {
      const current = useAuthStore.getState().profile;
      setProfile({
        ...current,
        pulse_completed_today: true,
        xp: current.xp + result.xp_awarded,
        streak_days: result.streak_days ?? current.streak_days,
      });
      setPulseOpen(false);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
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
          <section className="panel timeline-card">
            <p className="muted">
              {roleLabel(profile.role)}, {profile.full_name}
            </p>
            <h2>Привет, {profile.full_name.split(' ')[0]}!</h2>
            <p className="muted">
              {data.timeline?.label ?? 'Твой путь адаптации'} ·{' '}
              {data.timeline
                ? new Intl.DateTimeFormat('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    weekday: 'long',
                  }).format(new Date(`${data.timeline.date}T12:00:00`))
                : 'сегодня'}
            </p>
            <button
              onClick={() => setPulseOpen(true)}
              disabled={data.pulse.completed_today || profile.pulse_completed_today}
            >
              {data.pulse.completed_today || profile.pulse_completed_today
                ? 'Daily Pulse заполнен'
                : 'Заполнить Daily Pulse · +15 XP'}
            </button>
          </section>
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
          {pulseOpen && (
            <DailyPulseModal
              isOpen
              onClose={() => setPulseOpen(false)}
              onSubmit={(mood_score, blocker_tags) => pulse.mutate({ mood_score, blocker_tags })}
              disabled={data.pulse.completed_today || profile.pulse_completed_today}
            />
          )}
        </>
      )}
    </div>
  );
}
