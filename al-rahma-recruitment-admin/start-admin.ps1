$ErrorActionPreference = 'Stop'

$npm = 'C:\Program Files\nodejs\npm.cmd'
if (-not (Test-Path $npm)) {
  throw 'npm was not found.'
}

$logDir = Join-Path $PSScriptRoot 'server-logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

Start-Process `
  -FilePath $npm `
  -ArgumentList @('run', 'dev', '--', '--host', '0.0.0.0', '--port', '4174', '--strictPort') `
  -WorkingDirectory $PSScriptRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logDir 'admin.out.log') `
  -RedirectStandardError (Join-Path $logDir 'admin.err.log') | Out-Null
