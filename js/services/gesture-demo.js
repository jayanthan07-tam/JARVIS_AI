// DEMO gesture tracker. It does not open a camera or run any pose model.
// Triggers below only simulate what a tracker would report.
import { logEvent } from "./event-log.js";

export const GESTURE_STATUS = ["stopped", "starting", "tracking", "error"];

const POSES = {
  OPEN_PALM: { label: "Open palm", action: "Wake / activate HUD (simulated)" },
  PINCH: { label: "Pinch", action: "Select / actuate (simulated)" },
  SWIPE: { label: "Swipe", action: "Switch panels (simulated)" },
  FIST: { label: "Closed fist", action: "Failsafe: pause HUD (simulated)" },
};

const subscribers = new Set();
let timer = null;
const state = {
  status: "stopped",
  pose: null,
  paused: false,
  error: "",
  thresholds: { confidence: 90, pinchGap: 85, swipeVelocity: 72, scroll: 65 },
};

function emit() {
  const snap = getGesture();
  subscribers.forEach((fn) => fn(snap));
}

export function getGesture() {
  return { ...state, thresholds: { ...state.thresholds } };
}

export function subscribeGesture(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function poseCatalog() {
  return POSES;
}

export function startTracking() {
  if (state.status === "starting" || state.status === "tracking") return;
  state.status = "starting";
  state.error = "";
  logEvent("CV", "Demo tracker starting. No camera access was requested.");
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => {
    state.status = "tracking";
    logEvent("CV", "Demo tracker running (simulated feed)");
    emit();
  }, 1200);
}

export function stopTracking(reason = "Tracking stopped by operator") {
  clearTimeout(timer);
  state.status = "stopped";
  state.pose = null;
  state.paused = false;
  logEvent("CV", reason, reason.includes("KILL") ? "err" : undefined);
  emit();
}

export function simulateCameraError() {
  clearTimeout(timer);
  state.status = "error";
  state.pose = null;
  state.error = "Camera not connected. Demo mode does not request camera access.";
  logEvent("CV", "Demo camera error shown (no device was accessed)", "err");
  emit();
}

export function retryTracking() {
  if (state.status !== "error") return;
  state.status = "stopped";
  state.error = "";
  startTracking();
}

export function triggerPose(key) {
  if (state.status !== "tracking" || !POSES[key]) return false;
  const pose = POSES[key];
  state.pose = key;
  if (key === "FIST") state.paused = true;
  else if (key === "OPEN_PALM") state.paused = false;
  logEvent("CV", `[SIM] ${pose.label} >> ${pose.action}`, key === "FIST" ? "warn" : undefined);
  emit();
  return true;
}

export function setThreshold(key, value) {
  if (!(key in state.thresholds)) return;
  state.thresholds[key] = value;
  emit();
}
