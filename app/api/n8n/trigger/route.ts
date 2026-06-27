import { papers } from "../../../data";

type N8nTriggerPayload = {
  event?: string;
  paperId?: string;
};

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.slice(0, 160) : fallback;
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

function baseUrlFor(request: Request) {
  return (
    process.env.PEERFLOW_PUBLIC_URL?.replace(/\/$/, "") ??
    new URL(request.url).origin
  );
}

function canN8nCloudReach(url: string) {
  try {
    const { hostname } = new URL(url);
    return !["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const payload = (await request.json().catch(() => null)) as
    | N8nTriggerPayload
    | null;
  const event = "paper.submitted";
  const paper =
    papers.find((candidate) => candidate.id === payload?.paperId) ?? papers[0];

  if (!webhookUrl) {
    return Response.json({
      mode: "mock",
      event,
      source: "Missing n8n webhook URL",
      runId: null,
      orchestrationOwner: "n8n",
      nextStage: "Reviewer matched",
    });
  }

  const runId = crypto.randomUUID();
  const baseUrl = baseUrlFor(request);
  const reviewerMatchEndpoint = `${baseUrl}/api/superlinked/match-reviewers`;
  const backendReachableFromN8n = canN8nCloudReach(baseUrl);
  const body = {
    event,
    eventId: runId,
    runId,
    occurredAt: new Date().toISOString(),
    source: "Peerflow",
    eventSource: textValue(payload?.event, event),
    paper: {
      id: paper.id,
      title: paper.title,
      author: paper.author,
      institution: paper.institution,
      field: paper.field,
      licence: paper.licence,
      source: paper.source,
      abstract: paper.abstract,
      stage: "Submitted",
      targetStage: "Reviewer matched",
    },
    attioRecords: {
      author: {
        name: paper.author,
        institution: paper.institution,
      },
      institution: {
        name: paper.institution,
      },
      paper: {
        externalId: paper.id,
        title: paper.title,
        field: paper.field,
        licence: paper.licence,
        source: paper.source,
        stage: "Submitted",
      },
      followUpTask: {
        title: `Review outreach for ${paper.title}`,
        status: "open",
      },
    },
    orchestration: {
      owner: "n8n",
      currentStage: "Submitted",
      targetStage: "Reviewer matched",
      requiredActions: [
        "attio.upsert_author",
        "attio.upsert_institution",
        "attio.upsert_paper",
        "superlinked.match_reviewers",
        "reviewer.outreach_or_follow_up_task",
        "paper.stage.update_reviewer_matched",
      ],
      backend: {
        reviewerMatches: {
          method: "POST",
          url: reviewerMatchEndpoint,
          body: {
            paperId: paper.id,
          },
          reachableFromN8nCloud: backendReachableFromN8n,
        },
      },
    },
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
        event,
        source: webhookFailureSource(webhookUrl, response.status),
        runId,
        orchestrationOwner: "n8n",
        nextStage: "Reviewer matched",
      });
    }

    return Response.json({
      mode: "live",
      event,
      source: "n8n webhook accepted workflow payload",
      runId,
      orchestrationOwner: "n8n",
      nextStage: "Reviewer matched",
    });
  } catch {
    return Response.json({
      mode: "mock",
      event,
      source: "n8n webhook request failed",
      runId,
      orchestrationOwner: "n8n",
      nextStage: "Reviewer matched",
    });
  }
}
