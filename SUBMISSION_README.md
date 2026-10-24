# J.A.R.V.I.S. AI — Submission README

## Project overview

J.A.R.V.I.S. AI is a local-first holographic assistant interface. A Three.js orb
sits inside a blue/cyan HUD. You can talk to it by text or voice, and you can
control the orb with hand gestures tracked through your webcam.

Answers use local Ollama (`llama3.2:3b`) first, with optional server-side cloud
AI fallback when configured. Factual questions are routed to web search and answered only from retrieved sources. Date and time
are calculated server-side in the `Asia/Kolkata` timezone. Allowlisted Windows
actions and a read-only hardware query are available on a local Windows PC.

## Technology stack

- Next.js 16 (App Router), React 19, TypeScript
- Three.js (orb scene), MediaPipe Tasks Vision (hand tracking)
- Ollama, model `llama3.2:3b`, served on `http://127.0.0.1:11434`; optional Gemini and other OpenAI-compatible cloud providers
- SQLite via Node's built-in `node:sqlite` (`data/jarvis.db`)
- Web search: Tavily (API key or CLI/OAuth), with optional Serper/Brave keys and a DuckDuckGo fallback
- Native Android phone and Wear OS Gradle projects in `android/`; APKs load the shared Next.js interface from a secured HTTPS server
- Tauri 2 desktop shell source in `desktop/jarvis-desktop/` for Windows, macOS, and Linux; the shell stores only a secured HTTPS server origin
- Optional Unreal Engine 5.8 editor scene at `Unreal/JARVIS_Experience/`, separate from the standard Three.js renderer

## Setup and run

Requirements: Node.js 22.13 or newer (for `node:sqlite`), npm, and Ollama.

```bash
ollama pull llama3.2:3b
ollama serve                 # if not already running as a service

npm install
npm run build
npm start                    # http://localhost:3000
```

Development mode: `npm run dev`, then open http://localhost:3000.

Type check: `npx tsc --noEmit`

## Environment variables

All AI/search provider variables are optional. Production API requests require an owner password and signing secret; development mode can run without them. Copy `.env.example` for a deployment and set secrets only on the server.

| Variable | Purpose |
| --- | --- |
| `OLLAMA_HOST` | Ollama endpoint. Defaults to `http://127.0.0.1:11434`. |
| `TAVILY_API_KEY` | Enables Tavily web search (key starts with `tvly-`). |
| `SERPER_API_KEY` | Secondary search provider, used if Tavily returns nothing. |
| `BRAVE_API_KEY` | Secondary search provider, used if the above return nothing. |
| `GEMINI_API_KEY` | Optional server-side Google Gemini fallback. |
| `JARVIS_ACCESS_PASSWORD` | Required in production; owner sign-in password (16 or more characters). |
| `JARVIS_AUTH_SECRET` | Required in production; private signing secret (32 or more characters). |
| `JARVIS_DATA_DIR` | Optional path for persistent SQLite storage. |

Keep keys in `.env.local`, which is git-ignored. Do not commit secrets.
Never place API credentials in browser code, Android resources, or source control. Android/iOS clients need a reachable HTTPS deployment; local Ollama remains on the server machine.

## Demonstration steps

1. Start Ollama and the app. The status indicator should show the local model as connected.
2. Text chat: ask a general question. The reply streams from the local model.
3. Date/time: ask "what day is tomorrow?". The answer is calculated, not generated.
4. Factual question: ask about a real institution or place. If search is configured,
   the answer cites its sources. If it is not, the app says web search is unavailable.
5. Windows actions (Windows PC only): "open notepad", "open calculator", "open settings".
   Off Windows, the app refuses and says why.
6. Hardware specs (Windows PC only): "what is my laptop model?" If the query fails,
   the app says so rather than guessing.
7. Hand gestures: press `G` or click GESTURES, allow camera access, then pinch to spin the orb.
8. Voice: use the voice screen. It sends the same requests as text chat.

## Known limitations

- Live Gemini/cloud AI was not exercised in the recorded tests; configure its credentials server-side before relying on it.
- Desktop actions report success once the launch process is spawned. They do not
  verify that a window appeared.
- Hardware and desktop-action features run only on a local Windows PC. Elsewhere
  they are refused by design.
- The DuckDuckGo fallback reads an undocumented HTML endpoint and may break.
- Tavily OAuth and CLI paths read `~/.tavily/config.json`. Only `TAVILY_API_KEY`
  is the documented integration path.
- `run_diagnostic` on the System screen is simulated and labelled as such.
- Time zones other than `Asia/Kolkata` are handled by web search, not local calculation.
- Render FPS is measured in the development diagnostics, while target FPS is limited by detected display refresh. No repeatable before/after hardware comparison is recorded yet.
- The Android phone and Wear OS debug APKs build and pass signature verification, but no physical phone, emulator or watch was attached. Both require a deployed HTTPS server for AI and chat.
- No iOS or watchOS native project/build is present. iOS/watchOS builds and signing require macOS/Xcode.
- The Windows/macOS/Linux Tauri source shell is present and its TypeScript/Vite assets build, but no native installer is produced here: Rust/Cargo and Visual Studio C++ are missing, and there is no macOS or Linux build host.
- The Unreal editor scene is built and reload-verified, but it is not a packaged Unreal runtime. Antigravity's own client UI was not available for a UI-level connection check, though direct MCP initialization and a read-only tool call passed.
- The original upstream README (Ultron Orb UI) is inherited in `README.md`.

## Test results

Checks run in the Windows development environment on 2026-10-18. Node.js, Android Studio, JDK 21, Android SDK Platform 36 and Gradle were available. No Android device or emulator was attached; no live provider credentials or public HTTPS deployment were available.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS; one non-fatal Turbopack file-tracing warning remains for Tavily imports |
| `android/build-debug.ps1` | PASS; phone and Wear OS debug APKs built |
| APK signature verification | PASS for both debug APKs |
| `tests/test_datetime.mjs` | PASS |
| `tests/test_desktop_actions.mjs` | PASS (detection only; no system action launched) |
| `tests/test_factual_intent.mjs` | PASS |
| `tests/test_ddg_parser.mjs` | PASS |
| `tests/test_gestures_engine.ts` | PASS (49/49) |
| `tests/test_performance_pwa.mjs` | PASS (synthetic frame samples only; not a device FPS benchmark) |
| Protected API authentication and production fail-closed checks | PASS in isolated local test server (details in `docs/VERIFICATION.md`) |
| Live Ollama, Gemini, or Tavily provider request | NOT TESTED |
| Physical Android/Wear OS install and startup | NOT TESTED (no attached device/emulator) |
| Antigravity app UI connection | NOT TESTED; direct MCP initialization and read-only `list_toolsets` passed |
| Unreal JARVIS editor scene load | PASS; saved map reloaded with 18 persistent GLB node meshes, one camera, two lights, and zero map-check errors/warnings |
| Tauri desktop setup frontend (`npm ci`, `npm run build`) | PASS; Rust native window/installers not built |
| Repeatable before/after 3D hardware FPS comparison | NOT TESTED |

Other integration tests that require live providers, attached media devices, or
an installed Android device were not run; see `docs/VERIFICATION.md` for the
tested and untested scope.
