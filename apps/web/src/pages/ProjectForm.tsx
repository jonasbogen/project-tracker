import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import Button from '@intility/bifrost-react/Button';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Input from '@intility/bifrost-react/Input';
import TextArea from '@intility/bifrost-react/TextArea';
import Message from '@intility/bifrost-react/Message';
import Select from '@intility/bifrost-react-select';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { api, type OpenMilestone, type ProjectInput } from '../api';

interface Option {
  value: string;
  label: string;
}

const EMPTY: ProjectInput = {
  name: '',
  customer: '',
  status: '',
  responsible: '',
  team: '',
  start_date: '',
  end_date: '',
  challenges: '',
};

export default function ProjectForm({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams();
  const projectId = Number(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<ProjectInput>(EMPTY);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<OpenMilestone[]>([]);
  const [linkMilestone, setLinkMilestone] = useState<OpenMilestone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const meta = await api.getMeta();
        setStatuses(meta.projectStatuses);
        if (mode === 'edit') {
          const { project } = await api.getProject(projectId);
          setForm({
            name: project.name,
            customer: project.customer,
            status: project.status,
            responsible: project.responsible,
            team: project.team,
            start_date: project.start_date ?? '',
            end_date: project.end_date ?? '',
            challenges: project.challenges,
          });
        } else {
          setForm((f) => ({ ...f, status: meta.projectStatuses[0] ?? '' }));
          setMilestones(await api.listOpenMilestones());
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, projectId]);

  function update<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const saved =
        mode === 'create'
          ? await api.createProject(form, linkMilestone?.number)
          : await api.updateProject(projectId, form);
      navigate(`/projects/${saved.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  if (loading) return <Icon.Spinner aria-label="Laster" />;

  const statusOptions: Option[] = statuses.map((s) => ({ value: s, label: s }));
  const heading = mode === 'create' ? 'Nytt prosjekt' : 'Rediger prosjekt';

  return (
    <div className="stack">
      <div>
        <Button
          variant="flat"
          small
          onClick={() => navigate(mode === 'edit' ? `/projects/${projectId}` : '/projects')}
        >
          <Icon icon={faArrowLeft} marginRight />
          Avbryt
        </Button>
      </div>

      <h1 className="bf-h1">{heading}</h1>

      {error && (
        <Message state="alert" header="Kunne ikke lagre">
          {error}
        </Message>
      )}

      <Card padding="medium">
        <form onSubmit={handleSubmit} className="stack-sm">
          {mode === 'create' && milestones.length > 0 && (
            <Select
              label="Koble til eksisterende milestone"
              optional
              options={milestones.map((m) => ({ value: String(m.number), label: m.title }))}
              value={linkMilestone ? { value: String(linkMilestone.number), label: linkMilestone.title } : null}
              onChange={(opt) => {
                const value = (opt as Option | null)?.value;
                const selected = value ? milestones.find((m) => m.number === Number(value)) ?? null : null;
                setLinkMilestone(selected);
                if (selected) {
                  setForm((f) => ({
                    ...f,
                    name: selected.title,
                    end_date: selected.due_on ? selected.due_on.slice(0, 10) : f.end_date,
                    challenges: selected.description ?? f.challenges,
                  }));
                }
              }}
              isClearable
              placeholder="La stå tom for å opprette en ny milestone på GitHub"
            />
          )}
          <div className="form-grid">
            <Input
              label="Navn"
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
            <Input
              label="Kunde"
              required
              value={form.customer}
              onChange={(e) => update('customer', e.target.value)}
            />
            <Select
              label="Status"
              options={statusOptions}
              value={form.status ? { value: form.status, label: form.status } : null}
              onChange={(opt) => update('status', (opt as Option | null)?.value ?? '')}
              required
            />
            <Input
              label="Ansvarlig"
              required
              value={form.responsible}
              onChange={(e) => update('responsible', e.target.value)}
            />
            <Input
              label="Team"
              optional
              value={form.team ?? ''}
              onChange={(e) => update('team', e.target.value)}
            />
            <Input
              label="Startdato"
              type="date"
              optional
              value={form.start_date ?? ''}
              onChange={(e) => update('start_date', e.target.value)}
            />
            <Input
              label="Sluttdato"
              type="date"
              optional
              value={form.end_date ?? ''}
              onChange={(e) => update('end_date', e.target.value)}
            />
          </div>
          <TextArea
            label="Utfordringer"
            optional
            value={form.challenges ?? ''}
            onChange={(e) => update('challenges', e.target.value)}
          />
          <div className="form-actions">
            <Button type="submit" variant="filled" state={saving ? 'inactive' : 'default'}>
              {mode === 'create' ? 'Opprett prosjekt' : 'Lagre endringer'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
