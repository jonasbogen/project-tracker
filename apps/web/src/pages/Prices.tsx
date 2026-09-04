import { useEffect, useState, type FormEvent } from 'react';
import Button from '@intility/bifrost-react/Button';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Input from '@intility/bifrost-react/Input';
import Message from '@intility/bifrost-react/Message';
import Table from '@intility/bifrost-react/Table';
import TextArea from '@intility/bifrost-react/TextArea';
import { faPen, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { api, type Price } from '../api';

const EMPTY = { service: '', price: '', unit: '', description: '' };

function formatPrice(price: string): string {
  const n = Number(price);
  if (!Number.isFinite(n)) return price;
  return `${n.toLocaleString('nb-NO')} kr`;
}

export default function Prices() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .listPrices()
      .then(setPrices)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function startEdit(p: Price) {
    setEditingId(p.id);
    setForm({ service: p.service, price: p.price, unit: p.unit, description: p.description });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
    setFormError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const price = Number(form.price.replace(',', '.'));
    if (!form.service.trim()) {
      setFormError('Tjeneste er påkrevd.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setFormError('Pris må være et gyldig tall.');
      return;
    }
    setSaving(true);
    const data = {
      service: form.service.trim(),
      price,
      unit: form.unit.trim(),
      description: form.description.trim(),
    };
    try {
      if (editingId) {
        await api.updatePrice(editingId, data);
      } else {
        await api.createPrice(data);
      }
      cancelEdit();
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Fjerne denne raden fra prislisten?')) return;
    try {
      await api.deletePrice(id);
      setPrices((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="stack">
      <h1 className="bf-h1">Prisliste</h1>
      <p className="muted">Tjenester og priser teamet tilbyr. Redigerbar av alle som bruker verktøyet.</p>

      <Card padding="medium">
        {loading && <Icon.Spinner aria-label="Laster prisliste" />}

        {error && (
          <Message state="alert" header="Kunne ikke laste prisliste">
            {error}
          </Message>
        )}

        {!loading && !error && prices.length === 0 && (
          <Message header="Ingen priser registrert enda">
            Legg til den første tjenesten under.
          </Message>
        )}

        {!loading && !error && prices.length > 0 && (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Tjeneste</Table.HeaderCell>
                <Table.HeaderCell>Pris</Table.HeaderCell>
                <Table.HeaderCell>Enhet</Table.HeaderCell>
                <Table.HeaderCell>Beskrivelse</Table.HeaderCell>
                <Table.HeaderCell>{''}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {prices.map((p) => (
                <Table.Row key={p.id}>
                  <Table.Cell>{p.service}</Table.Cell>
                  <Table.Cell>{formatPrice(p.price)}</Table.Cell>
                  <Table.Cell>{p.unit || <span className="muted">–</span>}</Table.Cell>
                  <Table.Cell>{p.description || <span className="muted">–</span>}</Table.Cell>
                  <Table.Cell>
                    <div className="inline-actions">
                      <Button small variant="flat" aria-label="Rediger" onClick={() => startEdit(p)}>
                        <Icon icon={faPen} />
                      </Button>
                      <Button
                        small
                        variant="flat"
                        state="alert"
                        aria-label="Fjern"
                        onClick={() => handleDelete(p.id)}
                      >
                        <Icon icon={faTrash} />
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>

      <Card padding="medium" className="stack-sm">
        <h2 className="bf-h2">{editingId ? 'Rediger tjeneste' : 'Legg til tjeneste'}</h2>
        {formError && (
          <Message state="alert" header="Kunne ikke lagre">
            {formError}
          </Message>
        )}
        <form onSubmit={handleSubmit} className="stack-sm">
          <div className="form-grid">
            <Input
              label="Tjeneste"
              required
              value={form.service}
              onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
            />
            <Input
              label="Pris (kr)"
              required
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
            <Input
              label="Enhet"
              optional
              placeholder="f.eks. per time, fast pris"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
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
              <Icon icon={editingId ? faPen : faPlus} marginRight />
              {editingId ? 'Lagre endring' : 'Legg til'}
            </Button>
            {editingId && (
              <Button type="button" variant="flat" onClick={cancelEdit}>
                Avbryt
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
