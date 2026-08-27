[CmdletBinding()]
param([string]$HostName = '115.29.149.137')

 $ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
node deploy/deploy-test.mjs $HostName
if ($LASTEXITCODE -ne 0) { throw 'Test environment deployment failed.' }
Write-Host 'Test environment deployment completed.' -ForegroundColor Green
Read-Host 'Press Enter to close'
