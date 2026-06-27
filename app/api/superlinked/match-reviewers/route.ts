import { SIEClient } from "@superlinked/sie-sdk";
import { papers, reviewers } from "../../../data";

type ReviewerMatch = {
  name: string;
  institution: string;
  speciality: string;
  fit: number;
  availability: string;
  rawScore?: number;
};

type MatchResponse = {
  matches: ReviewerMatch[];
  mode: "live" | "mock";
  source: string;
};

function reviewerProfile(reviewer: (typeof reviewers)[number]) {
  return [
    reviewer.name,
    reviewer.institution,
    reviewer.speciality,
    reviewer.availability,
    `Past review topics: ${reviewer.pastTopics.join(", ")}`,
  ].join(". ");
}

function paperProfile(paper: (typeof papers)[number]) {
  return [
    paper.title,
    paper.field,
    paper.source,
    paper.licence,
    paper.abstract,
  ].join(". ");
}

function fallback(source: string): MatchResponse {
  return {
    matches: reviewers,
    mode: "mock",
    source,
  };
}

function scoreToFit(score: number, minScore: number, maxScore: number) {
  if (maxScore === minScore) {
    return 86;
  }
  const normalised = (score - minScore) / (maxScore - minScore);
  return Math.round(78 + normalised * 18);
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    paperId?: string;
  } | null;
  const paper =
    papers.find((candidate) => candidate.id === payload?.paperId) ?? papers[0];
  const endpoint = process.env.SUPERLINKED_ENDPOINT ?? process.env.SIE_ENDPOINT;
  const apiKey = process.env.SUPERLINKED_API_KEY ?? process.env.SIE_API_KEY;

  if (!endpoint || !apiKey) {
    return Response.json(fallback("Missing SIE endpoint or key"));
  }

  const model =
    process.env.SUPERLINKED_RERANK_MODEL ??
    "cross-encoder/ms-marco-MiniLM-L-6-v2";
  const client = new SIEClient(endpoint, {
    apiKey,
    gpu: process.env.SUPERLINKED_GPU ?? "l4",
    timeout: Number(process.env.SUPERLINKED_TIMEOUT_MS ?? 45000),
    waitForCapacity: true,
    provisionTimeout: Number(
      process.env.SUPERLINKED_PROVISION_TIMEOUT_MS ?? 90000,
    ),
  });

  try {
    const result = await client.score(
      model,
      { id: paper.id, text: paperProfile(paper) },
      reviewers.map((reviewer, index) => ({
        id: String(index),
        text: reviewerProfile(reviewer),
      })),
      { waitForCapacity: true },
    );

    const rawScores = result.scores.map((entry) => entry.score);
    const minScore = Math.min(...rawScores);
    const maxScore = Math.max(...rawScores);
    const matches = result.scores
      .map((entry) => {
        const reviewer = reviewers[Number(entry.itemId)];
        if (!reviewer) {
          return null;
        }
        return {
          ...reviewer,
          fit: scoreToFit(entry.score, minScore, maxScore),
          rawScore: Number(entry.score.toFixed(4)),
        };
      })
      .filter((match): match is ReviewerMatch => Boolean(match));

    return Response.json({
      matches: matches.length > 0 ? matches : reviewers,
      mode: matches.length > 0 ? "live" : "mock",
      source: matches.length > 0 ? model : "SIE returned no scores",
    } satisfies MatchResponse);
  } catch {
    return Response.json(fallback("SIE score request failed"));
  } finally {
    await client.close();
  }
}
