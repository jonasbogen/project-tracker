import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import Badge from '@intility/bifrost-react/Badge';
import Button from '@intility/bifrost-react/Button';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import Table from '@intility/bifrost-react/Table';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { api, type CaseWithProjectInfo, type ProjectWithCount } from '../api';
import { caseBadgeState, formatDate, githubIssueUrl, projectBadgeState } from '../status';

// One person's own overview page: every issue they own (from GitHub assignee
// data) and every project they're the "Ansvarlig" for, so clicking a name on
// the Team page lands somewhere richer than the shared Kanban board.
export default function TeamMember() {
  const { login } = useParams();
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseWithProjectInfo[]>([]);
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!login) return;
    setLoading(true);
    setError(null);
    Promise.all([api.listCases({ owner: login }), api.listProjects()])
      .then(([caseList, projectList]) => {
        setCases(caseList);
        setProjects(projectList.filter((p) => p.responsible === login));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [login]);

  if (!login) return null;

  const openCases = cases.filter((c) => c.status !== 'Løst');

  return (
    <div className="stack">
      <div>
        <Button variant="flat" small onClick={() => navigate('/team')}>
          <Icon icon={faArrowLeft} marginRight />
          Team
        </Button>
      </div>

      <div className="page-header">
        <h1 className="bf-h1">
          <span className="team-member">
            <img
              className="team-avatar"
              src={`https://github.com/${login}.png?size=128`}
              alt=""
              width={36}
              height={36}
            />
            {login}
          </span>
        </h1>
        <Button variant="flat" onClick={() => navigate(`/board?owner=${encodeURIComponent(login)}`)}>
          Se i board
        </Button>
      </div>

      {loading && <Icon.Spinner aria-label="Laster oversikt" />}

      {error && (
        <Message state="alert" header="Kunne ikke laste oversikt">
          {error}
        </Message>
      )}

      {!loading && !error && (
        <>
          <div className="stat-tile-row">
            <Card padding="large" className="stat-tile">
              <div className="stat-tile-label">Åpne issuer</div>
              <div className="stat-tile-value">{openCases.length}</div>
            </Card>
            <Card padding="large" className="stat-tile">
              <div className="stat-tile-label">Issuer totalt</div>
              <div className="stat-tile-value">{cases.length}</div>
            </Card>
            <Card padding="large" className="stat-tile">
              <div className="stat-tile-label">Ansvarlig for prosjekter</div>
              <div className="stat-tile-value">{projects.length}</div>
            </Card>
          </div>

          <Card padding="large" className="stack-sm">
            <h2 className="bf-h2">Prosjekter {login} er ansvarlig for</h2>
            {projects.length === 0 ? (
              <p className="muted">Ingen prosjekter registrert.</p>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Navn</Table.HeaderCell>
                    <Table.HeaderCell>Kunde</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {projects.map((p) => (
                    <Table.Row key={p.id} onClick={() => navigate(`/projects/${p.id}`)}>
                      <Table.Cell>{p.name}</Table.Cell>
                      <Table.Cell>{p.customer}</Table.Cell>
                      <Table.Cell>
                        <Badge state={projectBadgeState(p.status)}>{p.status}</Badge>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </Card>

          <Card padding="large" className="stack-sm">
            <h2 className="bf-h2">Issuer eid av {login}</h2>
            {cases.length === 0 ? (
              <p className="muted">Ingen issuer registrert.</p>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Tittel</Table.HeaderCell>
                    <Table.HeaderCell>Prosjekt</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Dato</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {cases.map((c) => {
                    const issueUrl =
                      c.github_repo && c.github_issue_number
                        ? githubIssueUrl(c.github_repo, c.github_issue_number)
                        : null;
                    return (
                      <Table.Row
                        key={c.id}
                        onClick={
                          issueUrl
                            ? () => window.open(issueUrl, '_blank', 'noopener,noreferrer')
                            : () => navigate(`/projects/${c.project_id}`)
                        }
                        style={{ cursor: 'pointer' }}
                      >
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
                        <Table.Cell>{formatDate(c.case_date)}</Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
