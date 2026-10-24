export type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";

export type FingerState = "extended" | "curled" | "uncertain";

export interface FingerAnalysis {
  name: FingerName;
  state: FingerState;
  /** Normalized extension ratio (typically > 1.25 when extended, < 0.95 when curled) */
  extensionRatio: number;
  /** Angle between MCP-PIP and PIP-TIP segments in degrees */
  curlAngleDeg: number;
  /** Normalized tip coordinates */
  tip: { x: number; y: number; z: number };
}

export type HandednessType = "Left" | "Right" | "Unknown";

export interface HandMetrics {
  handedness: HandednessType;
  /** 5 independent finger states */
  fingers: Record<FingerName, FingerAnalysis>;
  /** 5-bit binary representation: thumb(16) | index(8) | middle(4) | ring(2) | pinky(1) */
  patternBitmask: number;
  /** Binary pattern string (e.g. "11111", "01000") */
  patternString: string;
  /** Palm centroid coordinates in mirrored normalized space */
  palmCenter: { x: number; y: number; z: number };
  /** Palm facing orientation */
  palmFacing: "camera" | "away" | "side";
  /** Normal vector of palm surface */
  palmNormal: { x: number; y: number; z: number };
  /** Scale-independent pinch ratios relative to hand scale */
  pinchRatios: {
    thumbIndex: number;
    thumbMiddle: number;
    thumbRing: number;
    thumbPinky: number;
  };
  /** Hand scale in 3D coordinate units (wrist to middle MCP) */
  handScale: number;
  /** MediaPipe presence/tracking confidence (0..100) */
  confidence: number;
}

export type GestureId =
  | "STANDBY"
  | "OPEN_PALM"
  | "CLOSED_FIST"
  | "POINTING_INDEX"
  | "PEACE_VICTORY"
  | "THUMBS_UP"
  | "THUMBS_DOWN"
  | "PINCH_INDEX"
  | "PINCH_MIDDLE"
  | "PINCH_RING"
  | "PINCH_PINKY"
  | "THREE_FINGERS"
  | "FOUR_FINGERS"
  | "ROCK_ON"
  | "GUN_L_SHAPE"
  | "SHAKA"
  | "SWIPE_LEFT"
  | "SWIPE_RIGHT"
  | "SWIPE_UP"
  | "SWIPE_DOWN"
  | "TWO_HAND_ZOOM";

export type GestureAction =
  | "NONE"
  | "WAKE_HOME"
  | "SELECT_CONFIRM"
  | "SWITCH_PANEL_NEXT"
  | "SWITCH_PANEL_PREV"
  | "SCROLL_UP"
  | "SCROLL_DOWN"
  | "PAUSE_LOCK"
  | "SYSTEM_DIAGNOSTIC"
  | "VOICE_ACTIVATION"
  | "ROTATE_ORB"
  | "ZOOM_ORB";

export interface GestureMappingConfig {
  gestureId: GestureId;
  displayName: string;
  action: GestureAction;
  defaultAction: GestureAction;
  enabled: boolean;
  isContinuous: boolean;
  holdDurationMs: number;
  description: string;
}

export interface PerformanceMetrics {
  /** Measured camera processing frames per second */
  fps: number;
  /** Measured MediaPipe inference time in milliseconds */
  inferenceTimeMs: number;
  /** Overall frame loop processing latency in milliseconds */
  processingTimeMs: number;
  /** Total frames tracked in session */
  totalFrames: number;
  /** Dropped/skipped frame count */
  droppedFrames: number;
}
