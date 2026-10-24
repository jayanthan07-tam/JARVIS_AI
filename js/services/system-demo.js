// DEMO system control. Commands are a fixed catalogue of labels. Running one
// only writes a simulated log entry. Nothing is sent to the OS or a shell, and
// there is no free-text command input anywhere in the app.
import { logEvent } from "./event-log.js";
import { sleep } from "../utils.js";

export const COMMANDS = [
  { id: "diagnostic", group: "Diagnostics", label: "Run diagnostic sweep", desc: "Simulated sweep of demo subsystems", risk: "low" },
  { id: "power", group: "Diagnostics", label: "Report subsystem power", desc: "Shows demo power figures only", risk: "low" },
  { id: "cooling", group: "Thermal", label: "Spool auxiliary cooling", desc: "Simulated cooling request", risk: "low" },
  { id: "mute-cv", group: "Gesture", label: "Mute CV tracking", desc: "Simulated; the camera is not used", risk: "low" },
  { id: "lockdown", group: "Security", label: "Engage perimeter lockdown", desc: "Simulated; requires confirmation", risk: "high" },
];

const busy = new Set();
const subscribers = new Set();

export function isBusy(id) {
  return busy.has(id);
}

export function subscribeSystem(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function emit() {
  subscribers.forEach((fn) => fn({ busy: Array.from(busy) }));
}

export async function runCommand(id) {
  const cmd = COMMANDS.find((c) => c.id === id);
  if (!cmd || busy.has(id)) return false;
  busy.add(id);
  emit();
  logEvent("SYS", `Requested: ${cmd.label}`);
  try {
    await sleep(700);
    logEvent("SYS", `[SIM] ${cmd.label}: completed in demo mode. No system change was made.`, cmd.risk === "high" ? "warn" : undefined);
  } finally {
    busy.delete(id);
    emit();
  }
  return true;
}
