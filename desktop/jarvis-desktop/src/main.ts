const STORAGE_KEY = "jarvis.desktop.serverOrigin";
const form = document.querySelector<HTMLFormElement>("#connection-form");
const input = document.querySelector<HTMLInputElement>("#server-origin");
const statusEl = document.querySelector<HTMLElement>("#status");
const button = document.querySelector<HTMLButtonElement>("#connect-button");

function setStatus(message: string, state: "info" | "error" = "info"): void {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.state = state;
}

function parseServerOrigin(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Enter a complete address such as https://jarvis.example.com.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Use an HTTPS address. The desktop app blocks insecure HTTP servers.");
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new Error("Enter the server address only. Do not include a username or password.");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("Enter the server origin only, without a page path, query, or fragment.");
  }

  return parsed.origin;
}

function openSavedOrigin(): void {
  if (new URLSearchParams(window.location.search).get("setup") === "1") {
    try {
      if (input) input.value = window.localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      // Keep the setup screen available; submission will report the storage failure.
    }
    setStatus("Enter or update the HTTPS address of your J.A.R.V.I.S. server.");
    return;
  }

  let saved: string | null;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    setStatus("This app cannot save the server address in its local settings.", "error");
    return;
  }
  if (!saved) return;

  try {
    const origin = parseServerOrigin(saved);
    setStatus("Opening your J.A.R.V.I.S. server…");
    window.location.replace(origin);
  } catch {
    setStatus("The saved server address is invalid. Enter the HTTPS server origin again.", "error");
  }
}

form?.addEventListener("submit", (event: SubmitEvent) => {
  event.preventDefault();
  if (!input || !button) return;

  let origin: string;
  try {
    origin = parseServerOrigin(input.value);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Check the HTTPS server address.", "error");
    input.focus();
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, origin);
  } catch {
    setStatus("The server address could not be saved. Check this app's local storage settings.", "error");
    return;
  }

  button.disabled = true;
  setStatus("Opening the server. Sign in with your J.A.R.V.I.S. owner password there.");
  window.location.assign(origin);
});

openSavedOrigin();

export {};
