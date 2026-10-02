param([switch]$Offline)
$ErrorActionPreference = 'Stop'
$pluginRoot = Split-Path $PSScriptRoot -Parent
$packageVersion = (Get-Content -LiteralPath (Join-Path $pluginRoot 'package.json') -Raw | ConvertFrom-Json).version
$stageRoot = Join-Path ([IO.Path]::GetTempPath()) ('faxdock-package-' + [guid]::NewGuid())
$releaseRoot = Join-Path $pluginRoot 'release'
$zipPath = Join-Path $releaseRoot ('faxdock-' + $packageVersion + '-local.zip')
$allowed = @('plugin.json','mcp.json','.mcp.json','.codex-plugin','src','public','skills','assets','package.json','package-lock.json','.env.example','README.md','CODEX-RELEASE.md','USER-SETUP.md','user-mcp.example.toml','LICENSE','DISTRIBUTION.md')
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
try {
  foreach ($item in $allowed) {
    $sourcePath = Join-Path $pluginRoot $item
    if (-not (Test-Path -LiteralPath $sourcePath)) { throw "Missing package component: $item" }
    $candidateFiles = @(Get-Item -LiteralPath $sourcePath) + @(Get-ChildItem -LiteralPath $sourcePath -Recurse -Force -ErrorAction SilentlyContinue)
    if ($candidateFiles | Where-Object { $_.LinkType -in @('SymbolicLink','Junction') }) { throw "Package links are not allowed: $item" }
    Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $stageRoot $item) -Recurse -Force
  }
  # Public artifact contains clean install guidance, never the private working history.
  Copy-Item -LiteralPath (Join-Path $pluginRoot 'DISTRIBUTION.md') -Destination (Join-Path $stageRoot 'CODEX-RELEASE.md') -Force
  Push-Location $stageRoot
  try {
    $installArgs = @('ci','--ignore-scripts','--no-audit','--no-fund','--cache',(Join-Path ([IO.Path]::GetTempPath()) 'openfax-npm-cache'))
    if ($Offline) { $installArgs += '--offline' }
    & npm.cmd @installArgs
    if ($LASTEXITCODE -ne 0) { throw 'Clean dependency installation failed.' }
  } finally { Pop-Location }
  New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath }
  [IO.Compression.ZipFile]::CreateFromDirectory($stageRoot, $zipPath, [IO.Compression.CompressionLevel]::Optimal, $false)
  $stream = [IO.File]::OpenRead($zipPath)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $hash = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() } finally { $stream.Dispose(); $sha.Dispose() }
  Set-Content -LiteralPath ($zipPath + '.sha256') -Value ($hash + '  ' + [IO.Path]::GetFileName($zipPath))
  $localInstall = Join-Path $releaseRoot 'faxdock'
  $resolvedInstall = [IO.Path]::GetFullPath($localInstall)
  $expectedInstall = [IO.Path]::GetFullPath((Join-Path $pluginRoot 'release\faxdock'))
  if ($resolvedInstall -ne $expectedInstall) { throw 'Unexpected release installation path.' }
  if (Test-Path -LiteralPath $localInstall) { Remove-Item -LiteralPath $localInstall -Recurse -Force }
  [IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $localInstall)
  Write-Output "Local Codex package: $zipPath"
  Write-Output "SHA256: $hash"
} finally {
  $resolvedStage = [IO.Path]::GetFullPath($stageRoot)
  $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (-not $resolvedStage.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName($resolvedStage).StartsWith('faxdock-package-'))) { throw 'Refusing to remove unexpected staging path.' }
  Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}
