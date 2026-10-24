# J.A.R.V.I.S. Unreal Experience

This is a separate Unreal Engine 5.8 editor project for the optional JARVIS 3D scene. It does not alter the existing `MyProject 5.8` project or replace the browser Three.js renderer.

## Build the scene

The scene build uses three explicit editor runs. This first imports the Blender GLB scene and adds its preview camera and lights:

Run this in PowerShell on the project PC:

```powershell
& "D:\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe" `
  "D:\Jayanthan\Documents\JARVIS_AI\Unreal\JARVIS_Experience\JARVIS_Experience.uproject" `
  -ExecutePythonScript="D:\Jayanthan\Documents\JARVIS_AI\Unreal\JARVIS_Experience\Scripts\BuildJarvisScene.py" `
  -unattended -nop4 -nosplash
```

The script imports `public/models/jarvis_hologram.glb` through Unreal's Interchange scene importer, places its nodes in a dedicated map, adds a preview camera and two colored lights, saves the map, and writes a build report under `Saved/`.

Then run the persistence repair/import step. Unreal's scene importer places the GLB nodes but does not persist each node mesh as a reusable static mesh asset on this setup. This step writes an animation-free derivative under `Source/` (the original GLB is left untouched), imports the 18 static meshes, and assigns those assets back to the matching scene nodes:

```powershell
& "D:\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe" `
  "D:\Jayanthan\Documents\JARVIS_AI\Unreal\JARVIS_Experience\JARVIS_Experience.uproject" `
  -ExecutePythonScript="D:\Jayanthan\Documents\JARVIS_AI\Unreal\JARVIS_Experience\Scripts\RepairJarvisScene.py" `
  -unattended -nop4 -nosplash
```

## Verify the saved scene

```powershell
& "D:\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe" `
  "D:\Jayanthan\Documents\JARVIS_AI\Unreal\JARVIS_Experience\JARVIS_Experience.uproject" `
  -ExecutePythonScript="D:\Jayanthan\Documents\JARVIS_AI\Unreal\JARVIS_Experience\Scripts\VerifyJarvisScene.py" `
  -unattended -nop4 -nosplash
```

This third script reloads the saved map and verifies the persistent meshes, preview camera, and lights. The project sets this map as the editor startup map. To view and edit it interactively, open `JARVIS_Experience.uproject` in Unreal Engine 5.8.

The verified local result contains 22 actors, all 18 JARVIS node meshes bound to saved Unreal static mesh assets, one preview camera, and two point lights. Unreal's map check reported zero errors and zero warnings. This verifies that the editor map reloads; it does not measure frame rate or establish a packaged runtime.

## Scope

This deliverable is an Unreal Editor scene project. It is not a packaged Unreal runtime, browser renderer, or remote streaming service. The build and verification scripts do not start or reconfigure the separate Model Context Protocol server.
