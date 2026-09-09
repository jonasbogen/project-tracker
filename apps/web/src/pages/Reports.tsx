import { useEffect, useState } from 'react';
import Badge from '@intility/bifrost-react/Badge';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import Table from '@intility/bifrost-react/Table';
import { faChartColumn, faChevronDown, faChevronRight, faFileLines } from '@fortawesome/free-solid-svg-icons';
import { api, type StatusdeckRun, type WeeklyReport } from '../api';
import WeekTrendChart from '../charts/WeekTrendChart';
import FormattedText from '../components/FormattedText';
import SectionTitle from '../components/SectionTitle';
import Skeleton from '../components/Skeleton';
import { formatDate } from '../status';

// "Ukesrapport – uke 36" -> 36, for the trend chart's x-axis label. Falls back
// to the report's own creation date's week-of-year if the title is ever
// reworded, so the chart never silently drops a report.
function weekLabelFromTitle(report: WeeklyReport): string {
  const match = report.title.match(/uke\s+(\d+)/i);
  if (match) return `U${match[1]}`;
  const date = new Date(report.created_at);
  const oneJan = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
  return `U${week}`;
}

// A minimal renderer for exactly the markdown shapes the "Ukesrapport" workflow
// produces (see .github/workflows/ukesrapport.yml): #/## headers, "| a | b |"
// tables, a trailing banner image, and plain paragraphs. Not a general markdown
// engine - a hand-rolled parser for one known, trusted source, same spirit as
// FormattedText, so no new dependency and no dangerouslySetInnerHTML.
function WeeklyReportBody({ body }: { body: string }) {
  const lines = body.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h3 key={key++} className="bf-h3">
          {line.slice(3)}
        </h3>,
      );
      i += 1;
    } else if (line.startsWith('# ')) {
      blocks.push(
        <h3 key={key++} className="bf-h3">
          {line.slice(2)}
        </h3>,
      );
      i += 1;
    } else if (line.trim() === '---') {
      blocks.push(<hr key={key++} />);
      i += 1;
    } else if (line.startsWith('![')) {
      i += 1; // skip the trailing Intility banner image
    } else if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i += 1;
      }
      const rows = tableLines
        .filter((l) => !/^\|[\s-:|]+\|$/.test(l))
        .map((l) => l.split('|').slice(1, -1).map((cell) => cell.trim()));
      const [header, ...body2] = rows;
      if (header) {
        blocks.push(
          <Table key={key++}>
            <Table.Header>
              <Table.Row>
                {header.map((h, idx) => (
                  <Table.HeaderCell key={idx}>{h}</Table.HeaderCell>
                ))}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {body2.map((row, ridx) => (
                <Table.Row key={ridx}>
                  {row.map((cell, cidx) => (
                    <Table.Cell key={cidx}>
                      <FormattedText text={cell} />
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>,
        );
      }
    } else {
      const paraLines: string[] = [];
      while (i < lines.length && lines[i].trim() && !lines[i].startsWith('|') && !lines[i].startsWith('#')) {
        paraLines.push(lines[i]);
        i += 1;
      }
      blocks.push(
        <p key={key++}>
          <FormattedText text={paraLines.join(' ')} />
        </p>,
      );
    }
  }

  return <div className="weekly-report-body">{blocks}</div>;
}

function statusdeckBadge(run: StatusdeckRun): { state: 'success' | 'alert' | 'neutral'; text: string } {
  if (run.status !== 'completed') return { state: 'neutral', text: 'Pågår' };
  if (run.conclusion === 'success') return { state: 'success', text: 'OK' };
  return { state: 'alert', text: run.conclusion ?? 'Feilet' };
}

// Archive of the two reports the repo's own workflows already produce every
// week (ukesrapport.yml, statusdeck.yml) but that otherwise disappear into
// Teams - a free history/trend view over the last 12 weeks of each.
export default function Reports() {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [runs, setRuns] = useState<StatusdeckRun[]>([]);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([api.listWeeklyReports(), api.listStatusdeckRuns()])
      .then(([weekly, statusdeck]) => {
        setReports(weekly.reports);
        setReportsError(weekly.error);
        setRuns(statusdeck.runs);
        setRunsError(statusdeck.error);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="stack">
      <h1 className="bf-h1">Rapporter</h1>
      <p className="muted">
        Ukesrapport og statusdeck produseres allerede av GitHub Actions hver uke - dette er
        arkivet, så de ikke bare forsvinner i Teams.
      </p>

      {loading && (
        <div className="stack" aria-label="Laster rapporter">
          <Card padding="large">
            <Skeleton style={{ height: 220 }} />
          </Card>
          <Card padding="large">
            <Skeleton style={{ height: 160 }} />
          </Card>
        </div>
      )}

      {!loading && (
        <Card padding="large" className="stack-sm">
          <SectionTitle icon={faFileLines}>Ukesrapport</SectionTitle>
          {reportsError && (
            <Message state="alert" header="Kunne ikke laste ukesrapporter">
              {reportsError}
            </Message>
          )}
          {!reportsError && reports.length === 0 && (
            <p className="muted">Ingen ukesrapporter funnet enda.</p>
          )}
          {reports.length > 1 && (
            <>
              <p className="muted" style={{ marginBottom: -8 }}>Åpne saker nevnt per uke.</p>
              <WeekTrendChart
                items={[...reports]
                  .reverse()
                  .map((r) => ({ label: weekLabelFromTitle(r), value: r.openCaseCount }))}
              />
            </>
          )}
          {reports.length > 0 && (
            <div className="stack-sm">
              {reports.map((r) => {
                const isOpen = expanded === r.number;
                return (
                  <div key={r.number} className="report-item">
                    <button
                      className="report-item-header"
                      onClick={() => setExpanded(isOpen ? null : r.number)}
                    >
                      <Icon icon={isOpen ? faChevronDown : faChevronRight} />
                      <span className="report-item-title">{r.title}</span>
                      <span className="muted">{formatDate(r.created_at)}</span>
                    </button>
                    {isOpen && <WeeklyReportBody body={r.body} />}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {!loading && (
        <Card padding="large" className="stack-sm">
          <SectionTitle icon={faChartColumn}>Statusdeck</SectionTitle>
          {runsError && (
            <Message state="alert" header="Kunne ikke laste statusdeck-kjøringer">
              {runsError}
            </Message>
          )}
          {!runsError && runs.length === 0 && <p className="muted">Ingen kjøringer funnet enda.</p>}
          {runs.length > 0 && (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Uke</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Nedlasting</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {runs.map((run) => {
                  const badge = statusdeckBadge(run);
                  return (
                    <Table.Row
                      key={run.id}
                      onClick={() => window.open(run.html_url, '_blank', 'noopener,noreferrer')}
                      style={{ cursor: 'pointer' }}
                    >
                      <Table.Cell>{formatDate(run.created_at)}</Table.Cell>
                      <Table.Cell>
                        <Badge state={badge.state}>{badge.text}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {run.artifactExpired === null ? (
                          <span className="muted">Ingen deck</span>
                        ) : run.artifactExpired ? (
                          <Badge state="neutral">Utløpt</Badge>
                        ) : (
                          <Badge state="success">Tilgjengelig på GitHub</Badge>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
