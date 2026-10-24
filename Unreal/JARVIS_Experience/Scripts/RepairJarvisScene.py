import json
import os
import re
import struct
import traceback
import unreal

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
REPO_ROOT = os.path.abspath(os.path.join(PROJECT_DIR, "..", ".."))
GLB_PATH = os.path.join(REPO_ROOT, "public", "models", "jarvis_hologram.glb")
STATIC_GLB_PATH = os.path.join(PROJECT_DIR, "Source", "jarvis_hologram.glb")
CONTENT_PATH = "/Game/JARVIS/Assets"
MAP_PATH = "/Game/Maps/JARVIS_Experience"
REPORT_PATH = os.path.join(PROJECT_DIR, "Saved", "JARVISRepairReport.json")
JSON_CHUNK_TYPE = 0x4E4F534A


def write_report(data):
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as report_file:
        json.dump(data, report_file, indent=2)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def strip_gltf_animations(source_path, output_path):
    with open(source_path, "rb") as source_file:
        original = source_file.read()
    require(len(original) >= 20 and original[:4] == b"glTF", "Source is not a GLB 2.0 file")
    magic, version, declared_length = struct.unpack_from("<4sII", original, 0)
    require(version == 2 and declared_length <= len(original), "Unsupported or incomplete GLB source")
    chunks = []
    offset = 12
    animation_count = 0
    mesh_names = []
    nodes = []
    json_seen = False
    while offset < declared_length:
        require(offset + 8 <= declared_length, "GLB contains a truncated chunk header")
        chunk_length, chunk_type = struct.unpack_from("<II", original, offset)
        offset += 8
        chunk_end = offset + chunk_length
        require(chunk_end <= declared_length, "GLB contains a truncated chunk")
        chunk_data = original[offset:chunk_end]
        offset = chunk_end
        if chunk_type == JSON_CHUNK_TYPE:
            document = json.loads(chunk_data.rstrip(b" \t\r\n\x00").decode("utf-8"))
            animation_count = len(document.get("animations", []))
            mesh_names = [mesh.get("name", "Mesh_" + str(index)) for index, mesh in enumerate(document.get("meshes", []))]
            nodes = document.get("nodes", [])
            document.pop("animations", None)
            chunk_data = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
            chunk_data += b" " * ((4 - (len(chunk_data) % 4)) % 4)
            json_seen = True
        chunks.append((chunk_type, chunk_data))
    require(json_seen, "GLB contains no JSON chunk")
    body = b"".join(struct.pack("<II", len(data), kind) + data for kind, data in chunks)
    header = struct.pack("<4sII", magic, version, 12 + len(body))
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as output_file:
        output_file.write(header + body)
    return animation_count, mesh_names, nodes


def normalize_name(name):
    name = re.sub(r"[^A-Za-z0-9_]+", "_", name)
    name = re.sub(r"_+", "_", name).strip("_")
    return name.casefold()


try:
    require(os.path.isfile(GLB_PATH), "Existing Blender GLB was not found: " + GLB_PATH)
    animation_count, gltf_mesh_names, gltf_nodes = strip_gltf_animations(GLB_PATH, STATIC_GLB_PATH)
    require(unreal.EditorLevelLibrary.load_level(MAP_PATH), "Could not load the dedicated JARVIS map")

    task = unreal.AssetImportTask()
    task.set_editor_property("filename", STATIC_GLB_PATH)
    task.set_editor_property("destination_path", CONTENT_PATH)
    task.set_editor_property("automated", True)
    task.set_editor_property("save", True)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("replace_existing_settings", True)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])

    asset_paths = unreal.EditorAssetLibrary.list_assets(CONTENT_PATH, True, False)
    assets = [unreal.EditorAssetLibrary.load_asset(path) for path in asset_paths]
    static_meshes = [asset for asset in assets if isinstance(asset, unreal.StaticMesh)]
    require(len(static_meshes) >= 18,
            "Animation-free GLB import did not produce all expected static meshes; got " + str(len(static_meshes)))

    saved = unreal.EditorAssetLibrary.save_directory(CONTENT_PATH, False, True)
    require(saved, "Unreal did not save the JARVIS asset directory")

    mesh_by_name = {normalize_name(mesh.get_name()): mesh for mesh in static_meshes}
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
    actor_by_label = {actor.get_actor_label(): actor for actor in actors}
    assigned_components = 0
    unresolved_nodes = []
    missing_actors = []
    for node in gltf_nodes:
        mesh_index = node.get("mesh")
        if mesh_index is None or mesh_index >= len(gltf_mesh_names):
            continue
        node_name = node.get("name", "")
        mesh_name = gltf_mesh_names[mesh_index]
        actor = actor_by_label.get(node_name)
        mesh = mesh_by_name.get(normalize_name(node_name))
        if actor is None:
            missing_actors.append(node_name)
            continue
        if mesh is None:
            unresolved_nodes.append({"node": node_name, "mesh": mesh_name})
            continue
        components = actor.get_components_by_class(unreal.StaticMeshComponent)
        if not components:
            unresolved_nodes.append({"node": node_name, "mesh": mesh_name, "reason": "no static mesh component"})
            continue
        for component in components:
            component.set_editor_property("static_mesh", mesh)
            assigned_components += 1

    require(assigned_components >= 18,
            "Could not bind all GLB nodes to persistent static meshes; assigned " + str(assigned_components) +
            ", unresolved=" + repr(unresolved_nodes) + ", missing actors=" + repr(missing_actors) +
            ", available meshes=" + repr(sorted(mesh.get_name() for mesh in static_meshes)))
    require(unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level(),
            "Could not save the repaired JARVIS scene map")

    result = {
        "status": "repaired-and-saved",
        "engine": "Unreal Engine 5.8",
        "source_glb": GLB_PATH,
        "static_mesh_source": STATIC_GLB_PATH,
        "original_animation_count": animation_count,
        "expected_mesh_count": len(gltf_mesh_names),
        "static_mesh_asset_count": len(static_meshes),
        "bound_component_count": assigned_components,
        "unresolved_nodes": unresolved_nodes,
        "missing_actors": missing_actors,
        "static_mesh_paths": sorted(mesh.get_path_name() for mesh in static_meshes)
    }
    write_report(result)
    unreal.log("JARVIS scene repaired and saved: " + json.dumps(result))
except Exception as error:
    failure = {
        "status": "failed",
        "engine": "Unreal Engine 5.8",
        "source_glb": GLB_PATH,
        "static_mesh_source": STATIC_GLB_PATH,
        "error": str(error),
        "traceback": traceback.format_exc()
    }
    try:
        write_report(failure)
    except Exception:
        pass
    unreal.log_error("JARVIS scene repair failed: " + str(error))
    unreal.log_error(traceback.format_exc())
    raise

