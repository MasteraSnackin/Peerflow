# Peerflow Submission Guide

## One-Line Description

Peerflow is an agentic CRM for legal open-access research publishing, with Aida
answering research questions only from cited corpus evidence.

## 60-Second Pitch

Open-access publishing is not just a content problem. It is a relationship and
workflow problem across authors, reviewers, editors and institutions.

Peerflow turns that work into an agentic CRM pipeline. A paper is checked as a
legal open-access source, shaped into an Attio-style research record, matched to
reviewers with Superlinked, and moved through outreach with n8n. Aida sits on
top as a corpus-grounded AI assistant: it retrieves live open-access evidence,
cites the studies it used and refuses when the question is outside its safe
scope.

For the demo, the judge can run the whole workflow end to end. Attio validates
the workspace, Superlinked reranks reviewer fit live, Aikido security evidence
is one click away, and the n8n step reports whether the active workflow accepted
the payload.

## Tracks And Sponsor Mapping

| Track or sponsor | How Peerflow uses it | Current status |
| --- | --- | --- |
| Attio Agentic CRM | Peerflow creates/updates demo author, institution and follow-up task records through the Attio REST API; n8n import workflow includes Attio write nodes for the live orchestration path. | REST API read/write live; native Attio visual workflow not implemented |
| Superlinked | Semantic reviewer matching. Paper title, abstract and field plus reviewer expertise, institution and past topics are embedded with `all-MiniLM-L6-v2`, then reranked with `ms-marco-MiniLM-L-6-v2`. With the server-only admin token, Peerflow requests a pinned SIE model pool before matching. Returns top 3 reviewer matches with fit scores and pushes them into the Attio follow-up task payload. | Backend route live; proof visible in reviewer panel |
| Tavily | Extracts supplemental open-access source text for Aida's live corpus and source discovery. | Live |
| n8n | Receives one `paper.submitted` event and owns Attio upserts, reviewer matching, outreach or follow-up tasks, and the `Reviewer matched` stage update. | Configured, but latest deployed webhook check returned `404`; activate/publish the workflow or correct the production webhook path. Importable downstream workflow file contains the orchestration nodes |
| SLNG | Author records a submission request; Peerflow sends audio to SLNG STT, then extracts title, field, author, institution and summary for the intake record. | Microphone panel and `/api/slng/intake` route implemented |
| Aikido | Provides a security report link inside the integration grid. | Configured |
| Aida | Gemini-backed assistant using live OpenAlex/Tavily corpus retrieval, citation validation, refusal behaviour and browser voice output for spoken answers. | Live |

## Demo Flow

1. Open the app at `http://localhost:3000/`.
2. Point out `7/7` configured integrations.
3. Ask Aida a supported question and show live citations.
4. Ask Aida the patient-treatment question and show refusal.
5. Search open sources with Tavily and show the candidate source.
6. Click `Run agent`.
7. Show Peerflow sending one `paper.submitted` event to n8n.
8. Explain that n8n is the intended owner for Attio calls, Superlinked or
   Peerflow reviewer matching, reviewer outreach/tasks and the
   `Reviewer matched` update. If the webhook still returns `404`, show the
   setup message and workflow JSON instead of claiming a live execution.
9. Show the n8n result in the agent log.
10. Open the Aikido report from the integration grid.

## Judge Talk Track

- "This is legal open-access infrastructure, not a paywall bypass."
- "Aida follows a no-citation, no-claim rule."
- "The CRM layer is the product centre: papers, authors, institutions,
  reviewers and follow-ups belong in a relationship system, not an inbox."
- "The app is mock-safe but live-capable: live integrations report their source,
  and failed integrations fall back visibly instead of silently pretending."

## Current Live Status

- Aida/Gemini: live.
- OpenAlex: live open-access corpus retrieval; an API key is optional but
  recommended for serious use.
- Tavily: live supplemental extraction and source discovery.
- Attio: REST API read/write is live. Demo companies, people and follow-up
  tasks have been created in the Techeurope Hackathon #9 workspace. Native
  Attio visual workflow setup is not implemented. The Attio developer webhook
  has been configured to point to the production n8n webhook, but the current
  n8n endpoint returns `404` until the workflow is active/corrected.
- Superlinked: Peerflow reviewer-matching backend is live for n8n to call. It
  uses `all-MiniLM-L6-v2` embeddings and `ms-marco-MiniLM-L-6-v2` reranking so
  reviewer fit is based on research meaning rather than keyword overlap. The
  admin token is stored server-side for SIE model-pool pinning.
- Aikido: configured report link.
- SLNG: microphone voice intake is implemented. The app sends recordings to
  `/api/slng/intake`, which calls SLNG STT when configured and returns the
  structured paper record for the agent log.
- Voice output: Aida answers and the latest agent log can be read aloud through
  browser speech synthesis. No extra API key is required.
- n8n: the app sends the n8n orchestration contract in the payload, but the
  latest deployed production webhook check returned `404`. Activate/publish the
  workflow or correct the production webhook path before presenting it as live.
  `n8n/peerflow-hackathon-orchestration.json` contains downstream Attio,
  reviewer matching, outreach/task and stage-update nodes. The live n8n canvas
  is recorded at
  [peerflow.app.n8n.cloud/workflow/jzwLgV8qqsVSPM9u](https://peerflow.app.n8n.cloud/workflow/jzwLgV8qqsVSPM9u?projectId=7UmZAgpCylS4FmJs&uiContext=workflow_list)
  and appears in the app as `Open workflow`.

## Backup Plan

If a live provider is slow during judging:

- Aida refuses rather than using a local corpus answer if live retrieval or
  Gemini is slow.
- Reviewer previews fall back to local scores.
- n8n shows an explicit setup/fallback message with a generated run ID.
- Peerflow sends the event once; n8n is designed to own Attio writes, reviewer
  matching, outreach/tasks and stage movement once the production webhook is
  active.

## Final Submission Checklist

- [ ] Confirm the production n8n webhook accepts `paper.submitted` and returns
      `live`; latest deployed check returned `404`.
- [x] Seed live Attio demo companies, people and follow-up tasks.
- [x] Configure the Attio webhook target to the production n8n webhook.
- [x] Prepare n8n nodes for Attio writes, reviewer matching, outreach/tasks and
      stage update.
- [x] Record the live n8n Cloud workflow URL in the app and documentation.
- [ ] Confirm the signed-in n8n Cloud canvas exactly matches
      `n8n/peerflow-hackathon-orchestration.json`.
- [x] Add the deployed public URL once hosting is available:
      https://peerflow-agentic-research-crm.vercel.app.
- [ ] Keep `.env.local` out of Git.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
