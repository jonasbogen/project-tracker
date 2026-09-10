import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Badge from '@intility/bifrost-react/Badge';
import Button from '@intility/bifrost-react/Button';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import Table from '@intility/bifrost-react/Table';
import Tabs from '@intility/bifrost-react/Tabs';
import Select from '@intility/bifrost-react-select';
import { faDiagramProject } from '@fortawesome/free-solid-svg-icons';
import { api, type Assignee, type CaseWithProjectInfo } from '../api';
import { clearCurrentUser, getCurrentUser, setCurrentUser } from '../currentUser';
import SectionTitle from '../components/SectionTitle';
import Skeleton from '../components/Skeleton';
import StatTile from '../components/StatTile';
import { caseBadgeState, formatDate, githubIssueUrl } from '../status';

interface Option {
  value: string;
  label: string;
}

function daysUntilCase(caseDate: string): number {
  return Math.round((new Date(caseDate).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
}

function deadlineBadge(caseDate: string | null): { state: 'alert' | 'warning' | 'neutral'; text: string } {
  if (!caseDate) return { state: 'neutral', text: 'Ingen frist' };
  const days = daysUntilCase(caseDate);
  if (days < 0) return { state: 'alert', text: `${Math.abs(days)} dager forsinket` };
  if (days === 0) return { state: 'warning', text: 'I dag' };
  if (days <= 7) return { state: 'warning', text: `${days} dager` };
  return { state: 'neutral', text: `${days} dager` };
}

interface ProjectGroup {
  project_id: number;
  project_name: string;
  customer: string;
  cases: CaseWithProjectInfo[];
}

function groupByProject(cases: CaseWithProjectInfo[]): ProjectGroup[] {
  const groups = new Map<number, ProjectGroup>();
  for (const c of cases) {
    const group = groups.get(c.project_id) ?? {
      project_id: c.project_id,
      project_name: c.project_name,
      customer: c.customer,
      cases: [],
    };
    group.cases.push(c);
    groups.set(c.project_id, group);
  }
  return [...groups.values()].sort((a, b) => a.project_name.localeCompare(b.project_name, 'nb'));
}

// The page people actually open in the morning: one person's own open issues
// across every milestone, sorted by frist - "Oversikt" already covers the
// portfolio view for the leads, this is the personal worklist for everyone else.
// There's no login here, so "who you are" is a one-time local pick remembered
// per browser rather than a real session.
export default function MyTasks() {
  const navigate = useNavigate();
  const [login, setLogin] = useState<string | null>(() => getCurrentUser());
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [picked, setPicked] = useState('');
  const [cases, setCases] = useState<CaseWithProjectInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'prosjekt' | 'issues'>('prosjekt');

  useEffect(() => {
    if (login) return;
    api.listAssignees().then(setAssignees).catch(() => undefined);
  }, [login]);

  useEffect(() => {
    if (!login) return;
    setLoading(true);
    setError(null);
    api
      .listCases({ owner: login })
      .then(setCases)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [login]);

  function handlePick() {
    if (!picked) return;
    setCurrentUser(picked);
    setLogin(picked);
  }

  function handleSwitchUser() {
    clearCurrentUser();
    setLogin(null);
    setCases([]);
  }

  const hero = (
    <div className="hero-banner hero-banner-compact">
      <img src="/eidsiva.jpg" alt="" className="hero-banner-image" />
      <div className="hero-banner-overlay" />
      <div className="hero-banner-content">
        <h1 className="hero-banner-title">Mine oppgaver</h1>
        <p className="hero-banner-subtitle">
          Dine åpne issues på tvers av alle prosjekter, sortert etter frist.
        </p>
      </div>
    </div>
  );

  if (!login) {
    return (
      <div className="stack">
        {hero}
        <Card padding="large" className="stack-sm">
          <p className="muted">
            Ingen innlogging her enda - velg din egen GitHub-bruker en gang, så husker denne
            nettleseren valget.
          </p>
          {assignees.length > 0 ? (
            <Select
              label="Hvem er du?"
              options={assignees.map((a) => ({ value: a.login, label: a.login }))}
              value={picked ? { value: picked, label: picked } : null}
              onChange={(opt) => setPicked((opt as Option | null)?.value ?? '')}
              placeholder="Velg din GitHub-bruker"
            />
          ) : (
            <Icon.Spinner aria-label="Laster brukere" />
          )}
          <div className="form-actions">
            <Button variant="filled" state={picked ? 'default' : 'inactive'} onClick={handlePick}>
              Lagre
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const openCases = cases
    .filter((c) => c.status !== 'Løst')
    .sort((a, b) => {
      if (!a.case_date && !b.case_date) return 0;
      if (!a.case_date) return 1;
      if (!b.case_date) return -1;
      return a.case_date.localeCompare(b.case_date);
    });
  const overdueCount = openCases.filter((c) => c.case_date && daysUntilCase(c.case_date) < 0).length;
  const projectGroups = groupByProject(openCases);

  function openCase(c: CaseWithProjectInfo) {
    const issueUrl = c.github_repo && c.github_issue_number ? githubIssueUrl(c.github_repo, c.github_issue_number) : null;
    if (issueUrl) window.open(issueUrl, '_blank', 'noopener,noreferrer');
    else navigate(`/projects/${c.project_id}`);
  }

  return (
    <div className="stack">
      {hero}
      <div className="page-header">
        <span className="team-member">
          <img
            className="team-avatar"
            src={`https://github.com/${login}.png?size=64`}
            alt=""
            width={28}
            height={28}
          />
          <span className="bf-h3" style={{ margin: 0 }}>
            {login}
          </span>
        </span>
        <Button variant="flat" onClick={handleSwitchUser}>
          Ikke {login}? Bytt bruker
        </Button>
      </div>

      {loading && (
        <div className="stack" aria-label="Laster oppgaver">
          <div className="stat-tile-row">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} padding="large" className="stat-tile">
                <Skeleton style={{ height: 12, width: '60%', margin: '0 auto 10px' }} />
                <Skeleton style={{ height: 30, width: '40%', margin: '0 auto' }} />
              </Card>
            ))}
          </div>
          <Card padding="large" className="stack-sm">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} style={{ height: 20 }} />
            ))}
          </Card>
        </div>
      )}

      {error && (
        <Message state="alert" header="Kunne ikke laste oppgaver">
          {error}
        </Message>
      )}

      {!loading && !error && (
        <>
          <div className="stat-tile-row">
            <StatTile label="Åpne issues" value={openCases.length} accent="neutral" />
            <StatTile label="Prosjekter" value={projectGroups.length} accent="brand" />
            <StatTile label="Forsinket" value={overdueCount} accent={overdueCount > 0 ? 'alert' : 'success'} />
          </div>

          {openCases.length === 0 ? (
            <Card padding="large">
              <Message header="Ingen åpne issues" noIcon>
                Du eier ingen åpne issues akkurat nå.
              </Message>
            </Card>
          ) : (
            <Tabs>
              <Tabs.Item
                active={tab === 'prosjekt'}
                onClick={() => setTab('prosjekt')}
                content={
                  <div className="stack-sm">
                    {projectGroups.map((group) => (
                      <Card key={group.project_id} padding="large" className="stack-sm">
                        <div className="page-header" style={{ marginBottom: 0 }}>
                          <button className="my-tasks-project-link" onClick={() => navigate(`/projects/${group.project_id}`)}>
                            <SectionTitle icon={faDiagramProject}>{group.project_name}</SectionTitle>
                          </button>
                          <Badge state="neutral">{group.cases.length}</Badge>
                        </div>
                        <div className="deadline-list">
                          {group.cases.map((c) => {
                            const deadline = deadlineBadge(c.case_date);
                            return (
                              <button key={c.id} className="deadline-row" onClick={() => openCase(c)}>
                                <div>
                                  <div className="deadline-name">
                                    {c.title}
                                    {c.github_repo && (
                                      <Badge state="neutral" style={{ marginLeft: 8 }}>
                                        GitHub
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="muted">
                                    <Badge state={caseBadgeState(c.status)}>{c.status}</Badge>
                                  </div>
                                </div>
                                <div className="deadline-when">
                                  <span>{formatDate(c.case_date)}</span>
                                  <Badge state={deadline.state}>{deadline.text}</Badge>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </Card>
                    ))}
                  </div>
                }
              >
                Per prosjekt
              </Tabs.Item>
              <Tabs.Item
                active={tab === 'issues'}
                onClick={() => setTab('issues')}
                content={
                  <Card padding="large" className="stack-sm">
                    <Table>
                      <Table.Header>
                        <Table.Row>
                          <Table.HeaderCell>Tittel</Table.HeaderCell>
                          <Table.HeaderCell>Prosjekt</Table.HeaderCell>
                          <Table.HeaderCell>Status</Table.HeaderCell>
                          <Table.HeaderCell>Frist</Table.HeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {openCases.map((c) => {
                          const deadline = deadlineBadge(c.case_date);
                          return (
                            <Table.Row key={c.id} onClick={() => openCase(c)} style={{ cursor: 'pointer' }}>
                              <Table.Cell>
                                {c.title}
                                {c.github_repo && (
                                  <Badge state="neutral" style={{ marginLeft: 8 }}>
                                    GitHub
                                  </Badge>
                                )}
                              </Table.Cell>
                              <Table.Cell>{c.project_name}</Table.Cell>
                              <Table.Cell>
                                <Badge state={caseBadgeState(c.status)}>{c.status}</Badge>
                              </Table.Cell>
                              <Table.Cell>
                                <span className="deadline-when">
                                  <span>{formatDate(c.case_date)}</span>
                                  <Badge state={deadline.state}>{deadline.text}</Badge>
                                </span>
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table>
                  </Card>
                }
              >
                Alle issues
              </Tabs.Item>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
