import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createApiClient, roleLabel } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { DailyPulseModal, MascotProgressHeader } from '../components/ui';
import type { CalendarEvent } from '../types/domain';

const api = createApiClient(() => ({
  userId: useAuthStore.getState().userId,
  role: useAuthStore.getState().role,
}));
export default function Dashboard() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard,
  });
  const data = query.data;
  const setProfile = useAuthStore((s) => s.setProfile);
  const queryClient = useQueryClient();
  const [pulseOpen, setPulseOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
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
          <div
            className="mascot-link"
            role="link"
            tabIndex={0}
            onClick={() => navigate('/roadmap')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate('/roadmap');
              }
            }}
            aria-label="Открыть дорожную карту и прогресс маскота"
          >
            <MascotProgressHeader
              xp={data.mascot?.xp ?? data.profile.xp}
              level={data.mascot?.level ?? data.profile.level}
              mascotStage={data.mascot?.mascot_stage ?? data.profile.mascot_stage}
              streakDays={data.mascot?.streak_days ?? data.profile.streak_days}
            />
          </div>
          <div className="section-head">
            <h3>Ближайшие шаги</h3>
            <span className="muted">{data.active_nodes.length} активных</span>
          </div>
          <div className="node-list">
            {data.active_nodes.map((node) => (
              <Link
                className="panel"
                key={node.id}
                to={`/roadmap?node=${encodeURIComponent(node.id)}#node-${encodeURIComponent(node.id)}`}
                aria-label={`Открыть шаг «${node.title}» на дорожной карте`}
              >
                <strong>{node.title}</strong>
                <p className="muted">{node.description}</p>
              </Link>
            ))}
          </div>
          <div className="section-head upcoming-header">
            <h3>Следующие встречи</h3>
            <Link className="button-link" to="/calendar">
              Открыть календарь
            </Link>
          </div>
          {data.upcoming_events.length ? (
            data.upcoming_events.map((event) => (
              <button className="event" key={event.id} onClick={() => setSelectedEvent(event)}>
                <strong>{event.title}</strong>
                <div className="muted">{new Date(event.starts_at).toLocaleString('ru-RU')}</div>
              </button>
            ))
          ) : (
            <div className="empty">Встреч пока нет — отличный момент для фокуса.</div>
          )}
          <nav className="quick-links" aria-label="Быстрые ссылки">
            <Link className="button-link quick-link" to="/chat" aria-label="Быстрый переход в чат">
              Задать вопрос AI-помощнику
            </Link>
            <Link
              className="button-link quick-link"
              to="/profile"
              aria-label="Быстрый переход в профиль"
            >
              Открыть профиль
            </Link>
          </nav>
          {selectedEvent && (
            <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}>
              <section
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="event-title"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  className="close"
                  onClick={() => setSelectedEvent(null)}
                  aria-label="Закрыть детали встречи"
                >
                  ×
                </button>
                <span className="eyebrow">Детали встречи</span>
                <h2 id="event-title">{selectedEvent.title}</h2>
                <p>
                  <strong>Тип:</strong> {selectedEvent.event_type}
                </p>
                <p>
                  <strong>Когда:</strong>{' '}
                  {new Date(selectedEvent.starts_at).toLocaleString('ru-RU')}
                </p>
                <p>
                  <strong>Длительность:</strong> {selectedEvent.duration_min} мин.
                </p>
                {selectedEvent.agenda && (
                  <p>
                    <strong>Повестка:</strong> {selectedEvent.agenda}
                  </p>
                )}
                <Link to="/calendar" onClick={() => setSelectedEvent(null)}>
                  Перейти в календарь
                </Link>
              </section>
            </div>
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
