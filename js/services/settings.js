// UI preferences only. Nothing secret is stored here: there is no API key field,
// and this module never reads or writes credentials.
import { STORAGE_KEY } from "../config.js";

export const DEFAULTS = {
  assistantName: "JARVIS",
  language: "en",
  speechRate: 1.1,
  pitch: 1.0,
  gestureConfidence: 90,
  reduceMotion: false,
  provider: "none",
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function validateSettings(s) {
  const errors = {};
  const name = String(s.assistantName ?? "").trim();
  if (!name) errors.assistantName = "Enter a name for the assistant.";
  else if (name.length > 24) errors.assistantName = "Keep the name to 24 characters or fewer.";
  if (!/^[A-Za-z0-9 _-]*$/.test(name)) errors.assistantName = "Use letters, numbers, spaces, - or _ only.";
  if (!(s.speechRate >= 0.5 && s.speechRate <= 2)) errors.speechRate = "Speech rate must be between 0.5 and 2.";
  return errors;
}

// Returns { ok, error }. Storage can fail in private modes, so we report it.
export function saveSettings(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Could not save preferences in this browser (${err.name}).` };
  }
}
