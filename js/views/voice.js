import { esc } from "../utils.js";
import { icon } from "../components/icons.js";
import { panel, demoBadge, alert } from "../components/widgets.js";
import { loadSettings } from "../services/settings.js";
import {
  getVoice, subscribeVoice, startListening, finishListening, cancel,
  simulateMicError, retryFromError, setPhase,
} from "../services/voice-demo.js";

export const title = "Voice Assistant";

const PHASE_LABEL = {
  idle: "Idle",
  listening: "Listening",
  processing: "Processing",
  speaking: "Speaking",
  error: "Error",
};
const PREVIEW = ["idle", "listening", "processing", "speaking", "error"];
const BAR_COUNT = 32;

function stateLine(snap) {
  const hint = {
    idle: "Press the orb to start a demo session",
    listening: "Demo listening. No microphone is used",
    processing: "Simulated: composing a demo reply",
    speaking: "Simulated: showing a demo reply",
    error: "Demo could not start listening",
  }[snap.phase];
  return `<div class="state-line"><span class="dot ${snap.phase === "error" ? "dot--error" : snap.phase === "idle" ? "dot--off" : "dot--pulse"}"></span>${esc(PHASE_LABEL[snap.phase])}</div><p class="field-hint">${esc(hint)}</p>`;
}

function textBlock(snap) {
  const heard = snap.transcript ? esc(snap.transcript) : `<span class="field-hint">Nothing heard yet.</span>`;
  const reply = snap.response ? esc(snap.response) : `<span class="field-hint">No reply yet.</span>`;
  return `
    <div class="transcript-meta">Stark // heard (demo)</div>
    <div class="transcript">${heard}</div>
    <div class="transcript-meta" style="margin-top:14px">J.A.R.V.I.S. // reply (demo)</div>
    <div class="transcript">${reply}</div>`;
}

function errorBlock(snap) {
  if (snap.phase !== "error") return "";
  return `<div style="margin-top:12px">${alert(snap.error)}<div class="controls"><button class="btn btn--small" id="voice-retry">${icon("refresh")} Retry demo</button></div></div>`;
}

export function render() {
  const s = loadSettings();
  const snap = getVoice();
  return `
    <div class="screen screen-voice">
      <div class="voice-col">
        ${panel({
          title: "Audio core // Dual-band DSP",
          meta: demoBadge("Simulated"),
          extraClass: "voice-stage-panel",
          body: `
            <div class="voice-stage">
              <div class="orb-wrap" id="orb-wrap" data-state="${snap.phase}">
                <span class="orb-halo" aria-hidden="true"></span>
                <span class="orb-ring" aria-hidden="true"></span>
                <button type="button" class="orb-btn" id="orb" aria-label="${snap.phase === "listening" ? "Stop demo listening" : "Start demo listening"}">${icon("mic")}</button>
              </div>
              <div data-slot="state">${stateLine(snap)}</div>
              <div class="state-switch" role="group" aria-label="Preview a visual state (no audio involved)">
                ${PREVIEW.map((p) => `<button type="button" class="btn btn--ghost btn--small" data-preview="${p}" aria-pressed="${snap.phase === p}">${esc(PHASE_LABEL[p])}</button>`).join("")}
              </div>
              <p class="field-hint">Preview buttons only change the display. They do not start audio.</p>
              <div class="fft" id="fft" aria-hidden="true">${Array.from({ length: BAR_COUNT }, () => "<span></span>").join("")}</div>
              <div data-slot="error" style="width:100%">${errorBlock(snap)}</div>
            </div>`,
        })}
        ${panel({
          title: "Voice telemetry feed",
          meta: demoBadge("Demo"),
          body: `<div data-slot="text">${textBlock(snap)}</div>`,
        })}
      </div>

      <aside class="stack voice-side">
        ${panel({
          title: "Microphone node",
          body: `
            <div class="setting-list">
              <div class="setting-row"><span>Input device</span><span class="badge badge--off">Not connected</span></div>
              <div class="setting-row"><span>Audio capture</span><span>Off (never requested)</span></div>
              <div class="setting-row"><span>Wake word</span><span>Not armed</span></div>
              <div class="setting-row"><span>Activation</span><span>Manual (demo)</span></div>
            </div>
            <div class="controls"><button class="btn btn--ghost btn--small" id="sim-mic-error">Simulate mic error</button></div>`,
        })}
        ${panel({
          title: "Voice profile",
          meta: demoBadge("Preview"),
          body: `
            <div class="setting-list">
              <div class="setting-row"><span>Speech rate (from AI Settings)</span><span>${esc(s.speechRate.toFixed(2))}</span></div>
              <div class="setting-row"><span>Pitch (from AI Settings)</span><span>${esc(s.pitch.toFixed(2))}</span></div>
              <div class="setting-row"><span>Speech output</span><span class="badge badge--off">Not connected</span></div>
              <div class="setting-row"><span>Speech recognition</span><span class="badge badge--off">Not connected</span></div>
            </div>`,
        })}
        ${panel({
          title: "Behaviour",
          body: `<p class="note-box">Press the orb to run a scripted demo: listening, processing, then a canned reply. Pressing again while listening ends the session early. Nothing you say is recorded.</p>`,
        })}
      </aside>
    </div>`;
}

export function mount(root) {
  const orb = root.querySelector("#orb");
  const wrap = root.querySelector("#orb-wrap");
  const fftBars = Array.from(root.querySelectorAll("#fft span"));

  const paint = (snap) => {
    wrap.dataset.state = snap.phase;
    orb.setAttribute("aria-label", snap.phase === "listening" ? "Stop demo listening" : "Start demo listening");
    root.querySelector('[data-slot="state"]').innerHTML = stateLine(snap);
    root.querySelector('[data-slot="text"]').innerHTML = textBlock(snap);
    root.querySelector('[data-slot="error"]').innerHTML = errorBlock(snap);
    root.querySelectorAll("[data-preview]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preview === snap.phase)));
    const retry = root.querySelector("#voice-retry");
    if (retry) retry.addEventListener("click", () => retryFromError());
  };

  const onOrb = () => {
    const snap = getVoice();
    if (snap.phase === "error") {
      retryFromError();
      startListening();
    } else if (snap.phase === "idle") {
      startListening();
    } else if (snap.phase === "listening") {
      finishListening();
    } else {
      cancel();
    }
  };
  orb.addEventListener("click", onOrb);

  const onClick = (e) => {
    const preview = e.target.closest("[data-preview]");
    if (preview) {
      const p = preview.dataset.preview;
      if (p === "error") simulateMicError();
      else setPhase(p);
      return;
    }
    if (e.target.closest("#sim-mic-error")) simulateMicError();
  };
  root.addEventListener("click", onClick);

  const unsub = subscribeVoice(paint);
  paint(getVoice());

  // Spectrum-style bars: animated only while the demo is listening or speaking.
  let fftTimer = setInterval(() => {
    const active = ["listening", "speaking"].includes(getVoice().phase);
    fftBars.forEach((bar) => {
      const h = active ? 8 + Math.random() * 64 : 4;
      bar.style.height = `${h}px`;
    });
  }, 120);

  return () => {
    orb.removeEventListener("click", onOrb);
    root.removeEventListener("click", onClick);
    unsub();
    clearInterval(fftTimer);
  };
}
