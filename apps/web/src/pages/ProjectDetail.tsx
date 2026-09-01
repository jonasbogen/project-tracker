import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import Table from '@intility/bifrost-react/Table';
import Badge from '@intility/bifrost-react/Badge';
import Button from '@intility/bifrost-react/Button';
import Icon from '@intility/bifrost-react/Icon';
import Input from '@intility/bifrost-react/Input';
import TextArea from '@intility/bifrost-react/TextArea';
import Message from '@intility/bifrost-react/Message';
import Select from '@intility/bifrost-react-select';
import { faArrowLeft, faPen, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { api, type Case, type Project } from '../api';
import { caseBadgeState, formatDate, formatTimeline, projectBadgeState } from '../status';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Add-case form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [caseStatus, setCaseStatus] = useState<string>('');
  const [caseDate, setCaseDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [data, meta] = await Promise.all([api.getProject(projectId), api.getMeta()]);
      setProject(data.project);
      setCases(data.cases);
      setCaseStatuses(meta.caseStatuses);
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
    if (!confirm('Slette dette prosjektet og alle tilhørende saker?')) return;
    try {
      await api.deleteProject(projectId);
      navigate('/');
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
    setSubmitting(true);
    try {
      await api.createCase(projectId, {
        title: title.trim(),
        description: description.trim(),
        status: caseStatus || undefined,
        case_date: caseDate || null,
      });
      setTitle('');
      setDescription('');
      setCaseStatus('');
      setCaseDate('');
      await load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCase(caseId: number) {
    if (!confirm('Fjerne denne saken?')) return;
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
        <Button variant="flat" onClick={() => navigate('/')}>
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
    <div className="stack">
      <div>
        <Button variant="flat" small onClick={() => navigate('/')}>
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

      <div className="detail-grid">
        <div>
          <div className="field-label">Kunde</div>
          <div>{project.customer}</div>
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
        <div style={{ whiteSpace: 'pre-wrap' }}>
          {project.challenges ? project.challenges : <span className="muted">Ingen registrert.</span>}
        </div>
      </div>

      <section className="stack-sm">
        <h2 className="bf-h2">Saker</h2>
        {cases.length === 0 ? (
          <Message noIcon header="Ingen saker knyttet til prosjektet enda." />
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Tittel</Table.HeaderCell>
                <Table.HeaderCell>Beskrivelse</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Dato</Table.HeaderCell>
                <Table.HeaderCell>{''}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {cases.map((c) => (
                <Table.Row key={c.id}>
                  <Table.Cell>{c.title}</Table.Cell>
                  <Table.Cell>{c.description || <span className="muted">–</span>}</Table.Cell>
                  <Table.Cell>
                    <Badge state={caseBadgeState(c.status)}>{c.status}</Badge>
                  </Table.Cell>
                  <Table.Cell>{formatDate(c.case_date)}</Table.Cell>
                  <Table.Cell>
                    <Button
                      small
                      variant="flat"
                      state="alert"
                      aria-label="Fjern sak"
                      onClick={() => handleDeleteCase(c.id)}
                    >
                      <Icon icon={faTrash} />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </section>

      <section className="stack-sm">
        <h2 className="bf-h2">Legg til sak</h2>
        {formError && (
          <Message state="alert" header="Kunne ikke legge til sak">
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
          </div>
          <TextArea
            label="Beskrivelse"
            optional
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            label="Dato"
            type="date"
            optional
            value={caseDate}
            onChange={(e) => setCaseDate(e.target.value)}
          />
          <div className="form-actions">
            <Button type="submit" variant="filled" state={submitting ? 'inactive' : 'default'}>
              <Icon icon={faPlus} marginRight />
              Legg til sak
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
