import { esc } from "../utils.js";
import { icon } from "../components/icons.js";
import { panel, demoBadge, alert, logList, statusBadge } from "../components/widgets.js";
import { getEvents, subscribeEvents } from "../services/event-log.js";
import {
  getGesture, subscribeGesture, startTracking, stopTracking, simulateCameraError,
  retryTracking, triggerPose, setThreshold, poseCatalog,
} from "../services/gesture-demo.js";

export const title = "Gesture Control";

const THRESHOLDS = [
  { key: "confidence", label: "Confidence threshold", action: "Gate for wake / activate", min: 60, max: 99 },
  { key: "pinchGap", label: "Pinch gap tolerance", action: "Gate for select / actuate", min: 40, max: 99 },
  { key: "swipeVelocity", label: "Swipe velocity sensitivity", action: "Gate for switch panels", min: 40, max: 99 },
  { key: "scroll", label: "Two-finger scroll damping", action: "Gate for telemetry expansion", min: 40, max: 99 },
];

const SIM_BUTTONS = [
  { pose: "OPEN_PALM", label: "Trigger palm", icon: "hand" },
  { pose: "PINCH", label: "Trigger pinch", icon: "pulse" },
  { pose: "SWIPE", label: "Trigger swipe", icon: "pulse" },
  { pose: "FIST", label: "Trigger fist", icon: "lock" },
];

function statusInfo(g) {
  if (g.status === "tracking") return { badge: statusBadge("busy", "Tracking (sim)") + "", cls: "busy" };
  if (g.status === "starting") return { badge: statusBadge("busy", "Starting"), cls: "busy" };
  if (g.status === "error") return { badge: statusBadge("error", "Camera error"), cls: "error" };
  return { badge: statusBadge("off", "Stopped"), cls: "off" };
}

function overlayHtml(g) {
  if (g.status === "error") {
    return `<div class="camera-msg" role="alert"><strong>Camera not connected</strong>${esc(g.error)}<div style="margin-top:10px"><button class="btn btn--small" id="cam-retry">${icon("refresh")} Retry demo</button></div></div>`;
  }
  if (g.status === "starting") {
    return `<div class="camera-msg" style="border-color:rgba(0,240,255,.4);color:var(--c-primary)" role="status"><span class="spinner" style="display:inline-block;vertical-align:middle;margin-right:8px"></span>Starting demo tracker...</div>`;
  }
  if (g.status === "tracking") {
    const box = g.pose ? `<div class="bbox"><span class="bbox-tag">POSE: ${esc(g.pose)} // SIM</span></div>` : "";
    return `${box}<div class="camera-hud">SIM FEED // 1920x1080</div><div class="camera-hud camera-hud-r">Demo only</div><div class="camera-bottom"><span>${g.pose ? esc(poseCatalog()[g.pose].label) : "Waiting for a pose"}</span><span>${g.paused ? "PAUSED (failsafe)" : "LIVE (simulated)"}</span></div>`;
  }
  return `<div class="camera-msg" style="border-color:rgba(132,148,149,.5);color:var(--c-on-variant)"><strong>Camera feed is off</strong>Start the demo tracker to preview states. No camera is accessed.</div>`;
}

export function render() {
  const g = getGesture();
  const info = statusInfo(g);
  return `
    <div class="screen screen-gestures">
      <div class="stack">
        ${panel({
          title: "Optical CV // Tactical stream 01",
          meta: `<span data-slot="badge">${info.badge}</span>${demoBadge("Simulated feed")}`,
          body: `
            <div class="camera" id="camera" aria-label="Camera preview placeholder">
              <div class="camera-scan" data-slot="scan" ${g.status === "tracking" || g.status === "starting" ? "" : "hidden"}></div>
              <div class="camera-overlay" data-slot="overlay">${overlayHtml(g)}</div>
            </div>
            <div class="controls">
              <button class="btn" id="track-start" ${g.status === "starting" || g.status === "tracking" ? "disabled" : ""}>${icon("play")} Start demo tracker</button>
              <button class="btn btn--danger killswitch" id="track-kill" ${g.status === "stopped" ? "disabled" : ""}>${icon("stop")} Stop tracking [kill]</button>
            </div>
            <div data-slot="pause">${g.paused ? `<div style="margin-top:12px">${alert("HUD paused by the closed-fist failsafe (simulated). Open palm resumes.", { tone: "info" })}</div>` : ""}</div>`,
        })}
        ${panel({
          title: "Gesture event feed",
          meta: demoBadge("Local only"),
          body: `<div data-slot="events">${logList(getEvents().filter((e) => e.tag === "CV"), 30)}</div>`,
        })}
      </div>

      <div class="stack">
        ${panel({
          title: "Mapping matrix",
          meta: `<span class="meter-value">4 gates</span>`,
          body: `
            ${THRESHOLDS.map((t) => `
              <div class="mapping-row">
                <div class="mapping-head"><span>${esc(t.label)}</span><span><span data-val="${t.key}">${g.thresholds[t.key]}</span>%</span></div>
                <input class="range" type="range" min="${t.min}" max="${t.max}" value="${g.thresholds[t.key]}" data-threshold="${t.key}" aria-label="${esc(t.label)}" />
                <div class="mapping-action">${esc(t.action)}</div>
              </div>`).join("")}
            <p class="field-hint" style="margin-top:12px">Gate values are kept on this screen only. They do not change any tracker.</p>`,
        })}
        ${panel({
          title: "Gesture simulator",
          meta: demoBadge("Synthetic"),
          body: `
            <p class="note-box" style="margin-bottom:12px">Triggers report a fake pose so the layout and states can be reviewed. They do not read a camera.</p>
            <div class="sim-grid">
              ${SIM_BUTTONS.map((b) => `<button class="btn btn--ghost btn--small" data-pose="${b.pose}" ${g.status === "tracking" ? "" : "disabled"}>${icon(b.icon)} ${esc(b.label)}</button>`).join("")}
            </div>
            <div class="controls"><button class="btn btn--ghost btn--small" id="sim-cam-error">Simulate camera error</button></div>`,
        })}
      </div>
    </div>`;
}

export function mount(root) {
  const paint = (g) => {
    const info = statusInfo(g);
    root.querySelector('[data-slot="badge"]').innerHTML = info.badge;
    root.querySelector('[data-slot="scan"]').hidden = !(g.status === "tracking" || g.status === "starting");
    root.querySelector('[data-slot="overlay"]').innerHTML = overlayHtml(g);
    root.querySelector('[data-slot="pause"]').innerHTML = g.paused ? `<div style="margin-top:12px">${alert("HUD paused by the closed-fist failsafe (simulated). Open palm resumes.", { tone: "info" })}</div>` : "";
    root.querySelector("#track-start").disabled = g.status === "starting" || g.status === "tracking";
    root.querySelector("#track-kill").disabled = g.status === "stopped";
    root.querySelectorAll("[data-pose]").forEach((b) => { b.disabled = g.status !== "tracking"; });
  };

  const onClick = (e) => {
    const pose = e.target.closest("[data-pose]");
    if (pose) return void triggerPose(pose.dataset.pose);
    if (e.target.closest("#track-start")) return void startTracking();
    if (e.target.closest("#track-kill")) return void stopTracking("Tracking stopped by operator [KILL]");
    if (e.target.closest("#sim-cam-error")) return void simulateCameraError();
    if (e.target.closest("#cam-retry")) return void retryTracking();
  };
  root.addEventListener("click", onClick);

  const onInput = (e) => {
    const el = e.target.closest("[data-threshold]");
    if (!el) return;
    const value = Number(el.value);
    setThreshold(el.dataset.threshold, value);
    root.querySelector(`[data-val="${el.dataset.threshold}"]`).textContent = value;
  };
  root.addEventListener("input", onInput);

  const unsubGesture = subscribeGesture(paint);
  const unsubEvents = subscribeEvents((events) => {
    root.querySelector('[data-slot="events"]').innerHTML = logList(events.filter((e) => e.tag === "CV"), 30);
  });

  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("input", onInput);
    unsubGesture();
    unsubEvents();
  };
}
