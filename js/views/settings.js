import { esc, toast } from "../utils.js";
import { icon } from "../components/icons.js";
import { panel, demoBadge, alert, statusBadge } from "../components/widgets.js";
import { CONNECTIONS } from "../config.js";
import { DEFAULTS, loadSettings, saveSettings, validateSettings } from "../services/settings.js";

export const title = "AI Settings";

function field(id, label, control, hint = "") {
  return `<div class="field"><label class="field-label" for="${id}">${esc(label)}</label>${control}${hint ? `<span class="field-hint">${esc(hint)}</span>` : ""}<span class="field-error" id="${id}-error" hidden></span></div>`;
}

function formHtml(s) {
  return `
    <form id="settings-form" class="form-stack" novalidate>
      ${panel({
        title: "Assistant",
        body: `<div class="form-grid">
          ${field("assistantName", "Assistant name", `<input id="assistantName" name="assistantName" class="input" type="text" maxlength="30" value="${esc(s.assistantName)}" aria-describedby="assistantName-error" />`, "Shown in the header and replies. Up to 24 characters.")}
          ${field("language", "Language", `<select id="language" name="language" class="select"><option value="en" ${s.language === "en" ? "selected" : ""}>English</option><option value="ta" disabled>Tamil (planned)</option></select>`, "Tamil is not available in this milestone.")}
        </div>`,
      })}
      ${panel({
        title: "Voice",
        meta: demoBadge("Preview only"),
        body: `<div class="form-grid">
          ${field("speechRate", "Speech rate", `<input id="speechRate" name="speechRate" class="range" type="range" min="0.5" max="2" step="0.05" value="${s.speechRate}" /><span class="field-hint"><span id="speechRate-out">${s.speechRate.toFixed(2)}</span>x</span>`)}
          ${field("pitch", "Pitch", `<input id="pitch" name="pitch" class="range" type="range" min="0.5" max="1.5" step="0.05" value="${s.pitch}" /><span class="field-hint"><span id="pitch-out">${s.pitch.toFixed(2)}</span></span>`)}
        </div>`,
      })}
      ${panel({
        title: "Gestures",
        body: field("gestureConfidence", "Default confidence threshold", `<input id="gestureConfidence" name="gestureConfidence" class="range" type="range" min="60" max="99" step="1" value="${s.gestureConfidence}" /><span class="field-hint"><span id="gestureConfidence-out">${s.gestureConfidence}</span>%</span>`, "Used as the starting value on the gesture screen."),
      })}
      ${panel({
        title: "Interface",
        body: `
          <label class="toggle"><input type="checkbox" id="reduceMotion" name="reduceMotion" ${s.reduceMotion ? "checked" : ""} /> Reduce motion (rings, halos, scan lines)</label>
          <p class="field-hint" style="margin-top:8px">Your system's reduced-motion setting is also respected.</p>`,
      })}
      ${panel({
        title: "AI provider",
        meta: statusBadge("off", "Not configured"),
        body: `
          ${field("provider", "Reply source", `<select id="provider" name="provider" class="select"><option value="none" ${s.provider === "none" ? "selected" : ""}>Demo replies only (no provider)</option></select>`, "Provider connection is a later milestone.")}
          <div style="margin-top:12px">${alert("This page never asks for or stores an API key. Provider secrets belong on the backend, not in the browser.", { tone: "info" })}</div>`,
      })}
      <div class="form-actions">
        <span id="settings-status" class="field-hint" role="status" aria-live="polite"></span>
        <button type="button" class="btn btn--ghost" id="reset-settings">${icon("refresh")} Reset to defaults</button>
        <button type="submit" class="btn" id="save-settings">${icon("check")} Save preferences</button>
      </div>
    </form>`;
}

export function render() {
  const s = loadSettings();
  return `
    <div class="screen screen-settings">
      <div id="settings-form-wrap">${formHtml(s)}</div>
      <aside class="stack">
        ${panel({
          title: "Current status",
          meta: demoBadge("Demo"),
          body: `<div class="setting-list">
            ${Object.values(CONNECTIONS).map((c) => `<div class="setting-row"><span>${esc(c.label)}</span><span class="badge badge--off">${esc(c.value)}</span></div>`).join("")}
          </div>`,
        })}
        ${panel({
          title: "Where preferences live",
          body: `<p class="note-box"><strong>Stored in this browser only.</strong> Preferences are saved to local storage on this device. No account, key or personal data is sent anywhere.</p>`,
        })}
      </aside>
    </div>`;
}

export function mount(root) {
  const form = root.querySelector("#settings-form");
  const wrap = root.querySelector("#settings-form-wrap");
  const status = root.querySelector("#settings-status");

  const readForm = () => ({
    assistantName: form.assistantName.value,
    language: form.language.value,
    speechRate: Number(form.speechRate.value),
    pitch: Number(form.pitch.value),
    gestureConfidence: Number(form.gestureConfidence.value),
    reduceMotion: form.reduceMotion.checked,
    provider: form.provider.value,
  });

  const showErrors = (errors) => {
    Object.keys(DEFAULTS).forEach((key) => {
      const el = form.querySelector(`#${key}`);
      const err = form.querySelector(`#${key}-error`);
      if (!el || !err) return;
      const msg = errors[key] || "";
      err.textContent = msg;
      err.hidden = !msg;
      if (msg) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
    });
  };

  const applyMotion = (on) => document.body.classList.toggle("reduce-motion", !!on);
  applyMotion(loadSettings().reduceMotion);

  const onInput = (e) => {
    const t = e.target;
    if (t.id === "speechRate") root.querySelector("#speechRate-out").textContent = Number(t.value).toFixed(2);
    if (t.id === "pitch") root.querySelector("#pitch-out").textContent = Number(t.value).toFixed(2);
    if (t.id === "gestureConfidence") root.querySelector("#gestureConfidence-out").textContent = t.value;
    if (t.id === "reduceMotion") applyMotion(t.checked);
    status.textContent = "Unsaved changes";
  };
  form.addEventListener("input", onInput);

  const onSubmit = (e) => {
    e.preventDefault();
    const values = readForm();
    const errors = validateSettings(values);
    showErrors(errors);
    if (Object.keys(errors).length) {
      status.textContent = "Fix the highlighted fields to save.";
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    const btn = root.querySelector("#save-settings");
    btn.disabled = true;
    status.textContent = "Saving...";
    setTimeout(() => {
      const result = saveSettings(values);
      btn.disabled = false;
      if (result.ok) {
        status.textContent = "Saved in this browser.";
        toast("Preferences saved in this browser");
      } else {
        status.textContent = "Not saved.";
        toast(result.error, { error: true });
      }
    }, 250);
  };
  form.addEventListener("submit", onSubmit);

  const onReset = () => {
    Object.entries(DEFAULTS).forEach(([k, v]) => {
      const el = form.querySelector(`#${k}`);
      if (!el) return;
      if (el.type === "checkbox") el.checked = v;
      else el.value = v;
    });
    root.querySelector("#speechRate-out").textContent = DEFAULTS.speechRate.toFixed(2);
    root.querySelector("#pitch-out").textContent = DEFAULTS.pitch.toFixed(2);
    root.querySelector("#gestureConfidence-out").textContent = DEFAULTS.gestureConfidence;
    applyMotion(DEFAULTS.reduceMotion);
    showErrors({});
    status.textContent = "Defaults restored. Save to keep them.";
  };
  root.querySelector("#reset-settings").addEventListener("click", onReset);

  return () => {
    form.removeEventListener("input", onInput);
    form.removeEventListener("submit", onSubmit);
    wrap.innerHTML = "";
  };
}
