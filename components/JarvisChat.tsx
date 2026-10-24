"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import FormattedMessage from "@/components/FormattedMessage";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface OllamaStatus {
  connected: boolean;
  model: string;
  modelAvailable: boolean;
  error: string | null;
}

const QUICK_DIRECTIVES = [
  "Status report, Jarvis.",
  "Run lab diagnostics.",
  "What is your current neural architecture?",
  "Explain available gesture controls.",
];

export default function JarvisChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-0",
      role: "assistant",
      content:
        "J.A.R.V.I.S. neural core initialized. Local model llama3.2:3b active on host. All systems nominal. How may I be of assistance, sir?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  const [status, setStatus] = useState<OllamaStatus>({
    connected: false,
    model: "llama3.2:3b",
    modelAvailable: false,
    error: null,
  });
  const [checkingStatus, setCheckingStatus] = useState(true);

  const logEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkOllamaStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      const data = await res.json();
      setStatus({
        connected: Boolean(data.connected),
        model: data.model || "llama3.2:3b",
        modelAvailable: Boolean(data.modelAvailable),
        error: data.error || null,
      });
    } catch {
      setStatus({
        connected: false,
        model: "llama3.2:3b",
        modelAvailable: false,
        error: "Failed to ping local Ollama service.",
      });
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    void checkOllamaStatus();
    const interval = setInterval(checkOllamaStatus, 15000);
    return () => clearInterval(interval);
  }, [checkOllamaStatus]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamBuffer]);

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isStreaming) return;

    setInput("");
    setChatError(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsStreaming(true);
    setStreamBuffer("");

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
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${res.status}: ${res.statusText}`);
      }

      if (!res.body) {
        throw new Error("No response stream received from local Ollama.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setStreamBuffer(accumulated);
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: accumulated.trim() || "(No response received)",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setStreamBuffer("");
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User aborted request
        if (streamBuffer) {
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: streamBuffer + " [Stream Interrupted]",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }
      } else {
        const errorText = err instanceof Error ? err.message : "Failed to obtain response";
        setChatError(errorText);
      }
    } finally {
      setIsStreaming(false);
      setStreamBuffer("");
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const clearChat = () => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
    }
    setMessages([
      {
        id: `initial-${Date.now()}`,
        role: "assistant",
        content: "Memory buffer refreshed, sir. Tactical neural link ready.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setChatError(null);
  };

  return (
    <aside
      className={`hud-chat-panel ${isOpen ? "open" : "collapsed"}`}
      aria-label="JARVIS Neural Chat Link"
    >
      {/* Header Bar */}
      <div className="hud-chat-header">
        <div className="hud-chat-title-group">
          <span className="hud-corner-bracket top-left" />
          <span className="hud-corner-bracket top-right" />
          <div className="hud-chat-badge">
            <span
              className={`status-indicator ${
                checkingStatus
                  ? "checking"
                  : status.connected && status.modelAvailable
                  ? "online"
                  : "offline"
              }`}
            />
            <span className="hud-chat-title">
              J.A.R.V.I.S. // AI LINK
            </span>
          </div>
          <div className="hud-chat-sub">
            {checkingStatus
              ? "CONNECTING TO HOST..."
              : status.connected
              ? `LOCAL AI: ${status.model.toUpperCase()}`
              : "OFFLINE: OLLAMA UNREACHABLE"}
          </div>
        </div>

        <div className="hud-chat-header-actions">
          <button
            type="button"
            className="hud-chat-btn-sm"
            onClick={clearChat}
            title="Clear conversation session"
          >
            RESET
          </button>
          <button
            type="button"
            className="hud-chat-btn-sm"
            onClick={() => setIsOpen(!isOpen)}
            title={isOpen ? "Minimize Chat" : "Expand Chat"}
          >
            {isOpen ? "HIDE" : "SHOW"}
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          {/* Status Alert Banner if disconnected */}
          {!checkingStatus && (!status.connected || !status.modelAvailable) && (
            <div className="hud-alert-banner">
              <div className="alert-content">
                <strong>OLLAMA ALERT:</strong>{" "}
                {status.error || `Model ${status.model} not loaded on localhost.`}
              </div>
              <button
                type="button"
                className="hud-btn-retry"
                onClick={checkOllamaStatus}
                disabled={checkingStatus}
              >
                RETRY
              </button>
            </div>
          )}

          {/* Messages Feed */}
          <div className="hud-chat-feed">
            {messages.map((m) => (
              <div key={m.id} className={`hud-msg hud-msg-${m.role}`}>
                <div className="hud-msg-meta">
                  <span className="hud-msg-sender">
                    {m.role === "user" ? "USER // OPERATOR" : "J.A.R.V.I.S."}
                  </span>
                  <span className="hud-msg-time">{m.timestamp}</span>
                </div>
                <div className="hud-msg-bubble">
                  {m.role === "assistant" ? (
                    <FormattedMessage content={m.content} />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {/* Live Streaming Assistant Output */}
            {isStreaming && (
              <div className="hud-msg hud-msg-assistant streaming">
                <div className="hud-msg-meta">
                  <span className="hud-msg-sender">J.A.R.V.I.S.</span>
                  <span className="hud-msg-tag">NEURAL STREAMING</span>
                </div>
                <div className="hud-msg-bubble">
                  {streamBuffer ? (
                    <FormattedMessage content={streamBuffer} />
                  ) : (
                    <span className="hud-pulse-dots">
                      <span>.</span>
                      <span>.</span>
                      <span>.</span>
                    </span>
                  )}
                  <span className="hud-cursor-caret" />
                </div>
              </div>
            )}

            {/* Error Banner */}
            {chatError && (
              <div className="hud-msg-error">
                <span className="hud-error-tag">COMMUNICATION FAULT:</span>
                <span className="hud-error-text">{chatError}</span>
              </div>
            )}

            <div ref={logEndRef} />
          </div>

          {/* Quick Directives */}
          <div className="hud-quick-bar">
            {QUICK_DIRECTIVES.map((directive) => (
              <button
                key={directive}
                type="button"
                className="hud-quick-btn"
                onClick={() => void sendMessage(directive)}
                disabled={isStreaming}
              >
                {directive}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div className="hud-input-group">
            <textarea
              className="hud-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Directive for J.A.R.V.I.S. (Enter to send, Shift+Enter for newline)..."
              rows={2}
              disabled={isStreaming}
            />
            <div className="hud-input-actions">
              {isStreaming ? (
                <button
                  type="button"
                  className="hud-send-btn stop"
                  onClick={() => abortControllerRef.current?.abort()}
                >
                  HALT
                </button>
              ) : (
                <button
                  type="button"
                  className="hud-send-btn"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim()}
                >
                  TRANSMIT
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
