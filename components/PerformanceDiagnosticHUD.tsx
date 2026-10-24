"use client";

import { useEffect, useState } from "react";
import {
  PerformanceManager,
  type DetailedPerformanceMetrics,
  type PerformanceMode,
} from "@/lib/performanceManager";

export default function PerformanceDiagnosticHUD() {
  const [metrics, setMetrics] = useState<DetailedPerformanceMetrics | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const perf = PerformanceManager.getInstance();
    setVisible(perf.isDiagnosticsVisible());
    setMetrics(perf.getMetrics());

    const unsubMetrics = perf.onMetricsUpdate((m) => {
      setMetrics(m);
    });

    const unsubDiag = perf.onDiagnosticsChange((show) => {
      setVisible(show);
    });

    return () => {
      unsubMetrics();
      unsubDiag();
    };
  }, []);

  if (process.env.NODE_ENV !== "development" || !visible || !metrics) return null;

  const perf = PerformanceManager.getInstance();

  const handleSetMode = (mode: PerformanceMode) => {
    perf.setMode(mode);
  };

  const getStatusColor = (fps: number) => {
    if (fps >= 90) return "text-cyan-bright";
    if (fps >= 60) return "text-tech-blue";
    if (fps >= 30) return "text-amber-warning";
    return "text-red-alert";
  };

  return (
    <aside className="perf-diagnostic-hud" role="region" aria-label="Performance Diagnostics">
      <div className="perf-hud-header">
        <div className="perf-hud-title-wrap">
          <span className="perf-hud-indicator" />
          <span className="perf-hud-title">SYS.PROFILER // LIVE RENDER METRICS</span>
        </div>
        <button
          type="button"
          className="perf-hud-close"
          onClick={() => perf.setDiagnosticsVisible(false)}
          title="Close diagnostics"
        >
          [×]
        </button>
      </div>

      <div className="perf-hud-grid">
        <div className="perf-metric-box">
          <span className="perf-metric-label">CURRENT FPS</span>
          <span className={`perf-metric-value ${getStatusColor(metrics.fps)}`}>
            {metrics.fps > 0 ? metrics.fps : "--"}
          </span>
          <span className="perf-metric-sub">
            AVG: {metrics.avgFps} · 1% LOW: {metrics.onePercentLowFps}
          </span>
        </div>

        <div className="perf-metric-box">
          <span className="perf-metric-label">FRAME TIME</span>
          <span className="perf-metric-value text-cyan-bright">
            {metrics.frameTimeMs} <span className="unit">ms</span>
          </span>
          <span className="perf-metric-sub">
            AVG: {metrics.avgFrameTimeMs} ms · CPU SUBMIT: {metrics.cpuFrameTimeMs} ms
          </span>
        </div>

        <div className="perf-metric-box">
          <span className="perf-metric-label">DRAWS / TRIS</span>
          <span className="perf-metric-value text-tech-blue">
            {metrics.drawCalls} <span className="unit">calls</span>
          </span>
          <span className="perf-metric-sub">
            {metrics.triangles.toLocaleString()} TRIS · {metrics.geometries} GEO · {metrics.materials} MAT
            <br />
            {metrics.textures} TEX · {metrics.shaders} SHADERS
          </span>
        </div>

        <div className="perf-metric-box">
          <span className="perf-metric-label">PIPELINE STATE</span>
          <span className="perf-metric-value text-cyan-bright">
            {metrics.isHidden
              ? "TAB HIDDEN"
              : metrics.prefersReducedMotion
              ? "REDUCED MOTION"
              : metrics.isThrottled
              ? "30 FPS SUBTLE"
              : `${metrics.activePreset.toUpperCase()}`}
          </span>
          <span className="perf-metric-sub">
            {metrics.deviceCategory} · {metrics.detectedHz}Hz
            {metrics.isBatterySaving ? " · BATT SAVER" : ""}
            {metrics.postProcessingEnabled ? " · POST FX" : " · DIRECT PASS"}
          </span>
        </div>
      </div>

      <div className="perf-preset-controls">
        <span className="preset-label">QUALITY PRESET:</span>
        <div className="preset-buttons">
          {(["auto", "high", "balanced", "low"] as PerformanceMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`preset-btn ${metrics.mode === m ? "active" : ""}`}
              onClick={() => handleSetMode(m)}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="perf-hud-footer">
        <span className="shortcut-hint">TOGGLE OVERLAY: [P]</span>
        <span className="target-hint">
          DISPLAY: {metrics.detectedHz}Hz · TARGET: {perf.getSettings().targetFps} FPS
        </span>
      </div>
    </aside>
  );
}
