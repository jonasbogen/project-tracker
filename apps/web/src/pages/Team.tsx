import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Table from '@intility/bifrost-react/Table';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import { api, type TeamMember } from '../api';

export default function Team() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listTeam()
      .then(setTeam)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="stack">
      <h1 className="bf-h1">Team</h1>
      <p className="muted">
        Personer som er satt som eier (assignee) på minst én sak fra GitHub, med antall saker de
        eier.
      </p>

      <Card padding="medium">
        {loading && <Icon.Spinner aria-label="Laster team" />}

        {error && (
          <Message state="alert" header="Kunne ikke laste team">
            {error}
          </Message>
        )}

        {!loading && !error && team.length === 0 && (
          <Message header="Ingen eiere registrert enda">
            Saker synkronisert fra GitHub viser eier her når issuene har en assignee.
          </Message>
        )}

        {!loading && !error && team.length > 0 && (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Person</Table.HeaderCell>
                <Table.HeaderCell>Åpne saker</Table.HeaderCell>
                <Table.HeaderCell>Totalt</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {team.map((member) => (
                <Table.Row
                  key={member.owner}
                  onClick={() => navigate(`/team/${encodeURIComponent(member.owner)}`)}
                >
                  <Table.Cell>
                    <span className="team-member">
                      <img
                        className="team-avatar"
                        src={`https://github.com/${member.owner}.png?size=64`}
                        alt=""
                        width={28}
                        height={28}
                      />
                      {member.owner}
                    </span>
                  </Table.Cell>
                  <Table.Cell>{member.open_cases}</Table.Cell>
                  <Table.Cell>{member.total_cases}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>
    </div>
  );
}
