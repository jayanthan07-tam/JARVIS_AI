"use client";

import { useState } from "react";
import type { TrackerStatus } from "@/lib/handTracker";
import type {
  GestureId,
  GestureAction,
  GestureMappingConfig,
  HandMetrics,
  PerformanceMetrics,
} from "@/lib/gestureTypes";
import { DEFAULT_MAPPINGS } from "@/lib/gestureEngine";

interface GesturesScreenProps {
  cameraOn: boolean;
  trackerStatus: TrackerStatus;
  handsMetrics?: HandMetrics[];
  performanceMetrics?: PerformanceMetrics;
  mappings?: GestureMappingConfig[];
  onToggleCamera: () => void;
  onSetSensitivity?: (val: number) => void;
  onSimulateGesture?: (gesture: GestureId) => void;
  onUpdateMapping?: (gestureId: GestureId, updates: Partial<GestureMappingConfig>) => void;
  onRecalibrate?: () => void;
  showSkeleton?: boolean;
  onToggleSkeleton?: () => void;
}

const ACTION_OPTIONS: { value: GestureAction; label: string }[] = [
  { value: "NONE", label: "None / Disabled" },
  { value: "WAKE_HOME", label: "Wake / Return Home" },
  { value: "SWITCH_PANEL_NEXT", label: "Cycle Panel Next" },
  { value: "SWITCH_PANEL_PREV", label: "Cycle Panel Prev" },
  { value: "SCROLL_UP", label: "Scroll Up / Zoom In" },
  { value: "SCROLL_DOWN", label: "Scroll Down / Zoom Out" },
  { value: "SELECT_CONFIRM", label: "Select / Confirm" },
  { value: "PAUSE_LOCK", label: "Pause / Lock Gestures" },
  { value: "SYSTEM_DIAGNOSTIC", label: "System Diagnostic" },
  { value: "VOICE_ACTIVATION", label: "Voice Mode" },
  { value: "ROTATE_ORB", label: "Rotate 3D Orb" },
  { value: "ZOOM_ORB", label: "Zoom 3D Orb" },
];

export default function GesturesScreen({
  cameraOn,
  trackerStatus,
  handsMetrics = [],
  performanceMetrics,
  mappings = DEFAULT_MAPPINGS,
  onToggleCamera,
  onSetSensitivity,
  onSimulateGesture,
  onUpdateMapping,
  onRecalibrate,
  showSkeleton = true,
  onToggleSkeleton,
}: GesturesScreenProps) {
  const [sensitivity, setSensitivity] = useState(75);
  const [activeTab, setActiveTab] = useState<"dashboard" | "mappings">("dashboard");
  const [confirmDialog, setConfirmDialog] = useState<string | null>(null);

  const handleSensitivityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSensitivity(val);
    onSetSensitivity?.(val / 100);
  };

  const primaryHand = handsMetrics[0];
  const fps = performanceMetrics?.fps ?? trackerStatus.fps ?? 0;
  const latency = performanceMetrics?.inferenceTimeMs ?? trackerStatus.inferenceTimeMs ?? 0;
  const activeGesture = trackerStatus.gesture || "STANDBY";
  const confidence = trackerStatus.confidence || 0;

  return (
    <div className="screen-gestures-container">
      {/* Top Header Card */}
      <div className="gestures-header-card">
        <div className="gestures-title-group">
          <span className="gestures-title">VISION RECOGNITION // GESTURE MATRIX 2.0</span>
          <span className="gestures-sub">
            MEDIAPIPE 5-FINGER COMBINATORIAL ENGINE · REAL-TIME SENSING
          </span>
        </div>
        <div className="gestures-controls-right">
          <button
            type="button"
            className={`hud-btn ${showSkeleton ? "active" : ""}`}
            onClick={onToggleSkeleton}
            title="Toggle hand bone skeleton and joint overlay"
          >
            {showSkeleton ? "SKELETON: ON" : "SKELETON: OFF"}
          </button>
          <button
            type="button"
            className="hud-btn"
            onClick={onRecalibrate}
            title="Recalibrate sensors and reset state filters"
          >
            RECALIBRATE
          </button>
          <button
            type="button"
            className={`hud-btn ${cameraOn ? "active" : ""}`}
            onClick={onToggleCamera}
          >
            {cameraOn ? "CAMERA ACTIVE" : "ENABLE CAMERA"}
          </button>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="gestures-subtabs">
        <button
          type="button"
          className={`subtab-btn ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          [ TELEMETRY & 5-FINGER DASHBOARD ]
        </button>
        <button
          type="button"
          className={`subtab-btn ${activeTab === "mappings" ? "active" : ""}`}
          onClick={() => setActiveTab("mappings")}
        >
          [ GESTURE DIRECTIVE MAPPINGS ({mappings.length}) ]
        </button>
      </div>

      {activeTab === "dashboard" ? (
        <div className="gestures-content-grid">
          {/* Left Column: Live Readout & Metrics */}
          <div className="gestures-status-col">
            <div className="gestures-monitor-panel">
              <div className="monitor-header">
                <span>LIVE TELEMETRY & PERFORMANCE</span>
                <span className={`status-tag ${cameraOn ? "online" : "offline"}`}>
                  {cameraOn ? "ONLINE / TRACKING" : "SENSOR OFFLINE"}
                </span>
              </div>

              {/* 4 Metric Cards */}
              <div className="monitor-metrics">
                <div className="metric-box">
                  <span className="metric-lbl">ACTIVE GESTURE</span>
                  <span className="metric-val hot">{cameraOn ? activeGesture : "STANDBY"}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-lbl">PROCESSING RATE</span>
                  <span className="metric-num cyan">
                    {cameraOn ? `${fps} FPS` : "--"}
                  </span>
                </div>
                <div className="metric-box">
                  <span className="metric-lbl">INFERENCE LATENCY</span>
                  <span className="metric-num">
                    {cameraOn ? `${latency} ms` : "--"}
                  </span>
                </div>
                <div className="metric-box">
                  <span className="metric-lbl">HANDS / CONFIDENCE</span>
                  <span className="metric-val">
                    {cameraOn
                      ? `${trackerStatus.hands} HAND(S) · ${confidence}%`
                      : "0 HANDS"}
                  </span>
                </div>
              </div>

              {/* 5-Bit Binary Pattern Visualizer */}
              <div className="pattern-visualizer-card">
                <div className="pattern-header">
                  <span className="pattern-title">5-BIT FINGER COMBINATION PATTERN</span>
                  <span className="pattern-bits-badge">
                    {primaryHand ? `0b${primaryHand.patternString} (${primaryHand.patternBitmask})` : "0b00000 (0)"}
                  </span>
                </div>
                <div className="pattern-bits-row">
                  {[
                    { label: "THUMB", bit: 16, state: primaryHand?.fingers.thumb.state },
                    { label: "INDEX", bit: 8, state: primaryHand?.fingers.index.state },
                    { label: "MIDDLE", bit: 4, state: primaryHand?.fingers.middle.state },
                    { label: "RING", bit: 2, state: primaryHand?.fingers.ring.state },
                    { label: "PINKY", bit: 1, state: primaryHand?.fingers.pinky.state },
                  ].map((f) => {
                    const is1 = primaryHand && (primaryHand.patternBitmask & f.bit) !== 0;
                    return (
                      <div key={f.label} className={`bit-node ${is1 ? "on" : "off"}`}>
                        <span className="bit-digit">{is1 ? "1" : "0"}</span>
                        <span className="bit-name">{f.label}</span>
                        <span className="bit-state">
                          {f.state ? f.state.toUpperCase() : "IDLE"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sensitivity Calibration Slider */}
              <div className="gestures-slider-group">
                <div className="slider-label-row">
                  <span>GESTURE SENSITIVITY CALIBRATION</span>
                  <span className="slider-val">{sensitivity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={sensitivity}
                  onChange={handleSensitivityChange}
                  className="hud-slider"
                />
                <span className="slider-hint">
                  Scale-independent hysteresis algorithm prevents jitter while maintaining fast trigger response.
                </span>
              </div>

              {/* Manual Override Simulator */}
              <div className="gestures-simulator-box">
                <span className="sim-title">MANUAL GESTURE TRIGGER (SIMULATOR OVERRIDE):</span>
                <div className="sim-buttons">
                  {[
                    "OPEN_PALM",
                    "PINCH_INDEX",
                    "CLOSED_FIST",
                    "POINTING_INDEX",
                    "PEACE_VICTORY",
                    "THUMBS_UP",
                    "THREE_FINGERS",
                    "FOUR_FINGERS",
                    "SWIPE_LEFT",
                    "SWIPE_RIGHT",
                  ].map((g) => (
                    <button
                      key={g}
                      type="button"
                      className="sim-btn"
                      onClick={() => onSimulateGesture?.(g as GestureId)}
                    >
                      [ {g} ]
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Independent 5-Finger State Details */}
          <div className="gestures-guide-col">
            <div className="gestures-guide-panel">
              <div className="finger-panel-header">
                <span className="guide-title">5-FINGER ARTICULATION ANALYSIS</span>
                <span className="hand-side-tag">
                  {primaryHand ? `${primaryHand.handedness.toUpperCase()} HAND DETECTED` : "AWAITING SENSOR"}
                </span>
              </div>

              {/* 5 Finger Progress Bars */}
              <div className="finger-bars-list">
                {[
                  { name: "Thumb", key: "thumb" as const },
                  { name: "Index", key: "index" as const },
                  { name: "Middle", key: "middle" as const },
                  { name: "Ring", key: "ring" as const },
                  { name: "Pinky", key: "pinky" as const },
                ].map((f) => {
                  const data = primaryHand?.fingers[f.key];
                  const state = data?.state || "uncertain";
                  const ratio = data?.extensionRatio ?? 0;
                  const angle = Math.round(data?.curlAngleDeg ?? 0);
                  const progressPct = Math.min(
                    100,
                    Math.max(0, Math.round(((ratio - 0.7) / 0.8) * 100))
                  );

                  return (
                    <div key={f.name} className="finger-stat-card">
                      <div className="finger-stat-top">
                        <span className="finger-title">{f.name.toUpperCase()} FINGER</span>
                        <div className="finger-tags">
                          <span className={`state-badge ${state}`}>
                            {state.toUpperCase()}
                          </span>
                          <span className="angle-badge">{angle}° CURL</span>
                        </div>
                      </div>
                      <div className="finger-meter-bar">
                        <div
                          className={`finger-meter-fill ${state}`}
                          style={{ width: `${cameraOn && primaryHand ? progressPct : 0}%` }}
                        />
                      </div>
                      <div className="finger-stat-bottom">
                        <span className="ratio-label">
                          Extension Ratio: {ratio.toFixed(2)}x
                        </span>
                        <span className="tip-coords">
                          Tip: {data ? `(${data.tip.x.toFixed(2)}, ${data.tip.y.toFixed(2)})` : "--"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pinch Pairs Matrix */}
              <div className="pinch-matrix-card">
                <span className="pinch-title">FINGERTIP PINCH DISTANCE RATIOS (SCALE-NORMALIZED)</span>
                <div className="pinch-chips-grid">
                  {[
                    { label: "Thumb - Index", val: primaryHand?.pinchRatios.thumbIndex },
                    { label: "Thumb - Middle", val: primaryHand?.pinchRatios.thumbMiddle },
                    { label: "Thumb - Ring", val: primaryHand?.pinchRatios.thumbRing },
                    { label: "Thumb - Pinky", val: primaryHand?.pinchRatios.thumbPinky },
                  ].map((p) => {
                    const isPinched = p.val !== undefined && p.val < 0.35;
                    return (
                      <div key={p.label} className={`pinch-chip ${isPinched ? "pinched" : ""}`}>
                        <span className="pinch-label">{p.label}</span>
                        <span className="pinch-value">
                          {p.val !== undefined ? `${p.val.toFixed(2)}x` : "--"}
                          {isPinched && " [PINCHED]"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Mappings Configuration Panel */
        <div className="gestures-mappings-panel">
          <div className="mappings-header-row">
            <div>
              <span className="mappings-headline">GESTURE-TO-ACTION DIRECTIVE MATRIX</span>
              <p className="mappings-headline-sub">
                Configure commands for single-finger states, multi-finger combinations, directional swipes, and pinches.
              </p>
            </div>
          </div>

          <div className="mappings-table-container">
            <table className="hud-table">
              <thead>
                <tr>
                  <th style={{ width: "50px" }}>STATUS</th>
                  <th style={{ width: "200px" }}>GESTURE</th>
                  <th style={{ width: "220px" }}>ASSIGNED DIRECTIVE ACTION</th>
                  <th style={{ width: "100px" }}>MODE</th>
                  <th>DESCRIPTION & TRIGGER CONDITION</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.gestureId} className={m.enabled ? "row-enabled" : "row-disabled"}>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={m.enabled}
                        onChange={(e) =>
                          onUpdateMapping?.(m.gestureId, { enabled: e.target.checked })
                        }
                        className="hud-checkbox"
                        title={m.enabled ? "Gesture active" : "Gesture disabled"}
                      />
                    </td>
                    <td>
                      <span className="mapping-gesture-name">{m.displayName}</span>
                      <span className="mapping-gesture-id">[{m.gestureId}]</span>
                    </td>
                    <td>
                      <select
                        value={m.action}
                        disabled={!m.enabled}
                        onChange={(e) => {
                          const newAction = e.target.value as GestureAction;
                          // If action has consequential impact, show confirmation
                          if (newAction === "PAUSE_LOCK") {
                            setConfirmDialog(`Map "${m.displayName}" to lock gesture inputs?`);
                          }
                          onUpdateMapping?.(m.gestureId, { action: newAction });
                        }}
                        className="hud-select"
                      >
                        {ACTION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`mode-badge ${m.isContinuous ? "continuous" : "discrete"}`}>
                        {m.isContinuous ? "CONTINUOUS" : `${m.holdDurationMs}ms HOLD`}
                      </span>
                    </td>
                    <td className="mapping-desc-text">{m.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="hud-modal-overlay">
          <div className="hud-modal-box">
            <div className="modal-title">ACTION CONFIRMATION</div>
            <div className="modal-body">{confirmDialog}</div>
            <div className="modal-actions">
              <button
                type="button"
                className="hud-btn active"
                onClick={() => setConfirmDialog(null)}
              >
                CONFIRM
              </button>
              <button
                type="button"
                className="hud-btn"
                onClick={() => setConfirmDialog(null)}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
