import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Table from '@intility/bifrost-react/Table';
import Badge from '@intility/bifrost-react/Badge';
import Button from '@intility/bifrost-react/Button';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import Select from '@intility/bifrost-react-select';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { api, type ProjectWithCount } from '../api';
import { projectBadgeState, formatTimeline } from '../status';

interface Option {
  value: string;
  label: string;
}

export default function ProjectList() {
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [team, setTeam] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.all([api.listProjects(team || undefined), api.listTeams()])
      .then(([projectList, teamList]) => {
        setProjects(projectList);
        setTeams(teamList);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [team]);

  const teamOptions: Option[] = teams.map((t) => ({ value: t, label: t }));

  return (
    <>
      <div className="page-header">
        <h1 className="bf-h1">Prosjekter</h1>
        <Button variant="filled" onClick={() => navigate('/projects/new')}>
          <Icon icon={faPlus} marginRight />
          Nytt prosjekt
        </Button>
      </div>

      {teamOptions.length > 0 && (
        <Select
          label="Filtrer på team"
          options={teamOptions}
          value={team ? { value: team, label: team } : null}
          onChange={(opt) => setTeam((opt as Option | null)?.value ?? '')}
          isClearable
          placeholder="Alle team"
        />
      )}

      {loading && <Icon.Spinner aria-label="Laster prosjekter" />}

      {error && (
        <Message state="alert" header="Kunne ikke laste prosjekter">
          {error}
        </Message>
      )}

      {!loading && !error && projects.length === 0 && (
        <Message header={team ? `Ingen prosjekter for team ${team}` : 'Ingen prosjekter enda'}>
          {team ? 'Prøv et annet team, eller fjern filteret.' : 'Opprett ditt første prosjekt for å komme i gang.'}
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
              <Table.HeaderCell>Saker</Table.HeaderCell>
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
                <Table.Cell>{p.case_count}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </>
  );
}
