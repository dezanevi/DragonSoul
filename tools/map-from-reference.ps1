# Převede izometrický referenční obrázek mapy na textový grid polí.
#
# Každé logické pole se promítne do izometrie stejně jako ve hře
# (src/world/iso.js), na jeho místě se v obrázku změří průměrná barva
# a podle ní se pole zařadí: voda, útes, tráva, louka, cesta, parcela, dlažba.
#
# Obrázek se ve světě umístí doprostřed izometrického kosočtverce mapy
# a bude široký -WorldWidth px (stejné umístění používá hra pro klávesu R).
#
# Použití:
#   powershell -File tools/map-from-reference.ps1 -Image public/assets/greenvale/greenvale-map.png `
#     -Tiles 64 -WorldWidth 3840 -Out tools/greenvale-grid.txt -Preview tools/greenvale-grid.png

param(
  [Parameter(Mandatory)] [string] $Image,
  [int] $Tiles = 64,
  [int] $WorldWidth = 3840,
  [string] $Out = 'tools/map-grid.txt',
  [string] $Preview = ''
)

Add-Type -AssemblyName System.Drawing

$TileSize = 64
$bitmap = New-Object System.Drawing.Bitmap (Resolve-Path $Image).Path
$imgW = $bitmap.Width
$imgH = $bitmap.Height

$rect = New-Object System.Drawing.Rectangle 0, 0, $imgW, $imgH
$data = $bitmap.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $imgH)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$bitmap.UnlockBits($data)
$bitmap.Dispose()

# Umístění obrázku ve světě (px izometrické obrazovky).
$isoW = ($Tiles + $Tiles) * 64
$isoH = ($Tiles + $Tiles) * 32
$worldH = $WorldWidth * $imgH / $imgW
$imgLeft = ($isoW - $WorldWidth) / 2
$imgTop = ($isoH - $worldH) / 2
$scale = $imgW / $WorldWidth
$originX = $Tiles * $TileSize

function Get-Color([double] $ix, [double] $iy) {
  $r = 0; $g = 0; $b = 0; $n = 0
  foreach ($dx in -10, 0, 10) {
    foreach ($dy in -6, 0, 6) {
      $x = [int]($ix + $dx); $y = [int]($iy + $dy)
      if ($x -lt 0 -or $y -lt 0 -or $x -ge $imgW -or $y -ge $imgH) { continue }
      $o = $y * $stride + $x * 4
      $b += $bytes[$o]; $g += $bytes[$o + 1]; $r += $bytes[$o + 2]; $n++
    }
  }
  if ($n -eq 0) { return $null }
  return @(($r / $n), ($g / $n), ($b / $n))
}

# Barva → znak. Útesy se neurčují barvou (pletou se s cestami),
# ale tvarem: pevnina sousedící s vodou se později změní na útes.
function Get-Char($c) {
  if ($null -eq $c) { return '~' }
  $r = $c[0]; $g = $c[1]; $b = $c[2]

  if ($b -gt $g -and $b -gt $r + 20) { return '~' }
  if ($g -gt $r + 10 -and $g -gt $b + 20) {
    if ($g -lt 130 -or $r -lt 90) { return ',' }
    return '.'
  }
  if ($r -ge 238 -and ($r - $b) -ge 125) { return '_' }
  if ($r -ge 205 -and $g -ge 170) { return ':' }
  if (($r - $b) -lt 70 -and $g -gt 140) { return '#' }
  return '.'
}

$rows = New-Object System.Collections.Generic.List[string]
for ($ty = 0; $ty -lt $Tiles; $ty++) {
  $line = New-Object System.Text.StringBuilder
  for ($tx = 0; $tx -lt $Tiles; $tx++) {
    $lx = ($tx + 0.5) * $TileSize
    $ly = ($ty + 0.5) * $TileSize
    $sx = $originX + ($lx - $ly)
    $sy = ($lx + $ly) / 2
    $ix = ($sx - $imgLeft) * $scale
    $iy = ($sy - $imgTop) * $scale
    [void]$line.Append((Get-Char (Get-Color $ix $iy)))
  }
  $rows.Add($line.ToString())
}

# --- úpravy tvaru ------------------------------------------------------
$grid = @()
foreach ($row in $rows) { $grid += , ($row.ToCharArray()) }

function Get-At($x, $y) {
  if ($x -lt 0 -or $y -lt 0 -or $x -ge $Tiles -or $y -ge $Tiles) { return '~' }
  return $grid[$y][$x]
}

# 1) Osamělá pole (jiná než všichni 4 sousedé) převezmou nejčastějšího souseda.
for ($pass = 0; $pass -lt 2; $pass++) {
  $copy = @(); foreach ($line in $grid) { $copy += , ($line.Clone()) }
  for ($y = 0; $y -lt $Tiles; $y++) {
    for ($x = 0; $x -lt $Tiles; $x++) {
      $me = $grid[$y][$x]
      $n = @((Get-At ($x - 1) $y), (Get-At ($x + 1) $y), (Get-At $x ($y - 1)), (Get-At $x ($y + 1)))
      if (-not ($n -contains $me)) {
        $copy[$y][$x] = ($n | Group-Object | Sort-Object Count -Descending | Select-Object -First 1).Name[0]
      }
    }
  }
  $grid = $copy
}

# 2) Útesy: tráva, louka a parcely sousedící s vodou (i úhlopříčně).
#    Cesty a dlažba zůstanou, aby nezmizel most a cesty k vodě.
$copy = @(); foreach ($line in $grid) { $copy += , ($line.Clone()) }
for ($y = 0; $y -lt $Tiles; $y++) {
  for ($x = 0; $x -lt $Tiles; $x++) {
    if ('.,_'.IndexOf($grid[$y][$x]) -lt 0) { continue }
    $nearWater = $false
    foreach ($dy in -1, 0, 1) { foreach ($dx in -1, 0, 1) { if ((Get-At ($x + $dx) ($y + $dy)) -eq '~') { $nearWater = $true } } }
    if ($nearWater) { $copy[$y][$x] = '^' }
  }
}
$grid = $copy

$rows = New-Object System.Collections.Generic.List[string]
foreach ($line in $grid) { $rows.Add((-join $line)) }

function Resolve-OutPath([string] $path) {
  if ([System.IO.Path]::IsPathRooted($path)) { return $path }
  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $path))
}

$outPath = Resolve-OutPath $Out
[System.IO.File]::WriteAllLines($outPath, $rows)
Write-Host "Grid $Tiles x $Tiles ulozen do $Out (obrazek ve svete: x $imgLeft, y $imgTop, sirka $WorldWidth)"

if ($Preview) {
  $colors = @{
    '~' = [System.Drawing.Color]::FromArgb(58, 111, 154); '.' = [System.Drawing.Color]::FromArgb(106, 154, 80)
    ',' = [System.Drawing.Color]::FromArgb(70, 120, 55); ':' = [System.Drawing.Color]::FromArgb(220, 190, 130)
    '_' = [System.Drawing.Color]::FromArgb(168, 133, 96); '#' = [System.Drawing.Color]::FromArgb(190, 180, 165)
    '^' = [System.Drawing.Color]::FromArgb(110, 95, 85)
  }
  # Náhled v izometrii (zmenšený 1 : 8), aby šel porovnat s obrázkem.
  $k = 8
  $previewBitmap = New-Object -TypeName System.Drawing.Bitmap -ArgumentList ([int]($isoW / $k)), ([int]($isoH / $k))
  $gr = [System.Drawing.Graphics]::FromImage($previewBitmap)
  $gr.Clear([System.Drawing.Color]::Black)
  for ($y = 0; $y -lt $Tiles; $y++) {
    for ($x = 0; $x -lt $Tiles; $x++) {
      $pts = foreach ($c in @(@($x, $y), @(($x + 1), $y), @(($x + 1), ($y + 1)), @($x, ($y + 1)))) {
        $lx = $c[0] * $TileSize; $ly = $c[1] * $TileSize
        New-Object System.Drawing.PointF -ArgumentList ([float](($originX + $lx - $ly) / $k)), ([float]((($lx + $ly) / 2) / $k))
      }
      $brush = New-Object System.Drawing.SolidBrush -ArgumentList $colors[[string]$rows[$y][$x]]
      $gr.FillPolygon($brush, [System.Drawing.PointF[]]$pts)
      $brush.Dispose()
    }
  }
  $gr.Dispose()
  $previewBitmap.Save((Resolve-OutPath $Preview), [System.Drawing.Imaging.ImageFormat]::Png)
  $previewBitmap.Dispose()
}
