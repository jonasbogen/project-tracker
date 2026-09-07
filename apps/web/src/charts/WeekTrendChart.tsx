export interface WeekTrendPoint {
  label: string;
  value: number;
}

// A left-to-right (oldest -> newest) weekly bar strip. Unlike BarChart (a ranked
// list where zero-value rows are dropped as noise), every week stays here - a
// quiet week needs to read as a real dip, not a gap, for a trend to be visible.
export default function WeekTrendChart({ items }: { items: WeekTrendPoint[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="week-trend">
      {items.map((item, idx) => (
        <div key={idx} className="week-trend-col">
          <div className="week-trend-value">{item.value}</div>
          <div className="week-trend-bar-track">
            <div className="week-trend-bar-fill" style={{ height: `${(item.value / max) * 100}%` }} />
          </div>
          <div className="muted week-trend-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
