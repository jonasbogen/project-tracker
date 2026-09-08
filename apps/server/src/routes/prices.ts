import { Hono } from 'hono';
import * as repo from '../repo.js';
import type { PriceInput, PriceTierInput } from '../repo.js';

export const pricesApi = new Hono();

function parseId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function tiersFromBody(value: unknown): PriceTierInput[] | { error: string } {
  if (value == null) return [];
  if (!Array.isArray(value)) return { error: 'Ugyldige trappetrinn.' };
  const tiers: PriceTierInput[] = [];
  for (const raw of value) {
    const row = raw as Record<string, unknown>;
    const tier_label = String(row.tier_label ?? '').trim();
    if (!tier_label) return { error: 'Hvert trappetrinn trenger en etikett, f.eks. «0-200».' };
    const priceRaw = row.price;
    if (priceRaw === null || priceRaw === '' || priceRaw === undefined) {
      tiers.push({ tier_label, price: null });
      continue;
    }
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      return { error: `Ugyldig pris for trappetrinnet «${tier_label}».` };
    }
    tiers.push({ tier_label, price });
  }
  return tiers;
}

function priceFromBody(body: Record<string, unknown>): PriceInput | { error: string } {
  const category_id = parseId(body.category_id != null ? String(body.category_id) : undefined);
  const service = String(body.service ?? '').trim();
  const type = String(body.type ?? '').trim();
  const pricing_model = String(body.pricing_model ?? '').trim();
  const billing = String(body.billing ?? '').trim();

  if (!category_id) return { error: 'Kategori er påkrevd.' };
  if (!service) return { error: 'Tjeneste er påkrevd.' };
  if (!repo.PRICE_TYPES.includes(type as never)) return { error: 'Ugyldig type.' };
  if (!repo.PRICING_MODELS.includes(pricing_model as never)) return { error: 'Ugyldig prismodell.' };
  if (!repo.BILLING_CYCLES.includes(billing as never)) return { error: 'Ugyldig fakturering.' };

  const tiers = tiersFromBody(body.tiers);
  if ('error' in tiers) return tiers;

  if (pricing_model === 'Tiered') {
    if (tiers.length === 0) return { error: 'Trappetrinn-priser trenger minst ett trinn.' };
  } else {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) return { error: 'Ugyldig pris.' };
  }

  let leasing_price: number | null = null;
  if (body.leasing_price != null && body.leasing_price !== '') {
    const parsed = Number(body.leasing_price);
    if (!Number.isFinite(parsed) || parsed < 0) return { error: 'Ugyldig leasingpris.' };
    leasing_price = parsed;
  }

  return {
    category_id,
    service,
    type,
    description: String(body.description ?? '').trim(),
    pricing_model,
    billing,
    unit: String(body.unit ?? '').trim(),
    price: pricing_model === 'Tiered' ? null : Number(body.price),
    leasing_price,
    tiers: pricing_model === 'Tiered' ? tiers : [],
  };
}

// GET /api/price-categories — the whole price list, grouped by category.
pricesApi.get('/price-categories', async (c) => {
  const categories = await repo.listPriceCategories();
  return c.json(categories);
});

// POST /api/price-categories — add a new "varegruppe".
pricesApi.post('/price-categories', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const name = String(body.name ?? '').trim();
  if (!name) return c.json({ error: 'Navn er påkrevd.' }, 400);
  const category = await repo.createPriceCategory(name);
  return c.json(category, 201);
});

// PUT /api/price-categories/:id — rename a category.
pricesApi.put('/price-categories/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Ugyldig id.' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const name = String(body.name ?? '').trim();
  if (!name) return c.json({ error: 'Navn er påkrevd.' }, 400);
  await repo.renamePriceCategory(id, name);
  return c.body(null, 204);
});

// DELETE /api/price-categories/:id — remove a category and every service in it.
pricesApi.delete('/price-categories/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Ugyldig id.' }, 400);
  await repo.deletePriceCategory(id);
  return c.body(null, 204);
});

// POST /api/prices — add a service/product line to a category.
pricesApi.post('/prices', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const data = priceFromBody(body);
  if ('error' in data) return c.json({ error: data.error }, 400);
  const price = await repo.createPrice(data);
  return c.json(price, 201);
});

// PUT /api/prices/:id — edit a service/product line.
pricesApi.put('/prices/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Ugyldig id.' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const data = priceFromBody(body);
  if ('error' in data) return c.json({ error: data.error }, 400);
  const price = await repo.updatePrice(id, data);
  if (!price) return c.json({ error: 'Fant ikke raden.' }, 404);
  return c.json(price);
});

// DELETE /api/prices/:id — remove a service/product line.
pricesApi.delete('/prices/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Ugyldig id.' }, 400);
  await repo.deletePrice(id);
  return c.body(null, 204);
});
