param(
    [string]$ComposeFile = "docker-compose.yml"
)

$ErrorActionPreference = "Stop"

function Write-OrNote {
    param(
        [Parameter(Mandatory = $true)][string]$OutFile,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    try {
        & $Action | Out-File -FilePath $OutFile -Encoding utf8
    }
    catch {
        "Command failed: $($_.Exception.Message)" | Out-File -FilePath $OutFile -Encoding utf8
    }
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
    try {
        docker compose version | Out-Null
    }
    catch {
        throw "docker compose is not available."
    }
}
else {
    throw "docker is not installed or not on PATH."
}

$ts = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$baseDir = Join-Path (Get-Location) "support"
$workDir = Join-Path $baseDir "gratonite-support-$ts"
$zipPath = "$workDir.zip"

New-Item -Path $workDir -ItemType Directory -Force | Out-Null

Write-OrNote -OutFile (Join-Path $workDir "meta.txt") -Action {
    @(
        "timestamp_utc=$ts"
        "pwd=$(Get-Location)"
        "os=$([System.Environment]::OSVersion.VersionString)"
    )
}

Write-OrNote -OutFile (Join-Path $workDir "docker-version.txt") -Action { docker version }
Write-OrNote -OutFile (Join-Path $workDir "docker-info.txt") -Action { docker info }
Write-OrNote -OutFile (Join-Path $workDir "compose-version.txt") -Action { docker compose version }
Write-OrNote -OutFile (Join-Path $workDir "compose-ps.txt") -Action { docker compose -f $ComposeFile ps -a }

$envFile = Join-Path (Get-Location) ".env"
$redactedEnvOut = Join-Path $workDir "env-redacted.txt"
if (Test-Path $envFile) {
    $lines = Get-Content $envFile
    "# .env keys (values redacted)" | Out-File -FilePath $redactedEnvOut -Encoding utf8
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if (-not $trimmed) { continue }
        if ($trimmed.StartsWith("#")) { continue }
        $parts = $trimmed.Split("=", 2)
        if ($parts.Count -ge 1 -and $parts[0].Trim()) {
            "$($parts[0].Trim())=<redacted>" | Out-File -FilePath $redactedEnvOut -Append -Encoding utf8
        }
    }
}
else {
    ".env not found in $(Get-Location)" | Out-File -FilePath $redactedEnvOut -Encoding utf8
}

$services = @("setup", "postgres", "redis", "api", "web", "caddy", "livekit")
foreach ($svc in $services) {
    $outFile = Join-Path $workDir "logs-$svc.txt"
    Write-OrNote -OutFile $outFile -Action { docker compose -f $ComposeFile logs --tail 300 $svc }
}

if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}
Compress-Archive -Path (Join-Path $workDir "*") -DestinationPath $zipPath -Force

Write-Host "Support bundle created: $zipPath"

