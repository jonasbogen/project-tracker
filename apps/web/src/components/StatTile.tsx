import Card from '@intility/bifrost-react/Card';
import CountUp from './CountUp';
import { accentColor, type BadgeState } from '../status';

// A single labeled number with a colored top accent - the dashboard's own
// summary tiles, reused wherever else a page wants the same "quick counts"
// row (e.g. Mine oppgaver) instead of redrawing the same markup.
export default function StatTile({
  label,
  value,
  accent,
  onClick,
}: {
  label: string;
  value: number;
  accent: BadgeState;
  onClick?: () => void;
}) {
  const color = accentColor(accent);
  const content = (
    <>
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">
        <CountUp value={value} />
      </div>
    </>
  );
  return (
    <Card padding="large" className="stat-tile" style={{ borderTopColor: color }}>
      {onClick ? <button onClick={onClick}>{content}</button> : content}
    </Card>
  );
}
