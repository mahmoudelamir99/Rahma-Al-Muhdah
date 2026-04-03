param(
  [Parameter(Mandatory = $true)]
  [string]$Root,

  [Parameter(Mandatory = $true)]
  [int]$Port,

  [switch]$SpaFallback
)

$ErrorActionPreference = 'Stop'

$rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
if (-not (Test-Path $rootFull)) {
  throw "Root folder not found: $rootFull"
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://0.0.0.0:$Port/")
$listener.Start()

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.js' = 'application/javascript; charset=utf-8'
  '.mjs' = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.txt' = 'text/plain; charset=utf-8'
  '.svg' = 'image/svg+xml'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.ico' = 'image/x-icon'
  '.map' = 'application/json; charset=utf-8'
  '.woff' = 'font/woff'
  '.woff2' = 'font/woff2'
}

function Get-ContentType {
  param([string]$Path)
  $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  if ($mimeTypes.ContainsKey($ext)) {
    return $mimeTypes[$ext]
  }
  return 'application/octet-stream'
}

function Resolve-FilePath {
  param([string]$RelativePath)

  $normalized = $RelativePath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
  if ([string]::IsNullOrWhiteSpace($normalized)) {
    return (Join-Path $rootFull 'index.html')
  }

  $candidate = Join-Path $rootFull $normalized
  if (Test-Path $candidate -PathType Leaf) {
    return [System.IO.Path]::GetFullPath($candidate)
  }

  if (Test-Path $candidate -PathType Container) {
    $indexInDir = Join-Path $candidate 'index.html'
    if (Test-Path $indexInDir -PathType Leaf) {
      return [System.IO.Path]::GetFullPath($indexInDir)
    }
  }

  if (-not [System.IO.Path]::HasExtension($normalized)) {
    $htmlCandidate = "$candidate.html"
    if (Test-Path $htmlCandidate -PathType Leaf) {
      return [System.IO.Path]::GetFullPath($htmlCandidate)
    }
  }

  if ($SpaFallback) {
    return (Join-Path $rootFull 'index.html')
  }

  return $null
}

Write-Host "Serving $rootFull on port $Port"

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
      $filePath = Resolve-FilePath -RelativePath $requestPath

      if (-not $filePath -or -not (Test-Path $filePath -PathType Leaf)) {
        $context.Response.StatusCode = 404
        $buffer = [System.Text.Encoding]::UTF8.GetBytes("Not found")
        $context.Response.ContentType = 'text/plain; charset=utf-8'
        $context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
        continue
      }

      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $context.Response.ContentType = Get-ContentType -Path $filePath
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    catch {
      $context.Response.StatusCode = 500
      $buffer = [System.Text.Encoding]::UTF8.GetBytes("Server error")
      $context.Response.ContentType = 'text/plain; charset=utf-8'
      $context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
    }
    finally {
      $context.Response.OutputStream.Close()
    }
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
