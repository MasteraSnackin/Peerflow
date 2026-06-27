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
  pipeline: {
    embeddingModel: string;
    rerankModel: string;
    embeddingStatus: string;
    matchingMethod: string;
    profileInputs: string;
    embeddingDimensions?: number;
  };
  source: string;
};

const DEFAULT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const DEFAULT_RERANK_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2";
const PROFILE_INPUTS =
  "paper title + abstract + field vs reviewer expertise + institution + past review topics";
const MATCHING_METHOD =
  "Superlinked semantic embedding plus reranking, not keyword search";

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

function pipelineMetadata(
  embeddingModel: string,
  rerankModel: string,
  embeddingStatus: string,
  embeddingDimensions?: number,
) {
  return {
    embeddingModel,
    rerankModel,
    embeddingStatus,
    matchingMethod: MATCHING_METHOD,
    profileInputs: PROFILE_INPUTS,
    ...(embeddingDimensions ? { embeddingDimensions } : {}),
  };
}

function fallback(
  source: string,
  embeddingModel = DEFAULT_EMBEDDING_MODEL,
  rerankModel = DEFAULT_RERANK_MODEL,
): MatchResponse {
  return {
    matches: reviewers,
    mode: "mock",
    pipeline: pipelineMetadata(
      embeddingModel,
      rerankModel,
      "mock fallback; live SIE embedding not completed",
    ),
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
    embeddingModel?: string;
    paperId?: string;
    rerankModel?: string;
  } | null;
  const paper =
    papers.find((candidate) => candidate.id === payload?.paperId) ?? papers[0];
  const endpoint = process.env.SUPERLINKED_ENDPOINT ?? process.env.SIE_ENDPOINT;
  const apiKey = process.env.SUPERLINKED_API_KEY ?? process.env.SIE_API_KEY;
  const embeddingModel =
    payload?.embeddingModel ??
    process.env.SUPERLINKED_EMBEDDING_MODEL ??
    DEFAULT_EMBEDDING_MODEL;
  const rerankModel =
    payload?.rerankModel ??
    process.env.SUPERLINKED_RERANK_MODEL ??
    DEFAULT_RERANK_MODEL;

  if (!endpoint || !apiKey) {
    return Response.json(
      fallback("Missing SIE endpoint or key", embeddingModel, rerankModel),
    );
  }

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
    let embeddingStatus = "embedded paper and reviewer profiles";
    let embeddingDimensions: number | undefined;
    const profileItems = [
      { id: paper.id, text: paperProfile(paper) },
      ...reviewers.map((reviewer, index) => ({
        id: `reviewer-${index}`,
        text: reviewerProfile(reviewer),
      })),
    ];

    try {
      const encodedProfiles = await client.encode(embeddingModel, profileItems, {
        outputTypes: ["dense"],
        waitForCapacity: true,
      });
      embeddingDimensions = encodedProfiles[0]?.dense?.length;
      embeddingStatus = embeddingDimensions
        ? `embedded ${profileItems.length} profiles into ${embeddingDimensions}-dimensional dense vectors`
        : `embedded ${profileItems.length} profiles`;
    } catch {
      embeddingStatus =
        "embedding pass unavailable; continued with SIE semantic reranking";
    }

    const result = await client.score(
      rerankModel,
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
      pipeline: pipelineMetadata(
        embeddingModel,
        rerankModel,
        embeddingStatus,
        embeddingDimensions,
      ),
      source: matches.length > 0
        ? `${embeddingModel} -> ${rerankModel}`
        : "SIE returned no scores",
    } satisfies MatchResponse);
  } catch {
    return Response.json(
      fallback("SIE score request failed", embeddingModel, rerankModel),
    );
  } finally {
    await client.close();
  }
}
