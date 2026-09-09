import { useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
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

function CardContent({ issue }: { issue: BoardCard }) {
  return (
    <>
      <div className={`board-card-title${issue.state === 'closed' ? ' milestone-issue-title-done' : ''}`}>
        {issue.title}
      </div>
      {issue.umbrella && <div className="muted board-card-meta">{issue.umbrella}</div>}
      {issue.assignees.length > 0 && (
        <div className="board-card-footer">
          <span className="team-member">
            {issue.assignees.map((a) => (
              <img key={a.login} className="team-avatar" src={a.avatar_url} alt={a.login} title={a.login} width={20} height={20} />
            ))}
          </span>
        </div>
      )}
    </>
  );
}

function BoardCardItem({ issue }: { issue: BoardCard }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: issue.number });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`board-card board-card-draggable${isDragging ? ' board-card-dragging' : ''}`}
      onClick={() => window.open(issue.html_url, '_blank', 'noopener,noreferrer')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') window.open(issue.html_url, '_blank', 'noopener,noreferrer');
      }}
    >
      <CardContent issue={issue} />
    </div>
  );
}

function BoardColumn({ status, issues }: { status: string; issues: BoardCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <Card
      padding="large"
      className={`board-column${isOver ? ' board-column-dragover' : ''}`}
      ref={setNodeRef}
    >
      <div className="board-column-header">
        <span className="bf-h3">{status}</span>
        <Badge state="neutral">{issues.length}</Badge>
      </div>
      <div className="board-column-body">
        {issues.length === 0 && <p className="muted">Ingen issues.</p>}
        {issues.map((issue) => (
          <BoardCardItem key={issue.number} issue={issue} />
        ))}
      </div>
    </Card>
  );
}

// A live, two-way mirror of the GitHub Projects board for this project's
// milestone: draggable columns for the Status field (Backlog/To do/In
// progress/Blocked/Done, the same ones on github.com/orgs/<org>/projects/318).
// Dragging a card between columns calls straight through to the real GitHub
// project board (see moveIssueStatus on the server) - there is no local copy
// of "status" to drift out of sync, and no separate grouping of our own on
// top of it - a card sits in whichever column it actually sits in on GitHub.
//
// Drag-and-drop itself is @dnd-kit/core (pointer-events based, not the
// native HTML5 DnD API) - two different from-scratch attempts at this using
// native drag-and-drop and hand-rolled mouse tracking both turned out
// unreliable in practice, which is exactly the class of problem a
// purpose-built, heavily-tested library exists to solve.
export default function MilestoneBoard({ projectId }: { projectId: number }) {
  const [board, setBoard] = useState<MilestoneBoardData | null>(null);
  const [columns, setColumns] = useState<Record<string, BoardCard[]>>({});
  const [loading, setLoading] = useState(true);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [activeIssue, setActiveIssue] = useState<BoardCard | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  function handleDragStart(event: DragStartEvent) {
    const issueNumber = Number(event.active.id);
    for (const list of Object.values(columns)) {
      const issue = list.find((i) => i.number === issueNumber);
      if (issue) {
        setActiveIssue(issue);
        return;
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveIssue(null);
    const targetStatus = event.over?.id as string | undefined;
    if (!targetStatus) return;
    const issueNumber = Number(event.active.id);
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
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="board">
            {board.statusOrder.map((status) => (
              <BoardColumn key={status} status={status} issues={columns[status] ?? []} />
            ))}
          </div>
          <DragOverlay>
            {activeIssue && (
              <div className="board-card board-card-draggable board-card-overlay">
                <CardContent issue={activeIssue} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <p className="muted">
          Board-kolonner (Backlog/To do/In progress/Blocked/Done) vises når PROJECT_TOKEN er satt opp med
          skrivetilgang til prosjekttavlen.
        </p>
      )}
    </div>
  );
}
