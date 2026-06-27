import { papers } from "../../../data";

type N8nTriggerPayload = {
  paperId?: string;
  stage?: string;
  reviewers?: Array<{
    name: string;
    institution: string;
    speciality: string;
    fit: number;
  }>;
};

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.slice(0, 160) : fallback;
}

function fitValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

function webhookFailureSource(webhookUrl: string, status: number) {
  if (status === 404 && webhookUrl.includes("/webhook-test/")) {
    return "n8n test webhook returned 404; click Execute workflow or use the production /webhook URL";
  }

  if (status === 404) {
    return "n8n webhook returned 404; verify the workflow is active and the production URL is correct";
  }

  return `n8n webhook returned ${status}`;
}

export async function POST(request: Request) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const payload = (await request.json().catch(() => null)) as
    | N8nTriggerPayload
    | null;
  const paper =
    papers.find((candidate) => candidate.id === payload?.paperId) ?? papers[0];

  if (!webhookUrl) {
    return Response.json({
      mode: "mock",
      source: "Missing n8n webhook URL",
      runId: null,
    });
  }

  const runId = crypto.randomUUID();
  const reviewers = (payload?.reviewers ?? []).slice(0, 5).map((reviewer) => ({
    name: textValue(reviewer.name, "Unknown reviewer"),
    institution: textValue(reviewer.institution),
    speciality: textValue(reviewer.speciality),
    fit: fitValue(reviewer.fit),
  }));
  const body = {
    runId,
    source: "Peerflow",
    stage: textValue(payload?.stage, "reviewer-matched"),
    paper: {
      id: paper.id,
      title: paper.title,
      author: paper.author,
      institution: paper.institution,
      field: paper.field,
      licence: paper.licence,
      source: paper.source,
    },
    reviewers,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return Response.json({
        mode: "mock",
        source: webhookFailureSource(webhookUrl, response.status),
        runId,
      });
    }

    return Response.json({
      mode: "live",
      source: "n8n webhook accepted workflow payload",
      runId,
    });
  } catch {
    return Response.json({
      mode: "mock",
      source: "n8n webhook request failed",
      runId,
    });
  }
}
