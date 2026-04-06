$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
if (-not (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
  throw 'JAVA_HOME runtime not found at Android Studio JBR path.'
}

if (-not $env:ANDROID_HOME) {
  $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}

$env:Path = "$(Join-Path $env:JAVA_HOME 'bin');$(Join-Path $env:ANDROID_HOME 'platform-tools');$(Join-Path $env:ANDROID_HOME 'emulator');$env:Path"
$env:MAESTRO_CLI_NO_ANALYTICS = '1'

$maestro = Join-Path $env:USERPROFILE 'Downloads\maestro-cli\maestro\bin\maestro.bat'
if (-not (Test-Path $maestro)) {
  throw "Maestro CLI not found at $maestro"
}

$flowsDir = 'F:\Projects\Gratonite\apps\mobile\flows'
$flows = Get-ChildItem "$flowsDir\*.yaml" | Sort-Object Name
$results = @()

foreach ($flow in $flows) {
  Write-Host "===== RUNNING $($flow.Name) ====="
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $cmd = '"{0}" test "{1}" --no-ansi' -f $maestro, $flow.FullName
  $output = (cmd /c "$cmd 2>&1" | Out-String)
  $exitCode = $LASTEXITCODE
  $sw.Stop()

  $reason = 'other'
  if ($output -match 'Unknown Property: timeout') {
    $reason = 'yaml-schema-timeout-unsupported'
  } elseif ($output -match 'Assertion is false: "([^"]+)" is visible') {
    $reason = "assert-visible-failed: $($matches[1])"
  } elseif ($output -match 'Device .* is not connected') {
    $reason = 'device-not-connected'
  }

  $status = if ($exitCode -eq 0) { 'PASS' } else { 'FAIL' }
  $results += [PSCustomObject]@{
    flow = $flow.Name
    status = $status
    exitCode = $exitCode
    seconds = [Math]::Round($sw.Elapsed.TotalSeconds, 2)
    reason = $reason
  }

  Write-Host "===== DONE $($flow.Name) status=$status ====="
}

$outFile = 'F:\Projects\Gratonite\apps\mobile\maestro-android-results-detailed.json'
$results | ConvertTo-Json -Depth 5 | Set-Content $outFile
Write-Host "RESULTS_FILE=$outFile"
$results | Format-Table -AutoSize
