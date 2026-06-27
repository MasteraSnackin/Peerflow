export type Paper = {
  id: string;
  title: string;
  source: string;
  author: string;
  institution: string;
  field: string;
  licence: string;
  abstract: string;
};

export type Reviewer = {
  name: string;
  institution: string;
  speciality: string;
  pastTopics: string[];
  fit: number;
  availability: string;
};

export type WorkflowStep = {
  id: string;
  title: string;
  owner: string;
  detail: string;
};

export type N8nOrchestrationStep = {
  title: string;
  detail: string;
};

export type IntegrationStatus = {
  service: string;
  purpose: string;
  keys: string[];
  configured: boolean;
  statusLabel: string;
  actionLabel?: string;
  actionUrl?: string;
};

export type CorpusArticle = {
  id: string;
  title: string;
  source: string;
  licence: string;
  year: string;
  evidence: string;
  url?: string;
  authors?: string;
};

export type AidaQuestion = {
  id: string;
  question: string;
  searchQuery?: string;
  answer: string;
  confidence: string;
  coverage: string;
  citations: string[];
};

export const papers: Paper[] = [
  {
    id: "paper-01",
    title: "Efficient multimodal retrieval for clinical research triage",
    source: "arXiv + OpenAlex",
    author: "Dr Maya Singh",
    institution: "UCL AI Centre",
    field: "Clinical AI",
    licence: "Open access preprint",
    abstract:
      "A retrieval pipeline that links medical images, notes and trial metadata to speed up clinical evidence review.",
  },
  {
    id: "paper-02",
    title: "Low-cost model routing for public sector document review",
    source: "Semantic Scholar",
    author: "Nadia Kolbe",
    institution: "Civic AI Lab",
    field: "Public sector AI",
    licence: "Author submitted manuscript",
    abstract:
      "A benchmark for routing review tasks to smaller language models while preserving auditability and quality.",
  },
  {
    id: "paper-03",
    title: "Continual memory for collaborative lab assistants",
    source: "PubMed Central",
    author: "Prof. Leon Hart",
    institution: "King's College London",
    field: "Research agents",
    licence: "PMC open-access article",
    abstract:
      "An evaluation of agent memory in shared lab work, including provenance, consent and reviewer feedback loops.",
  },
];

export const reviewers: Reviewer[] = [
  {
    name: "Amara Osei",
    institution: "Imperial College London",
    speciality: "Clinical retrieval",
    pastTopics: [
      "multimodal medical retrieval",
      "clinical evidence triage",
      "healthcare benchmark review",
    ],
    fit: 94,
    availability: "2 reviews open",
  },
  {
    name: "Tom Reeve",
    institution: "Oxford Internet Institute",
    speciality: "AI governance",
    pastTopics: [
      "public sector model routing",
      "auditability",
      "risk review workflows",
    ],
    fit: 88,
    availability: "Available this week",
  },
  {
    name: "Elena Varga",
    institution: "Cambridge Machine Learning Group",
    speciality: "Multimodal benchmarks",
    pastTopics: [
      "multimodal evaluation",
      "retrieval benchmarks",
      "dataset quality",
    ],
    fit: 83,
    availability: "1 review open",
  },
];

export const workflowSteps: WorkflowStep[] = [
  {
    id: "source",
    title: "Check open-access source",
    owner: "OpenAlex and Unpaywall",
    detail:
      "Confirm the paper is legal to index and store only metadata, abstracts and authorised links.",
  },
  {
    id: "voice",
    title: "Voice intake parsed by SLNG",
    owner: "SLNG",
    detail:
      'Author says, "I want to submit a paper about clinical AI retrieval." SLNG turns that into structured text, then Peerflow extracts title, field, author, institution and summary for the paper intake record.',
  },
  {
    id: "submit",
    title: "Emit paper.submitted",
    owner: "Peerflow -> n8n",
    detail:
      "Peerflow sends exactly one webhook event to n8n with the paper, author, CRM record preview and backend callback URL.",
  },
  {
    id: "crm",
    title: "Create or update CRM records",
    owner: "n8n -> Attio",
    detail:
      "n8n creates or updates the author and institution records in Attio, while carrying paper stage in the orchestration payload.",
  },
  {
    id: "match",
    title: "Semantic reviewer matching",
    owner: "n8n -> Superlinked",
    detail:
      "Superlinked embeds paper title, abstract and field with all-MiniLM-L6-v2, embeds reviewer expertise, institution and past review topics, then reranks with ms-marco-MiniLM-L-6-v2 and returns the top 3 reviewer matches with fit scores.",
  },
  {
    id: "outreach",
    title: "Create reviewer outreach",
    owner: "n8n",
    detail:
      "n8n pushes the top reviewer matches into the Attio follow-up task for the editorial team.",
  },
  {
    id: "stage",
    title: "Update paper stage",
    owner: "n8n",
    detail:
      "n8n updates the submission stage to Reviewer matched after matching and outreach are queued.",
  },
  {
    id: "security",
    title: "Attach security evidence",
    owner: "Aikido",
    detail:
      "Surface the latest repository security status so the build is demo-ready for the side challenge.",
  },
];

export const n8nOrchestrationSteps: N8nOrchestrationStep[] = [
  {
    title: "Peerflow emits paper.submitted",
    detail: "Peerflow sends exactly one webhook event for the selected paper.",
  },
  {
    title: "n8n receives the event",
    detail: "The webhook validates the payload and becomes the workflow owner.",
  },
  {
    title: "n8n calls Attio",
    detail: "n8n creates or updates author and institution records.",
  },
  {
    title: "n8n gets reviewer matches",
    detail: "n8n calls Peerflow's Superlinked backend or Superlinked directly.",
  },
  {
    title: "n8n creates outreach",
    detail: "n8n writes reviewer outreach or follow-up tasks with match scores.",
  },
  {
    title: "n8n updates the paper stage",
    detail: "The final workflow state is Reviewer matched.",
  },
];

export const corpusArticles: CorpusArticle[] = [
  {
    id: "C1",
    title: "Efficient multimodal retrieval for clinical research triage",
    source: "arXiv + OpenAlex",
    licence: "Open access preprint",
    year: "2026",
    evidence:
      "Links medical images, notes and trial metadata to reduce manual clinical evidence review time.",
  },
  {
    id: "C2",
    title: "Low-cost model routing for public sector document review",
    source: "Semantic Scholar",
    licence: "Author submitted manuscript",
    year: "2025",
    evidence:
      "Shows that smaller language models can clear routine review tasks when routing includes quality thresholds and audit logs.",
  },
  {
    id: "C3",
    title: "Continual memory for collaborative lab assistants",
    source: "PubMed Central",
    licence: "PMC open-access article",
    year: "2026",
    evidence:
      "Evaluates agent memory with provenance, consent and reviewer feedback loops for shared lab work.",
  },
];

export const aidaQuestions: AidaQuestion[] = [
  {
    id: "clinical-triage",
    question:
      "Why is multimodal medical image retrieval useful for clinical practice and research?",
    searchQuery:
      "multimodal retrieval clinical evidence review medical images notes trial metadata",
    answer:
      "Aida found evidence that multimodal medical image retrieval can help researchers work with heterogeneous image data across clinical practice and research. The answer is limited to retrieval support, not diagnosis.",
    confidence: "High",
    coverage: "2 cited passages",
    citations: ["C1", "C3"],
  },
  {
    id: "model-routing",
    question: "When should we avoid using a frontier model?",
    searchQuery:
      "small language model routing document review quality thresholds audit logs",
    answer:
      "The corpus supports using smaller models for routine document review when the task has quality thresholds, audit logs and a feedback loop. Aida would escalate to a stronger model when uncertainty or safety risk rises.",
    confidence: "Medium",
    coverage: "2 cited passages",
    citations: ["C2", "C3"],
  },
  {
    id: "insufficient",
    question: "Which treatment should a patient choose?",
    searchQuery:
      "patient specific treatment choice clinical guideline evidence safety",
    answer:
      "Aida cannot answer this from the current corpus. The available papers discuss retrieval, routing and lab-agent memory, but they do not provide patient-specific treatment evidence.",
    confidence: "Insufficient evidence",
    coverage: "0 supporting passages",
    citations: [],
  },
];
