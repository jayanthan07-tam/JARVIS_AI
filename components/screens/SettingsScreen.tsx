"use client";

import { useState, useEffect } from "react";
import { PerformanceManager, type PerformanceMode } from "@/lib/performanceManager";

interface SettingsScreenProps {
  currentModel: string;
  onUpdateModel: (model: string) => void;
}

export default function SettingsScreen({
  currentModel,
  onUpdateModel,
}: SettingsScreenProps) {
  const [modelInput, setModelInput] = useState(currentModel);
  const [ollamaHost, setOllamaHost] = useState("http://127.0.0.1:11434");
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are J.A.R.V.I.S., the tactical AI assistant developed by Tony Stark. Be sophisticated, loyal, articulate, and concise. Address the user with respect (often as 'sir')."
  );
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [perfMode, setPerfMode] = useState<PerformanceMode>("auto");
  const [displayRefreshHz, setDisplayRefreshHz] = useState(60);
  const [deviceCategory, setDeviceCategory] = useState("Detecting");

  useEffect(() => {
    const perf = PerformanceManager.getInstance();
    setPerfMode(perf.getMode());
    const initialMetrics = perf.getMetrics();
    setDisplayRefreshHz(initialMetrics.detectedHz);
    setDeviceCategory(initialMetrics.deviceCategory);
    const unsubscribeMetrics = perf.onMetricsUpdate((metrics) => {
      setDisplayRefreshHz(metrics.detectedHz);
      setDeviceCategory(metrics.deviceCategory);
    });

    const saved = localStorage.getItem("jarvis_settings_v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.model) setModelInput(parsed.model);
        if (parsed.host) setOllamaHost(parsed.host);
        if (typeof parsed.temperature === "number") setTemperature(parsed.temperature);
        if (parsed.systemPrompt) setSystemPrompt(parsed.systemPrompt);
      } catch {
        // ignore
      }
    }

    return unsubscribeMetrics;
  }, []);

  const handlePerfModeChange = (mode: PerformanceMode) => {
    setPerfMode(mode);
    PerformanceManager.getInstance().setMode(mode);
  };

  const handleSave = () => {
    onUpdateModel(modelInput.trim());
    localStorage.setItem(
      "jarvis_settings_v2",
      JSON.stringify({
        model: modelInput.trim(),
        host: ollamaHost.trim(),
        temperature,
        systemPrompt: systemPrompt.trim(),
      })
    );
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  const handleTestConnection = async () => {
    setIsPinging(true);
    setPingResult(null);
    const start = performance.now();
    try {
      const res = await fetch("/api/status");
      const elapsed = Math.round(performance.now() - start);
      const data = await res.json();
      if (data.connected && data.modelAvailable) {
        setPingResult(`CONNECTED · ${elapsed}ms latency · Model ${data.model} verified.`);
      } else if (data.connected) {
        setPingResult(`CONNECTED · ${elapsed}ms · Model ${modelInput} not yet installed.`);
      } else {
        setPingResult(`OFFLINE · ${data.error || "Ollama host unreachable."}`);
      }
    } catch {
      setPingResult("FAILED · Network error connecting to status route.");
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="screen-settings-container">
      <div className="settings-header-card">
        <span className="settings-title">NEURAL CONFIGURATION & SECURITY PROTOCOLS</span>
        <span className="settings-sub">LOCAL OLLAMA INFERENCE ENGINE</span>
      </div>

      {saveToast && <div className="save-toast-banner">Configuration saved to workstation local storage.</div>}

      <div className="settings-two-col">
        {/* Left Column: Model Configuration */}
        <div className="settings-col">
          <div className="settings-panel">
            <span className="panel-title">AI INFERENCE PARAMETERS</span>

            <div className="settings-field">
              <label className="field-label">TARGET MODEL NAME</label>
              <input
                type="text"
                className="field-input"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                placeholder="llama3.2:3b"
              />
              <span className="field-hint">Installed local Ollama model identifier (default: llama3.2:3b).</span>
            </div>

            <div className="settings-field">
              <label className="field-label">OLLAMA HOST URL (LOOPBACK ONLY)</label>
              <input
                type="text"
                className="field-input"
                value={ollamaHost}
                onChange={(e) => setOllamaHost(e.target.value)}
                placeholder="http://127.0.0.1:11434"
              />
              <span className="field-hint">Bound to loopback during local development for security.</span>
            </div>

            <div className="settings-field">
              <div className="field-label-row">
                <label className="field-label">CREATIVE TEMPERATURE</label>
                <span className="val-preview">{temperature}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="hud-slider"
              />
              <span className="field-hint">Lower values yield precise, factual answers; higher values allow creative responses.</span>
            </div>

            <div className="settings-field">
              <label className="field-label">CUSTOM SYSTEM DIRECTIVE PROMPT</label>
              <textarea
                className="field-textarea"
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </div>

            <div className="settings-actions">
              <button type="button" className="hud-save-btn" onClick={handleSave}>
                SAVE CONFIGURATION
              </button>
              <button
                type="button"
                className="hud-test-btn"
                onClick={handleTestConnection}
                disabled={isPinging}
              >
                {isPinging ? "TESTING..." : "PING OLLAMA"}
              </button>
            </div>

            {pingResult && <div className="ping-result-box">{pingResult}</div>}
          </div>

          {/* 3D Graphics & Adaptive Quality */}
          <div className="settings-panel">
            <span className="panel-title">3D GRAPHICS &amp; ADAPTIVE QUALITY</span>

            <div className="settings-field">
              <label className="field-label">ADAPTIVE QUALITY PRESET</label>
              <div className="perf-mode-btn-group">
                {(["auto", "high", "balanced", "low"] as PerformanceMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`perf-mode-btn ${perfMode === m ? "active" : ""}`}
                    onClick={() => handlePerfModeChange(m)}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
              <span className="field-hint">
                {perfMode === "auto" && `Auto adjusts quality from measured frame time and battery state. Detected display refresh: ${displayRefreshHz} Hz.`}
                {perfMode === "high" && `High enables bloom, particles, and chromatic grading. Its target is capped at ${Math.min(120, displayRefreshHz)} FPS for this display.`}
                {perfMode === "balanced" && `Balanced uses reduced effects. Its target is capped at ${Math.min(90, displayRefreshHz)} FPS for this display.`}
                {perfMode === "low" && `Low disables post-processing and reduces particles. Its target is capped at ${Math.min(60, displayRefreshHz)} FPS for this display.`}
              </span>
            </div>

            {process.env.NODE_ENV === "development" && (
              <div className="settings-actions">
                <button
                  type="button"
                  className="hud-test-btn"
                  onClick={() => PerformanceManager.getInstance().toggleDiagnostics()}
                >
                  TOGGLE PERFORMANCE DIAGNOSTICS
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Privacy, Mobile PWA, & Exhibition Details */}
        <div className="settings-col">
          {/* Mobile PWA & Remote Ollama Architecture */}
          <div className="settings-panel">
            <span className="panel-title">NATIVE ANDROID APP &amp; REMOTE INFERENCE</span>

            <div className="security-badges-list">
              <div className="sec-badge-item">
                <span className="badge-icon">📱</span>
                <div className="badge-details">
                  <span className="badge-name">ANDROID APP PACKAGE READY</span>
                  <span className="badge-desc">A debug APK is available for Android phones and tablets. The optional browser install is an additional access method; both need the secured J.A.R.V.I.S. server.</span>
                </div>
              </div>

              <div className="sec-badge-item">
                <span className="badge-icon">🔒</span>
                <div className="badge-details">
                  <span className="badge-name">SERVER-SIDE OLLAMA BRIDGE</span>
                  <span className="badge-desc">
                    Laptop-hosted Ollama requires the host workstation to be running and reachable. Keep this app and backend on a trusted network.
                    <strong> Never expose port 11434 publicly.</strong>
                  </span>
                </div>
              </div>

              <div className="sec-badge-item">
                <span className="badge-icon">☁️</span>
                <div className="badge-details">
                  <span className="badge-name">HYBRID CLOUD FALLBACK</span>
                  <span className="badge-desc">Configure server-side GEMINI_API_KEY or GROQ_API_KEY in environment variables for instant cloud AI when outside home Wi-Fi.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-panel">
            <span className="panel-title">PRIVACY &amp; ON-DEVICE SECURITY</span>

            <div className="security-badges-list">
              <div className="sec-badge-item">
                <span className="badge-icon">●</span>
                <div className="badge-details">
                  <span className="badge-name">LOCAL AND CLOUD PROVIDERS</span>
                  <span className="badge-desc">Ollama runs on the host computer. Gemini and other cloud providers can receive requests when configured and selected.</span>
                </div>
              </div>

              <div className="sec-badge-item">
                <span className="badge-icon">●</span>
                <div className="badge-details">
                  <span className="badge-name">MEDIA HARDWARE PRIVACY</span>
                  <span className="badge-desc">Camera and microphone operate strictly under user permission gates and can be toggled off at any second.</span>
                </div>
              </div>

              <div className="sec-badge-item">
                <span className="badge-icon">●</span>
                <div className="badge-details">
                  <span className="badge-name">STANDBY EXHIBITION READY</span>
                  <span className="badge-desc">Presentation modes remain available without a network. AI replies, chat history, and server status need the secured J.A.R.V.I.S. server.</span>
                </div>
              </div>
            </div>

            <div className="hardware-specs-box">
              <span className="specs-title">ACTIVE RENDER PROFILE:</span>
              <div className="specs-grid">
                <div><span>DEVICE CLASS:</span> {deviceCategory}</div>
                <div><span>DISPLAY REFRESH:</span> {displayRefreshHz} Hz measured</div>
                <div><span>QUALITY MODE:</span> {perfMode.toUpperCase()}</div>
                <div><span>3D RENDERER:</span> Three.js + WebGL</div>
                <div><span>3D PIPELINE:</span> Three.js + Blender Hologram GLB</div>
                <div><span>UNREAL ENGINE:</span> Optional separate application</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
