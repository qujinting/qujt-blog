[CmdletBinding()]
param([string]$HostName = '115.29.149.137')

 $ErrorActionPreference = 'Stop'
$key = Join-Path $env:USERPROFILE '.ssh\qujt-deploy-key'
if (-not (Test-Path $key)) { throw "Deployment key not found: $key" }

 $remote = @'
echo '== release =='
cat /opt/qujt-blog/DEPLOYED_RELEASE
readlink -f /opt/qujt-blog/current
echo '== processes =='
pm2 ls
echo '== health =='
curl -fsS http://127.0.0.1/api/health
echo
curl -fsS http://127.0.0.1/test/api/health
echo
echo '== disk =='
df -h /opt/qujt-blog
'@

ssh -i $key -o BatchMode=yes "root@$HostName" $remote
if ($LASTEXITCODE -ne 0) { throw 'Production status check failed.' }
Read-Host 'Press Enter to close'
