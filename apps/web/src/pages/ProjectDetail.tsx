import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import Table from '@intility/bifrost-react/Table';
import Badge from '@intility/bifrost-react/Badge';
import Button from '@intility/bifrost-react/Button';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Input from '@intility/bifrost-react/Input';
import TextArea from '@intility/bifrost-react/TextArea';
import Message from '@intility/bifrost-react/Message';
import Select from '@intility/bifrost-react-select';
import { faArrowLeft, faPen, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { api, type Assignee, type Case, type Project, type ServiceUmbrella } from '../api';
import {
  caseBadgeState,
  caseStatusColor,
  daysUntil,
  formatDate,
  formatTimeline,
  githubIssueUrl,
  projectBadgeState,
} from '../status';
import BarChart from '../charts/BarChart';
import FormattedText from '../components/FormattedText';
import CompanyLogo from '../components/CompanyLogo';
import MilestoneBoard from '../components/MilestoneBoard';
import MilestoneSidebar from '../components/MilestoneSidebar';

interface Option {
  value: string;
  label: string;
}

export default function ProjectDetail() {
  const { id } = useParams();
  const projectId = Number(id);
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [caseStatuses, setCaseStatuses] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [customerOptions, setCustomerOptions] = useState<string[]>([]);
  const [serviceUmbrellas, setServiceUmbrellas] = useState<ServiceUmbrella[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Add-case form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [caseStatus, setCaseStatus] = useState<string>('');
  const [caseDate, setCaseDate] = useState('');
  const [owner, setOwner] = useState('');
  const [kunde, setKunde] = useState('');
  const [tjenesteparaply, setTjenesteparaply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [data, meta, assigneeList, customerList, umbrellaList] = await Promise.all([
        api.getProject(projectId),
        api.getMeta(),
        api.listAssignees(),
        api.listCustomerOptions(),
        api.listServiceUmbrellas(),
      ]);
      setProject(data.project);
      setCases(data.cases);
      setCaseStatuses(meta.caseStatuses);
      setAssignees(assigneeList);
      setCustomerOptions(customerList);
      setServiceUmbrellas(umbrellaList);
      setKunde((prev) => prev || data.project.customer);
    } catch (e) {
      const err = e as Error & { message: string };
      if (err.message.includes('finnes ikke')) setNotFound(true);
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleDeleteProject() {
    if (!confirm('Slette dette prosjektet og alle tilhørende issuer?')) return;
    try {
      await api.deleteProject(projectId);
      navigate('/projects');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleAddCase(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) {
      setFormError('Tittel er påkrevd.');
      return;
    }
    if (!description.trim()) {
      setFormError('Beskrivelse er påkrevd.');
      return;
    }
    if (!kunde.trim()) {
      setFormError('Kunde er påkrevd.');
      return;
    }
    if (!tjenesteparaply.trim()) {
      setFormError('Tjenesteparaply er påkrevd.');
      return;
    }
    setSubmitting(true);
    try {
      await api.createCase(projectId, {
        title: title.trim(),
        description: description.trim(),
        status: caseStatus || undefined,
        case_date: caseDate || null,
        owner: owner || undefined,
        kunde: kunde.trim(),
        tjenesteparaply: tjenesteparaply.trim(),
      });
      setTitle('');
      setDescription('');
      setCaseStatus('');
      setCaseDate('');
      setOwner('');
      setTjenesteparaply('');
      await load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCase(caseId: number) {
    if (!confirm('Fjerne denne issuen?')) return;
    try {
      await api.deleteCase(projectId, caseId);
      setCases((prev) => prev.filter((c) => c.id !== caseId));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <Icon.Spinner aria-label="Laster prosjekt" />;

  if (notFound) {
    return (
      <Message state="warning" header="Prosjektet finnes ikke">
        <Button variant="flat" onClick={() => navigate('/projects')}>
          <Icon icon={faArrowLeft} marginRight />
          Tilbake til prosjekter
        </Button>
      </Message>
    );
  }

  if (error || !project) {
    return (
      <Message state="alert" header="Noe gikk feil">
        {error ?? 'Ukjent feil.'}
      </Message>
    );
  }

  const statusOptions: Option[] = caseStatuses.map((s) => ({ value: s, label: s }));

  return (
    <div className="project-detail-layout">
      <MilestoneSidebar activeProjectId={projectId} />
      <div className="stack project-detail-main">
      <div>
        <Button variant="flat" small onClick={() => navigate('/projects')}>
          <Icon icon={faArrowLeft} marginRight />
          Prosjekter
        </Button>
      </div>

      <div className="page-header">
        <h1 className="bf-h1">
          {project.name}
          {project.github_repo && (
            <Badge state="neutral" style={{ marginLeft: 8 }}>
              GitHub
            </Badge>
          )}
        </h1>
        <div className="inline-actions">
          <Button onClick={() => navigate(`/projects/${project.id}/edit`)}>
            <Icon icon={faPen} marginRight />
            Rediger
          </Button>
          <Button state="alert" variant="flat" onClick={handleDeleteProject}>
            <Icon icon={faTrash} marginRight />
            Slett
          </Button>
        </div>
      </div>

      <Card padding="medium">
        <div className="stack-sm">
          <div className="detail-grid">
            <div>
              <div className="field-label">Kunde</div>
              <div className="team-member">
                <CompanyLogo name={project.customer} />
                {project.customer}
              </div>
            </div>
            <div>
              <div className="field-label">Status</div>
              <Badge state={projectBadgeState(project.status)}>{project.status}</Badge>
            </div>
            <div>
              <div className="field-label">Ansvarlig</div>
              <div>{project.responsible}</div>
            </div>
            <div>
              <div className="field-label">Team</div>
              <div>{project.team || <span className="muted">–</span>}</div>
            </div>
            <div>
              <div className="field-label">Tidslinje</div>
              <div>{formatTimeline(project.start_date, project.end_date)}</div>
            </div>
          </div>

          <div>
            <div className="field-label">Utfordringer</div>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {project.challenges ? (
                <FormattedText text={project.challenges} />
              ) : (
                <span className="muted">Ingen registrert.</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="dashboard-grid">
        <Card padding="medium">
          <h2 className="bf-h2">Frist og aktivitet</h2>
          {project.end_date ? (
            <div className="deadline-list">
              <div className="deadline-row deadline-row-static">
                <div>
                  <div className="deadline-name">Frist</div>
                  <div className="muted">{project.name}</div>
                </div>
                <div className="deadline-when">
                  <span>{formatDate(project.end_date)}</span>
                  {(() => {
                    const days = daysUntil(project.end_date);
                    return (
                      <Badge state={days <= 7 ? 'warning' : 'neutral'}>
                        {days < 0 ? 'Passert' : days === 0 ? 'I dag' : `${days} dager`}
                      </Badge>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : (
            <p className="muted">Ingen frist satt for dette prosjektet.</p>
          )}

          <h3 className="bf-h3 recent-activity-heading">Siste aktivitet</h3>
          {cases.length === 0 ? (
            <p className="muted">Ingen issuer registrert enda.</p>
          ) : (
            <div className="deadline-list">
              {[...cases]
                .sort((a, b) => (b.case_date ?? '').localeCompare(a.case_date ?? ''))
                .slice(0, 5)
                .map((c) => {
                  const issueUrl =
                    c.github_repo && c.github_issue_number
                      ? githubIssueUrl(c.github_repo, c.github_issue_number)
                      : null;
                  return (
                    <button
                      key={c.id}
                      className={`deadline-row${issueUrl ? '' : ' deadline-row-static'}`}
                      onClick={
                        issueUrl ? () => window.open(issueUrl, '_blank', 'noopener,noreferrer') : undefined
                      }
                    >
                      <div className="deadline-name">{c.title}</div>
                      <div className="deadline-when">
                        <span>{formatDate(c.case_date)}</span>
                        <Badge state={caseBadgeState(c.status)}>{c.status}</Badge>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </Card>
        <Card padding="medium">
          <h2 className="bf-h2">Issuer per status</h2>
          <BarChart
            items={caseStatuses.map((status) => ({
              label: status,
              value: cases.filter((c) => c.status === status).length,
              color: caseStatusColor(status),
            }))}
            emptyText="Ingen issuer registrert enda."
          />
        </Card>
      </div>

      {project.github_milestone_number && (
        <Card padding="medium">
          <MilestoneBoard projectId={project.id} />
        </Card>
      )}

      <Card padding="medium" className="stack-sm">
        <h2 className="bf-h2">Issuer</h2>
        {cases.length === 0 ? (
          <Message noIcon header="Ingen issuer knyttet til prosjektet enda." />
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Tittel</Table.HeaderCell>
                <Table.HeaderCell>Beskrivelse</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Eier</Table.HeaderCell>
                <Table.HeaderCell>Dato</Table.HeaderCell>
                <Table.HeaderCell>{''}</Table.HeaderCell>
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
                  onClick={issueUrl ? () => window.open(issueUrl, '_blank', 'noopener,noreferrer') : undefined}
                  style={issueUrl ? { cursor: 'pointer' } : undefined}
                >
                  <Table.Cell>
                    {c.title}
                    {c.github_repo && (
                      <Badge state="neutral" style={{ marginLeft: 8 }}>
                        GitHub
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {c.description ? (
                      <span className="cell-clamp">
                        <FormattedText text={c.description} />
                      </span>
                    ) : (
                      <span className="muted">–</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge state={caseBadgeState(c.status)}>{c.status}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {c.owner ? (
                      <span className="team-member">
                        <img
                          className="team-avatar"
                          src={`https://github.com/${c.owner}.png?size=64`}
                          alt=""
                          width={20}
                          height={20}
                        />
                        {c.owner}
                      </span>
                    ) : (
                      <span className="muted">–</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>{formatDate(c.case_date)}</Table.Cell>
                  <Table.Cell>
                    <Button
                      small
                      variant="flat"
                      state="alert"
                      aria-label="Fjern issue"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCase(c.id);
                      }}
                    >
                      <Icon icon={faTrash} />
                    </Button>
                  </Table.Cell>
                </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        )}
      </Card>

      <Card padding="medium" className="stack-sm">
        <h2 className="bf-h2">Legg til issue</h2>
        <p className="muted">Opprettes automatisk som en issue på GitHub.</p>
        {formError && (
          <Message state="alert" header="Kunne ikke opprette issue">
            {formError}
          </Message>
        )}
        <form onSubmit={handleAddCase} className="stack-sm">
          <div className="form-grid">
            <Input
              label="Tittel"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Select
              label="Status"
              options={statusOptions}
              value={caseStatus ? { value: caseStatus, label: caseStatus } : null}
              onChange={(opt) => setCaseStatus((opt as Option | null)?.value ?? '')}
              isClearable
              placeholder="Åpen"
            />
            {assignees.length > 0 ? (
              <Select
                label="Eier"
                optional
                options={assignees.map((a) => ({ value: a.login, label: a.login }))}
                value={owner ? { value: owner, label: owner } : null}
                onChange={(opt) => setOwner((opt as Option | null)?.value ?? '')}
                isClearable
                placeholder="Velg blant assignees på GitHub"
              />
            ) : (
              <Input
                label="Eier"
                optional
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="GitHub-brukernavn"
              />
            )}
            {customerOptions.length > 0 ? (
              <Select
                label="Kunde"
                required
                options={customerOptions.map((c) => ({ value: c, label: c }))}
                value={kunde ? { value: kunde, label: kunde } : null}
                onChange={(opt) => setKunde((opt as Option | null)?.value ?? '')}
                placeholder="Velg kunde"
              />
            ) : (
              <Input
                label="Kunde"
                required
                value={kunde}
                onChange={(e) => setKunde(e.target.value)}
              />
            )}
            {serviceUmbrellas.length > 0 ? (
              <Select
                label="Tjenesteparaply"
                required
                options={serviceUmbrellas.map((u) => ({ value: u.title, label: u.title }))}
                value={tjenesteparaply ? { value: tjenesteparaply, label: tjenesteparaply } : null}
                onChange={(opt) => setTjenesteparaply((opt as Option | null)?.value ?? '')}
                placeholder="Velg tjenesteparaply"
              />
            ) : (
              <Input
                label="Tjenesteparaply"
                required
                value={tjenesteparaply}
                onChange={(e) => setTjenesteparaply(e.target.value)}
                placeholder="F.eks. Network"
              />
            )}
          </div>
          <TextArea
            label="Beskrivelse"
            required
            placeholder="Hva skal gjøres, og hva er kriteriene for ferdig?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            label="Frist"
            type="date"
            optional
            value={caseDate}
            onChange={(e) => setCaseDate(e.target.value)}
          />
          <div className="form-actions">
            <Button type="submit" variant="filled" state={submitting ? 'inactive' : 'default'}>
              <Icon icon={faPlus} marginRight />
              Legg til issue
            </Button>
          </div>
        </form>
      </Card>
      </div>
    </div>
  );
}
