"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function ServiceWorkerRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showUniversalModal, setShowUniversalModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState<string>("Desktop");

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes("android-app://");

    setIsStandalone(isStandaloneMode);

    // 2. Identify platform
    const ua = navigator.userAgent || "";
    const isIos = /iPhone|iPad|iPod/.test(ua) && !("MSStream" in window);
    const isAndroid = /Android/.test(ua);
    const isMac = /Macintosh|Mac OS/.test(ua);
    const isWindows = /Windows/.test(ua);

    if (isIos) setPlatform("iOS");
    else if (isAndroid) setPlatform("Android");
    else if (isMac) setPlatform("macOS");
    else if (isWindows) setPlatform("Windows");

    // 3. Register Service Worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[JARVIS PWA] Service Worker registered:", reg.scope);
          })
          .catch((err) => {
            console.warn("[JARVIS PWA] Service Worker registration failed:", err);
          });
      });
    }

    // 4. Capture beforeinstallprompt for Android Chrome, Edge, ChromeOS
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // 5. iOS Safari specific prompt check
    if (isIos && !isStandaloneMode) {
      const dismissed = sessionStorage.getItem("jarvis_ios_pwa_dismissed");
      if (!dismissed) {
        setShowIosGuide(true);
      }
    }

    // 6. Listen for successful installation
    window.addEventListener("appinstalled", () => {
      setShowInstallBanner(false);
      setShowIosGuide(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
      console.log("[JARVIS PWA] J.A.R.V.I.S. installed successfully on home screen.");
    });

    // 7. Listen for explicit manual requests from Navigation / Settings
    const handleManualRequest = () => {
      if (deferredPrompt) {
        void deferredPrompt.prompt();
      } else {
        setShowUniversalModal(true);
      }
    };

    window.addEventListener("jarvis:open-pwa-guide", handleManualRequest);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("jarvis:open-pwa-guide", handleManualRequest);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      setShowUniversalModal(true);
    }
  };

  const dismissIos = () => {
    setShowIosGuide(false);
    sessionStorage.setItem("jarvis_ios_pwa_dismissed", "true");
  };

  return (
    <>
      {/* Android / Desktop Chrome Install Banner */}
      {showInstallBanner && !isStandalone && (
        <aside className="pwa-install-banner" role="banner" aria-label="Install J.A.R.V.I.S. App">
          <div className="pwa-banner-content">
            <span className="pwa-banner-icon">📱</span>
            <div className="pwa-banner-text">
              <span className="pwa-banner-title">INSTALL J.A.R.V.I.S. HUD</span>
              <span className="pwa-banner-sub">
                Standalone full-screen application for {platform}
              </span>
            </div>
          </div>
          <div className="pwa-banner-actions">
            <button
              type="button"
              className="pwa-install-btn"
              onClick={handleInstallClick}
            >
              INSTALL APP
            </button>
            <button
              type="button"
              className="pwa-dismiss-btn"
              onClick={() => setShowInstallBanner(false)}
              aria-label="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </aside>
      )}

      {/* iOS Safari Home Screen Banner */}
      {showIosGuide && !isStandalone && (
        <aside className="pwa-install-banner ios-banner" role="banner" aria-label="Add to iOS Home Screen">
          <div className="pwa-banner-content">
            <span className="pwa-banner-icon">⎋</span>
            <div className="pwa-banner-text">
              <span className="pwa-banner-title">ADD J.A.R.V.I.S. TO HOME SCREEN</span>
              <span className="pwa-banner-sub">
                Tap Safari Share button [⎋], then select <strong>&quot;Add to Home Screen&quot;</strong> [+]
              </span>
            </div>
          </div>
          <div className="pwa-banner-actions">
            <button
              type="button"
              className="pwa-dismiss-btn"
              onClick={dismissIos}
              aria-label="Dismiss banner"
            >
              GOT IT ✕
            </button>
          </div>
        </aside>
      )}

      {/* Optional browser installation guide */}
      {showUniversalModal && (
        <div className="hud-modal-overlay" role="dialog" aria-modal="true">
          <div className="hud-modal-box pwa-guide-modal">
            <div className="modal-title">BROWSER ACCESS OPTIONS</div>
            <div className="modal-body">
              <p className="pwa-guide-intro">
                Browser installation is an optional access method where supported. Native packages are separate and have different platform requirements:
              </p>
              <div className="pwa-steps-list">
                <div className="pwa-step-item">
                  <span className="step-badge">ANDROID</span>
                  <span className="step-text">Use the separate Android APK for the native app, or install this website from the Chrome menu.</span>
                </div>
                <div className="pwa-step-item">
                  <span className="step-badge">iOS / iPadOS</span>
                  <span className="step-text">In Safari, tap Share [⎋] &gt; &quot;Add to Home Screen&quot; [+]. A native iOS app is not available yet and requires macOS/Xcode to build.</span>
                </div>
                <div className="pwa-step-item">
                  <span className="step-badge">WINDOWS / MAC</span>
                  <span className="step-text">Open J.A.R.V.I.S. in a supported browser. Native desktop installers are not built yet.</span>
                </div>
                <div className="pwa-step-item">
                  <span className="step-badge">CHROMEOS</span>
                  <span className="step-text">Use the Android app when Android apps are supported, or open the browser version.</span>
                </div>
                <div className="pwa-step-item">
                  <span className="step-badge">SMARTWATCH</span>
                  <span className="step-text">The web interface includes a compact view. A native Wear OS or watchOS companion is not available yet.</span>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="hud-btn active"
                onClick={() => setShowUniversalModal(false)}
              >
                CLOSE GUIDE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
