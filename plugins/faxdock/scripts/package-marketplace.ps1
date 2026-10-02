param([switch]$Offline)
$ErrorActionPreference = 'Stop'
$pluginRoot = Split-Path $PSScriptRoot -Parent
& (Join-Path $PSScriptRoot 'package.ps1') -Offline:$Offline
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw 'Plugin packaging failed.' }
$version = (Get-Content -Raw -LiteralPath (Join-Path $pluginRoot 'package.json') | ConvertFrom-Json).version
$stage = Join-Path ([IO.Path]::GetTempPath()) ('faxdock-marketplace-' + [guid]::NewGuid())
$zip = Join-Path $pluginRoot ('release\faxdock-' + $version + '-marketplace.zip')
try {
  New-Item -ItemType Directory -Path (Join-Path $stage '.agents\plugins'),(Join-Path $stage 'plugins') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $pluginRoot 'release\faxdock') -Destination (Join-Path $stage 'plugins\faxdock') -Recurse
  $catalog = @{ name='adam-designs-fax'; interface=@{displayName='Adam Designs Fax Plugins'}; plugins=@(@{name='faxdock'; source=@{source='local';path='./plugins/faxdock'}; policy=@{installation='AVAILABLE';authentication='ON_USE'};category='Productivity'}) }
  $catalog | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $stage '.agents\plugins\marketplace.json')
  Copy-Item -LiteralPath (Join-Path $pluginRoot 'USER-SETUP.md') -Destination (Join-Path $stage 'README.md')
  # Check the only plugin source resolves inside the sanitized marketplace.
  $resolved = [IO.Path]::GetFullPath((Join-Path $stage $catalog.plugins[0].source.path))
  if ($resolved -ne [IO.Path]::GetFullPath((Join-Path $stage 'plugins\faxdock'))) { throw 'Unsafe marketplace source.' }
  $files = @(Get-ChildItem -LiteralPath $stage -Recurse -Force)
  if ($files | Where-Object { $_.LinkType -in @('Junction','SymbolicLink') -or $_.Name -in @('.env','data','.git','.dev.vars','hosted') }) { throw 'Private/unexpected material in marketplace.' }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip }
  [IO.Compression.ZipFile]::CreateFromDirectory($stage,$zip,[IO.Compression.CompressionLevel]::Optimal,$false)
  $hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
  Set-Content -LiteralPath ($zip+'.sha256') -Value ($hash+'  '+[IO.Path]::GetFileName($zip))
  Write-Output "Sanitized marketplace: $zip"
  Write-Output "SHA256: $hash"
} finally {
  $resolved = [IO.Path]::GetFullPath($stage)
  $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (-not $resolved.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName($resolved).StartsWith('faxdock-marketplace-'))) { throw 'Unsafe staging cleanup path.' }
  if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
