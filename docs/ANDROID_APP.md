# J.A.R.V.I.S. Android app

## Current architecture

`android/` is a native Android Studio/Gradle project. It packages a small Android WebView shell that loads the existing J.A.R.V.I.S. Next.js application from a server URL entered on first launch. This keeps the existing interface, Three.js hologram, and server-side API routes in use without putting provider keys in the APK. The separate `android/wear/` module builds a Wear OS companion using the same secure connection shell and compact chat/status view; it bypasses Three.js.

The Next.js project uses request-time route handlers, SQLite, and server-side provider integrations. A static export would not include those runtime API features, so this Android project does not try to turn the web app into a disconnected static copy. The shell accepts HTTPS origins only and rejects localhost. The URL can be changed from the setup screen by pressing Android Back at the J.A.R.V.I.S. home page.

Capacitor was evaluated first. Its external `server.url` setting is documented for live reload, while this app needs the existing Next.js server routes at runtime; Next.js static export does not support those request-time route handlers. This Android deliverable therefore uses a small native WebView shell with an HTTPS origin entered on first run. See the [Capacitor server configuration](https://next.capacitorjs.com/docs/next/config) and [Next.js static export limitations](https://nextjs.org/docs/app/guides/static-exports).

Production API routes now require a server-configured owner password and signing secret, and apply request-size, origin, and process-local rate limits. The APK never contains those credentials. Configure and deploy the backend first using the [backend deployment guide](BACKEND_DEPLOYMENT.md). A phone also cannot reach laptop-hosted Ollama when the laptop is off; keep port 11434 private.

## Build a debug APK

Requirements are JDK 17 or later within the Gradle and Android plugin support range, Android SDK Platform 36, and Android SDK Build-Tools 36.0.0. JDK 21, Gradle 8.13, and Android Gradle Plugin 8.13.2 were used for the verified build. Android Studio can open the `android/` directory; the Gradle wrapper can build it without the IDE.

From PowerShell:

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
Set-Location "D:\Jayanthan\Documents\JARVIS_AI\android"
.\build-debug.ps1
```

The script builds both phone and watch packages. Outputs are `android/app/build/outputs/apk/debug/app-debug.apk` and `android/wear/build/outputs/apk/debug/wear-debug.apk`. The generated Gradle and Android build folders are ignored by Git. To install the phone package over USB after enabling Android developer options and USB debugging, run:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r ".\app\build\outputs\apk\debug\app-debug.apk"
```

To install the Wear OS package, run:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r ".\wear\build\outputs\apk\debug\wear-debug.apk"
```

## Verified debug build

On 2026-10-18, `.\gradlew.bat --no-daemon --console=plain :app:assembleDebug :wear:assembleDebug` completed successfully. The phone APK uses package ID `com.jayanthan.jarvisai`, minimum API 26, and target API 36. The Wear OS APK uses `com.jayanthan.jarvisai.wear`, minimum API 30, and target API 36. Both use the standard Android debug key and passed APK signature verification. Current sizes are 31,328 bytes for the phone APK and 32,122 bytes for Wear OS. The reproducible helper is `android/build-debug.ps1`. Phone SHA-256: `F0DF95C6C4A7F5660C9DB53CE1ECA11AF0697F024A033B883E5C64BC118AC324`. Wear OS SHA-256: `EC6F48C1918E3B74056ED0AB0D0706C65D8348E73B1FB827EBAD0D418FE2E375`.

Installable debug copies were saved as `outputs/jarvis-ai-debug.apk` and `outputs/jarvis-ai-wear-debug.apk` in the Codex deliverables folder. Android Studio is installed at `D:\ANDROID_STUDIO`; the verified packages were built with the Gradle wrapper. No physical Android device, Wear OS device, or configured emulator was connected, so installation and first-launch behavior have not been tested on hardware.

## Release signing

Use a private release keystore and keep it outside the repository. Set these environment variables in the build shell; never commit them or place them in JavaScript, Android resources, or the APK:

- `JARVIS_ANDROID_KEYSTORE`
- `JARVIS_ANDROID_KEYSTORE_PASSWORD`
- `JARVIS_ANDROID_KEY_ALIAS`
- `JARVIS_ANDROID_KEY_PASSWORD`

Then run `.\gradlew.bat assembleRelease` for a signed APK or `.\gradlew.bat bundleRelease` for a signed AAB. The release signing configuration is applied only when all four variables are present. Back up the keystore securely; the same key is required for future updates.

## Permissions and privacy

The app declares camera and microphone permissions, but the Android runtime prompt is requested only when the trusted J.A.R.V.I.S. page asks the WebView for camera or microphone access. The app requests permission for the specific media type and HTTPS origin. Cleartext HTTP, invalid TLS certificates, file access, and untrusted in-app navigation are blocked. External web links open in the system browser.

## Current backend requirement

No HTTPS backend URL is configured in this project. Until one is deployed with the required access password and signing secret, the APK opens the server setup screen and cannot provide chat, AI, history, or system API features. Enter the HTTPS origin after deploying the secured Next.js application, then sign in with the owner password; provider credentials remain on that server.
