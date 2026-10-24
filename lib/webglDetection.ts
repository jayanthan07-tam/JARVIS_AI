/**
 * WebGL Feature Detection and Device Capability Analysis for J.A.R.V.I.S.
 *
 * Provides progressive enhancement checks to guarantee that the application
 * runs smoothly on any device — from smartwatches to 120Hz ultrawide gaming rigs.
 */

export type DeviceCategory = "wearable" | "mobile" | "tablet" | "desktop" | "ultrawide";

export interface BrowserCapabilities {
  webgl: boolean;
  webgl2: boolean;
  serviceWorker: boolean;
  speechRecognition: boolean;
  speechSynthesis: boolean;
  camera: boolean;
  battery: boolean;
  touch: boolean;
  standalonePwa: boolean;
  reducedMotion: boolean;
}

/**
 * Safely tests WebGL support without crashing or leaking contexts.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/**
 * Safely tests WebGL2 support.
 */
export function isWebGL2Available(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGL2RenderingContext && canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

/**
 * Identifies the current device category based on viewport width and aspect ratio.
 */
export function getDeviceCategory(): DeviceCategory {
  if (typeof window === "undefined") return "desktop";

  const w = window.innerWidth;
  const h = window.innerHeight;

  // Smartwatches / wearable displays (typically 200px - 320px)
  if (w <= 320 && h <= 360) {
    return "wearable";
  }

  // Mobile phones
  if (w <= 640) {
    return "mobile";
  }

  // Tablets & split screens
  if (w <= 1024) {
    return "tablet";
  }

  // Ultrawide displays (21:9 or width >= 2560)
  const aspect = w / Math.max(h, 1);
  if (w >= 2560 || aspect >= 2.1) {
    return "ultrawide";
  }

  return "desktop";
}

/**
 * Detects client OS/platform for tailored instructions & diagnostics.
 */
export function getPlatformName(): string {
  if (typeof navigator === "undefined") return "Server / Node.js";

  const ua = navigator.userAgent || "";
  const platform = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || "";

  // Smartwatch / Wear OS detection
  if (/Wear OS|SmartWatch|WatchOS/i.test(ua) || (window.innerWidth <= 320 && "ontouchstart" in window)) {
    return "Wearable OS";
  }

  // Mobile platforms
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return /iPad/i.test(ua) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ? "iPadOS" : "iOS";
  }
  if (/Android/i.test(ua)) {
    return "Android";
  }
  if (/CrOS/i.test(ua)) {
    return "ChromeOS";
  }

  // Desktop platforms
  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    return "Windows";
  }
  if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) {
    return "macOS";
  }
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) {
    return "Linux";
  }

  return "Universal Web Client";
}

/**
 * Checks client accessibility preference for reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Evaluates full client browser capability matrix.
 */
export function getBrowserCapabilities(): BrowserCapabilities {
  if (typeof window === "undefined") {
    return {
      webgl: false,
      webgl2: false,
      serviceWorker: false,
      speechRecognition: false,
      speechSynthesis: false,
      camera: false,
      battery: false,
      touch: false,
      standalonePwa: false,
      reducedMotion: false,
    };
  }

  const nav = navigator as unknown as {
    getBattery?: () => Promise<unknown>;
    mediaDevices?: { getUserMedia?: unknown };
    standalone?: boolean;
  };

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true ||
    document.referrer.includes("android-app://");

  const hasSpeechRec =
    "SpeechRecognition" in window ||
    "webkitSpeechRecognition" in window;

  const hasSpeechSynth = "speechSynthesis" in window;

  const hasCamera = Boolean(nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === "function");

  const hasBattery = typeof nav.getBattery === "function";

  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  return {
    webgl: isWebGLAvailable(),
    webgl2: isWebGL2Available(),
    serviceWorker: "serviceWorker" in navigator,
    speechRecognition: hasSpeechRec,
    speechSynthesis: hasSpeechSynth,
    camera: hasCamera,
    battery: hasBattery,
    touch: hasTouch,
    standalonePwa: isStandalone,
    reducedMotion: prefersReducedMotion(),
  };
}
