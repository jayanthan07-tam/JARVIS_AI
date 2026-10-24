import {
  GestureEngine,
  LM,
  dist3d,
  DEFAULT_MAPPINGS,
  type Landmark3D,
} from "../lib/gestureEngine.ts";
import type { HandednessType } from "../lib/gestureTypes.ts";

function createMockHand(options: {
  thumb?: boolean;
  index?: boolean;
  middle?: boolean;
  ring?: boolean;
  pinky?: boolean;
  pinchIndex?: boolean;
  pinchMiddle?: boolean;
  thumbDirection?: "up" | "down" | "side";
  wristOffset?: { x: number; y: number };
}): Landmark3D[] {
  const ox = options.wristOffset?.x ?? 0.5;
  const oy = options.wristOffset?.y ?? 0.7;

  // Hand scale: wrist to middle MCP = 0.2 units
  const wrist: Landmark3D = { x: ox, y: oy, z: 0 };
  const middleMcp: Landmark3D = { x: ox, y: oy - 0.2, z: 0 };
  const indexMcp: Landmark3D = { x: ox - 0.05, y: oy - 0.19, z: 0 };
  const ringMcp: Landmark3D = { x: ox + 0.04, y: oy - 0.18, z: 0 };
  const pinkyMcp: Landmark3D = { x: ox + 0.08, y: oy - 0.16, z: 0 };

  // Thumb
  const thumbCmc: Landmark3D = { x: ox - 0.04, y: oy - 0.06, z: 0 };
  const thumbMcp: Landmark3D = { x: ox - 0.08, y: oy - 0.11, z: 0 };
  let thumbIp: Landmark3D = { x: ox - 0.11, y: oy - 0.15, z: 0 };
  let thumbTip: Landmark3D;

  if (options.pinchIndex) {
    thumbTip = { x: ox - 0.05, y: oy - 0.36, z: 0 }; // touches index tip
  } else if (options.pinchMiddle) {
    thumbTip = { x: ox, y: oy - 0.38, z: 0 }; // touches middle tip
  } else if (options.thumbDirection === "up") {
    thumbIp = { x: ox - 0.08, y: oy - 0.20, z: 0 };
    thumbTip = { x: ox - 0.08, y: oy - 0.28, z: 0 }; // pointing straight up
  } else if (options.thumbDirection === "down") {
    thumbIp = { x: ox - 0.08, y: oy - 0.02, z: 0 };
    thumbTip = { x: ox - 0.08, y: oy + 0.06, z: 0 }; // pointing downward
  } else if (options.thumb) {
    thumbTip = { x: ox - 0.15, y: oy - 0.18, z: 0 }; // abducted extended
  } else {
    thumbTip = { x: ox + 0.02, y: oy - 0.12, z: 0 }; // curled across palm
  }

  // Fingers helper
  function makeFinger(mcp: Landmark3D, extended: boolean) {
    if (extended) {
      const pip = { x: mcp.x, y: mcp.y - 0.06, z: 0 };
      const dip = { x: mcp.x, y: mcp.y - 0.12, z: 0 };
      const tip = { x: mcp.x, y: mcp.y - 0.18, z: 0 };
      return { pip, dip, tip };
    } else {
      // curled: tip curls back down towards palm
      const pip = { x: mcp.x, y: mcp.y - 0.05, z: 0.02 };
      const dip = { x: mcp.x, y: mcp.y - 0.02, z: 0.04 };
      const tip = { x: mcp.x, y: mcp.y + 0.02, z: 0.03 };
      return { pip, dip, tip };
    }
  }

  const idx = makeFinger(indexMcp, Boolean(options.index || options.pinchIndex));
  if (options.pinchIndex) {
    idx.tip = { x: ox - 0.05, y: oy - 0.36, z: 0 };
  }
  const mid = makeFinger(middleMcp, Boolean(options.middle || options.pinchMiddle));
  if (options.pinchMiddle) {
    mid.tip = { x: ox, y: oy - 0.38, z: 0 };
  }
  const rng = makeFinger(ringMcp, Boolean(options.ring));
  const pnk = makeFinger(pinkyMcp, Boolean(options.pinky));

  const landmarks: Landmark3D[] = new Array(21);
  landmarks[LM.WRIST] = wrist;
  landmarks[LM.THUMB_CMC] = thumbCmc;
  landmarks[LM.THUMB_MCP] = thumbMcp;
  landmarks[LM.THUMB_IP] = thumbIp;
  landmarks[LM.THUMB_TIP] = thumbTip;

  landmarks[LM.INDEX_MCP] = indexMcp;
  landmarks[LM.INDEX_PIP] = idx.pip;
  landmarks[LM.INDEX_DIP] = idx.dip;
  landmarks[LM.INDEX_TIP] = idx.tip;

  landmarks[LM.MIDDLE_MCP] = middleMcp;
  landmarks[LM.MIDDLE_PIP] = mid.pip;
  landmarks[LM.MIDDLE_DIP] = mid.dip;
  landmarks[LM.MIDDLE_TIP] = mid.tip;

  landmarks[LM.RING_MCP] = ringMcp;
  landmarks[LM.RING_PIP] = rng.pip;
  landmarks[LM.RING_DIP] = rng.dip;
  landmarks[LM.RING_TIP] = rng.tip;

  landmarks[LM.PINKY_MCP] = pinkyMcp;
  landmarks[LM.PINKY_PIP] = pnk.pip;
  landmarks[LM.PINKY_DIP] = pnk.dip;
  landmarks[LM.PINKY_TIP] = pnk.tip;

  return landmarks;
}

async function runTests() {
  console.log("==================================================");
  console.log("J.A.R.V.I.S. GESTURE RECOGNITION ENGINE TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, extra = "") {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc} ${extra}`);
      failed++;
    }
  }

  const engine = new GestureEngine();

  // Test 1: Open Palm (11111)
  console.log("TEST GROUP 1: Five-Finger Articulation & Bitmask (Open Palm)");
  {
    const lm = createMockHand({
      thumb: true,
      index: true,
      middle: true,
      ring: true,
      pinky: true,
    });
    const hand = engine.analyzeHand(lm, "Right", 95);
    assert("Thumb classified as extended", hand.fingers.thumb.state === "extended", `got ${hand.fingers.thumb.state}`);
    assert("Index classified as extended", hand.fingers.index.state === "extended", `got ${hand.fingers.index.state}`);
    assert("Middle classified as extended", hand.fingers.middle.state === "extended", `got ${hand.fingers.middle.state}`);
    assert("Ring classified as extended", hand.fingers.ring.state === "extended", `got ${hand.fingers.ring.state}`);
    assert("Pinky classified as extended", hand.fingers.pinky.state === "extended", `got ${hand.fingers.pinky.state}`);
    assert("Pattern bitmask is 31 (0b11111)", hand.patternBitmask === 31, `got ${hand.patternBitmask}`);
    assert("Pattern string is '11111'", hand.patternString === "11111", `got ${hand.patternString}`);

    // Hold for stability
    engine.evaluateGestures([hand], 1000);
    const evalResult = engine.evaluateGestures([hand], 1250);
    assert("Recognized gesture is OPEN_PALM", evalResult.gesture === "OPEN_PALM", `got ${evalResult.gesture}`);
    assert("Action mapped to WAKE_HOME", evalResult.action === "WAKE_HOME", `got ${evalResult.action}`);
  }

  // Test 2: Closed Fist (00000)
  console.log("\nTEST GROUP 2: Closed Fist (00000)");
  {
    engine.resetCalibration();
    const lm = createMockHand({
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
    });
    const hand = engine.analyzeHand(lm, "Right", 95);
    assert("Thumb curled", hand.fingers.thumb.state === "curled", `got ${hand.fingers.thumb.state}`);
    assert("Index curled", hand.fingers.index.state === "curled", `got ${hand.fingers.index.state}`);
    assert("Middle curled", hand.fingers.middle.state === "curled", `got ${hand.fingers.middle.state}`);
    assert("Ring curled", hand.fingers.ring.state === "curled", `got ${hand.fingers.ring.state}`);
    assert("Pinky curled", hand.fingers.pinky.state === "curled", `got ${hand.fingers.pinky.state}`);
    assert("Pattern bitmask is 0 (0b00000)", hand.patternBitmask === 0, `got ${hand.patternBitmask}`);

    engine.evaluateGestures([hand], 2000);
    const evalResult = engine.evaluateGestures([hand], 2300);
    assert("Recognized gesture is CLOSED_FIST", evalResult.gesture === "CLOSED_FIST", `got ${evalResult.gesture}`);
    assert("Action mapped to PAUSE_LOCK", evalResult.action === "PAUSE_LOCK", `got ${evalResult.action}`);
  }

  // Test 3: Pointing Index (01000)
  console.log("\nTEST GROUP 3: Pointing Index (01000)");
  {
    engine.resetCalibration();
    const lm = createMockHand({
      thumb: false,
      index: true,
      middle: false,
      ring: false,
      pinky: false,
    });
    const hand = engine.analyzeHand(lm, "Right", 95);
    assert("Index extended", hand.fingers.index.state === "extended");
    assert("Pattern bitmask is 8 (0b01000)", hand.patternBitmask === 8, `got ${hand.patternBitmask}`);

    engine.evaluateGestures([hand], 3000);
    const evalResult = engine.evaluateGestures([hand], 3200);
    assert("Recognized gesture is POINTING_INDEX", evalResult.gesture === "POINTING_INDEX", `got ${evalResult.gesture}`);
  }

  // Test 4: Peace / Victory (01100)
  console.log("\nTEST GROUP 4: Two-Finger Combination (Peace / Victory - 01100)");
  {
    engine.resetCalibration();
    const lm = createMockHand({
      thumb: false,
      index: true,
      middle: true,
      ring: false,
      pinky: false,
    });
    const hand = engine.analyzeHand(lm, "Right", 95);
    assert("Pattern bitmask is 12 (0b01100)", hand.patternBitmask === 12, `got ${hand.patternBitmask}`);

    engine.evaluateGestures([hand], 4000);
    const evalResult = engine.evaluateGestures([hand], 4250);
    assert("Recognized gesture is PEACE_VICTORY", evalResult.gesture === "PEACE_VICTORY", `got ${evalResult.gesture}`);
    assert("Action mapped to SCROLL_UP", evalResult.action === "SCROLL_UP", `got ${evalResult.action}`);
  }

  // Test 5: Three Fingers (01110) & Four Fingers (01111)
  console.log("\nTEST GROUP 5: Three and Four Finger Combinations");
  {
    engine.resetCalibration();
    const lm3 = createMockHand({
      thumb: false,
      index: true,
      middle: true,
      ring: true,
      pinky: false,
    });
    const hand3 = engine.analyzeHand(lm3, "Right", 95);
    assert("Three fingers bitmask is 14 (0b01110)", hand3.patternBitmask === 14, `got ${hand3.patternBitmask}`);

    engine.evaluateGestures([hand3], 5000);
    const eval3 = engine.evaluateGestures([hand3], 5250);
    assert("Recognized gesture is THREE_FINGERS", eval3.gesture === "THREE_FINGERS", `got ${eval3.gesture}`);

    engine.resetCalibration();
    const lm4 = createMockHand({
      thumb: false,
      index: true,
      middle: true,
      ring: true,
      pinky: true,
    });
    const hand4 = engine.analyzeHand(lm4, "Right", 95);
    assert("Four fingers bitmask is 15 (0b01111)", hand4.patternBitmask === 15, `got ${hand4.patternBitmask}`);

    engine.evaluateGestures([hand4], 6000);
    const eval4 = engine.evaluateGestures([hand4], 6250);
    assert("Recognized gesture is FOUR_FINGERS", eval4.gesture === "FOUR_FINGERS", `got ${eval4.gesture}`);
  }

  // Test 6: Thumbs Up and Thumbs Down Orientation
  console.log("\nTEST GROUP 6: Thumbs Up / Thumbs Down Orientation Detection");
  {
    engine.resetCalibration();
    const lmUp = createMockHand({
      thumb: true,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
      thumbDirection: "up",
    });
    const handUp = engine.analyzeHand(lmUp, "Right", 95);
    assert("Pattern bitmask is 16 (0b10000)", handUp.patternBitmask === 16, `got ${handUp.patternBitmask}`);

    engine.evaluateGestures([handUp], 7000);
    const evalUp = engine.evaluateGestures([handUp], 7250);
    assert("Recognized gesture is THUMBS_UP", evalUp.gesture === "THUMBS_UP", `got ${evalUp.gesture}`);
    assert("Action mapped to SELECT_CONFIRM", evalUp.action === "SELECT_CONFIRM", `got ${evalUp.action}`);

    engine.resetCalibration();
    const lmDown = createMockHand({
      thumb: true,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
      thumbDirection: "down",
    });
    const handDown = engine.analyzeHand(lmDown, "Right", 95);
    engine.evaluateGestures([handDown], 8000);
    const evalDown = engine.evaluateGestures([handDown], 8250);
    assert("Recognized gesture is THUMBS_DOWN", evalDown.gesture === "THUMBS_DOWN", `got ${evalDown.gesture}`);
  }

  // Test 7: Pinch Detection & Continuous Orb Spin
  console.log("\nTEST GROUP 7: Pinch Detection & Continuous Controls");
  {
    engine.resetCalibration();
    const lmPinch = createMockHand({
      pinchIndex: true,
      middle: false,
      ring: false,
      pinky: false,
    });
    const handPinch = engine.analyzeHand(lmPinch, "Right", 95);
    assert("Thumb-index pinch ratio < 0.32", handPinch.pinchRatios.thumbIndex < 0.32, `got ${handPinch.pinchRatios.thumbIndex}`);

    const evalPinch = engine.evaluateGestures([handPinch], 9000);
    assert("Recognized gesture is PINCH_INDEX", evalPinch.gesture === "PINCH_INDEX", `got ${evalPinch.gesture}`);
    assert("Is continuous control", evalPinch.isContinuous === true);
    assert("Mapped to ROTATE_ORB", evalPinch.action === "ROTATE_ORB", `got ${evalPinch.action}`);
  }

  // Test 8: Two-Hand Zoom
  console.log("\nTEST GROUP 8: Two-Hand Distance / Pinch Zoom");
  {
    engine.resetCalibration();
    const lm1 = createMockHand({ pinchIndex: true, wristOffset: { x: 0.3, y: 0.6 } });
    const lm2 = createMockHand({ pinchIndex: true, wristOffset: { x: 0.7, y: 0.6 } });
    const h1 = engine.analyzeHand(lm1, "Left", 95);
    const h2 = engine.analyzeHand(lm2, "Right", 95);

    const evalZoom = engine.evaluateGestures([h1, h2], 10000);
    assert("Recognized two-hand zoom", evalZoom.gesture === "TWO_HAND_ZOOM", `got ${evalZoom.gesture}`);
    assert("Action is ZOOM_ORB", evalZoom.action === "ZOOM_ORB", `got ${evalZoom.action}`);
    assert("Is continuous mode", evalZoom.isContinuous === true);
  }

  // Test 9: Directional Swipes (Left / Right)
  console.log("\nTEST GROUP 9: Directional Swipe Motion & Debounce");
  {
    engine.resetCalibration();
    // Simulate moving hand across camera to the right: x decreases in video coords, increases in mirrored HUD coords
    const frames = [
      { x: 0.7, y: 0.5, t: 11000 },
      { x: 0.55, y: 0.5, t: 11070 },
      { x: 0.38, y: 0.5, t: 11140 },
      { x: 0.22, y: 0.5, t: 11210 },
    ];

    let swipeResult = null;
    for (const f of frames) {
      const lm = createMockHand({
        thumb: true,
        index: true,
        middle: true,
        ring: true,
        pinky: true,
        wristOffset: { x: f.x, y: f.y },
      });
      const hand = engine.analyzeHand(lm, "Right", 95);
      const res = engine.evaluateGestures([hand], f.t);
      if (res.gesture.startsWith("SWIPE")) {
        swipeResult = res;
      }
    }
    assert("Detected SWIPE_RIGHT motion", swipeResult !== null && swipeResult.gesture === "SWIPE_RIGHT", `got ${swipeResult?.gesture}`);
    assert("Action mapped to SWITCH_PANEL_NEXT", swipeResult?.action === "SWITCH_PANEL_NEXT", `got ${swipeResult?.action}`);
  }

  // Test 10: False Detection Prevention & Neutral Reset
  console.log("\nTEST GROUP 10: False Detections, Hold Stability & Neutral Reset");
  {
    engine.resetCalibration();
    const lmFist = createMockHand({ thumb: false, index: false, middle: false, ring: false, pinky: false });
    const handFist = engine.analyzeHand(lmFist, "Right", 95);

    // Initial frame: should NOT fire immediately (requires 220ms hold)
    const resImmediate = engine.evaluateGestures([handFist], 12000);
    assert("Does not fire on frame 1 without stability hold", resImmediate.fired === false);

    // After 100ms: still not reached 220ms hold
    const resMid = engine.evaluateGestures([handFist], 12100);
    assert("Does not fire during intermediate hold window", resMid.fired === false);

    // After 240ms: fires once!
    const resFired = engine.evaluateGestures([handFist], 12240);
    assert("Fires exactly once after required hold duration", resFired.fired === true && resFired.gesture === "CLOSED_FIST");

    // Next frame while still holding fist: does NOT fire again (preventing command flood)
    const resHeld = engine.evaluateGestures([handFist], 12300);
    assert("Does NOT refire continuously while held (neutral reset enforced)", resHeld.fired === false);

    // Return to neutral / standby
    const lmOpen = createMockHand({ thumb: true, index: true, middle: true, ring: true, pinky: true });
    const handOpen = engine.analyzeHand(lmOpen, "Right", 95);
    engine.evaluateGestures([handOpen], 12400);

    // Hand leaves frame (hand loss handling)
    const resLoss = engine.evaluateGestures([], 12500);
    assert("Hand loss resets active gesture to STANDBY", resLoss.gesture === "STANDBY");
  }

  // Test 11: Real Performance Metrics Tracking
  console.log("\nTEST GROUP 11: Real Performance Metrics Tracking");
  {
    for (let i = 0; i < 15; i++) {
      engine.recordPerformanceMetrics(8.5, 12.0);
    }
    const metrics = engine.recordPerformanceMetrics(9.0, 13.0);
    assert("Recorded frames > 0", metrics.totalFrames > 0, `got ${metrics.totalFrames}`);
    assert("Inference latency measured (~8-9ms)", metrics.inferenceTimeMs > 0 && metrics.inferenceTimeMs < 15, `got ${metrics.inferenceTimeMs}ms`);
  }

  // Test 12: Dynamic Mapping Table Updates
  console.log("\nTEST GROUP 12: Dynamic Mapping Reconfiguration");
  {
    engine.updateMapping("OPEN_PALM", { action: "SYSTEM_DIAGNOSTIC", enabled: true });
    const updated = engine.getMappings().find((m) => m.gestureId === "OPEN_PALM");
    assert("Dynamically updated OPEN_PALM action", updated?.action === "SYSTEM_DIAGNOSTIC", `got ${updated?.action}`);

    // Disable a mapping
    engine.updateMapping("OPEN_PALM", { enabled: false });
    const disabled = engine.getMappings().find((m) => m.gestureId === "OPEN_PALM");
    assert("Disabled OPEN_PALM mapping", disabled?.enabled === false);
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runTests();
