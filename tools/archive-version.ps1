# Archivuje aktuální stav hry jako verzi N (např. 0, 0.1, 0.2, 1.0).
#
# Použití (ve složce hry):
#   powershell -ExecutionPolicy Bypass -File tools/archive-version.ps1 -Version 0.1
#
# Vytvoří ve složce archiv/:
#   dragon-souls-vN.zip   celá hra bez node_modules, archiv a .claude
#   vN-soubory.json       otisky (SHA-256) všech souborů
#   vN-zmeny.txt          popis verze z CHANGELOG.md a seznam změněných souborů
#                         oproti nejbližší předchozí archivované verzi
#
# Podmínka: v CHANGELOG.md musí existovat sekce "## Verze N".

param(
  [Parameter(Mandatory)] [string] $Version,
  [switch] $Force
)

$ErrorActionPreference = 'Stop'

if ($Version -notmatch '^\d+(\.\d+)*$') {
  throw "Neplatné označení verze '$Version'. Použij čísla oddělená tečkou, např. 0.1."
}

# Označení verze → porovnatelné číslo (0 → 0.0, 0.1 → 0.1).
function ConvertTo-VersionNumber([string] $text) {
  if ($text -notmatch '\.') { $text = "$text.0" }
  return [version]$text
}

$currentNumber = ConvertTo-VersionNumber $Version
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
$archiveDir = Join-Path $root 'archiv'
$changelogPath = Join-Path $root 'CHANGELOG.md'
$excluded = @('node_modules', 'archiv', '.claude', 'dist')

$zipPath = Join-Path $archiveDir "dragon-souls-v$Version.zip"
$manifestPath = Join-Path $archiveDir "v$Version-soubory.json"
$changesPath = Join-Path $archiveDir "v$Version-zmeny.txt"

# --- popis verze z CHANGELOG.md -------------------------------------------
$changelog = [System.IO.File]::ReadAllText($changelogPath, [System.Text.Encoding]::UTF8)
$pattern = "(?ms)^## Verze $([regex]::Escape($Version))(?![\d.]).*?(?=^## Verze |\z)"
$section = [regex]::Match($changelog, $pattern)

if (-not $section.Success) {
  throw "V CHANGELOG.md chybí sekce '## Verze $Version'. Nejdřív popiš, co se změnilo."
}

if ((Test-Path $zipPath) -and -not $Force) {
  throw "Verze $Version už je archivovaná ($zipPath). Pro přepsání přidej -Force."
}

New-Item -ItemType Directory -Force $archiveDir | Out-Null

# --- seznam souborů a jejich otisky --------------------------------------
$files = Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object {
  $relative = $_.FullName.Substring($root.Length + 1)
  $top = $relative.Split([char[]]@('\', '/'))[0]
  $excluded -notcontains $top
}

$manifest = [ordered]@{}
foreach ($file in ($files | Sort-Object FullName)) {
  $relative = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
  $manifest[$relative] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
}

# --- porovnání s předchozí verzí -----------------------------------------
$previous = Get-ChildItem -LiteralPath $archiveDir -Filter 'v*-soubory.json' |
  ForEach-Object {
    if ($_.Name -match '^v([\d.]+)-soubory\.json$') {
      $number = ConvertTo-VersionNumber $Matches[1]
      if ($number -lt $currentNumber) {
        [pscustomobject]@{ Version = $Matches[1]; Number = $number; Path = $_.FullName }
      }
    }
  } |
  Sort-Object Number -Descending |
  Select-Object -First 1

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("Dragon Souls – verze $Version")
$lines.Add("Archivováno: $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
$lines.Add("Souborů: $($manifest.Count)")
$lines.Add('')
$lines.Add($section.Value.Trim())
$lines.Add('')
$lines.Add('---')

if ($previous) {
  $old = @{}
  $json = Get-Content -LiteralPath $previous.Path -Raw -Encoding UTF8 | ConvertFrom-Json
  $json.PSObject.Properties | ForEach-Object { $old[$_.Name] = $_.Value }

  $added = @($manifest.Keys | Where-Object { -not $old.ContainsKey($_) })
  $changed = @($manifest.Keys | Where-Object { $old.ContainsKey($_) -and $old[$_] -ne $manifest[$_] })
  $removed = @($old.Keys | Where-Object { -not $manifest.Contains($_) } | Sort-Object)

  $lines.Add("Změny souborů oproti verzi $($previous.Version):")
  foreach ($group in @(
      @('Přidáno', $added),
      @('Změněno', $changed),
      @('Smazáno', $removed)
    )) {
    $lines.Add('')
    $lines.Add("$($group[0]) ($($group[1].Count)):")
    foreach ($path in $group[1]) { $lines.Add("  $path") }
  }
} else {
  $lines.Add('První archivovaná verze – není s čím porovnávat.')
}

# --- zápis výstupů -------------------------------------------------------
$utf8 = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllLines($changesPath, $lines, $utf8)
[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json), $utf8)

if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath }

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
try {
  foreach ($relative in $manifest.Keys) {
    $full = Join-Path $root $relative
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip, $full, $relative, [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
} finally {
  $zip.Dispose()
}

$sizeMb = [math]::Round((Get-Item -LiteralPath $zipPath).Length / 1MB, 1)
Write-Host "Verze $Version archivována: $zipPath ($sizeMb MB, $($manifest.Count) souborů)"
Write-Host "Přehled změn: $changesPath"
