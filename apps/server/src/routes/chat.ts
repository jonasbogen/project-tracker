import { Hono } from 'hono';
import { streamText } from 'hono/streaming';
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import * as repo from '../repo.js';
import { createCaseAndSync, listStatusOptions } from '../github-sync.js';

export const chat = new Hono();

const MODEL = process.env.OPENAI_MODEL || 'glm-5-2-fp8';
const MAX_ITERATIONS = 8;

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_projects',
      description:
        'Search projects (customer engagements) by free text (matches project name or customer name) and/or an exact team name. Returns a compact list: id, name, customer, status, team, responsible, end_date, case_count. Call with no arguments to list every project. Use this first to find which project(s) a question is about.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Free text matched against project name or customer' },
          team: { type: 'string', description: 'Exact team name to filter by, e.g. OT' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project',
      description:
        'Get full details for one project by id, including every case (sub-task) under it: title, status, owner, description, and date.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'integer', description: 'Project id, from search_projects' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_team',
      description: 'List everyone who owns at least one case, with their open and total case counts.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_cases_for_person',
      description: 'List one person\'s active (not "Løst") cases across every project, by GitHub login.',
      parameters: {
        type: 'object',
        properties: { owner: { type: 'string', description: 'GitHub login' } },
        required: ['owner'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_dashboard_stats',
      description:
        'Get aggregate counts across the whole tool: projects by status, cases by status, upcoming project deadlines, and the top case owners.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_board_statuses',
      description:
        'List the org GitHub Projects board\'s Status column names, in their real left-to-right order (e.g. Backlog, To do, In progress, Blocked, Done). Call this before create_case if you plan to pass board_status, so you use a real column name instead of guessing one.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_case',
      description:
        'Create a new issue (case) under a project, and push it to GitHub as a real issue - the same action as submitting the "Legg til issue" form in the app. Always call search_projects first to find the right project_id; never guess it. Set board_status (from list_board_statuses) to place the new card directly in the right column on the project board - otherwise it lands wherever GitHub\'s own default is.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'integer', description: 'Project id, from search_projects' },
          title: { type: 'string' },
          description: { type: 'string' },
          owner: { type: 'string', description: 'GitHub login to assign, if any' },
          case_date: { type: 'string', description: 'Deadline, YYYY-MM-DD' },
          board_status: {
            type: 'string',
            description: 'One of the column names from list_board_statuses, e.g. "To do"',
          },
          kunde: { type: 'string', description: 'Customer name; defaults to the project\'s own customer' },
          tjenesteparaply: { type: 'string', description: 'Service umbrella name, if relevant' },
        },
        required: ['project_id', 'title'],
      },
    },
  },
];

// Every tool here is read-only except create_case, which really does create a
// case and push it to GitHub as a real issue - the same effect as submitting
// the "Legg til issue" form, going through the exact same createCaseAndSync
// the route itself uses. Everything else is look-up only: the assistant can
// search and summarize, but any other suggestion (next steps, a draft
// comment) is just text in its reply, never applied to the database.
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
    case 'list_board_statuses':
      return listStatusOptions();
    case 'create_case': {
      const projectId = Number(input.project_id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        return { error: 'project_id må være en gyldig prosjekt-id - bruk search_projects for å finne den.' };
      }
      const project = await repo.getProject(projectId);
      if (!project) return { error: 'Fant ikke et prosjekt med den iden.' };
      const title = typeof input.title === 'string' ? input.title.trim() : '';
      if (!title) return { error: 'title er påkrevd.' };

      const { case: created, boardStatusError } = await createCaseAndSync(project, {
        title,
        description: typeof input.description === 'string' ? input.description : '',
        owner: typeof input.owner === 'string' ? input.owner : '',
        case_date: typeof input.case_date === 'string' ? input.case_date : null,
        board_status: typeof input.board_status === 'string' ? input.board_status : '',
        kunde: typeof input.kunde === 'string' ? input.kunde : '',
        tjenesteparaply: typeof input.tjenesteparaply === 'string' ? input.tjenesteparaply : '',
      });
      return {
        created_case_id: created.id,
        title: created.title,
        github_issue_number: created.github_issue_number,
        board_status_error: boardStatusError,
      };
    }
    default:
      return { error: `Ukjent verktøy: ${name}` };
  }
}

// This is a general-purpose assistant ("Chat bOT"), not domain-locked - it can
// answer anything, not just questions about this tool. The tools below are
// just extra reach into this specific tool's live data; use them whenever a
// question is actually about a project, case, or person in here, but never
// treat them as the boundary of what you're allowed to discuss.
const SYSTEM_PROMPT = `Du er en hjelpsom AI-assistent integrert som "Chat bOT" i "Prosjektsporing" - et internt verktøy for Intility som sporer OT/Edge Platform-kundeprosjekter.

Du kan svare på hva som helst - generell kunnskap, kode, forklaringer, skriving, resonnering, alt - ikke bare spørsmål om dette verktøyet.

I tillegg har du noen verktøy for å slå opp live data i selve Prosjektsporing-verktøyet:
- Et "prosjekt" tilsvarer en GitHub-milestone: ett per kundeprosjekt, med status (Planlagt/Pågår/Forsinket/Fullført), kunde, ansvarlig, team, tidsfrist og en liste av "issues".
- En "issue" tilsvarer en GitHub-issue: en oppgave knyttet til ett prosjekt, med status (Åpen/Under arbeid/Løst) og en eier (GitHub-brukernavn). Issues opprettet i appen blir automatisk opprettet som ekte issues i GitHub.

Bruk disse verktøyene når spørsmålet faktisk handler om et prosjekt, en issue eller en person i verktøyet. De fleste er skrivebeskyttet (read-only) - vis til konkrete prosjekt- og saksnavn du fant i stedet for å gjette, og når du foreslår et utkast til en kommentar for noe i verktøyet, gjør det tydelig at det er et forslag brukeren selv må skrive inn.

Ett verktøy er ikke read-only: create_case oppretter en ekte issue (samme handling som å fylle ut "Legg til issue"-skjemaet i appen) og skyver den til GitHub med én gang. Bruk det når brukeren tydelig ber deg opprette/legge til en issue/sak - du trenger ikke å be om bekreftelse først, akkurat som å trykke "Lagre" i skjemaet ikke krever en ekstra bekreftelse. Finn alltid riktig project_id med search_projects først (spør brukeren hvilket prosjekt hvis det er reelt tvetydig mellom flere), og sjekk list_board_statuses før du setter board_status. Fortell alltid tydelig hva du opprettet etterpå (tittel, issue-nummer, hvilket prosjekt og hvilken kolonne) - aldri opprett noe stille uten å nevne det.

Spørsmål om verktøyet er ofte korte og upresise ("hvordan går det med Arbion", "hvem har mest å gjøre"). Ikke be om presisering med mindre spørsmålet er reelt tvetydig mellom to helt ulike tolkninger - gjør heller en fornuftig antakelse, bruk verktøyene bredt (søk, sjekk flere prosjekter/personer om nødvendig), og nevn kort hvilken tolkning du la til grunn hvis den ikke er opplagt.

Svar kort og konkret, og på norsk (bokmål) med mindre brukeren skriver på et annet språk.`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AccumulatedToolCall {
  id: string;
  name: string;
  arguments: string;
}

function client(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
}

// Drives the tool-use loop against the (OpenAI-compatible) chat completions API and
// yields plain text chunks as they stream in, across every iteration (tool calls
// happen silently in between; the model's internal "reasoning" delta is never
// yielded - only its actual answer text is).
export async function* streamChatReply(history: ChatMessage[]): AsyncGenerator<string> {
  const openai = client();
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m): ChatCompletionMessageParam => ({ role: m.role, content: m.content })),
  ];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools: TOOLS,
      stream: true,
    });

    let content = '';
    const toolCalls = new Map<number, AccumulatedToolCall>();
    let finishReason: string | null = null;

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      if (choice.delta.content) {
        content += choice.delta.content;
        yield choice.delta.content;
      }

      for (const tc of choice.delta.tool_calls ?? []) {
        const existing = toolCalls.get(tc.index) ?? { id: '', name: '', arguments: '' };
        if (tc.id) existing.id = tc.id;
        if (tc.function?.name) existing.name += tc.function.name;
        if (tc.function?.arguments) existing.arguments += tc.function.arguments;
        toolCalls.set(tc.index, existing);
      }

      if (choice.finish_reason) finishReason = choice.finish_reason;
    }

    const calls = [...toolCalls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call);

    if (calls.length === 0 || finishReason !== 'tool_calls') {
      return;
    }

    messages.push({
      role: 'assistant',
      content: content || null,
      tool_calls: calls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: c.arguments },
      })),
    });

    for (const call of calls) {
      let result: unknown;
      try {
        result = await executeTool(call.name, JSON.parse(call.arguments || '{}'));
      } catch (err) {
        result = { error: err instanceof Error ? err.message : 'Ukjent feil' };
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  yield '\n\n[Samtalen ble for lang og ble stoppet. Prøv å stille et mer avgrenset spørsmål.]';
}

// POST /api/chat — a stateless chat turn: the client resends the full history
// each time. Streams the reply as plain text.
chat.post('/chat', async (c) => {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_BASE_URL) {
    return c.json({ error: 'AI-chat er ikke satt opp (mangler OPENAI_API_KEY/OPENAI_BASE_URL).' }, 503);
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
