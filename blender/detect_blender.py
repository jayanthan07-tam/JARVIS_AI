"""
Blender Detection Utility for Windows
Scans system PATH, Environment variables, Registry, and standard directories
to locate the Blender executable without assuming a fixed path.
"""

import os
import sys
import shutil
import glob
import subprocess

def find_blender_executable():
    """
    Search for blender.exe on Windows across all standard discovery channels.
    Returns: (path_to_blender_exe, discovery_source) or (None, None)
    """
    # 1. Environment Variable Override
    env_path = os.environ.get("BLENDER_PATH")
    if env_path and os.path.isfile(env_path):
        return os.path.abspath(env_path), "BLENDER_PATH environment variable"

    # 2. System PATH
    which_path = shutil.which("blender")
    if which_path:
        return os.path.abspath(which_path), "System PATH"

    # 3. Known Windows directories & drives
    common_patterns = [
        r"C:\Program Files\Blender Foundation\Blender *\blender.exe",
        r"C:\Program Files (x86)\Blender Foundation\Blender *\blender.exe",
        r"D:\Program Files\Blender Foundation\Blender *\blender.exe",
        r"D:\Blender\blender.exe",
        r"D:\Blender*\blender.exe",
        r"C:\Blender\blender.exe",
        r"C:\Blender*\blender.exe",
        r"E:\Blender*\blender.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Blender Foundation\Blender *\blender.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WindowsApps\blender.exe"),
        r"C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe",
        r"D:\SteamLibrary\steamapps\common\Blender\blender.exe",
        r"C:\SteamLibrary\steamapps\common\Blender\blender.exe",
        r"E:\SteamLibrary\steamapps\common\Blender\blender.exe",
    ]

    for pattern in common_patterns:
        for match in glob.glob(pattern):
            if os.path.isfile(match):
                return os.path.abspath(match), f"Standard Directory Pattern ({pattern})"

    # 4. Windows Registry (Uninstall entries & App Paths)
    try:
        import winreg
        for root in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
            for subkey in (
                r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
                r"Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
            ):
                try:
                    with winreg.OpenKey(root, subkey) as k:
                        count, _, _ = winreg.QueryInfoKey(k)
                        for i in range(count):
                            try:
                                key_name = winreg.EnumKey(k, i)
                                with winreg.OpenKey(k, key_name) as sk:
                                    display_name, _ = winreg.QueryValueEx(sk, "DisplayName")
                                    if "blender" in str(display_name).lower():
                                        try:
                                            install_loc, _ = winreg.QueryValueEx(sk, "InstallLocation")
                                            candidate = os.path.join(install_loc, "blender.exe")
                                            if os.path.isfile(candidate):
                                                return os.path.abspath(candidate), "Windows Registry Uninstall key"
                                        except Exception:
                                            pass
                            except Exception:
                                pass
                except Exception:
                    pass

        # Check App Paths
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\blender.exe") as k:
                app_path, _ = winreg.QueryValueEx(k, "")
                if os.path.isfile(app_path):
                    return os.path.abspath(app_path), "Windows Registry App Paths"
        except Exception:
            pass
    except Exception:
        pass

    return None, None

def print_blender_info():
    path, source = find_blender_executable()
    if path:
        print("=" * 65)
        print(" [J.A.R.V.I.S.] BLENDER DETECTED ON SYSTEM")
        print("=" * 65)
        print(f" Executable Path : {path}")
        print(f" Source          : {source}")
        try:
            res = subprocess.run([path, "--version"], capture_output=True, text=True, check=True)
            first_line = res.stdout.strip().split("\n")[0]
            print(f" Version         : {first_line}")
        except Exception as e:
            print(f" Version Check   : Unable to query version ({e})")
        print("=" * 65)
        return path
    else:
        print("=" * 65)
        print(" [J.A.R.V.I.S.] BLENDER NOT FOUND ON THIS SYSTEM")
        print("=" * 65)
        print(" Blender is required to generate or recompile the 3D hologram asset.")
        print("")
        print(" HOW TO INSTALL BLENDER:")
        print("  1. Via Windows Package Manager (Winget - Recommended):")
        print("     winget install BlenderFoundation.Blender")
        print("")
        print("  2. Via Official Website:")
        print("     Download installer from: https://www.blender.org/download/")
        print("")
        print("  3. If Blender is installed in a custom location, set BLENDER_PATH:")
        print("     PowerShell:  $env:BLENDER_PATH = 'D:\\CustomPath\\blender.exe'")
        print("     CMD:         set BLENDER_PATH=D:\\CustomPath\\blender.exe")
        print("=" * 65)
        return None

if __name__ == "__main__":
    bpath = print_blender_info()
    sys.exit(0 if bpath else 1)
