// Shared event log used by the home feed, gesture console and system log.
// Entries are created by local demo services only; nothing is read from a backend.
import { localStamp } from "../utils.js";

const MAX_ENTRIES = 200;
let nextId = 1;
let entries = [];
const subscribers = new Set();

function notify() {
  const snapshot = entries.slice();
  subscribers.forEach((fn) => fn(snapshot));
}

export function logEvent(tag, text, level = "info") {
  entries.unshift({ id: nextId++, time: localStamp(), tag, text, level });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  notify();
}

export function getEvents() {
  return entries.slice();
}

export function subscribeEvents(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

// Seed entries so the feed is never empty on first load.
logEvent("INIT", "Interface loaded");
logEvent("DEMO", "Demo mode: no backend, camera or microphone connected");
