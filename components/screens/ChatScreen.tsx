"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import FormattedMessage from "@/components/FormattedMessage";

export interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

interface ChatScreenProps {
  initialText?: string;
  isOnline: boolean;
  modelName: string;
}

export default function ChatScreen({
  initialText = "",
  isOnline,
  modelName,
}: ChatScreenProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("default");

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "initial-0",
      role: "assistant",
      content:
        "J.A.R.V.I.S. neural link online. Local model llama3.2:3b active on host. All systems nominal. How may I be of assistance, sir?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState(initialText);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamTextRef = useRef("");
  const streamFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Load conversations from SQLite
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth" });
  }, [messages, streamBuffer, isStreaming]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (streamFrameRef.current !== null) {
        cancelAnimationFrame(streamFrameRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  // Load conversation messages when activeConvId changes
  const switchConversation = async (convId: string) => {
    if (convId === "default") {
      setActiveConvId("default");
      return;
    }
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveConvId(convId);
        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            }))
          );
        }
      }
    } catch {
      // ignore
    }
  };

  const createNewSession = async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Session ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` }),
      });
      if (res.ok) {
        const data = await res.json();
        await loadConversations();
        setActiveConvId(data.conversation.id);
        setMessages([
          {
            id: `initial-${Date.now()}`,
            role: "assistant",
            content: "New directive session initiated, sir. Awaiting your instructions.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch {
      setActiveConvId(`temp_${Date.now()}`);
      setMessages([
        {
          id: `initial-${Date.now()}`,
          role: "assistant",
          content: "New session active. Awaiting your instructions, sir.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  };

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isStreaming) return;

    setInput("");
    setChatError(null);
    streamTextRef.current = "";
    if (streamFrameRef.current !== null) {
      cancelAnimationFrame(streamFrameRef.current);
      streamFrameRef.current = null;
    }

    const userMsg: MessageItem = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsStreaming(true);
    setStreamBuffer("");

    // Persist user message to SQLite if inside an active saved conversation
    if (activeConvId && activeConvId !== "default") {
      void fetch(`/api/conversations/${activeConvId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: text }),
      });
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const apiPayload = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiPayload }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}: ${res.statusText}`);
      }

      if (!res.body) {
        throw new Error("Empty response stream received from local Ollama.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        streamTextRef.current = accumulated;
        if (streamFrameRef.current === null) {
          streamFrameRef.current = requestAnimationFrame(() => {
            streamFrameRef.current = null;
            if (mountedRef.current) setStreamBuffer(streamTextRef.current);
          });
        }
      }

      accumulated += decoder.decode();
      streamTextRef.current = accumulated;

      const finalReply = accumulated.trim() || "(No response received)";
      const assistantMsg: MessageItem = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: finalReply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setStreamBuffer("");

      // Persist assistant message to SQLite
      if (activeConvId && activeConvId !== "default") {
        void fetch(`/api/conversations/${activeConvId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "assistant", content: finalReply }),
        });
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (mountedRef.current && streamTextRef.current) {
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: streamTextRef.current + " [Stream Interrupted]",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }
      } else {
        const errorText = err instanceof Error ? err.message : "Failed to obtain response";
        if (mountedRef.current) setChatError(errorText);
      }
    } finally {
      if (streamFrameRef.current !== null) {
        cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
      }
      if (mountedRef.current) {
        setIsStreaming(false);
        setStreamBuffer("");
      }
      streamTextRef.current = "";
      abortControllerRef.current = null;
    }
  };

  const lastSentTextRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialText && initialText.trim() && lastSentTextRef.current !== initialText) {
      lastSentTextRef.current = initialText;
      void sendMessage(initialText);
    }
  }, [initialText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const quickPrompts = [
    "Open YouTube",
    "Open Notepad",
    "Open Calculator",
    "Open Settings",
    "Open File Explorer",
    "What time is it?",
    "What is today's date?",
    "Status report, Jarvis.",
  ];

  return (
    <div className="screen-chat-container">
      {/* Sidebar: Conversation Sessions */}
      <aside className="chat-sessions-sidebar">
        <div className="sessions-header">
          <span className="sessions-title">DIRECTIVE LOGS</span>
          <button type="button" className="new-session-btn" onClick={createNewSession}>
            + NEW SESSION
          </button>
        </div>

        <div className="sessions-list">
          <button
            type="button"
            className={`session-item ${activeConvId === "default" ? "active" : ""}`}
            onClick={() => switchConversation("default")}
          >
            <span className="session-tag">ACT</span>
            <span className="session-name">Primary Live Feed</span>
          </button>

          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`session-item ${activeConvId === c.id ? "active" : ""}`}
              onClick={() => switchConversation(c.id)}
            >
              <span className="session-tag">LOG</span>
              <span className="session-name">{c.title}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-main-area">
        {/* Connection status header */}
        <div className="chat-status-bar">
          <div className="chat-model-info">
            <span className={`status-indicator ${isOnline ? "online" : "offline"}`} />
            <span className="info-text">
              {isOnline ? `NEURAL LINK // ${modelName.toUpperCase()} (LOCAL)` : "OLLAMA OFFLINE // CONNECT LOCALHOST:11434"}
            </span>
          </div>
          <div className="chat-session-badge">
            SESSION: {activeConvId.toUpperCase()}
          </div>
        </div>

        {/* Message feed */}
        <div className="chat-messages-scroll" style={{ scrollBehavior: isStreaming ? "auto" : "smooth" }}>
          {messages.map((m) => (
            <div key={m.id} className={`chat-bubble-row ${m.role}`}>
              <div className="bubble-header">
                <span className="sender-tag">{m.role === "user" ? "USER // OPERATOR" : "J.A.R.V.I.S."}</span>
                <span className="bubble-time">{m.timestamp}</span>
              </div>
              <div className="bubble-body">
                <FormattedMessage content={m.content} />
              </div>
            </div>
          ))}

          {/* Live streaming chunk */}
          {isStreaming && (
            <div className="chat-bubble-row assistant streaming">
              <div className="bubble-header">
                <span className="sender-tag">J.A.R.V.I.S.</span>
                <span className="streaming-tag">NEURAL STREAMING...</span>
              </div>
              <div className="bubble-body">
                {streamBuffer ? (
                  <span>{streamBuffer}</span>
                ) : (
                  "Processing directive..."
                )}
                <span className="cursor-caret" />
              </div>
            </div>
          )}

          {/* Error Banner */}
          {chatError && (
            <div className="chat-error-alert">
              <strong>FAULT:</strong> {chatError}
            </div>
          )}

          <div ref={logEndRef} />
        </div>

        {/* Quick Prompts Bar */}
        <div className="chat-quick-prompts">
          {quickPrompts.map((p) => (
            <button
              key={p}
              type="button"
              className="quick-prompt-chip"
              onClick={() => void sendMessage(p)}
              disabled={isStreaming}
            >
              [ {p} ]
            </button>
          ))}
        </div>

        {/* Composer Input */}
        <div className="chat-composer-box">
          <textarea
            className="chat-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Transmit directive to J.A.R.V.I.S. (Enter sends, Shift+Enter new line)..."
            rows={2}
            disabled={isStreaming}
          />
          <div className="composer-actions">
            {isStreaming ? (
              <button
                type="button"
                className="hud-action-btn stop"
                onClick={() => abortControllerRef.current?.abort()}
              >
                HALT GENERATION
              </button>
            ) : (
              <button
                type="button"
                className="hud-action-btn transmit"
                onClick={() => void sendMessage()}
                disabled={!input.trim()}
              >
                TRANSMIT
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
