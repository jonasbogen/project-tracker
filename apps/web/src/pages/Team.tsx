import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Table from '@intility/bifrost-react/Table';
import Badge from '@intility/bifrost-react/Badge';
import Card from '@intility/bifrost-react/Card';
import Message from '@intility/bifrost-react/Message';
import { api, type TeamMember } from '../api';
import Skeleton from '../components/Skeleton';

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
      <div className="hero-banner hero-banner-compact">
        <img src="/team-ops.jpg" alt="" className="hero-banner-image" />
        <div className="hero-banner-overlay" />
        <div className="hero-banner-content">
          <h1 className="hero-banner-title">Team</h1>
          <p className="hero-banner-subtitle">
            Personer som er satt som eier (assignee) på minst én issue fra GitHub, med antall
            issuer de eier.
          </p>
        </div>
      </div>

      <Card padding="large">
        {loading && (
          <div className="stack-sm" aria-label="Laster team">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} style={{ height: 20 }} />
            ))}
          </div>
        )}

        {error && (
          <Message state="alert" header="Kunne ikke laste team">
            {error}
          </Message>
        )}

        {!loading && !error && team.length === 0 && (
          <Message header="Ingen eiere registrert enda">
            Issuer synkronisert fra GitHub viser eier her når issuene har en assignee.
          </Message>
        )}

        {!loading && !error && team.length > 0 && (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Person</Table.HeaderCell>
                <Table.HeaderCell>Åpne issuer</Table.HeaderCell>
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
                  <Table.Cell>
                    <Badge state={member.open_cases > 0 ? 'attn' : 'neutral'}>{member.open_cases}</Badge>
                  </Table.Cell>
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
