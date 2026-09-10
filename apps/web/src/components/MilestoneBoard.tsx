import { useEffect, useState, type DragEvent } from 'react';
import Badge from '@intility/bifrost-react/Badge';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import { faListCheck } from '@fortawesome/free-solid-svg-icons';
import { api, type MilestoneBoard as MilestoneBoardData, type MilestoneBoardIssue } from '../api';
import { boardStatusBadgeState, boardStatusColor } from '../status';
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
// progress/Blocked/Done, the same ones on github.com/orgs/<org>/projects/318).
// Dragging a card between columns calls straight through to the real GitHub
// project board (see moveIssueStatus on the server) - there is no local copy
// of "status" to drift out of sync, and no separate grouping of our own on
// top of it - a card sits in whichever column it actually sits in on GitHub.
//
// Native HTML5 drag-and-drop - the same dragover/drop handlers are attached
// to both the column AND every card in it, since a drop landing on a nested
// draggable card is exactly the case browsers are least reliable about
// bubbling correctly to an ancestor drop zone.
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
        setBoard({ statusCounts: [], groups: [], statusOrder: [], boardUrl: '', statusDebug: null });
        setColumns({});
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  function moveCard(issueNumber: number, targetStatus: string) {
    const sourceStatus = Object.keys(columns).find((status) => columns[status].some((i) => i.number === issueNumber));
    if (!sourceStatus || sourceStatus === targetStatus) return;
    const moving = columns[sourceStatus].find((i) => i.number === issueNumber);
    if (!moving) return;

    const previous = columns;
    setColumns({
      ...columns,
      [sourceStatus]: columns[sourceStatus].filter((i) => i.number !== issueNumber),
      [targetStatus]: [...columns[targetStatus], { ...moving, status: targetStatus }],
    });
    setMoveError(null);

    api.moveBoardCard(projectId, issueNumber, targetStatus).catch((e: Error) => {
      setColumns(previous);
      setMoveError(e.message);
    });
  }

  function handleDrop(e: DragEvent, targetStatus: string) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverStatus(null);
    const fromTransfer = Number(e.dataTransfer.getData('text/plain'));
    const issueNumber = Number.isInteger(fromTransfer) && fromTransfer > 0 ? fromTransfer : draggingNumber;
    setDraggingNumber(null);
    if (!issueNumber) return;
    moveCard(issueNumber, targetStatus);
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
              style={{ borderTopColor: boardStatusColor(status) }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverStatus(status);
              }}
              onDragLeave={() => setDragOverStatus((current) => (current === status ? null : current))}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="board-column-header">
                <a
                  className="bf-h3 board-column-title-link"
                  href={`${board.boardUrl}?filterQuery=${encodeURIComponent(`status:"${status}"`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Åpne "${status}" på GitHub`}
                >
                  {status}
                </a>
                <Badge state={boardStatusBadgeState(status)}>{columns[status]?.length ?? 0}</Badge>
              </div>
              <div className="board-column-body">
                {(columns[status]?.length ?? 0) === 0 && (
                  <p className="muted board-column-empty">Ingen issues i denne kolonnen.</p>
                )}
                {columns[status]?.map((issue) => (
                  <div
                    key={issue.number}
                    className={`board-card board-card-draggable${draggingNumber === issue.number ? ' board-card-dragging' : ''}`}
                    role="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(issue.number));
                      setDraggingNumber(issue.number);
                    }}
                    onDragEnd={() => setDraggingNumber(null)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverStatus(status);
                    }}
                    onDrop={(e) => handleDrop(e, status)}
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
                    <div className="board-card-footer">
                      <span className="muted board-card-number">
                        {issue.umbrella ?? `#${issue.number}`}
                      </span>
                      {issue.assignees.length > 0 && (
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
                      )}
                    </div>
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
    </div>
  );
}
