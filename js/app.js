import { onRouteChange } from "./router.js";
import { renderShell, setActiveRoute } from "./components/shell.js";
import { startTelemetry } from "./services/telemetry.js";
import { toast } from "./utils.js";
import * as home from "./views/home.js";
import * as voice from "./views/voice.js";
import * as gestures from "./views/gestures.js";
import * as chat from "./views/chat.js";
import * as system from "./views/system.js";
import * as settings from "./views/settings.js";

const VIEWS = { home, voice, gestures, chat, system, settings };
const main = document.getElementById("main");
let cleanup = null;

function showRoute(id) {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  const view = VIEWS[id] ?? VIEWS.home;
  try {
    main.innerHTML = view.render();
    cleanup = view.mount(main) ?? null;
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="alert" role="alert">This screen failed to load: ${err.message}</div>`;
    toast("Screen failed to load", { error: true });
  }
  setActiveRoute(id);
  document.title = `${view.title ?? "Home"} // J.A.R.V.I.S. HUD`;
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

renderShell();
startTelemetry();
onRouteChange(showRoute);

// Surface unexpected runtime errors instead of failing silently.
window.addEventListener("error", (e) => {
  console.error(e.error || e.message);
  toast("Unexpected error. See the browser console.", { error: true });
});
