import type {
  FingerName,
  FingerState,
  FingerAnalysis,
  HandMetrics,
  HandednessType,
  GestureId,
  GestureAction,
  GestureMappingConfig,
  PerformanceMetrics,
} from "./gestureTypes";

// Landmark indices according to MediaPipe Hand Model
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export interface Landmark3D {
  x: number;
  y: number;
  z?: number;
}

export function dist3d(a: Landmark3D, b: Landmark3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.hypot(dx, dy, dz);
}

export function curlAngleDeg(a: Landmark3D, b: Landmark3D, c: Landmark3D): number {
  // Vector of proximal bone (b - a) and distal bone (c - b)
  // When extended straight, both point in same direction -> angle is 0 deg
  // When bent / curled, angle increases toward 90+ deg
  const v1 = { x: b.x - a.x, y: b.y - a.y, z: (b.z ?? 0) - (a.z ?? 0) };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: (c.z ?? 0) - (b.z ?? 0) };
  const d1 = Math.hypot(v1.x, v1.y, v1.z);
  const d2 = Math.hypot(v2.x, v2.y, v2.z);
  if (d1 < 1e-6 || d2 < 1e-6) return 0;
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const cos = Math.max(-1, Math.min(1, dot / (d1 * d2)));
  return Math.acos(cos) * (180 / Math.PI);
}

// Pinch thresholds relative to hand scale
export const PINCH_ON = 0.32;
export const PINCH_OFF = 0.45;

export const DEFAULT_MAPPINGS: GestureMappingConfig[] = [
  {
    gestureId: "OPEN_PALM",
    displayName: "Open Palm",
    action: "WAKE_HOME",
    defaultAction: "WAKE_HOME",
    enabled: true,
    isContinuous: false,
    holdDurationMs: 180,
    description: "All five fingers extended upright. Returns to Home HUD.",
  },
  {
    gestureId: "PINCH_INDEX",
    displayName: "Thumb-Index Pinch",
    action: "ROTATE_ORB",
    defaultAction: "ROTATE_ORB",
    enabled: true,
    isContinuous: true,
    holdDurationMs: 0,
    description: "Pinch index and thumb to rotate 3D holographic orb.",
  },
  {
    gestureId: "PINCH_MIDDLE",
    displayName: "Thumb-Middle Pinch",
    action: "NONE",
    defaultAction: "NONE",
    enabled: true,
    isContinuous: true,
    holdDurationMs: 0,
    description: "Thumb and middle fingertip pinch.",
  },
  {
    gestureId: "PINCH_RING",
    displayName: "Thumb-Ring Pinch",
    action: "NONE",
    defaultAction: "NONE",
    enabled: true,
    isContinuous: true,
    holdDurationMs: 0,
    description: "Thumb and ring fingertip pinch.",
  },
  {
    gestureId: "PINCH_PINKY",
    displayName: "Thumb-Pinky Pinch",
    action: "NONE",
    defaultAction: "NONE",
    enabled: true,
    isContinuous: true,
    holdDurationMs: 0,
    description: "Thumb and pinky fingertip pinch.",
  },
  {
    gestureId: "TWO_HAND_ZOOM",
    displayName: "Two-Hand Pinch Zoom",
    action: "ZOOM_ORB",
    defaultAction: "ZOOM_ORB",
    enabled: true,
    isContinuous: true,
    holdDurationMs: 0,
    description: "Two hands pinching and moving closer/apart to zoom orb.",
  },
  {
    gestureId: "POINTING_INDEX",
    displayName: "Index Point",
    action: "SELECT_CONFIRM",
    defaultAction: "SELECT_CONFIRM",
    enabled: true,
    isContinuous: false,
    holdDurationMs: 150,
    description: "Single extended index finger for precise target targeting.",
  },
  {
    gestureId: "PEACE_VICTORY",
    displayName: "Victory (Index + Middle)",
    action: "SCROLL_UP",
    defaultAction: "SCROLL_UP",
    enabled: true,
    isContinuous: false,
    holdDurationMs: 180,
    description: "Two extended fingers. Navigates or scrolls active list.",
  },
  {
    gestureId: "CLOSED_FIST",
    displayName: "Closed Fist",
    action: "PAUSE_LOCK",
    defaultAction: "PAUSE_LOCK",
    enabled: true,
    isContinuous: false,
    holdDurationMs: 220,
    description: "All fingers curled tightly. Pauses / locks gesture input.",
  },
  {
    gestureId: "THUMBS_UP",
    displayName: "Thumbs Up",
    action: "SELECT_CONFIRM",
    defaultAction: "SELECT_CONFIRM",
    enabled: true,
    isContinuous: false,
    holdDurationMs: 200,
    description: "Thumb upright with fist curled. Confirms pending action.",
  },
  {
    gestureId: "THUMBS_DOWN",
    displayName: "Thumbs Down",
    action: "NONE",
    defaultAction: "NONE",
    enabled: false,
    isContinuous: false,
    holdDurationMs: 200,
    description: "Thumb downward with fist curled. Dismisses dialog.",
  },
  {
    gestureId: "THREE_FINGERS",
    displayName: "Three Fingers",
    action: "SYSTEM_DIAGNOSTIC",
    defaultAction: "SYSTEM_DIAGNOSTIC",
    enabled: true,
    isContinuous: false,
    holdDurationMs: 200,
    description: "Index, middle, and ring extended. Opens System Diagnostics.",
  },
  {
    gestureId: "FOUR_FINGERS",
    displayName: "Four Fingers",
    action: "SWITCH_PANEL_NEXT",
    defaultAction: "SWITCH_PANEL_NEXT",
    enabled: true,
    isContinuous: false,
    holdDurationMs: 200,
    description: "Four fingers extended without thumb. Cycles HUD screen.",
  },
  {
    gestureId: "ROCK_ON",
    displayName: "Rock On (Index + Pinky)",
    action: "VOICE_ACTIVATION",
    defaultAction: "VOICE_ACTIVATION",
    enabled: true,
    isContinuous: false,
    holdDurationMs: 200,
    description: "Index and pinky extended. Quick triggers Voice mode.",
  },
  {
    gestureId: "GUN_L_SHAPE",
    displayName: "L-Shape (Thumb + Index)",
    action: "NONE",
    defaultAction: "NONE",
    enabled: false,
    isContinuous: false,
    holdDurationMs: 200,
    description: "Thumb and index extended perpendicular. Configurable.",
  },
  {
    gestureId: "SHAKA",
    displayName: "Shaka (Thumb + Pinky)",
    action: "NONE",
    defaultAction: "NONE",
    enabled: false,
    isContinuous: false,
    holdDurationMs: 200,
    description: "Thumb and pinky extended. Configurable macro.",
  },
  {
    gestureId: "SWIPE_LEFT",
    displayName: "Swipe Left",
    action: "SWITCH_PANEL_PREV",
    defaultAction: "SWITCH_PANEL_PREV",
    enabled: true,
    isContinuous: false,
    holdDurationMs: 0,
    description: "Fast horizontal hand sweep to left. Switch to previous screen.",
  },
  {
    gestureId: "SWIPE_RIGHT",
    displayName: "Swipe Right",
    action: "SWITCH_PANEL_NEXT",
    defaultAction: "SWITCH_PANEL_NEXT",
    enabled: true,
    isContinuous: false,
    holdDurationMs: 0,
    description: "Fast horizontal hand sweep to right. Switch to next screen.",
  },
  {
    gestureId: "SWIPE_UP",
    displayName: "Swipe Up",
    action: "SCROLL_UP",
    defaultAction: "SCROLL_UP",
    enabled: true,
    isContinuous: false,
    holdDurationMs: 0,
    description: "Vertical hand sweep up. Scroll list upward.",
  },
  {
    gestureId: "SWIPE_DOWN",
    displayName: "Swipe Down",
    action: "SCROLL_DOWN",
    defaultAction: "SCROLL_DOWN",
    enabled: true,
    isContinuous: false,
    holdDurationMs: 0,
    description: "Vertical hand sweep down. Scroll list downward.",
  },
];

export interface SwipeHistoryPoint {
  x: number;
  y: number;
  time: number;
}

export class GestureEngine {
  private mappings: Map<GestureId, GestureMappingConfig> = new Map();
  private prevFingerStates: Map<string, Record<FingerName, FingerState>> = new Map();
  private prevPinchStates: Map<string, Record<string, boolean>> = new Map();
  private swipeHistory: SwipeHistoryPoint[] = [];
  private lastSwipeTime = 0;
  private swipeCooldownMs = 500;
  private sensitivity = 0.75;

  // Temporal stability / hold tracking
  private candidateGesture: GestureId = "STANDBY";
  private candidateStartTime = 0;
  private activeGesture: GestureId = "STANDBY";
  private gestureFired = false;
  private isPaused = false;

  // Performance metrics tracking
  private frameTimestamps: number[] = [];
  private inferenceTimes: number[] = [];
  private processingTimes: number[] = [];
  private totalFramesTracked = 0;
  private droppedFramesCount = 0;

  constructor(customMappings?: GestureMappingConfig[]) {
    const list = customMappings ?? DEFAULT_MAPPINGS;
    for (const m of list) {
      this.mappings.set(m.gestureId, { ...m });
    }
  }

  public getMappings(): GestureMappingConfig[] {
    return Array.from(this.mappings.values());
  }

  public updateMapping(gestureId: GestureId, updates: Partial<GestureMappingConfig>): void {
    const existing = this.mappings.get(gestureId);
    if (existing) {
      this.mappings.set(gestureId, { ...existing, ...updates });
    }
  }

  public setSensitivity(val: number): void {
    this.sensitivity = Math.max(0.1, Math.min(1.0, val));
  }

  public getSensitivity(): number {
    return this.sensitivity;
  }

  public isInputPaused(): boolean {
    return this.isPaused;
  }

  public togglePause(paused?: boolean): boolean {
    this.isPaused = paused !== undefined ? paused : !this.isPaused;
    return this.isPaused;
  }

  public resetCalibration(): void {
    this.prevFingerStates.clear();
    this.prevPinchStates.clear();
    this.swipeHistory = [];
    this.candidateGesture = "STANDBY";
    this.candidateStartTime = 0;
    this.activeGesture = "STANDBY";
    this.gestureFired = false;
  }

  /**
   * Analyze 5 fingers independently for a single hand landmarks set.
   * Returns complete scale-independent HandMetrics.
   */
  public analyzeHand(
    landmarks: Landmark3D[],
    handedness: HandednessType = "Right",
    confidence = 90
  ): HandMetrics {
    const wrist = landmarks[LM.WRIST];
    const middleMcp = landmarks[LM.MIDDLE_MCP];
    const indexMcp = landmarks[LM.INDEX_MCP];
    const pinkyMcp = landmarks[LM.PINKY_MCP];

    // Scale calculation: 3D distance between wrist and middle MCP
    const handScale = Math.max(1e-4, dist3d(wrist, middleMcp));

    // Previous states for hysteresis
    const prevStates = this.prevFingerStates.get(handedness) || {
      thumb: "uncertain",
      index: "uncertain",
      middle: "uncertain",
      ring: "uncertain",
      pinky: "uncertain",
    };

    // Analyze individual fingers
    const thumbAnalysis = this.analyzeThumb(landmarks, handScale, prevStates.thumb);
    const indexAnalysis = this.analyzeStandardFinger(
      "index",
      landmarks[LM.INDEX_MCP],
      landmarks[LM.INDEX_PIP],
      landmarks[LM.INDEX_DIP],
      landmarks[LM.INDEX_TIP],
      wrist,
      handScale,
      prevStates.index
    );
    const middleAnalysis = this.analyzeStandardFinger(
      "middle",
      landmarks[LM.MIDDLE_MCP],
      landmarks[LM.MIDDLE_PIP],
      landmarks[LM.MIDDLE_DIP],
      landmarks[LM.MIDDLE_TIP],
      wrist,
      handScale,
      prevStates.middle
    );
    const ringAnalysis = this.analyzeStandardFinger(
      "ring",
      landmarks[LM.RING_MCP],
      landmarks[LM.RING_PIP],
      landmarks[LM.RING_DIP],
      landmarks[LM.RING_TIP],
      wrist,
      handScale,
      prevStates.ring
    );
    const pinkyAnalysis = this.analyzeStandardFinger(
      "pinky",
      landmarks[LM.PINKY_MCP],
      landmarks[LM.PINKY_PIP],
      landmarks[LM.PINKY_DIP],
      landmarks[LM.PINKY_TIP],
      wrist,
      handScale,
      prevStates.pinky
    );

    const fingers: Record<FingerName, FingerAnalysis> = {
      thumb: thumbAnalysis,
      index: indexAnalysis,
      middle: middleAnalysis,
      ring: ringAnalysis,
      pinky: pinkyAnalysis,
    };

    // Save for hysteresis on next frame
    this.prevFingerStates.set(handedness, {
      thumb: thumbAnalysis.state,
      index: indexAnalysis.state,
      middle: middleAnalysis.state,
      ring: ringAnalysis.state,
      pinky: pinkyAnalysis.state,
    });

    // 5-bit binary pattern: thumb(16) | index(8) | middle(4) | ring(2) | pinky(1)
    let bitmask = 0;
    if (thumbAnalysis.state === "extended") bitmask |= 16;
    if (indexAnalysis.state === "extended") bitmask |= 8;
    if (middleAnalysis.state === "extended") bitmask |= 4;
    if (ringAnalysis.state === "extended") bitmask |= 2;
    if (pinkyAnalysis.state === "extended") bitmask |= 1;

    const patternString = [
      (bitmask & 16) ? "1" : "0",
      (bitmask & 8) ? "1" : "0",
      (bitmask & 4) ? "1" : "0",
      (bitmask & 2) ? "1" : "0",
      (bitmask & 1) ? "1" : "0",
    ].join("");

    // Palm Center: centroid of wrist, index MCP, and pinky MCP
    const palmCenter = {
      x: 1 - (wrist.x + indexMcp.x + pinkyMcp.x) / 3, // mirrored x for user-facing HUD
      y: (wrist.y + indexMcp.y + pinkyMcp.y) / 3,
      z: ((wrist.z ?? 0) + (indexMcp.z ?? 0) + (pinkyMcp.z ?? 0)) / 3,
    };

    // Palm Normal Vector via cross product (indexMcp - wrist) x (pinkyMcp - wrist)
    const v1 = {
      x: indexMcp.x - wrist.x,
      y: indexMcp.y - wrist.y,
      z: (indexMcp.z ?? 0) - (wrist.z ?? 0),
    };
    const v2 = {
      x: pinkyMcp.x - wrist.x,
      y: pinkyMcp.y - wrist.y,
      z: (pinkyMcp.z ?? 0) - (wrist.z ?? 0),
    };
    const nx = v1.y * v2.z - v1.z * v2.y;
    const ny = v1.z * v2.x - v1.x * v2.z;
    const nz = v1.x * v2.y - v1.y * v2.x;
    const nMag = Math.hypot(nx, ny, nz) || 1;
    const palmNormal = { x: nx / nMag, y: ny / nMag, z: nz / nMag };

    let palmFacing: "camera" | "away" | "side" = "side";
    if (palmNormal.z < -0.35) palmFacing = "camera";
    else if (palmNormal.z > 0.35) palmFacing = "away";

    // Scale-independent pinch ratios
    const thumbTip = landmarks[LM.THUMB_TIP];
    const pinchRatios = {
      thumbIndex: dist3d(thumbTip, landmarks[LM.INDEX_TIP]) / handScale,
      thumbMiddle: dist3d(thumbTip, landmarks[LM.MIDDLE_TIP]) / handScale,
      thumbRing: dist3d(thumbTip, landmarks[LM.RING_TIP]) / handScale,
      thumbPinky: dist3d(thumbTip, landmarks[LM.PINKY_TIP]) / handScale,
    };

    return {
      handedness,
      fingers,
      patternBitmask: bitmask,
      patternString,
      palmCenter,
      palmFacing,
      palmNormal,
      pinchRatios,
      handScale,
      confidence,
    };
  }

  /**
   * Analyze non-thumb fingers (Index, Middle, Ring, Pinky).
   * Uses both joint curl angle and tip-to-wrist extension ratio with hysteresis.
   */
  private analyzeStandardFinger(
    name: FingerName,
    mcp: Landmark3D,
    pip: Landmark3D,
    dip: Landmark3D,
    tip: Landmark3D,
    wrist: Landmark3D,
    handScale: number,
    prevState: FingerState
  ): FingerAnalysis {
    const tipDist = dist3d(tip, wrist) / handScale;
    const pipDist = dist3d(pip, wrist) / handScale;
    const extensionRatio = tipDist / Math.max(1e-4, pipDist);
    const curlAngle = curlAngleDeg(mcp, pip, tip);

    let state: FingerState = prevState;

    // Hysteresis thresholds:
    // To become extended: ratio >= 1.20 and curl angle <= 55 deg
    // To become curled: ratio <= 1.06 or curl angle >= 72 deg
    if (extensionRatio >= 1.20 && curlAngle <= 55) {
      state = "extended";
    } else if (extensionRatio <= 1.06 || curlAngle >= 72) {
      state = "curled";
    } else if (prevState === "uncertain") {
      state = extensionRatio > 1.14 ? "extended" : "curled";
    }

    return {
      name,
      state,
      extensionRatio,
      curlAngleDeg: curlAngle,
      tip: { x: tip.x, y: tip.y, z: tip.z ?? 0 },
    };
  }

  /**
   * Thumb classification.
   * Thumb moves across the palm towards pinky MCP and outward.
   */
  private analyzeThumb(
    landmarks: Landmark3D[],
    handScale: number,
    prevState: FingerState
  ): FingerAnalysis {
    const thumbTip = landmarks[LM.THUMB_TIP];
    const thumbIp = landmarks[LM.THUMB_IP];
    const thumbMcp = landmarks[LM.THUMB_MCP];
    const pinkyMcp = landmarks[LM.PINKY_MCP];
    const wrist = landmarks[LM.WRIST];

    // Distance of thumb tip from pinky base relative to hand scale
    const distFromPinkyMcp = dist3d(thumbTip, pinkyMcp) / handScale;
    const thumbLength = dist3d(thumbTip, thumbMcp) / handScale;
    const curlAngle = curlAngleDeg(thumbMcp, thumbIp, thumbTip);

    // Check if thumb points downwards past wrist (Thumbs Down)
    const isPointingDown = thumbTip.y > wrist.y;

    let state: FingerState = prevState;
    // Hysteresis:
    if (
      curlAngle <= 52 &&
      thumbLength >= 0.60 &&
      (distFromPinkyMcp >= 0.78 || isPointingDown)
    ) {
      state = "extended";
    } else if (
      curlAngle >= 68 ||
      thumbLength <= 0.48 ||
      (distFromPinkyMcp <= 0.65 && !isPointingDown)
    ) {
      state = "curled";
    } else if (prevState === "uncertain") {
      state = distFromPinkyMcp > 0.72 || isPointingDown ? "extended" : "curled";
    }

    return {
      name: "thumb",
      state,
      extensionRatio: distFromPinkyMcp,
      curlAngleDeg: curlAngle,
      tip: { x: thumbTip.x, y: thumbTip.y, z: thumbTip.z ?? 0 },
    };
  }

  /**
   * Recognize complete gestures across 1 or 2 hands.
   */
  public evaluateGestures(
    hands: HandMetrics[],
    currentTimeMs: number = performance.now()
  ): {
    gesture: GestureId;
    action: GestureAction;
    confidence: number;
    isContinuous: boolean;
    fired: boolean;
  } {
    if (hands.length === 0 || this.isPaused) {
      this.activeGesture = "STANDBY";
      this.candidateGesture = "STANDBY";
      this.candidateStartTime = 0;
      this.gestureFired = false;
      return {
        gesture: "STANDBY",
        action: "NONE",
        confidence: 0,
        isContinuous: false,
        fired: false,
      };
    }

    // Check two-hand gestures first
    if (hands.length >= 2) {
      const h1 = hands[0];
      const h2 = hands[1];
      const p1 = h1.pinchRatios.thumbIndex < PINCH_ON;
      const p2 = h2.pinchRatios.thumbIndex < PINCH_ON;
      if (p1 && p2) {
        return this.resolveGesture("TWO_HAND_ZOOM", 95, currentTimeMs);
      }
    }

    const hand = hands[0];
    const bitmask = hand.patternBitmask;
    const pinch = hand.pinchRatios;

    // Check dynamic swipe motion
    const swipeGesture = this.detectSwipe(hand.palmCenter, currentTimeMs);
    if (swipeGesture) {
      return this.resolveGesture(swipeGesture, 92, currentTimeMs);
    }

    // If all fingers are curled into palm, prioritize closed fist
    if (bitmask === 0) {
      return this.resolveGesture("CLOSED_FIST", 96, currentTimeMs);
    }

    // Check primary Thumb-Index Pinch
    if (pinch.thumbIndex < PINCH_ON) {
      return this.resolveGesture("PINCH_INDEX", 95, currentTimeMs);
    }
    // Secondary pinches: require finger to not be curled into fist
    if (pinch.thumbMiddle < PINCH_ON && hand.fingers.middle.state !== "curled") {
      return this.resolveGesture("PINCH_MIDDLE", 93, currentTimeMs);
    }
    if (pinch.thumbRing < PINCH_ON && hand.fingers.ring.state !== "curled") {
      return this.resolveGesture("PINCH_RING", 90, currentTimeMs);
    }
    if (pinch.thumbPinky < PINCH_ON && hand.fingers.pinky.state !== "curled") {
      return this.resolveGesture("PINCH_PINKY", 90, currentTimeMs);
    }

    // Bitmask Combinations
    let rawGesture: GestureId = "STANDBY";
    let conf = hand.confidence;

    switch (bitmask) {
      case 0: // 00000: all curled
        rawGesture = "CLOSED_FIST";
        conf = 95;
        break;

      case 31: // 11111: all extended
        rawGesture = "OPEN_PALM";
        conf = 94;
        break;

      case 8: // 01000: only index extended
        rawGesture = "POINTING_INDEX";
        conf = 92;
        break;

      case 12: // 01100: index + middle extended
        rawGesture = "PEACE_VICTORY";
        conf = 93;
        break;

      case 16: { // 10000: only thumb extended
        // Distinguish Thumbs Up vs Thumbs Down based on thumb orientation
        const thumbTip = hand.fingers.thumb.tip;
        const wrist = hand.palmCenter;
        if (thumbTip.y < wrist.y - 0.04) {
          rawGesture = "THUMBS_UP";
        } else if (thumbTip.y > wrist.y + 0.04) {
          rawGesture = "THUMBS_DOWN";
        } else {
          rawGesture = "THUMBS_UP";
        }
        conf = 90;
        break;
      }

      case 14: // 01110: index + middle + ring extended
        rawGesture = "THREE_FINGERS";
        conf = 91;
        break;

      case 15: // 01111: index + middle + ring + pinky extended
        rawGesture = "FOUR_FINGERS";
        conf = 92;
        break;

      case 24: // 11000: thumb + index extended
        rawGesture = "GUN_L_SHAPE";
        conf = 88;
        break;

      case 17: // 10001: thumb + pinky extended
        rawGesture = "SHAKA";
        conf = 89;
        break;

      case 9: // 01001: index + pinky extended
        rawGesture = "ROCK_ON";
        conf = 89;
        break;

      default:
        // Handle variations (e.g. thumb uncertain with other fingers)
        if ((bitmask & 15) === 15) {
          rawGesture = "FOUR_FINGERS";
        } else if ((bitmask & 14) === 14) {
          rawGesture = "THREE_FINGERS";
        } else if ((bitmask & 12) === 12) {
          rawGesture = "PEACE_VICTORY";
        } else if ((bitmask & 8) === 8 && (bitmask & ~24) === 0) {
          rawGesture = "POINTING_INDEX";
        } else {
          rawGesture = "STANDBY";
        }
    }

    return this.resolveGesture(rawGesture, conf, currentTimeMs);
  }

  /**
   * Evaluates swipe movement from rolling palm trajectory.
   */
  private detectSwipe(
    palmCenter: { x: number; y: number },
    now: number
  ): "SWIPE_LEFT" | "SWIPE_RIGHT" | "SWIPE_UP" | "SWIPE_DOWN" | null {
    if (now - this.lastSwipeTime < this.swipeCooldownMs) {
      return null;
    }

    this.swipeHistory.push({ x: palmCenter.x, y: palmCenter.y, time: now });

    // Keep history within last 320ms
    const windowMs = 320;
    this.swipeHistory = this.swipeHistory.filter((pt) => now - pt.time <= windowMs);

    if (this.swipeHistory.length < 3) return null;

    const oldest = this.swipeHistory[0];
    const newest = this.swipeHistory[this.swipeHistory.length - 1];
    const dx = newest.x - oldest.x;
    const dy = newest.y - oldest.y;
    const dt = newest.time - oldest.time;

    if (dt < 60) return null;

    // Threshold adjusted by sensitivity
    const threshold = 0.12 * (1.6 - this.sensitivity);
    const speedX = Math.abs(dx) / (dt / 1000);
    const speedY = Math.abs(dy) / (dt / 1000);

    if (Math.abs(dx) > threshold && Math.abs(dx) > 1.6 * Math.abs(dy) && speedX > 0.4) {
      this.lastSwipeTime = now;
      this.swipeHistory = [];
      return dx > 0 ? "SWIPE_RIGHT" : "SWIPE_LEFT";
    }

    if (Math.abs(dy) > threshold && Math.abs(dy) > 1.6 * Math.abs(dx) && speedY > 0.4) {
      this.lastSwipeTime = now;
      this.swipeHistory = [];
      return dy < 0 ? "SWIPE_UP" : "SWIPE_DOWN";
    }

    return null;
  }

  /**
   * Applies temporal stability window, hold duration, debounce, and maps to action.
   */
  private resolveGesture(
    rawGesture: GestureId,
    confidence: number,
    now: number
  ): {
    gesture: GestureId;
    action: GestureAction;
    confidence: number;
    isContinuous: boolean;
    fired: boolean;
  } {
    const config = this.mappings.get(rawGesture) || {
      gestureId: rawGesture,
      displayName: rawGesture,
      action: "NONE" as GestureAction,
      defaultAction: "NONE" as GestureAction,
      enabled: true,
      isContinuous: false,
      holdDurationMs: 150,
      description: "",
    };

    if (!config.enabled) {
      return {
        gesture: rawGesture,
        action: "NONE",
        confidence,
        isContinuous: false,
        fired: false,
      };
    }

    if (config.isContinuous) {
      this.activeGesture = rawGesture;
      this.candidateGesture = rawGesture;
      return {
        gesture: rawGesture,
        action: config.action,
        confidence,
        isContinuous: true,
        fired: true,
      };
    }

    // Discrete Gesture Handling
    if (rawGesture === "STANDBY") {
      this.candidateGesture = "STANDBY";
      this.candidateStartTime = 0;
      this.gestureFired = false;
      this.activeGesture = "STANDBY";
      return {
        gesture: "STANDBY",
        action: "NONE",
        confidence: 0,
        isContinuous: false,
        fired: false,
      };
    }

    // Check candidate stability
    if (this.candidateGesture !== rawGesture) {
      this.candidateGesture = rawGesture;
      this.candidateStartTime = now;
      this.gestureFired = false;
      if (config.holdDurationMs === 0) {
        this.gestureFired = true;
        this.activeGesture = rawGesture;
        return {
          gesture: rawGesture,
          action: config.action,
          confidence,
          isContinuous: false,
          fired: true,
        };
      }
      return {
        gesture: rawGesture,
        action: "NONE",
        confidence,
        isContinuous: false,
        fired: false,
      };
    }

    const elapsed = now - this.candidateStartTime;
    const requiredHold = config.holdDurationMs ?? 150;

    if (elapsed >= requiredHold || requiredHold === 0) {
      if (!this.gestureFired) {
        this.gestureFired = true;
        this.activeGesture = rawGesture;
        return {
          gesture: rawGesture,
          action: config.action,
          confidence,
          isContinuous: false,
          fired: true,
        };
      }
      // Already fired, waiting for neutral reset
      return {
        gesture: rawGesture,
        action: "NONE",
        confidence,
        isContinuous: false,
        fired: false,
      };
    }

    return {
      gesture: rawGesture,
      action: "NONE",
      confidence,
      isContinuous: false,
      fired: false,
    };
  }

  /**
   * Performance metrics recorder.
   */
  public recordPerformanceMetrics(
    inferenceDurationMs: number,
    processingDurationMs: number
  ): PerformanceMetrics {
    const now = performance.now();
    this.totalFramesTracked++;
    this.frameTimestamps.push(now);
    this.inferenceTimes.push(inferenceDurationMs);
    this.processingTimes.push(processingDurationMs);

    // Keep last 30 frames for rolling calculations
    if (this.frameTimestamps.length > 30) {
      this.frameTimestamps.shift();
      this.inferenceTimes.shift();
      this.processingTimes.shift();
    }

    // Compute measured FPS
    let fps = 0;
    if (this.frameTimestamps.length >= 2) {
      const elapsedSec = (now - this.frameTimestamps[0]) / 1000;
      if (elapsedSec > 0) {
        fps = Math.round((this.frameTimestamps.length - 1) / elapsedSec);
      }
    }

    // Averages
    const avgInf =
      this.inferenceTimes.reduce((acc, v) => acc + v, 0) /
      Math.max(1, this.inferenceTimes.length);
    const avgProc =
      this.processingTimes.reduce((acc, v) => acc + v, 0) /
      Math.max(1, this.processingTimes.length);

    return {
      fps,
      inferenceTimeMs: Math.round(avgInf * 10) / 10,
      processingTimeMs: Math.round(avgProc * 10) / 10,
      totalFrames: this.totalFramesTracked,
      droppedFrames: this.droppedFramesCount,
    };
  }

  public recordDroppedFrame(): void {
    this.droppedFramesCount++;
  }
}
