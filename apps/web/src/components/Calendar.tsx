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

export default function Calendar({ deadline, markers }: CalendarProps) {
  const initial = deadline ? new Date(deadline) : new Date();
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
  const todayKey = toKey(new Date());

  const cells: (Date | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

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
    </div>
  );
}
