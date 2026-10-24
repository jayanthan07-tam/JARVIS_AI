$ErrorActionPreference = "Stop"

$jarvisJdkCandidates = @(
    $env:JAVA_HOME,
    "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot",
    "D:\ANDROID_STUDIO\jbr"
) | Where-Object { $_ }

$jarvisJdk = $jarvisJdkCandidates |
    Where-Object { Test-Path -LiteralPath (Join-Path $_ "bin\java.exe") } |
    Select-Object -First 1

if (-not $jarvisJdk) {
    throw "JDK 17 or later was not found. Install a supported JDK, then rerun this script."
}

$jarvisSdk = $env:ANDROID_HOME
if (-not $jarvisSdk -or -not (Test-Path -LiteralPath (Join-Path $jarvisSdk "platform-tools"))) {
    $jarvisSdk = $env:ANDROID_SDK_ROOT
}
if (-not $jarvisSdk -or -not (Test-Path -LiteralPath (Join-Path $jarvisSdk "platform-tools"))) {
    $jarvisSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}
if (-not (Test-Path -LiteralPath (Join-Path $jarvisSdk "platform-tools"))) {
    throw "Android SDK platform-tools were not found. Install Android SDK Platform 36 and Build-Tools 36.0.0."
}

$env:JAVA_HOME = $jarvisJdk
$env:ANDROID_HOME = $jarvisSdk
$env:ANDROID_SDK_ROOT = $jarvisSdk
Set-Location -LiteralPath $PSScriptRoot

& ".\gradlew.bat" --no-daemon --console=plain :app:assembleDebug :wear:assembleDebug
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$jarvisApks = @(
    ".\app\build\outputs\apk\debug\app-debug.apk",
    ".\wear\build\outputs\apk\debug\wear-debug.apk"
)
foreach ($jarvisApk in $jarvisApks) {
    if (-not (Test-Path -LiteralPath $jarvisApk)) {
        throw "Expected APK was not created: $jarvisApk"
    }
    $jarvisFile = Get-Item -LiteralPath $jarvisApk
    Write-Output ("APK ready: {0} ({1:N0} bytes)" -f $jarvisFile.FullName, $jarvisFile.Length)
}
