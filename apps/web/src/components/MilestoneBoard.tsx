import { useRef, useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import Badge from '@intility/bifrost-react/Badge';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import { faListCheck } from '@fortawesome/free-solid-svg-icons';
import { api, type MilestoneBoard as MilestoneBoardData, type MilestoneBoardIssue } from '../api';
import SectionTitle from './SectionTitle';

interface BoardCard extends MilestoneBoardIssue {
  umbrella: string | null;
}

interface DragState {
  issueNumber: number;
  sourceStatus: string;
  startX: number;
  startY: number;
  moved: boolean;
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
// The drag itself is implemented with plain mouse events (mousedown/move/up)
// rather than the native HTML5 drag-and-drop API: with cards that are
// themselves draggable nested inside a draggable drop zone, the native
// API's drop event is notoriously unreliable across browsers about firing
// at all. Which column a drop lands in is resolved geometrically (nearest
// column by horizontal distance) rather than via elementFromPoint(), since
// the columns sit in a CSS grid with gaps between them - elementFromPoint()
// at a point over a gap resolves to nothing, silently dropping the move.
export default function MilestoneBoard({ projectId }: { projectId: number }) {
  const [board, setBoard] = useState<MilestoneBoardData | null>(null);
  const [columns, setColumns] = useState<Record<string, BoardCard[]>>({});
  const [loading, setLoading] = useState(true);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [draggingNumber, setDraggingNumber] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const dragRef = useRef<DragState | null>(null);
  const columnElsRef = useRef(new Map<string, HTMLDivElement>());

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

  function moveCard(issueNumber: number, sourceStatus: string, targetStatus: string) {
    if (sourceStatus === targetStatus) return;
    const current = columnsRef.current;
    const moving = current[sourceStatus]?.find((issue) => issue.number === issueNumber);
    if (!moving) return;

    const previous = current;
    setColumns({
      ...current,
      [sourceStatus]: current[sourceStatus].filter((issue) => issue.number !== issueNumber),
      [targetStatus]: [...current[targetStatus], { ...moving, status: targetStatus }],
    });
    setMoveError(null);

    api.moveBoardCard(projectId, issueNumber, targetStatus).catch((e: Error) => {
      setColumns(previous);
      setMoveError(e.message);
    });
  }

  // Nearest column by horizontal distance (0 if the point is already inside
  // it), ignoring points far outside the board's row vertically - a plain
  // hit-test would miss the gaps between grid columns entirely.
  function columnUnder(clientX: number, clientY: number): string | null {
    let closest: string | null = null;
    let closestDist = Infinity;
    for (const [status, el] of columnElsRef.current) {
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top - 40 || clientY > rect.bottom + 40) continue;
      const dist = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
      if (dist < closestDist) {
        closestDist = dist;
        closest = status;
      }
    }
    return closest;
  }

  function handleCardMouseDown(e: ReactMouseEvent, issue: BoardCard, sourceStatus: string) {
    if (e.button !== 0) return;
    const state: DragState = {
      issueNumber: issue.number,
      sourceStatus,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    dragRef.current = state;

    function onMove(ev: MouseEvent) {
      if (!state.moved && Math.hypot(ev.clientX - state.startX, ev.clientY - state.startY) > 6) {
        state.moved = true;
        setDraggingNumber(state.issueNumber);
        document.body.classList.add('board-dragging');
      }
      if (state.moved) setDragOverStatus(columnUnder(ev.clientX, ev.clientY));
    }

    function onUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.classList.remove('board-dragging');
      dragRef.current = null;
      setDraggingNumber(null);
      setDragOverStatus(null);

      if (!state.moved) {
        window.open(issue.html_url, '_blank', 'noopener,noreferrer');
        return;
      }
      const targetStatus = columnUnder(ev.clientX, ev.clientY);
      if (targetStatus) moveCard(state.issueNumber, state.sourceStatus, targetStatus);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
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
              ref={(el) => {
                if (el) columnElsRef.current.set(status, el);
                else columnElsRef.current.delete(status);
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
                    className={`board-card board-card-draggable${draggingNumber === issue.number ? ' board-card-dragging' : ''}`}
                    role="button"
                    tabIndex={0}
                    onMouseDown={(e) => handleCardMouseDown(e, issue, status)}
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
    </div>
  );
}
