import { searchTavily as runTavilySearch } from "./tavilySearch.ts";

/**
 * Verified Web Search Provider for J.A.R.V.I.S.
 * Uses Tavily as primary verified search engine with DuckDuckGo as an out-of-the-box fallback.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  provider: string;
  error?: string;
}

/**
 * Clean HTML entities and tags
 */
function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Search via Serper Google Search API (if SERPER_API_KEY is configured)
 */
async function searchSerper(query: string, maxResults = 5): Promise<SearchResult[] | null> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: maxResults }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.organic || !Array.isArray(data.organic)) return null;

    return data.organic.slice(0, maxResults).map((r: any) => ({
      title: cleanText(r.title || "Source"),
      url: r.link,
      snippet: cleanText(r.snippet || ""),
      source: "Serper",
    }));
  } catch {
    return null;
  }
}

/**
 * Search via Brave Search API (if BRAVE_API_KEY is configured)
 */
async function searchBrave(query: string, maxResults = 5): Promise<SearchResult[] | null> {
  const apiKey = process.env.BRAVE_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
      {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.web?.results || !Array.isArray(data.web.results)) return null;

    return data.web.results.slice(0, maxResults).map((r: any) => ({
      title: cleanText(r.title || "Source"),
      url: r.url,
      snippet: cleanText(r.description || ""),
      source: "Brave",
    }));
  } catch {
    return null;
  }
}

/**
 * Search via DuckDuckGo HTML (zero API key required, runs locally out of the box)
 */
async function searchDuckDuckGo(query: string, maxResults = 5): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo returned HTTP ${res.status}`);
  }

  const html = await res.text();
  const results: SearchResult[] = [];

  // Match result blocks
  const blockRegex =
    /<div class="result results_links results_links_deep web-result ">([\s\S]*?)<\/div>\s*<\/div>/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(html)) !== null && results.length < maxResults) {
    const block = match[1];

    // Find title and clean URL
    const titleMatch = block.match(/<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

    if (titleMatch) {
      let rawHref = titleMatch[1];
      let cleanUrl = rawHref;

      // Extract destination URL from DuckDuckGo redirect uddg param
      if (rawHref.includes("uddg=")) {
        try {
          const parsed = new URL("https:" + rawHref);
          const uddg = parsed.searchParams.get("uddg");
          if (uddg) cleanUrl = decodeURIComponent(uddg);
        } catch {
          // ignore parsing error
        }
      }

      const title = cleanText(titleMatch[2]);
      const snippet = snippetMatch ? cleanText(snippetMatch[1]) : "";

      // Ignore search ads or empty entries
      if (cleanUrl.startsWith("http") && title) {
        results.push({
          title,
          url: cleanUrl,
          snippet,
          source: "DuckDuckGo",
        });
      }
    }
  }

  // Prioritize official, government, or educational domains
  results.sort((a, b) => {
    const isOfficial = (u: string) => /\.(edu|gov|org|edu\.in|gov\.in|ac\.in)/i.test(u);
    if (isOfficial(a.url) && !isOfficial(b.url)) return -1;
    if (!isOfficial(a.url) && isOfficial(b.url)) return 1;
    return 0;
  });

  return results;
}

/**
 * Evaluates whether retrieved search results actually match the requested entity/business
 * to prevent hallucinating based on loose or unrelated fuzzy search results.
 */
export function verifyRelevance(query: string, results: SearchResult[]): boolean {
  if (!results || results.length === 0) return false;

  const stopWords = new Set([
    "tell", "me", "about", "who", "is", "what", "where", "when",
    "the", "a", "an", "in", "at", "of", "for", "and", "or", "to",
    "by", "as", "on", "it", "its", "details", "information", "on",
    "please", "can", "you", "sir", "jarvis", "latest", "recent"
  ]);

  const queryTerms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  if (queryTerms.length === 0) return results.length > 0;

  const allText = results
    .map((r) => `${r.title} ${r.snippet} ${r.url}`.toLowerCase())
    .join(" ");

  const matchedTerms = queryTerms.filter((term) => allText.includes(term));

  if (matchedTerms.length === 0) return false;

  // If the query has multiple terms, require that at least 55% of the terms match
  // and if there is a primary entity name (the first term), it must be found in at least one result
  const matchRatio = matchedTerms.length / queryTerms.length;
  if (queryTerms.length >= 3) {
    const firstTerm = queryTerms[0];
    const firstTermMatched = allText.includes(firstTerm);
    return matchRatio >= 0.55 && firstTermMatched;
  }

  return matchRatio >= 0.5;
}

/**
 * Execute verified web search using available provider
 */
export async function searchWeb(query: string, maxResults = 5): Promise<SearchResponse> {
  const cleanQ = query.trim();
  if (!cleanQ) {
    return { results: [], provider: "none", error: "Empty query" };
  }

  // 1. Primary: Tavily (supporting OAuth, API Key, CLI, and Keyless)
  try {
    const tavilyRes = await runTavilySearch(cleanQ, maxResults);
    if (tavilyRes.results && tavilyRes.results.length > 0) {
      return {
        results: tavilyRes.results,
        provider: tavilyRes.provider,
      };
    }
  } catch {
    // Graceful fallback to secondary providers
  }

  // 2. Try Serper if configured
  const serperResults = await searchSerper(cleanQ, maxResults);
  if (serperResults && serperResults.length > 0) {
    return { results: serperResults, provider: "Serper (API Key)" };
  }

  // 3. Try Brave if configured
  const braveResults = await searchBrave(cleanQ, maxResults);
  if (braveResults && braveResults.length > 0) {
    return { results: braveResults, provider: "Brave (API Key)" };
  }

  // 4. Default: DuckDuckGo (Free, zero-config)
  try {
    const ddgResults = await searchDuckDuckGo(cleanQ, maxResults);
    return { results: ddgResults, provider: "DuckDuckGo (Local Engine)" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Search error";
    return { results: [], provider: "DuckDuckGo", error: msg };
  }
}
