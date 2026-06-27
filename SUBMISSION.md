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
| Superlinked | n8n should call Peerflow's reviewer-matching backend or Superlinked directly. | Backend route live |
| Tavily | Extracts supplemental open-access source text for Aida's live corpus and source discovery. | Live |
| n8n | Receives one `paper.submitted` event and owns Attio upserts, reviewer matching, outreach and stage update. | Published webhook accepts events; importable downstream workflow file is ready |
| SLNG | Planned voice intake for author submission briefs. | Key configured; endpoint not implemented |
| Aikido | Provides a security report link inside the integration grid. | Configured |
| Aida | Gemini-backed assistant using live OpenAlex/Tavily corpus retrieval, citation validation and refusal behaviour. | Live |

## Demo Flow

1. Open the app at `http://localhost:3000/`.
2. Point out `7/7` configured integrations.
3. Ask Aida a supported question and show live citations.
4. Ask Aida the patient-treatment question and show refusal.
5. Search open sources with Tavily and show the candidate source.
6. Click `Run agent`.
7. Show Peerflow sending one `paper.submitted` event to n8n.
8. Explain that n8n owns Attio writes, reviewer matching, outreach/tasks and the
   `Reviewer matched` stage update.
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
  is active and points to the production n8n webhook.
- Superlinked: Peerflow reviewer-matching backend is live for n8n to call.
- Aikido: configured report link.
- SLNG: configured key; real API endpoint still needed.
- n8n: production workflow is published and accepts `paper.submitted` events.
  `n8n/peerflow-hackathon-orchestration.json` contains the downstream Attio,
  reviewer matching, outreach/task and stage-update nodes for import/publish.

## Backup Plan

If a live provider is slow during judging:

- Aida falls back to local corpus answers if live retrieval or Gemini is slow.
- Reviewer previews fall back to local scores.
- n8n shows an explicit setup/fallback message with a generated run ID.
- Peerflow does not create Attio records directly; n8n must own those writes.

## Final Submission Checklist

- [x] Activate the n8n workflow and confirm the production webhook returns
      `live`.
- [x] Seed live Attio demo companies, people and follow-up tasks.
- [x] Point the active Attio webhook at the production n8n webhook.
- [x] Prepare n8n nodes for Attio writes, reviewer matching, outreach/tasks and
      stage update.
- [ ] Import and publish `n8n/peerflow-hackathon-orchestration.json` in n8n
      Cloud after signing in.
- [ ] Add the deployed public URL once hosting is available.
- [ ] Keep `.env.local` out of Git.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
