"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createOrbScene, type OrbSceneApi } from "@/lib/orbScene";
import JarvisHologram3D, { type JarvisHologram3DHandle } from "@/components/JarvisHologram3D";
import { HandTracker, type TrackerStatus } from "@/lib/handTracker";
import type {
  GestureId,
  GestureAction,
  GestureMappingConfig,
  HandMetrics,
  PerformanceMetrics,
} from "@/lib/gestureTypes";
import { DEFAULT_MAPPINGS } from "@/lib/gestureEngine";
import Navigation, { type ActiveScreen } from "@/components/Navigation";
import HomeScreen from "@/components/screens/HomeScreen";
import ChatScreen from "@/components/screens/ChatScreen";
import VoiceScreen from "@/components/screens/VoiceScreen";
import GesturesScreen from "@/components/screens/GesturesScreen";
import SystemScreen from "@/components/screens/SystemScreen";
import HistoryScreen from "@/components/screens/HistoryScreen";
import SettingsScreen from "@/components/screens/SettingsScreen";
import PerformanceDiagnosticHUD from "@/components/PerformanceDiagnosticHUD";
import { PerformanceManager } from "@/lib/performanceManager";
import { isWebGLAvailable, getDeviceCategory } from "@/lib/webglDetection";
import WearableHUD from "@/components/WearableHUD";
import Tactical2DOrb from "@/components/Tactical2DOrb";

type CameraState = "off" | "starting" | "on" | "error";

const SCREENS_ORDER: ActiveScreen[] = [
  "home",
  "chat",
  "voice",
  "gestures",
  "system",
  "history",
  "settings",
];

export default function JarvisOrb() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<OrbSceneApi | null>(null);
  const hologramRef = useRef<JarvisHologram3DHandle>(null);
  const trackerRef = useRef<HandTracker | null>(null);

  const [viewportMode, setViewportMode] = useState<"blender_hologram" | "procedural_orb" | "tactical_2d">(
    "blender_hologram"
  );
  const [isWearableMode, setIsWearableMode] = useState(false);
  const [deviceModeReady, setDeviceModeReady] = useState(false);
  const [allowExitWearableMode, setAllowExitWearableMode] = useState(true);
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>("home");
  const [initialChatPrompt, setInitialChatPrompt] = useState("");
  const [camera, setCamera] = useState<CameraState>("off");
  const [status, setStatus] = useState<TrackerStatus>({ hands: 0, mode: "idle" });
  const [handsMetrics, setHandsMetrics] = useState<HandMetrics[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    inferenceTimeMs: 0,
    processingTimeMs: 0,
    totalFrames: 0,
    droppedFrames: 0,
  });
  const [mappings, setMappings] = useState<GestureMappingConfig[]>(DEFAULT_MAPPINGS);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [modelName, setModelName] = useState("llama3.2:3b");

  // Check Ollama Health
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const data = await res.json();
        setIsOnline(Boolean(data.connected && data.modelAvailable));
        if (data.model) setModelName(data.model);
      } catch {
        setIsOnline(false);
      }
    };
    void checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Progressive enhancement: WebGL availability check & wearable screen detection
  useEffect(() => {
    const category = getDeviceCategory();
    const params = new URLSearchParams(window.location.search);
    const isWearable = category === "wearable" || params.get("mode") === "wearable";

    if (isWearable) {
      setIsWearableMode(true);
      setAllowExitWearableMode(category !== "wearable" && params.get("native") !== "wearos");
    } else if (!isWebGLAvailable()) {
      setViewportMode("tactical_2d");
    }
    setDeviceModeReady(true);
  }, []);

  // Virtual keyboard ergonomics: adjust --visual-viewport-h when software keyboard opens on phones
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleViewport = () => {
      const vh = window.visualViewport?.height;
      if (vh && vh > 0) {
        document.documentElement.style.setProperty("--visual-viewport-h", `${vh}px`);
      }
    };

    window.visualViewport.addEventListener("resize", handleViewport);
    window.visualViewport.addEventListener("scroll", handleViewport);
    handleViewport();

    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewport);
      window.visualViewport?.removeEventListener("scroll", handleViewport);
    };
  }, []);

  // Initialize Three.js 3D Procedural Orb only when in procedural mode
  useEffect(() => {
    if (!deviceModeReady || isWearableMode) return;
    if (viewportMode !== "procedural_orb") {
      sceneRef.current?.dispose();
      sceneRef.current = null;
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const scene = createOrbScene(container);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [deviceModeReady, isWearableMode, viewportMode]);

  const handleRotate = useCallback(
    (deltaTheta: number, deltaPhi: number) => {
      if (viewportMode === "blender_hologram") {
        hologramRef.current?.rotateBy(deltaTheta, deltaPhi);
      } else {
        sceneRef.current?.rotateBy(deltaTheta, deltaPhi);
      }
    },
    [viewportMode]
  );

  const handleZoom = useCallback(
    (factor: number) => {
      if (viewportMode === "blender_hologram") {
        hologramRef.current?.zoomBy(factor);
      } else {
        sceneRef.current?.zoomBy(factor);
      }
    },
    [viewportMode]
  );

  const handleZoomIn = useCallback(() => {
    if (viewportMode === "blender_hologram") {
      hologramRef.current?.zoomIn();
    } else {
      sceneRef.current?.zoomIn();
    }
  }, [viewportMode]);

  const handleZoomOut = useCallback(() => {
    if (viewportMode === "blender_hologram") {
      hologramRef.current?.zoomOut();
    } else {
      sceneRef.current?.zoomOut();
    }
  }, [viewportMode]);

  const handleResetView = useCallback(() => {
    if (viewportMode === "blender_hologram") {
      hologramRef.current?.resetView();
    } else {
      sceneRef.current?.resetView();
    }
  }, [viewportMode]);

  const stopGestures = useCallback(() => {
    trackerRef.current?.stop();
    trackerRef.current = null;
    setCamera("off");
    setStatus({ hands: 0, mode: "idle", gesture: "STANDBY" });
    setHandsMetrics([]);
  }, []);

  const handleRecognizedGesture = useCallback(
    (gesture: GestureId, confidence: number, action: GestureAction) => {
      switch (action) {
        case "WAKE_HOME":
          setActiveScreen("home");
          break;
        case "SWITCH_PANEL_NEXT":
          setActiveScreen((curr) => {
            const idx = SCREENS_ORDER.indexOf(curr);
            return SCREENS_ORDER[(idx + 1) % SCREENS_ORDER.length];
          });
          break;
        case "SWITCH_PANEL_PREV":
          setActiveScreen((curr) => {
            const idx = SCREENS_ORDER.indexOf(curr);
            return SCREENS_ORDER[(idx - 1 + SCREENS_ORDER.length) % SCREENS_ORDER.length];
          });
          break;
        case "SCROLL_UP":
          handleZoomIn();
          break;
        case "SCROLL_DOWN":
          handleZoomOut();
          break;
        case "SYSTEM_DIAGNOSTIC":
          setActiveScreen("system");
          break;
        case "VOICE_ACTIVATION":
          setActiveScreen("voice");
          break;
        case "PAUSE_LOCK":
          trackerRef.current?.getGestureEngine().togglePause();
          break;
        case "SELECT_CONFIRM":
          // Affirmative HUD action
          break;
        default:
          // Default fallbacks based on gesture ID
          if (gesture === "SWIPE_RIGHT") {
            setActiveScreen((curr) => {
              const idx = SCREENS_ORDER.indexOf(curr);
              return SCREENS_ORDER[(idx + 1) % SCREENS_ORDER.length];
            });
          } else if (gesture === "SWIPE_LEFT") {
            setActiveScreen((curr) => {
              const idx = SCREENS_ORDER.indexOf(curr);
              return SCREENS_ORDER[(idx - 1 + SCREENS_ORDER.length) % SCREENS_ORDER.length];
            });
          } else if (gesture === "OPEN_PALM") {
            setActiveScreen("home");
          }
      }
    },
    []
  );

  const handleUpdateMapping = useCallback(
    (gestureId: GestureId, updates: Partial<GestureMappingConfig>) => {
      setMappings((prev) =>
        prev.map((m) => (m.gestureId === gestureId ? { ...m, ...updates } : m))
      );
      trackerRef.current?.getGestureEngine().updateMapping(gestureId, updates);
    },
    []
  );

  const startGestures = useCallback(async () => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay || trackerRef.current) return;

    setCamera("starting");
    setError(null);

    const tracker = new HandTracker(
      video,
      overlay,
      {
        onRotate: (dt, dp) => handleRotate(dt, dp),
        onZoom: (factor) => handleZoom(factor),
        onStatus: (st) => {
          setStatus(st);
          if (trackerRef.current) {
            setHandsMetrics(trackerRef.current.getLatestHandMetrics());
            setPerformanceMetrics(trackerRef.current.getPerformanceMetrics());
          }
        },
        onGesture: (gesture, confidence, action) =>
          handleRecognizedGesture(gesture, confidence, action),
      },
      mappings
    );
    trackerRef.current = tracker;

    try {
      await tracker.start();
      setCamera("on");
    } catch (err) {
      trackerRef.current = null;
      tracker.stop();
      setCamera("error");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "CAMERA ACCESS DENIED"
          : "TRACKING INIT FAILED"
      );
    }
  }, [handleRecognizedGesture, handleRotate, handleZoom, mappings]);

  const toggleGestures = useCallback(() => {
    if (trackerRef.current) stopGestures();
    else void startGestures();
  }, [startGestures, stopGestures]);

  // Synchronize 30 FPS subtle background throttling with active screen
  useEffect(() => {
    const isSubtle = activeScreen !== "home";
    hologramRef.current?.setSubtleMode(isSubtle);
    sceneRef.current?.setSubtleMode?.(isSubtle);
  }, [activeScreen]);

  // Keyboard shortcut listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (e.key) {
        case "+":
        case "=":
          handleZoomIn();
          break;
        case "-":
        case "_":
          handleZoomOut();
          break;
        case "r":
        case "R":
          handleResetView();
          break;
        case "h":
        case "H":
          setViewportMode((curr) => {
            if (curr === "blender_hologram") return "procedural_orb";
            if (curr === "procedural_orb") return "tactical_2d";
            return "blender_hologram";
          });
          break;
        case "w":
        case "W":
          setIsWearableMode((curr) => !curr);
          break;
        case "p":
        case "P":
          if (process.env.NODE_ENV === "development") {
            PerformanceManager.getInstance().toggleDiagnostics();
          }
          break;
        case "g":
        case "G":
          toggleGestures();
          break;
        case "1":
          setActiveScreen("home");
          break;
        case "2":
          setActiveScreen("chat");
          break;
        case "3":
          setActiveScreen("voice");
          break;
        case "4":
          setActiveScreen("gestures");
          break;
        case "5":
          setActiveScreen("system");
          break;
        case "6":
          setActiveScreen("history");
          break;
        case "7":
          setActiveScreen("settings");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleResetView, handleZoomIn, handleZoomOut, toggleGestures]);

  const handleNavigate = (screen: ActiveScreen, initialText?: string) => {
    if (initialText) {
      setInitialChatPrompt(initialText);
    }
    setActiveScreen(screen);
  };

  const cameraOn = camera === "on";

  if (!deviceModeReady) return null;

  // Wearable Companion Mode (Smartwatches & tiny screens)
  if (isWearableMode) {
    return (
      <WearableHUD
        isOnline={isOnline}
        modelName={modelName}
        onExitWearableMode={allowExitWearableMode ? () => setIsWearableMode(false) : undefined}
      />
    );
  }

  return (
    <div className="jarvis-app-shell">
      {/* 3D Viewport: Blender Hologram, Procedural Orb, or Tactical 2D */}
      {viewportMode === "blender_hologram" ? (
        <div className={`orb-root ${activeScreen !== "home" ? "orb-subtle" : ""}`}>
          <JarvisHologram3D
            ref={hologramRef}
            onFallbackToProcedural={() => setViewportMode("procedural_orb")}
            showTelemetryOverlay={activeScreen === "home"}
          />
        </div>
      ) : viewportMode === "procedural_orb" ? (
        <div
          ref={containerRef}
          className={`orb-root ${activeScreen !== "home" ? "orb-subtle" : ""}`}
        />
      ) : (
        <div className={`orb-root ${activeScreen !== "home" ? "orb-subtle" : ""}`}>
          <Tactical2DOrb subtle={activeScreen !== "home"} />
        </div>
      )}

      {/* Atmospheric Overlays */}
      <div className="overlay-vignette" />
      <div className="overlay-grain" />
      <div className="overlay-scanlines" />

      {/* Top HUD Navigation Header */}
      <Navigation
        activeScreen={activeScreen}
        onSelectScreen={(screen) => setActiveScreen(screen)}
        isOnline={isOnline}
        modelName={modelName}
      />

      {/* Active Screen View */}
      <main className="hud-main-view">
        {activeScreen === "home" && (
          <HomeScreen
            onNavigate={handleNavigate}
            isOnline={isOnline}
            modelName={modelName}
            trackerStatus={status}
            cameraOn={cameraOn}
            onToggleCamera={toggleGestures}
            onResetOrb={handleResetView}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            viewportMode={viewportMode}
            onToggleViewportMode={() =>
              setViewportMode((curr) =>
                curr === "blender_hologram" ? "procedural_orb" : "blender_hologram"
              )
            }
          />
        )}

        {activeScreen === "chat" && (
          <ChatScreen
            initialText={initialChatPrompt}
            isOnline={isOnline}
            modelName={modelName}
          />
        )}

        {activeScreen === "voice" && (
          <VoiceScreen isOnline={isOnline} modelName={modelName} />
        )}

        {activeScreen === "gestures" && (
          <GesturesScreen
            cameraOn={cameraOn}
            trackerStatus={status}
            handsMetrics={handsMetrics}
            performanceMetrics={performanceMetrics}
            mappings={mappings}
            onToggleCamera={toggleGestures}
            onSetSensitivity={(s) => trackerRef.current?.setSensitivity(s)}
            onSimulateGesture={(g) => handleRecognizedGesture(g, 95, "NONE")}
            onUpdateMapping={handleUpdateMapping}
            onRecalibrate={() => trackerRef.current?.recalibrate()}
            showSkeleton={showSkeleton}
            onToggleSkeleton={() => {
              setShowSkeleton((prev) => !prev);
              trackerRef.current?.toggleSkeletonOverlay();
            }}
          />
        )}

        {activeScreen === "system" && <SystemScreen />}

        {activeScreen === "history" && (
          <HistoryScreen onSelectConversation={handleNavigate} />
        )}

        {activeScreen === "settings" && (
          <SettingsScreen
            currentModel={modelName}
            onUpdateModel={(m) => setModelName(m)}
          />
        )}
      </main>

      {/* Camera Video & Landmark Canvas Preview */}
      <div className={`camera-panel${cameraOn ? " visible" : ""}`}>
        <video ref={videoRef} muted playsInline className="camera-video" />
        <canvas ref={overlayRef} width={208} height={156} className="camera-overlay" />
        <div className="camera-status">
          {status.hands > 0
            ? `${status.hands} HAND(S) · ${status.gesture || status.mode.toUpperCase()}`
            : "STANDBY // SHOW HAND"}
        </div>
      </div>

      {error && <div className="hud-error-toast">{error}</div>}

      {/* Real-Time Performance Diagnostic HUD */}
      <PerformanceDiagnosticHUD />
    </div>
  );
}
