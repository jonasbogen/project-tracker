import { useEffect, useState, type FormEvent } from 'react';
import Button from '@intility/bifrost-react/Button';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Input from '@intility/bifrost-react/Input';
import Message from '@intility/bifrost-react/Message';
import Select from '@intility/bifrost-react-select';
import Table from '@intility/bifrost-react/Table';
import TextArea from '@intility/bifrost-react/TextArea';
import { faPen, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { api, type Price, type PriceCategory } from '../api';

interface Option {
  value: string;
  label: string;
}

const PRICE_TYPES = ['Service', 'Hardware'];
const PRICING_MODELS = ['Per unit', 'Tiered'];
const BILLING_CYCLES = ['Monthly', 'One-time'];

interface TierForm {
  tier_label: string;
  price: string;
}

const EMPTY_FORM = {
  category_id: '',
  service: '',
  type: 'Service',
  description: '',
  pricing_model: 'Per unit',
  billing: 'Monthly',
  unit: '',
  price: '',
  leasing_price: '',
};

function formatKr(value: string | number | null): string {
  if (value == null) return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n.toLocaleString('nb-NO')} kr`;
}

// The price list rebuild: categories ("varegrupper") of services/hardware,
// each priced either flat ("Per unit") or in bands ("Tiered", a NULL band
// price meaning "Price on request"), plus an optional monthly leasing rate.
// Column names/values (Service, Hardware, Per unit, Tiered, Monthly,
// One-time...) are kept in English throughout this page specifically,
// matching the source catalog verbatim - the rest of the app is Norwegian.
export default function Prices() {
  const [categories, setCategories] = useState<PriceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formCategoryId, setFormCategoryId] = useState<number | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tiers, setTiers] = useState<TierForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .listPriceCategories()
      .then(setCategories)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function startNewService(categoryId: number) {
    setFormCategoryId(categoryId);
    setEditingPriceId(null);
    setForm({ ...EMPTY_FORM, category_id: String(categoryId) });
    setTiers([{ tier_label: '', price: '' }]);
    setFormError(null);
  }

  function startEditService(price: Price) {
    setFormCategoryId(price.category_id);
    setEditingPriceId(price.id);
    setForm({
      category_id: String(price.category_id),
      service: price.service,
      type: price.type,
      description: price.description,
      pricing_model: price.pricing_model,
      billing: price.billing,
      unit: price.unit,
      price: price.price ?? '',
      leasing_price: price.leasing_price ?? '',
    });
    setTiers(
      price.tiers.length > 0
        ? price.tiers.map((t) => ({ tier_label: t.tier_label, price: t.price ?? '' }))
        : [{ tier_label: '', price: '' }],
    );
    setFormError(null);
  }

  function cancelForm() {
    setFormCategoryId(null);
    setEditingPriceId(null);
    setForm(EMPTY_FORM);
    setTiers([]);
    setFormError(null);
  }

  async function handleNewCategory() {
    const name = window.prompt('New category name?');
    if (!name?.trim()) return;
    try {
      await api.createPriceCategory(name.trim());
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleRenameCategory(category: PriceCategory) {
    const name = window.prompt('Rename category to:', category.name);
    if (!name?.trim() || name.trim() === category.name) return;
    try {
      await api.renamePriceCategory(category.id, name.trim());
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDeleteCategory(category: PriceCategory) {
    const warn =
      category.prices.length > 0
        ? `Delete category "${category.name}" and all ${category.prices.length} service(s) in it?`
        : `Delete category "${category.name}"?`;
    if (!confirm(warn)) return;
    try {
      await api.deletePriceCategory(category.id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDeletePrice(price: Price) {
    if (!confirm(`Delete "${price.service}"?`)) return;
    try {
      await api.deletePrice(price.id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function updateTier(index: number, patch: Partial<TierForm>) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTier() {
    setTiers((prev) => [...prev, { tier_label: '', price: '' }]);
  }

  function removeTier(index: number) {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const category_id = Number(form.category_id);
    if (!form.service.trim()) {
      setFormError('Service is required.');
      return;
    }
    if (!category_id) {
      setFormError('Category is required.');
      return;
    }

    let price: number | null = null;
    const tiersPayload: { tier_label: string; price: number | null }[] = [];
    if (form.pricing_model === 'Tiered') {
      const cleanTiers = tiers.filter((t) => t.tier_label.trim());
      if (cleanTiers.length === 0) {
        setFormError('Add at least one tier.');
        return;
      }
      for (const t of cleanTiers) {
        if (t.price.trim() === '') {
          tiersPayload.push({ tier_label: t.tier_label.trim(), price: null });
          continue;
        }
        const tierPrice = Number(t.price);
        if (!Number.isFinite(tierPrice) || tierPrice < 0) {
          setFormError(`Invalid price for tier "${t.tier_label}".`);
          return;
        }
        tiersPayload.push({ tier_label: t.tier_label.trim(), price: tierPrice });
      }
    } else {
      price = Number(form.price);
      if (!Number.isFinite(price) || price < 0) {
        setFormError('Invalid price.');
        return;
      }
    }

    let leasing_price: number | null = null;
    if (form.leasing_price.trim() !== '') {
      leasing_price = Number(form.leasing_price);
      if (!Number.isFinite(leasing_price) || leasing_price < 0) {
        setFormError('Invalid leasing price.');
        return;
      }
    }

    setSaving(true);
    const payload = {
      category_id,
      service: form.service.trim(),
      type: form.type,
      description: form.description.trim(),
      pricing_model: form.pricing_model,
      billing: form.billing,
      unit: form.unit.trim(),
      price,
      leasing_price,
      tiers: tiersPayload,
    };
    try {
      if (editingPriceId) {
        await api.updatePrice(editingPriceId, payload);
      } else {
        await api.createPrice(payload);
      }
      cancelForm();
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Icon.Spinner aria-label="Laster prisliste" />;

  if (error) {
    return (
      <Message state="alert" header="Kunne ikke laste prisliste">
        {error}
      </Message>
    );
  }

  const categoryOptions: Option[] = categories.map((c) => ({ value: String(c.id), label: c.name }));

  return (
    <div className="stack">
      <div className="page-header">
        <h1 className="bf-h1">Prisliste</h1>
        <Button variant="filled" onClick={handleNewCategory}>
          <Icon icon={faPlus} marginRight />
          New category
        </Button>
      </div>
      <p className="muted">Tjenester og priser teamet tilbyr. Redigerbar av alle som bruker verktøyet.</p>

      {categories.map((category) => (
        <Card key={category.id} padding="medium" className="stack-sm">
          <div className="price-category-header">
            <h2 className="bf-h2">{category.name}</h2>
            <div className="inline-actions">
              <Button small variant="flat" onClick={() => handleRenameCategory(category)}>
                Rename
              </Button>
              <Button small variant="flat" onClick={() => startNewService(category.id)}>
                <Icon icon={faPlus} marginRight />
                New service
              </Button>
              <Button small variant="flat" state="alert" onClick={() => handleDeleteCategory(category)}>
                Delete category
              </Button>
            </div>
          </div>

          {category.prices.length === 0 ? (
            <p className="muted">No services in this category yet.</p>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Service</Table.HeaderCell>
                  <Table.HeaderCell>Type</Table.HeaderCell>
                  <Table.HeaderCell>Description</Table.HeaderCell>
                  <Table.HeaderCell>Pricing model</Table.HeaderCell>
                  <Table.HeaderCell>Billing</Table.HeaderCell>
                  <Table.HeaderCell>Unit</Table.HeaderCell>
                  <Table.HeaderCell>Price</Table.HeaderCell>
                  <Table.HeaderCell>Leasing</Table.HeaderCell>
                  <Table.HeaderCell>{''}</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {category.prices.map((p) => (
                  <Table.Row key={p.id}>
                    <Table.Cell>{p.service}</Table.Cell>
                    <Table.Cell>{p.type}</Table.Cell>
                    <Table.Cell>
                      {p.description ? (
                        <span className="cell-clamp">{p.description}</span>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>{p.pricing_model}</Table.Cell>
                    <Table.Cell>{p.billing}</Table.Cell>
                    <Table.Cell>{p.unit || <span className="muted">-</span>}</Table.Cell>
                    <Table.Cell>
                      {p.pricing_model === 'Tiered' ? (
                        <div className="price-tiers-cell">
                          {p.tiers.map((t) => (
                            <div key={t.id} className="price-tier-row">
                              <span>{t.tier_label}</span>
                              <span>{t.price != null ? formatKr(t.price) : 'Price on request'}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        formatKr(p.price)
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {p.leasing_price != null ? `${formatKr(p.leasing_price)} /mo` : '-'}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="inline-actions">
                        <Button small variant="flat" aria-label="Edit" onClick={() => startEditService(p)}>
                          <Icon icon={faPen} />
                        </Button>
                        <Button
                          small
                          variant="flat"
                          state="alert"
                          aria-label="Delete"
                          onClick={() => handleDeletePrice(p)}
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

          {formCategoryId === category.id && (
            <Card padding="medium" className="stack-sm price-service-form">
              <h3 className="bf-h3">{editingPriceId ? 'Edit service' : 'New service'}</h3>
              {formError && (
                <Message state="alert" header="Could not save">
                  {formError}
                </Message>
              )}
              <form onSubmit={handleSubmit} className="stack-sm">
                <div className="form-grid">
                  <Input
                    label="Service"
                    required
                    value={form.service}
                    onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
                  />
                  <Select
                    label="Category"
                    required
                    options={categoryOptions}
                    value={
                      form.category_id
                        ? { value: form.category_id, label: categoryOptions.find((o) => o.value === form.category_id)?.label ?? '' }
                        : null
                    }
                    onChange={(opt) => setForm((f) => ({ ...f, category_id: (opt as Option | null)?.value ?? '' }))}
                  />
                  <Select
                    label="Type"
                    required
                    options={PRICE_TYPES.map((t) => ({ value: t, label: t }))}
                    value={{ value: form.type, label: form.type }}
                    onChange={(opt) => setForm((f) => ({ ...f, type: (opt as Option | null)?.value ?? f.type }))}
                  />
                  <Select
                    label="Pricing model"
                    required
                    options={PRICING_MODELS.map((m) => ({ value: m, label: m }))}
                    value={{ value: form.pricing_model, label: form.pricing_model }}
                    onChange={(opt) =>
                      setForm((f) => ({ ...f, pricing_model: (opt as Option | null)?.value ?? f.pricing_model }))
                    }
                  />
                  <Select
                    label="Billing"
                    required
                    options={BILLING_CYCLES.map((b) => ({ value: b, label: b }))}
                    value={{ value: form.billing, label: form.billing }}
                    onChange={(opt) => setForm((f) => ({ ...f, billing: (opt as Option | null)?.value ?? f.billing }))}
                  />
                  <Input
                    label="Unit"
                    optional
                    placeholder="e.g. service, sensor, user"
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  />
                  {form.pricing_model === 'Per unit' && (
                    <Input
                      label="Price (kr)"
                      required
                      inputMode="decimal"
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    />
                  )}
                  <Input
                    label="Leasing (kr /mo)"
                    optional
                    inputMode="decimal"
                    value={form.leasing_price}
                    onChange={(e) => setForm((f) => ({ ...f, leasing_price: e.target.value }))}
                  />
                </div>

                {form.pricing_model === 'Tiered' && (
                  <div className="stack-sm">
                    <div className="field-label">Tiers</div>
                    {tiers.map((t, i) => (
                      <div key={i} className="price-tier-form-row">
                        <Input
                          label="Tier"
                          hideLabel
                          placeholder="e.g. 0-200 or 3501+"
                          value={t.tier_label}
                          onChange={(e) => updateTier(i, { tier_label: e.target.value })}
                        />
                        <Input
                          label="Price"
                          hideLabel
                          inputMode="decimal"
                          placeholder="Blank = Price on request"
                          value={t.price}
                          onChange={(e) => updateTier(i, { price: e.target.value })}
                        />
                        <Button
                          small
                          variant="flat"
                          state="alert"
                          aria-label="Remove tier"
                          type="button"
                          onClick={() => removeTier(i)}
                        >
                          <Icon icon={faTrash} />
                        </Button>
                      </div>
                    ))}
                    <Button small variant="flat" type="button" onClick={addTier}>
                      <Icon icon={faPlus} marginRight />
                      Add tier
                    </Button>
                  </div>
                )}

                <TextArea
                  label="Description"
                  optional
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
                <div className="form-actions">
                  <Button type="submit" variant="filled" state={saving ? 'inactive' : 'default'}>
                    <Icon icon={editingPriceId ? faPen : faPlus} marginRight />
                    {editingPriceId ? 'Save changes' : 'Add service'}
                  </Button>
                  <Button type="button" variant="flat" onClick={cancelForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </Card>
      ))}
    </div>
  );
}
