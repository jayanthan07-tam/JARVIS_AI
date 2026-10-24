"use client";

import { useState } from "react";
import { type ActiveScreen } from "@/components/Navigation";
import { type TrackerStatus } from "@/lib/handTracker";
import { PerformanceManager } from "@/lib/performanceManager";

interface HomeScreenProps {
  onNavigate: (screen: ActiveScreen, initialText?: string) => void;
  isOnline: boolean;
  modelName: string;
  trackerStatus: TrackerStatus;
  cameraOn: boolean;
  onToggleCamera: () => void;
  onResetOrb: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  viewportMode?: "blender_hologram" | "procedural_orb" | "tactical_2d";
  onToggleViewportMode?: () => void;
}

export default function HomeScreen({
  onNavigate,
  isOnline,
  modelName,
  trackerStatus,
  cameraOn,
  onToggleCamera,
  onResetOrb,
  onZoomIn,
  onZoomOut,
  viewportMode = "blender_hologram",
  onToggleViewportMode,
}: HomeScreenProps) {
  const [quickInput, setQuickInput] = useState("");

  const handleLaunchCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    onNavigate("chat", quickInput.trim());
    setQuickInput("");
  };

  const quickDirectives = [
    "Status report, Jarvis.",
    "Run lab diagnostic.",
    "Show available system tools.",
    "Explain gesture control mechanics.",
  ];

  return (
    <div className="screen-home-overlay">
      {/* Top Left: System Telemetry */}
      <div className="hud-panel hud-panel-vitals">
        <div className="hud-panel-header">
          <span className="panel-title">CORE TELEMETRY</span>
          <span className="panel-status">SYS.01</span>
        </div>
        <div className="hud-vitals-grid">
          <div className="vital-item">
            <span className="vital-label">NEURAL CORE</span>
            <span className={`vital-val ${isOnline ? "cyan" : "red"}`}>
              {isOnline ? modelName.toUpperCase() : "DISCONNECTED"}
            </span>
          </div>
          <div className="vital-item">
            <span className="vital-label">ARC CAPACITANCE</span>
            <span className="vital-val cyan">99.8% NOMINAL</span>
          </div>
          <div className="vital-item">
            <span className="vital-label">VISION SENSOR</span>
            <span className={`vital-val ${cameraOn ? "cyan" : "dim"}`}>
              {cameraOn ? `${trackerStatus.hands} HAND(S) · ${trackerStatus.mode.toUpperCase()}` : "STANDBY"}
            </span>
          </div>
          {cameraOn && trackerStatus.gesture && (
            <div className="vital-item">
              <span className="vital-label">ACTIVE GESTURE</span>
              <span className="vital-val hot">{trackerStatus.gesture}</span>
            </div>
          )}
        </div>
      </div>

      {/* Top Right: Orb Navigation Controls */}
      <div className="hud-panel hud-panel-orb-controls">
        <div className="hud-panel-header">
          <span className="panel-title">VIEWPORT DIRECTIVES</span>
          <span className="panel-status">
            {viewportMode === "blender_hologram" ? "BLENDER 3D" : "ORB 3D"}
          </span>
        </div>
        <div className="hud-orb-buttons">
          {onToggleViewportMode && (
            <button
              type="button"
              className="hud-btn mode-switch"
              onClick={onToggleViewportMode}
              title="Toggle between Blender Hologram and Procedural Orb"
            >
              {viewportMode === "blender_hologram" ? "MODE: BLENDER" : "MODE: ORB"}
            </button>
          )}
          <button type="button" className="hud-btn" onClick={onZoomIn} title="Zoom In">
            + ZOOM
          </button>
          <button type="button" className="hud-btn" onClick={onZoomOut} title="Zoom Out">
            − ZOOM
          </button>
          <button type="button" className="hud-btn" onClick={onResetOrb} title="Reset Orientation">
            RESET
          </button>
          <button
            type="button"
            className={`hud-btn ${cameraOn ? "active" : ""}`}
            onClick={onToggleCamera}
            title="Toggle Hand Gestures"
          >
            {cameraOn ? "CAMERA ON" : "CAMERA OFF"}
          </button>
          {process.env.NODE_ENV === "development" && (
            <button
              type="button"
              className="hud-btn"
              onClick={() => PerformanceManager.getInstance().toggleDiagnostics()}
              title="Toggle live performance diagnostics"
            >
              ⚡ FPS HUD
            </button>
          )}
        </div>
      </div>

      {/* Bottom Center: Quick Directive Launcher */}
      <div className="hud-home-bottom">
        <form className="hud-command-bar" onSubmit={handleLaunchCommand}>
          <div className="command-input-wrap">
            <span className="command-prefix">&gt; DIRECTIVE:</span>
            <input
              type="text"
              className="command-input"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Transmit directive to J.A.R.V.I.S. (e.g. 'Status report')..."
            />
          </div>
          <button type="submit" className="hud-command-submit">
            TRANSMIT
          </button>
        </form>

        <div className="hud-quick-chips">
          {quickDirectives.map((cmd) => (
            <button
              key={cmd}
              type="button"
              className="quick-chip"
              onClick={() => onNavigate("chat", cmd)}
            >
              [ {cmd} ]
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
