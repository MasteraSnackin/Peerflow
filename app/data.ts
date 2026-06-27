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
  fit: number;
  availability: string;
};

export type WorkflowStep = {
  id: string;
  title: string;
  owner: string;
  detail: string;
};

export type IntegrationStatus = {
  service: string;
  purpose: string;
  keys: string[];
  configured: boolean;
  statusLabel: string;
};

export type CorpusArticle = {
  id: string;
  title: string;
  source: string;
  licence: string;
  year: string;
  evidence: string;
};

export type AidaQuestion = {
  id: string;
  question: string;
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
    fit: 94,
    availability: "2 reviews open",
  },
  {
    name: "Tom Reeve",
    institution: "Oxford Internet Institute",
    speciality: "AI governance",
    fit: 88,
    availability: "Available this week",
  },
  {
    name: "Elena Varga",
    institution: "Cambridge Machine Learning Group",
    speciality: "Multimodal benchmarks",
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
    title: "Parse voice or text intake",
    owner: "SLNG",
    detail:
      "Convert author intent into a structured submission brief with paper title, field and contact details.",
  },
  {
    id: "crm",
    title: "Validate research CRM workspace",
    owner: "Attio",
    detail:
      "Confirm the Attio workspace is reachable, then prepare the author, institution, paper and review-stage record preview.",
  },
  {
    id: "match",
    title: "Match peer reviewers",
    owner: "Superlinked",
    detail:
      "Run semantic matching between the abstract, reviewer expertise and current review load.",
  },
  {
    id: "workflow",
    title: "Move the review pipeline",
    owner: "n8n",
    detail:
      "Trigger reviewer outreach, create follow-up tasks and move the submission to reviewer matched.",
  },
  {
    id: "security",
    title: "Attach security evidence",
    owner: "Aikido",
    detail:
      "Surface the latest repository security status so the build is demo-ready for the side challenge.",
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
    question: "How could multimodal retrieval reduce clinical review work?",
    answer:
      "Aida found evidence that combining images, notes and trial metadata can reduce manual triage by bringing related clinical evidence into one retrieval workflow. The answer is limited to retrieval support, not diagnosis.",
    confidence: "High",
    coverage: "2 cited passages",
    citations: ["C1", "C3"],
  },
  {
    id: "model-routing",
    question: "When should we avoid using a frontier model?",
    answer:
      "The corpus supports using smaller models for routine document review when the task has quality thresholds, audit logs and a feedback loop. Aida would escalate to a stronger model when uncertainty or safety risk rises.",
    confidence: "Medium",
    coverage: "2 cited passages",
    citations: ["C2", "C3"],
  },
  {
    id: "insufficient",
    question: "Which treatment should a patient choose?",
    answer:
      "Aida cannot answer this from the current corpus. The available papers discuss retrieval, routing and lab-agent memory, but they do not provide patient-specific treatment evidence.",
    confidence: "Insufficient evidence",
    coverage: "0 supporting passages",
    citations: [],
  },
];
