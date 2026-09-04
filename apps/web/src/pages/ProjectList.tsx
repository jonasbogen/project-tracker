import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Table from '@intility/bifrost-react/Table';
import Badge from '@intility/bifrost-react/Badge';
import Button from '@intility/bifrost-react/Button';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Input from '@intility/bifrost-react/Input';
import Message from '@intility/bifrost-react/Message';
import Select from '@intility/bifrost-react-select';
import { faMagnifyingGlass, faPlus } from '@fortawesome/free-solid-svg-icons';
import { api, type ProjectWithCount } from '../api';
import { projectBadgeState, formatTimeline } from '../status';

interface Option {
  value: string;
  label: string;
}

export default function ProjectList() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';
  const initialStatus = searchParams.get('status') ?? '';

  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [team, setTeam] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Debounce free-text search so we don't hit the API on every keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.listProjects(team || undefined, search || undefined, status || undefined),
      api.listTeams(),
      api.getMeta(),
    ])
      .then(([projectList, teamList, meta]) => {
        setProjects(projectList);
        setTeams(teamList);
        setStatuses(meta.projectStatuses);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [team, search, status]);

  const teamOptions: Option[] = teams.map((t) => ({ value: t, label: t }));
  const statusOptions: Option[] = statuses.map((s) => ({ value: s, label: s }));
  const hasFilter = !!(search || team || status);

  return (
    <div className="stack">
      <div className="page-header">
        <h1 className="bf-h1">Prosjekter</h1>
        <Button variant="filled" onClick={() => navigate('/projects/new')}>
          <Icon icon={faPlus} marginRight />
          Nytt prosjekt
        </Button>
      </div>

      <Card padding="medium">
        <div className="filter-row">
          <Input
            label="Søk"
            hideLabel
            icon={faMagnifyingGlass}
            placeholder="Søk på navn eller kunde…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {teamOptions.length > 0 && (
            <Select
              label="Filtrer på team"
              hideLabel
              options={teamOptions}
              value={team ? { value: team, label: team } : null}
              onChange={(opt) => setTeam((opt as Option | null)?.value ?? '')}
              isClearable
              placeholder="Alle team"
            />
          )}
          <Select
            label="Filtrer på status"
            hideLabel
            options={statusOptions}
            value={status ? { value: status, label: status } : null}
            onChange={(opt) => setStatus((opt as Option | null)?.value ?? '')}
            isClearable
            placeholder="Alle statuser"
          />
        </div>

        {loading && <Icon.Spinner aria-label="Laster prosjekter" />}

        {error && (
          <Message state="alert" header="Kunne ikke laste prosjekter">
            {error}
          </Message>
        )}

        {!loading && !error && projects.length === 0 && hasFilter && (
          <Message header="Ingen prosjekter matcher">Prøv et annet søk eller fjern filteret.</Message>
        )}

        {!loading && !error && projects.length === 0 && !hasFilter && (
          <Message header="Ingen prosjekter enda">
            Opprett ditt første prosjekt for å komme i gang.
          </Message>
        )}

        {!loading && !error && projects.length > 0 && (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Navn</Table.HeaderCell>
                <Table.HeaderCell>Kunde</Table.HeaderCell>
                <Table.HeaderCell>Team</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Ansvarlig</Table.HeaderCell>
                <Table.HeaderCell>Tidslinje</Table.HeaderCell>
                <Table.HeaderCell>Issuer</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {projects.map((p) => (
                <Table.Row key={p.id} onClick={() => navigate(`/projects/${p.id}`)}>
                  <Table.Cell>
                    {p.name}
                    {p.github_repo && (
                      <Badge state="neutral" style={{ marginLeft: 8 }}>
                        GitHub
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>{p.customer}</Table.Cell>
                  <Table.Cell>{p.team || <span className="muted">–</span>}</Table.Cell>
                  <Table.Cell>
                    <Badge state={projectBadgeState(p.status)}>{p.status}</Badge>
                  </Table.Cell>
                  <Table.Cell>{p.responsible}</Table.Cell>
                  <Table.Cell>{formatTimeline(p.start_date, p.end_date)}</Table.Cell>
                  <Table.Cell>
                    <button
                      className="cell-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/board?project=${p.id}`);
                      }}
                    >
                      {p.case_count}
                    </button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>
    </div>
  );
}
