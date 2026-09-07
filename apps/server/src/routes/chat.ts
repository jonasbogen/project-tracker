import { Hono } from 'hono';
import { streamText } from 'hono/streaming';
import Anthropic from '@anthropic-ai/sdk';
import * as repo from '../repo.js';

export const chat = new Hono();

// ALWAYS use claude-opus-5 unless a different model is explicitly requested.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
const MAX_ITERATIONS = 8;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_projects',
    description:
      'Search projects (customer engagements) by free text (matches project name or customer name) and/or an exact team name. Returns a compact list: id, name, customer, status, team, responsible, end_date, case_count. Call with no arguments to list every project. Use this first to find which project(s) a question is about.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Free text matched against project name or customer' },
        team: { type: 'string', description: 'Exact team name to filter by, e.g. OT' },
      },
    },
  },
  {
    name: 'get_project',
    description:
      'Get full details for one project by id, including every case (sub-task) under it: title, status, owner, description, and date.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'integer', description: 'Project id, from search_projects' } },
      required: ['id'],
    },
  },
  {
    name: 'list_team',
    description: 'List everyone who owns at least one case, with their open and total case counts.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_cases_for_person',
    description: 'List one person\'s active (not "Løst") cases across every project, by GitHub login.',
    input_schema: {
      type: 'object',
      properties: { owner: { type: 'string', description: 'GitHub login' } },
      required: ['owner'],
    },
  },
  {
    name: 'get_dashboard_stats',
    description:
      'Get aggregate counts across the whole tool: projects by status, cases by status, upcoming project deadlines, and the top case owners.',
    input_schema: { type: 'object', properties: {} },
  },
];

// Every tool here is read-only: the assistant can search and summarize, but has
// no way to create/update/delete anything. Suggestions it makes (next steps, a
// draft comment) are just text in its reply, never applied to the database.
async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'search_projects': {
      const search = typeof input.search === 'string' ? input.search : undefined;
      const team = typeof input.team === 'string' ? input.team : undefined;
      const projects = await repo.listProjects(team, search);
      return projects.map((p) => ({
        id: p.id,
        name: p.name,
        customer: p.customer,
        status: p.status,
        team: p.team,
        responsible: p.responsible,
        end_date: p.end_date,
        case_count: p.case_count,
      }));
    }
    case 'get_project': {
      const id = Number(input.id);
      const project = await repo.getProject(id);
      if (!project) return { error: 'Fant ikke et prosjekt med den iden.' };
      const cases = await repo.listCases(id);
      return {
        project,
        cases: cases.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          owner: c.owner,
          case_date: c.case_date,
          description: c.description,
        })),
      };
    }
    case 'list_team':
      return repo.listTeam();
    case 'list_cases_for_person':
      return repo.listActiveCasesByOwner(String(input.owner ?? ''));
    case 'get_dashboard_stats':
      return repo.getDashboardStats();
    default:
      return { error: `Ukjent verktøy: ${name}` };
  }
}

// This is Claude (Anthropic) itself, not a domain-locked bot - it can answer
// anything Claude can (general knowledge, code, writing, explanations, etc.).
// The tools below are just extra reach into this specific tool's live data;
// use them whenever a question is actually about a project, case, or person in
// here, but never treat them as the boundary of what you're allowed to discuss.
const SYSTEM_PROMPT = `Du er Claude, en hjelpsom AI-assistent fra Anthropic, integrert som "Chat bot" i "Prosjektsporing" - et internt verktøy for Intility som sporer OT/Edge Platform-kundeprosjekter.

Du kan svare på hva som helst, akkurat som Claude ellers - generell kunnskap, kode, forklaringer, skriving, resonnering, alt - ikke bare spørsmål om dette verktøyet.

I tillegg har du noen verktøy for å slå opp live data i selve Prosjektsporing-verktøyet:
- Et "prosjekt" tilsvarer en GitHub-milestone: ett per kundeprosjekt, med status (Planlagt/Pågår/Forsinket/Fullført), kunde, ansvarlig, team, tidsfrist og en liste av "issuer".
- En "issue" tilsvarer en GitHub-issue: en oppgave knyttet til ett prosjekt, med status (Åpen/Under arbeid/Løst) og en eier (GitHub-brukernavn). Issuer opprettet i appen blir automatisk opprettet som ekte issues i GitHub.

Bruk disse verktøyene når spørsmålet faktisk handler om et prosjekt, en issue eller en person i verktøyet - de er skrivebeskyttet (read-only), du kan ikke opprette, endre eller slette noe der. Vis til konkrete prosjekt- og saksnavn du fant i stedet for å gjette. Når du foreslår neste steg eller et utkast til en kommentar for noe i verktøyet, gjør det tydelig at det er et forslag brukeren selv må skrive inn - du har ingen måte å lagre det på.

Spørsmål om verktøyet er ofte korte og upresise ("hvordan går det med Arbion", "hvem har mest å gjøre"). Ikke be om presisering med mindre spørsmålet er reelt tvetydig mellom to helt ulike tolkninger - gjør heller en fornuftig antakelse, bruk verktøyene bredt (søk, sjekk flere prosjekter/personer om nødvendig), og nevn kort hvilken tolkning du la til grunn hvis den ikke er opplagt.

Svar kort og konkret, og på norsk (bokmål) med mindre brukeren skriver på et annet språk.`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function client(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Drives the tool-use loop against the Claude Messages API and yields plain
// text chunks as they stream in, across every iteration (tool calls happen
// silently in between).
export async function* streamChatReply(history: ChatMessage[]): AsyncGenerator<string> {
  const anthropic = client();
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }

    const message = await stream.finalMessage();

    if (message.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: message.content });
      continue;
    }

    if (message.stop_reason !== 'tool_use') {
      return;
    }

    messages.push({ role: 'assistant', content: message.content });

    const toolUseBlocks = message.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      let result: unknown;
      try {
        result = await executeTool(block.name, block.input as Record<string, unknown>);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : 'Ukjent feil' };
      }
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  yield '\n\n[Samtalen ble for lang og ble stoppet. Prøv å stille et mer avgrenset spørsmål.]';
}

// POST /api/chat — a stateless chat turn: the client resends the full history
// each time. Streams the reply as plain text.
chat.post('/chat', async (c) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'AI-chat er ikke satt opp (mangler ANTHROPIC_API_KEY).' }, 503);
  }

  const body = await c.req.json<{ messages?: ChatMessage[] }>().catch(() => null);
  const history = (body?.messages ?? []).filter(
    (m): m is ChatMessage => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
  );
  if (history.length === 0) {
    return c.json({ error: 'Meldingsliste mangler.' }, 400);
  }

  return streamText(c, async (stream) => {
    try {
      for await (const chunk of streamChatReply(history)) {
        await stream.write(chunk);
      }
    } catch (err) {
      console.error('AI chat failed', err);
      await stream.write('\n\n[Beklager, noe gikk galt på serveren. Prøv igjen.]');
    }
  });
});
