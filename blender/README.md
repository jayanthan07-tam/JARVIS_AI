# J.A.R.V.I.S. 3D Holographic Interface — Blender System

Welcome to the **J.A.R.V.I.S. AI Hologram Generator**, an Iron Man-inspired 3D holographic interface built for integration with Next.js, React, TypeScript, and Three.js.

This module uses Blender's Python API (`bpy`) to procedurally create, animate, and export a high-tech sci-fi holographic system complete with concentric rings, an Arc Reactor-style glowing AI core, radar sweeps, and tactical HUD elements.

---

## 1. Directory Structure

```text
blender/
├── jarvis_hologram.py     # Main Blender Python scene & animation generation script
├── detect_blender.py      # Standalone Windows executable detection utility
├── README.md              # Documentation, setup, and troubleshooting (this file)
└── output/                # Generated 3D project & export assets
    ├── jarvis_hologram.blend   # Native Blender 3D scene file
    └── jarvis_hologram.glb     # Web-ready glTF 2.0 binary asset (~350 KB)
```

The exported asset is automatically synchronized to:
`public/models/jarvis_hologram.glb` for immediate delivery through the Next.js static asset pipeline.

---

## 2. Requirements & Blender Installation on Windows

To run the generator, Blender 4.0 or newer (tested on **Blender 5.2.1 LTS**) is required.

### Automatic Detection
The generator script automatically locates Blender on Windows by checking:
1. `BLENDER_PATH` environment variable.
2. System `PATH`.
3. Windows Registry (`HKLM` and `HKCU` uninstall keys and App Paths).
4. Standard installation directories:
   - `C:\Program Files\Blender Foundation\Blender <version>\blender.exe`
   - `D:\Blender\blender.exe` or `C:\Blender\blender.exe`
   - `%LOCALAPPDATA%\Programs\Blender Foundation\`
   - Steam common library paths.

### If Blender is NOT installed:
Install it on Windows using one of the following methods:

#### Method A: Windows Package Manager (Winget — Recommended)
Open PowerShell and run:
```powershell
winget install BlenderFoundation.Blender
```

#### Method B: Official Installer
Download the Windows installer from [blender.org/download](https://www.blender.org/download/) and run the setup.

#### Method C: Custom Path Configuration
If you have Blender installed in a custom location, specify the path before running:
```powershell
$env:BLENDER_PATH = "D:\Your\Path\To\blender.exe"
```

---

## 3. How to Run the Hologram Generator

### Option 1: Via Python (Auto-detects Blender and runs headlessly)
```powershell
python blender/jarvis_hologram.py
```
*or test detection first:*
```powershell
python blender/detect_blender.py
```

### Option 2: Via npm Script
```powershell
npm run generate:hologram
```

### Option 3: Directly via Blender CLI
```powershell
& "D:\Blender\blender.exe" --background --python blender/jarvis_hologram.py
```

---

## 4. Hologram Scene Architecture

The scene is designed to replicate Tony Stark's holographic lab interface:

1. **Central AI Core**:
   - **Nuclear Core Sphere**: Emissive white-hot sphere (`#bfefff`) with a breathing sinusoidal scale pulse (1.00 &rarr; 1.14 &rarr; 1.00).
   - **Outer Energy Cage**: Polyhedral wireframe cage counter-rotating across X and Z axes.
   - **Gimbal Confinement Rings**: Dual tilted orbital rings rotating along diagonal harmonic planes.

2. **Concentric Rotating Hologram Rings**:
   - **Ring 1: Arc Reactor Cog Reticle (Radius 1.35)**: 16-tooth notched gear ring rotating 360° clockwise.
   - **Ring 2: Tactical Data Arcs (Radius 1.90)**: 4 curved HUD visor segments rotating 360° counter-clockwise.
   - **Ring 3: Gimbal Gyro Ring (Radius 2.35)**: Tilted by 24° on the X-axis, rotating 720° over the loop.
   - **Ring 4: Radar Range Circle & Sweep Beam (Radius 2.80)**: Emissive radar fan sweeping 720° (2 sweeps per cycle).
   - **Ring 5: Outer Datum Ring (Radius 3.35)**: Segmented outer horizon ring with degree markers.

3. **Animated HUD Elements**:
   - **4 Corner L-Brackets**: Positioned at `(±2.5, ±2.5)` with vertical hover oscillation (Z-axis floating).
   - **Telemetry Data Markers**: Diamond/prism data nodes orbiting along the concentric rings.

4. **Looping & Keyframing**:
   - Exactly **120 frames at 30 FPS** (4.00-second loop).
   - All rotational channels are set to `LINEAR` interpolation, ensuring a perfectly seamless, stutter-free loop when played continuously in Three.js.

5. **Color Palette**:
   - **Stark Cyan**: `rgba(0, 240, 255, 0.9)` with emission strength 7.0
   - **Electric Blue**: `rgba(5, 122, 255, 0.85)` with emission strength 4.5
   - **White-Hot Core**: `rgba(191, 250, 255, 1.0)` with emission strength 12.0
   - **Dark Tactical Navy**: `rgba(3, 30, 90, 0.5)` with emission strength 2.0
   - **Tactical Amber Accent**: `rgba(255, 180, 25, 0.95)` with emission strength 6.0

---

## 5. Hardware Optimization (AMD Radeon 840M & 16 GB RAM)

This scene is specifically optimized for laptops with AMD Radeon 840M integrated graphics (RDNA 3.5 architecture) and shared system memory:

- **Lightweight Geometry**: The entire model comprises under **10,000 vertices** across all rings and core components.
- **Micro Asset Footprint**: Exported `.glb` is only **~350 KB**, loading in milliseconds over localhost or web.
- **Offline Generation**: Blender executes strictly as an offline asset compilation step. No Blender processes run during Next.js client requests or server rendering.
- **Real-Time Performance Profiling**: The frontend component measures actual client-side frame-time and FPS using `requestAnimationFrame`, rendering without heavy geometry overhead.

---

## 6. Frontend Integration

The exported model is rendered in Next.js using a dedicated component:
[`components/JarvisHologram3D.tsx`](../components/JarvisHologram3D.tsx)

Key features:
- **Three.js `GLTFLoader`** loads `/models/jarvis_hologram.glb` asynchronously.
- **`AnimationMixer`** plays all embedded Blender animations simultaneously in an infinite loop (`THREE.LoopRepeat`).
- **Cyberpunk Loading State**: Displays a technical scanline progress bar while the model compiles into GPU memory.
- **Graceful Error Handling & Fallback**: If the asset is missing, a holographic error banner with manual reload and procedural fallback is provided.
- **Interactive Orbit & Gesture Controls**: Connects with hand tracking (`HandTracker`) and keyboard shortcuts (`+`, `-`, `R`) to rotate and zoom the hologram in 3D space.
- **Clean Disposal**: Disposes geometries, materials, lights, and animation mixers on component unmount to prevent WebGL memory leaks.

---

## 7. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `Blender executable not found` | Blender is not in PATH or standard folders | Run `python blender/detect_blender.py` or set `$env:BLENDER_PATH = "D:\Path\To\blender.exe"` |
| `GLB not updating on website` | Asset was not copied to public directory | Run `python blender/jarvis_hologram.py` to regenerate and sync to `public/models/` |
| `AttributeError: Action has no attribute fcurves` | Blender 5.0+ changed animation action system | The script includes a universal helper supporting both Blender 5.x layered actions and legacy 4.x fcurves |
| `CORS error loading GLB` | Serving outside of public folder | Always serve the model from `/models/jarvis_hologram.glb` via Next.js static asset routing |
