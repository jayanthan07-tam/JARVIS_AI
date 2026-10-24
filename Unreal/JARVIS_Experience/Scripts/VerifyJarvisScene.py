import json
import os
import traceback
import unreal

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
REPORT_PATH = os.path.join(PROJECT_DIR, "Saved", "JARVISVerifyReport.json")
MAP_PATH = "/Game/Maps/JARVIS_Experience"


def write_report(data):
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as report_file:
        json.dump(data, report_file, indent=2)


try:
    if not unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
        raise RuntimeError("JARVIS map is missing: " + MAP_PATH)
    if not unreal.EditorLevelLibrary.load_level(MAP_PATH):
        raise RuntimeError("Could not load JARVIS map: " + MAP_PATH)
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    actors = subsystem.get_all_level_actors()
    mesh_components = []
    camera_count = 0
    point_light_count = 0
    labels = []
    for actor in actors:
        labels.append(actor.get_actor_label())
        mesh_components.extend(actor.get_components_by_class(unreal.StaticMeshComponent))
        camera_count += int(actor.get_component_by_class(unreal.CameraComponent) is not None)
        point_light_count += int(actor.get_component_by_class(unreal.PointLightComponent) is not None)
    mesh_paths = []
    missing_mesh_count = 0
    for component in mesh_components:
        mesh = component.get_editor_property("static_mesh")
        if mesh is None:
            missing_mesh_count += 1
        else:
            mesh_paths.append(mesh.get_path_name())
    if len(mesh_paths) < 1 or camera_count < 1:
        raise RuntimeError("JARVIS map loaded, but its GLB meshes or preview camera are missing")
    if missing_mesh_count:
        raise RuntimeError("JARVIS map has static mesh components with unresolved mesh assets")
    result = {
        "status": "verified-loaded",
        "engine": "Unreal Engine 5.8",
        "map": MAP_PATH,
        "actor_count": len(actors),
        "static_mesh_component_count": len(mesh_components),
        "resolved_mesh_component_count": len(mesh_paths),
        "unique_mesh_asset_count": len(set(mesh_paths)),
        "mesh_asset_paths": sorted(set(mesh_paths)),
        "camera_count": camera_count,
        "point_light_count": point_light_count,
        "actor_labels": labels
    }
    write_report(result)
    unreal.log("JARVIS map loaded and verified: " + json.dumps(result))
except Exception as error:
    failure = {
        "status": "failed",
        "engine": "Unreal Engine 5.8",
        "map": MAP_PATH,
        "error": str(error),
        "traceback": traceback.format_exc()
    }
    try:
        write_report(failure)
    except Exception:
        pass
    unreal.log_error("JARVIS scene verification failed: " + str(error))
    unreal.log_error(traceback.format_exc())
    raise
