import { esc } from "../utils.js";
import { icon } from "../components/icons.js";
import { panel, demoBadge, statusBadge, logList } from "../components/widgets.js";
import { getEvents, subscribeEvents } from "../services/event-log.js";
import { COMMANDS, isBusy, runCommand, subscribeSystem } from "../services/system-demo.js";

export const title = "System Control";

const SUBSYSTEMS = [
  { name: "Core runtime", state: "busy", text: "Demo", detail: "Browser only. No Python process." },
  { name: "Voice pipeline", state: "off", text: "Simulated", detail: "No audio device opened." },
  { name: "Gesture tracker", state: "off", text: "Not connected", detail: "No camera opened." },
  { name: "Backend link", state: "off", text: "Offline", detail: "ws://localhost:8000 not reachable from demo." },
  { name: "Lab telemetry", state: "off", text: "Not connected", detail: "No sensor hub configured." },
];

function commandRow(cmd, pending) {
  const busy = isBusy(cmd.id);
  const high = cmd.risk === "high";
  const confirm = pending === cmd.id
    ? `<div class="confirm-row" role="group" aria-label="Confirm ${esc(cmd.label)}">
         ${icon("alert")}<span>Confirm: this only logs a simulated lockdown. Nothing is locked.</span>
         <button class="btn btn--danger btn--small" data-confirm="${cmd.id}">Confirm (simulated)</button>
         <button class="btn btn--ghost btn--small" data-cancel="${cmd.id}">Cancel</button>
       </div>`
    : "";
  const button = busy
    ? `<button class="btn btn--small" disabled aria-busy="true"><span class="spinner"></span> Running</button>`
    : `<button class="btn ${high ? "btn--danger" : ""} btn--small" data-run="${cmd.id}" ${pending && pending !== cmd.id ? "disabled" : ""}>${high ? "Engage" : "Run"}</button>`;
  return `<div class="command-item"><div>${esc(cmd.label)}<small>${esc(cmd.group)} // ${esc(cmd.desc)}</small></div>${button}${confirm}</div>`;
}

function commandList(pending) {
  return `<div class="command-list" data-slot="commands">${COMMANDS.map((c) => commandRow(c, pending)).join("")}</div>`;
}

export function render() {
  return `
    <div class="screen screen-system">
      <div class="stack">
        ${panel({
          title: "Subsystem status",
          meta: demoBadge("Demo values"),
          body: `
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th scope="col">Subsystem</th><th scope="col">Status</th><th scope="col">Detail</th></tr></thead>
                <tbody>
                  ${SUBSYSTEMS.map((s) => `<tr><td>${esc(s.name)}</td><td>${statusBadge(s.state, s.text)}</td><td>${esc(s.detail)}</td></tr>`).join("")}
                </tbody>
              </table>
            </div>`,
        })}
        ${panel({
          title: "Event log",
          meta: demoBadge("Simulated entries"),
          body: `<div data-slot="log">${logList(getEvents(), 60)}</div>`,
        })}
      </div>

      <div class="stack">
        ${panel({
          title: "Command catalogue",
          meta: demoBadge("No execution"),
          body: `
            <p class="note-box" style="margin-bottom:12px">These are fixed labels. Pressing one writes a simulated entry to the log. Nothing runs on this computer, and there is no free-text command box.</p>
            <div data-slot="cmds">${commandList(null)}</div>`,
        })}
        ${panel({
          title: "Security posture",
          body: `<div class="setting-list">
              <div class="setting-row"><span>Secrets stored in this page</span><span>None</span></div>
              <div class="setting-row"><span>Shell access</span><span>Disabled</span></div>
              <div class="setting-row"><span>Hardware access</span><span>Not requested</span></div>
            </div>`,
        })}
      </div>
    </div>`;
}

export function mount(root) {
  let pending = null;

  const paintCommands = () => {
    root.querySelector('[data-slot="cmds"]').innerHTML = commandList(pending);
  };

  const onClick = (e) => {
    const run = e.target.closest("[data-run]");
    if (run) {
      const cmd = COMMANDS.find((c) => c.id === run.dataset.run);
      if (cmd?.risk === "high") {
        pending = cmd.id;
        paintCommands();
        root.querySelector(`[data-confirm="${cmd.id}"]`)?.focus();
        return;
      }
      runCommand(run.dataset.run);
      return;
    }
    const confirm = e.target.closest("[data-confirm]");
    if (confirm) {
      pending = null;
      runCommand(confirm.dataset.confirm);
      return;
    }
    if (e.target.closest("[data-cancel]")) {
      pending = null;
      paintCommands();
    }
  };
  root.addEventListener("click", onClick);

  const unsubSystem = subscribeSystem(() => paintCommands());
  const unsubEvents = subscribeEvents((events) => {
    root.querySelector('[data-slot="log"]').innerHTML = logList(events, 60);
  });

  return () => {
    root.removeEventListener("click", onClick);
    unsubSystem();
    unsubEvents();
  };
}
