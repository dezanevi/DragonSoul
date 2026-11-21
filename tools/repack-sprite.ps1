# Přebalí spritesheet s nepravidelně rozmístěnými snímky do pravidelné mřížky.
#
# Postup:
#   1. Najde sloupce a řady podle průhledných mezer mezi postavami.
#   2. Každý snímek vyřízne a vloží do rámečku FrameWidth × FrameHeight.
#   3. Vodorovně zarovná podle středu sloupce, svisle podle spodku řady
#      (nohy jsou v celé řadě na stejné lince, pohyb v animaci zůstane zachovaný).
#
# Použití:
#   powershell -File tools/repack-sprite.ps1 -Source public/assets/hero/hero-walk-source.png `
#     -Target public/assets/hero/hero-walk.png -FrameWidth 192 -FrameHeight 256 -BottomPadding 8

param(
  [Parameter(Mandatory)] [string] $Source,
  [Parameter(Mandatory)] [string] $Target,
  [int] $FrameWidth = 192,
  [int] $FrameHeight = 256,
  [int] $BottomPadding = 8,
  [int] $AlphaThreshold = 40
)

Add-Type -AssemblyName System.Drawing

$sourcePath = (Resolve-Path $Source).Path
$bitmap = New-Object System.Drawing.Bitmap $sourcePath
$width = $bitmap.Width
$height = $bitmap.Height

$rect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
$data = $bitmap.LockBits(
  $rect,
  [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $height)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$bitmap.UnlockBits($data)

$columnSum = New-Object int[] $width
$rowSum = New-Object int[] $height

for ($y = 0; $y -lt $height; $y++) {
  $offset = $y * $stride
  for ($x = 0; $x -lt $width; $x++) {
    if ($bytes[$offset + $x * 4 + 3] -gt $AlphaThreshold) {
      $columnSum[$x]++
      $rowSum[$y]++
    }
  }
}

function Get-Bands([int[]] $values) {
  $bands = @()
  $inside = $false
  $start = 0

  for ($i = 0; $i -lt $values.Length; $i++) {
    if ($values[$i] -gt 0 -and -not $inside) {
      $inside = $true
      $start = $i
    } elseif ($values[$i] -eq 0 -and $inside) {
      $inside = $false
      $bands += , @($start, ($i - 1))
    }
  }

  if ($inside) { $bands += , @($start, ($values.Length - 1)) }
  return , $bands
}

$columns = Get-Bands $columnSum
$rows = Get-Bands $rowSum

Write-Host "Nalezeno sloupců: $($columns.Count), řad: $($rows.Count)"

$output = New-Object System.Drawing.Bitmap (
  ($FrameWidth * $columns.Count),
  ($FrameHeight * $rows.Count),
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$graphics = [System.Drawing.Graphics]::FromImage($output)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

for ($r = 0; $r -lt $rows.Count; $r++) {
  $rowTop = $rows[$r][0]
  $rowBottom = $rows[$r][1]
  $rowHeight = $rowBottom - $rowTop + 1

  for ($c = 0; $c -lt $columns.Count; $c++) {
    $columnLeft = $columns[$c][0]
    $columnRight = $columns[$c][1]
    $columnWidth = $columnRight - $columnLeft + 1

    if ($columnWidth -gt $FrameWidth -or ($rowHeight + $BottomPadding) -gt $FrameHeight) {
      throw "Snímek [$r,$c] ($columnWidth × $rowHeight) se nevejde do rámečku $FrameWidth × $FrameHeight."
    }

    $targetX = $c * $FrameWidth + [Math]::Floor(($FrameWidth - $columnWidth) / 2)
    $targetY = ($r + 1) * $FrameHeight - $BottomPadding - $rowHeight

    $sourceRect = New-Object System.Drawing.Rectangle $columnLeft, $rowTop, $columnWidth, $rowHeight
    $targetRect = New-Object System.Drawing.Rectangle $targetX, $targetY, $columnWidth, $rowHeight

    $graphics.DrawImage($bitmap, $targetRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
  }
}

$graphics.Dispose()
$bitmap.Dispose()

$targetPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Target))
$output.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
$output.Dispose()

Write-Host "Uloženo: $targetPath ($($FrameWidth * $columns.Count) × $($FrameHeight * $rows.Count), snímek $FrameWidth × $FrameHeight)"
