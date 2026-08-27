[CmdletBinding()]
param(
  [string]$HostName = '115.29.149.137',
  [string]$ReleaseId
)

 $ErrorActionPreference = 'Stop'
$key = Join-Path $env:USERPROFILE '.ssh\qujt-deploy-key'
if (-not (Test-Path $key)) { throw "Deployment key not found: $key" }

if (-not $ReleaseId) { $ReleaseId = Read-Host 'Release ID to restore (leave empty for newest previous release)' }
$label = if ($ReleaseId) { $ReleaseId } else { 'newest previous release' }
$answer = Read-Host "Roll back production to $label? Type YES to continue"
if ($answer -cne 'YES') { Write-Host 'Rollback cancelled.'; exit 0 }

$command = 'bash /opt/qujt-blog/current/deploy/rollback-release.sh'
if ($ReleaseId) { $command += ' ' + $ReleaseId }
ssh -i $key -o BatchMode=yes "root@$HostName" $command
if ($LASTEXITCODE -ne 0) { throw 'Rollback failed.' }
Read-Host 'Press Enter to close'
