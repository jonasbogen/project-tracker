export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  items: BarChartItem[];
  emptyText?: string;
}

// A ranked horizontal bar list: ideal for comparing a handful of magnitudes by
// name (status counts, cases per owner). Each row carries its own label, so no
// separate legend is needed. Zero-value rows are dropped rather than drawn.
export default function BarChart({ items, emptyText = 'Ingen data.' }: BarChartProps) {
  const visible = items.filter((item) => item.value > 0);
  const max = Math.max(1, ...visible.map((item) => item.value));

  if (visible.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="bar-chart">
      {visible.map((item) => (
        <div className="bar-chart-row" key={item.label}>
          <div className="bar-chart-label">{item.label}</div>
          <div className="bar-chart-track">
            <div
              className="bar-chart-fill"
              style={{
                width: `${(item.value / max) * 100}%`,
                background: item.color ?? 'hsl(var(--bfc-brand-hsl))',
              }}
            />
          </div>
          <div className="bar-chart-value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
