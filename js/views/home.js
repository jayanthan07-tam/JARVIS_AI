import { esc, greetingFor } from "../utils.js";
import { icon } from "../components/icons.js";
import { panel, meter, logList, demoBadge } from "../components/widgets.js";
import { getTelemetry, subscribeTelemetry } from "../services/telemetry.js";
import { getEvents, subscribeEvents } from "../services/event-log.js";
import { getGesture, subscribeGesture } from "../services/gesture-demo.js";
import { setPendingDraft } from "../services/chat-demo.js";
import { navigate } from "../router.js";

export const title = "Home";

const QUICK_COMMANDS = [
  "Isolate core audio",
  "Run full lab diagnostic",
  "Lockdown perimeter",
];

function sparkline(points) {
  const w = 220, h = 40;
  const step = w / Math.max(1, points.length - 1);
  const d = points.map((v, i) => `${(i * step).toFixed(1)},${(h - v * h).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" class="sparkline" preserveAspectRatio="none" aria-hidden="true"><polyline data-bind="spark" points="${d}" fill="none" stroke="#00f0ff" stroke-width="1.4" /></svg>`;
}

export function render() {
  const t = getTelemetry();
  const greeting = `${greetingFor()}, sir`;

  const diagnostics = panel({
    title: "Diagnostics // Vitals",
    meta: demoBadge("Demo telemetry"),
    body: `
      ${meter({ key: "neuralReadiness", label: "Neural engine", value: t.neuralReadiness.toFixed(1), unit: "% ready", pct: t.neuralReadiness, sub: "Simulated value. No model is loaded." })}
      ${meter({ key: "opticalFps", label: "Optical CV tracker", value: t.opticalFps.toFixed(1), unit: "FPS", pct: (t.opticalFps / 60) * 100, sub: "Camera offline. Value is simulated." })}
      ${meter({ key: "latencyMs", label: "Round-trip latency", value: t.latencyMs, unit: "ms", pct: Math.max(5, 100 - t.latencyMs * 4), sub: "Not measured. No server responded." })}
      <div class="meter"><div class="meter-row"><span>Security matrix</span><span class="meter-value">NOT ASSESSED</span></div><div class="meter-sub">No security checks run in demo mode.</div></div>
      <div class="sparkline-wrap">
        <div class="meter-row"><span>Synapse frequency flux</span><span class="meter-value"><span data-bind="flux">${t.flux}</span> GHz</span></div>
        <div data-slot="spark">${sparkline(t.history)}</div>
      </div>`,
  });

  const capacitance = panel({
    title: "Arc capacitance",
    meta: `<span class="meter-value"><span data-bind="arcCapacitance">${t.arcCapacitance}</span>% cap</span>`,
    body: `
      <div class="stat-grid">
        <div class="stat-cell"><div class="stat-label">Thermal</div><div class="stat-value"><span data-bind="thermalC">${t.thermalC}</span><small>C</small></div></div>
        <div class="stat-cell"><div class="stat-label">Flux</div><div class="stat-value"><span data-bind="fluxBig">${t.flux}</span><small>T</small></div></div>
        <div class="stat-cell"><div class="stat-label">Bus</div><div class="stat-value">${t.bus}<small>V</small></div></div>
      </div>
      <p class="field-hint" style="margin-top:12px">Pulse frequency: not measured (demo)</p>`,
  });

  const gesturePanel = panel({
    title: "Optical CV // Gesture",
    meta: `<span class="meter-value" data-bind="gestureFps">--</span>`,
    body: `
      <div class="pose">
        <div class="pose-icon">${icon("hand")}</div>
        <div>
          <div class="pose-title" data-bind="poseTitle">No hand in frame</div>
          <div class="pose-sub" data-bind="poseSub">Camera not connected. Demo only.</div>
        </div>
      </div>
      <div class="two-up">
        <div><div class="stat-label">Current mode</div><div class="mode-value" data-bind="mode">Standby</div></div>
        <div><div class="stat-label">Pinch action</div><div class="mode-value">Select, simulated</div></div>
      </div>
      <a class="btn btn--ghost btn--block" href="#/gestures" style="margin-top:12px">Open gesture control</a>`,
  });

  const subsystems = panel({
    title: "Tactical subsystems",
    meta: `<span class="badge badge--off">Standby</span>`,
    body: `
      <div class="subsystems">
        <a class="subsystem" href="#/chat">${icon("terminal")}<span>Terminal</span><small>AI chat, demo</small></a>
        <a class="subsystem" href="#/system">${icon("flask")}<span>Diagnostics</span><small>System, demo</small></a>
        <a class="subsystem" href="#/voice">${icon("voice")}<span>Voice</span><small>Simulated</small></a>
      </div>`,
  });

  const feed = panel({
    title: "Live event stream",
    meta: `<span class="badge badge--demo">Local only</span>`,
    body: `<div data-slot="feed" class="event-feed">${logList(getEvents(), 6)}</div>
      <div class="feed-foot"><span class="field-hint">No backend stream. Entries come from demo services.</span><a href="#/system" class="link-btn">Expand logs</a></div>`,
  });

  return `
    <div class="screen screen-home">
      <div class="stack stack--left">${diagnostics}${capacitance}</div>

      <div class="center-col">
        <div class="greeting">
          <h1>${esc(greeting)}</h1>
          <p>All systems in demo mode // backend not connected</p>
        </div>

        <div class="core" role="img" aria-label="Holographic energy core (decorative)">
          <span class="core-ring core-ring--sweep" aria-hidden="true"></span>
          <span class="core-ring core-ring--dash" aria-hidden="true"></span>
          <span class="core-ring core-ring--inner" aria-hidden="true"></span>
          <span class="core-tick core-tick--top" aria-hidden="true">000&deg;</span>
          <span class="core-tick core-tick--bottom" aria-hidden="true">180&deg;</span>
          <span class="core-tick core-tick--left" aria-hidden="true">270&deg;</span>
          <span class="core-tick core-tick--right" aria-hidden="true">090&deg;</span>
          <img class="core-img" src="assets/img/energy-core.jpg" alt="" width="720" height="720" />
          <span class="core-caption">Core state: DEMO // no live link</span>
        </div>

        <form id="home-form" class="command" novalidate>
          <label class="sr-only" for="home-input">Command for J.A.R.V.I.S.</label>
          <div class="command-row">
            <button type="button" class="mic-btn" id="home-mic" aria-label="Open voice assistant">${icon("mic")}</button>
            <input id="home-input" class="input" type="text" autocomplete="off" maxlength="4000"
              placeholder="Enter a command or question, sir..." aria-describedby="home-error" />
            <button type="submit" class="btn btn--cut">Transmit ${icon("send")}</button>
          </div>
          <p id="home-error" class="field-error" role="alert" hidden>Enter a command first.</p>
          <div class="pills">
            ${QUICK_COMMANDS.map((c) => `<button type="button" class="pill quick" data-cmd="${esc(c)}"><span class="chev">&gt;</span>&ldquo;${esc(c)}&rdquo;</button>`).join("")}
          </div>
        </form>
      </div>

      <div class="stack stack--right">${gesturePanel}${subsystems}${feed}</div>
    </div>`;
}

export function mount(root) {
  const input = root.querySelector("#home-input");
  const form = root.querySelector("#home-form");
  const err = root.querySelector("#home-error");

  const onSubmit = (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) {
      err.hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    setPendingDraft(text);
    navigate("chat");
  };
  form.addEventListener("submit", onSubmit);

  const onQuick = (e) => {
    const btn = e.target.closest(".quick");
    if (!btn) return;
    input.value = btn.dataset.cmd;
    input.removeAttribute("aria-invalid");
    err.hidden = true;
    input.focus();
  };
  root.addEventListener("click", onQuick);

  input.addEventListener("input", () => {
    if (input.value.trim()) {
      err.hidden = true;
      input.removeAttribute("aria-invalid");
    }
  });

  root.querySelector("#home-mic").addEventListener("click", () => navigate("voice"));

  const setText = (key, value) => {
    const el = root.querySelector(`[data-bind="${key}"]`);
    if (el) el.textContent = value;
  };
  const setBar = (key, pct) => {
    const el = root.querySelector(`[data-bar="${key}"]`);
    if (el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  };

  const unsubTelemetry = subscribeTelemetry((t) => {
    setText("neuralReadiness", t.neuralReadiness.toFixed(1));
    setText("opticalFps", t.opticalFps.toFixed(1));
    setText("latencyMs", t.latencyMs);
    setText("flux", t.flux);
    setText("fluxBig", t.flux);
    setText("arcCapacitance", t.arcCapacitance);
    setText("thermalC", t.thermalC);
    setBar("neuralReadiness", t.neuralReadiness);
    setBar("opticalFps", (t.opticalFps / 60) * 100);
    setBar("latencyMs", Math.max(5, 100 - t.latencyMs * 4));
    const spark = root.querySelector('[data-bind="spark"]');
    if (spark) {
      const w = 220, h = 40, step = w / Math.max(1, t.history.length - 1);
      spark.setAttribute("points", t.history.map((v, i) => `${(i * step).toFixed(1)},${(h - v * h).toFixed(1)}`).join(" "));
    }
  });

  const renderGesture = (g) => {
    const poseNames = { OPEN_PALM: "Open palm detected", PINCH: "Pinch detected", SWIPE: "Swipe detected", FIST: "Closed fist: paused" };
    const title = g.pose ? poseNames[g.pose] : g.status === "tracking" ? "Waiting for a pose" : "No hand in frame";
    const sub = g.status === "tracking" ? "Simulated tracker running" : g.status === "starting" ? "Starting demo tracker..." : g.status === "error" ? "Camera not connected" : "Camera not connected. Demo only.";
    setText("poseTitle", title);
    setText("poseSub", sub);
    setText("mode", g.paused ? "Paused" : g.status === "tracking" ? "Tracking (sim)" : "Standby");
    setText("gestureFps", g.status === "tracking" ? "SIM" : "--");
  };
  renderGesture(getGesture());
  const unsubGesture = subscribeGesture(renderGesture);

  const unsubEvents = subscribeEvents((events) => {
    const slot = root.querySelector('[data-slot="feed"]');
    if (slot) slot.innerHTML = logList(events, 6);
  });

  return () => {
    form.removeEventListener("submit", onSubmit);
    root.removeEventListener("click", onQuick);
    unsubTelemetry();
    unsubGesture();
    unsubEvents();
  };
}
