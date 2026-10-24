# J.A.R.V.I.S. AI desktop shell

This is the native Tauri 2 shell for Windows, macOS, and Linux. It uses the existing J.A.R.V.I.S. Next.js application on a secured HTTPS server; it does not bundle a second copy of the AI backend or provider keys. The setup screen stores only the HTTPS origin in the native webview's local storage, then opens the existing app. Choose **Change server address…** from the app menu (or press `Ctrl+Shift+S` / `Cmd+Shift+S`) to change it later.

## Run the frontend check

From this folder:

```powershell
npm install
npm run build
```

`npm run build` checks the TypeScript and builds the setup screen assets. This check does not compile the Rust native application.

## Build the native desktop app

Install the OS-specific Tauri prerequisites, then run:

```powershell
npm run tauri dev
npm run tauri build
```

Tauri builds for the operating system on which the command runs. It does not produce Windows, macOS, and Linux installers from one host.

- **Windows:** Rust stable, Visual Studio 2022 with the Desktop development with C++ workload, Windows SDK, and WebView2 Runtime. Installers are created under `src-tauri/target/release/bundle/`.
- **macOS:** Rust stable and Xcode. iOS signing and App Store distribution also require macOS, Xcode, and the relevant Apple signing profile.
- **Linux:** Rust stable and the distribution's Tauri dependencies, including WebKitGTK 4.1 development files. Test and package on each intended distribution family.

### iOS and iPadOS target

This Tauri source includes a mobile entry point and can generate an iOS project from the same HTTPS setup shell. Run the following on a Mac with Xcode installed:

```sh
cd desktop/jarvis-desktop
npm install
npm run tauri ios init
npm run tauri ios build
```

Then open the generated Xcode project, select the correct signing team and bundle identifier, and create an Apple Development or Distribution signing profile before installing or publishing. Tauri's iOS commands run only on macOS, so the native Xcode project has not been generated from this Windows host. No signed iOS build is claimed.

No Tauri installer has been built in this Windows environment: Rust and the Visual Studio C++ workload are not installed. No macOS/Xcode or Linux build host is available here. The shared source project is present, but those platform packages are not claimed as built. See the platform support report for the available build tools.

## Connect to the J.A.R.V.I.S. server

The first launch asks for the HTTPS origin, for example `https://jarvis.example.com`. It rejects non-HTTPS URLs, credentials in the URL, and paths, queries, or fragments. Sign in on the server page with the J.A.R.V.I.S. owner password. Keep Gemini, Tavily, and other provider credentials on the server; do not enter them in this desktop app.

The project owner currently has no deployed HTTPS address, so the shell will remain at setup until the backend has been deployed using `docs/BACKEND_DEPLOYMENT.md`. A laptop-hosted server must remain running and securely reachable. Do not expose Ollama port 11434 to the internet.

The local setup screen has a restrictive content security policy and no privileged native commands are exposed to the remote page. The native menu returns to that setup screen without granting the website extra access to the computer.
