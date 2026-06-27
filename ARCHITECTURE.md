# System Architecture: Peerflow

## Overview

Peerflow is a full-stack web app for a hackathon demo of an agentic CRM workflow
for open-access research publishing. It shows how a paper can move from legal
open-access intake through author follow-up, reviewer matching, workflow
orchestration and research Q&A.

The current implementation is a polished judge-facing MVP. It runs with static
mock data by default and enables live Gemini, Superlinked SIE, Attio validation
and n8n webhook calls when the required environment variables are present. The
Aikido report URL is shown as external security evidence. SLNG is represented in
the UI and environment model, but the repository does not yet contain a
production voice-intake flow.

Peerflow is not a Sci-Hub clone. Its intended boundary is legal open-access
metadata, abstracts and authorised links.

## Key Requirements

- Present an end-to-end agent workflow that judges can run locally.
- Keep API keys and service credentials on the server side.
- Support a mock-first demo path so the product remains usable without live
  partner credentials.
- Use legal open-access research metadata and citation evidence.
- Let Aida answer only when supporting corpus evidence is available.
- Use Superlinked SIE to rerank reviewer matches when configured.
- Make future Attio, n8n, SLNG and Aikido integrations clear and pluggable via
  environment variables.
- Avoid overstating production readiness: persistence, authentication,
  observability and compliance controls are still limited.

## High-Level Architecture

```mermaid
flowchart LR
  Judge[Judge or operator] --> Browser[Browser UI]
  Browser --> App[vinext and Next app]
  App --> AidaRoute[/POST /api/aida/]
  App --> MatchRoute[/POST /api/superlinked/match-reviewers/]
  App --> AttioRoute[/GET /api/attio/status/]
  App --> N8nRoute[/POST /api/n8n/trigger/]
  App --> StaticData[(Static demo data)]
  AidaRoute --> Corpus[(Mock corpus snippets)]
  AidaRoute --> Gemini[Gemini API]
  MatchRoute --> SIE[Superlinked SIE]
  AttioRoute --> Attio[Attio CRM]
  N8nRoute --> N8N[n8n webhook]
  App -. planned .-> SLNG[SLNG voice intake]
  App -. planned .-> Aikido[Aikido security report]
  App -. optional scaffold .-> D1[(Cloudflare D1)]
```

The system boundary is the Peerflow web app and its server routes. The browser
only receives rendered UI state and API responses. Credentials are read from
server environment variables and are not intentionally sent to the client.
Static demo data is the current source of truth. D1 support exists as scaffolded
infrastructure, but no application data is currently persisted there.

## Component Details

### Web App Shell

- Responsibilities: render the main Peerflow demo surface, show integration
  readiness, and pass mock papers, reviewers, workflow steps and corpus data to
  client components.
- Main technologies: Next.js app router conventions through vinext, React 19,
  TypeScript and Tailwind CSS.
- Data owned or transformed: reads static arrays from `app/data.ts` and converts
  server environment presence into integration status booleans.
- External dependencies: none at render time beyond server environment
  variables.
- Failure modes or operational concerns: the UI can show a service as connected
  when the relevant variable exists even if the external service itself is not
  reachable. This is readiness signalling, not a full health check.

### Agent Console

- Responsibilities: provide the interactive "Run agent" workflow, simulate
  paper intake stages, display an Attio-style record preview, call reviewer
  matching, validate the Attio workspace, trigger n8n orchestration and show an
  in-session agent log.
- Main technologies: React client component with local component state and
  browser `fetch`.
- Data owned or transformed: selected paper ID, completed workflow step IDs,
  reviewer match results and transient log entries.
- External dependencies: calls `GET /api/attio/status`,
  `POST /api/superlinked/match-reviewers` and `POST /api/n8n/trigger`.
- Failure modes or operational concerns: the log and stage state are not
  persisted. Refreshing the page loses the run history.

### Aida Assistant

- Responsibilities: let a user ask predefined research questions, display the
  answer, citation trace, evidence coverage and refusal behaviour.
- Main technologies: React client component with local state and browser
  `fetch`.
- Data owned or transformed: selected question ID, live or mock answer payload,
  and matching article citations.
- External dependencies: calls `POST /api/aida`.
- Failure modes or operational concerns: the current corpus is small and static.
  Aida's refusal behaviour is implemented for unsupported demo questions, but a
  production retrieval system would need stronger evaluation and logging.

### Aida API Route

- Responsibilities: answer a selected question from cited corpus snippets,
  refuse unsupported questions before model invocation, call Gemini when
  configured, and validate returned citations against the allowed set.
- Main technologies: Next-style `POST` route, TypeScript, server-side `fetch`.
- Data owned or transformed: `questionId`, mock question definitions, cited
  article snippets, Gemini JSON output and final Aida response shape.
- External dependencies: Gemini API via `AIDA_MODEL_API_KEY` or
  `GEMINI_API_KEY`; model name defaults to `gemini-3.5-flash`.
- Failure modes or operational concerns: model failures return a mock fallback
  with HTTP 200. This is useful for demos but should be revisited for production
  monitoring and error handling.

### Superlinked Matching API Route

- Responsibilities: rerank reviewer profiles against a selected paper and
  normalise SIE scores into judge-friendly fit percentages.
- Main technologies: Next-style `POST` route, TypeScript and
  `@superlinked/sie-sdk`.
- Data owned or transformed: selected paper profile, reviewer profile strings,
  raw SIE scores, normalised fit values and fallback reviewer matches.
- External dependencies: Superlinked SIE endpoint and key. The default rerank
  model is `cross-encoder/ms-marco-MiniLM-L-6-v2`, with GPU lane defaulting to
  `l4`.
- Failure modes or operational concerns: missing credentials, cold capacity,
  timeout or scoring errors return mock reviewer matches. The client labels
  whether the source was live or mock.

### Attio Status API Route

- Responsibilities: validate that the configured Attio API key can read the
  workspace object configuration.
- Main technologies: Next-style `GET` route, TypeScript and server-side
  `fetch`.
- Data owned or transformed: Attio object names such as `companies` and
  `people`, returned as a small status payload.
- External dependencies: Attio API via `ATTIO_API_KEY` and
  `ATTIO_WORKSPACE_ID`.
- Failure modes or operational concerns: this route is intentionally read-only.
  It does not create CRM records yet. Missing or invalid credentials return a
  mock/fallback status.

### n8n Trigger API Route

- Responsibilities: send the selected paper, current workflow stage and reviewer
  matches to the configured n8n webhook.
- Main technologies: Next-style `POST` route, TypeScript and server-side
  `fetch`.
- Data owned or transformed: selected paper metadata, reviewer match summaries
  and generated run ID.
- External dependencies: `N8N_WEBHOOK_URL`.
- Failure modes or operational concerns: test webhooks may return `404` unless
  the n8n workflow is actively listening. The route returns a clearer
  mock/fallback status rather than blocking the demo.

### Static Demo Data

- Responsibilities: provide demo papers, reviewer candidates, workflow steps,
  corpus articles and supported Aida questions.
- Main technologies: TypeScript exports in `app/data.ts`.
- Data owned or transformed: paper metadata, abstracts, reviewer profiles,
  workflow copy and corpus evidence snippets.
- External dependencies: none.
- Failure modes or operational concerns: data changes require a code change.
  There is no admin interface, database write path or ingestion pipeline yet.

### Database Scaffold

- Responsibilities: prepare for future Cloudflare D1 access through Drizzle ORM.
- Main technologies: Drizzle ORM, Drizzle Kit and a `getDb()` helper for D1.
- Data owned or transformed: none in the current application. `db/schema.ts` is
  intentionally empty.
- External dependencies: optional Cloudflare D1 binding named `DB`.
- Failure modes or operational concerns: `.openai/hosting.json` currently has
  `d1` and `r2` set to `null`, so no D1 or R2 binding is active by default.

### Worker and Build Layer

- Responsibilities: package the app for vinext, Vite and Cloudflare
  Worker-compatible output; handle the vinext image optimisation route.
- Main technologies: vinext, Vite, Cloudflare Vite plugin, Cloudflare Worker
  entry point and a small Sites packaging plugin.
- Data owned or transformed: build output, `.openai/hosting.json` metadata and
  optional Drizzle migrations copied into `dist/.openai`.
- External dependencies: Cloudflare runtime APIs for assets, image transforms
  and optional D1.
- Failure modes or operational concerns: local development runs through
  `vinext dev`; production deployment details are not fully documented in the
  repository yet.

## Data Flow

### Agent Workflow

1. The judge opens the web app and selects one of the static open-access paper
   entries.
2. The browser runs the local agent sequence in `AgentConsole`.
3. For each step, the UI marks progress and writes a transient log entry.
4. On the CRM step, the browser calls `/api/attio/status` to validate the
   configured Attio workspace without creating records.
5. On the reviewer matching step, the browser posts the paper ID to
   `/api/superlinked/match-reviewers`.
6. The server route builds text profiles for the paper and reviewers.
7. If SIE credentials are present, the route calls Superlinked SIE and
   normalises the scores.
8. If SIE is unavailable, the route returns the mock reviewer list.
9. On the workflow step, the browser posts the paper and reviewer summary to
   `/api/n8n/trigger`.
10. The browser renders reviewer matches, Attio validation status, n8n trigger
    status and the Attio-style record preview.

### Aida Q&A Flow

1. The judge selects a predefined question in the Aida panel.
2. The browser posts the question ID to `/api/aida`.
3. The route loads the matching question and its allowed citation IDs.
4. If the question has no citations, the route refuses before calling Gemini.
5. If no Gemini key is configured, the route returns the mock answer.
6. If Gemini is configured, the route sends only the cited evidence snippets and
   asks for JSON.
7. The route accepts the answer only if at least one returned citation is in the
   allowed citation set.
8. The browser displays the answer, confidence, coverage and cited evidence.

## Data Model

The current data model is static and in-memory at runtime.

| Entity | Current fields | Current storage |
| --- | --- | --- |
| Paper | `id`, `title`, `source`, `author`, `institution`, `field`, `licence`, `abstract` | `app/data.ts` |
| Reviewer | `name`, `institution`, `speciality`, `fit`, `availability` | `app/data.ts` |
| Workflow step | `id`, `title`, `owner`, `detail` | `app/data.ts` |
| Corpus article | `id`, `title`, `source`, `licence`, `year`, `evidence` | `app/data.ts` |
| Aida question | `id`, `question`, `answer`, `confidence`, `coverage`, `citations` | `app/data.ts` |
| Agent run log | `id`, `label`, `detail` | Browser component state only |

There is no durable application database for the main workflow yet. Drizzle and
D1 are available as a future path, but the schema contains no tables.

## Infrastructure and Deployment

- Runtime: Node.js `>=22.13.0` for local development and build commands.
- Frameworks: vinext with Next.js app router conventions and Vite.
- Local development: `npm run dev`, usually served at `http://localhost:3000/`.
- Build: `npm run build`, which runs `vinext build`.
- Production start: `npm run start`, which runs `vinext start`.
- Cloudflare compatibility: `worker/index.ts` provides a Worker entry point and
  image optimisation route. `vite.config.ts` wires the Cloudflare Vite plugin.
- Sites packaging: `build/sites-vite-plugin.ts` copies hosting metadata and
  Drizzle migrations into `dist/.openai` during builds.
- Hosting config: `.openai/hosting.json` currently has no D1 or R2 binding.

Current deployment URL is not recorded in the repository. Use `<ADD DETAIL>` if
this document is published before a public URL exists.

## Scalability and Reliability

The current architecture prioritises demo reliability over scale. Static data
keeps the app deterministic and allows it to run without external services.
Server routes fall back to mock responses when Gemini or Superlinked cannot be
used, which makes the live demo less fragile.

Limits and risks:

- No persistent state for agent runs, submissions or audit trails.
- No queueing, retry policy or background workflow runner.
- External AI and SIE calls are synchronous request-response operations.
- Gemini and SIE failures are hidden behind mock fallbacks, so production
  monitoring would need clearer error reporting.
- n8n orchestration is triggered during the agent run, but there is no durable
  run-status polling or retry mechanism yet.
- Attio record creation is not implemented as a write integration. The current
  app previews the record shape and uses a read-only Attio validation route.

Future scale should introduce a durable store, explicit job status, retries,
provider timeouts, idempotency keys and persisted audit logs.

## Security and Compliance

### Secrets Management

Secrets are expected in `.env.local` for local development and platform-managed
environment variables for deployment. The app uses server environment variables
for Gemini, Superlinked, Attio, n8n, SLNG, Aikido and open-access source
configuration. No `NEXT_PUBLIC_` secrets are used.

The UI displays environment variable names and connection status, but should not
display secret values. `.env.local` must remain uncommitted.

### Client and Server Trust Boundary

The browser can call four server routes:

- `POST /api/aida`
- `GET /api/attio/status`
- `POST /api/n8n/trigger`
- `POST /api/superlinked/match-reviewers`

The client controls `questionId`, `paperId`, n8n stage text and reviewer
summaries. The server selects papers from known static lists, keeps provider
credentials server-side and treats all client-provided workflow payload fields
as demo data rather than trusted CRM records.

`AIKIDO_REPORT_URL` is exposed to the browser as an external report link. It
should only contain a public or shareable report URL, not a private token or API
credential.

### Authentication and Authorisation

There is no active application authentication or role-based authorisation in the
current UI. A ChatGPT authentication helper exists in `app/chatgpt-auth.ts`, but
it is not wired into the demo pages or API routes. If Peerflow moves beyond a
judge demo, authentication should be added before handling real submissions,
reviewer identities or private author communications.

### Sensitive Data Handling

The demo stores only mock paper metadata, abstracts and evidence snippets in the
repository. The intended production boundary is legal open-access metadata and
authorised content. Full copyrighted paper text, paywalled content and private
medical or personal data should not be ingested without a clear legal basis and
access policy.

### Third-Party Provider Risk

Gemini receives the selected question and cited evidence snippets. Superlinked
SIE receives paper and reviewer profile text. If real author or reviewer data is
added, the app needs provider review, data minimisation, retention rules and
clear consent or contractual basis.

### Auditability and Logging

The UI shows an in-session agent log, but it is not persisted. A production
version should store provider calls, selected evidence, reviewer match inputs,
outputs, user actions and workflow events in an audit table with appropriate
redaction.

## Observability

Current observability is minimal:

- `npm run lint` verifies static code quality.
- `npm run build` verifies the production build.
- API routes return `mode` and `source` fields so the UI can show whether a
  response came from live or mock execution.
- There is no structured logging, tracing, metrics dashboard, uptime check or
  error reporting integration in the repository.

Recommended additions:

- Structured server logs for route calls, provider mode and failure reason.
- Request IDs across agent runs and provider calls.
- Persisted audit trail for Aida answers and reviewer matches.
- Health checks for Gemini, Superlinked, n8n and Attio.
- Build and deployment status badges once CI is configured.

## Design Decisions and Trade-offs

- Mock-first architecture: keeps the hackathon demo reliable without keys, but
  does not prove full production integration behaviour.
- Server-side provider calls: protects credentials and gives a clear trust
  boundary, but adds backend responsibility for validation and observability.
- Static corpus: makes Aida's evidence trace easy to inspect, but does not yet
  support real retrieval, ranking or ingestion.
- Gemini fallback to mock answer: preserves demo flow during provider issues,
  but production systems should expose failures more explicitly.
- Superlinked reranking route: demonstrates semantic reviewer matching with a
  real side-challenge service, while keeping local mock scores as a safety net.
- No active database: reduces implementation complexity for the MVP, but limits
  auditability, collaboration, repeatability and CRM-grade workflow state.
- Environment-variable integration model: makes partner services pluggable, but
  connection status currently checks configuration presence rather than live
  service health.

## Future Improvements

- Implement real Attio writes for authors, institutions, papers, notes, tasks
  and review stages.
- Invoke the configured n8n webhook during the agent workflow and surface run
  status.
- Add SLNG voice capture, transcription and structured intake parsing.
- Replace static Aida snippets with a legal open-access ingestion and vector
  retrieval pipeline.
- Persist Aida answer traces, reviewer match decisions and agent workflow logs.
- Add authentication and role-based access before handling real submissions.
- Add Drizzle tables for papers, authors, reviewers, corpus records, agent runs
  and audit events.
- Add provider health checks and clearer failure reporting.
- Attach Aikido scan output and link it to build or release evidence.
- Add automated tests for API route fallback behaviour, citation validation and
  core UI states.
- Record the public deployment URL and deployment procedure once available.
