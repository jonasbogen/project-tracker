import { useEffect, useState, type DragEvent } from 'react';
import Badge from '@intility/bifrost-react/Badge';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import { faListCheck, faSitemap } from '@fortawesome/free-solid-svg-icons';
import { api, type MilestoneBoard as MilestoneBoardData, type MilestoneBoardIssue } from '../api';
import SectionTitle from './SectionTitle';

interface BoardCard extends MilestoneBoardIssue {
  umbrella: string | null;
}

function bucketByStatus(data: MilestoneBoardData): Record<string, BoardCard[]> {
  const buckets: Record<string, BoardCard[]> = {};
  for (const status of data.statusOrder) buckets[status] = [];
  for (const group of data.groups) {
    for (const issue of group.issues) {
      if (!issue.status) continue;
      const bucket = buckets[issue.status] ?? (buckets[issue.status] = []);
      bucket.push({ ...issue, umbrella: group.umbrella?.title ?? null });
    }
  }
  return buckets;
}

// A live, two-way mirror of the GitHub Projects board for this project's
// milestone: draggable columns for the Status field (Backlog/To do/In
// progress/Blocked/Done, the same ones on github.com/orgs/<org>/projects/318),
// then issues grouped under their Tjenesteparaply parent with a completion
// bar scoped to just this milestone. Dragging a card between columns calls
// straight through to the real GitHub project board (see moveIssueStatus on
// the server) - there is no local copy of "status" to drift out of sync.
// Both the columns and the grouped list only appear once a PROJECT_TOKEN with
// write access to the org's projects is configured server-side.
export default function MilestoneBoard({ projectId }: { projectId: number }) {
  const [board, setBoard] = useState<MilestoneBoardData | null>(null);
  const [columns, setColumns] = useState<Record<string, BoardCard[]>>({});
  const [loading, setLoading] = useState(true);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [draggingNumber, setDraggingNumber] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getProjectBoard(projectId)
      .then((data) => {
        setBoard(data);
        setColumns(bucketByStatus(data));
      })
      .catch(() => {
        setBoard({ statusCounts: [], groups: [], statusOrder: [] });
        setColumns({});
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  function handleDrop(targetStatus: string, e: DragEvent) {
    setDragOverStatus(null);
    // Prefer the dataTransfer payload over the draggingNumber state - it's the
    // one piece of drag state the browser itself guarantees is still current
    // at drop time, regardless of any React state timing.
    const fromTransfer = Number(e.dataTransfer.getData('text/plain'));
    const issueNumber = Number.isInteger(fromTransfer) && fromTransfer > 0 ? fromTransfer : draggingNumber;
    setDraggingNumber(null);
    if (!issueNumber) return;

    const sourceStatus = Object.keys(columns).find((status) =>
      columns[status].some((issue) => issue.number === issueNumber),
    );
    if (!sourceStatus || sourceStatus === targetStatus) return;
    const moving = columns[sourceStatus].find((issue) => issue.number === issueNumber);
    if (!moving) return;

    const previous = columns;
    setColumns({
      ...columns,
      [sourceStatus]: columns[sourceStatus].filter((issue) => issue.number !== issueNumber),
      [targetStatus]: [...columns[targetStatus], { ...moving, status: targetStatus }],
    });
    setMoveError(null);

    api.moveBoardCard(projectId, issueNumber, targetStatus).catch((e: Error) => {
      setColumns(previous);
      setMoveError(e.message);
    });
  }

  if (loading) return <Icon.Spinner aria-label="Laster prosjekttavle" />;
  if (!board || board.groups.length === 0) return null;

  return (
    <div className="stack-sm">
      <SectionTitle icon={faListCheck}>Prosjekttavle</SectionTitle>

      {moveError && (
        <Message state="alert" header="Kunne ikke flytte issue" onClose={() => setMoveError(null)}>
          {moveError}
        </Message>
      )}

      {board.statusOrder.length > 0 ? (
        <div className="board">
          {board.statusOrder.map((status) => (
            <Card
              key={status}
              padding="large"
              className={`board-column${dragOverStatus === status ? ' board-column-dragover' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverStatus(status);
              }}
              onDragLeave={() => setDragOverStatus((current) => (current === status ? null : current))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(status, e);
              }}
            >
              <div className="board-column-header">
                <span className="bf-h3">{status}</span>
                <Badge state="neutral">{columns[status]?.length ?? 0}</Badge>
              </div>
              <div className="board-column-body">
                {(columns[status]?.length ?? 0) === 0 && <p className="muted">Ingen issues.</p>}
                {columns[status]?.map((issue) => (
                  <div
                    key={issue.number}
                    className={`board-card${draggingNumber === issue.number ? ' board-card-dragging' : ''}`}
                    role="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(e) => {
                      // Some browsers (Firefox in particular) refuse to start a
                      // native HTML5 drag at all unless dataTransfer carries
                      // something - an empty dragstart silently does nothing.
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(issue.number));
                      setDraggingNumber(issue.number);
                    }}
                    onDragEnd={() => setDraggingNumber(null)}
                    onClick={() => window.open(issue.html_url, '_blank', 'noopener,noreferrer')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        window.open(issue.html_url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    <div
                      className={`board-card-title${issue.state === 'closed' ? ' milestone-issue-title-done' : ''}`}
                    >
                      {issue.title}
                    </div>
                    {issue.umbrella && <div className="muted board-card-meta">{issue.umbrella}</div>}
                    {issue.assignees.length > 0 && (
                      <div className="board-card-footer">
                        <span className="team-member">
                          {issue.assignees.map((a) => (
                            <img
                              key={a.login}
                              className="team-avatar"
                              src={a.avatar_url}
                              alt={a.login}
                              title={a.login}
                              width={20}
                              height={20}
                            />
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="muted">
          Board-kolonner (Backlog/To do/In progress/Blocked/Done) vises når PROJECT_TOKEN er satt opp med
          skrivetilgang til prosjekttavlen.
        </p>
      )}

      <SectionTitle as="h3" icon={faSitemap}>
        Fremdrift per tjenesteparaply
      </SectionTitle>
      <div className="milestone-groups">
        {board.groups.map((g) => (
          <div key={g.umbrella?.number ?? 'none'} className="milestone-group">
            <div className="milestone-group-header">
              <span className="milestone-group-title">
                {g.umbrella ? (
                  <a href={g.umbrella.html_url} target="_blank" rel="noopener noreferrer">
                    {g.umbrella.title} <span className="muted">#{g.umbrella.number}</span>
                  </a>
                ) : (
                  'Uten tjenesteparaply'
                )}
                <span className="muted"> · {g.total} sak(er)</span>
              </span>
              <span className="milestone-group-progress muted">
                {g.completed} / {g.total} · {g.percentCompleted}%
              </span>
            </div>
            <div className="milestone-progress-track">
              <div className="milestone-progress-fill" style={{ width: `${g.percentCompleted}%` }} />
            </div>
            <div className="milestone-issue-list">
              {g.issues.map((issue) => (
                <a
                  key={issue.number}
                  href={issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="milestone-issue-row"
                >
                  <span
                    className={`milestone-issue-title${issue.state === 'closed' ? ' milestone-issue-title-done' : ''}`}
                  >
                    {issue.title}
                  </span>
                  <span className="milestone-issue-meta">
                    {issue.status && <Badge state="neutral">{issue.status}</Badge>}
                    {issue.assignees.map((a) => (
                      <img
                        key={a.login}
                        className="team-avatar"
                        src={a.avatar_url}
                        alt={a.login}
                        title={a.login}
                        width={20}
                        height={20}
                      />
                    ))}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
