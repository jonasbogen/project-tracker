import { useEffect, useState } from 'react';
import { api } from '../api';
import { findLogoFile, loadManifest } from './CompanyLogo';

// A "these are our customers" social-proof strip - unlike CompanyLogo
// elsewhere in the app (which falls back to generated initials so every
// customer gets *something*), this only ever shows real logo files: a mix of
// clean logos and colored-initial badges would read as inconsistent/unfinished
// for a purely decorative row. Silently shows nothing if no customer has a
// matched logo yet, rather than an empty-looking row of placeholders.
export default function CustomerLogoStrip() {
  const [logos, setLogos] = useState<{ customer: string; file: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listCustomers(), loadManifest()]).then(([customers, manifest]) => {
      if (cancelled) return;
      const matched = customers
        .map((c) => {
          const file = findLogoFile(c.customer, manifest);
          return file ? { customer: c.customer, file } : null;
        })
        .filter((x): x is { customer: string; file: string } => x !== null)
        .sort((a, b) => a.customer.localeCompare(b.customer, 'nb'));
      setLogos(matched);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (logos.length === 0) return null;

  return (
    <div className="customer-logo-strip">
      <div className="customer-logo-strip-label muted">Kunder vi jobber med</div>
      <div className="customer-logo-strip-row">
        {logos.map((l) => (
          <img
            key={l.customer}
            className="customer-logo-strip-item"
            src={`/logos/${l.file}`}
            alt={l.customer}
            title={l.customer}
            height={32}
          />
        ))}
      </div>
    </div>
  );
}
