import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Badge from '@intility/bifrost-react/Badge';
import Button from '@intility/bifrost-react/Button';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { api, type CaseWithProjectInfo, type Project } from '../api';
import { caseBadgeState, formatDate, githubIssueUrl } from '../status';

export default function Board() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectIdParam = searchParams.get('project');
  const projectId = projectIdParam ? Number(projectIdParam) : undefined;
  const owner = searchParams.get('owner') ?? undefined;

  const [cases, setCases] = useState<CaseWithProjectInfo[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.listCases({ projectId, owner }),
      api.getMeta(),
      projectId ? api.getProject(projectId).then((d) => d.project) : Promise.resolve(null),
    ])
      .then(([caseList, meta, proj]) => {
        setCases(caseList);
        setStatuses(meta.caseStatuses);
        setProject(proj);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, owner]);

  const heading = projectId
    ? `Issuer for ${project?.name ?? 'prosjekt'}`
    : owner
      ? `Issuer eid av ${owner}`
      : 'Alle issuer';

  return (
    <div className="stack">
      <div>
        <Button variant="flat" small onClick={() => navigate(-1)}>
          <Icon icon={faArrowLeft} marginRight />
          Tilbake
        </Button>
      </div>

      <h1 className="bf-h1">{heading}</h1>

      {loading && <Icon.Spinner aria-label="Laster issuer" />}

      {error && (
        <Message state="alert" header="Kunne ikke laste issuer">
          {error}
        </Message>
      )}

      {!loading && !error && (
        <div className="board">
          {statuses.map((status) => {
            const columnCases = cases.filter((c) => c.status === status);
            return (
              <Card key={status} padding="large" className="board-column">
                <div className="board-column-header">
                  <h2 className="bf-h2">{status}</h2>
                  <Badge state={caseBadgeState(status)}>{columnCases.length}</Badge>
                </div>
                <div className="board-column-body">
                  {columnCases.length === 0 && <p className="muted">Ingen issuer.</p>}
                  {columnCases.map((c) => {
                    const issueUrl =
                      c.github_repo && c.github_issue_number
                        ? githubIssueUrl(c.github_repo, c.github_issue_number)
                        : null;
                    return (
                      <button
                        key={c.id}
                        className="board-card"
                        onClick={() =>
                          issueUrl
                            ? window.open(issueUrl, '_blank', 'noopener,noreferrer')
                            : navigate(`/projects/${c.project_id}`)
                        }
                      >
                        <div className="board-card-title">
                          {c.title}
                          {c.github_repo && <Badge state="neutral">GitHub</Badge>}
                        </div>
                        <div className="muted board-card-meta">
                          {c.project_name} · {c.customer}
                        </div>
                        <div className="board-card-footer">
                          {c.owner ? (
                            <span className="team-member">
                              <img
                                className="team-avatar"
                                src={`https://github.com/${c.owner}.png?size=64`}
                                alt=""
                                width={18}
                                height={18}
                              />
                              {c.owner}
                            </span>
                          ) : (
                            <span className="muted">Ingen eier</span>
                          )}
                          <span className="muted">{formatDate(c.case_date)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
