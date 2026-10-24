"use client";

import { useState, useEffect, type FormEvent } from "react";
import FormattedMessage from "@/components/FormattedMessage";
import { VoiceEngine, type VoiceState } from "@/lib/voiceEngine";

interface WearableHUDProps {
  isOnline: boolean;
  modelName: string;
  onExitWearableMode?: () => void;
}

export default function WearableHUD({
  isOnline,
  modelName,
  onExitWearableMode,
}: WearableHUDProps) {
  const [currentTime, setCurrentTime] = useState("");
  const [directiveResponse, setDirectiveResponse] = useState<string>(
    "J.A.R.V.I.S. Watch link active. Ask a short question or check status."
  );
  const [isLoading, setIsLoading] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceEngine, setVoiceEngine] = useState<VoiceEngine | null>(null);
  const [prompt, setPrompt] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const engine = new VoiceEngine((st) => setVoiceState(st));
    setVoiceEngine(engine);
    return () => {
      engine.stopListening();
      engine.stopSpeaking();
    };
  }, []);

  const executeDirective = async (prompt: string) => {
    if (isLoading) return;
    setIsLoading(true);
    setDirectiveResponse("Processing directive...");
    const requestMessages = [...chatHistory, { role: "user" as const, content: prompt }].slice(-8);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: requestMessages,
          systemPrompt:
            "You are J.A.R.V.I.S. replying on a smartwatch. Be accurate and concise. Keep each answer to at most three short sentences and preferably under 45 words.",
        }),
      });

      if (!res.ok) {
        setDirectiveResponse(
          res.status === 401
            ? "Sign in to J.A.R.V.I.S. on this watch to continue."
            : res.status === 503
              ? "The J.A.R.V.I.S. server needs setup before it can answer."
              : "The J.A.R.V.I.S. request failed. Try again."
        );
        return;
      }

      const text = await res.text();
      const fullText = text.trim() || "Understood.";
      const cleaned = fullText.length > 480 ? `${fullText.slice(0, 477).trimEnd()}…` : fullText;
      setDirectiveResponse(cleaned);
      setChatHistory([...requestMessages, { role: "assistant" as const, content: cleaned }].slice(-8));

      // Speak response on wearable if supported
      voiceEngine?.speak(cleaned.slice(0, 180));
    } catch {
      setDirectiveResponse("Could not reach the J.A.R.V.I.S. server. Check the connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceToggle = () => {
    if (!voiceEngine) return;
    if (voiceState === "listening") {
      voiceEngine.stopListening();
    } else {
      voiceEngine.startListening(
        (text, isFinal) => {
          if (isFinal && text.trim()) {
            void executeDirective(text);
          }
        },
        () => {
          setDirectiveResponse("Microphone input unavailable on this wearable browser.");
        }
      );
    }
  };

  const submitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || isLoading) return;
    setPrompt("");
    void executeDirective(value);
  };

  return (
    <div className="wearable-hud-root" role="region" aria-label="J.A.R.V.I.S. Smartwatch Interface">
      {/* Smartwatch Outer Bezel */}
      <div className="wearable-screen">
        {/* Header: Clock and Mini Arc Indicator */}
        <header className="wearable-header">
          <div className="wearable-status-dot-wrap">
            <span className={`wearable-dot ${isOnline ? "online" : "offline"}`} />
            <span className="wearable-model-tag">{modelName.split(":")[0]}</span>
          </div>
          <span className="wearable-clock">{currentTime}</span>
        </header>

        {/* Readout Feed Card */}
        <div className="wearable-feed" aria-live="polite">
          {isLoading ? (
            <div className="wearable-loading">
              <span className="wearable-spinner" />
              <span>TRANSMITTING...</span>
            </div>
          ) : (
            <div className="wearable-text">
              <FormattedMessage content={directiveResponse} />
            </div>
          )}
        </div>

        <form className="wearable-compose" onSubmit={submitPrompt}>
          <label className="sr-only" htmlFor="wearable-prompt">Ask J.A.R.V.I.S.</label>
          <input
            id="wearable-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask JARVIS…"
            autoComplete="off"
            enterKeyHint="send"
            maxLength={1000}
            disabled={isLoading}
          />
          <button type="submit" className="wearable-send-btn" disabled={!prompt.trim() || isLoading} aria-label="Send message">
            SEND
          </button>
        </form>

        {/* Quick Action Matrix */}
        <div className="wearable-actions">
          <button
            type="button"
            className="wearable-btn"
            onClick={() => void executeDirective("Status report, Jarvis.")}
            disabled={isLoading}
          >
            STATUS
          </button>
          <button
            type="button"
            className="wearable-btn"
            onClick={() => void executeDirective("What time and date is it?")}
            disabled={isLoading}
          >
            TIME
          </button>
          <button
            type="button"
            className={`wearable-btn mic ${voiceState === "listening" ? "active" : ""}`}
            onClick={handleVoiceToggle}
            title="Voice input"
          >
            {voiceState === "listening" ? "LISTENING" : "🎤 VOICE"}
          </button>
        </div>

        {/* Exit to full workstation HUD */}
        {onExitWearableMode && (
          <footer className="wearable-footer">
            <button
              type="button"
              className="wearable-exit-btn"
              onClick={onExitWearableMode}
              title="Switch to full desktop/mobile HUD"
            >
              FULL HUD MODE ↗
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
