import { useEffect, useState, type DragEvent } from 'react';
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

// A live, two-way mirror of the GitHub Projects board for this project's
// milestone: draggable columns for the Status field (Backlog/To do/In
// progress/Blocked/Done, the same ones on github.com/orgs/<org>/projects/318).
// Dragging a card between columns calls straight through to the real GitHub
// project board (see moveIssueStatus on the server) - there is no local copy
// of "status" to drift out of sync, and no separate grouping of our own on
// top of it - a card sits in whichever column it actually sits in on GitHub.
//
// Native HTML5 drag-and-drop (not a pointer-events library) - the same
// dragover/drop handlers are attached to both the column AND every card in
// it, since a drop landing on a nested draggable card is exactly the case
// browsers are least reliable about bubbling correctly to an ancestor drop
// zone; duplicating the handler removes any dependence on that bubbling.
//
// debugLog renders on-page (not just to the console) so a move can be
// diagnosed without browser devtools or working server logs.
export default function MilestoneBoard({ projectId }: { projectId: number }) {
  const [board, setBoard] = useState<MilestoneBoardData | null>(null);
  const [columns, setColumns] = useState<Record<string, BoardCard[]>>({});
  const [loading, setLoading] = useState(true);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [draggingNumber, setDraggingNumber] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  function log(line: string) {
    setDebugLog((prev) => [...prev.slice(-9), `${new Date().toLocaleTimeString('nb-NO')} ${line}`]);
  }

  useEffect(() => {
    setLoading(true);
    api
      .getProjectBoard(projectId)
      .then((data) => {
        setBoard(data);
        setColumns(bucketByStatus(data));
        const totalIssues = data.groups.reduce((sum, g) => sum + g.total, 0);
        const withStatus = data.groups.reduce(
          (sum, g) => sum + g.issues.filter((i) => i.status).length,
          0,
        );
        log(
          `Lastet: ${totalIssues} issue(r) totalt, ${withStatus} har status. Kolonner: [${data.statusOrder.join(', ') || 'ingen'}]. StatusCounts: ${JSON.stringify(data.statusCounts)}`,
        );
      })
      .catch((e: Error) => {
        log(`Kunne ikke laste tavlen: ${e.message}`);
        setBoard({ statusCounts: [], groups: [], statusOrder: [], boardUrl: '' });
        setColumns({});
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function moveCard(issueNumber: number, targetStatus: string) {
    const sourceStatus = Object.keys(columns).find((status) => columns[status].some((i) => i.number === issueNumber));
    if (!sourceStatus) {
      log(`Fant ikke #${issueNumber} i noen kolonne lokalt.`);
      return;
    }
    if (sourceStatus === targetStatus) {
      log(`#${issueNumber} sluppet i samme kolonne (${targetStatus}) - ingen endring.`);
      return;
    }
    const moving = columns[sourceStatus].find((i) => i.number === issueNumber);
    if (!moving) return;

    log(`Flytter #${issueNumber}: ${sourceStatus} -> ${targetStatus}`);
    const previous = columns;
    setColumns({
      ...columns,
      [sourceStatus]: columns[sourceStatus].filter((i) => i.number !== issueNumber),
      [targetStatus]: [...columns[targetStatus], { ...moving, status: targetStatus }],
    });
    setMoveError(null);

    api
      .moveBoardCard(projectId, issueNumber, targetStatus)
      .then(() => log(`GitHub bekreftet: #${issueNumber} er nå "${targetStatus}".`))
      .catch((e: Error) => {
        log(`GitHub avviste flyttingen: ${e.message}`);
        setColumns(previous);
        setMoveError(e.message);
      });
  }

  function handleDragStart(e: DragEvent, issueNumber: number) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(issueNumber));
    setDraggingNumber(issueNumber);
    log(`Startet drag av #${issueNumber}.`);
  }

  function handleDrop(e: DragEvent, targetStatus: string) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverStatus(null);
    const fromTransfer = Number(e.dataTransfer.getData('text/plain'));
    const issueNumber = Number.isInteger(fromTransfer) && fromTransfer > 0 ? fromTransfer : draggingNumber;
    setDraggingNumber(null);
    if (!issueNumber) {
      log(`Slipp registrert i "${targetStatus}", men fant ingen issue-nummer.`);
      return;
    }
    log(`Slipp registrert: #${issueNumber} i "${targetStatus}".`);
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
                    draggable
                    onDragStart={(e) => handleDragStart(e, issue.number)}
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

      {debugLog.length > 0 && (
        <Card padding="medium" className="board-debug-log">
          <p className="muted" style={{ marginBottom: 6 }}>
            Feilsøkingslogg (midlertidig, for å finne ut hvorfor drag-and-drop ikke fester seg):
          </p>
          <pre className="board-debug-log-lines">{debugLog.join('\n')}</pre>
        </Card>
      )}
    </div>
  );
}
