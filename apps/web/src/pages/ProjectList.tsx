import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Table from '@intility/bifrost-react/Table';
import Badge from '@intility/bifrost-react/Badge';
import Button from '@intility/bifrost-react/Button';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { api, type ProjectWithCount } from '../api';
import { projectBadgeState, formatTimeline } from '../status';

export default function ProjectList() {
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listProjects()
      .then(setProjects)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <h1 className="bf-h1">Prosjekter</h1>
        <Button variant="filled" onClick={() => navigate('/projects/new')}>
          <Icon icon={faPlus} marginRight />
          Nytt prosjekt
        </Button>
      </div>

      {loading && <Icon.Spinner aria-label="Laster prosjekter" />}

      {error && (
        <Message state="alert" header="Kunne ikke laste prosjekter">
          {error}
        </Message>
      )}

      {!loading && !error && projects.length === 0 && (
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
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Ansvarlig</Table.HeaderCell>
              <Table.HeaderCell>Tidslinje</Table.HeaderCell>
              <Table.HeaderCell>Saker</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {projects.map((p) => (
              <Table.Row key={p.id} onClick={() => navigate(`/projects/${p.id}`)}>
                <Table.Cell>{p.name}</Table.Cell>
                <Table.Cell>{p.customer}</Table.Cell>
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
