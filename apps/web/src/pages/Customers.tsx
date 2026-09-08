import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Input from '@intility/bifrost-react/Input';
import Message from '@intility/bifrost-react/Message';
import Table from '@intility/bifrost-react/Table';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { api, type Customer } from '../api';
import CompanyLogo from '../components/CompanyLogo';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
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

  const query = search.trim().toLowerCase();
  const filtered = query ? customers.filter((c) => c.customer.toLowerCase().includes(query)) : customers;

  return (
    <div className="stack">
      <h1 className="bf-h1">Kunder</h1>
      <p className="muted">Alle kunder som har minst ett prosjekt, med antall aktive og totalt.</p>

      <Card padding="medium">
        <Input
          label="Søk kunde"
          hideLabel
          icon={faMagnifyingGlass}
          placeholder="Søk på kunde…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        {loading && <Icon.Spinner aria-label="Laster kunder" />}

        {error && (
          <Message state="alert" header="Kunne ikke laste kunder">
            {error}
          </Message>
        )}

        {!loading && !error && customers.length === 0 && (
          <Message header="Ingen kunder enda">Opprett et prosjekt for å få den første kunden.</Message>
        )}

        {!loading && !error && customers.length > 0 && filtered.length === 0 && (
          <Message header="Ingen kunder matcher">Prøv et annet søk.</Message>
        )}

        {!loading && !error && filtered.length > 0 && (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Kunde</Table.HeaderCell>
                <Table.HeaderCell>Aktive prosjekter</Table.HeaderCell>
                <Table.HeaderCell>Totalt</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filtered.map((c) => (
                <Table.Row
                  key={c.customer}
                  onClick={() => navigate(`/projects?search=${encodeURIComponent(c.customer)}`)}
                >
                  <Table.Cell>
                    <span className="team-member">
                      <CompanyLogo name={c.customer} />
                      {c.customer}
                    </span>
                  </Table.Cell>
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
