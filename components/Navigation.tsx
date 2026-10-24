"use client";

import { PerformanceManager } from "@/lib/performanceManager";

export type ActiveScreen =
  | "home"
  | "chat"
  | "voice"
  | "gestures"
  | "system"
  | "history"
  | "settings";

interface NavigationProps {
  activeScreen: ActiveScreen;
  onSelectScreen: (screen: ActiveScreen) => void;
  isOnline: boolean;
  modelName: string;
  onToggleWearableMode?: () => void;
}

export default function Navigation({
  activeScreen,
  onSelectScreen,
  isOnline,
  modelName,
  onToggleWearableMode,
}: NavigationProps) {
  const tabs: Array<{ id: ActiveScreen; label: string; tag: string }> = [
    { id: "home", label: "HOME", tag: "CORE" },
    { id: "chat", label: "AI CHAT", tag: "TEXT" },
    { id: "voice", label: "VOICE", tag: "AUDIO" },
    { id: "gestures", label: "GESTURES", tag: "VISION" },
    { id: "system", label: "SYSTEM", tag: "TOOLS" },
    { id: "history", label: "HISTORY", tag: "MEMORY" },
    { id: "settings", label: "SETTINGS", tag: "CONFIG" },
  ];

  const handleOpenPwaGuide = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("jarvis:open-pwa-guide"));
    }
  };

  return (
    <>
      {/* Desktop HUD Top Header */}
      <header className="hud-desktop-header">
        <div className="hud-brand-container">
          <span className="hud-corner-bracket top-left" />
          <span className="hud-corner-bracket top-right" />
          <div className="hud-brand-mark">J.A.R.V.I.S.</div>
          <div className="hud-brand-sub">UNIVERSAL AI // ADAPTIVE PERFORMANCE</div>
        </div>

        <nav className="hud-tabs" aria-label="Tactical Navigation">
          {tabs.map((tab) => {
            const isActive = activeScreen === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`hud-tab-item ${isActive ? "active" : ""}`}
                onClick={() => onSelectScreen(tab.id)}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="tab-tag">{tab.tag}</span>
                <span className="tab-label">{tab.label}</span>
                {isActive && <span className="tab-indicator" />}
              </button>
            );
          })}
        </nav>

        <div className="hud-header-actions">
          {onToggleWearableMode && (
            <button
              type="button"
              className="hud-quick-btn"
              onClick={onToggleWearableMode}
              title="Switch to lightweight Smartwatch / Wearable Companion View"
            >
              ⌚ WEAR
            </button>
          )}

          <button
            type="button"
            className="hud-quick-btn"
            onClick={handleOpenPwaGuide}
            title="Install J.A.R.V.I.S. as a PWA on this device"
          >
            📱 INSTALL
          </button>

          {process.env.NODE_ENV === "development" ? (
            <button
              type="button"
              className="hud-perf-pill"
              onClick={() => PerformanceManager.getInstance().toggleDiagnostics()}
              title="Toggle live render diagnostics"
            >
              <span className="perf-dot" />
              <span className="perf-label">LIVE FPS</span>
            </button>
          ) : (
            <div
              className="hud-perf-pill"
              role="status"
              aria-label="Adaptive rendering enabled"
              title="Render quality follows device performance and display refresh"
            >
              <span className="perf-dot" />
              <span className="perf-label">ADAPTIVE</span>
            </div>
          )}

          <div className="hud-system-pill">
            <span className={`status-dot ${isOnline ? "online" : "offline"}`} />
            <span className="model-label">
              {isOnline ? `OLLAMA: ${modelName.toUpperCase()}` : "OLLAMA: OFFLINE"}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="hud-mobile-nav" aria-label="Mobile Navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`mobile-nav-item ${activeScreen === tab.id ? "active" : ""}`}
            onClick={() => onSelectScreen(tab.id)}
          >
            <span className="mobile-tag">{tab.tag}</span>
            <span className="mobile-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
