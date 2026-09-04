import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import Badge from '@intility/bifrost-react/Badge';
import { api, type DashboardStats } from '../api';
import BarChart from '../charts/BarChart';
import HeroBackground from '../components/HeroBackground';
import { formatDate, projectStatusColor } from '../status';

function daysUntil(date: string): number {
  const ms = new Date(date).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function StatTile({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
    </>
  );
  return (
    <Card padding="medium" className="stat-tile">
      {onClick ? <button onClick={onClick}>{content}</button> : content}
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projectStatuses, setProjectStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.getStats(), api.getMeta()])
      .then(([s, meta]) => {
        setStats(s);
        setProjectStatuses(meta.projectStatuses);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <HeroBackground />
        <Icon.Spinner aria-label="Laster oversikt" />
      </>
    );
  }
  if (error || !stats) {
    return (
      <>
        <HeroBackground />
        <Message state="alert" header="Kunne ikke laste oversikten">
          {error ?? 'Ukjent feil.'}
        </Message>
      </>
    );
  }

  const countByStatus = (rows: { status: string; count: number }[], status: string) =>
    rows.find((r) => r.status === status)?.count ?? 0;

  const totalProjects = stats.projectStatusCounts.reduce((sum, r) => sum + r.count, 0);
  const totalOpenCases = stats.caseStatusCounts
    .filter((r) => r.status !== 'Løst')
    .reduce((sum, r) => sum + r.count, 0);

  return (
    <>
      <HeroBackground />
      <div className="stack">
        <h1 className="bf-h1">Oversikt</h1>

        <div className="stat-tile-row">
          <StatTile label="Prosjekter totalt" value={totalProjects} />
          <StatTile label="Pågår" value={countByStatus(stats.projectStatusCounts, 'Pågår')} />
          <StatTile label="Forsinket" value={countByStatus(stats.projectStatusCounts, 'Forsinket')} />
          <StatTile label="Åpne saker" value={totalOpenCases} onClick={() => navigate('/board')} />
        </div>

        <div className="dashboard-grid">
          <Card padding="medium">
            <h2 className="bf-h2">Prosjekter per status</h2>
            <BarChart
              items={projectStatuses.map((status) => ({
                label: status,
                value: countByStatus(stats.projectStatusCounts, status),
                color: projectStatusColor(status),
              }))}
            />
          </Card>

          <Card padding="medium">
            <h2 className="bf-h2">Saker per eier</h2>
            <BarChart
              items={stats.topOwners.map((o) => ({ label: o.owner, value: o.total_cases }))}
              emptyText="Ingen saker har en eier fra GitHub enda."
              onItemClick={(owner) => navigate(`/board?owner=${encodeURIComponent(owner)}`)}
            />
          </Card>
        </div>

        <Card padding="medium">
          <h2 className="bf-h2">Kommende frister</h2>
          {stats.upcomingDeadlines.length === 0 ? (
            <p className="muted">Ingen prosjekter har en frist satt frem i tid.</p>
          ) : (
            <div className="deadline-list">
              {stats.upcomingDeadlines.map((d) => {
                const days = daysUntil(d.end_date);
                return (
                  <button
                    key={d.id}
                    className="deadline-row"
                    onClick={() => navigate(`/projects/${d.id}`)}
                  >
                    <div>
                      <div className="deadline-name">{d.name}</div>
                      <div className="muted">{d.customer}</div>
                    </div>
                    <div className="deadline-when">
                      <span>{formatDate(d.end_date)}</span>
                      <Badge state={days <= 7 ? 'warning' : 'neutral'}>
                        {days === 0 ? 'I dag' : `${days} dager`}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
