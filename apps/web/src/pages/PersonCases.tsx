import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import Table from '@intility/bifrost-react/Table';
import Badge from '@intility/bifrost-react/Badge';
import Button from '@intility/bifrost-react/Button';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { api, type CaseWithProject } from '../api';
import { caseBadgeState, formatDate, githubIssueUrl } from '../status';

export default function PersonCases() {
  const { owner = '' } = useParams();
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .listCasesForOwner(owner)
      .then(setCases)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [owner]);

  return (
    <div className="stack">
      <div>
        <Button variant="flat" small onClick={() => navigate('/team')}>
          <Icon icon={faArrowLeft} marginRight />
          Team
        </Button>
      </div>

      <div className="page-header">
        <h1 className="bf-h1">
          <span className="team-member">
            <img
              className="team-avatar"
              src={`https://github.com/${owner}.png?size=64`}
              alt=""
              width={32}
              height={32}
            />
            {owner}
          </span>
        </h1>
      </div>

      {loading && <Icon.Spinner aria-label="Laster saker" />}

      {error && (
        <Message state="alert" header="Kunne ikke laste saker">
          {error}
        </Message>
      )}

      {!loading && !error && cases.length === 0 && (
        <Message header="Ingen aktive saker">
          {owner} eier ingen åpne eller pågående saker akkurat nå.
        </Message>
      )}

      {!loading && !error && cases.length > 0 && (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Sak</Table.HeaderCell>
              <Table.HeaderCell>Prosjekt</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Dato</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {cases.map((c) => {
              const issueUrl =
                c.github_repo && c.github_issue_number
                  ? githubIssueUrl(c.github_repo, c.github_issue_number)
                  : null;
              return (
                <Table.Row
                  key={c.id}
                  onClick={() =>
                    issueUrl
                      ? window.open(issueUrl, '_blank', 'noopener,noreferrer')
                      : navigate(`/projects/${c.project_id}`)
                  }
                >
                  <Table.Cell>
                    {c.title}
                    {c.github_repo && (
                      <Badge state="neutral" style={{ marginLeft: 8 }}>
                        GitHub
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>{c.project_name}</Table.Cell>
                  <Table.Cell>
                    <Badge state={caseBadgeState(c.status)}>{c.status}</Badge>
                  </Table.Cell>
                  <Table.Cell>{formatDate(c.case_date)}</Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      )}
    </div>
  );
}
