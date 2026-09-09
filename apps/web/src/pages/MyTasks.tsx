import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Badge from '@intility/bifrost-react/Badge';
import Button from '@intility/bifrost-react/Button';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import Table from '@intility/bifrost-react/Table';
import Select from '@intility/bifrost-react-select';
import { api, type Assignee, type CaseWithProjectInfo } from '../api';
import { clearCurrentUser, getCurrentUser, setCurrentUser } from '../currentUser';
import { caseBadgeState, formatDate, githubIssueUrl } from '../status';

interface Option {
  value: string;
  label: string;
}

function deadlineBadge(caseDate: string | null): { state: 'alert' | 'warning' | 'neutral'; text: string } {
  if (!caseDate) return { state: 'neutral', text: 'Ingen frist' };
  const days = Math.round(
    (new Date(caseDate).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return { state: 'alert', text: `${Math.abs(days)} dager forsinket` };
  if (days === 0) return { state: 'warning', text: 'I dag' };
  if (days <= 7) return { state: 'warning', text: `${days} dager` };
  return { state: 'neutral', text: `${days} dager` };
}

// The page people actually open in the morning: one person's own open issues
// across every milestone, sorted by frist - "Oversikt" already covers the
// portfolio view for the leads, this is the personal worklist for everyone else.
// There's no login here, so "who you are" is a one-time local pick remembered
// per browser rather than a real session.
export default function MyTasks() {
  const navigate = useNavigate();
  const [login, setLogin] = useState<string | null>(() => getCurrentUser());
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [picked, setPicked] = useState('');
  const [cases, setCases] = useState<CaseWithProjectInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (login) return;
    api.listAssignees().then(setAssignees).catch(() => undefined);
  }, [login]);

  useEffect(() => {
    if (!login) return;
    setLoading(true);
    setError(null);
    api
      .listCases({ owner: login })
      .then(setCases)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [login]);

  function handlePick() {
    if (!picked) return;
    setCurrentUser(picked);
    setLogin(picked);
  }

  function handleSwitchUser() {
    clearCurrentUser();
    setLogin(null);
    setCases([]);
  }

  if (!login) {
    return (
      <div className="stack">
        <h1 className="bf-h1">Mine oppgaver</h1>
        <Card padding="large" className="stack-sm">
          <p className="muted">
            Ingen innlogging her enda - velg din egen GitHub-bruker en gang, så husker denne
            nettleseren valget.
          </p>
          {assignees.length > 0 ? (
            <Select
              label="Hvem er du?"
              options={assignees.map((a) => ({ value: a.login, label: a.login }))}
              value={picked ? { value: picked, label: picked } : null}
              onChange={(opt) => setPicked((opt as Option | null)?.value ?? '')}
              placeholder="Velg din GitHub-bruker"
            />
          ) : (
            <Icon.Spinner aria-label="Laster brukere" />
          )}
          <div className="form-actions">
            <Button variant="filled" state={picked ? 'default' : 'inactive'} onClick={handlePick}>
              Lagre
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const openCases = cases
    .filter((c) => c.status !== 'Løst')
    .sort((a, b) => {
      if (!a.case_date && !b.case_date) return 0;
      if (!a.case_date) return 1;
      if (!b.case_date) return -1;
      return a.case_date.localeCompare(b.case_date);
    });

  return (
    <div className="stack">
      <div className="page-header">
        <h1 className="bf-h1">
          <span className="team-member">
            <img
              className="team-avatar"
              src={`https://github.com/${login}.png?size=64`}
              alt=""
              width={28}
              height={28}
            />
            Mine oppgaver
          </span>
        </h1>
        <Button variant="flat" onClick={handleSwitchUser}>
          Ikke {login}? Bytt bruker
        </Button>
      </div>

      {loading && <Icon.Spinner aria-label="Laster oppgaver" />}

      {error && (
        <Message state="alert" header="Kunne ikke laste oppgaver">
          {error}
        </Message>
      )}

      {!loading && !error && (
        <Card padding="large" className="stack-sm">
          {openCases.length === 0 ? (
            <Message header="Ingen åpne issuer" noIcon>
              Du eier ingen åpne issuer akkurat nå.
            </Message>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Tittel</Table.HeaderCell>
                  <Table.HeaderCell>Prosjekt</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Frist</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {openCases.map((c) => {
                  const issueUrl =
                    c.github_repo && c.github_issue_number
                      ? githubIssueUrl(c.github_repo, c.github_issue_number)
                      : null;
                  const deadline = deadlineBadge(c.case_date);
                  return (
                    <Table.Row
                      key={c.id}
                      onClick={
                        issueUrl
                          ? () => window.open(issueUrl, '_blank', 'noopener,noreferrer')
                          : () => navigate(`/projects/${c.project_id}`)
                      }
                      style={{ cursor: 'pointer' }}
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
                      <Table.Cell>
                        <span className="deadline-when">
                          <span>{formatDate(c.case_date)}</span>
                          <Badge state={deadline.state}>{deadline.text}</Badge>
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
