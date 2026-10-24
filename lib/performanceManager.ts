/**
 * Performance Manager for J.A.R.V.I.S. AI
 *
 * Provides:
 * - High-precision FPS and frame-time profiling (instantaneous, 1s rolling average, 1% low).
 * - Adaptive quality presets whose targets respect the display refresh rate.
 * - Stable hysteresis system to prevent quality oscillation/ping-ponging.
 * - Tab visibility detection to suspend rendering when hidden.
 * - Background throttling when 3D orb is behind active UI modals.
 * - Zero React re-renders inside render loops (direct callback / DOM refs).
 */

export type QualityPreset = "high" | "balanced" | "low";
export type PerformanceMode = "auto" | "high" | "balanced" | "low";

export interface QualitySettings {
  preset: QualityPreset;
  pixelRatio: number;
  bloomEnabled: boolean;
  bloomStrength: number;
  bloomRadius: number;
  chromaticAberration: boolean;
  particleCount: number;
  enableShadows: boolean;
  antialiasing: boolean;
  targetFps: number;
}

export interface DetailedPerformanceMetrics {
  fps: number;
  avgFps: number;
  onePercentLowFps: number;
  frameTimeMs: number;
  avgFrameTimeMs: number;
  activePreset: QualityPreset;
  mode: PerformanceMode;
  drawCalls: number;
  triangles: number;
  geometries: number;
  materials: number;
  textures: number;
  shaders: number;
  cpuFrameTimeMs: number;
  postProcessingEnabled: boolean;
  prefersReducedMotion: boolean;
  isThrottled: boolean;
  isHidden: boolean;
  detectedHz: number;
  deviceCategory: string;
  isBatterySaving: boolean;
}

const PRESET_CONFIGS: Record<QualityPreset, Omit<QualitySettings, "preset">> = {
  high: {
    pixelRatio: typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2.0) : 2.0,
    bloomEnabled: true,
    bloomStrength: 0.75,
    bloomRadius: 0.28,
    chromaticAberration: true,
    particleCount: 140,
    enableShadows: true,
    antialiasing: true,
    targetFps: 120,
  },
  balanced: {
    pixelRatio: typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.25) : 1.25,
    bloomEnabled: true,
    bloomStrength: 0.5,
    bloomRadius: 0.2,
    chromaticAberration: false,
    particleCount: 70,
    enableShadows: false,
    antialiasing: true,
    targetFps: 90,
  },
  low: {
    pixelRatio: 1.0,
    bloomEnabled: false, // Bypass multi-pass EffectComposer for massive performance gain
    bloomStrength: 0.0,
    bloomRadius: 0.0,
    chromaticAberration: false,
    particleCount: 30,
    enableShadows: false,
    antialiasing: false,
    targetFps: 60,
  },
};

const STORAGE_KEY = "jarvis_perf_mode_v1";
const DIAGNOSTICS_KEY = "jarvis_perf_diagnostics_v1";
const COMMON_REFRESH_RATES = [30, 40, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 200, 240];

export class PerformanceManager {
  private static instance: PerformanceManager | null = null;

  private mode: PerformanceMode = "auto";
  private currentPreset: QualityPreset = "high";
  private showDiagnostics = false;

  // Frame timing metrics
  private frameTimes: number[] = [];
  private maxFrameSamples = 120;
  private lastFrameTimestamp = 0;
  private lastReportTimestamp = 0;
  private frameCount = 0;

  // Hysteresis tracking
  private lastPresetChangeTimestamp = 0;
  private readonly cooldownPeriodMs = 5000; // Minimum 5s between preset changes
  private consecutiveLowPerfDurationMs = 0;
  private consecutiveHighPerfDurationMs = 0;
  private lastHysteresisCheckTime = 0;

  // Render stats from WebGL
  private lastDrawCalls = 0;
  private lastTriangles = 0;
  private lastGeometries = 0;
  private lastMaterials = 0;
  private lastTextures = 0;
  private lastShaders = 0;
  private lastCpuFrameTimeMs = 0;
  private postProcessingEnabled = false;

  // Visibility & background states
  private isTabHidden = false;
  private isBackgroundThrottled = false;

  // Cross-platform & hardware detection
  private detectedHz = 60;
  private deviceCategory = "Desktop";
  private isBatterySaving = false;
  private prefersReducedMotion = false;
  private hzSamples: number[] = [];
  private lastRefreshSampleTimestamp = 0;

  // Listeners
  private qualityChangeListeners = new Set<(settings: QualitySettings) => void>();
  private metricsListeners = new Set<(metrics: DetailedPerformanceMetrics) => void>();
  private diagnosticsListeners = new Set<(show: boolean) => void>();

  private constructor() {
    if (typeof window !== "undefined") {
      this.loadSettings();

      if (typeof window.matchMedia === "function") {
        const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
        this.prefersReducedMotion = motionPreference.matches;
        const updateMotionPreference = (event: MediaQueryListEvent) => {
          this.prefersReducedMotion = event.matches;
          this.notifyMetrics();
        };
        if (typeof motionPreference.addEventListener === "function") {
          motionPreference.addEventListener("change", updateMotionPreference);
        } else {
          motionPreference.addListener(updateMotionPreference);
        }
      }

      // Classify device category
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w <= 320 && h <= 360) {
        this.deviceCategory = "Wearable";
      } else if (w <= 640) {
        this.deviceCategory = "Mobile";
      } else if (w <= 1024) {
        this.deviceCategory = "Tablet";
      } else if (w >= 2560 || w / Math.max(h, 1) >= 2.1) {
        this.deviceCategory = "Ultrawide";
      } else {
        this.deviceCategory = "Desktop";
      }

      // Listen for tab visibility changes
      document.addEventListener("visibilitychange", () => {
        this.isTabHidden = document.hidden;
        this.notifyMetrics();
      });

      // Battery awareness (where supported by browser)
      const nav = navigator as unknown as {
        getBattery?: () => Promise<{
          level: number;
          charging: boolean;
          addEventListener: (evt: string, fn: () => void) => void;
        }>;
      };
      if (typeof nav.getBattery === "function") {
        nav.getBattery().then((battery) => {
          const updateBattery = () => {
            const lowBattery = !battery.charging && battery.level <= 0.2;
            this.isBatterySaving = lowBattery;
            if (lowBattery && this.mode === "auto") {
              this.applyPreset("low");
            }
          };
          updateBattery();
          battery.addEventListener("levelchange", updateBattery);
          battery.addEventListener("chargingchange", updateBattery);
        }).catch(() => {});
      }

      // Quick mobile/wearable detection for initial preset
      if (this.mode === "auto") {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const lowMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
        const lowCores = navigator.hardwareConcurrency;

        if (this.deviceCategory === "Wearable") {
          this.currentPreset = "low";
        } else if (isMobile || (lowMemory && lowMemory <= 4) || (lowCores && lowCores <= 4)) {
          this.currentPreset = "balanced";
        } else {
          this.currentPreset = "high";
        }
      }
    }
  }

  public static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager();
    }
    return PerformanceManager.instance;
  }

  private loadSettings() {
    try {
      const savedMode = localStorage.getItem(STORAGE_KEY) as PerformanceMode | null;
      if (savedMode && ["auto", "high", "balanced", "low"].includes(savedMode)) {
        this.mode = savedMode;
        if (savedMode !== "auto") {
          this.currentPreset = savedMode;
        }
      }

      const savedDiag = localStorage.getItem(DIAGNOSTICS_KEY);
      if (savedDiag !== null) {
        this.showDiagnostics = savedDiag === "true";
      }
    } catch {
      // Local storage unavailable
    }
  }

  public getSettings(): QualitySettings {
    const config = PRESET_CONFIGS[this.currentPreset];
    return {
      preset: this.currentPreset,
      ...config,
      targetFps: Math.min(config.targetFps, this.detectedHz),
    };
  }

  public getMode(): PerformanceMode {
    return this.mode;
  }

  public setMode(newMode: PerformanceMode) {
    this.mode = newMode;
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // ignore
    }

    if (newMode === "auto") {
      this.lastPresetChangeTimestamp = performance.now();
    } else {
      this.applyPreset(newMode);
    }
  }

  public isDiagnosticsVisible(): boolean {
    return this.showDiagnostics;
  }

  public setDiagnosticsVisible(show: boolean) {
    this.showDiagnostics = show;
    try {
      localStorage.setItem(DIAGNOSTICS_KEY, String(show));
    } catch {
      // ignore
    }
    this.diagnosticsListeners.forEach((fn) => fn(show));
  }

  public toggleDiagnostics(): boolean {
    this.setDiagnosticsVisible(!this.showDiagnostics);
    return this.showDiagnostics;
  }

  public setBackgroundThrottled(throttled: boolean) {
    this.isBackgroundThrottled = throttled;
  }

  public isHidden(): boolean {
    return this.isTabHidden;
  }

  public isReducedMotion(): boolean {
    return this.prefersReducedMotion;
  }

  public isThrottled(): boolean {
    return this.isBackgroundThrottled || this.isTabHidden;
  }

  public onQualityChange(callback: (settings: QualitySettings) => void): () => void {
    this.qualityChangeListeners.add(callback);
    callback(this.getSettings());
    return () => this.qualityChangeListeners.delete(callback);
  }

  public onMetricsUpdate(callback: (metrics: DetailedPerformanceMetrics) => void): () => void {
    this.metricsListeners.add(callback);
    return () => this.metricsListeners.delete(callback);
  }

  public onDiagnosticsChange(callback: (show: boolean) => void): () => void {
    this.diagnosticsListeners.add(callback);
    callback(this.showDiagnostics);
    return () => this.diagnosticsListeners.delete(callback);
  }

  /** Sample display scheduling independently of render throttling or reduced motion. */
  public sampleDisplayFrame(timestamp: number) {
    if (!this.lastRefreshSampleTimestamp) {
      this.lastRefreshSampleTimestamp = timestamp;
      return;
    }

    const delta = timestamp - this.lastRefreshSampleTimestamp;
    this.lastRefreshSampleTimestamp = timestamp;
    if (this.hzSamples.length >= 40 || delta <= 3 || delta >= 50) return;

    this.hzSamples.push(delta);
    if (this.hzSamples.length === 40) {
      const averageInterval = this.hzSamples.reduce((sum, value) => sum + value, 0) / 40;
      const measuredRate = 1000 / averageInterval;
      const nearestCommonRate = COMMON_REFRESH_RATES.reduce((nearest, rate) =>
        Math.abs(rate - measuredRate) < Math.abs(nearest - measuredRate) ? rate : nearest
      );
      const measuredRefresh = Math.max(
        1,
        Math.abs(nearestCommonRate - measuredRate) <= 3
          ? nearestCommonRate
          : Math.round(measuredRate)
      );
      this.hzSamples.length = 0;
      if (measuredRefresh !== this.detectedHz) {
        this.detectedHz = measuredRefresh;
        const settings = this.getSettings();
        this.qualityChangeListeners.forEach((listener) => listener(settings));
        this.notifyMetrics();
      }
    }
  }

  private applyPreset(preset: QualityPreset) {
    if (this.currentPreset === preset) return;
    this.currentPreset = preset;
    this.lastPresetChangeTimestamp = performance.now();
    this.consecutiveLowPerfDurationMs = 0;
    this.consecutiveHighPerfDurationMs = 0;

    const settings = this.getSettings();
    this.qualityChangeListeners.forEach((fn) => fn(settings));
    this.notifyMetrics();
  }

  /**
   * Called once per frame inside requestAnimationFrame
   */
  public recordFrame(
    timestamp: number,
    renderInfo?: {
      calls?: number;
      triangles?: number;
      geometries?: number;
      materials?: number;
      textures?: number;
      shaders?: number;
      cpuFrameTimeMs?: number;
      postProcessingEnabled?: boolean;
    }
  ) {
    if (renderInfo) {
      this.lastDrawCalls = renderInfo.calls || 0;
      this.lastTriangles = renderInfo.triangles || 0;
      this.lastGeometries = renderInfo.geometries || 0;
      this.lastMaterials = renderInfo.materials || 0;
      this.lastTextures = renderInfo.textures || 0;
      this.lastShaders = renderInfo.shaders || 0;
      this.lastCpuFrameTimeMs = Math.round((renderInfo.cpuFrameTimeMs || 0) * 10) / 10;
      this.postProcessingEnabled = Boolean(renderInfo.postProcessingEnabled);
    }

    if (!this.lastFrameTimestamp) {
      this.lastFrameTimestamp = timestamp;
      this.lastReportTimestamp = timestamp;
      this.lastHysteresisCheckTime = timestamp;
      return;
    }

    const delta = timestamp - this.lastFrameTimestamp;
    this.lastFrameTimestamp = timestamp;

    if (delta > 0 && delta < 500) {
      this.frameTimes.push(delta);
      if (this.frameTimes.length > this.maxFrameSamples) {
        this.frameTimes.shift();
      }

    }

    this.frameCount++;

    // Periodic evaluation every 500ms
    const elapsedReport = timestamp - this.lastReportTimestamp;
    if (elapsedReport >= 500) {
      this.evaluateHysteresis(timestamp);
      this.notifyMetrics();
      this.lastReportTimestamp = timestamp;
      this.frameCount = 0;
    }
  }

  private evaluateHysteresis(now: number) {
    if (this.mode !== "auto" || this.frameTimes.length < 30) return;

    // Check cooldown period
    if (now - this.lastPresetChangeTimestamp < this.cooldownPeriodMs) {
      return;
    }

    const avgFrameTime =
      this.frameTimes.reduce((acc, val) => acc + val, 0) / this.frameTimes.length;
    const avgFps = 1000 / avgFrameTime;
    const elapsed = now - (this.lastHysteresisCheckTime || now);
    this.lastHysteresisCheckTime = now;

    const recoveryThresholdFps = Math.min(95, this.detectedHz * 0.9);

    // Condition 1: Poor performance (< 48 FPS or > 21ms frame time)
    if (avgFps < 48 || avgFrameTime > 21.0) {
      this.consecutiveLowPerfDurationMs += elapsed;
      this.consecutiveHighPerfDurationMs = 0;

      // If sustained poor performance for 3 seconds, downgrade
      if (this.consecutiveLowPerfDurationMs >= 3000) {
        if (this.currentPreset === "high") {
          this.applyPreset("balanced");
        } else if (this.currentPreset === "balanced") {
          this.applyPreset("low");
        }
      }
    }
    // Recover based on available headroom without requiring a 90+ Hz display.
    else if (
      avgFps >= recoveryThresholdFps &&
      avgFrameTime <= (1000 / recoveryThresholdFps) * 1.05
    ) {
      this.consecutiveHighPerfDurationMs += elapsed;
      this.consecutiveLowPerfDurationMs = 0;

      // If sustained great performance for 6 seconds, upgrade
      if (this.consecutiveHighPerfDurationMs >= 6000) {
        if (this.currentPreset === "low") {
          this.applyPreset("balanced");
        } else if (this.currentPreset === "balanced") {
          this.applyPreset("high");
        }
      }
    } else {
      // Normal range: reset timers
      this.consecutiveLowPerfDurationMs = Math.max(0, this.consecutiveLowPerfDurationMs - elapsed * 0.5);
      this.consecutiveHighPerfDurationMs = Math.max(0, this.consecutiveHighPerfDurationMs - elapsed * 0.5);
    }
  }

  public getMetrics(): DetailedPerformanceMetrics {
    const times = this.frameTimes;
    if (times.length === 0) {
      return {
        fps: 0,
        avgFps: 0,
        onePercentLowFps: 0,
        frameTimeMs: 0,
        avgFrameTimeMs: 0,
        activePreset: this.currentPreset,
        mode: this.mode,
        drawCalls: this.lastDrawCalls,
        triangles: this.lastTriangles,
        geometries: this.lastGeometries,
        materials: this.lastMaterials,
        textures: this.lastTextures,
        shaders: this.lastShaders,
        cpuFrameTimeMs: this.lastCpuFrameTimeMs,
        postProcessingEnabled: this.postProcessingEnabled,
        prefersReducedMotion: this.prefersReducedMotion,
        isThrottled: this.isBackgroundThrottled,
        isHidden: this.isTabHidden,
        detectedHz: this.detectedHz,
        deviceCategory: this.deviceCategory,
        isBatterySaving: this.isBatterySaving,
      };
    }

    const latest = times[times.length - 1];
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const sorted = [...times].sort((a, b) => b - a); // slowest first
    const onePercentIndex = Math.max(0, Math.floor(sorted.length * 0.01));
    const slowestTime = sorted[onePercentIndex] || latest;

    return {
      fps: Math.round(1000 / Math.max(latest, 1)),
      avgFps: Math.round(1000 / Math.max(avg, 1)),
      onePercentLowFps: Math.round(1000 / Math.max(slowestTime, 1)),
      frameTimeMs: Math.round(latest * 10) / 10,
      avgFrameTimeMs: Math.round(avg * 10) / 10,
      activePreset: this.currentPreset,
      mode: this.mode,
      drawCalls: this.lastDrawCalls,
      triangles: this.lastTriangles,
      geometries: this.lastGeometries,
      materials: this.lastMaterials,
      textures: this.lastTextures,
      shaders: this.lastShaders,
      cpuFrameTimeMs: this.lastCpuFrameTimeMs,
      postProcessingEnabled: this.postProcessingEnabled,
      prefersReducedMotion: this.prefersReducedMotion,
      isThrottled: this.isBackgroundThrottled,
      isHidden: this.isTabHidden,
      detectedHz: this.detectedHz,
      deviceCategory: this.deviceCategory,
      isBatterySaving: this.isBatterySaving,
    };
  }

  private notifyMetrics() {
    if (this.metricsListeners.size === 0) return;
    const metrics = this.getMetrics();
    this.metricsListeners.forEach((fn) => fn(metrics));
  }
}
