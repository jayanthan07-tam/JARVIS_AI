import json
import os
import traceback
import unreal

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
REPO_ROOT = os.path.abspath(os.path.join(PROJECT_DIR, "..", ".."))
GLB_PATH = os.path.join(REPO_ROOT, "public", "models", "jarvis_hologram.glb")
CONTENT_PATH = "/Game/JARVIS/Assets"
REPORT_PATH = os.path.join(PROJECT_DIR, "Saved", "JARVISAssetImportReport.json")


def write_report(data):
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as report_file:
        json.dump(data, report_file, indent=2)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


try:
    require(os.path.isfile(GLB_PATH), "Existing Blender GLB was not found: " + GLB_PATH)
    require(unreal.EditorAssetLibrary.does_directory_exist(CONTENT_PATH) or
            unreal.EditorAssetLibrary.make_directory(CONTENT_PATH),
            "Could not create content destination " + CONTENT_PATH)

    task = unreal.AssetImportTask()
    task.set_editor_property("filename", GLB_PATH)
    task.set_editor_property("destination_path", CONTENT_PATH)
    task.set_editor_property("automated", True)
    task.set_editor_property("save", True)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("replace_existing_settings", True)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])

    imported_paths = task.get_editor_property("imported_object_paths")
    asset_paths = unreal.EditorAssetLibrary.list_assets(CONTENT_PATH, True, False)
    assets = [unreal.EditorAssetLibrary.load_asset(path) for path in asset_paths]
    meshes = [asset for asset in assets if isinstance(asset, unreal.StaticMesh)]
    require(len(meshes) >= 18,
            "GLB asset import did not produce all expected static meshes; got " + str(len(meshes)))

    saved = unreal.EditorAssetLibrary.save_directory(CONTENT_PATH, False, True)
    require(saved, "Unreal did not save the JARVIS asset directory")
    result = {
        "status": "assets-imported-and-saved",
        "engine": "Unreal Engine 5.8",
        "glb_source": GLB_PATH,
        "destination": CONTENT_PATH,
        "imported_object_count": len(imported_paths),
        "asset_count": len(asset_paths),
        "static_mesh_count": len(meshes),
        "imported_object_paths": imported_paths,
        "static_mesh_paths": sorted(mesh.get_path_name() for mesh in meshes)
    }
    write_report(result)
    unreal.log("JARVIS asset persistence completed: " + json.dumps(result))
except Exception as error:
    failure = {
        "status": "failed",
        "engine": "Unreal Engine 5.8",
        "glb_source": GLB_PATH,
        "error": str(error),
        "traceback": traceback.format_exc()
    }
    try:
        write_report(failure)
    except Exception:
        pass
    unreal.log_error("JARVIS asset persistence failed: " + str(error))
    unreal.log_error(traceback.format_exc())
    raise
