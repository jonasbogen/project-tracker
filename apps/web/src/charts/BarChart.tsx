export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  items: BarChartItem[];
  emptyText?: string;
  /** When set, each row becomes a button and this fires with the row's label. */
  onItemClick?: (label: string) => void;
}

// A ranked horizontal bar list: ideal for comparing a handful of magnitudes by
// name (status counts, cases per owner). Each row carries its own label, so no
// separate legend is needed. Zero-value rows are dropped rather than drawn.
export default function BarChart({ items, emptyText = 'Ingen data.', onItemClick }: BarChartProps) {
  const visible = items.filter((item) => item.value > 0);
  const max = Math.max(1, ...visible.map((item) => item.value));

  if (visible.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="bar-chart">
      {visible.map((item) => {
        const Row = onItemClick ? 'button' : 'div';
        return (
          <Row
            key={item.label}
            className={`bar-chart-row${onItemClick ? ' bar-chart-row-clickable' : ''}`}
            {...(onItemClick ? { type: 'button', onClick: () => onItemClick(item.label) } : {})}
          >
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
          </Row>
        );
      })}
    </div>
  );
}
