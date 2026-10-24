import { ROUTES, CONNECTIONS, WS_URL } from "../config.js";
import { icon } from "./icons.js";
import { esc, utcClock } from "../utils.js";

let clockTimer = null;

function chipHtml(key, c) {
  const dotCls = c.state === "on" ? "dot" : "dot dot--off";
  const hide = "";
  return `<span class="chip chip--off${hide}" title="${esc(c.detail)}"><span class="${dotCls}"></span>${esc(c.label)}: ${esc(c.value)}</span>`;
}

export function renderShell() {
  const header = document.getElementById("site-header");
  const banner = document.getElementById("demo-banner");
  const nav = document.getElementById("bottom-nav");
  const footer = document.getElementById("status-bar");

  header.innerHTML = `
    <a class="brand" href="#/home" aria-label="J.A.R.V.I.S. home">
      <span class="brand-dot" aria-hidden="true"></span>
      <span>
        <span class="brand-title" style="display:block">J.A.R.V.I.S.</span>
        <span class="brand-sub" style="display:block">Mark VII // Tactical HUD</span>
      </span>
    </a>
    <nav class="tabs" aria-label="Primary">
      ${ROUTES.map((r) => `<a class="tab ${r.mobile ? "" : "tab--hide-md"}" data-route="${r.id}" href="#/${r.id}">${esc(r.label)}</a>`).join("")}
    </nav>
    <time class="clock" id="utc-clock" aria-label="UTC time"></time>`;

  banner.innerHTML = `${icon("alert")}<span><strong>Demo mode.</strong> No backend, camera, microphone or AI provider is connected. Telemetry, voice, gestures, replies and system actions are simulated.</span>`;

  nav.innerHTML = ROUTES.filter((r) => r.mobile).map((r) => `
    <a class="bnav-item" data-route="${r.id}" href="#/${r.id}" aria-label="${esc(r.label)}">
      <span class="bnav-pill">${icon(r.icon)}</span>
      <span>${esc(r.short)}</span>
    </a>`).join("");

  footer.innerHTML = `
    <div class="header-chips" role="group" aria-label="Connection status">
      ${Object.entries(CONNECTIONS).map(([k, c]) => chipHtml(k, c)).join("")}
    </div>
    <span><span class="dot dot--off"></span> WS: ${esc(WS_URL)} (not connected)</span>
    `;

  const tick = () => {
    const el = document.getElementById("utc-clock");
    if (el) el.textContent = utcClock();
  };
  tick();
  if (!clockTimer) clockTimer = setInterval(tick, 1000);
}

export function setActiveRoute(id) {
  document.querySelectorAll("[data-route]").forEach((a) => {
    if (a.dataset.route === id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}
