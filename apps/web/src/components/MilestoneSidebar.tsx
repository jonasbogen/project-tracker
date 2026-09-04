import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Card from '@intility/bifrost-react/Card';
import Input from '@intility/bifrost-react/Input';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { api, type ProjectWithCount } from '../api';

// A searchable list of every project (milestone), so you can jump between them
// without going back to the full project list — mirrors GitHub's own milestone
// sidebar when you're looking at one.
export default function MilestoneSidebar({ activeProjectId }: { activeProjectId: number }) {
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.listProjects().then(setProjects).catch(() => undefined);
  }, []);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? projects.filter(
        (p) => p.name.toLowerCase().includes(query) || p.customer.toLowerCase().includes(query),
      )
    : projects;

  return (
    <Card padding="medium" className="milestone-sidebar">
      <Input
        label="Søk milestone"
        hideLabel
        icon={faMagnifyingGlass}
        placeholder="Søk milestone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="milestone-sidebar-list">
        {filtered.length === 0 && <p className="muted">Ingen treff.</p>}
        {filtered.map((p) => (
          <button
            key={p.id}
            className={`milestone-sidebar-item${p.id === activeProjectId ? ' milestone-sidebar-item-active' : ''}`}
            onClick={() => navigate(`/projects/${p.id}`)}
          >
            <span className="milestone-sidebar-item-name">{p.name}</span>
            <span className="muted milestone-sidebar-item-customer">{p.customer}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
