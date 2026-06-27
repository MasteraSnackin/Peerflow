# Peerflow Architecture Diagrams

These diagrams are written in Mermaid so they can render directly on GitHub.
They describe the current hackathon MVP. Where the implementation is still a
demo path, the diagrams keep that boundary explicit.

## C1: System Context

```mermaid
flowchart LR
  Author["Author"]
  Judge["Judge or operator"]
  Reviewer["Reviewer"]

  subgraph PeerflowBoundary["Peerflow system"]
    Peerflow["Peerflow<br/>Agentic CRM demo for open-access research publishing"]
  end

  OpenAlex["OpenAlex<br/>Open-access works metadata"]
  Tavily["Tavily<br/>Search and extract"]
  Gemini["Gemini<br/>Aida answer model"]
  SLNG["SLNG<br/>Speech to text"]
  Superlinked["Superlinked SIE<br/>Semantic reviewer matching"]
  N8N["n8n<br/>Workflow orchestration"]
  Attio["Attio<br/>CRM records and tasks"]
  Aikido["Aikido<br/>Security report"]

  Author -->|"speaks or submits paper brief"| Peerflow
  Judge -->|"runs demo and inspects proof"| Peerflow
  Reviewer <-->|"outreach and follow-up tasks"| Attio

  Peerflow -->|"live open-access retrieval"| OpenAlex
  Peerflow -->|"supplemental source discovery"| Tavily
  Peerflow -->|"evidence-grounded question"| Gemini
  Peerflow -->|"voice audio for intake"| SLNG
  Peerflow -->|"paper and reviewer profiles"| Superlinked
  Peerflow -->|"paper.submitted event"| N8N
  N8N -->|"create or update records"| Attio
  Peerflow -->|"external report link"| Aikido
```

## C2: Container Diagram

```mermaid
flowchart TB
  Browser["Browser UI<br/>React components<br/>local state"]

  subgraph App["Peerflow app runtime"]
    Page["app/page.tsx<br/>server-rendered shell"]
    Client["Client components<br/>AgentConsole<br/>AidaAssistant<br/>VoiceIntake"]
    Routes["Server API routes<br/>Next-style handlers"]
    CorpusLib["openAccessCorpus.ts<br/>normalised retrieval helper"]
    DemoData["app/data.ts<br/>static demo queue<br/>reviewers<br/>Aida question prompts"]
    OptionalDb["Optional D1 and Drizzle scaffold<br/>no active tables yet"]
  end

  N8N["n8n Cloud"]
  Attio["Attio REST API"]
  Superlinked["Superlinked SIE endpoint"]
  SLNG["SLNG STT endpoint"]
  Gemini["Gemini API"]
  OpenAlex["OpenAlex API"]
  Tavily["Tavily API"]
  Aikido["Aikido report URL"]

  Browser --> Page
  Page --> Client
  Client --> Routes
  Client --> DemoData
  Routes --> DemoData
  Routes --> CorpusLib
  Routes -.->|"future persistence"| OptionalDb

  Routes -->|"POST /api/n8n/trigger"| N8N
  Routes -->|"GET /api/attio/status"| Attio
  Routes -->|"POST /api/superlinked/match-reviewers"| Superlinked
  Routes -->|"POST /api/slng/intake"| SLNG
  Routes -->|"POST /api/aida"| Gemini
  CorpusLib --> OpenAlex
  CorpusLib --> Tavily
  Browser -->|"opens report link"| Aikido
```

## C3: Component Diagram

```mermaid
flowchart TB
  subgraph UI["Browser components"]
    AgentConsole["AgentConsole<br/>runs paper workflow<br/>shows n8n and Attio proof"]
    VoiceIntake["VoiceIntake<br/>records author speech<br/>shows structured intake"]
    AidaAssistant["AidaAssistant<br/>question answering<br/>citation trace"]
    StatusGrid["Integration status grid<br/>readiness indicators<br/>Aikido link"]
  end

  subgraph API["Server route components"]
    AidaRoute["/api/aida<br/>refusal guard<br/>Gemini call<br/>citation validation"]
    CorpusRoute["/api/corpus/search<br/>live corpus preview"]
    N8NRoute["/api/n8n/trigger<br/>paper.submitted event"]
    MatchRoute["/api/superlinked/match-reviewers<br/>semantic matching"]
    SLNGRoute["/api/slng/intake<br/>speech to structured intake"]
    AttioRoute["/api/attio/status<br/>workspace read check"]
    TavilyRoute["/api/tavily/discover<br/>allowed source discovery"]
  end

  subgraph Data["Local app data and helpers"]
    DataTs["app/data.ts<br/>papers<br/>reviewers<br/>questions<br/>workflow steps"]
    CorpusHelper["openAccessCorpus.ts<br/>OpenAlex mapping<br/>Tavily supplement<br/>snippet normalisation"]
  end

  AgentConsole --> VoiceIntake
  AgentConsole --> N8NRoute
  AgentConsole --> MatchRoute
  VoiceIntake --> SLNGRoute
  AidaAssistant --> AidaRoute
  AidaAssistant --> CorpusRoute
  StatusGrid --> AttioRoute
  StatusGrid --> TavilyRoute

  AidaRoute --> CorpusHelper
  CorpusRoute --> CorpusHelper
  MatchRoute --> DataTs
  N8NRoute --> DataTs
  SLNGRoute --> DataTs
```

## C4: Code-Level Route View

```mermaid
flowchart TB
  subgraph Inputs["Client inputs"]
    QuestionId["questionId"]
    PaperId["paperId"]
    Audio["microphone audio"]
    Query["source discovery query"]
  end

  subgraph Routes["app/api route files"]
    AidaCode["app/api/aida/route.ts<br/>load question<br/>retrieve evidence<br/>call Gemini<br/>validate citations"]
    CorpusCode["app/api/corpus/search/route.ts<br/>search legal corpus<br/>return article cards"]
    N8NCode["app/api/n8n/trigger/route.ts<br/>build paper.submitted<br/>include callback URL"]
    MatchCode["app/api/superlinked/match-reviewers/route.ts<br/>embed paper and reviewers<br/>rerank candidates"]
    SLNGCode["app/api/slng/intake/route.ts<br/>upload audio<br/>call SLNG<br/>extract record"]
    AttioCode["app/api/attio/status/route.ts<br/>read workspace object config"]
    TavilyCode["app/api/tavily/discover/route.ts<br/>search allowed domains<br/>extract snippet"]
  end

  subgraph Outputs["Route outputs"]
    AidaAnswer["answer<br/>confidence<br/>citations<br/>coverage"]
    CorpusCards["article cards<br/>source and evidence"]
    N8NStatus["trigger status<br/>event id<br/>n8n ownership contract"]
    ReviewerMatches["top 3 reviewers<br/>fit scores<br/>source mode"]
    IntakeRecord["transcript<br/>structured paper intake"]
    AttioStatus["workspace status<br/>object names"]
    TavilySource["candidate source<br/>extract snippet"]
  end

  QuestionId --> AidaCode --> AidaAnswer
  QuestionId --> CorpusCode --> CorpusCards
  PaperId --> N8NCode --> N8NStatus
  PaperId --> MatchCode --> ReviewerMatches
  Audio --> SLNGCode --> IntakeRecord
  Query --> TavilyCode --> TavilySource
  AttioCode --> AttioStatus
```

## Data Flow: End-to-End Agent Workflow

```mermaid
flowchart LR
  Author["Author voice brief"]
  Browser["Peerflow browser UI"]
  SLNGRoute["/api/slng/intake"]
  SLNG["SLNG STT"]
  IntakeRecord["Structured paper intake"]
  N8NRoute["/api/n8n/trigger"]
  Event["paper.submitted"]
  N8N["n8n orchestration"]
  Attio["Attio records and tasks"]
  MatchRoute["/api/superlinked/match-reviewers"]
  SIE["Superlinked SIE"]
  Outreach["Reviewer outreach or follow-up task"]
  Stage["Paper stage<br/>Reviewer matched"]

  Author --> Browser
  Browser -->|"audio upload"| SLNGRoute
  SLNGRoute --> SLNG
  SLNG -->|"transcript"| SLNGRoute
  SLNGRoute --> IntakeRecord
  IntakeRecord --> Browser
  Browser -->|"selected paper id"| N8NRoute
  N8NRoute --> Event
  Event --> N8N
  N8N -->|"upsert author and institution"| Attio
  N8N -->|"match request"| MatchRoute
  MatchRoute --> SIE
  SIE -->|"semantic scores"| MatchRoute
  MatchRoute -->|"top 3 reviewers"| N8N
  N8N --> Outreach
  Outreach --> Attio
  N8N --> Stage
```

## Data Flow: Aida Evidence-Grounded Answering

```mermaid
flowchart TB
  User["User question"]
  AidaUI["AidaAssistant UI"]
  AidaRoute["/api/aida"]
  RefusalGuard{"Patient-specific<br/>treatment advice?"}
  Corpus["openAccessCorpus helper"]
  OpenAlex["OpenAlex works"]
  Tavily["Tavily supplement"]
  Evidence["Allowed evidence set"]
  Gemini["Gemini"]
  CitationCheck{"Returned citations<br/>match evidence set?"}
  Answer["Answer with citations"]
  Refusal["Refusal response"]

  User --> AidaUI
  AidaUI --> AidaRoute
  AidaRoute --> RefusalGuard
  RefusalGuard -->|"yes"| Refusal
  RefusalGuard -->|"no"| Corpus
  Corpus --> OpenAlex
  Corpus -->|"if needed and configured"| Tavily
  OpenAlex --> Evidence
  Tavily --> Evidence
  Corpus -->|"if no live evidence"| Refusal
  Evidence --> Gemini
  Gemini --> CitationCheck
  CitationCheck -->|"valid"| Answer
  CitationCheck -->|"invalid or model failure"| Refusal
  Answer --> AidaUI
  Refusal --> AidaUI
```

## Sequence: Agent Orchestration Through n8n

```mermaid
sequenceDiagram
  autonumber
  actor Judge as Judge or operator
  participant UI as Peerflow UI
  participant N8NRoute as n8n trigger route
  participant N8N as n8n workflow
  participant Attio as Attio
  participant MatchRoute as /api/superlinked/match-reviewers
  participant SIE as Superlinked SIE

  Judge->>UI: Click Run agent
  UI->>N8NRoute: POST paperId
  N8NRoute->>N8N: Send paper.submitted event
  N8NRoute-->>UI: Return trigger status and event id
  N8N->>Attio: Create or update author and institution records
  N8N->>MatchRoute: Request reviewer matches
  MatchRoute->>SIE: Embed paper and reviewer profiles
  SIE-->>MatchRoute: Return semantic scores
  MatchRoute-->>N8N: Return top 3 reviewer matches
  N8N->>Attio: Create reviewer follow-up task with matches
  N8N->>Attio: Update paper stage to Reviewer matched
```

## Sequence: SLNG Voice Intake

```mermaid
sequenceDiagram
  autonumber
  actor Author as Author
  participant UI as VoiceIntake component
  participant Browser as Browser MediaRecorder
  participant Route as SLNG intake route
  participant SLNG as SLNG STT
  participant Data as app/data.ts

  Author->>UI: Speak submission brief
  UI->>Browser: Start microphone recording
  Browser-->>UI: Audio blob
  UI->>Route: POST multipart audio
  Route->>SLNG: Forward audio with server-side key
  SLNG-->>Route: Transcript and model metadata
  Route->>Data: Match transcript to demo paper fields
  Data-->>Route: Paper title, field, author, institution, summary
  Route-->>UI: Structured intake record
  UI-->>Author: Show transcript and parsed paper record
```

## Sequence: Aida Question Answering

```mermaid
sequenceDiagram
  autonumber
  actor User as User
  participant UI as AidaAssistant
  participant Aida as Aida API route
  participant Corpus as openAccessCorpus
  participant OpenAlex as OpenAlex
  participant Tavily as Tavily
  participant Gemini as Gemini

  User->>UI: Select research question
  UI->>Aida: POST questionId
  Aida->>Aida: Apply refusal guard
  Aida->>Corpus: Retrieve legal open-access evidence
  Corpus->>OpenAlex: Search works
  OpenAlex-->>Corpus: Works and abstracts
  opt Evidence is too thin and Tavily is configured
    Corpus->>Tavily: Search and extract allowed source
    Tavily-->>Corpus: Extracted snippet
  end
  Corpus-->>Aida: Evidence snippets
  Aida->>Gemini: Ask with evidence-only prompt
  Gemini-->>Aida: JSON answer and citations
  Aida->>Aida: Validate citations against evidence set
  Aida-->>UI: Answer, coverage, confidence and citations
```

## Sequence: Superlinked Reviewer Matching

```mermaid
sequenceDiagram
  autonumber
  participant Caller as n8n or Peerflow UI
  participant Route as reviewer match route
  participant Pool as SIE pinned pool
  participant Data as app/data.ts
  participant SIE as Superlinked SIE

  Caller->>Route: POST paperId
  Route->>Data: Load paper and reviewer candidates
  Data-->>Route: Paper abstract, field, reviewer profiles
  opt SUPERLINKED_ADMIN_TOKEN is configured
    Route->>Pool: Request peerflow-reviewer-matching pool with pinned models
    Pool-->>Route: Pool routing path or fallback to default GPU
  end
  Route->>SIE: Embed paper title, abstract and field
  Route->>SIE: Embed reviewer expertise, institution and past topics
  SIE-->>Route: Similarity scores
  Route->>SIE: Rerank candidates with cross-encoder
  SIE-->>Route: Ranked matches
  Route-->>Caller: Top 3 reviewers with fit scores
```

## n8n Workflow Ownership

Live n8n canvas:
[peerflow.app.n8n.cloud/workflow/jzwLgV8qqsVSPM9u](https://peerflow.app.n8n.cloud/workflow/jzwLgV8qqsVSPM9u?projectId=7UmZAgpCylS4FmJs&uiContext=workflow_list).

```mermaid
flowchart LR
  Webhook["Webhook<br/>paper.submitted"]
  Validate["Validate event<br/>paper id<br/>callback URL"]
  UpsertAuthor["Attio<br/>upsert author"]
  UpsertInstitution["Attio<br/>upsert institution"]
  Match["Call reviewer matching<br/>Superlinked or Peerflow backend"]
  CreateTask["Attio<br/>create follow-up task"]
  UpdateStage["Set stage<br/>Reviewer matched"]
  Response["Return orchestration result"]

  Webhook --> Validate
  Validate --> UpsertAuthor
  Validate --> UpsertInstitution
  UpsertAuthor --> Match
  UpsertInstitution --> Match
  Match --> CreateTask
  CreateTask --> UpdateStage
  UpdateStage --> Response
```

## Paper State Diagram

```mermaid
stateDiagram-v2
  [*] --> IntakeQueued
  IntakeQueued --> VoiceParsed: SLNG intake parsed
  VoiceParsed --> Submitted: paper.submitted sent
  IntakeQueued --> Submitted: Run agent without voice
  Submitted --> CRMUpserted: n8n creates or updates Attio records
  CRMUpserted --> MatchingReviewers: n8n requests reviewer matching
  MatchingReviewers --> ReviewerMatched: top 3 reviewers returned
  ReviewerMatched --> OutreachCreated: n8n creates follow-up task
  OutreachCreated --> [*]

  Submitted --> DemoFallback: webhook unavailable or mock mode
  MatchingReviewers --> DemoFallback: Superlinked unavailable
  DemoFallback --> [*]
```

## Conceptual Data Model

```mermaid
erDiagram
  PAPER ||--o{ AGENT_RUN : "is processed by"
  PAPER ||--o{ REVIEWER_MATCH : "receives"
  PAPER }o--|| AUTHOR : "written by"
  AUTHOR }o--|| INSTITUTION : "belongs to"
  REVIEWER ||--o{ REVIEWER_MATCH : "is matched to"
  REVIEWER }o--|| INSTITUTION : "belongs to"
  PAPER ||--o{ CORPUS_ARTICLE : "can cite"
  AIDA_QUESTION ||--o{ CORPUS_ARTICLE : "retrieves"
  AGENT_RUN ||--o{ WORKFLOW_EVENT : "emits"

  PAPER {
    string id
    string title
    string source
    string field
    string licence
    string abstract
    string stage
  }

  AUTHOR {
    string name
    string email
    string institution
  }

  INSTITUTION {
    string name
    string domain
    string type
  }

  REVIEWER {
    string name
    string institution
    string speciality
    string pastTopics
    string availability
  }

  REVIEWER_MATCH {
    string paperId
    string reviewerName
    number fit
    string source
  }

  CORPUS_ARTICLE {
    string id
    string title
    string source
    string licence
    number year
    string evidence
    string url
  }

  AIDA_QUESTION {
    string id
    string question
    string searchQuery
    string confidence
    string coverage
  }

  AGENT_RUN {
    string id
    string paperId
    string mode
    string status
  }

  WORKFLOW_EVENT {
    string id
    string type
    string provider
    string status
  }
```

Current implementation note: the main app still uses static data and browser
state for most workflow data. This model is the natural durable schema for the
next build step, not a claim that every entity is persisted today.

## Trust Boundary and Secrets

```mermaid
flowchart TB
  subgraph Client["Browser trust zone"]
    UI["Rendered UI"]
    LocalState["Local component state"]
    Mic["Microphone audio blob"]
  end

  subgraph Server["Server trust zone"]
    Routes["API routes"]
    Env["Environment variables<br/>API keys and service URLs"]
    Guardrails["Validation<br/>allow-listed sources<br/>citation checks"]
  end

  subgraph Providers["Third-party providers"]
    Attio["Attio"]
    N8N["n8n"]
    SIE["Superlinked SIE"]
    SLNG["SLNG"]
    Gemini["Gemini"]
    Corpus["OpenAlex and Tavily"]
  end

  UI -->|"questionId<br/>paperId<br/>audio upload"| Routes
  Mic --> Routes
  Routes --> Env
  Routes --> Guardrails
  Routes --> Providers
  Providers --> Routes
  Routes -->|"sanitised response<br/>mode and source labels"| UI

  Env -.->|"never sent to browser"| UI
```

## Deployment and Runtime View

```mermaid
flowchart LR
  Dev["Developer machine<br/>npm run dev<br/>localhost:3000"]
  Build["Build pipeline<br/>npm run build<br/>vinext build"]
  Worker["Cloudflare Worker-compatible output<br/>worker/index.ts"]
  Sites["Sites hosting metadata<br/>.openai/hosting.json"]
  Browser["Judge browser"]
  External["External APIs<br/>Attio n8n SLNG Superlinked Gemini Tavily OpenAlex"]

  Dev --> Build
  Build --> Worker
  Build --> Sites
  Browser --> Worker
  Worker --> External
```

## Failure and Fallback Behaviour

```mermaid
flowchart TB
  Request["User action"]
  Route["Server route"]
  Credentials{"Required env vars present?"}
  Provider{"Provider responds successfully?"}
  Valid{"Response passes local validation?"}
  Live["Return live result<br/>mode live"]
  Mock["Return labelled fallback<br/>mode mock or fallback"]
  Refusal["Return refusal<br/>unsafe or unsupported request"]

  Request --> Route
  Route --> Credentials
  Credentials -->|"no"| Mock
  Credentials -->|"yes"| Provider
  Provider -->|"no"| Mock
  Provider -->|"yes"| Valid
  Valid -->|"yes"| Live
  Valid -->|"no"| Mock
  Route -->|"patient-specific treatment advice"| Refusal
```

## Demo Proof Map

```mermaid
flowchart LR
  SLNGProof["SLNG proof<br/>voice intake parsed by SLNG<br/>structured paper record"]
  N8NProof["n8n proof<br/>workflow canvas or execution log<br/>paper.submitted webhook"]
  AttioProof["Attio proof<br/>author and institution records<br/>follow-up task"]
  SuperlinkedProof["Superlinked proof<br/>top 3 semantic reviewer matches<br/>fit scores"]
  AidaProof["Aida proof<br/>answer with citations<br/>legal open-access evidence"]
  AikidoProof["Aikido proof<br/>security report link"]

  SLNGProof --> N8NProof
  N8NProof --> AttioProof
  N8NProof --> SuperlinkedProof
  SuperlinkedProof --> AttioProof
  AidaProof --> JudgeStory["Judge story<br/>reduced hallucination risk<br/>agentic CRM workflow"]
  AikidoProof --> JudgeStory
  AttioProof --> JudgeStory
```
