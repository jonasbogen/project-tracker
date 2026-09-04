import { useEffect, useState } from 'react';
import Badge from '@intility/bifrost-react/Badge';
import Icon from '@intility/bifrost-react/Icon';
import { api, type MilestoneBoard as MilestoneBoardData } from '../api';

// A live mirror of the GitHub Projects board for this project's milestone:
// Status field counts (Backlog/To do/In progress/Blocked/Done) across the top,
// then issues grouped under their Tjenesteparaply parent with a completion bar
// scoped to just this milestone. The status row only appears once a
// PROJECT_TOKEN is configured server-side; the grouping works either way.
export default function MilestoneBoard({ projectId }: { projectId: number }) {
  const [board, setBoard] = useState<MilestoneBoardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getProjectBoard(projectId)
      .then(setBoard)
      .catch(() => setBoard({ statusCounts: [], groups: [] }))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <Icon.Spinner aria-label="Laster milestone-tavle" />;
  if (!board || board.groups.length === 0) return null;

  return (
    <div className="stack-sm">
      <h2 className="bf-h2">Milestone-tavle</h2>

      {board.statusCounts.length > 0 ? (
        <div className="milestone-status-row">
          {board.statusCounts.map((s) => (
            <div key={s.status} className="milestone-status-pill">
              <span className="milestone-status-count">{s.count}</span>
              <span className="muted">{s.status}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          Status-kolonner (Backlog/To do/In progress/Blocked/Done) vises når PROJECT_TOKEN er satt opp.
        </p>
      )}

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
