// Temporary startup probe (spike/egress-check branch only).
// Determines whether a running Minato app instance has outbound network access
// to the Microsoft identity/Graph endpoints an employee-search integration would
// need, plus a generic internet baseline. Gated by EGRESS_CHECK=1 so it is inert
// unless explicitly enabled. Results are logged; read them with minato_logs.

const TARGETS = [
  // The real target: Intility's internal API gateway (colleagues endpoint).
  // A 401/403 proves we REACHED it (auth solved separately); a fetch failure = blocked.
  'https://api.intility.com/thanos/v2/colleagues',
  // General-internet baseline for contrast (expected BLOCKED per earlier probe).
  'https://example.com',
];

async function probe(url: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal });
    // Any HTTP response (even 401/404) proves egress reached the host.
    console.log(`[egress] ${url} -> REACHABLE status=${res.status} (${Date.now() - started}ms)`);
  } catch (err) {
    const e = err as Error;
    console.log(`[egress] ${url} -> BLOCKED ${e.name}: ${e.message} (${Date.now() - started}ms)`);
  } finally {
    clearTimeout(timer);
  }
}

export async function runEgressCheck(): Promise<void> {
  console.log('[egress] starting outbound connectivity probe');
  for (const url of TARGETS) {
    await probe(url);
  }
  console.log('[egress] probe complete');
}
