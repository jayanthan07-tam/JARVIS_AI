$ErrorActionPreference = 'SilentlyContinue'

# 1. Computer System (Manufacturer, Model, Total Physical RAM)
$cs = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue | Select-Object Manufacturer, Model, SystemType, TotalPhysicalMemory

# 2. Processor (CPU Name, Cores, Threads, Clock Speed)
$cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed

# 3. Operating System (Caption, Version, BuildNumber, Memory)
$os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue | Select-Object Caption, Version, BuildNumber, OSArchitecture, TotalVisibleMemorySize, FreePhysicalMemory

# 4. Registry details for Windows Display Version (e.g. 23H2, 24H2, 26H2)
$reg = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction SilentlyContinue

# 5. Video Controller / GPU
$gpus = Get-CimInstance -ClassName Win32_VideoController -ErrorAction SilentlyContinue | Select-Object Name, AdapterRAM, DriverVersion, VideoProcessor

# 6. Disks (Local Fixed Drives, DriveType=3)
$disks = Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction SilentlyContinue | Select-Object DeviceID, VolumeName, Size, FreeSpace

# 7. Battery (Level and Charging status)
$battery = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object EstimatedChargeRemaining, BatteryStatus
$wmiBattery = Get-CimInstance -Namespace 'root\wmi' -ClassName BatteryStatus -ErrorAction SilentlyContinue | Select-Object Charging, Discharging, PowerOnline

# Compose structured JSON output
[PSCustomObject]@{
    ComputerSystem = if ($cs) { $cs } else { $null }
    CPU = if ($cpu) { $cpu } else { $null }
    OS = [PSCustomObject]@{
        Caption = if ($os.Caption) { $os.Caption } else { "Microsoft Windows" }
        Version = if ($os.Version) { $os.Version } else { "" }
        BuildNumber = if ($os.BuildNumber) { $os.BuildNumber } else { "" }
        OSArchitecture = if ($os.OSArchitecture) { $os.OSArchitecture } else { "64-bit" }
        DisplayVersion = if ($reg.DisplayVersion) { $reg.DisplayVersion } else { "" }
        EditionID = if ($reg.EditionID) { $reg.EditionID } else { "" }
        TotalVisibleMemorySize = if ($os.TotalVisibleMemorySize) { $os.TotalVisibleMemorySize } else { 0 }
        FreePhysicalMemory = if ($os.FreePhysicalMemory) { $os.FreePhysicalMemory } else { 0 }
    }
    GPUs = if ($gpus) { @($gpus) } else { @() }
    Disks = if ($disks) { @($disks) } else { @() }
    Battery = if ($battery) {
        [PSCustomObject]@{
            EstimatedChargeRemaining = $battery.EstimatedChargeRemaining
            BatteryStatus = $battery.BatteryStatus
            Charging = if ($wmiBattery) { [bool]$wmiBattery.Charging } else { $battery.BatteryStatus -eq 2 -or $battery.BatteryStatus -eq 6 }
            Discharging = if ($wmiBattery) { [bool]$wmiBattery.Discharging } else { $battery.BatteryStatus -eq 1 }
            PowerOnline = if ($wmiBattery) { [bool]$wmiBattery.PowerOnline } else { $battery.BatteryStatus -eq 2 }
        }
    } else {
        $null
    }
} | ConvertTo-Json -Depth 4
