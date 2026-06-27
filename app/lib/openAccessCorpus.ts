import {
  corpusArticles,
  type AidaQuestion,
  type CorpusArticle,
} from "../data";

const OPENALEX_WORKS_URL = "https://api.openalex.org/works";
const TAVILY_API_BASE = "https://api.tavily.com";
const ALLOWED_HOSTS = [
  "arxiv.org",
  "openalex.org",
  "semanticscholar.org",
  "pmc.ncbi.nlm.nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
];
const STOP_WORDS = new Set([
  "about",
  "after",
  "could",
  "from",
  "have",
  "into",
  "should",
  "that",
  "their",
  "there",
  "these",
  "this",
  "using",
  "when",
  "where",
  "which",
  "with",
  "would",
]);

type OpenAlexWork = {
  id?: string;
  display_name?: string;
  publication_year?: number;
  abstract_inverted_index?: Record<string, number[]>;
  open_access?: {
    is_oa?: boolean;
    oa_status?: string;
    oa_url?: string;
  };
  best_oa_location?: OpenAlexLocation | null;
  primary_location?: OpenAlexLocation | null;
  authorships?: Array<{
    author?: {
      display_name?: string;
    };
  }>;
  primary_topic?: {
    display_name?: string;
    field?: {
      display_name?: string;
    };
    subfield?: {
      display_name?: string;
    };
  };
  ids?: {
    doi?: string;
    openalex?: string;
    pmid?: string;
    pmcid?: string;
  };
  cited_by_count?: number;
  type?: string;
};

type OpenAlexLocation = {
  landing_page_url?: string;
  pdf_url?: string;
  license?: string;
  source?: {
    display_name?: string;
    host_organization_name?: string;
  } | null;
};

type OpenAlexResponse = {
  results?: OpenAlexWork[];
};

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

export type CorpusSearchResponse = {
  mode: "live" | "mock";
  source: string;
  query: string;
  articles: CorpusArticle[];
  providerStatuses: string[];
};

function compactText(value: string | undefined, limit = 700) {
  return (value ?? "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/#{1,6}\s*/g, " ")
    .replace(/Primary site navigation/gi, " ")
    .replace(/Logged in as:\s*PERMALINK/gi, " ")
    .replace(/\b(?:png|jpe?g|gif|svg|webp)\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function hostnameFor(url: string | undefined) {
  if (!url) {
    return "";
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isAllowedSource(url: string | undefined) {
  const hostname = hostnameFor(url);
  return ALLOWED_HOSTS.some(
    (allowedHost) =>
      hostname === allowedHost || hostname.endsWith(`.${allowedHost}`),
  );
}

function searchTerms(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term))
    .slice(0, 10);
}

function sentenceSnippet(text: string, query: string, limit = 540) {
  const terms = searchTerms(query);
  const sourceText = bestTextWindow(text, terms, Math.max(1200, limit * 3));
  const sentences = sourceText.match(/[^.!?]+[.!?]?/g) ?? [sourceText];
  const ranked = sentences
    .map((sentence) => {
      const normalised = sentence.toLowerCase();
      const score = terms.reduce(
        (total, term) => total + (normalised.includes(term) ? 1 : 0),
        0,
      );

      return {
        score,
        sentence: compactText(sentence, limit),
      };
    })
    .sort((a, b) => b.score - a.score);
  const relevant = ranked
    .filter((candidate) => candidate.score > 0)
    .slice(0, 2)
    .map((candidate) => candidate.sentence)
    .join(" ");

  return compactText(relevant || sourceText, limit);
}

function bestTextWindow(text: string, terms: string[], limit: number) {
  const compact = compactText(text, 8000);
  if (terms.length === 0 || compact.length <= limit) {
    return compact;
  }

  const lower = compact.toLowerCase();
  const stride = Math.max(180, Math.floor(limit / 3));
  let bestStart = 0;
  let bestScore = -1;

  for (let start = 0; start < compact.length; start += stride) {
    const window = lower.slice(start, start + limit);
    const score = terms.reduce(
      (total, term) => total + (window.includes(term) ? 1 : 0),
      0,
    );

    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  const start = Math.max(0, bestStart - 80);
  return compact.slice(start, start + limit);
}

function reconstructAbstract(
  abstractIndex: OpenAlexWork["abstract_inverted_index"],
) {
  if (!abstractIndex) {
    return "";
  }

  const words: string[] = [];
  for (const [word, positions] of Object.entries(abstractIndex)) {
    for (const position of positions) {
      words[position] = word;
    }
  }

  return words.join(" ").replace(/\s+([,.;:!?])/g, "$1");
}

function licenceFor(work: OpenAlexWork) {
  const licence = work.best_oa_location?.license;
  if (licence) {
    return licence.toUpperCase();
  }

  const status = work.open_access?.oa_status;
  return status ? `Open access (${status})` : "Open access";
}

function urlFor(work: OpenAlexWork) {
  return (
    work.best_oa_location?.landing_page_url ??
    work.best_oa_location?.pdf_url ??
    work.open_access?.oa_url ??
    work.primary_location?.landing_page_url ??
    work.ids?.openalex ??
    work.id
  );
}

function sourceFor(work: OpenAlexWork) {
  const host =
    work.best_oa_location?.source?.display_name ??
    work.primary_location?.source?.display_name ??
    work.primary_topic?.field?.display_name ??
    work.primary_topic?.subfield?.display_name;

  return host ? `OpenAlex live - ${host}` : "OpenAlex live";
}

function openAlexWorkToArticle(
  work: OpenAlexWork,
  index: number,
  query: string,
): CorpusArticle | null {
  const title = compactText(work.display_name, 260);
  const abstract = compactText(reconstructAbstract(work.abstract_inverted_index), 2800);
  const evidence = sentenceSnippet(abstract, query);

  if (!title || evidence.length < 80) {
    return null;
  }

  const authors =
    work.authorships
      ?.map((authorship) => authorship.author?.display_name)
      .filter((name): name is string => Boolean(name))
      .slice(0, 3)
      .join(", ") ?? "";

  return {
    id: `OA${index + 1}`,
    title,
    source: sourceFor(work),
    licence: licenceFor(work),
    year: String(work.publication_year ?? "n.d."),
    evidence,
    url: urlFor(work),
    authors,
  };
}

function buildOpenAlexUrl(query: string, maxResults: number) {
  const url = new URL(OPENALEX_WORKS_URL);
  url.searchParams.set("search", query);
  url.searchParams.set("filter", "is_oa:true,has_abstract:true,is_retracted:false");
  url.searchParams.set("per_page", String(Math.max(maxResults * 2, maxResults)));
  url.searchParams.set("sort", "relevance_score:desc");
  url.searchParams.set(
    "select",
    [
      "id",
      "display_name",
      "publication_year",
      "abstract_inverted_index",
      "open_access",
      "best_oa_location",
      "primary_location",
      "authorships",
      "primary_topic",
      "ids",
      "cited_by_count",
      "type",
    ].join(","),
  );

  if (process.env.OPENALEX_API_KEY) {
    url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
  }

  if (process.env.OPENALEX_EMAIL) {
    url.searchParams.set("mailto", process.env.OPENALEX_EMAIL);
  }

  return url;
}

async function fetchOpenAlexCorpus(query: string, maxResults: number) {
  try {
    const response = await fetch(buildOpenAlexUrl(query, maxResults), {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!response.ok) {
      return {
        articles: [] as CorpusArticle[],
        status: `OpenAlex returned ${response.status}`,
      };
    }

    const data = (await response.json()) as OpenAlexResponse;
    const articles = (data.results ?? [])
      .map((work, index) => openAlexWorkToArticle(work, index, query))
      .filter((article): article is CorpusArticle => Boolean(article));

    return {
      articles,
      status: articles.length
        ? `OpenAlex returned ${articles.length} open-access abstracts`
        : "OpenAlex returned no usable abstracts",
    };
  } catch {
    return {
      articles: [] as CorpusArticle[],
      status: "OpenAlex request failed",
    };
  }
}

function tavilyLicence(url: string) {
  const hostname = hostnameFor(url);
  if (hostname.endsWith("arxiv.org")) {
    return "Open access preprint";
  }

  if (hostname.includes("pmc.ncbi.nlm.nih.gov")) {
    return "PMC open-access article";
  }

  if (hostname.includes("pubmed.ncbi.nlm.nih.gov")) {
    return "PubMed public abstract";
  }

  return "Open-access source candidate";
}

async function fetchTavilyCorpus(query: string, maxResults: number) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || maxResults <= 0) {
    return {
      articles: [] as CorpusArticle[],
      status: apiKey ? "Tavily not needed" : "Tavily key missing",
    };
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
        max_results: 6,
        include_domains: ALLOWED_HOSTS,
      }),
      signal: AbortSignal.timeout(9000),
    });

    if (!searchResponse.ok) {
      return {
        articles: [] as CorpusArticle[],
        status: `Tavily search returned ${searchResponse.status}`,
      };
    }

    const searchData = (await searchResponse.json()) as TavilySearchResponse;
    const candidates = (searchData.results ?? [])
      .filter((candidate) => candidate.url && isAllowedSource(candidate.url))
      .slice(0, maxResults);

    if (candidates.length === 0) {
      return {
        articles: [] as CorpusArticle[],
        status: "Tavily found no allowed open-access source",
      };
    }

    const urls = candidates
      .map((candidate) => candidate.url)
      .filter((url): url is string => Boolean(url));
    const extractResponse = await fetch(`${TAVILY_API_BASE}/extract`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        urls,
        extract_depth: "basic",
      }),
      signal: AbortSignal.timeout(9000),
    });
    const extractsByUrl = new Map<string, string>();

    if (extractResponse.ok) {
      const extractData = (await extractResponse.json()) as TavilyExtractResponse;
      for (const result of extractData.results ?? []) {
        if (result.url) {
          extractsByUrl.set(result.url, compactText(result.raw_content, 6000));
        }
      }
    }

    const articles = candidates.map((candidate, index) => {
      const url = candidate.url ?? "";
      const extracted = extractsByUrl.get(url);
      const evidence = sentenceSnippet(
        extracted || compactText(candidate.content, 1800),
        query,
      );

      return {
        id: `TV${index + 1}`,
        title: compactText(candidate.title, 260) || "Open-access source",
        source: `Tavily live - ${hostnameFor(url) || "open web"}`,
        licence: tavilyLicence(url),
        year: "live",
        evidence,
        url,
      } satisfies CorpusArticle;
    });

    return {
      articles,
      status: extractResponse.ok
        ? `Tavily returned ${articles.length} extracted sources`
        : `Tavily search returned ${articles.length} sources`,
    };
  } catch {
    return {
      articles: [] as CorpusArticle[],
      status: "Tavily request failed",
    };
  }
}

function articleKey(article: CorpusArticle) {
  return `${article.title.toLowerCase()}|${article.url ?? ""}`;
}

function dedupeArticles(articles: CorpusArticle[]) {
  const seen = new Set<string>();
  return articles.filter((article) => {
    const key = articleKey(article);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function queryForQuestion(question: AidaQuestion) {
  return compactText(question.searchQuery ?? question.question, 220);
}

export function staticArticlesForQuestion(question: AidaQuestion) {
  return question.citations
    .map((citation) => corpusArticles.find((article) => article.id === citation))
    .filter((article): article is CorpusArticle => Boolean(article));
}

export async function retrieveOpenAccessCorpus(
  query: string,
  options?: {
    fallbackArticles?: CorpusArticle[];
    maxResults?: number;
  },
): Promise<CorpusSearchResponse> {
  const cleanQuery = compactText(query, 220);
  const maxResults = options?.maxResults ?? 4;
  const fallbackArticles = options?.fallbackArticles ?? corpusArticles.slice(0, 3);

  if (!cleanQuery) {
    return {
      mode: "mock",
      source: "Local fallback corpus",
      query: cleanQuery,
      articles: fallbackArticles,
      providerStatuses: ["Missing corpus query"],
    };
  }

  const providerStatuses: string[] = [];
  const openAlex = await fetchOpenAlexCorpus(cleanQuery, maxResults);
  providerStatuses.push(openAlex.status);
  let articles = openAlex.articles.slice(0, maxResults);

  if (process.env.TAVILY_API_KEY || articles.length < Math.min(maxResults, 3)) {
    const tavily = await fetchTavilyCorpus(
      cleanQuery,
      articles.length >= maxResults ? 1 : Math.max(maxResults - articles.length, 1),
    );
    providerStatuses.push(tavily.status);
    articles =
      tavily.articles.length > 0
        ? [...tavily.articles, ...articles].slice(0, maxResults)
        : articles;
  }

  const liveArticles = dedupeArticles(articles).slice(0, maxResults);
  if (liveArticles.length > 0) {
    return {
      mode: "live",
      source: providerStatuses.join("; "),
      query: cleanQuery,
      articles: liveArticles,
      providerStatuses,
    };
  }

  return {
    mode: "mock",
    source: `Local fallback corpus; ${providerStatuses.join("; ")}`,
    query: cleanQuery,
    articles: fallbackArticles,
    providerStatuses,
  };
}
