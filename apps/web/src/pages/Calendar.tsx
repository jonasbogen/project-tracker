import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import Badge from '@intility/bifrost-react/Badge';
import Button from '@intility/bifrost-react/Button';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { api, type CalendarItem } from '../api';
import { daysUntil, formatDate } from '../status';

const MONTH_NAMES = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
];
const WEEKDAY_NAMES = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

// Local Y-M-D, deliberately NOT toISOString(): that converts to UTC first, which
// silently shifts the date by a day in any timezone ahead of UTC (Europe/Oslo
// included) once it's evening - a calendar grid built that way puts items on
// the wrong day. item.date from the API is a plain SQL DATE (no time meaning),
// serialized as a UTC-midnight string, so its own first 10 characters ARE the
// calendar day - it's compared against this key as a plain string, never
// re-parsed through `new Date()`.
function localKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Every day cell to render for a month grid, Monday-first, including the
// leading/trailing days from neighboring months needed to fill whole weeks.
function buildMonthGrid(monthStart: Date): Date[] {
  const firstWeekday = (monthStart.getDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - firstWeekday);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

// Both kinds of deadline the tool tracks, synced carefully NOW: project end
// dates (milestones) and case Frist dates (issues) - so a month view actually
// shows what's approaching on both, on the days it's approaching on.
export default function CalendarPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));

  useEffect(() => {
    api
      .listCalendar()
      .then(setItems)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = item.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const upcoming = useMemo(() => {
    const today = localKey(new Date());
    return items
      .filter((i) => i.date.slice(0, 10) >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);
  }, [items]);

  const grid = buildMonthGrid(monthStart);
  const todayKey = localKey(new Date());

  function goToProject(item: CalendarItem) {
    navigate(`/projects/${item.project_id}`);
  }

  return (
    <div className="stack">
      <h1 className="bf-h1">Kalender</h1>
      <p className="muted">
        De nærmeste fristene for prosjekter (milestones) og issuer, samlet på én tidslinje.
      </p>

      {error && (
        <Message state="alert" header="Kunne ikke laste kalenderen">
          {error}
        </Message>
      )}

      {loading ? (
        <Icon.Spinner aria-label="Laster kalender" />
      ) : (
        <>
          <Card padding="large">
            <div className="calendar-header">
              <Button
                small
                variant="flat"
                aria-label="Forrige måned"
                onClick={() => setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              >
                <Icon icon={faChevronLeft} />
              </Button>
              <h2 className="bf-h2">
                {MONTH_NAMES[monthStart.getMonth()]} {monthStart.getFullYear()}
              </h2>
              <Button
                small
                variant="flat"
                aria-label="Neste måned"
                onClick={() => setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              >
                <Icon icon={faChevronRight} />
              </Button>
              <Button small variant="flat" onClick={() => setMonthStart(startOfMonth(new Date()))}>
                I dag
              </Button>
            </div>

            <div className="calendar-grid">
              {WEEKDAY_NAMES.map((d) => (
                <div key={d} className="calendar-weekday muted">
                  {d}
                </div>
              ))}
              {grid.map((day) => {
                const key = localKey(day);
                const dayItems = byDate.get(key) ?? [];
                const inMonth = day.getMonth() === monthStart.getMonth();
                return (
                  <div
                    key={key}
                    className={`calendar-day${inMonth ? '' : ' calendar-day-outside'}${
                      key === todayKey ? ' calendar-day-today' : ''
                    }`}
                  >
                    <div className="calendar-day-number">{day.getDate()}</div>
                    {inMonth && (
                      <div className="calendar-day-items">
                        {dayItems.slice(0, 3).map((item) => (
                          <button
                            key={`${item.type}-${item.id}`}
                            className={`calendar-day-item calendar-day-item-${item.type}`}
                            onClick={() => goToProject(item)}
                            title={item.title}
                          >
                            {item.title}
                          </button>
                        ))}
                        {dayItems.length > 3 && (
                          <span className="muted calendar-day-more">+{dayItems.length - 3} mer</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="calendar-legend">
              <span className="calendar-legend-item">
                <span className="calendar-legend-dot calendar-legend-dot-project" />
                Prosjekt
              </span>
              <span className="calendar-legend-item">
                <span className="calendar-legend-dot calendar-legend-dot-case" />
                Issue
              </span>
            </div>
          </Card>

          <Card padding="large" className="stack-sm">
            <h2 className="bf-h2">Nærmeste frister</h2>
            {upcoming.length === 0 ? (
              <p className="muted">Ingen kommende frister registrert.</p>
            ) : (
              <div className="deadline-list">
                {upcoming.map((item) => {
                  const days = daysUntil(item.date);
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      className="deadline-row"
                      onClick={() => goToProject(item)}
                    >
                      <div>
                        <div className="deadline-name">
                          <Badge state={item.type === 'project' ? 'brand' : 'chill'} style={{ marginRight: 8 }}>
                            {item.type === 'project' ? 'Prosjekt' : 'Issue'}
                          </Badge>
                          {item.title}
                        </div>
                        <div className="muted">{item.customer}</div>
                      </div>
                      <div className="deadline-when">
                        <span>{formatDate(item.date)}</span>
                        <Badge state={days <= 7 ? 'warning' : 'neutral'}>
                          {days === 0 ? 'I dag' : days < 0 ? `${Math.abs(days)} dager siden` : `${days} dager`}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
