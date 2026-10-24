# J.A.R.V.I.S. platform support status

Updated 2026-10-18. This file separates built artifacts from source preparation and platform limitations.

## Shared application and server

- The existing Next.js, React, TypeScript and Three.js interface remains the shared client. The Blender GLB stays at `public/models/jarvis_hologram.glb`.
- AI and chat routes run on a secured Node.js server. Provider credentials stay server-side. Production APIs require `JARVIS_ACCESS_PASSWORD` and `JARVIS_AUTH_SECRET`.
- SQLite is retained with its existing schema. Point `JARVIS_DATA_DIR` at persistent storage when deploying.
- No HTTPS origin, domain, DNS account, or cloud-host credentials were supplied. The Android apps therefore open their secure server setup screen until an HTTPS server is deployed.
- The Windows deployment files bind Next.js to loopback and put HTTPS in front of it with Caddy. These deployment steps have not been run against a public domain.

## Native targets

| Target | Project/artifact | Verified status | Current limitation |
|---|---|---|---|
| Android phone/tablet | `android/`; `com.jayanthan.jarvisai` | Debug APK built with Gradle; APK signature and package metadata verified | No physical phone or emulator was connected. Requires a deployed HTTPS server to reach AI and chat routes. |
| Wear OS | `android/wear/`; `com.jayanthan.jarvisai.wear` | Separate watch APK built and signature verified; compact status and short-chat UI uses the shared app | No Wear OS watch or emulator was available. Configure the HTTPS origin on the watch. |
| iPhone/iPad | Shared Tauri source can generate the iOS target from the same setup shell | Mobile entry point and Mac/Xcode generation/signing steps documented | Tauri's iOS initialization command is macOS-only. This Windows host cannot generate the Xcode project or sign/build an iOS package; no iOS artifact exists. |
| Windows desktop | `desktop/jarvis-desktop/` Tauri 2 source project; setup-screen TypeScript/Vite build verified | Native HTTPS server setup screen and menu action are implemented; JARVIS AI branding/icons use the existing project icon | No native installer built: Rust/Cargo and the Visual Studio C++ workload are absent. Requires the deployed HTTPS backend. |
| macOS desktop | Same Tauri source project | Shared desktop shell is prepared | No macOS build host or Xcode; no `.app`/DMG or signing performed. |
| Linux desktop | Same Tauri source project | Shared desktop shell is prepared | No Linux build host; Linux WebKitGTK dependencies and distro package builds remain unverified. |
| ChromeOS | Android APK where Play/Android runtime support permits; browser otherwise | No ChromeOS device tested | Device policy and Android runtime availability vary by Chromebook. |
| watchOS | No native project | Limitations documented | Requires macOS and Xcode; no watchOS package is claimed. |

The PWA/service worker is an optional browser access path, not a replacement for the Android packages.

## Optional Unreal experience

An isolated Unreal Engine 5.8 editor project now exists at `Unreal/JARVIS_Experience/`. It preserves the existing `MyProject 5.8` project and the source GLB. The JARVIS map has been saved and reloaded successfully with 18 persistent GLB node meshes, one camera, and two point lights (22 actors total); Unreal's map check reported zero errors and warnings. See `Unreal/JARVIS_Experience/README.md` for the reproducible build and verification steps. This is an editor scene only; no packaged runtime, streaming service, or FPS benchmark has been produced.

## Android outputs

The reproducible build command is:

```powershell
Set-Location "D:\Jayanthan\Documents\JARVIS_AI\android"
.\build-debug.ps1
```

The script builds both packages and checks that each output exists. For this run, the phone APK was 31,328 bytes and the Wear OS APK was 32,122 bytes. Both passed `apksigner verify`; each uses the standard Android debug signing key. The phone package targets Android API 36 with minimum API 26. The watch package targets API 36 with minimum API 30.

The project supports release signing for the phone app when these environment variables are set in the build shell: `JARVIS_ANDROID_KEYSTORE`, `JARVIS_ANDROID_KEYSTORE_PASSWORD`, `JARVIS_ANDROID_KEY_ALIAS`, and `JARVIS_ANDROID_KEY_PASSWORD`. Then run `.\gradlew.bat assembleRelease` or `.\gradlew.bat bundleRelease`. No private release key has been created or stored.

## Performance and rendering

- Auto, Low, Balanced and High quality modes are available in Settings. The development diagnostics can be opened with `P` and show measured FPS/frame time, draw calls, triangles, geometry, materials, textures, shaders, detected refresh rate and current quality mode.
- The reported frame rate is sampled from the render loop. The target shown in Settings is limited by the detected display refresh rate; it is not presented as a measured frame rate.
- Reduced-motion, hidden-tab, device-class, battery and subtle-background handling are implemented. Wear OS uses the compact screen before starting the 3D scene.
- No valid before/after hardware FPS comparison is recorded yet. A real phone, watch and controlled repeatable scene run are still needed; the synthetic timing unit test is not an FPS benchmark.

## Unreal Engine MCP

The installed Unreal Engine 5.8.3 MCP endpoint is `http://127.0.0.1:8000/mcp`, bound to loopback. The existing project editor is running with `-ModelContextProtocolStartServer`; a direct local client completed `initialize` (HTTP 200), `tools/list`, and the harmless read-only `list_toolsets` call. The refusal shown earlier happened while the editor was stopped. Keep the editor running for MCP clients. The Antigravity application's own UI connection has not been verified. The installed plugin exposes project context/skill tools, not scene authoring. The separately built JARVIS scene is documented above.
