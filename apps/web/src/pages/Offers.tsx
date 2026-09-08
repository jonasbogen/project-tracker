import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import Badge from '@intility/bifrost-react/Badge';
import Button from '@intility/bifrost-react/Button';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Input from '@intility/bifrost-react/Input';
import Message from '@intility/bifrost-react/Message';
import Select from '@intility/bifrost-react-select';
import TextArea from '@intility/bifrost-react/TextArea';
import { faArrowRight, faArrowUpRightFromSquare, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { api, type Offer, type ProjectWithCount } from '../api';
import { formatAmount, offerBadgeState } from '../status';

interface Option {
  value: string;
  label: string;
}

const EMPTY = { customer: '', project_id: '', title: '', description: '', amount: '' };

// The step where the price list meets a customer: one funnel column per stage
// (Sendt tilbud -> Godkjent -> Levert -> Fakturert), with the total amount
// still in play at each stage. This is the page that makes the tool relevant
// to people outside the OT team.
export default function Offers() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [customerOptions, setCustomerOptions] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([api.listOffers(), api.getMeta(), api.listCustomers(), api.listProjects()])
      .then(([offerList, meta, customerList, projectList]) => {
        setOffers(offerList);
        setStatuses(meta.offerStatuses);
        setCustomerOptions(customerList.map((c) => c.customer));
        setProjects(projectList);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const amount = Number(form.amount.replace(',', '.'));
    if (!form.customer.trim()) {
      setFormError('Kunde er påkrevd.');
      return;
    }
    if (!form.title.trim()) {
      setFormError('Tittel er påkrevd.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setFormError('Beløp må være et gyldig tall.');
      return;
    }
    setSaving(true);
    try {
      await api.createOffer({
        customer: form.customer.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        amount,
        project_id: form.project_id ? Number(form.project_id) : undefined,
      });
      setForm(EMPTY);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function advance(offer: Offer) {
    const idx = statuses.indexOf(offer.status);
    if (idx < 0 || idx >= statuses.length - 1) return;
    try {
      await api.updateOffer(offer.id, {
        customer: offer.customer,
        title: offer.title,
        description: offer.description,
        amount: Number(offer.amount),
        project_id: offer.project_id,
        status: statuses[idx + 1],
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Fjerne dette tilbudet?')) return;
    try {
      await api.deleteOffer(id);
      setOffers((prev) => prev.filter((o) => o.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const customerFieldOptions: Option[] = customerOptions.map((c) => ({ value: c, label: c }));
  const projectOptions: Option[] = projects
    .filter((p) => !form.customer || p.customer === form.customer)
    .map((p) => ({ value: String(p.id), label: p.name }));

  return (
    <div className="stack">
      <h1 className="bf-h1">Tilbud</h1>
      <p className="muted">
        Fra sendt tilbud til fakturert - der prislisten møter kunden. Prisliste ligger under
        Prisliste i menyen.
      </p>

      {error && (
        <Message state="alert" header="Kunne ikke laste tilbud">
          {error}
        </Message>
      )}

      {loading ? (
        <Icon.Spinner aria-label="Laster tilbud" />
      ) : (
        <div className="board">
          {statuses.map((status) => {
            const columnOffers = offers.filter((o) => o.status === status);
            const sum = columnOffers.reduce((n, o) => n + Number(o.amount), 0);
            return (
              <Card key={status} padding="medium" className="board-column">
                <div className="board-column-header">
                  <h2 className="bf-h2">{status}</h2>
                  <Badge state={offerBadgeState(status)}>{columnOffers.length}</Badge>
                </div>
                <p className="muted" style={{ marginTop: -8, marginBottom: 8 }}>
                  {formatAmount(String(sum))}
                </p>
                <div className="board-column-body">
                  {columnOffers.length === 0 && <p className="muted">Ingen tilbud.</p>}
                  {columnOffers.map((o) => {
                    const isLast = statuses.indexOf(o.status) === statuses.length - 1;
                    return (
                      <div key={o.id} className="board-card">
                        <div className="board-card-title">{o.title}</div>
                        <div className="muted board-card-meta">
                          {o.customer}
                          {o.project_name && (
                            <>
                              {' · '}
                              <button
                                className="cell-link"
                                onClick={() => navigate(`/projects/${o.project_id}`)}
                              >
                                {o.project_name}
                              </button>
                            </>
                          )}
                        </div>
                        <div className="board-card-footer">
                          <strong>{formatAmount(o.amount)}</strong>
                          <div className="inline-actions">
                            {!isLast && (
                              <Button
                                small
                                variant="flat"
                                aria-label="Neste steg"
                                onClick={() => advance(o)}
                              >
                                <Icon icon={faArrowRight} />
                              </Button>
                            )}
                            <Button
                              small
                              variant="flat"
                              state="alert"
                              aria-label="Slett"
                              onClick={() => handleDelete(o.id)}
                            >
                              <Icon icon={faTrash} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card padding="medium" className="stack-sm">
        <h2 className="bf-h2">Nytt tilbud</h2>

        <div className="offer-billing-link">
          <div>
            <div className="deadline-name">Engangskostnad for oppsett/etablering?</div>
            <p className="muted" style={{ margin: 0 }}>
              Faktureres direkte via Consultancy Billing, ikke gjennom tilbudstrakten under.
            </p>
          </div>
          <Button
            variant="basic"
            onClick={() =>
              window.open(
                'https://consultancybilling.apps.aa.intility.com/create-order',
                '_blank',
                'noopener,noreferrer',
              )
            }
          >
            <Icon icon={faArrowUpRightFromSquare} marginRight />
            Fakturer oppsett/etablering
          </Button>
        </div>

        {formError && (
          <Message state="alert" header="Kunne ikke lagre">
            {formError}
          </Message>
        )}
        <form onSubmit={handleSubmit} className="stack-sm">
          <div className="form-grid">
            {customerFieldOptions.length > 0 ? (
              <Select
                label="Kunde"
                required
                options={customerFieldOptions}
                value={form.customer ? { value: form.customer, label: form.customer } : null}
                onChange={(opt) =>
                  setForm((f) => ({ ...f, customer: (opt as Option | null)?.value ?? '', project_id: '' }))
                }
                placeholder="Velg kunde"
              />
            ) : (
              <Input
                label="Kunde"
                required
                value={form.customer}
                onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))}
              />
            )}
            <Select
              label="Prosjekt"
              optional
              options={projectOptions}
              value={
                form.project_id
                  ? { value: form.project_id, label: projectOptions.find((p) => p.value === form.project_id)?.label ?? '' }
                  : null
              }
              onChange={(opt) => setForm((f) => ({ ...f, project_id: (opt as Option | null)?.value ?? '' }))}
              isClearable
              placeholder="Koble til et prosjekt"
            />
            <Input
              label="Tittel"
              required
              placeholder="F.eks. Sikkerhetsgjennomgang OT-nett"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Input
              label="Beløp (kr)"
              required
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <TextArea
            label="Beskrivelse"
            optional
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="form-actions">
            <Button type="submit" variant="filled" state={saving ? 'inactive' : 'default'}>
              <Icon icon={faPlus} marginRight />
              Legg til tilbud
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
