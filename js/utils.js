export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

const pad = (n) => String(n).padStart(2, "0");

export function utcClock(date = new Date()) {
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

export function localStamp(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const randomBetween = (min, max) => min + Math.random() * (max - min);
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function toast(message, { error = false } = {}) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("toast--error", error);
  el.classList.add("is-visible");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("is-visible"), 2600);
}
