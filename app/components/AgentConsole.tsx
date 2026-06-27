"use client";

import { useMemo, useState } from "react";
import type {
  IntegrationStatus,
  Paper,
  Reviewer,
  WorkflowStep,
} from "../data";

type AgentConsoleProps = {
  papers: Paper[];
  reviewers: Reviewer[];
  steps: WorkflowStep[];
  integrations: IntegrationStatus[];
};

type LogEntry = {
  id: string;
  label: string;
  detail: string;
};

type ReviewerMatchResponse = {
  matches: Reviewer[];
  mode: "live" | "mock";
  source: string;
};

type AttioStatusResponse = {
  mode: "live" | "mock";
  source: string;
  objects: string[];
};

type N8nTriggerResponse = {
  mode: "live" | "mock";
  source: string;
  runId: string | null;
};

const stageLabels = [
  "Discovered",
  "Author contacted",
  "Submitted",
  "Reviewer matched",
];

export default function AgentConsole({
  papers,
  reviewers,
  steps,
  integrations,
}: AgentConsoleProps) {
  const [selectedPaperId, setSelectedPaperId] = useState(papers[0].id);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [liveReviewers, setLiveReviewers] = useState<Reviewer[] | null>(null);
  const [matchSource, setMatchSource] = useState("local mock scores");
  const [attioSource, setAttioSource] = useState("local record preview");
  const [workflowSource, setWorkflowSource] = useState("waiting for agent run");

  const selectedPaper =
    papers.find((paper) => paper.id === selectedPaperId) ?? papers[0];
  const progress = Math.round((completedIds.length / steps.length) * 100);
  const currentStage =
    stageLabels[Math.min(stageLabels.length - 1, completedIds.length - 1)] ??
    "Ready for intake";
  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);
  const matchedReviewers = completedSet.has("match")
    ? (liveReviewers ?? reviewers)
    : reviewers.slice(0, 1);

  async function validateAttio() {
    try {
      const response = await fetch("/api/attio/status");
      const result = (await response.json()) as AttioStatusResponse;
      const source = `${result.mode} | ${result.source}`;
      setAttioSource(source);
      return source;
    } catch {
      const source = "mock | Attio validation fallback";
      setAttioSource(source);
      return source;
    }
  }

  async function matchWithSuperlinked() {
    try {
      const response = await fetch("/api/superlinked/match-reviewers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId: selectedPaper.id }),
      });
      const result = (await response.json()) as ReviewerMatchResponse;
      setLiveReviewers(result.matches);
      const source = `${result.mode} | ${result.source}`;
      setMatchSource(source);
      return { matches: result.matches, source };
    } catch {
      const source = "mock | local fallback";
      setLiveReviewers(reviewers);
      setMatchSource(source);
      return { matches: reviewers, source };
    }
  }

  async function triggerN8nWorkflow(workflowReviewers: Reviewer[]) {
    try {
      const response = await fetch("/api/n8n/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperId: selectedPaper.id,
          stage: "reviewer-matched",
          reviewers: workflowReviewers,
        }),
      });
      const result = (await response.json()) as N8nTriggerResponse;
      const source = `${result.mode} | ${result.source}`;
      setWorkflowSource(source);
      return source;
    } catch {
      const source = "mock | n8n trigger fallback";
      setWorkflowSource(source);
      return source;
    }
  }

  async function runAgent() {
    setIsRunning(true);
    setCompletedIds([]);
    setLog([]);
    setLiveReviewers(null);
    setMatchSource("local mock scores");
    setAttioSource("local record preview");
    setWorkflowSource("waiting for agent run");
    let workflowReviewers = reviewers;

    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, 620));
      let detail = step.detail;
      if (step.id === "crm") {
        const source = await validateAttio();
        detail = `${step.detail} Outcome: ${source}.`;
      }
      if (step.id === "match") {
        const result = await matchWithSuperlinked();
        workflowReviewers = result.matches;
        detail = `${step.detail} Outcome: ${result.source}.`;
      }
      if (step.id === "workflow") {
        const source = await triggerN8nWorkflow(workflowReviewers);
        detail = `${step.detail} Outcome: ${source}.`;
      }
      setCompletedIds((current) => [...current, step.id]);
      setLog((current) => [
        {
          id: step.id,
          label: step.title,
          detail,
        },
        ...current,
      ]);
    }

    setIsRunning(false);
  }

  function resetAgent() {
    setCompletedIds([]);
    setLog([]);
    setIsRunning(false);
    setLiveReviewers(null);
    setMatchSource("local mock scores");
    setAttioSource("local record preview");
    setWorkflowSource("waiting for agent run");
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[1.04fr_0.96fr]">
      <div className="rounded-lg border border-[#d7ded9] bg-white shadow-sm">
        <div className="border-b border-[#d7ded9] p-5">
          <p className="text-xs font-semibold uppercase text-[#55716a]">
            Live agent run
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <h2 className="max-w-2xl break-words text-2xl font-semibold leading-tight sm:text-3xl">
              Turn a legitimate open-access paper into a reviewer-ready Attio
              pipeline.
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md bg-[#17211f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b3b37] disabled:cursor-not-allowed disabled:bg-[#6d7b77]"
                disabled={isRunning}
                onClick={runAgent}
                type="button"
              >
                {isRunning ? "Running agent" : "Run agent"}
              </button>
              <button
                className="rounded-md border border-[#c8d2ce] bg-white px-4 py-3 text-sm font-semibold text-[#243632] transition hover:bg-[#f2f5f3]"
                onClick={resetAgent}
                type="button"
              >
                Reset
              </button>
            </div>
          </div>
          <div
            aria-label="Agent run progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className="mt-5 h-2 bg-[#e5ebe8]"
            role="progressbar"
          >
            <div
              className="h-2 bg-[#19a886] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div
            aria-live="polite"
            className="mt-2 flex items-center justify-between text-xs font-medium text-[#60706c]"
          >
            <span>{currentStage}</span>
            <span>{progress}% complete</span>
          </div>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[0.92fr_1.08fr]">
          <div>
            <p className="text-sm font-semibold text-[#243632]">
              Select an intake
            </p>
            <div className="mt-3 space-y-2">
              {papers.map((paper) => (
                <button
                  aria-pressed={selectedPaper.id === paper.id}
                  className={`w-full rounded-md border px-4 py-3 text-left text-sm transition ${
                    selectedPaper.id === paper.id
                      ? "border-[#19a886] bg-[#eef9f5]"
                      : "border-[#d9e1dd] bg-[#f9fbfa] hover:bg-[#f2f5f3]"
                  }`}
                  disabled={isRunning}
                  key={paper.id}
                  onClick={() => setSelectedPaperId(paper.id)}
                  type="button"
                >
                  <span className="block font-semibold text-[#243632]">
                    {paper.title}
                  </span>
                  <span className="mt-1 block text-xs text-[#60706c]">
                    {paper.source} | {paper.licence}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#243632]">
              Agent checklist
            </p>
            <div className="mt-3 divide-y divide-[#d9e1dd] border-y border-[#d9e1dd]">
              {steps.map((step, index) => {
                const done = completedSet.has(step.id);
                return (
                  <div className="grid grid-cols-[32px_1fr] gap-3 py-3" key={step.id}>
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold ${
                        done
                          ? "bg-[#19a886] text-white"
                          : "bg-[#edf2ef] text-[#60706c]"
                      }`}
                    >
                      {done ? "OK" : index + 1}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#243632]">
                          {step.title}
                        </p>
                        <span className="rounded-md bg-[#edf2ef] px-2 py-1 text-xs font-medium text-[#55716a]">
                          {step.owner}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[#60706c]">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5">
        <div className="rounded-lg border border-[#d7ded9] bg-[#17211f] p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase text-[#9fd3c4]">
            Attio record preview
          </p>
          <h3 className="mt-3 text-2xl font-semibold leading-tight">
            {selectedPaper.title}
          </h3>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[#9fb3ad]">Author</dt>
              <dd className="mt-1 font-medium">{selectedPaper.author}</dd>
            </div>
            <div>
              <dt className="text-[#9fb3ad]">Institution</dt>
              <dd className="mt-1 font-medium">{selectedPaper.institution}</dd>
            </div>
            <div>
              <dt className="text-[#9fb3ad]">Field</dt>
              <dd className="mt-1 font-medium">{selectedPaper.field}</dd>
            </div>
            <div>
              <dt className="text-[#9fb3ad]">Stage</dt>
              <dd className="mt-1 font-medium">{currentStage}</dd>
            </div>
          </dl>
          <p className="mt-5 text-sm leading-6 text-[#dce7e3]">
            {selectedPaper.abstract}
          </p>
          <p className="mt-4 text-xs font-medium text-[#9fb3ad]">
            Attio: {attioSource}
          </p>
        </div>

        <div className="rounded-lg border border-[#d7ded9] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-[#243632]">
              Reviewer matches
            </p>
            <span className="text-xs font-medium text-[#60706c]">
              Superlinked score
            </span>
          </div>
          <p className="mt-2 text-xs font-medium text-[#60706c]">
            {matchSource}
          </p>
          <div className="mt-3 divide-y divide-[#d9e1dd] border-y border-[#d9e1dd]">
            {matchedReviewers.map((reviewer) => (
              <div
                className="grid grid-cols-[minmax(0,1fr)_64px] gap-3 py-3"
                key={reviewer.name}
              >
                <div>
                  <p className="text-sm font-semibold text-[#243632]">
                    {reviewer.name}
                  </p>
                  <p className="mt-1 text-xs text-[#60706c]">
                    {reviewer.institution} | {reviewer.speciality}
                  </p>
                  <p className="mt-1 text-xs text-[#60706c]">
                    {reviewer.availability}
                  </p>
                </div>
                <div className="text-right text-lg font-semibold text-[#19a886]">
                  {reviewer.fit}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#d7ded9] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#243632]">Agent log</p>
            <span className="text-xs font-medium text-[#60706c]">
              n8n: {workflowSource}
            </span>
          </div>
          <div className="mt-3 min-h-[156px] divide-y divide-[#d9e1dd] border-y border-[#d9e1dd]">
            {log.length === 0 ? (
              <p className="py-4 text-sm leading-6 text-[#60706c]">
                Run the agent to create the evidence trail for the judges.
              </p>
            ) : (
              log.map((entry) => (
                <div className="py-3" key={entry.id}>
                  <p className="text-sm font-semibold text-[#243632]">
                    {entry.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#60706c]">
                    {entry.detail}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#d7ded9] bg-white p-5 shadow-sm lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[#55716a]">
              Integration readiness
            </p>
            <h3 className="mt-1 text-xl font-semibold">
              Real services can be plugged in with environment variables.
            </h3>
          </div>
          <span className="rounded-md bg-[#edf2ef] px-3 py-2 text-xs font-semibold text-[#31443f]">
            Live execution is shown inside each workflow step
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {integrations.map((integration) => (
            <article
              className="rounded-lg border border-[#d9e1dd] bg-[#f9fbfa] p-4"
              key={integration.service}
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-[#243632]">
                  {integration.service}
                </h4>
                <span
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    integration.configured
                      ? "bg-[#dff6ee] text-[#11775f]"
                      : "bg-[#fff0d8] text-[#8a5b11]"
                  }`}
                >
                  {integration.statusLabel}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#60706c]">
                {integration.purpose}
              </p>
              <p className="mt-3 break-words font-mono text-[11px] leading-5 text-[#40514d]">
                {integration.keys.join(", ")}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
