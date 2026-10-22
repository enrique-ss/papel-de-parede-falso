# Servidor HTTP otimizado em PowerShell com suporte a Range Requests (streaming de video)
[CmdletBinding()]
param(
    [int]$Port = 8000
)

$baseDir = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
} catch {
    exit 1
}

function Get-ContentType($path) {
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    switch ($ext) {
        ".html" { return "text/html; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".svg"  { return "image/svg+xml" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".webp" { return "image/webp" }
        ".mp4"  { return "video/mp4" }
        ".webm" { return "video/webm" }
        ".mkv"  { return "video/x-matroska" }
        default { return "application/octet-stream" }
    }
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $urlPath = [System.Uri]::UnescapeDataString($request.Url.LocalPath)
            if ($urlPath -eq "/" -or [string]::IsNullOrWhiteSpace($urlPath)) {
                $urlPath = "/index.html"
            }

            $relPath = ($urlPath.TrimStart("/\")).Replace("/", [System.IO.Path]::DirectorySeparatorChar)
            $fullPath = [System.IO.Path]::GetFullPath((Join-Path $baseDir $relPath))

            if (-not $fullPath.StartsWith($baseDir, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $fullPath -PathType Leaf)) {
                $response.StatusCode = 404
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 - Arquivo nao encontrado")
                $response.ContentType = "text/plain; charset=utf-8"
                $response.ContentLength64 = $errBytes.Length
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                $response.Close()
                continue
            }

            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Range, Content-Type")
            $response.Headers.Add("Accept-Ranges", "bytes")

            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }

            $fileInfo = New-Object System.IO.FileInfo($fullPath)
            $fileLength = $fileInfo.Length
            $contentType = Get-ContentType $fullPath
            $response.ContentType = $contentType

            if ($request.HttpMethod -eq "HEAD") {
                $response.ContentLength64 = $fileLength
                $response.StatusCode = 200
                $response.Close()
                continue
            }

            $rangeHeader = $request.Headers["Range"]
            if ($null -ne $rangeHeader -and $rangeHeader.StartsWith("bytes=")) {
                $range = $rangeHeader.Substring(6).Trim()
                $parts = $range.Split("-")

                [long]$start = 0
                [long]$end = $fileLength - 1

                if (-not [string]::IsNullOrEmpty($parts[0])) {
                    $start = [long]::Parse($parts[0])
                }
                if ($parts.Length -gt 1 -and -not [string]::IsNullOrEmpty($parts[1])) {
                    $end = [long]::Parse($parts[1])
                }

                if ($end -ge $fileLength) {
                    $end = $fileLength - 1
                }

                if ($start -gt $end -or $start -ge $fileLength) {
                    $response.StatusCode = 416
                    $response.Headers.Add("Content-Range", "bytes */$fileLength")
                    $response.Close()
                    continue
                }

                [long]$totalBytesToSend = ($end - $start) + 1
                $response.StatusCode = 206
                $response.Headers.Add("Content-Range", "bytes $start-$end/$fileLength")
                $response.ContentLength64 = $totalBytesToSend

                $fs = [System.IO.File]::OpenRead($fullPath)
                try {
                    [void]$fs.Seek($start, [System.IO.SeekOrigin]::Begin)
                    $buffer = New-Object byte[] 65536
                    [long]$bytesRemaining = $totalBytesToSend

                    while ($bytesRemaining -gt 0) {
                        $toRead = [int][System.Math]::Min([long]$buffer.Length, $bytesRemaining)
                        $read = $fs.Read($buffer, 0, $toRead)
                        if ($read -le 0) { break }
                        $response.OutputStream.Write($buffer, 0, $read)
                        $bytesRemaining -= $read
                    }
                } finally {
                    $fs.Close()
                }
            } else {
                $response.StatusCode = 200
                $response.ContentLength64 = $fileLength

                $fs = [System.IO.File]::OpenRead($fullPath)
                try {
                    $buffer = New-Object byte[] 65536
                    while ($true) {
                        $read = $fs.Read($buffer, 0, $buffer.Length)
                        if ($read -le 0) { break }
                        $response.OutputStream.Write($buffer, 0, $read)
                    }
                } finally {
                    $fs.Close()
                }
            }

            $response.Close()
        } catch {
            try { $response.Abort() } catch {}
        }
    }
} finally {
    try { $listener.Stop() } catch {}
    try { $listener.Close() } catch {}
}
