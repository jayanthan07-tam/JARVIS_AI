/**
 * Reliable AI Provider Engine for J.A.R.V.I.S.
 * - Primary: Local on-device Ollama (llama3.2:3b) on AMD Ryzen AI / host
 * - Secondary: Optional server-side Cloud AI fallback (Groq / OpenAI-compatible / OpenRouter)
 * - Zero client-side API key exposure.
 * - Graceful error handling and timeout protection.
 */

export interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AiProviderConfig {
  localHost: string;
  localModel: string;
  cloudApiKey?: string;
  cloudBaseUrl?: string;
  cloudModel?: string;
}

export function getAiConfig(): AiProviderConfig {
  const localHost = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
  const localModel = process.env.OLLAMA_MODEL || "llama3.2:3b";

  const cloudApiKey =
    process.env.CLOUD_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GROQ_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim();

  let cloudBaseUrl = process.env.CLOUD_AI_BASE_URL?.trim();
  let cloudModel = process.env.CLOUD_AI_MODEL?.trim();

  if (cloudApiKey) {
    if (!cloudBaseUrl) {
      if (process.env.GEMINI_API_KEY || cloudApiKey.startsWith("AIza")) {
        cloudBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
        cloudModel = cloudModel || "gemini-3.8-flash";
      } else if (cloudApiKey.startsWith("gsk_") || process.env.GROQ_API_KEY) {
        cloudBaseUrl = "https://api.groq.com/openai/v1";
        cloudModel = cloudModel || "llama-3.3-70b-versatile";
      } else {
        cloudBaseUrl = "https://api.openai.com/v1";
        cloudModel = cloudModel || "gpt-4o-mini";
      }
    }
  }

  return {
    localHost,
    localModel,
    cloudApiKey,
    cloudBaseUrl,
    cloudModel: cloudModel || "llama-3.3-70b-versatile",
  };
}

export interface ProviderHealth {
  localConnected: boolean;
  localModelAvailable: boolean;
  localModel: string;
  cloudConfigured: boolean;
  cloudProviderName: string;
  activeProvider: "local" | "cloud" | "offline";
  availableLocalModels: string[];
  error: string | null;
}

/**
 * Checks connectivity to local Ollama and verifies cloud provider configuration
 * without exposing sensitive API keys.
 */
export async function checkProviderHealth(): Promise<ProviderHealth> {
  const config = getAiConfig();
  let localConnected = false;
  let localModelAvailable = false;
  let availableLocalModels: string[] = [];
  let localError: string | null = null;

  try {
    const res = await fetch(`${config.localHost}/api/tags`, {
      signal: AbortSignal.timeout(3500),
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (res.ok) {
      localConnected = true;
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      availableLocalModels = (data.models || []).map((m) => m.name);
      localModelAvailable = availableLocalModels.some(
        (m) =>
          m === config.localModel ||
          m.startsWith("llama3.2:3b") ||
          m.startsWith("llama3.2")
      );
    } else {
      localError = `Ollama HTTP ${res.status}`;
    }
  } catch (err: unknown) {
    localError = err instanceof Error ? err.message : "Ollama unreachable";
  }

  const cloudConfigured = Boolean(
    config.cloudApiKey && config.cloudApiKey.length > 8
  );
  let cloudProviderName = "Not Configured";
  if (cloudConfigured) {
    if (config.cloudBaseUrl?.includes("generativelanguage.googleapis.com")) {
      cloudProviderName = `Google Gemini (${config.cloudModel})`;
    } else if (config.cloudBaseUrl?.includes("groq.com")) {
      cloudProviderName = `Groq Cloud (${config.cloudModel})`;
    } else if (config.cloudBaseUrl?.includes("openai.com")) {
      cloudProviderName = `OpenAI (${config.cloudModel})`;
    } else {
      cloudProviderName = `Custom Cloud Endpoint (${config.cloudModel})`;
    }
  }

  const activeProvider: "local" | "cloud" | "offline" =
    localConnected && localModelAvailable
      ? "local"
      : cloudConfigured
      ? "cloud"
      : "offline";

  return {
    localConnected,
    localModelAvailable,
    localModel: config.localModel,
    cloudConfigured,
    cloudProviderName,
    activeProvider,
    availableLocalModels,
    error: localError,
  };
}

/**
 * Stream completion from Cloud OpenAI-compatible endpoint
 */
export async function* streamCloudAi(
  messages: AiMessage[],
  config: AiProviderConfig,
  temperature = 0.7,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  if (!config.cloudApiKey || !config.cloudBaseUrl) {
    throw new Error("Cloud AI credentials not configured");
  }

  const res = await fetch(`${config.cloudBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.cloudApiKey}`,
    },
    body: JSON.stringify({
      model: config.cloudModel,
      messages,
      temperature,
      stream: true,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Cloud AI provider error (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === "[DONE]") return;
      try {
        const parsed = JSON.parse(dataStr);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) {
          yield token;
        }
      } catch {
        // ignore parse error
      }
    }
  }
}
