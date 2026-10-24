import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import type { OrbSceneApi } from "./orbScene";
import { PerformanceManager, type QualityPreset, type QualitySettings } from "./performanceManager";

export interface HologramPerformanceMetrics {
  fps: number;
  frameTimeMs: number;
  cpuFrameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  materials: number;
  textures: number;
  shaders: number;
  postProcessingEnabled: boolean;
}

export interface HologramSceneCallbacks {
  onLoad?: () => void;
  onProgress?: (progressPercent: number) => void;
  onError?: (error: Error) => void;
  onPerformanceUpdate?: (metrics: HologramPerformanceMetrics) => void;
}

export interface HologramSceneApi extends OrbSceneApi {
  toggleAnimations(play?: boolean): boolean;
  getPerformanceMetrics(): HologramPerformanceMetrics;
}

function countSceneMaterials(root: THREE.Object3D): number {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const material = (object as THREE.Mesh).material;
    if (Array.isArray(material)) {
      material.forEach((entry) => materials.add(entry));
    } else if (material) {
      materials.add(material);
    }
  });
  return materials.size;
}

// Visual reference matches original Orb scene framing
const HOME_POSITION = new THREE.Vector3(0, 0.45, 5.5);
const MIN_DISTANCE = 1.0;
const MAX_DISTANCE = 35.0;

export function createHologramScene(
  container: HTMLElement,
  modelUrl: string = "/models/jarvis_hologram.glb",
  callbacks?: HologramSceneCallbacks
): HologramSceneApi {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  let isDisposed = false;
  let animFrameId = 0;
  let mixer: THREE.AnimationMixer | null = null;
  let isAnimationPlaying = true;
  let hologramRoot: THREE.Group | null = null;
  const wrapperGroup = new THREE.Group();

  // Performance Manager integration
  const perfManager = PerformanceManager.getInstance();
  let currentSettings = perfManager.getSettings();
  let isSubtle = false;
  let lastSubtleRenderTime = 0;
  let lastReducedMotion = perfManager.isReducedMotion();
  isAnimationPlaying = !lastReducedMotion;

  // Performance tracking metrics
  let lastFpsUpdateTime = performance.now();
  let frameCount = 0;
  const currentMetrics: HologramPerformanceMetrics = {
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
  };

  // 1. Scene & Perspective Camera (Matching original Orb layout)
  const scene = new THREE.Scene();
  scene.background = null; // Transparent to preserve CSS ambient vignette & scanlines

  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 500);
  camera.position.copy(HOME_POSITION);
  camera.lookAt(0, 0, 0);

  // 2. WebGL Renderer; requestAnimationFrame follows the display's refresh schedule.
  const renderer = new THREE.WebGLRenderer({
    antialias: currentSettings.antialiasing,
    alpha: true,
    powerPreference: "high-performance",
  });
  // Accumulate every composer pass so diagnostics report the full frame workload.
  renderer.info.autoReset = false;
  renderer.setSize(width, height);
  renderer.setPixelRatio(currentSettings.pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82; // Matches original Orb exposure
  container.appendChild(renderer.domElement);

  // 3. Post-Processing Pipeline (Controlled, Non-Overexposed Holographic Glow)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // High threshold (0.45) ensures only genuine emissive accents glow,
  // preventing concentric rings and core from blurring into a solid cyan blob
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    currentSettings.bloomStrength,
    currentSettings.bloomRadius,
    0.45  // High threshold prevents blown-out haze
  );
  bloomPass.enabled = currentSettings.bloomEnabled;
  composer.addPass(bloomPass);

  // Holographic Color Grading & Subtle Scanline Shader
  const holographicGradeShader = {
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uIntensity: { value: 0.0015 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        vec2 dir = vUv - vec2(0.5);
        float d = length(dir);
        vec2 offset = dir * (d * uIntensity);

        vec4 colR = texture2D(tDiffuse, vUv + offset);
        vec4 colG = texture2D(tDiffuse, vUv);
        vec4 colB = texture2D(tDiffuse, vUv - offset * 0.7);

        // Tech cyan/electric blue tint
        vec3 tinted = vec3(colR.r * 0.8, colG.g * 1.04, colB.b * 1.25);
        gl_FragColor = vec4(tinted, colG.a);
      }
    `,
  };
  const gradePass = new ShaderPass(holographicGradeShader);
  composer.addPass(gradePass);

  // 4. Interactive Orbit Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.04;
  controls.minDistance = MIN_DISTANCE;
  controls.maxDistance = MAX_DISTANCE;
  controls.zoomSpeed = 1.3;
  controls.enablePan = false;
  controls.target.set(0, 0, 0);

  // 5. Ambient & Accent Lighting Fallback
  const ambientLight = new THREE.AmbientLight(0x001830, 1.0);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0x00f0ff, 1.8);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x0055ff, 1.2);
  fillLight.position.set(-3, -2, 3);
  scene.add(fillLight);

  // Wrapper group centered in scene
  scene.add(wrapperGroup);

  // Subtle floating background dust particles
  const particleCount = 120;
  const particleGeo = new THREE.BufferGeometry();
  const particlePos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount * 3; i += 3) {
    particlePos[i] = (Math.random() - 0.5) * 12;
    particlePos[i + 1] = (Math.random() - 0.5) * 12;
    particlePos[i + 2] = (Math.random() - 0.5) * 6;
  }
  particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0x0090ea,
    size: 0.025,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // 6. Asynchronous GLTF/GLB Loader with Bounding Box Normalization
  const loader = new GLTFLoader();
  loader.load(
    modelUrl,
    (gltf) => {
      if (isDisposed) {
        gltf.scene.traverse((obj) => {
          const renderable = obj as THREE.Mesh;
          renderable.geometry?.dispose();
          const materials = Array.isArray(renderable.material)
            ? renderable.material
            : renderable.material
              ? [renderable.material]
              : [];
          for (const material of materials) {
            for (const value of Object.values(material)) {
              if (value instanceof THREE.Texture) value.dispose();
            }
            material.dispose();
          }
        });
        return;
      }

      hologramRoot = gltf.scene;

      // ── Bounding Box Normalization & Centering ──
      // Calculate exact bounding box to normalize scale and center the model
      const bbox = new THREE.Box3().setFromObject(hologramRoot);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      bbox.getCenter(center);
      bbox.getSize(size);

      // Center model geometry at local origin (0, 0, 0)
      hologramRoot.position.set(-center.x, -center.y, -center.z);

      // Target footprint: 3.7 units diameter
      // Matches the original J.A.R.V.I.S. Orb's exact visual footprint (radius ~1.85, diameter 3.7)
      // leaving comfortable padding from left CORE TELEMETRY, right VIEWPORT DIRECTIVES, and bottom command bar
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const TARGET_SIZE = 3.7;
        const scaleFactor = TARGET_SIZE / maxDim;
        hologramRoot.scale.setScalar(scaleFactor);
      }

      // Stand upright facing camera with a dramatic 18-degree forward holographic tilt
      hologramRoot.rotation.x = -Math.PI * 0.40;

      // ── Material Calibration (Restoring Ring Contrast, Wireframe Core & Edges) ──
      hologramRoot.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.frustumCulled = true;

          if (mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              if (m instanceof THREE.MeshStandardMaterial) {
                m.transparent = true;
                m.depthWrite = true;

                const matName = (m.name || "").toLowerCase();
                const meshName = (mesh.name || "").toLowerCase();

                // High-contrast holographic hierarchy:
                if (meshName.includes("core_sphere") || matName.includes("whitehot")) {
                  // Central core nucleus: delicate geometric wireframe with white-hot nucleus
                  m.wireframe = true;
                  m.emissive = new THREE.Color(0x80f7ff);
                  m.emissiveIntensity = 1.8;
                  m.opacity = 0.95;
                } else if (meshName.includes("core_cage")) {
                  // Outer cage: crisp wireframe cyan lattice
                  m.wireframe = true;
                  m.emissive = new THREE.Color(0x00f0ff);
                  m.emissiveIntensity = 1.4;
                  m.opacity = 0.9;
                } else if (meshName.includes("orbitalring")) {
                  // Orbital confinement rings: thin electric blue
                  m.emissive = new THREE.Color(0x0088ff);
                  m.emissiveIntensity = 1.0;
                  m.opacity = 0.85;
                } else if (matName.includes("blue") || meshName.includes("ring2") || meshName.includes("ring5")) {
                  // Electric blue rings: dark tech body with glowing cyan-blue edges
                  m.emissive = new THREE.Color(0x0077ff);
                  m.emissiveIntensity = 0.9;
                  m.opacity = 0.82;
                  m.roughness = 0.25;
                  m.metalness = 0.7;
                } else if (matName.includes("radar") || meshName.includes("radar")) {
                  // Radar sweep beam: delicate translucent fan
                  m.emissive = new THREE.Color(0x00a8cc);
                  m.emissiveIntensity = 0.65;
                  m.opacity = 0.22;
                  m.roughness = 0.4;
                } else if (matName.includes("navy") || meshName.includes("rangering")) {
                  // Radar range circle: deep subtle navy boundary
                  m.emissive = new THREE.Color(0x003366);
                  m.emissiveIntensity = 0.45;
                  m.opacity = 0.55;
                } else {
                  // Cyan rings (notched cog, gimbal gyro, corner brackets)
                  m.emissive = new THREE.Color(0x00f0ff);
                  m.emissiveIntensity = 1.1;
                  m.opacity = 0.85;
                  m.roughness = 0.2;
                  m.metalness = 0.6;
                }
              }
            });
          }
        }
      });

      wrapperGroup.add(hologramRoot);

      // Animation Setup
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(hologramRoot);
        gltf.animations.forEach((clip) => {
          const action = mixer?.clipAction(clip);
          if (action) {
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = false;
            action.play();
          }
        });
      }

      callbacks?.onLoad?.();
    },
    (xhr) => {
      if (xhr.total > 0 && callbacks?.onProgress) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        callbacks.onProgress(percent);
      }
    },
    (err) => {
      console.error("[JARVIS Hologram] Failed to load GLB model:", err);
      callbacks?.onError?.(
        err instanceof Error ? err : new Error(String(err) || "Failed to load hologram GLB")
      );
    }
  );

  // ═══════════════════════════════════════════════
  // ADAPTIVE QUALITY SUBSCRIPTION
  // ═══════════════════════════════════════════════
  const unsubQuality = perfManager.onQualityChange((settings) => {
    currentSettings = settings;
    renderer.setPixelRatio(settings.pixelRatio);
    bloomPass.strength = settings.bloomStrength;
    bloomPass.radius = settings.bloomRadius;
    bloomPass.enabled = settings.bloomEnabled;
    gradePass.enabled = settings.chromaticAberration;
    particleGeo.setDrawRange(0, Math.min(particleCount, settings.particleCount));

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
  });

  // 7. Render Loop with Continuous Delta-Time Rotation & Performance Guard
  const timer = new THREE.Timer();
  timer.connect(document);

  function animate() {
    if (isDisposed) return;

    const now = performance.now();
    timer.update(now);

    // Halt heavy rendering when tab is hidden
    if (perfManager.isHidden()) {
      setTimeout(() => {
        if (!isDisposed) animFrameId = requestAnimationFrame(animate);
      }, 500);
      return;
    }

    // Background throttle if UI modal is active
    perfManager.sampleDisplayFrame(now);
    const prefersReducedMotion = perfManager.isReducedMotion();
    if (prefersReducedMotion !== lastReducedMotion) {
      lastReducedMotion = prefersReducedMotion;
      isAnimationPlaying = !prefersReducedMotion;
    }
    const minimumRenderInterval = Math.max(
      isSubtle ? 33 : 0,
      prefersReducedMotion ? 1000 / 15 : 0
    );
    if (minimumRenderInterval > 0 && now - lastSubtleRenderTime < minimumRenderInterval) {
      animFrameId = requestAnimationFrame(animate);
      return;
    }
    lastSubtleRenderTime = now;

    animFrameId = requestAnimationFrame(animate);

    const delta = Math.min(timer.getDelta(), 0.05);
    const elapsedTime = timer.getElapsed();

    // Update embedded animations or run procedural rotation fallback
    if (!prefersReducedMotion && mixer && isAnimationPlaying) {
      mixer.update(delta);
    } else if (!prefersReducedMotion && hologramRoot && isAnimationPlaying) {
      // Lightweight procedural rotation fallback if GLB animations are missing
      hologramRoot.rotation.z += delta * 0.3;
      hologramRoot.children.forEach((child, idx) => {
        const dir = idx % 2 === 0 ? 1 : -1;
        child.rotation.z += delta * dir * 0.12;
      });
    }

    // Subtle continuous idle hover drift for the whole holographic projection
    if (!prefersReducedMotion && isAnimationPlaying) {
      wrapperGroup.rotation.y = Math.sin(elapsedTime * 0.5) * 0.06;
    }

    // Subtle drift for dust particles
    if (!prefersReducedMotion) particles.rotation.z = elapsedTime * 0.015;

    // Update shader time uniform if pass is active
    if (!prefersReducedMotion && currentSettings.chromaticAberration) {
      gradePass.uniforms.uTime.value = elapsedTime;
    }

    // Orbit controls update
    controls.update(delta);

    // Render pass execution: bypass composer when post-processing is disabled.
    renderer.info.reset();
    if (currentSettings.bloomEnabled || currentSettings.chromaticAberration) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
    const cpuFrameTimeMs = performance.now() - now;
    const postProcessingEnabled =
      currentSettings.bloomEnabled || currentSettings.chromaticAberration;
    const renderMetrics = {
      ...renderer.info.render,
      geometries: renderer.info.memory.geometries,
      materials: countSceneMaterials(scene),
      textures: renderer.info.memory.textures,
      shaders: renderer.info.programs?.length ?? 0,
      cpuFrameTimeMs,
      postProcessingEnabled,
    };

    // Record the full composer workload and the measured CPU frame interval.
    frameCount++;
    perfManager.recordFrame(now, renderMetrics);

    const elapsedFpsInterval = now - lastFpsUpdateTime;
    if (elapsedFpsInterval >= 500) {
      currentMetrics.fps = Math.round((frameCount * 1000) / elapsedFpsInterval);
      currentMetrics.frameTimeMs = Math.round((elapsedFpsInterval / frameCount) * 10) / 10;
      currentMetrics.cpuFrameTimeMs = Math.round(cpuFrameTimeMs * 10) / 10;
      currentMetrics.drawCalls = renderer.info.render.calls;
      currentMetrics.triangles = renderer.info.render.triangles;
      currentMetrics.geometries = renderer.info.memory.geometries;
      currentMetrics.materials = renderMetrics.materials;
      currentMetrics.textures = renderMetrics.textures;
      currentMetrics.shaders = renderMetrics.shaders;
      currentMetrics.postProcessingEnabled = postProcessingEnabled;

      callbacks?.onPerformanceUpdate?.({ ...currentMetrics });
      frameCount = 0;
      lastFpsUpdateTime = now;
    }
  }

  animFrameId = requestAnimationFrame(animate);

  // 8. Responsive Window Resize Listener
  const onResize = () => {
    if (isDisposed || !container) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  // 9. API Object
  const api: HologramSceneApi = {
    rotateBy(deltaTheta: number, deltaPhi: number) {
      const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += deltaTheta;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi + deltaPhi));
      spherical.makeSafe();
      camera.position.setFromSpherical(spherical).add(controls.target);
      controls.update();
    },

    zoomBy(factor: number) {
      const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
      const newLen = THREE.MathUtils.clamp(
        offset.length() * factor,
        MIN_DISTANCE,
        MAX_DISTANCE
      );
      offset.setLength(newLen);
      camera.position.copy(controls.target).add(offset);
      controls.update();
    },

    zoomIn() {
      api.zoomBy(0.85);
    },

    zoomOut() {
      api.zoomBy(1.18);
    },

    resetView() {
      camera.position.copy(HOME_POSITION);
      controls.target.set(0, 0, 0);
      controls.update();
    },

    toggleAnimations(play?: boolean) {
      isAnimationPlaying = typeof play === "boolean" ? play : !isAnimationPlaying;
      return isAnimationPlaying;
    },

    getPerformanceMetrics() {
      return { ...currentMetrics };
    },

    setQualityPreset(preset: QualityPreset) {
      perfManager.setMode(preset);
    },

    setSubtleMode(subtle: boolean) {
      isSubtle = subtle;
      perfManager.setBackgroundThrottled(subtle);
    },

    dispose() {
      isDisposed = true;
      cancelAnimationFrame(animFrameId);
      unsubQuality();
      window.removeEventListener("resize", onResize);
      timer.dispose();

      if (mixer) {
        mixer.stopAllAction();
        mixer.uncacheRoot(mixer.getRoot());
        mixer = null;
      }

      if (hologramRoot) {
        hologramRoot.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose());
            } else if (mesh.material) {
              mesh.material.dispose();
            }
          }
        });
        wrapperGroup.remove(hologramRoot);
        hologramRoot = null;
      }

      particleGeo.dispose();
      particleMat.dispose();

      composer.dispose();
      renderer.dispose();
      controls.dispose();

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };

  return api;
}
