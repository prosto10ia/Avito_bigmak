import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createApiClient } from '../api/client';
import type { CalendarEvent } from '../types/domain';
import { DailyPulseModal } from '../components/ui';
import { useAuthStore } from '../store/useAuthStore';
const api = createApiClient(() => ({
  userId: useAuthStore.getState().userId,
  role: useAuthStore.getState().role,
}));
const eventLabels: Record<string, string> = {
  one_on_one: '1:1',
  deadline: 'Дедлайн',
  team_sync: 'Синк команды',
  equator_defense: 'Экватор',
};
export default function Calendar() {
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const queryClient = useQueryClient();
  const [pulseOpen, setPulseOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [month] = useState(new Date());
  const query = useQuery({ queryKey: ['calendar', profile.id], queryFn: api.calendar });
  const events = (query.data?.events ?? []) as CalendarEvent[];
  const summaryMutation = useMutation({
    mutationFn: api.calendarSummary,
    onSuccess: (data) => setSummary(data.summary || data.report || ''),
  });
  const pulse = useMutation({
    mutationFn: api.submitPulse,
    onSuccess: (data) => {
      setProfile({
        ...useAuthStore.getState().profile,
        pulse_completed_today: true,
        xp: useAuthStore.getState().profile.xp + data.xp_awarded,
        streak_days: data.streak_days ?? useAuthStore.getState().profile.streak_days,
      });
      setPulseOpen(false);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  const days = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(year, m, 1).getDay() || 7;
    return Array.from({ length: new Date(year, m + 1, 0).getDate() + first - 1 }, (_, i) =>
      i < first - 1 ? null : i - first + 2,
    );
  }, [month]);
  const eventCount = (day: number) =>
    events.filter((event) => new Date(event.starts_at).getDate() === day).length;
  return (
    <div className="page">
      <div className="section-head">
        <div>
          <span className="eyebrow">Встречи и дедлайны</span>
          <h2>Календарь</h2>
        </div>
        <button onClick={() => setPulseOpen(true)} disabled={profile.pulse_completed_today}>
          Daily Pulse
        </button>
      </div>
      {query.isLoading && (
        <div className="empty" role="status">
          Загружаем календарь…
        </div>
      )}
      {query.isError && (
        <div className="error" role="alert">
          Не удалось загрузить календарь.
        </div>
      )}
      <section className="calendar-grid" aria-label="Календарь месяца">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
          <strong key={day}>{day}</strong>
        ))}
        {days.map((day, index) => (
          <div className="calendar-day" key={`${day}-${index}`}>
            {day && (
              <>
                <span>{day}</span>
                {eventCount(day) > 0 && <b>{eventCount(day)}</b>}
              </>
            )}
          </div>
        ))}
      </section>
      <div className="section-head">
        <h3>Список событий</h3>
        <span className="muted">{events.length}</span>
      </div>
      {events.length ? (
        events.map((event) => (
          <div className={`event event-${event.event_type}`} key={event.id}>
            <strong>{event.title}</strong>
            <div className="muted">
              {eventLabels[event.event_type] ?? event.event_type} ·{' '}
              {new Date(event.starts_at).toLocaleString('ru-RU')}
            </div>
          </div>
        ))
      ) : (
        <div className="empty">Событий пока нет.</div>
      )}
      <div className="summary-actions">
        <button
          onClick={() => summaryMutation.mutate('one_on_one')}
          disabled={summaryMutation.isPending}
        >
          Собрать конспект к 1:1
        </button>
        <button
          className="secondary"
          onClick={() => summaryMutation.mutate('equator')}
          disabled={summaryMutation.isPending}
        >
          Черновик к Экватору
        </button>
      </div>
      {summary && (
        <article className="panel summary">
          <h3>AI-конспект</h3>
          <pre>{summary}</pre>
        </article>
      )}
      {pulseOpen && (
        <DailyPulseModal
          isOpen
          onClose={() => setPulseOpen(false)}
          onSubmit={(mood_score, blocker_tags) => pulse.mutate({ mood_score, blocker_tags })}
          disabled={profile.pulse_completed_today}
        />
      )}
    </div>
  );
}
