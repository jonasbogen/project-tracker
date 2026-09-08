import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import Badge from '@intility/bifrost-react/Badge';
import { api, type BlockedIssue, type DashboardStats } from '../api';
import BarChart from '../charts/BarChart';
import HeroBackground from '../components/HeroBackground';
import PullRequestBell from '../components/PullRequestBell';
import { daysUntil, formatDate, projectStatusColor, timeAgo } from '../status';

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
  const [blocked, setBlocked] = useState<BlockedIssue[]>([]);
  const [blockedError, setBlockedError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.getStats(), api.getMeta(), api.listBlocked()])
      .then(([s, meta, blockedResult]) => {
        setStats(s);
        setProjectStatuses(meta.projectStatuses);
        setBlocked(blockedResult.items);
        setBlockedError(blockedResult.error);
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
        <div className="page-header">
          <h1 className="bf-h1">OT Projects</h1>
          <PullRequestBell />
        </div>

        <div className="stat-tile-row">
          <StatTile
            label="Prosjekter totalt"
            value={totalProjects}
            onClick={() => navigate('/projects')}
          />
          <StatTile
            label="Pågår"
            value={countByStatus(stats.projectStatusCounts, 'Pågår')}
            onClick={() => navigate('/projects?status=Pågår')}
          />
          <StatTile
            label="Forsinket"
            value={countByStatus(stats.projectStatusCounts, 'Forsinket')}
            onClick={() => navigate('/projects?status=Forsinket')}
          />
          <StatTile label="Åpne issuer" value={totalOpenCases} onClick={() => navigate('/board')} />
          <StatTile
            label="Blokkert"
            value={blocked.length}
            onClick={() =>
              document.getElementById('blokkert-card')?.scrollIntoView({ behavior: 'smooth' })
            }
          />
        </div>

        <Card padding="medium" id="blokkert-card" className="stack-sm">
          <h2 className="bf-h2">Blokkert</h2>
          {blockedError && (
            <Message state="alert" header="Kunne ikke laste blokkerte issuer">
              {blockedError}
            </Message>
          )}
          {!blockedError && blocked.length === 0 && <p className="muted">Ingenting står fast.</p>}
          {blocked.length > 0 && (
            <div className="deadline-list">
              {blocked.map((b) => (
                <button
                  key={b.number}
                  className="deadline-row"
                  onClick={() =>
                    b.project_id
                      ? navigate(`/projects/${b.project_id}`)
                      : window.open(
                          `https://github.com/intility/Prosjektmappe/issues/${b.number}`,
                          '_blank',
                          'noopener,noreferrer',
                        )
                  }
                >
                  <div>
                    <div className="deadline-name">{b.title}</div>
                    <div className="muted">{b.project_name ?? 'Ukjent prosjekt'}</div>
                  </div>
                  <div className="deadline-when">
                    <Badge state="alert">
                      {b.blockedByOwners.length > 0
                        ? `Venter på ${b.blockedByOwners.join(', ')}`
                        : 'Venter, ikke spesifisert'}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="dashboard-grid">
          <Card padding="medium">
            <h2 className="bf-h2">Prosjekter per status</h2>
            <BarChart
              items={projectStatuses.map((status) => ({
                label: status,
                value: countByStatus(stats.projectStatusCounts, status),
                color: projectStatusColor(status),
              }))}
              onItemClick={(status) => navigate(`/projects?status=${encodeURIComponent(status)}`)}
            />
          </Card>

          <Card padding="medium">
            <h2 className="bf-h2">Issuer per eier</h2>
            <BarChart
              items={stats.topOwners.map((o) => ({ label: o.owner, value: o.total_cases }))}
              emptyText="Ingen issuer har en eier fra GitHub enda."
              onItemClick={(owner) => navigate(`/board?owner=${encodeURIComponent(owner)}`)}
            />
          </Card>
        </div>

        <Card padding="medium">
          <h2 className="bf-h2">Kommende frister</h2>
          {stats.upcomingDeadlines.length === 0 ? (
            <p className="muted">Ingen prosjekter eller issuer har en frist satt frem i tid.</p>
          ) : (
            <div className="deadline-list">
              {stats.upcomingDeadlines.map((d) => {
                const days = daysUntil(d.date);
                return (
                  <button
                    key={`${d.type}-${d.id}`}
                    className="deadline-row"
                    onClick={() => navigate(`/projects/${d.project_id}`)}
                  >
                    <div>
                      <div className="deadline-name">
                        <Badge state={d.type === 'project' ? 'brand' : 'chill'} style={{ marginRight: 8 }}>
                          {d.type === 'project' ? 'Prosjekt' : 'Issue'}
                        </Badge>
                        {d.title}
                      </div>
                      <div className="muted">{d.customer}</div>
                    </div>
                    <div className="deadline-when">
                      <span>{formatDate(d.date)}</span>
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

        <Card padding="medium">
          <h2 className="bf-h2">Siste endringer</h2>
          {stats.recentActivity.length === 0 ? (
            <p className="muted">Ingen endringer registrert enda.</p>
          ) : (
            <div className="deadline-list">
              {stats.recentActivity.map((a) => {
                return (
                  <button
                    key={`${a.type}-${a.id}`}
                    className="deadline-row"
                    onClick={() => navigate(`/projects/${a.type === 'project' ? a.id : a.project_id}`)}
                  >
                    <div>
                      <div className="deadline-name">
                        <Badge state={a.type === 'project' ? 'brand' : 'chill'} style={{ marginRight: 8 }}>
                          {a.type === 'project' ? 'Prosjekt' : 'Issue'}
                        </Badge>
                        {a.title}
                        {a.github_repo && (
                          <Badge state="neutral" style={{ marginLeft: 8 }}>
                            GitHub
                          </Badge>
                        )}
                      </div>
                      <div className="muted">
                        {a.updated_at === a.created_at ? 'Opprettet' : 'Oppdatert'}
                        {a.type === 'case' && a.project_name ? ` · ${a.project_name}` : ''}
                      </div>
                    </div>
                    <div className="deadline-when">
                      <span>{timeAgo(a.updated_at)}</span>
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
