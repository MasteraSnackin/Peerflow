"use client";

import { useMemo, useState } from "react";
import type { AidaQuestion, CorpusArticle } from "../data";

type AidaAssistantProps = {
  articles: CorpusArticle[];
  questions: AidaQuestion[];
};

type AidaAnswer = Pick<
  AidaQuestion,
  "answer" | "confidence" | "coverage" | "citations"
> & {
  mode?: "live" | "mock" | "refused";
  source?: string;
};

type TavilyDiscovery = {
  mode: "live" | "mock";
  source: string;
  query: string;
  result: {
    title: string;
    url: string;
    host: string;
    snippet: string;
    score: number | null;
  } | null;
};

export default function AidaAssistant({
  articles,
  questions,
}: AidaAssistantProps) {
  const [selectedId, setSelectedId] = useState(questions[0].id);
  const [liveAnswer, setLiveAnswer] = useState<AidaAnswer | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [discovery, setDiscovery] = useState<TavilyDiscovery | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const selected =
    questions.find((question) => question.id === selectedId) ?? questions[0];
  const answer = liveAnswer ?? selected;
  const citedArticles = useMemo(
    () =>
      answer.citations
        .map((citation) => articles.find((article) => article.id === citation))
        .filter((article): article is CorpusArticle => Boolean(article)),
    [answer.citations, articles],
  );

  async function askAida() {
    setIsAsking(true);
    try {
      const response = await fetch("/api/aida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: selected.id }),
      });
      const result = (await response.json()) as AidaAnswer;
      setLiveAnswer(result);
    } catch {
      setLiveAnswer({
        answer: selected.answer,
        confidence: selected.confidence,
        coverage: selected.coverage,
        citations: selected.citations,
        mode: "mock",
        source: "Local fallback",
      });
    } finally {
      setIsAsking(false);
    }
  }

  async function discoverSource() {
    setIsDiscovering(true);
    try {
      const response = await fetch("/api/tavily/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: selected.question }),
      });
      const result = (await response.json()) as TavilyDiscovery;
      setDiscovery(result);
    } catch {
      setDiscovery({
        mode: "mock",
        source: "Tavily discovery fallback",
        query: selected.question,
        result: null,
      });
    } finally {
      setIsDiscovering(false);
    }
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-lg border border-[#d7ded9] bg-[#17211f] p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[#9fd3c4]">
              Aida
            </p>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight">
              Corpus-grounded research answers with visible evidence.
            </h2>
          </div>
          <span className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-[#dce7e3]">
            Corpus-only mode
          </span>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#dce7e3]">
          Aida answers from open-access papers indexed by Peerflow. It cites
          the studies it used, reports evidence coverage and refuses questions
          that are not supported by the corpus.
        </p>

        <div className="mt-5 grid gap-2">
          {questions.map((question) => (
            <button
              aria-pressed={selected.id === question.id}
              className={`rounded-md border px-4 py-3 text-left text-sm transition ${
                selected.id === question.id
                  ? "border-[#9fd3c4] bg-white text-[#17211f]"
                  : "border-white/15 bg-white/5 text-[#dce7e3] hover:bg-white/10"
              }`}
              key={question.id}
              onClick={() => {
                setSelectedId(question.id);
                setLiveAnswer(null);
                setDiscovery(null);
              }}
              type="button"
            >
              {question.question}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            className="rounded-md bg-white px-4 py-3 text-sm font-semibold text-[#17211f] transition hover:bg-[#eef5f2] disabled:cursor-not-allowed disabled:bg-white/60"
            disabled={isAsking}
            onClick={askAida}
            type="button"
          >
            {isAsking ? "Asking Aida" : "Ask Aida"}
          </button>
          <span className="text-xs font-medium text-[#9fb3ad]">
            {liveAnswer
              ? `${liveAnswer.mode ?? "mock"} | ${liveAnswer.source ?? "local corpus"}`
              : "local corpus trace"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            className="rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:bg-white/5"
            disabled={isDiscovering}
            onClick={discoverSource}
            type="button"
          >
            {isDiscovering ? "Searching sources" : "Search open sources"}
          </button>
          <span className="text-xs font-medium text-[#9fb3ad]">
            Tavily search + extract
          </span>
        </div>
      </div>

      <div
        aria-live="polite"
        className="rounded-lg border border-[#d7ded9] bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[#55716a]">
              Answer trace
            </p>
            <h3 className="mt-2 text-2xl font-semibold leading-tight text-[#243632]">
              {selected.question}
            </h3>
          </div>
          <span
            className={`rounded-md px-3 py-2 text-xs font-semibold ${
              answer.citations.length > 0
                ? "bg-[#dff6ee] text-[#11775f]"
                : "bg-[#fff0d8] text-[#8a5b11]"
            }`}
          >
            {answer.confidence}
          </span>
        </div>

        <p className="mt-4 text-sm leading-7 text-[#40514d]">
          {answer.answer}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-[#d9e1dd] bg-[#f9fbfa] p-4">
            <p className="text-xs font-semibold uppercase text-[#55716a]">
              Evidence
            </p>
            <p className="mt-2 text-sm font-semibold text-[#243632]">
              {answer.coverage}
            </p>
          </div>
          <div className="rounded-lg border border-[#d9e1dd] bg-[#f9fbfa] p-4">
            <p className="text-xs font-semibold uppercase text-[#55716a]">
              Guardrail
            </p>
            <p className="mt-2 text-sm font-semibold text-[#243632]">
              No citation, no claim
            </p>
          </div>
          <div className="rounded-lg border border-[#d9e1dd] bg-[#f9fbfa] p-4">
            <p className="text-xs font-semibold uppercase text-[#55716a]">
              Storage
            </p>
            <p className="mt-2 text-sm font-semibold text-[#243632]">
              Metadata and abstracts
            </p>
          </div>
        </div>

        <div className="mt-5 divide-y divide-[#d9e1dd] border-y border-[#d9e1dd]">
          {citedArticles.length === 0 ? (
            <p className="py-4 text-sm leading-6 text-[#60706c]">
              No supporting article was retrieved for this answer. Aida refuses
              rather than inventing a claim.
            </p>
          ) : (
            citedArticles.map((article) => (
              <article className="py-4" key={article.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[#edf2ef] px-2 py-1 text-xs font-semibold text-[#55716a]">
                    {article.id}
                  </span>
                  <h4 className="text-sm font-semibold text-[#243632]">
                    {article.title}
                  </h4>
                </div>
                <p className="mt-2 text-xs text-[#60706c]">
                  {article.source} | {article.licence} | {article.year}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#40514d]">
                  {article.evidence}
                </p>
              </article>
            ))
          )}
        </div>

        <div className="mt-5 rounded-lg border border-[#d9e1dd] bg-[#f9fbfa] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase text-[#55716a]">
              Tavily discovery
            </p>
            <span className="text-xs font-medium text-[#60706c]">
              {discovery
                ? `${discovery.mode} | ${discovery.source}`
                : "candidate source search"}
            </span>
          </div>
          {discovery?.result ? (
            <div className="mt-3">
              <a
                className="text-sm font-semibold text-[#11775f] underline-offset-4 hover:underline"
                href={discovery.result.url}
                rel="noreferrer"
                target="_blank"
              >
                {discovery.result.title}
              </a>
              <p className="mt-1 text-xs text-[#60706c]">
                {discovery.result.host}
              </p>
              <p className="mt-3 text-sm leading-6 text-[#40514d]">
                {discovery.result.snippet ||
                  "Tavily found a source, but no extractable text was returned."}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[#60706c]">
              Search open sources to find a candidate article for the next
              corpus-ingestion step.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
