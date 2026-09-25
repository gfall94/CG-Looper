$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$html = [IO.File]::ReadAllText((Join-Path $root 'src/shell.html'))
$scripts = @('core.js','archive.js','sequence.js','thumbnails.js','ui.js') | ForEach-Object {
    '<script>' + [IO.File]::ReadAllText((Join-Path $root "src/$_")) + '</script>'
}
$html = $html.Replace('<!-- SCRIPTS -->', ($scripts -join "`n"))
$encoding = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText((Join-Path $root 'CG-Looper.html'), $html, $encoding)
[IO.File]::WriteAllText((Join-Path $root 'index.html'), $html, $encoding)
Write-Output 'CG-Looper.html und index.html erstellt.'
