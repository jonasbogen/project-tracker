import { useEffect, useRef, useState } from 'react';
import Badge from '@intility/bifrost-react/Badge';
import Icon from '@intility/bifrost-react/Icon';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import { api, type RecentPullRequest } from '../api';
import { timeAgo } from '../status';

type BadgeState = 'warning' | 'success' | 'neutral';

// Open (not merged/closed) needs a look; draft isn't ready yet; merged/closed
// is just recent activity worth showing, not something to act on.
function pullRequestBadge(pr: RecentPullRequest): { state: BadgeState; label: string } {
  if (pr.state === 'open') return pr.draft ? { state: 'neutral', label: 'Draft' } : { state: 'warning', label: 'Åpen' };
  if (pr.merged_at) return { state: 'success', label: 'Merget' };
  return { state: 'neutral', label: 'Lukket' };
}

// A small notification bell for recent pull request activity on the source
// repo (open ones to review/merge, and recently merged/closed ones so "no
// open PRs" doesn't read as "nothing happened") — since this app has no way
// to merge anything itself, every entry just links straight to GitHub. Polls
// on an interval so it stays current without a page reload.
export default function PullRequestBell() {
  const [pulls, setPulls] = useState<RecentPullRequest[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function load() {
      api.listRecentPullRequests().then(setPulls).catch(() => undefined);
    }
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const openCount = pulls.filter((p) => p.state === 'open').length;

  return (
    <div className="pr-bell" ref={containerRef}>
      <button
        className="pr-bell-button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`${openCount} åpne pull requests, ${pulls.length} vist i listen`}
      >
        <Icon icon={faBell} size="lg" />
        {openCount > 0 && (
          <Badge state="attn" className="pr-bell-badge">
            {openCount}
          </Badge>
        )}
      </button>

      {open && (
        <div className="pr-bell-panel">
          <div className="pr-bell-panel-title">Siste pull requests</div>
          {pulls.length === 0 ? (
            <p className="muted">Ingen pull request-aktivitet å vise.</p>
          ) : (
            <div className="pr-bell-list">
              {pulls.map((p) => {
                const badge = pullRequestBadge(p);
                return (
                  <a
                    key={p.number}
                    href={p.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pr-bell-item"
                  >
                    <div className="pr-bell-item-main">
                      <span className="pr-bell-item-title">{p.title}</span>
                      <span className="muted pr-bell-item-meta">
                        #{p.number}
                        {p.user && ` · ${p.user}`} · {timeAgo(p.merged_at ?? p.updated_at)}
                      </span>
                    </div>
                    <Badge state={badge.state}>{badge.label}</Badge>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
