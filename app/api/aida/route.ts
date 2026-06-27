import {
  aidaQuestions,
  type CorpusArticle,
} from "../../data";
import {
  queryForQuestion,
  retrieveOpenAccessCorpus,
  staticArticlesForQuestion,
} from "../../lib/openAccessCorpus";

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
  query: string;
  articles: CorpusArticle[];
  providerStatuses?: string[];
};

function fallbackFor(
  questionId: string,
  mode: AidaLiveAnswer["mode"],
  source: string,
  articles?: CorpusArticle[],
  query = "",
  providerStatuses?: string[],
) {
  const question =
    aidaQuestions.find((candidate) => candidate.id === questionId) ??
    aidaQuestions[0];
  const citedArticles = articles ?? staticArticlesForQuestion(question);
  const usedLiveArticles = Boolean(articles?.length);

  return {
    answer: usedLiveArticles
      ? "Aida retrieved live open-access evidence for this question, but the model was unavailable or returned an uncited answer. The cited article cards below are shown as evidence, and Aida is not making a new claim beyond those snippets."
      : question.answer,
    confidence: usedLiveArticles ? "Evidence retrieved" : question.confidence,
    coverage: usedLiveArticles
      ? `${citedArticles.length} live cited ${
          citedArticles.length === 1 ? "passage" : "passages"
        }`
      : question.coverage,
    citations: usedLiveArticles
      ? citedArticles.map((article) => article.id)
      : question.citations,
    mode,
    source,
    query,
    articles: citedArticles,
    providerStatuses,
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

function normaliseCitation(value: unknown, allowedCitations: Set<string>) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const raw = String(value).trim().toUpperCase();
  const direct = raw.replace(/\s+/g, "");
  if (allowedCitations.has(direct)) {
    return direct;
  }

  const prefixed = direct.match(/\b(OA|TV)[-#]?(\d+)\b/);
  if (prefixed) {
    const candidate = `${prefixed[1]}${Number(prefixed[2])}`;
    return allowedCitations.has(candidate) ? candidate : null;
  }

  const numeric = direct.match(/^\[?(\d+)\]?$/);
  if (numeric) {
    const openAlexCandidate = `OA${Number(numeric[1])}`;
    const tavilyCandidate = `TV${Number(numeric[1])}`;
    if (allowedCitations.has(openAlexCandidate)) {
      return openAlexCandidate;
    }

    if (allowedCitations.has(tavilyCandidate)) {
      return tavilyCandidate;
    }
  }

  return null;
}

function extractCitations(
  parsed: Partial<AidaLiveAnswer> | null,
  rawText: string,
  allowedCitations: Set<string>,
) {
  const fromJson = Array.isArray(parsed?.citations)
    ? parsed.citations
        .map((citation) => normaliseCitation(citation, allowedCitations))
        .filter((citation): citation is string => Boolean(citation))
    : [];
  const fromText = Array.from(rawText.matchAll(/\b(?:OA|TV)\s*[-#]?\d+\b/gi))
    .map((match) => normaliseCitation(match[0], allowedCitations))
    .filter((citation): citation is string => Boolean(citation));

  return Array.from(new Set([...fromJson, ...fromText]));
}

function isPatientSpecificMedicalQuestion(question: string) {
  const normalised = question.toLowerCase();
  return normalised.includes("patient") && normalised.includes("treatment");
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    questionId?: string;
  } | null;
  const questionId = payload?.questionId ?? aidaQuestions[0].id;
  const question =
    aidaQuestions.find((candidate) => candidate.id === questionId) ??
    aidaQuestions[0];
  const query = queryForQuestion(question);

  if (isPatientSpecificMedicalQuestion(question.question)) {
    return Response.json(
      fallbackFor(
        question.id,
        "refused",
        "Patient-specific treatment advice is outside Aida's safe scope",
        [],
        query,
      ),
    );
  }

  const corpus = await retrieveOpenAccessCorpus(query, {
    fallbackArticles: staticArticlesForQuestion(question),
    maxResults: 4,
  });
  const citedArticles = corpus.articles;

  if (citedArticles.length === 0) {
    return Response.json(
      fallbackFor(
        question.id,
        "refused",
        "No supporting open-access corpus passages",
        [],
        corpus.query,
        corpus.providerStatuses,
      ),
    );
  }

  const apiKey = process.env.AIDA_MODEL_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      fallbackFor(
        question.id,
        "mock",
        "Missing Gemini key",
        citedArticles,
        corpus.query,
        corpus.providerStatuses,
      ),
    );
  }

  const model = process.env.AIDA_GEMINI_MODEL ?? "gemini-3.5-flash";
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
The citations field must contain at least one exact ID from this list: ${citedArticles.map((article) => article.id).join(", ")}.
Example citation format: ["${citedArticles[0].id}"].

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
      fallbackFor(
        question.id,
        "mock",
        "Gemini request failed",
        citedArticles,
        corpus.query,
        corpus.providerStatuses,
      ),
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
  const allowedCitations = new Set(citedArticles.map((article) => article.id));
  const citations = extractCitations(parsed, text, allowedCitations);

  if (!parsed?.answer || citations.length === 0) {
    return Response.json(
      fallbackFor(
        question.id,
        "mock",
        "Gemini returned no cited answer",
        citedArticles,
        corpus.query,
        corpus.providerStatuses,
      ),
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
    mode: corpus.mode === "live" ? "live" : "mock",
    source:
      corpus.mode === "live"
        ? `${model} + live open-access corpus`
        : `${model} + local fallback corpus`,
    query: corpus.query,
    articles: citedArticles,
    providerStatuses: corpus.providerStatuses,
  } satisfies AidaLiveAnswer);
}
