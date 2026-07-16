# Push backend/.env vars to Railway (skips comments, R2_CLOUDFLARE_API_TOKEN, local-only keys)
param(
  [string]$Service = "voyr-backend",
  [string]$EnvFile = "backend\.env"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Path = Join-Path $Root $EnvFile

$skip = @(
  "R2_CLOUDFLARE_API_TOKEN", "SUPABASE_PROJECT_REF", "PORT", "DEV_LOG_OTP"
)

function Set-RailwayVariable {
  param(
    [string]$Service,
    [string]$Key,
    [string]$Value
  )
  $pair = "${Key}=${Value}"
  & railway variable set $pair --service $Service --skip-deploys | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "railway variable set failed for ${Key}"
  }
}

Get-Content $Path | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  if ($line -notmatch '^([A-Z0-9_]+)=(.*)$') { return }
  $key = $Matches[1]
  $val = $Matches[2]
  if ($skip -contains $key) { return }
  if ($key -eq "NODE_ENV") { $val = "production" }
  Set-RailwayVariable -Service $Service -Key $key -Value $val
  Write-Host "  set $key"
}

# Production URLs (update when Pages is live)
Set-RailwayVariable -Service $Service -Key "FRONTEND_URL" -Value "https://voyr-frontend.pages.dev"
Set-RailwayVariable -Service $Service -Key "CORS_ORIGIN" -Value "https://voyr-frontend.pages.dev"
Write-Host "  set FRONTEND_URL / CORS_ORIGIN (production URLs)"

if (-not (Select-String -Path $Path -Pattern '^\s*METRICS_TOKEN=' -Quiet)) {
  Write-Warning "METRICS_TOKEN is not set in $EnvFile - add it before production deploy (/metrics requires Bearer token)."
}

$dbUrl = (Get-Content $Path | Where-Object { $_ -match '^\s*DATABASE_URL=' } | Select-Object -First 1) -replace '^\s*DATABASE_URL=', ''
if ($dbUrl -match '@db\.[^.]+\.supabase\.co' -and -not (Select-String -Path $Path -Pattern '^\s*SUPABASE_POOLER_REGION=' -Quiet)) {
  Write-Warning "DATABASE_URL uses direct db.*.supabase.co. Add SUPABASE_POOLER_REGION for Railway (IPv6-only on direct host)."
}

Write-Host "Done. Run: railway up --service $Service"
