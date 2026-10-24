// DEMO voice assistant. It never requests microphone access and never does
// speech recognition or synthesis. It only walks through the UI state machine
// so the listening / processing / speaking / error states can be reviewed.
import { logEvent } from "./event-log.js";

export const PHASES = ["idle", "listening", "processing", "speaking", "error"];
const DEMO_HEARD = "Jarvis, run a thermal diagnostic on the thrusters.";
const DEMO_REPLY = "DEMO REPLY. Voice is simulated. A real response would be spoken here once speech output is connected.";

const subscribers = new Set();
let timers = [];
const state = { phase: "idle", transcript: "", response: "", error: "", source: "demo" };

function emit() {
  const snap = getVoice();
  subscribers.forEach((fn) => fn(snap));
}

export function getVoice() {
  return { ...state };
}

export function subscribeVoice(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function later(ms, fn) {
  const id = setTimeout(() => {
    timers = timers.filter((t) => t !== id);
    fn();
  }, ms);
  timers.push(id);
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function typeOut(full, key, onDone) {
  const words = full.split(" ");
  let i = 0;
  const step = () => {
    i += 1;
    state[key] = words.slice(0, i).join(" ");
    emit();
    if (i < words.length) later(140, step);
    else onDone?.();
  };
  later(140, step);
}

export function setPhase(phase) {
  clearTimers();
  state.phase = phase;
  state.error = "";
  if (phase === "idle") {
    state.transcript = "";
    state.response = "";
  }
  if (phase === "listening") {
    state.transcript = "";
    state.response = "";
  }
  if (phase === "speaking" && !state.response) state.response = DEMO_REPLY;
  emit();
}

export function startListening() {
  if (state.phase === "listening") return;
  clearTimers();
  state.phase = "listening";
  state.transcript = "";
  state.response = "";
  state.error = "";
  logEvent("AUDIO", "Demo listening started. No microphone access was requested.");
  emit();
  later(400, () => typeOut(DEMO_HEARD, "transcript", () => later(900, finishListening)));
}

export function finishListening() {
  if (state.phase !== "listening") return;
  clearTimers();
  state.phase = "processing";
  emit();
  later(1300, () => {
    state.phase = "speaking";
    state.response = "";
    emit();
    typeOut(DEMO_REPLY, "response", () => later(1200, () => {
      state.phase = "idle";
      emit();
    }));
  });
}

export function cancel() {
  clearTimers();
  state.phase = "idle";
  state.transcript = "";
  state.response = "";
  state.error = "";
  emit();
}

export function simulateMicError() {
  clearTimers();
  state.phase = "error";
  state.error = "Microphone not connected. Demo mode cannot capture audio, so there is nothing to listen to.";
  logEvent("AUDIO", "Demo microphone error shown (no device was accessed)", "err");
  emit();
}

export function retryFromError() {
  if (state.phase !== "error") return;
  state.phase = "idle";
  state.error = "";
  emit();
}
