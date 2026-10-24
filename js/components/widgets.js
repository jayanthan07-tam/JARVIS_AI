// Small markup helpers shared by the views. Everything that comes from the user
// must go through esc() before it is placed in HTML.
import { esc } from "../utils.js";
import { icon } from "./icons.js";

export function demoBadge(text = "DEMO") {
  return `<span class="badge badge--demo">${esc(text)}</span>`;
}

export function statusBadge(state, text) {
  const cls = state === "error" ? "badge--error" : state === "busy" ? "badge--busy" : state === "off" ? "badge--off" : "";
  return `<span class="badge ${cls}">${esc(text)}</span>`;
}

export function panel({ title, meta = "", body, extraClass = "", aside = "", id = "" }) {
  return `
    <section class="panel ${extraClass}" ${id ? `id="${id}" aria-labelledby="${id}-title"` : ""}>
      <span class="corners" aria-hidden="true"></span>
      <header class="panel-head">
        <h2 class="panel-title" ${id ? `id="${id}-title"` : ""}>${esc(title)}</h2>
        <div class="row-gap">${meta}${aside}</div>
      </header>
      ${body}
    </section>`;
}

// data-bind keys let a view update just the value/bar without re-rendering.
export function meter({ key, label, value, unit = "", pct, sub = "" }) {
  return `
    <div class="meter">
      <div class="meter-row">
        <span>${esc(label)}</span>
        <span class="meter-value"><span data-bind="${key}">${esc(value)}</span>${unit ? ` <small>${esc(unit)}</small>` : ""}</span>
      </div>
      <div class="meter-bar" role="presentation"><div class="meter-fill" data-bar="${key}" style="width:${pct}%"></div></div>
      ${sub ? `<div class="meter-sub">${esc(sub)}</div>` : ""}
    </div>`;
}

export function stat(label, value, unit = "") {
  return `<div class="stat"><div class="stat-label">${esc(label)}</div><div class="stat-value">${esc(value)}${unit ? `<small>${esc(unit)}</small>` : ""}</div></div>`;
}

export function alert(message, { tone = "error" } = {}) {
  const cls = tone === "info" ? "alert alert--info" : "alert";
  const iconName = tone === "info" ? "pulse" : "alert";
  return `<div class="${cls}" role="${tone === "info" ? "status" : "alert"}">${icon(iconName)}<span>${esc(message)}</span></div>`;
}

export function logList(events, limit = 40) {
  if (!events.length) return `<div class="empty">No events yet.</div>`;
  const rows = events.slice(0, limit).map((e) => {
    const tagCls = e.level === "err" ? "log-tag log-tag--err" : e.tag === "DEMO" || e.level === "warn" ? "log-tag log-tag--demo" : "log-tag";
    return `<li><span class="log-time">${esc(e.time)}</span><span class="${tagCls}">[${esc(e.tag)}]</span><span class="log-text">${esc(e.text)}</span></li>`;
  });
  return `<ol class="log" aria-live="polite" aria-label="Event log">${rows.join("")}</ol>`;
}
