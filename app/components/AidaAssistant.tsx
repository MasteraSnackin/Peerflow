"use client";

import { useState } from "react";
import type { AidaQuestion, CorpusArticle } from "../data";

type AidaAssistantProps = {
  questions: AidaQuestion[];
};

type AidaAnswer = {
  answer: string;
  confidence: string;
  coverage: string;
  citations: string[];
  mode?: "live" | "refused";
  source?: string;
  query?: string;
  articles?: CorpusArticle[];
  providerStatuses?: string[];
};

type CorpusSearch = {
  mode: "live" | "empty";
  source: string;
  query: string;
  articles: CorpusArticle[];
  providerStatuses: string[];
};

type TavilyDiscovery = {
  mode: "live" | "empty";
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

export default function AidaAssistant({ questions }: AidaAssistantProps) {
  const [selectedId, setSelectedId] = useState(questions[0].id);
  const [liveAnswer, setLiveAnswer] = useState<AidaAnswer | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [corpusPreview, setCorpusPreview] = useState<CorpusSearch | null>(null);
  const [isRefreshingCorpus, setIsRefreshingCorpus] = useState(false);
  const [discovery, setDiscovery] = useState<TavilyDiscovery | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const selected =
    questions.find((question) => question.id === selectedId) ?? questions[0];

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
        answer:
          "Aida could not reach the live corpus route, so it is refusing instead of using a local fallback corpus.",
        confidence: "No live evidence",
        coverage: "0 live cited passages",
        citations: [],
        mode: "refused",
        source: "Aida route request failed",
        articles: [],
      });
    } finally {
      setIsAsking(false);
    }
  }

  async function refreshCorpus() {
    setIsRefreshingCorpus(true);
    try {
      const response = await fetch("/api/corpus/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: selected.id }),
      });
      const result = (await response.json()) as CorpusSearch;
      setCorpusPreview(result);
    } catch {
      setCorpusPreview({
        mode: "empty",
        source: "Corpus refresh failed; no local fallback corpus",
        query: selected.question,
        articles: [],
        providerStatuses: ["Corpus refresh failed"],
      });
    } finally {
      setIsRefreshingCorpus(false);
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
        mode: "empty",
        source: "Tavily discovery request failed; no default test data",
        query: selected.question,
        result: null,
      });
    } finally {
      setIsDiscovering(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#d7ded9] bg-[#17211f] p-5 text-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#9fd3c4]">
            Aida
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight">
            Corpus-grounded research answers with visible evidence.
          </h2>
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#dce7e3]">
        Aida retrieves live open-access metadata and abstracts, cites the
        studies it used, reports evidence coverage and refuses questions that
        are not supported by the corpus.
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
              setCorpusPreview(null);
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
            ? `${liveAnswer.mode ?? "refused"} | ${liveAnswer.source ?? "live evidence required"}`
            : "live corpus retrieval"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          className="rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:bg-white/5"
          disabled={isRefreshingCorpus}
          onClick={refreshCorpus}
          type="button"
        >
          {isRefreshingCorpus ? "Refreshing corpus" : "Refresh corpus"}
        </button>
        <span className="max-w-md text-xs font-medium text-[#9fb3ad]">
          {corpusPreview
            ? `${corpusPreview.mode} | ${corpusPreview.articles.length} sources`
            : "OpenAlex plus Tavily when configured"}
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
          {discovery
            ? `${discovery.mode} | ${discovery.source}`
            : "Tavily search + extract"}
        </span>
      </div>
    </section>
  );
}
