import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  customer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Planlagt',
  responsible TEXT NOT NULL,
  team TEXT NOT NULL DEFAULT '',
  start_date DATE,
  end_date DATE,
  challenges TEXT NOT NULL DEFAULT '',
  github_repo TEXT,
  github_milestone_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS team TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_repo TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_milestone_number INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- One project per GitHub milestone; NULLs (manually created projects) never conflict with each other.
CREATE UNIQUE INDEX IF NOT EXISTS projects_github_unique_idx
  ON projects (github_repo, github_milestone_number);

CREATE TABLE IF NOT EXISTS cases (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Åpen',
  case_date DATE,
  owner TEXT NOT NULL DEFAULT '',
  github_repo TEXT,
  github_issue_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cases ADD COLUMN IF NOT EXISTS github_repo TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS github_issue_number INTEGER;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT '';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- One case per GitHub issue; NULLs (manually created cases) never conflict with each other.
CREATE UNIQUE INDEX IF NOT EXISTS cases_github_unique_idx
  ON cases (github_repo, github_issue_number);

-- One row per "varegruppe" (Nano Edge Sensors, Nozomi Sensors, ...) in the
-- price list, renamable and deletable independent of its services.
CREATE TABLE IF NOT EXISTS price_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prices (
  id SERIAL PRIMARY KEY,
  service TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- category_id has no NOT NULL constraint at the DB level (a pre-existing row
-- from before this migration has none until the one-off backfill below runs),
-- but every write from the app always sets one.
ALTER TABLE prices ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES price_categories(id) ON DELETE CASCADE;
ALTER TABLE prices ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'Service';
ALTER TABLE prices ADD COLUMN IF NOT EXISTS pricing_model TEXT NOT NULL DEFAULT 'Per unit';
ALTER TABLE prices ADD COLUMN IF NOT EXISTS billing TEXT NOT NULL DEFAULT 'Monthly';
ALTER TABLE prices ADD COLUMN IF NOT EXISTS leasing_price NUMERIC(12, 2);
ALTER TABLE prices ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
-- A "Tiered" row (see price_tiers) has no single price of its own.
ALTER TABLE prices ALTER COLUMN price DROP NOT NULL;

-- One row per price band for a "Tiered" pricing model service (e.g. "0-200" ->
-- 4 500 kr). A NULL price means "Price on request" for that band.
CREATE TABLE IF NOT EXISTS price_tiers (
  id SERIAL PRIMARY KEY,
  price_id INTEGER NOT NULL REFERENCES prices(id) ON DELETE CASCADE,
  tier_label TEXT NOT NULL,
  price NUMERIC(12, 2),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- The step where the price list meets a customer: one row per quote, moved
-- through the funnel (Sendt tilbud -> Godkjent -> Levert -> Fakturert) as the
-- deal progresses. project_id is optional - a quote can exist before there's a
-- project yet, and stays put (never cascades) if the project is later deleted.
CREATE TABLE IF NOT EXISTS offers (
  id SERIAL PRIMARY KEY,
  customer TEXT NOT NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Sendt tilbud',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-off migrations that must run exactly once, ever — never on every
-- startup like the ALTER TABLEs above. Tracked by key so each runs once.
CREATE TABLE IF NOT EXISTS schema_migrations (
  key TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

// The updated_at columns above default to now() at ALTER TABLE time, which
// stamped every pre-existing row with that single moment instead of its real
// last-change time — the next sync then found itself unable to tell "genuinely
// changed since" from "just got backdated", and the dashboard's activity feed
// briefly showed everything as changed at once. Backfills updated_at back to
// created_at for rows that predate the updated_at column, once.
const BACKFILL_UPDATED_AT_KEY = 'backfill_updated_at_2026_09_07';

async function backfillUpdatedAt(): Promise<void> {
  const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE key = $1', [
    BACKFILL_UPDATED_AT_KEY,
  ]);
  if (rows.length > 0) return;
  await pool.query('UPDATE projects SET updated_at = created_at');
  await pool.query('UPDATE cases SET updated_at = created_at');
  await pool.query('INSERT INTO schema_migrations (key) VALUES ($1)', [BACKFILL_UPDATED_AT_KEY]);
}

interface SeedTier {
  label: string;
  price: number | null;
}

interface SeedService {
  service: string;
  type: string;
  description: string;
  pricingModel: string;
  billing: string;
  unit: string;
  price: number | null;
  leasingPrice: number | null;
  tiers?: SeedTier[];
}

interface SeedCategory {
  name: string;
  services: SeedService[];
}

// The real OT Foundation / Nano Edge / Nozomi price list, seeded exactly once
// as the starting catalog - see the "Prisliste" rebuild from a flat table to
// categories with per-service pricing models (flat or tiered) and leasing.
const PRICE_CATALOG: SeedCategory[] = [
  {
    name: 'OT Services',
    services: [
      {
        service: 'OT Foundation | Standard Site',
        type: 'Service',
        description:
          'OT Foundation Standard Site gives the customer single point of contact for operating and supporting network-connected production systems at sites with standard availability needs. Intility monitors the environment 24/7, handles routine error correction, maintains system documentation, coordinates vendors and manages standard changes.',
        pricingModel: 'Per unit',
        billing: 'Monthly',
        unit: 'service',
        price: 1740,
        leasingPrice: null,
      },
      {
        service: 'OT Foundation | Resilient Site',
        type: 'Service',
        description:
          'OT Foundation Resilient Site is for environments requiring elevated robustness and availability. Intility operates and monitors the site infrastructure 24/7, works proactively on error correction, keeps structured system documentation, coordinates integrations and vendors, and uses defined response plans and change control to reduce operational risk.',
        pricingModel: 'Per unit',
        billing: 'Monthly',
        unit: 'service',
        price: 4570,
        leasingPrice: null,
      },
      {
        service: 'OT Foundation | Critical Site',
        type: 'Service',
        description:
          'OT Foundation Critical Site is for safety-critical and high-availability production environments. Intility provides 24/7 monitoring, rapid incident handling, advanced error correction, strict change governance, and detailed system documentation. Includes operational playbooks, compliance support (e.g., NIS2/62443 alignment), multi-vendor coordination, redundancy validation, and lifecycle management for infrastructure supporting mission-critical industrial processes.',
        pricingModel: 'Per unit',
        billing: 'Monthly',
        unit: 'service',
        price: 13790,
        leasingPrice: null,
      },
    ],
  },
  {
    name: 'Nano Edge Sensors',
    services: [
      {
        service: 'Managed Nano Edge',
        type: 'Service',
        description: '',
        pricingModel: 'Per unit',
        billing: 'Monthly',
        unit: 'sensor',
        price: 1000,
        leasingPrice: null,
      },
      {
        service: 'Small Nano Edge',
        type: 'Hardware',
        description: '',
        pricingModel: 'Per unit',
        billing: 'One-time',
        unit: 'sensor',
        price: 31250,
        leasingPrice: 1000,
      },
      {
        service: 'Medium Nano Edge',
        type: 'Hardware',
        description: '',
        pricingModel: 'Per unit',
        billing: 'One-time',
        unit: 'sensor',
        price: 43750,
        leasingPrice: 1350,
      },
      {
        service: 'Large Nano Edge',
        type: 'Hardware',
        description: '',
        pricingModel: 'Per unit',
        billing: 'One-time',
        unit: 'sensor',
        price: 62500,
        leasingPrice: 1950,
      },
    ],
  },
  {
    name: 'Nozomi Sensors',
    services: [
      {
        service: 'NS1',
        type: 'Hardware',
        description: '',
        pricingModel: 'Per unit',
        billing: 'One-time',
        unit: 'sensor',
        price: 60125,
        leasingPrice: 1850,
      },
      {
        service: 'NS1R',
        type: 'Hardware',
        description: '',
        pricingModel: 'Per unit',
        billing: 'One-time',
        unit: 'sensor',
        price: 37810,
        leasingPrice: 1155,
      },
      {
        service: 'NS20',
        type: 'Hardware',
        description: '',
        pricingModel: 'Per unit',
        billing: 'One-time',
        unit: 'sensor',
        price: 142350,
        leasingPrice: 4350,
      },
      {
        service: 'Managed Cyber Visibility Sensor',
        type: 'Service',
        description:
          'Managed Cyber Visibility Sensor covers Intility’s management and support of a sensor installed in the customer’s network. Intility manages the sensor configuration and keeps the hardware and software updated with feature upgrades and security patches. The sensor uses network traffic to identify connected equipment, such as industrial controllers, routers and servers.',
        pricingModel: 'Per unit',
        billing: 'Monthly',
        unit: 'sensor',
        price: 1000,
        leasingPrice: null,
      },
    ],
  },
  {
    name: 'Nozomi Asset Intelligence',
    services: [
      {
        service: 'Cyber Visibility Asset Intelligence',
        type: 'Service',
        description:
          'Cyber Visibility Asset Intelligence gives the customer a central overview of equipment identified by one or more Cyber Visibility sensors in their network. Intility uses the collected data to build an inventory of connected assets and show risk information, including known vulnerabilities. The service can enrich asset details through network traffic analysis or controlled, non-intrusive polling of connected equipment.',
        pricingModel: 'Tiered',
        billing: 'Monthly',
        unit: 'asset',
        price: null,
        leasingPrice: null,
        tiers: [
          { label: '0-200', price: 4500 },
          { label: '201-375', price: 6875 },
          { label: '376-750', price: 12500 },
          { label: '751-1500', price: 20000 },
          { label: '1501-2500', price: 35000 },
          { label: '2501-3500', price: 45000 },
          { label: '3501+', price: null },
        ],
      },
      {
        service: 'Cyber Visibility Establishment',
        type: 'Service',
        description: '',
        pricingModel: 'Per unit',
        billing: 'One-time',
        unit: 'establishment',
        price: 5000,
        leasingPrice: null,
      },
    ],
  },
  {
    name: 'Secure Remote Operations',
    services: [
      {
        service: 'Secure Remote Operations',
        type: 'Service',
        description:
          'Secure Remote Access gives approved users controlled access to the customer’s servers, applications or industrial systems. Intility sets up and operates the service, manages user access, logs sessions and provides support.',
        pricingModel: 'Per unit',
        billing: 'Monthly',
        unit: 'user',
        price: 250,
        leasingPrice: null,
      },
      {
        service: 'Secure Remote Operations Establishment',
        type: 'Service',
        description: '',
        pricingModel: 'Per unit',
        billing: 'One-time',
        unit: 'establishment',
        price: 2000,
        leasingPrice: null,
      },
    ],
  },
  { name: 'Other', services: [] },
];

const SEED_PRICE_CATALOG_KEY = 'seed_price_catalog_2026_09_08';

async function seedPriceCatalog(): Promise<void> {
  const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE key = $1', [
    SEED_PRICE_CATALOG_KEY,
  ]);
  if (rows.length > 0) return;

  for (let i = 0; i < PRICE_CATALOG.length; i++) {
    const category = PRICE_CATALOG[i];
    const { rows: catRows } = await pool.query<{ id: number }>(
      `INSERT INTO price_categories (name, sort_order) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [category.name, i],
    );
    const categoryId = catRows[0].id;

    for (let j = 0; j < category.services.length; j++) {
      const svc = category.services[j];
      const { rows: priceRows } = await pool.query<{ id: number }>(
        `INSERT INTO prices
           (category_id, service, type, description, pricing_model, billing, unit, price, leasing_price, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          categoryId,
          svc.service,
          svc.type,
          svc.description,
          svc.pricingModel,
          svc.billing,
          svc.unit,
          svc.price,
          svc.leasingPrice,
          j,
        ],
      );
      const priceId = priceRows[0].id;

      for (let k = 0; k < (svc.tiers ?? []).length; k++) {
        const tier = svc.tiers![k];
        await pool.query(
          `INSERT INTO price_tiers (price_id, tier_label, price, sort_order) VALUES ($1, $2, $3, $4)`,
          [priceId, tier.label, tier.price, k],
        );
      }
    }
  }

  // A prices row from before this migration has no category yet (the column
  // was just added) - park it under "Other" instead of leaving it orphaned.
  const { rows: otherRows } = await pool.query<{ id: number }>(
    'SELECT id FROM price_categories WHERE name = $1',
    ['Other'],
  );
  await pool.query('UPDATE prices SET category_id = $1 WHERE category_id IS NULL', [otherRows[0].id]);

  await pool.query('INSERT INTO schema_migrations (key) VALUES ($1)', [SEED_PRICE_CATALOG_KEY]);
}

export async function initSchema(): Promise<void> {
  await pool.query(SCHEMA);
  await backfillUpdatedAt();
  await seedPriceCatalog();
}
