import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { tavily, TavilyKeylessLimitError } from "@tavily/core";

const execFileAsync = promisify(execFile);

export interface TavilyResultItem {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  source: string;
}

export interface TavilySearchOutput {
  results: TavilyResultItem[];
  provider: string;
  error?: string;
  rateLimited?: boolean;
}

interface StoredTavilyConfig {
  api_key?: string;
  oauth?: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    client_id?: string;
    client_secret?: string;
  };
}

/**
 * Safely resolves Tavily credentials without exposing or logging secrets.
 */
export function getTavilyCredentials(): {
  apiKey?: string;
  oauthToken?: string;
} {
  // 1. Process environment variable takes precedence
  const envKey = process.env.TAVILY_API_KEY?.trim();
  if (envKey) {
    if (envKey.startsWith("tvly-")) {
      return { apiKey: envKey };
    }
    return { oauthToken: envKey };
  }

  // 2. Read ~/.tavily/config.json
  try {
    const configPath = path.join(
      /*turbopackIgnore: true*/ os.homedir(),
      ".tavily",
      "config.json"
    );
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed: StoredTavilyConfig = JSON.parse(raw);
      if (typeof parsed.api_key === "string" && parsed.api_key.trim()) {
        return { apiKey: parsed.api_key.trim() };
      }
      if (
        parsed.oauth &&
        typeof parsed.oauth.access_token === "string" &&
        parsed.oauth.access_token.trim()
      ) {
        return { oauthToken: parsed.oauth.access_token.trim() };
      }
    }
  } catch {
    // Gracefully ignore filesystem/permission issues
  }

  return {};
}

/**
 * Clean text snippet and title
 */
function sanitizeSnippet(text: string): string {
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
 * Resolve the tvly CLI binary location across common environments
 */
function findTvlyBinary(): string {
  const candidates = [
    "tvly",
    "D:\\Python\\Scripts\\tvly.exe",
    path.join(/*turbopackIgnore: true*/ os.homedir(), "AppData", "Roaming", "Python", "Scripts", "tvly.exe"),
    path.join(/*turbopackIgnore: true*/ os.homedir(), "AppData", "Local", "Programs", "Python", "Python311", "Scripts", "tvly.exe"),
  ];

  for (const candidate of candidates) {
    if (candidate === "tvly") continue;
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }

  return "tvly";
}

/**
 * Search via Tavily MCP Endpoint (used for OAuth access tokens)
 */
async function searchViaMcp(
  token: string,
  query: string,
  maxResults: number
): Promise<{ results: TavilyResultItem[]; rateLimited?: boolean } | null> {
  const sessionId = crypto.randomUUID();
  try {
    const res = await fetch("https://mcp.tavily.com/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "x-client-source": "jarvis-ai",
        "mcp-session-id": sessionId,
        "X-Session-Id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "tavily_search",
          arguments: {
            query,
            max_results: maxResults,
          },
        },
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (res.status === 429) {
      return { results: [], rateLimited: true };
    }

    if (!res.ok) {
      return null;
    }

    const rawText = await res.text();
    let searchPayload: any = null;

    for (const line of rawText.split("\n")) {
      if (line.startsWith("data:")) {
        try {
          const data = JSON.parse(line.slice(5).trim());
          const contentList = data.result?.content || [];
          if (contentList.length > 0 && contentList[0].text) {
            searchPayload = JSON.parse(contentList[0].text);
            break;
          }
        } catch {
          // continue parsing
        }
      }
    }

    if (!searchPayload && rawText.includes('"results"')) {
      try {
        const parsed = JSON.parse(rawText);
        searchPayload = parsed.result?.structuredContent || parsed.result || parsed;
      } catch {
        // ignore
      }
    }

    if (searchPayload?.results && Array.isArray(searchPayload.results)) {
      const items = searchPayload.results.map((r: any) => ({
        title: sanitizeSnippet(r.title || "Tavily Source"),
        url: r.url,
        snippet: sanitizeSnippet(r.content || r.snippet || ""),
        score: r.score,
        source: "Tavily",
      }));
      return { results: items };
    }

    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("limit")) {
      return { results: [], rateLimited: true };
    }
    return null;
  }
}

/**
 * Search via Tavily CLI subprocess (with automatic OAuth token refreshing)
 */
async function searchViaCli(
  query: string,
  maxResults: number
): Promise<{ results: TavilyResultItem[]; rateLimited?: boolean } | null> {
  const bin = findTvlyBinary();
  try {
    const { stdout } = await execFileAsync(
      bin,
      ["search", query, "--max-results", String(maxResults), "--json"],
      {
        timeout: 15000,
        env: {
          ...process.env,
          PYTHONUTF8: "1",
        },
      }
    );

    const data = JSON.parse(stdout);
    if (data?.results && Array.isArray(data.results)) {
      const items = data.results.map((r: any) => ({
        title: sanitizeSnippet(r.title || "Tavily Source"),
        url: r.url,
        snippet: sanitizeSnippet(r.content || r.snippet || ""),
        score: r.score,
        source: "Tavily",
      }));
      return { results: items };
    }
    return { results: [] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("limit")) {
      return { results: [], rateLimited: true };
    }
    return null;
  }
}

/**
 * Search via official @tavily/core SDK (API Key or Keyless)
 */
async function searchViaSdk(
  apiKey: string | undefined,
  query: string,
  maxResults: number
): Promise<{ results: TavilyResultItem[]; rateLimited?: boolean } | null> {
  try {
    const client = tavily(apiKey ? { apiKey } : {});
    const resp = await client.search(query, {
      maxResults,
      searchDepth: "basic",
    });

    if (resp?.results && Array.isArray(resp.results)) {
      const items = resp.results.map((r: any) => ({
        title: sanitizeSnippet(r.title || "Tavily Source"),
        url: r.url,
        snippet: sanitizeSnippet(r.content || ""),
        score: r.score,
        source: "Tavily",
      }));
      return { results: items };
    }
    return { results: [] };
  } catch (err: unknown) {
    if (err instanceof TavilyKeylessLimitError) {
      return { results: [], rateLimited: true };
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("limit")) {
      return { results: [], rateLimited: true };
    }
    return null;
  }
}

/**
 * Main Tavily search function combining official SDK, MCP OAuth, CLI, and Keyless
 */
export async function searchTavily(
  query: string,
  maxResults = 5
): Promise<TavilySearchOutput> {
  // Respect Tavily skill guideline: Keep queries under 400 characters
  const cleanQ = query.trim().slice(0, 400);
  if (!cleanQ) {
    return { results: [], provider: "Tavily", error: "Empty query string" };
  }

  const creds = getTavilyCredentials();

  // 1. If user has an explicit API key (tvly-...)
  if (creds.apiKey) {
    const sdkRes = await searchViaSdk(creds.apiKey, cleanQ, maxResults);
    if (sdkRes) {
      if (sdkRes.rateLimited) {
        return {
          results: [],
          provider: "Tavily (API Key)",
          error: "Tavily API rate limit reached",
          rateLimited: true,
        };
      }
      if (sdkRes.results.length > 0) {
        return {
          results: sdkRes.results,
          provider: "Tavily (API Key)",
        };
      }
    }
  }

  // 2. If user has an authenticated OAuth token (from tvly init / tvly login)
  if (creds.oauthToken) {
    try {
      const mcpResults = await searchViaMcp(creds.oauthToken, cleanQ, maxResults);
      if (mcpResults) {
        if (mcpResults.rateLimited) {
          return {
            results: [],
            provider: "Tavily (OAuth)",
            error: "Tavily OAuth rate limit reached",
            rateLimited: true,
          };
        }
        if (mcpResults.results.length > 0) {
          return {
            results: mcpResults.results,
            provider: "Tavily (OAuth)",
          };
        }
      }
    } catch {
      // MCP fetch error, fallback to CLI
    }

    // Try CLI fallback which auto-refreshes OAuth tokens
    const cliResults = await searchViaCli(cleanQ, maxResults);
    if (cliResults) {
      if (cliResults.rateLimited) {
        return {
          results: [],
          provider: "Tavily CLI (OAuth)",
          error: "Tavily CLI rate limit reached",
          rateLimited: true,
        };
      }
      if (cliResults.results.length > 0) {
        return {
          results: cliResults.results,
          provider: "Tavily CLI (OAuth)",
        };
      }
    }
  }

  // 3. Try official @tavily/core SDK keyless mode
  try {
    const keylessRes = await searchViaSdk(undefined, cleanQ, maxResults);
    if (keylessRes) {
      if (keylessRes.rateLimited) {
        return {
          results: [],
          provider: "Tavily (Keyless)",
          error: "Tavily keyless rate limit exceeded",
          rateLimited: true,
        };
      }
      if (keylessRes.results.length > 0) {
        return {
          results: keylessRes.results,
          provider: "Tavily (Keyless)",
        };
      }
    }
  } catch {
    // Keyless error
  }

  // 4. Try CLI keyless mode as final Tavily fallback
  const cliFallback = await searchViaCli(cleanQ, maxResults);
  if (cliFallback) {
    if (cliFallback.rateLimited) {
      return {
        results: [],
        provider: "Tavily CLI",
        error: "Tavily rate limit reached",
        rateLimited: true,
      };
    }
    if (cliFallback.results.length > 0) {
      return {
        results: cliFallback.results,
        provider: "Tavily CLI",
      };
    }
  }

  return {
    results: [],
    provider: "Tavily",
    error: "Tavily search produced no results",
  };
}
