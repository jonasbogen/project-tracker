import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Badge from '@intility/bifrost-react/Badge';
import Button from '@intility/bifrost-react/Button';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import { faArrowLeft, faListCheck } from '@fortawesome/free-solid-svg-icons';
import { api, type CaseWithProjectInfo, type Project } from '../api';
import SectionTitle from '../components/SectionTitle';
import Skeleton from '../components/Skeleton';
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
    ? `Issues for ${project?.name ?? 'prosjekt'}`
    : owner
      ? `Issues eid av ${owner}`
      : 'Alle issues';

  return (
    <div className="stack">
      <div>
        <Button variant="flat" small onClick={() => navigate(-1)}>
          <Icon icon={faArrowLeft} marginRight />
          Tilbake
        </Button>
      </div>

      <h1 className="bf-h1">{heading}</h1>

      {loading && (
        <div className="board" aria-label="Laster issues">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} padding="large" className="board-column">
              <Skeleton style={{ height: 200 }} />
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Message state="alert" header="Kunne ikke laste issues">
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
                  <SectionTitle icon={faListCheck}>{status}</SectionTitle>
                  <Badge state={caseBadgeState(status)}>{columnCases.length}</Badge>
                </div>
                <div className="board-column-body">
                  {columnCases.length === 0 && <p className="muted">Ingen issues.</p>}
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
