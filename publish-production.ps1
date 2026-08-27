[CmdletBinding()]
param([string]$HostName = '115.29.149.137', [switch]$SkipPull)

 $ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root
$branch = (git branch --show-current).Trim()
if ($branch -ne 'main') { throw "Refusing production publish from branch '$branch'. Switch to main first." }

if (-not $SkipPull) {
  git pull --ff-only
  if ($LASTEXITCODE -ne 0) { throw 'git pull failed; resolve it before publishing.' }
}

node deploy/deploy.mjs $HostName
if ($LASTEXITCODE -ne 0) { throw 'Production deployment failed.' }
Write-Host 'Production deployment completed.' -ForegroundColor Green
Read-Host 'Press Enter to close'
