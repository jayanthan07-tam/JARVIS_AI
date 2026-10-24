import json
import os
import traceback
import unreal

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
REPO_ROOT = os.path.abspath(os.path.join(PROJECT_DIR, "..", ".."))
GLB_PATH = os.path.join(REPO_ROOT, "public", "models", "jarvis_hologram.glb")
REPORT_PATH = os.path.join(PROJECT_DIR, "Saved", "JARVISBuildReport.json")
MAP_PATH = "/Game/Maps/JARVIS_Experience"
CONTENT_PATH = "/Game/JARVIS/Assets"


def write_report(data):
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as report_file:
        json.dump(data, report_file, indent=2)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def ensure_directory(path):
    if unreal.EditorAssetLibrary.does_directory_exist(path):
        return
    created = unreal.EditorAssetLibrary.make_directory(path)
    require(created or unreal.EditorAssetLibrary.does_directory_exist(path), "Could not create " + path)

def make_light(label, location, color, intensity, radius):
    light_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.PointLight, location, unreal.Rotator(0.0, 0.0, 0.0)
    )
    require(light_actor is not None, "Failed to spawn light: " + label)
    light_actor.set_actor_label(label)
    component = light_actor.get_component_by_class(unreal.PointLightComponent)
    require(component is not None, "Point light component missing: " + label)
    component.set_editor_property("light_color", color)
    component.set_editor_property("intensity", intensity)
    component.set_editor_property("attenuation_radius", radius)
    return light_actor


def inspect_scene():
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    actors = subsystem.get_all_level_actors()
    mesh_components = []
    camera_count = 0
    light_count = 0
    labels = []
    for actor in actors:
        labels.append(actor.get_actor_label())
        mesh_components.extend(actor.get_components_by_class(unreal.StaticMeshComponent))
        if actor.get_component_by_class(unreal.CameraComponent) is not None:
            camera_count += 1
        if actor.get_component_by_class(unreal.PointLightComponent) is not None:
            light_count += 1
    return actors, mesh_components, camera_count, light_count, labels


try:
    require(os.path.isfile(GLB_PATH), "Existing Blender GLB was not found: " + GLB_PATH)
    ensure_directory("/Game/Maps")
    ensure_directory("/Game/JARVIS/Assets")

    if unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
        require(unreal.EditorLevelLibrary.load_level(MAP_PATH), "Could not open existing JARVIS map")
        actors, meshes, cameras, lights, labels = inspect_scene()
        if len(meshes) >= 1 and cameras >= 1:
            result = {
                "status": "already-built-and-opened",
                "engine": "Unreal Engine 5.8",
                "map": MAP_PATH,
                "glb_source": GLB_PATH,
                "actor_count": len(actors),
                "static_mesh_component_count": len(meshes),
                "camera_count": cameras,
                "point_light_count": lights,
                "actor_labels": labels
            }
            write_report(result)
            unreal.log("JARVIS scene already exists; opened and verified without overwriting it.")
        else:
            known_defaults = {"WorldSettings", "DefaultPhysicsVolume"}
            unexpected = [label for label in labels if label not in known_defaults]
            require(not meshes and cameras == 0 and lights == 0 and not unexpected,
                    "The existing map is incomplete and contains actors; it was left untouched: " + repr(labels))
    else:
        require(unreal.EditorLevelLibrary.new_level(MAP_PATH), "Could not create the dedicated JARVIS level")

    if not (unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH) and
            (len(inspect_scene()[1]) >= 1 and inspect_scene()[2] >= 1)):
        world = unreal.EditorLevelLibrary.get_editor_world()
        require(world is not None, "Editor world was unavailable after opening the level")
        level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).get_current_level()
        require(level is not None, "Persistent JARVIS level was unavailable")

        source_data = unreal.InterchangeManager.create_source_data(GLB_PATH)
        require(source_data is not None, "Could not create Interchange source data for the GLB")
        manager = unreal.InterchangeManager.get_interchange_manager_scripted()
        require(manager is not None, "Interchange manager was unavailable")
        require(manager.can_translate_source_data(source_data, True),
                "Installed Interchange translators do not support importing this GLB as a scene")

        import_parameters = unreal.ImportAssetParameters()
        import_parameters.set_editor_property("is_automated", True)
        import_parameters.set_editor_property("import_level", level)
        import_parameters.set_editor_property("replace_existing", True)
        imported = manager.import_scene(CONTENT_PATH, source_data, import_parameters)
        require(imported, "Interchange reported that GLB scene import failed")

        actors, meshes, cameras, lights, labels = inspect_scene()
        require(len(meshes) >= 1, "GLB import completed but no static mesh components were placed in the level")

        camera = unreal.EditorLevelLibrary.spawn_actor_from_class(
            unreal.CameraActor,
            unreal.Vector(650.0, -900.0, 500.0),
            unreal.Rotator(0.0, 0.0, 0.0)
        )
        require(camera is not None, "Could not create the scene preview camera")
        camera.set_actor_label("JARVIS Preview Camera")
        camera_component = camera.get_component_by_class(unreal.CameraComponent)
        require(camera_component is not None, "Preview camera component was unavailable")
        camera_component.set_editor_property("field_of_view", 50.0)
        camera_rotation = unreal.MathLibrary.find_look_at_rotation(
            camera.get_actor_location(), unreal.Vector(0.0, 0.0, 0.0)
        )
        camera.set_actor_rotation(camera_rotation, False)

        make_light(
            "JARVIS Cyan Key Light",
            unreal.Vector(320.0, -220.0, 180.0),
            unreal.Color(26, 158, 255, 255),
            1800.0,
            1200.0
        )
        make_light(
            "JARVIS Blue Fill Light",
            unreal.Vector(-350.0, 280.0, 80.0),
            unreal.Color(20, 56, 255, 255),
            950.0,
            1000.0
        )
        unreal.EditorLevelLibrary.set_level_viewport_camera_info(
            camera.get_actor_location(), camera_rotation
        )
        require(unreal.EditorLevelLibrary.save_current_level(), "Could not save the JARVIS scene level")
        actors, meshes, cameras, lights, labels = inspect_scene()
        require(len(meshes) >= 1 and cameras >= 1, "Saved scene is missing its GLB mesh or preview camera")
        result = {
            "status": "built-and-saved",
            "engine": "Unreal Engine 5.8",
            "map": MAP_PATH,
            "glb_source": GLB_PATH,
            "actor_count": len(actors),
            "static_mesh_component_count": len(meshes),
            "camera_count": cameras,
            "point_light_count": lights,
            "actor_labels": labels
        }
        write_report(result)
        unreal.log("JARVIS scene built and saved: " + json.dumps(result))
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
    unreal.log_error("JARVIS scene build failed: " + str(error))
    unreal.log_error(traceback.format_exc())
    raise




