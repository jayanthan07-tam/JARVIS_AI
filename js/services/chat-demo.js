// DEMO chat service. No AI provider is connected in this milestone, so every
// reply is canned text generated here. The "simulated failure" switch exists to
// preview the error state of the real transport.
import { sleep } from "../utils.js";

const subscribers = new Set();
const state = {
  messages: [],
  busy: false,
  simulateFailure: false,
  pendingDraft: null,
};
let nextId = 1;

function emit() {
  const snap = getChat();
  subscribers.forEach((fn) => fn(snap));
}

export function getChat() {
  return { ...state, messages: state.messages.slice() };
}

export function subscribeChat(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function demoReply(text) {
  const t = text.toLowerCase();
  if (/diagnos|telemetry|sweep|thruster/.test(t)) {
    return "DEMO REPLY. A real diagnostic would run here once the backend is connected. No telemetry was read and nothing was executed.";
  }
  if (/lock|perimeter|security/.test(t)) {
    return "DEMO REPLY. Lockdown actions are not available in demo mode. No system change was made.";
  }
  if (/gesture|hand|palm|camera/.test(t)) {
    return "DEMO REPLY. Gesture tracking is simulated in this build. Open the Gesture Control screen to preview states.";
  }
  return "DEMO REPLY. The AI provider is not connected yet, so this is placeholder text. Your message was received by the interface only.";
}

function push(message) {
  state.messages.push({ id: nextId++, time: new Date(), ...message });
}

export async function sendMessage(text) {
  const clean = text.trim();
  if (!clean || state.busy) return false;
  push({ role: "user", text: clean });
  state.busy = true;
  emit();
  try {
    await sleep(900 + Math.random() * 600);
    if (state.simulateFailure) {
      throw new Error("Simulated transport failure: no backend is connected, so the request timed out.");
    }
    push({ role: "assistant", text: demoReply(clean) });
  } catch (err) {
    push({ role: "error", text: err.message, retryText: clean });
  } finally {
    state.busy = false;
    emit();
  }
  return true;
}

export function clearChat() {
  if (state.busy) return;
  state.messages = [];
  emit();
}

export function setSimulateFailure(on) {
  state.simulateFailure = !!on;
  emit();
}

export function setPendingDraft(text) {
  state.pendingDraft = text;
}

export function takePendingDraft() {
  const text = state.pendingDraft;
  state.pendingDraft = null;
  return text;
}
