import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTemporalContext, resolveDirectDateTimeQuery, DEFAULT_TIMEZONE } from "@/lib/dateTime";
import {
  detectDesktopAction,
  executeDesktopAction,
  isLocalWindowsEnvironment,
  type DesktopActionDef,
} from "@/lib/desktopActions";
import { classifyFactualIntent } from "@/lib/factualIntent";
import { searchWeb, verifyRelevance } from "@/lib/webSearch";
import {
  detectSystemSpecsQuery,
  getSystemSpecs,
  formatSystemSpecsResponse,
  buildSystemSpecsPromptSnippet,
  type SystemQueryType,
  type SystemSpecs,
} from "@/lib/systemSpecs";
import { getAiConfig, streamCloudAi, type AiMessage } from "@/lib/aiProvider";
import { authorizeApiRequest, handleApiError, readJsonRequest } from "@/lib/apiSecurity";

// ── Latency diagnostics (stderr only — no prompts or personal data logged) ──
const t = () => performance.now();
function logTiming(label: string, ms: number) {
  process.stderr.write(`[JARVIS-PERF] ${label}: ${ms.toFixed(0)}ms\n`);
}

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.2:3b";

const DEFAULT_SYSTEM_PROMPT = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), the tactical AI assistant created by Tony Stark.
You are running locally on the user's workstation using the local neural architecture.
Persona guidelines:
- Sophisticated, articulate, respectful, and calm, with a British butler demeanor.
- Frequently address the user as "sir" (or "ma'am" if indicated).
- Concise, precise, and helpful. Do not ramble unnecessarily.
- When answering questions about yourself, acknowledge that you are J.A.R.V.I.S. powered locally by Ollama.
- Acknowledge that the 3D holographic orb and tactical interface represent your core telemetry visualizer.
- Distinguish verified facts from assumptions. Never invent real-world companies, products, credentials, or citations to make an answer sound complete.
- Admit uncertainty and ask for clarification if a topic or entity is ambiguous.
- Treat the supplied real-time date and time context as authoritative; the model's training cutoff is not a valid source for today's date or year.
- For current events and changing facts, use verified live-search evidence when provided. If live search is unavailable, say you cannot verify the current answer.
- Never claim you browsed the internet or checked live websites unless live search evidence is explicitly provided in the prompt.`;

function createTextStreamResponse(text: string) {
  const encoder = new TextEncoder();
  const words = text.split(" ");
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < words.length; i++) {
        const token = (i === 0 ? "" : " ") + words[i];
        controller.enqueue(encoder.encode(token));
        if (i < words.length - 1) {
          await new Promise((r) => setTimeout(r, 20));
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
}

function createDesktopActionStream(action: DesktopActionDef) {
  const encoder = new TextEncoder();
  const envCheck = isLocalWindowsEnvironment();
  const stream = new ReadableStream({
    async start(controller) {
      // Refuse up front in unsupported environments; never announce "Opening..." first.
      if (!envCheck.allowed) {
        controller.enqueue(
          encoder.encode(`Directive aborted, sir: ${envCheck.reason}`)
        );
        controller.close();
        return;
      }

      // 1. Send status feedback to chat UI
      controller.enqueue(encoder.encode(action.statusMessage));

      // 2. Brief pause for UI rendering
      await new Promise((r) => setTimeout(r, 250));

      // 3. Execute safe Windows desktop action
      const result = await executeDesktopAction(action);

      // 4. Brief pause for execution feedback
      await new Promise((r) => setTimeout(r, 250));

      // 5. Append confirmed result or failure
      controller.enqueue(encoder.encode("\n\n" + result.message));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
}

function createGroundedChatStream(
  searchQuery: string,
  targetModel: string,
  userMessages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  temporal: ReturnType<typeof getTemporalContext>,
  memoriesSnippet: string
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const t0 = t();
      // 1. Live feedback status indicator
      controller.enqueue(
        encoder.encode(`Retrieving verified intelligence for "${searchQuery}" via Tavily...\n\n`)
      );

      await new Promise((r) => setTimeout(r, 150));

      // 2. Verified web search (Tavily OAuth / API Key / CLI / Keyless)
      const searchRes = await searchWeb(searchQuery, 5);

      // 3. Error or network offline handling
      if (searchRes.error && searchRes.results.length === 0) {
        controller.enqueue(
          encoder.encode(
            `Web search is currently unavailable, sir. I cannot retrieve verified sources for "${searchQuery}" right now. Please check the server connection and search-provider configuration.`
          )
        );
        controller.close();
        return;
      }

      // 4. Relevance verification: prevent hallucinations on unverified entities
      const isRelevant = verifyRelevance(searchQuery, searchRes.results);
      if (!isRelevant || searchRes.results.length === 0) {
        controller.enqueue(
          encoder.encode(
            `I searched for verified sources regarding "${searchQuery}", but could not find any reliable records, official websites, or directory listings confirming this entity, sir. To ensure factual accuracy without speculation, could you provide an official website, address, or other identifying details?`
          )
        );
        controller.close();
        return;
      }

      // 5. Build strict factual grounding prompt
      const evidenceFormatted = searchRes.results
        .map(
          (r, i) =>
            `[Source ${i + 1}]: "${r.title}"\nURL: ${r.url}\nVerified Excerpt: ${r.snippet}`
        )
        .join("\n\n");

      const sourcesList = searchRes.results
        .slice(0, 4)
        .map((r) => `- [${r.title}](${r.url})`)
        .join("\n");

      const groundedSystemPrompt = `You are J.A.R.V.I.S., the tactical AI assistant created by Tony Stark.
You are running locally on the user's workstation using the local neural architecture.
${temporal.systemPromptSnippet}
${memoriesSnippet}

[VERIFIED EVIDENCE RETRIEVED FROM REAL-TIME WEB SEARCH]
Target Query: "${searchQuery}"
Retrieval Provider: ${searchRes.provider}
Verified Excerpts:
${evidenceFormatted}

CRITICAL GROUNDING DIRECTIVES:
1. Base all factual statements STRICTLY and EXCLUSIVELY on the verified evidence provided above.
2. Distinguish verified facts from assumptions. NEVER invent or extrapolate products, clients, manufacturing capabilities, certifications, or history not present in the excerpts.
3. If the query refers to an educational institution (such as V.S.B. Engineering College in Karur, Tamil Nadu), describe it accurately as an engineering college affiliated with Anna University and approved by AICTE, NOT a manufacturing company.
4. If multiple businesses or entities match or the name is ambiguous, state what was verified and ask the user for clarification.
5. Address the user respectfully as "sir".
6. Keep your answer concise, articulate, and natural.
7. You MUST conclude your response with the exact verified sources below:

**Verified Sources:**
${sourcesList}`;

      // 6. Inference via Ollama with low temperature
      try {
        const ollamaMessages = [
          { role: "system", content: groundedSystemPrompt },
          ...userMessages,
        ];

        const tOllamaSearch = t();
        const ollamaRes = await fetch(`${OLLAMA_HOST}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: targetModel,
            messages: ollamaMessages,
            stream: true,
            keep_alive: "30m",
            options: { temperature: 0.15, num_predict: 512, num_ctx: 4096 },
          }),
          signal: AbortSignal.timeout(90000),
        });

        if (!ollamaRes.ok || !ollamaRes.body) {
          const fallbackText =
            `Sir, I retrieved verified intelligence for "${searchQuery}" via ${searchRes.provider}, though the local neural core is temporarily unreachable (${ollamaRes.status}). Here are the key verified findings:\n\n` +
            searchRes.results
              .slice(0, 3)
              .map((r) => `• **${r.title}**: ${r.snippet}\n  [Source: ${r.title}](${r.url})`)
              .join("\n\n") +
            `\n\n**Verified Sources:**\n${sourcesList}`;
          controller.enqueue(encoder.encode(fallbackText));
          controller.close();
          return;
        }

        const reader = ollamaRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let firstTokenLogged = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.message?.content) {
                if (!firstTokenLogged) {
                  logTiming("grounded-search-TTFT (search+ollama)", t() - t0);
                  logTiming("grounded-search-ollama-wait", t() - tOllamaSearch);
                  firstTokenLogged = true;
                }
                controller.enqueue(encoder.encode(parsed.message.content));
              }
            } catch {
              // ignore
            }
          }
        }

        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer.trim());
            if (parsed.message?.content) {
              controller.enqueue(encoder.encode(parsed.message.content));
            }
          } catch {
            // ignore
          }
        }

        controller.close();
      } catch {
        const fallbackText =
          `Sir, I retrieved verified intelligence for "${searchQuery}" via ${searchRes.provider}, though local neural synthesis encountered an interruption. Here are the verified findings:\n\n` +
          searchRes.results
            .slice(0, 3)
            .map((r) => `• **${r.title}**: ${r.snippet}\n  [Source: ${r.title}](${r.url})`)
            .join("\n\n") +
          `\n\n**Verified Sources:**\n${sourcesList}`;
        controller.enqueue(encoder.encode(fallbackText));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
}

function createSystemSpecsStream(
  category: SystemQueryType,
  targetModel: string,
  userMessages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  temporal: ReturnType<typeof getTemporalContext>,
  memoriesSnippet: string
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // 1. Initial live telemetry indicator
      controller.enqueue(
        encoder.encode("Retrieving verified workstation hardware telemetry...\n\n")
      );

      await new Promise((r) => setTimeout(r, 100));

      // 2. Query real local Windows host specifications
      let specs: SystemSpecs;
      try {
        specs = await getSystemSpecs();
      } catch {
        controller.enqueue(
          encoder.encode("Unable to query workstation telemetry right now, sir. Check the server configuration and try again.")
        );
        controller.close();
        return;
      }

      // 2b. If the live hardware query failed, do not let the model describe a laptop.
      if (!specs.queryOk) {
        controller.enqueue(
          encoder.encode(
            `I could not read live hardware details from this Windows workstation, sir (the system query did not return data). ` +
              `I will not guess your laptop's specifications. Operating system: ${specs.osName}. ` +
              `Processor reported by Node: ${specs.cpuName}. Installed RAM: ${specs.totalMemoryGb.toFixed(1)} GB. ` +
              `Please ensure PowerShell is available and try again.`
          )
        );
        controller.close();
        return;
      }

      // 3. Build verified grounding prompt and deterministic fallback
      const groundingSnippet = buildSystemSpecsPromptSnippet(specs);
      const directAnswer = formatSystemSpecsResponse(category, specs);

      const groundedSystemPrompt = `You are J.A.R.V.I.S., the tactical AI assistant created by Tony Stark.
You are running locally on the user's workstation using the local neural architecture.
${temporal.systemPromptSnippet}
${memoriesSnippet}

${groundingSnippet}

CRITICAL VERIFICATION DIRECTIVES:
1. You MUST answer the user's inquiry using EXCLUSIVELY the verified live hardware specifications above.
2. DO NOT alter numbers, do not substitute other laptop models, and do not invent specifications from memory.
3. If the user asks for laptop specs, state their exact model (${specs.manufacturer} ${specs.model}), processor (${specs.cpuName}), RAM (${specs.totalMemoryGb.toFixed(1)} GB), GPU (${specs.primaryGpu}), storage, and battery.
4. If the user asks for CPU and RAM, focus on those exact values.
5. If the user asks for storage on C and D drives, provide the exact total and free space for each drive.
6. If the user asks for battery percentage, state the exact percentage and charging status (${specs.battery.statusText}).
7. Address the user respectfully as "sir".
8. Keep your response concise, articulate, and completely factual.`;

      // 4. Stream response via Ollama with low temperature
      try {
        const ollamaMessages = [
          { role: "system", content: groundedSystemPrompt },
          ...userMessages,
        ];

        const ollamaRes = await fetch(`${OLLAMA_HOST}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: targetModel,
            messages: ollamaMessages,
            stream: true,
            keep_alive: "30m",
            options: { temperature: 0.15, num_predict: 256, num_ctx: 4096 },
          }),
          signal: AbortSignal.timeout(90000),
        });

        if (ollamaRes.ok && ollamaRes.body) {
          const reader = ollamaRes.body.getReader();
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
              if (!trimmed) continue;
              try {
                const parsed = JSON.parse(trimmed);
                if (parsed.message?.content) {
                  controller.enqueue(encoder.encode(parsed.message.content));
                }
              } catch {}
            }
          }

          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer.trim());
              if (parsed.message?.content) {
                controller.enqueue(encoder.encode(parsed.message.content));
              }
            } catch {}
          }

          controller.close();
          return;
        }
      } catch {
        // Fallback to deterministic answer if Ollama is unreachable
      }

      // 5. Deterministic fallback
      controller.enqueue(encoder.encode(directAnswer));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Maximum number of messages (user+assistant) forwarded to Ollama to bound context growth. */
const MAX_HISTORY_MESSAGES = 8;

export async function POST(req: NextRequest) {
  try {
    const blocked = await authorizeApiRequest(req, "chat");
    if (blocked) return blocked;

    const body = await readJsonRequest(req, 128 * 1024);
    const rawMessages = body.messages;
    const model = body.model;
    const temperature = body.temperature;
    const systemPrompt = body.systemPrompt;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0 || rawMessages.length > 32) {
      return NextResponse.json(
        { error: "Provide between 1 and 32 chat messages." },
        { status: 400 }
      );
    }

    const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];
    let totalMessageCharacters = 0;
    for (const rawMessage of rawMessages) {
      if (typeof rawMessage !== "object" || rawMessage === null || Array.isArray(rawMessage)) {
        return NextResponse.json({ error: "Each message must have a role and text." }, { status: 400 });
      }
      const message = rawMessage as Record<string, unknown>;
      if (
        !["user", "assistant", "system"].includes(String(message.role)) ||
        typeof message.content !== "string" ||
        message.content.length > 16_000
      ) {
        return NextResponse.json({ error: "A chat message has an invalid role or text length." }, { status: 400 });
      }
      totalMessageCharacters += message.content.length;
      if (totalMessageCharacters > 64_000) {
        return NextResponse.json({ error: "The chat history is too large." }, { status: 413 });
      }
      messages.push({
        role: message.role as "user" | "assistant" | "system",
        content: message.content,
      });
    }

    if (
      model !== undefined &&
      (typeof model !== "string" || !/^[A-Za-z0-9_-]+(?:[./][A-Za-z0-9_-]+)*(?::[A-Za-z0-9._-]+)?$/.test(model))
    ) {
      return NextResponse.json({ error: "The requested model name is invalid." }, { status: 400 });
    }
    if (temperature !== undefined && (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 1.2)) {
      return NextResponse.json({ error: "Temperature must be between 0 and 1.2." }, { status: 400 });
    }
    if (systemPrompt !== undefined && (typeof systemPrompt !== "string" || systemPrompt.length > 8_000)) {
      return NextResponse.json({ error: "The system prompt is too large." }, { status: 400 });
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    if (!lastUserMessage.trim()) {
      return NextResponse.json({ error: "The latest user message cannot be empty." }, { status: 400 });
    }

    // 1. Check for Desktop Actions first (deterministic, strictly allowlisted)
    const actionCheck = detectDesktopAction(lastUserMessage);
    if (actionCheck.isAction) {
      if (actionCheck.isSupported && actionCheck.actionDef) {
        return createDesktopActionStream(actionCheck.actionDef);
      } else {
        return createTextStreamResponse(
          actionCheck.unsupportedMessage ||
          "I am unable to execute that directive, sir. Only verified desktop actions on the security allowlist are permitted."
        );
      }
    }

    // 2. Calculate live temporal telemetry in Asia/Kolkata timezone
    const temporal = getTemporalContext(new Date(), DEFAULT_TIMEZONE);

    // 3. Check for direct date/time questions
    const directAnswer = resolveDirectDateTimeQuery(lastUserMessage, temporal);
    if (directAnswer) {
      return createTextStreamResponse(directAnswer);
    }

    const targetModel = (typeof model === "string" ? model.trim() : "") || DEFAULT_MODEL;

    // Retrieve user memories snippet if available (single DB read shared by all branches)
    let memoriesSnippet = "";
    try {
      const db = getDb();
      const memories = db.prepare("SELECT fact FROM memories ORDER BY created_at DESC LIMIT 10").all() as Array<{ fact: string }>;
      if (memories && memories.length > 0) {
        memoriesSnippet = "\n\nLong-term User Knowledge & Memories:\n" + memories.map((m) => `- ${m.fact}`).join("\n");
      }
    } catch {}

    // Trim history to bound context size (keep system messages + last N turns)
    const userOnlyMessages = messages
      .filter((m) => m.role !== "system")
      .slice(-MAX_HISTORY_MESSAGES);

    // 4. Check for System Hardware Specifications query (grounded with real live laptop specs)
    const sysQueryCheck = detectSystemSpecsQuery(lastUserMessage);
    if (sysQueryCheck.isSystemQuery) {
      return createSystemSpecsStream(
        sysQueryCheck.category,
        targetModel,
        userOnlyMessages,
        temporal,
        memoriesSnippet
      );
    }

    // 5. Check for Factual Information Retrieval Intent
    const factualCheck = classifyFactualIntent(lastUserMessage);
    if (factualCheck.requiresSearch && factualCheck.searchQuery) {
      return createGroundedChatStream(
        factualCheck.searchQuery,
        targetModel,
        userOnlyMessages,
        temporal,
        memoriesSnippet
      );
    }

    let basePrompt = systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;

    // Inject real-time temporal reference and memories into system prompt (re-use memoriesSnippet — no second DB query)
    basePrompt += "\n\n" + temporal.systemPromptSnippet;
    if (memoriesSnippet) {
      basePrompt += memoriesSnippet;
    }

    // Ensure system prompt is at the beginning; send only trimmed history
    const ollamaMessages: AiMessage[] = [
      { role: "system", content: basePrompt },
      ...userOnlyMessages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ];

    const requestTimeout = AbortSignal.timeout(90_000);

    const tOllamaStart = t();
    const aiConfig = getAiConfig();
    let ollamaRes: Response | null = null;
    let localFailed = false;

    try {
      ollamaRes = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: targetModel,
          messages: ollamaMessages,
          stream: true,
          keep_alive: "30m",
          options: {
            temperature: typeof temperature === "number" ? temperature : 0.7,
            num_predict: 256,
            num_ctx: 4096,
          },
        }),
        signal: requestTimeout,
      });

      if (!ollamaRes.ok || !ollamaRes.body) {
        localFailed = true;
      }
    } catch {
      localFailed = true;
    }

    // 1. If local Ollama succeeded, stream its tokens directly
    if (ollamaRes && ollamaRes.ok && ollamaRes.body && !localFailed) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let buffer = "";
      let firstToken = true;

      const transformStream = new TransformStream({
        async transform(chunk, controllerStream) {
          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.message?.content) {
                if (firstToken) {
                  logTiming("chat-TTFT", t() - tOllamaStart);
                  firstToken = false;
                }
                controllerStream.enqueue(encoder.encode(parsed.message.content));
              }
              if (parsed.done === true && parsed.total_duration != null) {
                logTiming("chat-total (ollama)", parsed.total_duration / 1e6);
              }
            } catch {
              // ignore malformed line
            }
          }
        },
        flush(controllerStream) {
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer.trim());
              if (parsed.message?.content) {
                controllerStream.enqueue(encoder.encode(parsed.message.content));
              }
            } catch {
              // ignore malformed line
            }
          }
        },
      });

      return new Response(ollamaRes.body.pipeThrough(transformStream), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Content-Type-Options": "nosniff",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // 2. Local Ollama is offline or unreachable -> Route via verified Cloud AI Fallback if configured
    if (aiConfig.cloudApiKey) {
      try {
        const stream = new ReadableStream({
          async start(ctrl) {
            const enc = new TextEncoder();
            try {
              for await (const token of streamCloudAi(
                ollamaMessages,
                aiConfig,
                typeof temperature === "number" ? temperature : 0.7,
                AbortSignal.timeout(90_000)
              )) {
                ctrl.enqueue(enc.encode(token));
              }
            } catch (cloudErr: unknown) {
              const errorName = cloudErr instanceof Error ? cloudErr.name : "ProviderError";
              process.stderr.write(`[JARVIS-API] cloud chat failed (${errorName})\n`);
              ctrl.enqueue(
                enc.encode("\n\n[Cloud AI could not respond. Check the server-side provider configuration and try again, sir.]")
              );
            } finally {
              ctrl.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Content-Type-Options": "nosniff",
            "X-Accel-Buffering": "no",
          },
        });
      } catch {}
    }

    // 3. Neither Local Ollama nor Cloud AI available -> Return graceful assistant response
    return createTextStreamResponse(
      `Sir, the local neural core (Ollama: ${targetModel}) is currently unavailable on this server, and no cloud AI provider is configured.\n\n` +
        `Please verify that Ollama is active on your workstation (e.g. run 'ollama serve' or check Task Manager). ` +
        `Workstation hardware telemetry, local desktop actions, and temporal date/time queries remain fully operational.`
    );
  } catch (err: unknown) {
    return handleApiError("chat", err);
  }
}
