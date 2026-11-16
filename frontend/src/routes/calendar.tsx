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

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function eventDateKey(startsAt: string) {
  const date = new Date(startsAt);
  return Number.isNaN(date.getTime()) ? null : dateKey(date);
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date);
}

export default function Calendar() {
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const queryClient = useQueryClient();
  const [pulseOpen, setPulseOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const query = useQuery({ queryKey: ['calendar', profile.id], queryFn: api.calendar });
  const events = useMemo(() => (query.data?.events ?? []) as CalendarEvent[], [query.data?.events]);
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
    const firstWeekday = new Date(year, m, 1).getDay() || 7;
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    return Array.from({ length: daysInMonth + firstWeekday - 1 }, (_, index) => {
      if (index < firstWeekday - 1) return null;
      return new Date(year, m, index - firstWeekday + 2);
    });
  }, [month]);
  const monthEvents = useMemo(
    () =>
      events.filter((event) =>
        eventDateKey(event.starts_at)?.startsWith(
          `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-`,
        ),
      ),
    [events, month],
  );
  const eventCount = (day: Date) =>
    monthEvents.filter((event) => eventDateKey(event.starts_at) === dateKey(day)).length;
  const visibleEvents = selectedDay
    ? events.filter((event) => eventDateKey(event.starts_at) === selectedDay)
    : monthEvents;
  const goToMonth = (offset: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    setSelectedDay(null);
  };
  const goToToday = () => {
    const today = new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(dateKey(today));
  };
  return (
    <div className="page">
      <div className="section-head calendar-page-header">
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
          Не удалось загрузить календарь.{' '}
          <button className="secondary" onClick={() => query.refetch()}>
            Повторить
          </button>
        </div>
      )}
      <section aria-label="Управление месяцем" className="calendar-toolbar">
        <button
          className="month-step month-step-prev"
          aria-label="Предыдущий месяц"
          onClick={() => goToMonth(-1)}
        >
          ←
        </button>
        <h3 className="calendar-month-title" aria-live="polite">
          {formatMonth(month)}
        </h3>
        <div className="calendar-month-actions">
          <button className="secondary calendar-today" onClick={goToToday}>
            Сегодня
          </button>{' '}
          <button
            className="month-step month-step-next"
            aria-label="Следующий месяц"
            onClick={() => goToMonth(1)}
          >
            →
          </button>
        </div>
      </section>
      <section className="calendar-grid" aria-label={`Календарь: ${formatMonth(month)}`}>
        {weekdays.map((day) => (
          <strong key={day}>{day}</strong>
        ))}
        {days.map((day, index) => (
          <button
            className={`calendar-day${day && selectedDay === dateKey(day) ? ' selected' : ''}`}
            key={day ? dateKey(day) : `empty-${index}`}
            disabled={!day}
            aria-label={day ? `${day.getDate()} ${formatMonth(day)}` : undefined}
            aria-pressed={day ? selectedDay === dateKey(day) : undefined}
            onClick={() => day && setSelectedDay(dateKey(day))}
          >
            {day && (
              <>
                <span>{day.getDate()}</span>
                {eventCount(day) > 0 && (
                  <b aria-label={`Событий: ${eventCount(day)}`}>{eventCount(day)}</b>
                )}
              </>
            )}
          </button>
        ))}
      </section>
      <div className="section-head">
        <h3>Список событий</h3>
        <span className="muted">{visibleEvents.length}</span>
      </div>
      {selectedDay && (
        <button className="secondary" onClick={() => setSelectedDay(null)}>
          Показать весь месяц
        </button>
      )}
      {visibleEvents.length ? (
        visibleEvents.map((event) => (
          <button
            className={`event event-${event.event_type}`}
            key={event.id}
            onClick={() => setSelectedEvent(event)}
            aria-label={`Открыть событие: ${event.title}`}
          >
            <strong>{event.title}</strong>
            <div className="muted">
              {eventLabels[event.event_type] ?? event.event_type} ·{' '}
              {new Date(event.starts_at).toLocaleString('ru-RU')}
            </div>
          </button>
        ))
      ) : (
        <div className="empty">
          {selectedDay ? 'На выбранный день событий нет.' : 'В этом месяце событий пока нет.'}
        </div>
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
      {summaryMutation.isError && (
        <div className="error" role="alert">
          Не удалось собрать саммари. Попробуйте ещё раз.
        </div>
      )}
      {pulse.isError && (
        <div className="error" role="alert">
          Не удалось сохранить Daily Pulse. Попробуйте ещё раз.
        </div>
      )}
      {selectedEvent && (
        <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-event-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="close" onClick={() => setSelectedEvent(null)} aria-label="Закрыть">
              ×
            </button>
            <p className="eyebrow">
              {eventLabels[selectedEvent.event_type] ?? selectedEvent.event_type}
            </p>
            <h2 id="calendar-event-title">{selectedEvent.title}</h2>
            <p>{new Date(selectedEvent.starts_at).toLocaleString('ru-RU')}</p>
            <p className="muted">Продолжительность: {selectedEvent.duration_min} мин.</p>
            {selectedEvent.agenda && <p>{selectedEvent.agenda}</p>}
          </section>
        </div>
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
