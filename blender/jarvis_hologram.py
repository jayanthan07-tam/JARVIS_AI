"""
Blender Hologram Generator for J.A.R.V.I.S. AI
Generates an Iron Man-inspired 3D holographic interface with:
- Concentric rotating cyan & electric-blue rings facing the viewport
- Central glowing AI core with breathing pulse and polyhedral cage
- Radar scanning sweep and range rings
- Animated HUD sci-fi elements (cardinal brackets, telemetry pips)
- Clean, optimized geometry matching the exact visual footprint of the original Orb
- Seamless 120-frame (4.0s @ 30fps) loopable animations
- Native .blend project save and web-compatible .glb export
"""

import sys
import os
import math
import shutil

# If executed directly with standard python, auto-detect Blender and run headless
if "bpy" not in sys.modules:
    import subprocess
    import glob
    import winreg

    def find_blender():
        env_path = os.environ.get("BLENDER_PATH")
        if env_path and os.path.isfile(env_path):
            return env_path, "BLENDER_PATH env"

        which = shutil.which("blender")
        if which:
            return which, "System PATH"

        candidates = [
            r"C:\Program Files\Blender Foundation\Blender *\blender.exe",
            r"C:\Program Files (x86)\Blender Foundation\Blender *\blender.exe",
            r"D:\Blender\blender.exe",
            r"D:\Blender*\blender.exe",
            r"C:\Blender*\blender.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\Blender Foundation\Blender *\blender.exe"),
            os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WindowsApps\blender.exe"),
            r"C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe",
            r"D:\SteamLibrary\steamapps\common\Blender\blender.exe",
        ]
        for pat in candidates:
            for match in glob.glob(pat):
                if os.path.isfile(match):
                    return match, "Standard Path"

        for root in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
            for sub in (r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
                        r"Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall"):
                try:
                    with winreg.OpenKey(root, sub) as k:
                        for i in range(winreg.QueryInfoKey(k)[0]):
                            try:
                                sk_name = winreg.EnumKey(k, i)
                                with winreg.OpenKey(k, sk_name) as sk:
                                    dname, _ = winreg.QueryValueEx(sk, "DisplayName")
                                    if "blender" in dname.lower():
                                        loc, _ = winreg.QueryValueEx(sk, "InstallLocation")
                                        bpath = os.path.join(loc, "blender.exe")
                                        if os.path.isfile(bpath):
                                            return bpath, "Windows Registry"
                            except Exception:
                                pass
                except Exception:
                    pass
        return None, None

    blender_bin, src = find_blender()
    if not blender_bin:
        print("\n" + "="*70)
        print("ERROR: Blender executable could not be automatically located on Windows.")
        print("="*70)
        sys.exit(1)

    script_path = os.path.abspath(__file__)
    cmd = [blender_bin, "--background", "--python", script_path]
    res = subprocess.run(cmd)
    sys.exit(res.returncode)

# -------------------------------------------------------------
# Inside Blender's Python Runtime (bpy)
# -------------------------------------------------------------
from typing import Any

try:
    import bpy  # pyrefly: ignore[missing-import] # type: ignore
except ImportError:
    # Fallback typing stub for external Python linters and IDE language servers (Pyrefly, Pylance, etc.)
    bpy: Any = None  # type: ignore


def set_linear_interpolation(obj):
    """Ensure all keyframes on the object use linear interpolation for seamless looping."""
    if not obj or not obj.animation_data or not obj.animation_data.action:
        return
    act = obj.animation_data.action
    if hasattr(act, "fcurves"):
        for fc in act.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"
    if hasattr(act, "layers"):
        for layer in act.layers:
            for strip in getattr(layer, "strips", []):
                for cb in getattr(strip, "channelbags", []):
                    for fc in getattr(cb, "fcurves", []):
                        for kp in fc.keyframe_points:
                            kp.interpolation = "LINEAR"

def create_hologram_material(name, color_rgba, emission_strength=1.5, alpha=0.85):
    """Create a physically-based holographic emissive material compatible with glTF 2.0."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat.blend_method = "BLEND" if alpha < 1.0 else "OPAQUE"
    nodes = mat.node_tree.nodes
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    output.location = (300, 0)
    principled.location = (0, 0)

    if "Base Color" in principled.inputs:
        principled.inputs["Base Color"].default_value = color_rgba

    if "Emission Color" in principled.inputs:
        principled.inputs["Emission Color"].default_value = color_rgba
    elif "Emission" in principled.inputs:
        principled.inputs["Emission"].default_value = color_rgba

    if "Emission Strength" in principled.inputs:
        principled.inputs["Emission Strength"].default_value = emission_strength

    if "Roughness" in principled.inputs:
        principled.inputs["Roughness"].default_value = 0.2
    if "Alpha" in principled.inputs:
        principled.inputs["Alpha"].default_value = alpha

    mat.node_tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    return mat

def create_mesh_object(name, verts, faces, mat=None):
    """Utility to build a clean mesh object from vertex and face lists."""
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj

def build_segmented_ring(name, inner_r, outer_r, segments=4, gap_deg=18.0, seg_res=24, mat=None):
    """Build a segmented arc ring (vertical XY plane facing camera)."""
    verts = []
    faces = []
    tot_span = 360.0 / segments
    arc_span = tot_span - gap_deg
    v_idx = 0

    for s in range(segments):
        start_deg = s * tot_span + gap_deg / 2.0
        for step in range(seg_res + 1):
            deg = start_deg + (step / seg_res) * arc_span
            rad = math.radians(deg)
            cos_a = math.cos(rad)
            sin_a = math.sin(rad)
            # Built on XY plane so rings stand vertically facing camera
            verts.append((inner_r * cos_a, inner_r * sin_a, 0.0))
            verts.append((outer_r * cos_a, outer_r * sin_a, 0.0))
            if step > 0:
                p0 = v_idx - 2
                p1 = v_idx - 1
                p2 = v_idx + 1
                p3 = v_idx
                faces.append([p0, p1, p2, p3])
            v_idx += 2

    return create_mesh_object(name, verts, faces, mat)

def build_notched_cog_ring(name, inner_r, outer_r, notch_r, teeth=12, mat=None):
    """Build an Arc Reactor notched cog ring with technical cutouts."""
    verts = []
    faces = []
    step_deg = 360.0 / teeth
    v_idx = 0

    for i in range(teeth):
        base_deg = i * step_deg
        angles = [
            base_deg,
            base_deg + step_deg * 0.25,
            base_deg + step_deg * 0.75,
            base_deg + step_deg
        ]
        for a_deg, r_out in zip(angles, [notch_r, outer_r, outer_r, notch_r]):
            rad = math.radians(a_deg)
            verts.append((inner_r * math.cos(rad), inner_r * math.sin(rad), 0.0))
            verts.append((r_out * math.cos(rad), r_out * math.sin(rad), 0.0))
            if v_idx > 0:
                faces.append([v_idx - 2, v_idx - 1, v_idx + 1, v_idx])
            v_idx += 2

    faces.append([v_idx - 2, v_idx - 1, 1, 0])
    return create_mesh_object(name, verts, faces, mat)

def build_radar_sweep_fan(name, inner_r, outer_r, sweep_deg=35.0, steps=16, mat=None):
    """Build a radar sweep sector fan showing the active radar scanner."""
    verts = []
    faces = []
    v_idx = 0
    for i in range(steps + 1):
        t = i / steps
        rad = math.radians(t * sweep_deg)
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)
        verts.append((inner_r * cos_a, inner_r * sin_a, 0.0))
        verts.append((outer_r * cos_a, outer_r * sin_a, 0.0))
        if i > 0:
            faces.append([v_idx - 2, v_idx - 1, v_idx + 1, v_idx])
        v_idx += 2
    return create_mesh_object(name, verts, faces, mat)

def build_corner_hud_bracket(name, size=0.25, thickness=0.02, mat=None):
    """Build an L-shaped HUD corner bracket."""
    verts = [
        (0.0, 0.0, 0.0),
        (size, 0.0, 0.0),
        (size, thickness, 0.0),
        (thickness, thickness, 0.0),
        (thickness, size, 0.0),
        (0.0, size, 0.0),
    ]
    faces = [
        [0, 1, 2, 3],
        [0, 3, 4, 5]
    ]
    return create_mesh_object(name, verts, faces, mat)

def generate_scene():
    print("[JARVIS] Initializing refined holographic 3D scene generation...")

    # 1. Reset Scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 120   # 120 frames @ 30 FPS = exact 4.0s loop
    scene.render.fps = 30

    # 2. Calibrated Holographic Palette (Matching original J.A.R.V.I.S. Orb contrast)
    # Emission strengths kept moderate (0.5 to 2.2) so UnrealBloomPass produces a crisp aura rather than a solid cyan blob
    mat_cyan_bright = create_hologram_material("Mat_Holo_Cyan", (0.0, 0.94, 1.0, 1.0), emission_strength=1.5, alpha=0.85)
    mat_blue_electric = create_hologram_material("Mat_Holo_Blue", (0.02, 0.48, 1.0, 1.0), emission_strength=1.1, alpha=0.80)
    mat_core_whitehot = create_hologram_material("Mat_Holo_WhiteHot", (0.85, 0.98, 1.0, 1.0), emission_strength=2.4, alpha=0.95)
    mat_radar_fan = create_hologram_material("Mat_Radar_Sweep", (0.0, 0.85, 1.0, 0.22), emission_strength=0.8, alpha=0.22)
    mat_deep_navy = create_hologram_material("Mat_Deep_Navy", (0.01, 0.08, 0.24, 0.5), emission_strength=0.4, alpha=0.5)
    mat_amber_accent = create_hologram_material("Mat_Amber_Accent", (1.0, 0.65, 0.1, 1.0), emission_strength=1.4, alpha=0.9)

    # ---------------------------------------------------------
    # 3. Central AI Core (Dimensions calibrated to match Orb core)
    # ---------------------------------------------------------
    # 3a. Central Glowing Nucleus (Small, crisp, white-hot)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.24, location=(0, 0, 0))
    core_sphere = bpy.context.object
    core_sphere.name = "JARVIS_AI_Core_Sphere"
    core_sphere.data.materials.append(mat_core_whitehot)

    # Breathing scale pulse keyframing (frame 1 -> 60 -> 121)
    core_sphere.scale = (1.0, 1.0, 1.0)
    core_sphere.keyframe_insert(data_path="scale", frame=1)
    core_sphere.scale = (1.12, 1.12, 1.12)
    core_sphere.keyframe_insert(data_path="scale", frame=60)
    core_sphere.scale = (1.0, 1.0, 1.0)
    core_sphere.keyframe_insert(data_path="scale", frame=121)
    set_linear_interpolation(core_sphere)

    # 3b. Outer Core Wireframe Polyhedral Cage
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.42, location=(0, 0, 0))
    core_cage = bpy.context.object
    core_cage.name = "JARVIS_AI_Core_Cage"
    wire_mod = core_cage.modifiers.new(name="Wireframe", type='WIREFRAME')
    wire_mod.thickness = 0.010
    core_cage.data.materials.append(mat_cyan_bright)

    # Core cage rotation (X & Z axes counter-rotation)
    core_cage.rotation_euler = (0, 0, 0)
    core_cage.keyframe_insert(data_path="rotation_euler", frame=1)
    core_cage.rotation_euler = (math.tau, 0, -math.tau)
    core_cage.keyframe_insert(data_path="rotation_euler", frame=121)
    set_linear_interpolation(core_cage)

    # 3c. Core Confinement Rings (2 tilted orbital rings)
    for idx, (tilt_x, tilt_y, rot_dir) in enumerate([(math.radians(35), 0, 1), (-math.radians(35), math.radians(20), -1)]):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.55,
            minor_radius=0.010,
            major_segments=48,
            minor_segments=8,
            location=(0, 0, 0)
        )
        orb_ring = bpy.context.object
        orb_ring.name = f"JARVIS_Core_OrbitalRing_{idx+1}"
        orb_ring.rotation_euler = (tilt_x, tilt_y, 0)
        orb_ring.data.materials.append(mat_cyan_bright if idx == 0 else mat_blue_electric)

        orb_ring.keyframe_insert(data_path="rotation_euler", frame=1, index=2)
        orb_ring.rotation_euler = (tilt_x, tilt_y, rot_dir * math.tau)
        orb_ring.keyframe_insert(data_path="rotation_euler", frame=121, index=2)
        set_linear_interpolation(orb_ring)

    # ---------------------------------------------------------
    # 4. Concentric Holographic Rings (Distinct dark orbital gaps)
    # ---------------------------------------------------------
    # Ring 1: Arc Reactor Notched Cog Ring (Radius 0.78 - 0.90)
    cog_ring = build_notched_cog_ring("JARVIS_Ring1_NotchedCog", inner_r=0.78, outer_r=0.90, notch_r=0.84, teeth=16, mat=mat_cyan_bright)
    cog_ring.rotation_euler = (0, 0, 0)
    cog_ring.keyframe_insert(data_path="rotation_euler", frame=1, index=2)
    cog_ring.rotation_euler = (0, 0, math.tau)  # 360 clockwise
    cog_ring.keyframe_insert(data_path="rotation_euler", frame=121, index=2)
    set_linear_interpolation(cog_ring)

    # Ring 2: Segmented Data Arcs (Radius 1.12 - 1.22, 4 curved arcs with 24 deg gaps)
    seg_ring = build_segmented_ring("JARVIS_Ring2_DataArcs", inner_r=1.12, outer_r=1.22, segments=4, gap_deg=24.0, mat=mat_blue_electric)
    seg_ring.rotation_euler = (0, 0, 0)
    seg_ring.keyframe_insert(data_path="rotation_euler", frame=1, index=2)
    seg_ring.rotation_euler = (0, 0, -math.tau)  # 360 counter-clockwise
    seg_ring.keyframe_insert(data_path="rotation_euler", frame=121, index=2)
    set_linear_interpolation(seg_ring)

    # Ring 3: Gimbal Gyro Ring (Radius 1.42) Tilted at 24 degrees
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.42,
        minor_radius=0.012,
        major_segments=64,
        minor_segments=8,
        location=(0, 0, 0)
    )
    gimbal_ring = bpy.context.object
    gimbal_ring.name = "JARVIS_Ring3_GimbalGyro"
    gimbal_ring.rotation_euler = (math.radians(24), 0, 0)
    gimbal_ring.data.materials.append(mat_cyan_bright)
    gimbal_ring.keyframe_insert(data_path="rotation_euler", frame=1, index=2)
    gimbal_ring.rotation_euler = (math.radians(24), 0, math.tau * 2)  # 720 deg rotation
    gimbal_ring.keyframe_insert(data_path="rotation_euler", frame=121, index=2)
    set_linear_interpolation(gimbal_ring)

    # Ring 4: Radar Scanning Disk & Sweep Beam (Radius 1.65)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.65,
        minor_radius=0.010,
        major_segments=72,
        minor_segments=8,
        location=(0, 0, 0)
    )
    radar_ring = bpy.context.object
    radar_ring.name = "JARVIS_Ring4_RadarRangeRing"
    radar_ring.data.materials.append(mat_deep_navy)

    # Radar Sweep Fan (subtle translucent fan)
    sweep_fan = build_radar_sweep_fan("JARVIS_Radar_SweepBeam", inner_r=0.35, outer_r=1.65, sweep_deg=35.0, steps=16, mat=mat_radar_fan)
    sweep_fan.rotation_euler = (0, 0, 0)
    sweep_fan.keyframe_insert(data_path="rotation_euler", frame=1, index=2)
    sweep_fan.rotation_euler = (0, 0, math.tau * 2)  # Sweeps 720 deg
    sweep_fan.keyframe_insert(data_path="rotation_euler", frame=121, index=2)
    set_linear_interpolation(sweep_fan)

    # Ring 5: Outer Datum Ring with Segmented Brackets (Radius 1.84 - 1.94, outer diameter = 3.88)
    outer_datum = build_segmented_ring("JARVIS_Ring5_OuterDatum", inner_r=1.84, outer_r=1.94, segments=8, gap_deg=14.0, mat=mat_blue_electric)
    outer_datum.rotation_euler = (0, 0, 0)
    outer_datum.keyframe_insert(data_path="rotation_euler", frame=1, index=2)
    outer_datum.rotation_euler = (0, 0, math.tau)  # 360 deg
    outer_datum.keyframe_insert(data_path="rotation_euler", frame=121, index=2)
    set_linear_interpolation(outer_datum)

    # ---------------------------------------------------------
    # 5. Animated HUD Elements (Cardinal Brackets & Orbiting Pips)
    # ---------------------------------------------------------
    bracket_positions = [
        ("TopRight", 1.45, 1.45, 0),
        ("TopLeft", -1.45, 1.45, 90),
        ("BottomLeft", -1.45, -1.45, 180),
        ("BottomRight", 1.45, -1.45, 270),
    ]
    for b_name, bx, by, rot_z in bracket_positions:
        bracket = build_corner_hud_bracket(f"JARVIS_HUD_Bracket_{b_name}", size=0.24, thickness=0.018, mat=mat_cyan_bright)
        bracket.location = (bx, by, 0.02)
        bracket.rotation_euler = (0, 0, math.radians(rot_z))

        bracket.keyframe_insert(data_path="location", frame=1, index=2)
        bracket.location = (bx, by, 0.06)
        bracket.keyframe_insert(data_path="location", frame=60, index=2)
        bracket.location = (bx, by, 0.02)
        bracket.keyframe_insert(data_path="location", frame=121, index=2)
        set_linear_interpolation(bracket)

    # Orbiting Telemetry Data Nodes
    for n_idx in range(4):
        ang = (n_idx / 4.0) * math.tau
        nx = 1.30 * math.cos(ang)
        ny = 1.30 * math.sin(ang)
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.035, radius2=0.0, depth=0.07, location=(nx, ny, 0.01))
        node = bpy.context.object
        node.name = f"JARVIS_HUD_Node_{n_idx+1}"
        node.data.materials.append(mat_amber_accent if n_idx % 2 == 0 else mat_cyan_bright)

        node.rotation_euler = (0, 0, 0)
        node.keyframe_insert(data_path="rotation_euler", frame=1, index=2)
        node.rotation_euler = (0, 0, -math.tau)
        node.keyframe_insert(data_path="rotation_euler", frame=121, index=2)
        set_linear_interpolation(node)

    # ---------------------------------------------------------
    # 6. Save .blend and Export .glb
    # ---------------------------------------------------------
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, "output")
    os.makedirs(output_dir, exist_ok=True)

    blend_file = os.path.join(output_dir, "jarvis_hologram.blend")
    glb_file = os.path.join(output_dir, "jarvis_hologram.glb")

    bpy.ops.wm.save_as_mainfile(filepath=blend_file)
    print(f"[JARVIS] Native .blend project saved: {blend_file}")

    # Export Web-Compatible GLB without overpowering scene lights
    bpy.ops.export_scene.gltf(
        filepath=glb_file,
        export_format='GLB',
        export_animations=True,
        export_frame_range=True,
        export_frame_step=1,
        export_force_sampling=True,
        export_materials='EXPORT',
        export_lights=False,  # Three.js provides delicate holographic lighting
        export_cameras=False,
        export_yup=True,
    )
    print(f"[JARVIS] Web-compatible .glb exported: {glb_file}")

    # Copy to public/models for instant Next.js serving
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    public_models_dir = os.path.join(project_root, "public", "models")
    os.makedirs(public_models_dir, exist_ok=True)
    public_glb_target = os.path.join(public_models_dir, "jarvis_hologram.glb")
    shutil.copyfile(glb_file, public_glb_target)
    print(f"[JARVIS] Synchronized GLB to Next.js public directory: {public_glb_target}")

if __name__ == "__main__":
    generate_scene()
