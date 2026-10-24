"use client";

import { useState, useEffect, useRef } from "react";
import { VoiceEngine, type VoiceState } from "@/lib/voiceEngine";
import { detectApprovedWebsiteCommand } from "@/lib/webCommands";
import FormattedMessage from "@/components/FormattedMessage";

interface VoiceScreenProps {
  isOnline: boolean;
  modelName: string;
}

export default function VoiceScreen({ isOnline, modelName }: VoiceScreenProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [textFallback, setTextFallback] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const voiceEngineRef = useRef<VoiceEngine | null>(null);

  useEffect(() => {
    const engine = new VoiceEngine((state) => {
      setVoiceState(state);
    });
    voiceEngineRef.current = engine;

    return () => {
      engine.stopListening();
      engine.stopSpeaking();
      voiceEngineRef.current = null;
    };
  }, []);

  const handleStartListening = () => {
    // Prevent accidental repeated actions during processing or speech
    if (voiceState === "processing") return;
    if (voiceState === "speaking") {
      handleStopSpeaking();
      return;
    }

    setVoiceError(null);
    setTranscript("");
    const engine = voiceEngineRef.current;
    if (!engine) return;

    const started = engine.startListening(
      (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          void processVoicePrompt(text);
        }
      },
      (err) => {
        setVoiceError(err);
      }
    );

    if (!started && engine.getState() === "unsupported") {
      setVoiceError("Speech recognition not supported in this browser. Please use Chrome/Edge on Android or type directive below.");
    }
  };

  const handleStopListening = () => {
    voiceEngineRef.current?.stopListening();
  };

  const handleStopSpeaking = () => {
    voiceEngineRef.current?.stopSpeaking();
  };

  const processVoicePrompt = async (promptText: string) => {
    if (!promptText.trim()) return;

    const websiteCommand = detectApprovedWebsiteCommand(promptText);
    const isHandheldBrowser =
      typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (websiteCommand && isHandheldBrowser) {
      const message = `Opening ${websiteCommand.displayName} in this browser, sir.`;
      setAiResponse(message);
      voiceEngineRef.current?.speak(message, () => window.location.assign(websiteCommand.url));
      if (!voiceEngineRef.current) window.location.assign(websiteCommand.url);
      return;
    }

    setVoiceState("processing");
    setAiResponse("Querying neural architecture...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: promptText }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        throw new Error(`Neural engine error (${res.status}): ${errorBody || "Host unreachable"}`);
      }

      const reply = await res.text();
      const cleaned = reply.trim() || "Understood, sir.";

      if (websiteCommand && /^directive aborted\b/i.test(cleaned)) {
        const message = `Opening ${websiteCommand.displayName} in this browser, sir.`;
        setAiResponse(message);
        voiceEngineRef.current?.speak(message, () => window.location.assign(websiteCommand.url));
        if (!voiceEngineRef.current) window.location.assign(websiteCommand.url);
        return;
      }

      setAiResponse(cleaned);

      // Clean text for speech synthesis so it doesn't read out technical search indicators or raw URLs
      let spokenText = cleaned.replace(/^(Retrieving verified intelligence for|Searching verified sources for) [^\n]+\n+/i, "");
      if (spokenText.includes("**Verified Sources:**") || spokenText.includes("Verified Sources:")) {
        spokenText = spokenText.split(/\*\*Verified Sources:\*\*|Verified Sources:/i)[0].trim();
        spokenText += " Verified sources and reference links are displayed on your console, sir.";
      }

      // Read final verified answer aloud
      voiceEngineRef.current?.speak(spokenText);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      let msg = "Voice processing error";
      if (err instanceof DOMException && err.name === "AbortError") {
        msg = "Request timed out after 25s. The host Ollama instance may be busy or unreachable.";
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setVoiceError(msg);
      setAiResponse(`Directive failed: ${msg}`);
      setVoiceState("error");
    }
  };

  const handleFallbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textFallback.trim()) return;
    setTranscript(textFallback.trim());
    void processVoicePrompt(textFallback.trim());
    setTextFallback("");
  };

  return (
    <div className="screen-voice-container">
      {/* Voice Core Visualizer */}
      <div className="voice-core-display">
        <div className={`voice-orb-ring state-${voiceState}`}>
          <div className="voice-orb-core">
            <span className="voice-state-text">{voiceState.toUpperCase()}</span>
          </div>
          <div className="voice-pulse-wave wave-1" />
          <div className="voice-pulse-wave wave-2" />
          <div className="voice-pulse-wave wave-3" />
        </div>

        <div className="voice-status-badge">
          <span className={`status-indicator ${isOnline ? "online" : "offline"}`} />
          <span>
            {isOnline
              ? `VOICE LINK READY // ${modelName.toUpperCase()}`
              : "VOICE ACTIVE // OLLAMA OFFLINE"}
          </span>
        </div>
      </div>

      {/* Transcript & Response Area */}
      <div className="voice-readout-panel">
        <div className="readout-card transcript-card">
          <span className="card-header-tag">&gt; USER AUDIO INPUT</span>
          <div className="card-body-text">
            {transcript || (voiceState === "listening" ? "Listening for speech..." : "Click START LISTENING to speak...")}
          </div>
        </div>

        <div className="readout-card response-card">
          <span className="card-header-tag">&gt; J.A.R.V.I.S. VOCAL RESPONSE</span>
          <div className="card-body-text">
            {aiResponse ? (
              <FormattedMessage content={aiResponse} />
            ) : (
              "Awaiting your verbal directive, sir."
            )}
          </div>
        </div>

        {voiceError && (
          <div className="voice-error-banner">
            <strong>NOTICE:</strong> {voiceError}
          </div>
        )}
      </div>

      {/* Voice Controls Bar */}
      <div className="voice-controls-bar">
        {voiceState === "listening" ? (
          <button type="button" className="voice-action-btn listening" onClick={handleStopListening}>
            STOP LISTENING
          </button>
        ) : (
          <button type="button" className="voice-action-btn record" onClick={handleStartListening}>
            START LISTENING
          </button>
        )}

        {voiceState === "speaking" && (
          <button type="button" className="voice-action-btn stop" onClick={handleStopSpeaking}>
            MUTE SPEECH
          </button>
        )}
      </div>

      {/* Text Fallback Form */}
      <form className="voice-fallback-form" onSubmit={handleFallbackSubmit}>
        <input
          type="text"
          className="fallback-input"
          value={textFallback}
          onChange={(e) => setTextFallback(e.target.value)}
          placeholder="Browser speech fallback: Type directive and submit to trigger voice synthesis..."
        />
        <button type="submit" className="fallback-btn">
          SPEAK DIRECTIVE
        </button>
      </form>
    </div>
  );
}
