import { esc, localStamp, toast } from "../utils.js";
import { icon } from "../components/icons.js";
import { panel, demoBadge, alert } from "../components/widgets.js";
import { CHAT_MAX_CHARS } from "../config.js";
import {
  getChat, subscribeChat, sendMessage, clearChat, setSimulateFailure, takePendingDraft,
} from "../services/chat-demo.js";

export const title = "AI Chat";

const FAST_VECTORS = [
  "Run diagnostic sweep",
  "Open gesture calibration",
  "Report subsystem power",
  "Engage security lockdown",
];

function messageHtml(m, index) {
  const time = localStamp(new Date(m.time));
  if (m.role === "user") {
    return `<div class="msg msg--user"><div class="msg-meta">Stark // ${esc(time)}</div><div class="msg-body">${esc(m.text)}</div></div>`;
  }
  if (m.role === "assistant") {
    return `<div class="msg msg--assistant"><div class="msg-meta">J.A.R.V.I.S. // ${esc(time)} // demo reply</div><div class="msg-body">${esc(m.text)}</div></div>`;
  }
  return `<div class="msg msg--error" role="alert"><div class="msg-meta">Transmission failed // ${esc(time)}</div><div class="msg-body">${esc(m.text)}</div><div class="msg-actions"><button class="btn btn--ghost btn--small" data-retry="${index}">${icon("refresh")} Retry</button></div></div>`;
}

function logHtml(chat) {
  if (!chat.messages.length && !chat.busy) {
    return `<div class="empty">No transmissions yet. Type a directive below, or pick a fast vector. Replies are canned demo text until an AI provider is connected.</div>`;
  }
  const items = chat.messages.map(messageHtml).join("");
  const typing = chat.busy ? `<div class="typing" role="status" aria-label="J.A.R.V.I.S. is composing a reply"><span></span><span></span><span></span></div>` : "";
  return items + typing;
}

export function render() {
  const chat = getChat();
  return `
    <div class="screen screen-chat">
      <section class="panel chat-panel" aria-labelledby="chat-title">
        <span class="corners" aria-hidden="true"></span>
        <header class="chat-head">
          <h2 id="chat-title" class="panel-title">Thread matrix // session</h2>
          <div class="row-gap">
            ${demoBadge("No AI provider")}
            <label class="toggle"><input type="checkbox" id="sim-fail" ${chat.simulateFailure ? "checked" : ""} /> Simulate failure</label>
            <button type="button" class="btn btn--ghost btn--small" id="clear-chat" ${chat.busy ? "disabled" : ""}>New session</button>
          </div>
        </header>
        <div class="chat-log" id="chat-log" role="log" aria-live="polite" aria-relevant="additions" tabindex="0" aria-label="Conversation">${logHtml(chat)}</div>
        <form id="chat-form" class="chat-compose" novalidate>
          <label for="chat-input" class="sr-only">Directive for J.A.R.V.I.S.</label>
          <div class="compose-row">
            <textarea id="chat-input" class="textarea" rows="2" maxlength="${CHAT_MAX_CHARS}" placeholder="Enter a directive. Shift+Enter for a new line." aria-describedby="chat-error chat-count"></textarea>
            <button type="submit" class="btn" id="chat-send" ${chat.busy ? "disabled" : ""}>${icon("send")} <span>Send directive</span></button>
          </div>
          <div class="compose-meta">
            <span id="chat-error" class="field-error" role="alert" hidden>Enter a directive first.</span>
            <span id="chat-count">0 / ${CHAT_MAX_CHARS}</span>
          </div>
        </form>
      </section>

      <aside class="chat-side">
        ${panel({
          title: "Fast vectors",
          body: `<div class="fast-vectors">${FAST_VECTORS.map((v) => `<button type="button" class="pill vector" data-text="${esc(v)}">${icon("pulse")} ${esc(v)}</button>`).join("")}</div>`,
        })}
        ${panel({
          title: "Assistant status",
          body: `
            <div class="setting-list">
              <div class="setting-row"><span>Backend</span><span class="badge badge--off">Offline</span></div>
              <div class="setting-row"><span>AI provider</span><span class="badge badge--off">Not configured</span></div>
              <div class="setting-row"><span>Reply source</span><span>Canned demo text</span></div>
              <div class="setting-row"><span>Streaming</span><span>Not available</span></div>
            </div>
            ${alert("Nothing you type leaves this browser. Replies are placeholders.", { tone: "info" })}`,
        })}
      </aside>
    </div>`;
}

export function mount(root) {
  const form = root.querySelector("#chat-form");
  const input = root.querySelector("#chat-input");
  const count = root.querySelector("#chat-count");
  const err = root.querySelector("#chat-error");
  const log = root.querySelector("#chat-log");
  const send = root.querySelector("#chat-send");

  const scrollToEnd = () => { log.scrollTop = log.scrollHeight; };

  const paintLog = (chat) => {
    log.innerHTML = logHtml(chat);
    send.disabled = chat.busy;
    root.querySelector("#clear-chat").disabled = chat.busy;
    scrollToEnd();
  };

  const submit = async (text) => {
    const clean = text.trim();
    if (!clean) {
      err.textContent = "Enter a directive first.";
      err.hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    if (getChat().busy) {
      // Keep the text in the box so it is not lost while a reply is pending.
      err.textContent = "Wait for the current reply to finish, then send again.";
      err.hidden = false;
      return;
    }
    err.hidden = true;
    input.removeAttribute("aria-invalid");
    input.value = "";
    count.textContent = `0 / ${CHAT_MAX_CHARS}`;
    await sendMessage(clean);
    input.focus();
  };

  const onSubmit = (e) => {
    e.preventDefault();
    submit(input.value);
  };
  form.addEventListener("submit", onSubmit);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  input.addEventListener("input", () => {
    count.textContent = `${input.value.length} / ${CHAT_MAX_CHARS}`;
    if (input.value.trim()) {
      err.hidden = true;
      input.removeAttribute("aria-invalid");
    }
  });

  const onClick = (e) => {
    const vector = e.target.closest(".vector");
    if (vector) {
      input.value = vector.dataset.text;
      count.textContent = `${input.value.length} / ${CHAT_MAX_CHARS}`;
      input.focus();
      return;
    }
    const retry = e.target.closest("[data-retry]");
    if (retry) {
      const msg = getChat().messages[Number(retry.dataset.retry)];
      if (msg?.retryText) sendMessage(msg.retryText);
      return;
    }
    if (e.target.closest("#clear-chat")) {
      clearChat();
      toast("Session cleared");
    }
  };
  root.addEventListener("click", onClick);

  const failToggle = root.querySelector("#sim-fail");
  const onFail = () => setSimulateFailure(failToggle.checked);
  failToggle.addEventListener("change", onFail);

  const unsub = subscribeChat(paintLog);

  // A message typed on Home is transmitted here automatically.
  const draft = takePendingDraft();
  if (draft) sendMessage(draft);
  scrollToEnd();
  input.focus();

  return () => {
    form.removeEventListener("submit", onSubmit);
    root.removeEventListener("click", onClick);
    failToggle.removeEventListener("change", onFail);
    unsub();
  };
}
