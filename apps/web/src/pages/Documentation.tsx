import { useState } from 'react';
import Card from '@intility/bifrost-react/Card';
import Message from '@intility/bifrost-react/Message';
import Tabs from '@intility/bifrost-react/Tabs';
import { faNewspaper, faTicket } from '@fortawesome/free-solid-svg-icons';
import Reports from './Reports';
import SectionTitle from '../components/SectionTitle';

function ArticlesSection() {
  return (
    <Card padding="large" className="stack-sm">
      <SectionTitle icon={faNewspaper}>Artikler</SectionTitle>
      <Message noIcon header="Ikke koblet til enda">
        Publisering av artikler (onboarding, oppsett-dokumentasjon m.m.) skal skje via Intility sitt
        interne publiseringsverktøy. Vi trenger navnet/URL-en til den tjenesten før dette kan kobles
        til for ekte.
      </Message>
    </Card>
  );
}

function TicketsSection() {
  return (
    <Card padding="large" className="stack-sm">
      <SectionTitle icon={faTicket}>Tickets</SectionTitle>
      <Message noIcon header="Klar til å kobles til">
        Visning av tickets her, og muligheten for hvert prosjekt til å opprette et tilhørende
        prosjekt i et eksternt ticket-system (Jira/Linear/Zendesk e.l.), er forberedt men bevisst
        ikke koblet til enda - det kommer når systemet og tilgangen er avklart.
      </Message>
    </Card>
  );
}

type Tab = 'rapporter' | 'artikler' | 'tickets';

// One place for everything that isn't project/case tracking but still lives
// alongside it: the report archive (Reports, moved in from its own former
// route), plus two sections prepared for future integrations (articles via
// Intility's internal publishing tool, tickets via an external ticket
// system) that are intentionally left as clearly-marked placeholders rather
// than built against guessed-at APIs.
export default function Documentation() {
  const [tab, setTab] = useState<Tab>('rapporter');

  return (
    <div className="stack">
      <h1 className="bf-h1">Dokumentasjon</h1>
      <p className="muted">Rapporter, artikler og tickets samlet på ett sted.</p>

      <Tabs>
        <Tabs.Item active={tab === 'rapporter'} onClick={() => setTab('rapporter')} content={<Reports />}>
          Rapporter
        </Tabs.Item>
        <Tabs.Item active={tab === 'artikler'} onClick={() => setTab('artikler')} content={<ArticlesSection />}>
          Artikler
        </Tabs.Item>
        <Tabs.Item active={tab === 'tickets'} onClick={() => setTab('tickets')} content={<TicketsSection />}>
          Tickets
        </Tabs.Item>
      </Tabs>
    </div>
  );
}
