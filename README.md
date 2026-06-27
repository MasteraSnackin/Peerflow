# Peerflow

Peerflow is a hackathon MVP for the Attio Agentic CRM track. It demonstrates a
legal open-access research workflow: discover a paper, intake the author brief,
create CRM records, match reviewers, move the review pipeline and attach
security evidence. It also includes Aida, a corpus-grounded research assistant
that answers questions only when it can show supporting article evidence.

The current build is a polished judge-facing demo. It runs in mock mode until
real service credentials are provided through environment variables.

## Pitch

Open-access publishing is not just a content problem. It is a relationship
problem: authors, reviewers, editors and institutions need coordinated
follow-up. Peerflow turns that work into an agentic CRM pipeline centred on
Attio.

## Demo Flow

- Check that a paper comes from legitimate open-access sources.
- Parse author voice or text intake with SLNG.
- Create author, institution, paper and task records in Attio.
- Match reviewers with Superlinked semantic similarity.
- Trigger reviewer outreach and stage updates through n8n.
- Attach Aikido repository security evidence for the side challenge.
- Ask Aida research questions and show the cited corpus passages behind the
  answer.

## Environment Variables

Create `.env.local` from `.env.example` when real keys are available.

```bash
ATTIO_API_KEY=
ATTIO_WORKSPACE_ID=
N8N_WEBHOOK_URL=
SLNG_API_KEY=
SUPERLINKED_ENDPOINT=
SUPERLINKED_API_KEY=
SUPERLINKED_RERANK_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
SUPERLINKED_GPU=l4
SUPERLINKED_TIMEOUT_MS=45000
SUPERLINKED_PROVISION_TIMEOUT_MS=90000
AIKIDO_REPORT_URL=
GEMINI_API_KEY=
AIDA_MODEL_API_KEY=
AIDA_GEMINI_MODEL=gemini-3.5-flash
AIDA_VECTOR_INDEX_URL=
AIDA_EMBEDDING_MODEL=
OPENALEX_EMAIL=
UNPAYWALL_EMAIL=
SEMANTIC_SCHOLAR_API_KEY=
```

Until keys are present, the UI labels each service as `Mock` and the workflow
uses the built-in demo data under `app/data.ts`.

## Aida Hallucination Control

Aida should be implemented as retrieval-augmented generation rather than a
free-form chatbot:

- retrieve passages from the approved open-access corpus first
- answer only from retrieved passages
- show citations and evidence coverage beside every answer
- refuse when no relevant evidence is found
- store answer traces so reviewers can audit which studies were used

The current UI demonstrates those behaviours with mock corpus snippets and a
server-side Gemini route at `app/api/aida/route.ts`. Real implementation hooks
are exposed through `GEMINI_API_KEY` or `AIDA_MODEL_API_KEY`,
`AIDA_GEMINI_MODEL`, `AIDA_VECTOR_INDEX_URL` and `AIDA_EMBEDDING_MODEL`.

## Superlinked SIE Reviewer Matching

Peerflow uses the Superlinked Inference Engine for the reviewer-matching side
challenge through `app/api/superlinked/match-reviewers/route.ts`.

- Model: `cross-encoder/ms-marco-MiniLM-L-6-v2`
- Task: rerank reviewer profiles against the selected paper
- Inputs: paper title, field, source, licence and abstract
- Candidates: reviewer institution, speciality and availability
- Fallback: local reviewer scores if SIE is cold, slow or unavailable

The demo line is:

> Superlinked reranks reviewers by semantic relevance to the paper, so the
> agent matches by research meaning rather than keywords.

## Open-Access Boundary

Peerflow is not a Sci-Hub clone and does not bypass paywalls. The intended
sources are legal open-access indexes and repositories such as arXiv, OpenAlex,
Semantic Scholar, PubMed Central and Unpaywall. Store metadata, abstracts and
authorised links unless a paper licence explicitly permits more.

## Local Development

```bash
npm ci
npm run dev
npm run build
```

The dev server normally runs at `http://localhost:3000/`.

## Project Shape

- `app/page.tsx`: server-rendered shell and environment status.
- `app/api/superlinked/match-reviewers/route.ts`: SIE reviewer matching.
- `app/components/AidaAssistant.tsx`: corpus-grounded Q&A demo.
- `app/components/AgentConsole.tsx`: interactive judge demo.
- `app/data.ts`: mock papers, reviewers, corpus snippets and workflow steps.
- `.env.example`: future integration variables.
