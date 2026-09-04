import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import Table from '@intility/bifrost-react/Table';
import { api, type Customer } from '../api';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listCustomers()
      .then(setCustomers)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="stack">
      <h1 className="bf-h1">Kunder</h1>
      <p className="muted">Alle kunder som har minst ett prosjekt, med antall aktive og totalt.</p>

      <Card padding="medium">
        {loading && <Icon.Spinner aria-label="Laster kunder" />}

        {error && (
          <Message state="alert" header="Kunne ikke laste kunder">
            {error}
          </Message>
        )}

        {!loading && !error && customers.length === 0 && (
          <Message header="Ingen kunder enda">Opprett et prosjekt for å få den første kunden.</Message>
        )}

        {!loading && !error && customers.length > 0 && (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Kunde</Table.HeaderCell>
                <Table.HeaderCell>Aktive prosjekter</Table.HeaderCell>
                <Table.HeaderCell>Totalt</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {customers.map((c) => (
                <Table.Row
                  key={c.customer}
                  onClick={() => navigate(`/projects?search=${encodeURIComponent(c.customer)}`)}
                >
                  <Table.Cell>{c.customer}</Table.Cell>
                  <Table.Cell>{c.active_count}</Table.Cell>
                  <Table.Cell>{c.project_count}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>
    </div>
  );
}
