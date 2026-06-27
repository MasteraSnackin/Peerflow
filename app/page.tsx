import AidaAssistant from "./components/AidaAssistant";
import AgentConsole from "./components/AgentConsole";
import {
  aidaQuestions,
  corpusArticles,
  n8nOrchestrationSteps,
  papers,
  reviewers,
  workflowSteps,
} from "./data";

const partnerStack = [
  "Attio CRM",
  "n8n orchestration",
  "Superlinked matching",
  "Tavily discovery",
  "SLNG voice intake",
  "Aikido security",
];

const integrationDefinitions = [
  {
    service: "Attio",
    keys: ["ATTIO_API_KEY", "ATTIO_WORKSPACE_ID"],
    purpose: "n8n creates or updates people, companies and follow-up tasks.",
  },
  {
    service: "n8n",
    keys: ["N8N_WEBHOOK_URL"],
    purpose: "Receive paper.submitted and orchestrate CRM, matching and outreach.",
  },
  {
    service: "SLNG",
    keys: ["SLNG_API_KEY"],
    purpose:
      "Turn spoken author intent into structured paper intake text for Peerflow.",
  },
  {
    service: "Superlinked",
    keys: ["SUPERLINKED_ENDPOINT", "SUPERLINKED_API_KEY"],
    purpose:
      "Semantic matching between paper profiles and reviewer expertise profiles.",
  },
  {
    service: "Tavily",
    keys: ["TAVILY_API_KEY"],
    purpose: "Extract supplemental open-access source text for Aida's live corpus.",
  },
  {
    service: "Aikido",
    keys: ["AIKIDO_REPORT_URL"],
    purpose: "Attach repository security evidence for the side challenge.",
    actionLabel: "Open report",
    actionEnvKey: "AIKIDO_REPORT_URL",
  },
  {
    service: "Aida",
    keys: ["AIDA_MODEL_API_KEY or GEMINI_API_KEY"],
    purpose: "Answer only from live OpenAlex/Tavily corpus evidence.",
    requiredKeyGroups: [["AIDA_MODEL_API_KEY", "GEMINI_API_KEY"]],
  },
];

function getIntegrationStatus() {
  return integrationDefinitions.map((integration) => {
    const configured = (
      integration.requiredKeyGroups ??
      integration.keys.map((key) => [key])
    ).every((group) => group.some((key) => Boolean(process.env[key])));
    const actionUrl =
      "actionEnvKey" in integration && integration.actionEnvKey
        ? process.env[integration.actionEnvKey]
        : undefined;

    return {
      ...integration,
      configured,
      statusLabel: configured ? "Configured" : "Needs setup",
      actionUrl: configured ? actionUrl : undefined,
    };
  });
}

export default function Home() {
  const integrations = getIntegrationStatus();
  const configuredCount = integrations.filter(
    (integration) => integration.configured,
  ).length;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f8f6] text-[#17211f]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex flex-col items-start justify-between gap-4 border-b border-[#d7ded9] pb-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase text-[#55716a]">
              Peerflow
            </p>
            <h1 className="text-2xl font-semibold">Open research CRM agent</h1>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            {partnerStack.map((item) => (
              <span
                className="flex min-h-9 items-center justify-center rounded-md border border-[#c8d2ce] bg-white px-3 py-2 text-center text-xs font-medium text-[#31443f]"
                key={item}
              >
                {item}
              </span>
            ))}
          </div>
        </header>

        <section className="grid items-start gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="py-4">
            <p className="text-xs font-semibold uppercase text-[#55716a]">
              Hackathon MVP
            </p>
            <h2 className="mt-3 max-w-3xl break-words text-3xl font-semibold leading-tight sm:text-5xl">
              A legal, agentic CRM layer for open-access research.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#51625e]">
              Peerflow helps research communities manage author outreach,
              submission intake, reviewer matching and publication follow-up
              through Attio instead of a messy inbox.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <article className="min-h-[132px] rounded-lg border border-[#d9e1dd] bg-white p-4 shadow-sm">
              <p className="text-3xl font-semibold">{papers.length}</p>
              <p className="mt-2 text-sm leading-6 text-[#60706c]">
                open-access sources in the demo queue
              </p>
            </article>
            <article className="min-h-[132px] rounded-lg border border-[#d9e1dd] bg-white p-4 shadow-sm">
              <p className="text-3xl font-semibold">{workflowSteps.length}</p>
              <p className="mt-2 text-sm leading-6 text-[#60706c]">
                agent actions from intake to reviewer match
              </p>
            </article>
            <article className="min-h-[132px] rounded-lg border border-[#d9e1dd] bg-white p-4 shadow-sm">
              <p className="text-3xl font-semibold">{configuredCount}/7</p>
              <p className="mt-2 text-sm leading-6 text-[#60706c]">
                integrations configured from environment variables
              </p>
            </article>
          </div>
        </section>

        <AidaAssistant articles={corpusArticles} questions={aidaQuestions} />

        <AgentConsole
          integrations={integrations}
          n8nOrchestrationSteps={n8nOrchestrationSteps}
          papers={papers}
          reviewers={reviewers}
          steps={workflowSteps}
        />
      </div>
    </main>
  );
}
