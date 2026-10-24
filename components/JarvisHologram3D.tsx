"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import {
  createHologramScene,
  type HologramSceneApi,
  type HologramPerformanceMetrics,
} from "@/lib/hologramScene";

import { QualityPreset } from "@/lib/performanceManager";

export interface JarvisHologram3DProps {
  className?: string;
  modelUrl?: string;
  onFallbackToProcedural?: () => void;
  showTelemetryOverlay?: boolean;
}

export interface JarvisHologram3DHandle {
  rotateBy: (deltaTheta: number, deltaPhi: number) => void;
  zoomBy: (factor: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  toggleAnimations: (play?: boolean) => boolean;
  getPerformanceMetrics: () => HologramPerformanceMetrics;
  setQualityPreset: (preset: QualityPreset) => void;
  setSubtleMode: (subtle: boolean) => void;
}

const JarvisHologram3D = forwardRef<JarvisHologram3DHandle, JarvisHologram3DProps>(
  (
    {
      className = "",
      modelUrl = "/models/jarvis_hologram.glb",
      onFallbackToProcedural,
      showTelemetryOverlay = true,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<HologramSceneApi | null>(null);

    // Direct DOM refs for telemetry to avoid periodic React re-renders
    const fpsRef = useRef<HTMLSpanElement>(null);
    const frameRef = useRef<HTMLSpanElement>(null);
    const trisRef = useRef<HTMLSpanElement>(null);
    const drawsRef = useRef<HTMLSpanElement>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState(15);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    // Expose control API to parent
    useImperativeHandle(ref, () => ({
      rotateBy: (dt, dp) => sceneRef.current?.rotateBy(dt, dp),
      zoomBy: (factor) => sceneRef.current?.zoomBy(factor),
      zoomIn: () => sceneRef.current?.zoomIn(),
      zoomOut: () => sceneRef.current?.zoomOut(),
      resetView: () => sceneRef.current?.resetView(),
      toggleAnimations: (play) => sceneRef.current?.toggleAnimations(play) ?? false,
      getPerformanceMetrics: () =>
        sceneRef.current?.getPerformanceMetrics() ?? {
          fps: 0,
          frameTimeMs: 0,
          cpuFrameTimeMs: 0,
          drawCalls: 0,
          triangles: 0,
          geometries: 0,
          materials: 0,
          textures: 0,
          shaders: 0,
          postProcessingEnabled: false,
        },
      setQualityPreset: (preset: QualityPreset) => sceneRef.current?.setQualityPreset?.(preset),
      setSubtleMode: (subtle: boolean) => sceneRef.current?.setSubtleMode?.(subtle),
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      setIsLoading(true);
      setLoadError(null);
      setProgress(15);

      const scene = createHologramScene(container, modelUrl, {
        onLoad: () => {
          setIsLoading(false);
          setProgress(100);
        },
        onProgress: (p) => {
          setProgress(Math.max(15, p));
        },
        onError: (err) => {
          setIsLoading(false);
          setLoadError(
            err.message ||
              "Holographic model missing. Run 'npm run generate:hologram' in terminal."
          );
        },
        onPerformanceUpdate: (metrics) => {
          // Direct DOM updates prevent React component re-renders
          if (fpsRef.current) fpsRef.current.textContent = String(metrics.fps || "--");
          if (frameRef.current) frameRef.current.textContent = `${metrics.frameTimeMs}ms`;
          if (trisRef.current) trisRef.current.textContent = metrics.triangles.toLocaleString();
          if (drawsRef.current) drawsRef.current.textContent = String(metrics.drawCalls);
        },
      });

      sceneRef.current = scene;

      return () => {
        scene.dispose();
        sceneRef.current = null;
      };
    }, [modelUrl, reloadKey]);

    const handleRetry = () => {
      setReloadKey((k) => k + 1);
    };

    return (
      <div className={`jarvis-hologram-wrapper ${className}`}>
        {/* 3D WebGL Canvas Container */}
        <div ref={containerRef} className="hologram-canvas-container" />

        {/* Loading HUD Overlay */}
        {isLoading && (
          <div className="hologram-loading-hud" role="status" aria-live="polite">
            <div className="hud-loader-reticle">
              <div className="loader-ring outer" />
              <div className="loader-ring inner" />
              <div className="loader-core" />
            </div>
            <div className="hud-loading-text">
              <span className="hud-loader-title">CALIBRATING HOLOGRAPHIC MATRIX</span>
              <span className="hud-loader-sub">
                STARK LABS // RADEON 840M VIRTUAL RENDER ENGINE
              </span>
            </div>
            <div className="hud-progress-bar-wrap">
              <div
                className="hud-progress-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="hud-progress-digits">{progress}% LOADED</div>
          </div>
        )}

        {/* Error Fallback HUD Overlay */}
        {loadError && (
          <div className="hologram-error-hud" role="alert">
            <div className="error-badge">SYS.ERR // GLB ASSET UNREACHABLE</div>
            <p className="error-description">{loadError}</p>
            <div className="error-actions">
              <button
                type="button"
                className="hud-btn active"
                onClick={handleRetry}
              >
                RETRY PROJECTION
              </button>
              {onFallbackToProcedural && (
                <button
                  type="button"
                  className="hud-btn"
                  onClick={onFallbackToProcedural}
                >
                  SWITCH TO PROCEDURAL ORB
                </button>
              )}
            </div>
          </div>
        )}

        {/* Real-Time Measured Telemetry Pill */}
        {process.env.NODE_ENV === "development" && showTelemetryOverlay && !isLoading && !loadError && (
          <div className="hologram-telemetry-pill">
            <span className="telemetry-item">
              <span className="tel-dot" />
              <span className="tel-label">FPS:</span>
              <span ref={fpsRef} className="tel-val cyan">--</span>
            </span>
            <span className="telemetry-sep">|</span>
            <span className="telemetry-item">
              <span className="tel-label">FRAME:</span>
              <span ref={frameRef} className="tel-val">--ms</span>
            </span>
            <span className="telemetry-sep">|</span>
            <span className="telemetry-item">
              <span className="tel-label">TRIS:</span>
              <span ref={trisRef} className="tel-val">--</span>
            </span>
            <span className="telemetry-sep">|</span>
            <span className="telemetry-item">
              <span className="tel-label">DRAWS:</span>
              <span ref={drawsRef} className="tel-val">--</span>
            </span>
          </div>
        )}
      </div>
    );
  }
);

JarvisHologram3D.displayName = "JarvisHologram3D";

export default JarvisHologram3D;
