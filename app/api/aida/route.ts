import { aidaQuestions, corpusArticles } from "../../data";

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    message?: string;
  };
};

type AidaLiveAnswer = {
  answer: string;
  confidence: string;
  coverage: string;
  citations: string[];
  mode: "live" | "mock" | "refused";
  source: string;
};

function fallbackFor(questionId: string, mode: AidaLiveAnswer["mode"], source: string) {
  const question =
    aidaQuestions.find((candidate) => candidate.id === questionId) ??
    aidaQuestions[0];

  return {
    answer: question.answer,
    confidence: question.confidence,
    coverage: question.coverage,
    citations: question.citations,
    mode,
    source,
  } satisfies AidaLiveAnswer;
}

function parseJsonAnswer(text: string) {
  try {
    return JSON.parse(text) as Partial<AidaLiveAnswer>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]) as Partial<AidaLiveAnswer>;
    } catch {
      return null;
    }
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    questionId?: string;
  } | null;
  const questionId = payload?.questionId ?? aidaQuestions[0].id;
  const question =
    aidaQuestions.find((candidate) => candidate.id === questionId) ??
    aidaQuestions[0];

  if (question.citations.length === 0) {
    return Response.json(
      fallbackFor(question.id, "refused", "No supporting corpus passages"),
    );
  }

  const apiKey = process.env.AIDA_MODEL_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(fallbackFor(question.id, "mock", "Missing Gemini key"));
  }

  const model = process.env.AIDA_GEMINI_MODEL ?? "gemini-3.5-flash";
  const citedArticles = question.citations
    .map((citation) =>
      corpusArticles.find((article) => article.id === citation),
    )
    .filter((article): article is (typeof corpusArticles)[number] =>
      Boolean(article),
    );
  const evidence = citedArticles
    .map(
      (article) =>
        `[${article.id}] ${article.title} (${article.source}, ${article.year}). ${article.evidence}`,
    )
    .join("\n");

  const prompt = `You are Aida, a research assistant for Peerflow.

Answer the question using only the evidence below. Do not use outside knowledge.
If the evidence is insufficient, say that Aida cannot answer from the current corpus.
Return only JSON with these fields: answer, confidence, coverage, citations.
The citations field must contain only IDs from the evidence, for example ["C1"].

Question: ${question.question}

Evidence:
${evidence}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    return Response.json(
      fallbackFor(question.id, "mock", "Gemini request failed"),
      { status: 200 },
    );
  }

  const data = (await response.json()) as GeminiResponse;
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";
  const parsed = parseJsonAnswer(text);
  const allowedCitations = new Set(question.citations);
  const citations = Array.isArray(parsed?.citations)
    ? parsed.citations.filter(
        (citation): citation is string =>
          typeof citation === "string" && allowedCitations.has(citation),
      )
    : [];

  if (!parsed?.answer || citations.length === 0) {
    return Response.json(
      fallbackFor(question.id, "mock", "Gemini returned no cited answer"),
    );
  }

  const confidence = String(parsed.confidence ?? question.confidence);
  const coverage = String(parsed.coverage ?? "");

  return Response.json({
    answer: String(parsed.answer),
    confidence: /^\d+(\.\d+)?$/.test(confidence)
      ? question.confidence
      : confidence,
    coverage: /^\d+$/.test(coverage)
      ? `${coverage} cited ${coverage === "1" ? "passage" : "passages"}`
      : coverage || `${citations.length} cited passages`,
    citations,
    mode: "live",
    source: model,
  } satisfies AidaLiveAnswer);
}
