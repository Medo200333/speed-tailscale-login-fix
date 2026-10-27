$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = 'C:\SpeedForTraining-1.1.9-Full-Docs-Source\source'
$rels = @(
  'src\components\branch-tailscale.tsx',
  'src\lib\access\tailscale.server.ts',
  'src\lib\access\tailscale-core.ts',
  'src\lib\tailscale.functions.ts'
)
foreach ($rel in $rels) {
  $from = Join-Path $here $rel
  $to = Join-Path $dest $rel
  if (-not (Test-Path -LiteralPath $from)) { throw "missing $from" }
  if (-not (Test-Path -LiteralPath (Split-Path $to))) { throw "dest folder missing $to" }
  Copy-Item -LiteralPath $from -Destination $to -Force
  Write-Host "COPIED $rel"
}
Set-Location -LiteralPath $dest
node scripts/zubayd-build-server.mjs
if ($LASTEXITCODE -ne 0) { throw 'server build failed' }
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
& (Join-Path $dest 'desktop\node_modules\.bin\electron-builder.cmd') --projectDir (Join-Path $dest 'desktop') --win nsis
if ($LASTEXITCODE -ne 0) { throw 'exe build failed' }
explorer.exe (Join-Path $dest 'releases\windows')
Write-Host 'DONE'
