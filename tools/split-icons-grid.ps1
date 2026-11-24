# Rozdělí list ikon s pravidelnou mřížkou (šedé čáry, světlé pozadí) na jednotlivé PNG.
# Každá buňka se vyřízne kousek uvnitř čar, světlé pozadí spojené s okrajem zprůhlední,
# výřez se ořízne na obsah. Pořadí: po řádcích zleva doprava, klíč <Sheet>_NNN.
#
# Použití (čáry mřížky v pixelech, odděleně čárkou):
#   powershell -File tools/split-icons-grid.ps1 -Source list.png -Sheet icons10 `
#     -Cols 12,106,200,294,387,481,576,671,767,862,957,1051,1146,1240,1333,1428,1522 `
#     -Rows 29,145,262,379,492,608,724,859,981 -TargetDir out -Manifest out/manifest.json

param(
  [Parameter(Mandatory = $true)] [string] $Source,
  [Parameter(Mandatory = $true)] [string] $Sheet,
  [Parameter(Mandatory = $true)] [int[]] $Cols,
  [Parameter(Mandatory = $true)] [int[]] $Rows,
  [string] $TargetDir = 'public/assets/items/icons',
  [string] $Manifest = '',
  [int] $Inset = 4,
  [int] $Padding = 3,
  # Uzavřené světlé otvory aspoň této plochy (px) se také zprůhlední; 0 = vypnuto.
  [int] $HoleArea = 150
)

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class GridIconCutter {
  static bool IsBackground(byte[] p, int i) {
    int b = p[i], g = p[i + 1], r = p[i + 2];
    int mn = Math.Min(r, Math.Min(g, b)), mx = Math.Max(r, Math.Max(g, b));
    return mn >= 214 && mx - mn < 26;
  }

  // Vrací výřez s průhledným pozadím oříznutý na obsah (+ padding), nebo null pro prázdnou buňku.
  public static Bitmap Cut(Bitmap src, int x, int y, int w, int h, int pad, int holeArea) {
    var cell = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(cell)) g.DrawImage(src, new Rectangle(0, 0, w, h), new Rectangle(x, y, w, h), GraphicsUnit.Pixel);
    var data = cell.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = data.Stride;
    var px = new byte[stride * h];
    Marshal.Copy(data.Scan0, px, 0, px.Length);

    var removed = new bool[w * h];
    var stack = new Stack<int>();
    Action<int, int> push = (cx, cy) => {
      int p = cy * w + cx;
      if (removed[p] || !IsBackground(px, cy * stride + cx * 4)) return;
      removed[p] = true; stack.Push(p);
    };
    for (int i = 0; i < w; i++) { push(i, 0); push(i, h - 1); }
    for (int i = 0; i < h; i++) { push(0, i); push(w - 1, i); }
    while (stack.Count > 0) {
      int p = stack.Pop(); int cx = p % w, cy = p / w;
      px[cy * stride + cx * 4 + 3] = 0;
      if (cx > 0) push(cx - 1, cy);
      if (cx < w - 1) push(cx + 1, cy);
      if (cy > 0) push(cx, cy - 1);
      if (cy < h - 1) push(cx, cy + 1);
    }
    // Uzavřené otvory (vnitřek prstenu, řetízku): souvislé pozadí o ploše >= holeArea.
    if (holeArea > 0) {
      var seen = new bool[w * h];
      var region = new List<int>();
      for (int s0 = 0; s0 < w * h; s0++) {
        if (removed[s0] || seen[s0] || !IsBackground(px, (s0 / w) * stride + (s0 % w) * 4)) continue;
        region.Clear(); seen[s0] = true; stack.Push(s0);
        while (stack.Count > 0) {
          int p = stack.Pop(); region.Add(p); int cx = p % w, cy = p / w;
          int[] nb = { cx > 0 ? p - 1 : -1, cx < w - 1 ? p + 1 : -1, cy > 0 ? p - w : -1, cy < h - 1 ? p + w : -1 };
          foreach (int q in nb) {
            if (q < 0 || seen[q] || removed[q] || !IsBackground(px, (q / w) * stride + (q % w) * 4)) continue;
            seen[q] = true; stack.Push(q);
          }
        }
        if (region.Count < holeArea) continue;
        foreach (int p in region) { removed[p] = true; px[(p / w) * stride + (p % w) * 4 + 3] = 0; }
      }
    }
    int x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (int cy = 0; cy < h; cy++) for (int cx = 0; cx < w; cx++) {
      int p = cy * w + cx;
      if (removed[p]) continue;
      int i = cy * stride + cx * 4;
      bool edge = (cx > 0 && removed[p - 1]) || (cx < w - 1 && removed[p + 1]) || (cy > 0 && removed[p - w]) || (cy < h - 1 && removed[p + w]);
      if (edge) {
        int bright = Math.Min(px[i], Math.Min(px[i + 1], px[i + 2]));
        if (bright > 185) px[i + 3] = (byte)(px[i + 3] * Math.Max(0.0, 1.0 - (bright - 185) / 60.0));
      }
      if (px[i + 3] < 24) continue;
      if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
    }
    Marshal.Copy(px, 0, data.Scan0, px.Length);
    cell.UnlockBits(data);
    if (x1 < 0) { cell.Dispose(); return null; }
    x0 = Math.Max(0, x0 - pad); y0 = Math.Max(0, y0 - pad);
    x1 = Math.Min(w - 1, x1 + pad); y1 = Math.Min(h - 1, y1 + pad);
    var outBmp = cell.Clone(new Rectangle(x0, y0, x1 - x0 + 1, y1 - y0 + 1), PixelFormat.Format32bppArgb);
    cell.Dispose();
    return outBmp;
  }
}
'@

New-Item -ItemType Directory -Force $TargetDir | Out-Null
$target = (Resolve-Path $TargetDir).Path
$bitmap = New-Object System.Drawing.Bitmap ((Resolve-Path $Source).Path)
$entries = @()
$index = 0
for ($r = 0; $r -lt $Rows.Count - 1; $r++) {
  for ($c = 0; $c -lt $Cols.Count - 1; $c++) {
    $x = $Cols[$c] + $Inset; $y = $Rows[$r] + $Inset
    $w = $Cols[$c + 1] - $Inset - $x; $h = $Rows[$r + 1] - $Inset - $y
    $icon = [GridIconCutter]::Cut($bitmap, $x, $y, $w, $h, $Padding, $HoleArea)
    if (-not $icon) { continue }
    $index++
    $key = '{0}_{1:000}' -f $Sheet, $index
    $icon.Save((Join-Path $target "$key.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $entries += [ordered]@{ key = $key; file = "assets/items/icons/$key.png"; sheet = $Sheet; index = $index; w = $icon.Width; h = $icon.Height }
    $icon.Dispose()
  }
}
$bitmap.Dispose()
if ($Manifest) {
  $manifestPath = if ([System.IO.Path]::IsPathRooted($Manifest)) { $Manifest } else { Join-Path (Get-Location).Path $Manifest }
  [System.IO.File]::WriteAllText($manifestPath,($entries | ConvertTo-Json -Depth 3), (New-Object System.Text.UTF8Encoding $false))
}
Write-Output ("{0}: {1} ikon" -f $Sheet, $index)
