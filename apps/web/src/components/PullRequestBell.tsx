import { useEffect, useRef, useState } from 'react';
import Badge from '@intility/bifrost-react/Badge';
import Icon from '@intility/bifrost-react/Icon';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import { api, type OpenPullRequest } from '../api';

// A small notification bell for open pull requests on the source repo — a nudge
// that something is ready to review/merge on GitHub, since this app has no way
// to merge anything itself. Polls on an interval so it stays current without a
// page reload; each entry links straight to the PR on GitHub.
export default function PullRequestBell() {
  const [pulls, setPulls] = useState<OpenPullRequest[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function load() {
      api.listOpenPullRequests().then(setPulls).catch(() => undefined);
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

  return (
    <div className="pr-bell" ref={containerRef}>
      <button
        className="pr-bell-button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`${pulls.length} åpne pull requests`}
      >
        <Icon icon={faBell} size="lg" />
        {pulls.length > 0 && <span className="pr-bell-badge">{pulls.length}</span>}
      </button>

      {open && (
        <div className="pr-bell-panel">
          <div className="pr-bell-panel-title">Åpne pull requests</div>
          {pulls.length === 0 ? (
            <p className="muted">Ingen åpne pull requests akkurat nå.</p>
          ) : (
            pulls.map((p) => (
              <a
                key={p.number}
                href={p.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="pr-bell-item"
              >
                <span>
                  {p.title} <span className="muted">#{p.number}</span>
                </span>
                {p.draft && <Badge state="neutral">Draft</Badge>}
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
