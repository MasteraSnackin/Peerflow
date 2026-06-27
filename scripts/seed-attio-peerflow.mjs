import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf8");
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) {
      continue;
    }
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const apiKey = process.env.ATTIO_API_KEY;
if (!apiKey) {
  throw new Error("ATTIO_API_KEY is missing");
}

const papers = [
  {
    id: "paper-01",
    title: "Efficient multimodal retrieval for clinical research triage",
    source: "arXiv + OpenAlex",
    author: "Dr Maya Singh",
    institution: "UCL AI Centre",
    field: "Clinical AI",
    licence: "Open access preprint",
  },
  {
    id: "paper-02",
    title: "Low-cost model routing for public sector document review",
    source: "Semantic Scholar",
    author: "Nadia Kolbe",
    institution: "Civic AI Lab",
    field: "Public sector AI",
    licence: "Author submitted manuscript",
  },
  {
    id: "paper-03",
    title: "Continual memory for collaborative lab assistants",
    source: "PubMed Central",
    author: "Prof. Leon Hart",
    institution: "King's College London",
    field: "Research agents",
    licence: "PMC open-access article",
  },
];

function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 64) || "peerflow"
  );
}

function authorEmail(paper) {
  return `${slugify(paper.author)}.${paper.id}@example.com`;
}

function institutionDomain(paper) {
  return `${slugify(paper.institution)}-peerflow.dev`;
}

function personName(fullName) {
  const clean = fullName.replace(/^(dr|prof)\.?\s+/i, "").trim();
  const parts = clean.split(/\s+/);
  return {
    first_name: parts[0] ?? clean,
    last_name: parts.slice(1).join(" ") || null,
    full_name: fullName,
  };
}

async function attio(method, endpoint, body) {
  const response = await fetch(`https://api.attio.com/v2${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }

  if (!response.ok) {
    const message = json?.message ?? json?.error ?? text.slice(0, 300);
    throw new Error(`${method} ${endpoint} returned ${response.status}: ${message}`);
  }

  return json;
}

async function upsertCompany(paper) {
  const domain = institutionDomain(paper);
  const response = await attio(
    "PUT",
    "/objects/companies/records?matching_attribute=domains",
    {
      data: {
        values: {
          domains: [domain],
          name: paper.institution,
          description: `Peerflow hackathon demo institution for ${paper.title}. Source: ${paper.source}. Licence: ${paper.licence}.`,
        },
      },
    },
  );

  return {
    domain,
    recordId: response.data?.id?.record_id,
    webUrl: response.data?.web_url,
  };
}

async function upsertPerson(paper) {
  const email = authorEmail(paper);
  const response = await attio(
    "PUT",
    "/objects/people/records?matching_attribute=email_addresses",
    {
      data: {
        values: {
          email_addresses: [email],
          name: [personName(paper.author)],
          description: `Peerflow hackathon demo author. Paper: ${paper.title}. Field: ${paper.field}. Target stage: Reviewer matched.`,
        },
      },
    },
  );

  return {
    email,
    recordId: response.data?.id?.record_id,
    webUrl: response.data?.web_url,
  };
}

async function createTask(paper, company, person) {
  const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const response = await attio("POST", "/tasks", {
    data: {
      content: [
        `Peerflow reviewer outreach: ${paper.title}`,
        `Author: ${paper.author}`,
        `Institution: ${paper.institution}`,
        `Field: ${paper.field}`,
        "Stage: Reviewer matched",
        "Next step: contact top reviewer candidates and log response.",
      ].join("\n"),
      format: "plaintext",
      deadline_at: due,
      is_completed: false,
      assignees: [],
      linked_records: [
        {
          target_object: "people",
          target_record_id: person.recordId,
        },
        {
          target_object: "companies",
          target_record_id: company.recordId,
        },
      ],
    },
  });

  return {
    taskId: response.data?.id?.task_id,
    deadlineAt: response.data?.deadline_at,
  };
}

const results = [];
for (const paper of papers) {
  const company = await upsertCompany(paper);
  const person = await upsertPerson(paper);
  const task = await createTask(paper, company, person);
  results.push({
    paperId: paper.id,
    company,
    person,
    task,
  });
}

console.log(
  JSON.stringify(
    {
      mode: "live",
      source: "Attio REST API",
      action: "seeded Peerflow CRM sequence",
      records: results,
    },
    null,
    2,
  ),
);
