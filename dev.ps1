param(
    [switch]$Down,
    [switch]$Logs
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
$serverEnvPath = Join-Path $repoRoot "server/.env"
$serverEnvExamplePath = Join-Path $repoRoot "server/.env.example"

function New-LocalSecret {
    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    }
    finally {
        $generator.Dispose()
    }

    return [BitConverter]::ToString($bytes).Replace("-", "").ToLowerInvariant()
}

function Initialize-ServerEnvironment {
    if (-not (Test-Path -LiteralPath $serverEnvPath)) {
        if (-not (Test-Path -LiteralPath $serverEnvExamplePath)) {
            throw "Missing server/.env.example; cannot prepare local configuration."
        }

        $content = Get-Content -LiteralPath $serverEnvExamplePath -Raw
        Write-Host "Creating server/.env with generated local secrets."
    }
    else {
        $content = Get-Content -LiteralPath $serverEnvPath -Raw
    }

    foreach ($name in @("JWT_SECRET", "GITHUB_WEBHOOK_SECRET", "OPERATIONS_API_KEY")) {
        $pattern = "(?m)^$name=replace-with[^\r\n]*$"
        if ([regex]::IsMatch($content, $pattern)) {
            $secret = New-LocalSecret
            $replacement = "$name=$secret"
            $content = [regex]::Replace(
                $content,
                $pattern,
                [System.Text.RegularExpressions.MatchEvaluator]{
                    param($match)
                    return $replacement
                }
            )
            Write-Host "Generated a local $name."
        }
    }

    [System.IO.File]::WriteAllText(
        $serverEnvPath,
        $content,
        [System.Text.UTF8Encoding]::new($false)
    )
}

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCommand) {
    throw "Docker is not installed or is not on PATH. Install Docker Desktop, then reopen PowerShell."
}

$null = & docker info --format "{{.ServerVersion}}" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Engine is not running. Start Docker Desktop and wait until it says the engine is running."
}

$null = & docker compose version 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose is unavailable. Update Docker Desktop and try again."
}

Initialize-ServerEnvironment
Push-Location $repoRoot
try {
    if ($Down) {
        & docker compose down
        if ($LASTEXITCODE -ne 0) {
            throw "Could not stop the FlowForge stack."
        }
        Write-Host "FlowForge stopped. MongoDB and Redis data volumes were preserved."
        return
    }

    & docker compose up --build --detach --wait
    if ($LASTEXITCODE -ne 0) {
        throw "FlowForge did not become ready. Check logs with: docker compose logs --tail 100"
    }

    Write-Host ""
    Write-Host "FlowForge is ready:"
    Write-Host "  App:       http://localhost:8080"
    Write-Host "  API health: http://localhost:5000/api/v1/health"
    Write-Host ""
    Write-Host "Open the app and register or log in."
    Write-Host "Inspect its Docker MongoDB with: docker compose exec mongo mongosh flowforge"
    Write-Host "Stop and preserve data with:     .\dev.ps1 -Down"
    Write-Host "Follow logs with:                .\dev.ps1 -Logs"

    if ($Logs) {
        & docker compose logs --follow
    }
}
finally {
    Pop-Location
}
