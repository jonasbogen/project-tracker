import { useMemo, useState } from 'react';
import Button from '@intility/bifrost-react/Button';
import Icon from '@intility/bifrost-react/Icon';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

interface CalendarProps {
  /** Project end date (YYYY-MM-DD), highlighted as the deadline. */
  deadline: string | null;
  /** One date (YYYY-MM-DD) per case, marked on the day it was logged. */
  markers: string[];
}

const WEEKDAYS = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'];
const MONTH_NAMES = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
];

// Local YYYY-MM-DD, matching the plain dates the API returns — toISOString()
// would shift across a UTC day boundary depending on the browser's timezone.
function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Picks the most useful month to open on: an upcoming deadline first (that's the
// whole point of the widget), otherwise the most recent case activity, otherwise
// today. Without this, a milestone whose cases were all logged in August but whose
// deadline is in November opens on a nearly-empty month either way.
function pickInitialMonth(deadline: string | null, markers: string[]): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (deadline) {
    const deadlineDate = new Date(deadline);
    if (deadlineDate >= today) return deadlineDate;
  }

  const validMarkers = markers.filter(Boolean).sort();
  if (validMarkers.length > 0) return new Date(validMarkers[validMarkers.length - 1]);

  if (deadline) return new Date(deadline);
  return today;
}

export default function Calendar({ deadline, markers }: CalendarProps) {
  const initial = pickInitialMonth(deadline, markers);
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const markerCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of markers) {
      if (!m) continue;
      map.set(m, (map.get(m) ?? 0) + 1);
    }
    return map;
  }, [markers]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayKey = toKey(today);

  const cells: (Date | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  const hasEventThisMonth = cells.some(
    (date) => date && (toKey(date) === deadline || markerCounts.has(toKey(date))),
  );
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const deadlineDate = deadline ? new Date(deadline) : null;
  const isDeadlineMonth =
    deadlineDate && year === deadlineDate.getFullYear() && month === deadlineDate.getMonth();

  return (
    <div className="calendar">
      <div className="calendar-header">
        <Button
          variant="flat"
          small
          aria-label="Forrige måned"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          <Icon icon={faChevronLeft} />
        </Button>
        <div className="calendar-title">
          {MONTH_NAMES[month]} {year}
        </div>
        <Button
          variant="flat"
          small
          aria-label="Neste måned"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          <Icon icon={faChevronRight} />
        </Button>
      </div>

      <div className="calendar-jumps">
        <Button
          small
          variant="flat"
          state={isCurrentMonth ? 'inactive' : 'default'}
          onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
        >
          I dag
        </Button>
        {deadlineDate && (
          <Button
            small
            variant="flat"
            state={isDeadlineMonth ? 'inactive' : 'default'}
            onClick={() => setCursor(new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), 1))}
          >
            Frist
          </Button>
        )}
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="calendar-weekday">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="calendar-cell calendar-cell-empty" />;
          const key = toKey(date);
          const count = markerCounts.get(key) ?? 0;
          return (
            <div
              key={i}
              className={`calendar-cell${key === todayKey ? ' calendar-cell-today' : ''}`}
            >
              <span className="calendar-date">{date.getDate()}</span>
              <span className="calendar-dots">
                {deadline === key && <span className="calendar-dot calendar-dot-deadline" title="Frist" />}
                {count > 0 && (
                  <span className="calendar-dot calendar-dot-case" title={`${count} sak(er) registrert`} />
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="calendar-legend">
        <span>
          <span className="calendar-dot calendar-dot-deadline" /> Frist
        </span>
        <span>
          <span className="calendar-dot calendar-dot-case" /> Sak registrert
        </span>
      </div>

      {!hasEventThisMonth && (
        <p className="muted calendar-empty-hint">
          Ingen frist eller sakaktivitet i {MONTH_NAMES[month]}. Bruk «I dag» eller «Frist» for å
          hoppe til en måned med noe å vise.
        </p>
      )}
    </div>
  );
}
