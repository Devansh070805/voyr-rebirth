# Deploy gateway + frontend to Cloudflare (backend stays on Railway).
param(
  [string]$GatewayUrl = "https://voyr-travel-ops.aryansaxenaalig.workers.dev",
  [string]$PagesUrl = "https://voyr-frontend.pages.dev",
  [string]$BackendOrigin = "https://voyr-backend-production.up.railway.app"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# R2-only API tokens break Workers deploy — prefer OAuth login
Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:CLOUDFLARE_ACCOUNT_ID -ErrorAction SilentlyContinue

Write-Host "==> Gateway secrets + deploy"
Push-Location (Join-Path $Root "gateway")
$jwt = (Get-Content (Join-Path $Root "backend\.env") | Where-Object { $_ -match '^\s*JWT_SECRET=' } | Select-Object -First 1) -replace '^\s*JWT_SECRET=', ''
if ($jwt) { $jwt | npx wrangler secret put JWT_SECRET | Out-Null }
npx wrangler deploy
Pop-Location

Write-Host "==> Frontend build + Pages deploy"
Push-Location (Join-Path $Root "frontend")
$env:NEXT_PUBLIC_API_URL = $GatewayUrl
$env:NEXT_PUBLIC_APP_URL = $PagesUrl
if (Test-Path ".env.local") {
  Get-Content ".env.local" | ForEach-Object {
    if ($_ -match '^\s*(NEXT_PUBLIC_[A-Z0-9_]+)=(.*)$') {
      Set-Item -Path "env:$($Matches[1])" -Value $Matches[2]
    }
  }
}
npm run build
npx wrangler pages deploy out --project-name voyr-frontend --branch main
Pop-Location

Write-Host ""
Write-Host "Done."
Write-Host "  Frontend: $PagesUrl"
Write-Host "  Gateway:  $GatewayUrl"
Write-Host "  Backend:  $BackendOrigin (Railway — deploy when platform is up)"
