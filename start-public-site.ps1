$ErrorActionPreference = 'Stop'

$pythonCandidates = @(
  Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'
  'python.exe'
)

$python = $pythonCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $python) {
  throw 'Python was not found.'
}

$logDir = Join-Path $PSScriptRoot 'server-logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

Start-Process `
  -FilePath $python `
  -ArgumentList @(
    ('"{0}"' -f (Join-Path $PSScriptRoot 'serve-dir.py')),
    '--root',
    ('"{0}"' -f $PSScriptRoot),
    '--port',
    '4173'
  ) `
  -WorkingDirectory $PSScriptRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logDir 'public-site.out.log') `
  -RedirectStandardError (Join-Path $logDir 'public-site.err.log') | Out-Null
