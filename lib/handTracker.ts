import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  GestureEngine,
  LM,
  dist3d,
  PINCH_ON,
  PINCH_OFF,
  DEFAULT_MAPPINGS,
} from "./gestureEngine";
import type {
  GestureId,
  GestureAction,
  HandMetrics,
  PerformanceMetrics,
  HandednessType,
  GestureMappingConfig,
} from "./gestureTypes";

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Skeleton connections for full 21-landmark hand rendering
const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [LM.WRIST, LM.THUMB_CMC],
  [LM.THUMB_CMC, LM.THUMB_MCP],
  [LM.THUMB_MCP, LM.THUMB_IP],
  [LM.THUMB_IP, LM.THUMB_TIP],
  // Index
  [LM.WRIST, LM.INDEX_MCP],
  [LM.INDEX_MCP, LM.INDEX_PIP],
  [LM.INDEX_PIP, LM.INDEX_DIP],
  [LM.INDEX_DIP, LM.INDEX_TIP],
  // Middle
  [LM.WRIST, LM.MIDDLE_MCP],
  [LM.MIDDLE_MCP, LM.MIDDLE_PIP],
  [LM.MIDDLE_PIP, LM.MIDDLE_DIP],
  [LM.MIDDLE_DIP, LM.MIDDLE_TIP],
  // Ring
  [LM.WRIST, LM.RING_MCP],
  [LM.RING_MCP, LM.RING_PIP],
  [LM.RING_PIP, LM.RING_DIP],
  [LM.RING_DIP, LM.RING_TIP],
  // Pinky
  [LM.WRIST, LM.PINKY_MCP],
  [LM.PINKY_MCP, LM.PINKY_PIP],
  [LM.PINKY_PIP, LM.PINKY_DIP],
  [LM.PINKY_DIP, LM.PINKY_TIP],
  // Palm arches
  [LM.INDEX_MCP, LM.MIDDLE_MCP],
  [LM.MIDDLE_MCP, LM.RING_MCP],
  [LM.RING_MCP, LM.PINKY_MCP],
];

const ROTATE_SPEED = 5.0;
const SMOOTHING = 0.4;

export type GestureMode = "idle" | "spin" | "zoom";

export interface TrackerStatus {
  hands: number;
  mode: GestureMode;
  gesture?: GestureId;
  action?: GestureAction;
  confidence?: number;
  patternBitmask?: number;
  patternString?: string;
  fps?: number;
  inferenceTimeMs?: number;
}

export interface HandTrackerCallbacks {
  /** Called when a single pinched hand drags: deltas in mirrored normalized coords */
  onRotate(deltaTheta: number, deltaPhi: number): void;
  /** Called when both hands pinch and spread/close: multiply camera distance by factor */
  onZoom(factor: number): void;
  onStatus(status: TrackerStatus): void;
  onGesture?(gesture: GestureId, confidence: number, action: GestureAction): void;
}

interface Point {
  x: number;
  y: number;
}

interface HandPinchState {
  pinching: boolean;
  grab: Point;
}

export class HandTracker {
  private video: HTMLVideoElement;
  private overlay: HTMLCanvasElement;
  private callbacks: HandTrackerCallbacks;
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private rafId = 0;
  private running = false;
  private lastVideoTime = -1;
  private isInferencing = false;

  private gestureEngine: GestureEngine;
  private handStates = new Map<string, HandPinchState>();
  private prevMode: GestureMode = "idle";
  private prevSpinGrab: Point | null = null;
  private prevZoomDist: number | null = null;
  private lastStatus: TrackerStatus = { hands: 0, mode: "idle" };

  private latestHands: HandMetrics[] = [];
  private performanceMetrics: PerformanceMetrics = {
    fps: 0,
    inferenceTimeMs: 0,
    processingTimeMs: 0,
    totalFrames: 0,
    droppedFrames: 0,
  };

  private showSkeleton = true;

  constructor(
    video: HTMLVideoElement,
    overlay: HTMLCanvasElement,
    callbacks: HandTrackerCallbacks,
    customMappings?: GestureMappingConfig[]
  ) {
    this.video = video;
    this.overlay = overlay;
    this.callbacks = callbacks;
    this.gestureEngine = new GestureEngine(customMappings);
  }

  public getGestureEngine(): GestureEngine {
    return this.gestureEngine;
  }

  public getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMetrics;
  }

  public getLatestHandMetrics(): HandMetrics[] {
    return this.latestHands;
  }

  public setSensitivity(val: number): void {
    this.gestureEngine.setSensitivity(val);
  }

  public toggleSkeletonOverlay(visible?: boolean): boolean {
    this.showSkeleton = visible !== undefined ? visible : !this.showSkeleton;
    return this.showSkeleton;
  }

  public recalibrate(): void {
    this.gestureEngine.resetCalibration();
    this.handStates.clear();
    this.prevSpinGrab = null;
    this.prevZoomDist = null;
  }

  async start(): Promise<void> {
    // Acquire webcam stream with recommended 640x480 resolution for low latency
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
        frameRate: { ideal: 30, max: 60 },
      },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
    const options = {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" as const },
      runningMode: "VIDEO" as const,
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    };

    try {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, options);
    } catch {
      // GPU delegate fallback to CPU
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: "CPU" as const },
      });
    }

    this.running = true;
    this.loop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.landmarker?.close();
    this.landmarker = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.handStates.clear();
    this.latestHands = [];
    this.prevMode = "idle";
    this.prevSpinGrab = null;
    this.prevZoomDist = null;

    const ctx = this.overlay.getContext("2d");
    ctx?.clearRect(0, 0, this.overlay.width, this.overlay.height);
    this.emitStatus({ hands: 0, mode: "idle", gesture: "STANDBY", confidence: 0 });
  }

  private loop = () => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    if (!this.landmarker || this.video.readyState < 2) return;
    if (this.video.currentTime === this.lastVideoTime) return;

    // Prevent overlapping inference requests
    if (this.isInferencing) {
      this.gestureEngine.recordDroppedFrame();
      return;
    }

    this.lastVideoTime = this.video.currentTime;
    this.isInferencing = true;
    const startTime = performance.now();

    try {
      const result = this.landmarker.detectForVideo(this.video, startTime);
      const inferenceDuration = performance.now() - startTime;

      const handednesses: HandednessType[] = result.handedness.map((h) => {
        const cat = h[0]?.categoryName ?? "Right";
        return cat === "Left" ? "Left" : cat === "Right" ? "Right" : "Unknown";
      });

      this.processHands(result.landmarks, handednesses);
      this.drawOverlay(result.landmarks);

      const totalDuration = performance.now() - startTime;
      this.performanceMetrics = this.gestureEngine.recordPerformanceMetrics(
        inferenceDuration,
        totalDuration
      );
    } catch (e) {
      console.warn("HandTracker frame error:", e);
    } finally {
      this.isInferencing = false;
    }
  };

  private processHands(
    landmarks: NormalizedLandmark[][],
    handednessList: HandednessType[]
  ): void {
    const pinchedGrabs: Point[] = [];
    const seen = new Set<string>();
    const handsMetrics: HandMetrics[] = [];

    landmarks.forEach((lm, i) => {
      const handedness = handednessList[i] || "Right";
      const handKey = `${handedness}-${i}`;
      seen.add(handKey);

      // Analyze 5 fingers independently via GestureEngine
      const metrics = this.gestureEngine.analyzeHand(lm, handedness, 92);
      handsMetrics.push(metrics);

      // Pinch grab calculation
      const handScale = metrics.handScale;
      const pinchRatio = metrics.pinchRatios.thumbIndex;

      const rawGrab: Point = {
        x: 1 - (lm[LM.THUMB_TIP].x + lm[LM.INDEX_TIP].x) / 2,
        y: (lm[LM.THUMB_TIP].y + lm[LM.INDEX_TIP].y) / 2,
      };

      let state = this.handStates.get(handKey);
      if (!state) {
        state = { pinching: false, grab: rawGrab };
        this.handStates.set(handKey, state);
      }

      // Hysteresis
      if (state.pinching && pinchRatio > PINCH_OFF) state.pinching = false;
      else if (!state.pinching && pinchRatio < PINCH_ON) state.pinching = true;

      state.grab = {
        x: state.grab.x + (rawGrab.x - state.grab.x) * SMOOTHING,
        y: state.grab.y + (rawGrab.y - state.grab.y) * SMOOTHING,
      };

      if (state.pinching) pinchedGrabs.push(state.grab);
    });

    this.latestHands = handsMetrics;

    // Prune absent hands
    for (const key of this.handStates.keys()) {
      if (!seen.has(key)) this.handStates.delete(key);
    }

    const mode: GestureMode =
      pinchedGrabs.length >= 2 ? "zoom" : pinchedGrabs.length === 1 ? "spin" : "idle";

    if (mode !== this.prevMode) {
      this.prevSpinGrab = null;
      this.prevZoomDist = null;
      this.prevMode = mode;
    }

    // Orb Spin (Single Hand Pinch Drag)
    if (mode === "spin") {
      const grab = pinchedGrabs[0];
      if (this.prevSpinGrab) {
        const dx = grab.x - this.prevSpinGrab.x;
        const dy = grab.y - this.prevSpinGrab.y;
        if (Math.abs(dx) > 1e-4 || Math.abs(dy) > 1e-4) {
          this.callbacks.onRotate(dx * ROTATE_SPEED, dy * ROTATE_SPEED);
        }
      }
      this.prevSpinGrab = grab;
    } else if (mode === "zoom") {
      // Orb Zoom (Two Hand Pinch Spread)
      const d = Math.hypot(
        pinchedGrabs[0].x - pinchedGrabs[1].x,
        pinchedGrabs[0].y - pinchedGrabs[1].y
      );
      if (this.prevZoomDist && d > 1e-4) {
        const factor = Math.min(1.18, Math.max(0.85, this.prevZoomDist / d));
        this.callbacks.onZoom(factor);
      }
      this.prevZoomDist = d;
    }

    // Comprehensive gesture evaluation via GestureEngine
    const evaluation = this.gestureEngine.evaluateGestures(handsMetrics);

    if (evaluation.fired && evaluation.gesture !== "STANDBY") {
      this.callbacks.onGesture?.(
        evaluation.gesture,
        evaluation.confidence,
        evaluation.action
      );
    }

    const primaryHand = handsMetrics[0];

    this.emitStatus({
      hands: landmarks.length,
      mode,
      gesture: evaluation.gesture,
      action: evaluation.action,
      confidence: evaluation.confidence,
      patternBitmask: primaryHand?.patternBitmask,
      patternString: primaryHand?.patternString,
      fps: this.performanceMetrics.fps,
      inferenceTimeMs: this.performanceMetrics.inferenceTimeMs,
    });
  }

  private emitStatus(status: TrackerStatus): void {
    this.lastStatus = status;
    this.callbacks.onStatus(status);
  }

  private drawOverlay(landmarks: NormalizedLandmark[][]): void {
    const ctx = this.overlay.getContext("2d");
    if (!ctx) return;
    const { width, height } = this.overlay;
    ctx.clearRect(0, 0, width, height);

    if (!this.showSkeleton && landmarks.length === 0) return;

    // Render skeleton joints and bones
    for (let hIdx = 0; hIdx < landmarks.length; hIdx++) {
      const lm = landmarks[hIdx];
      const metrics = this.latestHands[hIdx];
      const isPinched = metrics && metrics.pinchRatios.thumbIndex < PINCH_ON;

      // Draw bone connections
      ctx.lineWidth = isPinched ? 2.5 : 1.5;
      for (const [from, to] of HAND_CONNECTIONS) {
        const p1 = lm[from];
        const p2 = lm[to];
        const x1 = (1 - p1.x) * width;
        const y1 = p1.y * height;
        const x2 = (1 - p2.x) * width;
        const y2 = p2.y * height;

        ctx.strokeStyle = isPinched
          ? "rgba(128, 247, 255, 0.85)"
          : "rgba(0, 240, 255, 0.5)";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Draw 21 landmark nodes
      for (let i = 0; i < lm.length; i++) {
        const pt = lm[i];
        const px = (1 - pt.x) * width;
        const py = pt.y * height;

        const isTip = [LM.THUMB_TIP, LM.INDEX_TIP, LM.MIDDLE_TIP, LM.RING_TIP, LM.PINKY_TIP].includes(
          i as any
        );

        ctx.beginPath();
        if (isTip) {
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#00f0ff";
          ctx.shadowColor = "#00f0ff";
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0, 180, 220, 0.75)";
          ctx.fill();
        }
      }
    }

    // Top HUD Telemetry Banner
    const gesture = this.lastStatus.gesture || "STANDBY";
    const fps = this.performanceMetrics.fps;
    const latency = this.performanceMetrics.inferenceTimeMs;

    ctx.fillStyle = "rgba(0, 12, 24, 0.82)";
    ctx.fillRect(4, 4, width - 8, 20);
    ctx.strokeStyle = "rgba(0, 240, 255, 0.65)";
    ctx.lineWidth = 1;
    ctx.strokeRect(4, 4, width - 8, 20);

    ctx.fillStyle = "#80f7ff";
    ctx.font = "bold 8.5px Courier New, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${gesture} · ${fps}FPS · ${latency}ms`,
      8,
      14
    );
  }
}
