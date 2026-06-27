import { papers } from "../../../data";

const DEFAULT_SLNG_STT_URL =
  "https://api.slng.ai/v1/stt/slng/deepgram/nova:3-en";
const DEFAULT_TRANSCRIPT =
  "I want to submit a paper about clinical AI retrieval";

type SlngJson = {
  confidence?: number;
  language?: string;
  metadata?: {
    model?: string;
    request_id?: string;
  };
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        confidence?: number;
        transcript?: string;
      }>;
    }>;
  };
  text?: string;
  transcript?: string;
};

function words(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

function transcriptFromSlng(data: SlngJson) {
  return (
    data.transcript ??
    data.text ??
    data.results?.channels?.[0]?.alternatives?.[0]?.transcript ??
    ""
  ).trim();
}

function confidenceFromSlng(data: SlngJson) {
  return (
    data.confidence ??
    data.results?.channels?.[0]?.alternatives?.[0]?.confidence ??
    null
  );
}

function bestPaperFor(transcript: string) {
  const transcriptWords = new Set(words(transcript));
  const ranked = papers.map((paper) => {
    const profile = [
      paper.title,
      paper.field,
      paper.author,
      paper.institution,
      paper.abstract,
    ].join(" ");
    const score = words(profile).filter((word) => transcriptWords.has(word))
      .length;

    return { paper, score };
  });

  ranked.sort((left, right) => right.score - left.score);
  return ranked[0]?.paper ?? papers[0];
}

function structuredRecord(transcript: string) {
  const paper = bestPaperFor(transcript);

  return {
    author: paper.author,
    field: paper.field,
    institution: paper.institution,
    paperId: paper.id,
    summary: paper.abstract,
    title: paper.title,
  };
}

function fallbackResponse(source: string, transcript = DEFAULT_TRANSCRIPT) {
  return Response.json({
    mode: "mock",
    record: structuredRecord(transcript),
    slng: {
      confidence: null,
      language: process.env.SLNG_LANGUAGE ?? "en",
      model: "fallback",
      requestId: null,
    },
    source,
    transcript,
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const apiKey = process.env.SLNG_API_KEY;
  const endpoint = process.env.SLNG_STT_URL ?? DEFAULT_SLNG_STT_URL;
  const language = process.env.SLNG_LANGUAGE ?? "en";

  if (!contentType.includes("multipart/form-data")) {
    return fallbackResponse("No voice recording supplied; parsed sample intake");
  }

  const formData = await request.formData();
  const audio = formData.get("audio");
  const fallbackTranscript =
    typeof formData.get("fallbackTranscript") === "string"
      ? String(formData.get("fallbackTranscript"))
      : DEFAULT_TRANSCRIPT;

  if (!(audio instanceof File) || audio.size === 0) {
    return fallbackResponse("No voice recording supplied; parsed sample intake");
  }

  if (!apiKey) {
    return fallbackResponse(
      "Missing SLNG_API_KEY; parsed sample intake without external transcription",
      fallbackTranscript,
    );
  }

  const upstream = new FormData();
  upstream.append("audio", audio, audio.name || "peerflow-voice-intake.webm");
  upstream.append("language", language);

  try {
    const response = await fetch(endpoint, {
      body: upstream,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      method: "POST",
    });

    const text = await response.text();
    const data = text ? (JSON.parse(text) as SlngJson) : {};

    if (!response.ok) {
      return fallbackResponse(
        `SLNG returned ${response.status}; parsed sample intake fallback`,
        fallbackTranscript,
      );
    }

    const transcript = transcriptFromSlng(data);

    if (!transcript) {
      return fallbackResponse(
        "SLNG returned no transcript; parsed sample intake fallback",
        fallbackTranscript,
      );
    }

    return Response.json({
      mode: "live",
      record: structuredRecord(transcript),
      slng: {
        confidence: confidenceFromSlng(data),
        language: data.language ?? language,
        model: data.metadata?.model ?? "nova-3",
        requestId: data.metadata?.request_id ?? null,
      },
      source: "SLNG STT via Deepgram Nova 3 English",
      transcript,
    });
  } catch {
    return fallbackResponse(
      "SLNG request failed; parsed sample intake fallback",
      fallbackTranscript,
    );
  }
}
