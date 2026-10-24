// DEMO telemetry. These numbers are generated locally to exercise the layout.
// They do not reflect any real hardware or backend state.
import { randomBetween } from "../utils.js";

const subscribers = new Set();
let timer = null;

const state = {
  neuralReadiness: 99.8,
  opticalFps: 60.0,
  latencyMs: 4,
  coherence: 99.8,
  arcCapacitance: 88.4,
  thermalC: 41,
  flux: 9.2,
  bus: 0.8,
  history: Array.from({ length: 24 }, () => randomBetween(0.2, 0.9)),
};

function tick() {
  state.neuralReadiness = +randomBetween(99.5, 99.9).toFixed(1);
  state.opticalFps = +randomBetween(59.2, 60.4).toFixed(1);
  state.latencyMs = Math.round(randomBetween(3, 6));
  state.coherence = +randomBetween(99.6, 99.9).toFixed(1);
  state.arcCapacitance = +randomBetween(88.1, 88.6).toFixed(1);
  state.thermalC = Math.round(randomBetween(40, 43));
  state.flux = +randomBetween(9.0, 9.4).toFixed(1);
  state.history = [...state.history.slice(1), randomBetween(0.2, 0.9)];
  const snap = getTelemetry();
  subscribers.forEach((fn) => fn(snap));
}

export function getTelemetry() {
  return { ...state, history: state.history.slice() };
}

export function subscribeTelemetry(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function startTelemetry() {
  if (timer) return;
  timer = setInterval(tick, 2000);
}
