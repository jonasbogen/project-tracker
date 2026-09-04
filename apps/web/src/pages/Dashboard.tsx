import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import Badge from '@intility/bifrost-react/Badge';
import { faCodeBranch, faDiagramProject } from '@fortawesome/free-solid-svg-icons';
import { api, type DashboardStats } from '../api';
import BarChart from '../charts/BarChart';
import HeroBackground from '../components/HeroBackground';
import PullRequestBell from '../components/PullRequestBell';
import {
  daysUntil,
  formatDate,
  githubIssueUrl,
  githubMilestoneUrl,
  projectStatusColor,
  timeAgo,
} from '../status';

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
        <div className="page-header">
          <h1 className="bf-h1">Oversikt</h1>
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

        <Card padding="medium">
          <h2 className="bf-h2">Siste endringer</h2>
          {stats.recentActivity.length === 0 ? (
            <p className="muted">Ingen endringer registrert enda.</p>
          ) : (
            <div className="deadline-list">
              {stats.recentActivity.map((a) => {
                const githubUrl =
                  a.github_repo && a.github_number
                    ? a.type === 'case'
                      ? githubIssueUrl(a.github_repo, a.github_number)
                      : githubMilestoneUrl(a.github_repo, a.github_number)
                    : null;
                return (
                  <button
                    key={`${a.type}-${a.id}`}
                    className="deadline-row"
                    onClick={() =>
                      githubUrl
                        ? window.open(githubUrl, '_blank', 'noopener,noreferrer')
                        : navigate(`/projects/${a.type === 'project' ? a.id : a.project_id}`)
                    }
                  >
                    <div>
                      <div className="deadline-name">
                        <Icon icon={a.type === 'project' ? faDiagramProject : faCodeBranch} marginRight />
                        {a.title}
                        {a.github_repo && (
                          <Badge state="neutral" style={{ marginLeft: 8 }}>
                            GitHub
                          </Badge>
                        )}
                      </div>
                      <div className="muted">
                        {a.type === 'project' ? 'Nytt prosjekt' : `Issue i ${a.project_name}`}
                      </div>
                    </div>
                    <div className="deadline-when">
                      <span>{timeAgo(a.created_at)}</span>
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
