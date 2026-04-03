# Run Gratonite on Android emulator (Windows).
# Prerequisites: Android Studio installed, at least one AVD in Device Manager.
# Usage: .\scripts\run-android.ps1
# Optional: .\scripts\run-android.ps1 -SkipBuild   (Metro only; dev client must already be installed)

param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA "Android\Sdk" }
if (-not (Test-Path $sdk)) {
  Write-Host "Android SDK not found at $sdk"
  Write-Host "Set ANDROID_HOME to your SDK path: Android Studio -> Settings -> Android SDK -> Android SDK Location." -ForegroundColor Red
  exit 1
}

$env:ANDROID_HOME = $sdk

# Gradle needs a JDK. Android Studio ships one here; set JAVA_HOME if missing.
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
  $studioJbr = "${env:ProgramFiles}\Android\Android Studio\jbr"
  if (Test-Path (Join-Path $studioJbr "bin\java.exe")) {
    $env:JAVA_HOME = $studioJbr
  }
}
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
  Write-Host "JAVA_HOME is not set and Android Studio JBR was not found at:"
  Write-Host "  ${env:ProgramFiles}\Android\Android Studio\jbr"
  Write-Host "Install Android Studio, or set JAVA_HOME to a JDK 17+ install." -ForegroundColor Red
  exit 1
}

$env:Path = @(
  (Join-Path $env:JAVA_HOME "bin"),
  (Join-Path $sdk "platform-tools"),
  (Join-Path $sdk "emulator"),
  $env:Path
) -join ";"

$emulator = Join-Path $sdk "emulator\emulator.exe"
if (-not (Test-Path $emulator)) {
  Write-Host "emulator.exe not found. Install Android Emulator in SDK Manager -> SDK Tools." -ForegroundColor Red
  exit 1
}

$avds = @(& $emulator -list-avds 2>$null | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($avds.Count -eq 0) {
  Write-Host @"
No Android Virtual Devices yet.

1. Open Android Studio -> Device Manager (phone icon in toolbar, or More Actions -> Virtual Device Manager).
2. Create Device -> pick a phone (e.g. Pixel 8) -> Next.
3. Pick a system image (e.g. API 36 or 34). Download if needed -> Finish.

Then run this script again.
"@ -ForegroundColor Yellow
  exit 1
}

$running = & adb devices 2>$null | Select-String "emulator-\d+"
if (-not $running) {
  $name = $avds[0]
  Write-Host "Starting emulator: $name" -ForegroundColor Cyan
  Start-Process -FilePath $emulator -ArgumentList @("-avd", $name) -WindowStyle Normal
  Write-Host "Waiting for device (boot can take 1-2 minutes)..." -ForegroundColor Cyan
  $deadline = (Get-Date).AddMinutes(5)
  do {
    Start-Sleep -Seconds 3
    & adb wait-for-device 2>$null
    $boot = (& adb shell getprop sys.boot_completed 2>$null).Trim()
    if ($boot -eq "1") { break }
  } while ((Get-Date) -lt $deadline)
}

Set-Location (Join-Path $PSScriptRoot "..")
if ($SkipBuild) {
  npx expo start --dev-client
} else {
  npm run android
}
