import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import Badge from '@intility/bifrost-react/Badge';
import {
  faBan,
  faCalendarDays,
  faChartColumn,
  faClockRotateLeft,
  faDiagramProject,
  faListCheck,
  faSpinner,
  faTriangleExclamation,
  faUsers,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { api, type BlockedIssue, type DashboardStats } from '../api';
import BarChart from '../charts/BarChart';
import CountUp from '../components/CountUp';
import Reveal from '../components/Reveal';
import SectionTitle from '../components/SectionTitle';
import Skeleton from '../components/Skeleton';
import { daysUntil, formatDate, projectStatusColor, timeAgo } from '../status';

const ACCENT_COLOR: Record<string, string> = {
  brand: 'hsl(var(--bfc-brand-hsl))',
  chill: 'hsl(var(--bfc-chill-hsl))',
  warning: 'hsl(var(--bfc-warning-hsl))',
  alert: 'hsl(var(--bfc-alert-hsl))',
  neutral: 'hsl(var(--bfc-neutral-hsl))',
};

function StatTile({
  label,
  value,
  icon,
  accent,
  onClick,
}: {
  label: string;
  value: number;
  icon: IconDefinition;
  accent: keyof typeof ACCENT_COLOR;
  onClick?: () => void;
}) {
  const color = ACCENT_COLOR[accent];
  const content = (
    <>
      <Icon icon={icon} className="stat-tile-icon" style={{ color }} />
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
      <div className="stack" aria-label="Laster oversikt">
        <Skeleton className="hero-banner" />
        <div className="stat-tile-row">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} padding="large" className="stat-tile">
              <Skeleton style={{ height: 12, width: '60%', margin: '0 auto 10px' }} />
              <Skeleton style={{ height: 30, width: '40%', margin: '0 auto' }} />
            </Card>
          ))}
        </div>
        <Card padding="large">
          <Skeleton style={{ height: 160 }} />
        </Card>
        <div className="dashboard-grid">
          <Card padding="large">
            <Skeleton style={{ height: 160 }} />
          </Card>
          <Card padding="large">
            <Skeleton style={{ height: 160 }} />
          </Card>
        </div>
        <Card padding="large">
          <Skeleton style={{ height: 160 }} />
        </Card>
        <Card padding="large">
          <Skeleton style={{ height: 160 }} />
        </Card>
      </div>
    );
  }
  if (error || !stats) {
    return (
      <Message state="alert" header="Kunne ikke laste oversikten">
        {error ?? 'Ukjent feil.'}
      </Message>
    );
  }

  const countByStatus = (rows: { status: string; count: number }[], status: string) =>
    rows.find((r) => r.status === status)?.count ?? 0;

  const totalProjects = stats.projectStatusCounts.reduce((sum, r) => sum + r.count, 0);
  const totalOpenCases = stats.caseStatusCounts
    .filter((r) => r.status !== 'Løst')
    .reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="stack">
      <Reveal>
        <div className="hero-banner">
          <img src="/hero-ot.jpg" alt="" className="hero-banner-image" />
          <div className="hero-banner-overlay" />
        </div>
      </Reveal>

      <div className="stat-tile-row">
        <Reveal delay={0}>
          <StatTile
            label="Prosjekter totalt"
            value={totalProjects}
            icon={faDiagramProject}
            accent="brand"
            onClick={() => navigate('/projects')}
          />
        </Reveal>
        <Reveal delay={80}>
          <StatTile
            label="Pågår"
            value={countByStatus(stats.projectStatusCounts, 'Pågår')}
            icon={faSpinner}
            accent="chill"
            onClick={() => navigate('/projects?status=Pågår')}
          />
        </Reveal>
        <Reveal delay={160}>
          <StatTile
            label="Forsinket"
            value={countByStatus(stats.projectStatusCounts, 'Forsinket')}
            icon={faTriangleExclamation}
            accent="warning"
            onClick={() => navigate('/projects?status=Forsinket')}
          />
        </Reveal>
        <Reveal delay={240}>
          <StatTile
            label="Åpne issuer"
            value={totalOpenCases}
            icon={faListCheck}
            accent="neutral"
            onClick={() => navigate('/board')}
          />
        </Reveal>
        <Reveal delay={320}>
          <StatTile
            label="Blokkert"
            value={blocked.length}
            icon={faBan}
            accent="alert"
            onClick={() =>
              document.getElementById('blokkert-card')?.scrollIntoView({ behavior: 'smooth' })
            }
          />
        </Reveal>
      </div>

      <Reveal>
        <Card padding="large" id="blokkert-card" className="blokkert-card">
          <img src="/klemetsrud.jpg" alt="" className="blokkert-card-image" />
          <div className="blokkert-card-overlay" />
          <div className="blokkert-card-content stack-sm">
            <SectionTitle icon={faBan}>Blokkert</SectionTitle>
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
          </div>
        </Card>
      </Reveal>

      <div className="dashboard-grid">
        <Reveal delay={0}>
          <Card padding="large">
            <SectionTitle icon={faChartColumn}>Prosjekter per status</SectionTitle>
            <BarChart
              items={projectStatuses.map((status) => ({
                label: status,
                value: countByStatus(stats.projectStatusCounts, status),
                color: projectStatusColor(status),
              }))}
              onItemClick={(status) => navigate(`/projects?status=${encodeURIComponent(status)}`)}
            />
          </Card>
        </Reveal>

        <Reveal delay={100}>
          <Card padding="large">
            <SectionTitle icon={faUsers}>Issuer per eier</SectionTitle>
            <BarChart
              items={stats.topOwners.map((o) => ({ label: o.owner, value: o.total_cases }))}
              emptyText="Ingen issuer har en eier fra GitHub enda."
              onItemClick={(owner) => navigate(`/board?owner=${encodeURIComponent(owner)}`)}
            />
          </Card>
        </Reveal>
      </div>

      <Reveal>
        <Card padding="large">
          <SectionTitle icon={faCalendarDays}>Kommende frister</SectionTitle>
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
      </Reveal>

      <Reveal>
        <Card padding="large">
          <SectionTitle icon={faClockRotateLeft}>Siste endringer</SectionTitle>
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
      </Reveal>
    </div>
  );
}
