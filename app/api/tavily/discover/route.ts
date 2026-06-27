const TAVILY_API_BASE = "https://api.tavily.com";
const ALLOWED_HOSTS = [
  "arxiv.org",
  "openalex.org",
  "semanticscholar.org",
  "pmc.ncbi.nlm.nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
];

type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
};

type TavilySearchResponse = {
  results?: TavilySearchResult[];
};

type TavilyExtractResult = {
  url?: string;
  raw_content?: string;
};

type TavilyExtractResponse = {
  results?: TavilyExtractResult[];
};

function hostnameFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isAllowedSource(url: string) {
  const hostname = hostnameFor(url);
  return ALLOWED_HOSTS.some(
    (allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`),
  );
}

function compactText(value: string | undefined, limit = 700) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export async function POST(request: Request) {
  const apiKey = process.env.TAVILY_API_KEY;
  const payload = (await request.json().catch(() => null)) as {
    query?: string;
  } | null;
  const query = compactText(payload?.query, 220);

  if (!apiKey) {
    return Response.json({
      mode: "mock",
      source: "Missing Tavily key",
      query,
      result: null,
    });
  }

  if (!query) {
    return Response.json({
      mode: "mock",
      source: "Missing search query",
      query,
      result: null,
    });
  }

  try {
    const searchResponse = await fetch(`${TAVILY_API_BASE}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `${query} open access research paper`,
        search_depth: "advanced",
        max_results: 5,
        include_domains: ALLOWED_HOSTS,
      }),
    });

    if (!searchResponse.ok) {
      return Response.json({
        mode: "mock",
        source: `Tavily search returned ${searchResponse.status}`,
        query,
        result: null,
      });
    }

    const searchData = (await searchResponse.json()) as TavilySearchResponse;
    const result = (searchData.results ?? []).find(
      (candidate) => candidate.url && isAllowedSource(candidate.url),
    );

    if (!result?.url) {
      return Response.json({
        mode: "mock",
        source: "Tavily found no allowed open-access source",
        query,
        result: null,
      });
    }

    const extractResponse = await fetch(`${TAVILY_API_BASE}/extract`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        urls: [result.url],
        extract_depth: "basic",
      }),
    });

    let extracted = "";
    if (extractResponse.ok) {
      const extractData = (await extractResponse.json()) as TavilyExtractResponse;
      extracted = compactText(extractData.results?.[0]?.raw_content, 900);
    }

    return Response.json({
      mode: "live",
      source: extracted ? "Tavily search + extract" : "Tavily search",
      query,
      result: {
        title: result.title ?? "Open-access source candidate",
        url: result.url,
        host: hostnameFor(result.url),
        snippet: extracted || compactText(result.content, 900),
        score: result.score ?? null,
      },
    });
  } catch {
    return Response.json({
      mode: "mock",
      source: "Tavily request failed",
      query,
      result: null,
    });
  }
}
