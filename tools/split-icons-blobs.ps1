# Rozdělí list velkých ikon na bílém pozadí (bez mřížky) na jednotlivé PNG.
# Na rozdíl od split-icons.ps1 nepředpokládá velikost ikony ~90 px: maska nebílých pixelů
# se rozšíří o -Merge px (jiskry a odlesky se připojí k ikoně), spojité oblasti = ikony.
# Pořadí: po řádcích (podle středu) zleva doprava, klíč <Sheet>_NNN.
#
# Použití:
#   powershell -File tools/split-icons-blobs.ps1 -Source list.png -Sheet icons09 -TargetDir out -Manifest out/m.json

param(
  [Parameter(Mandatory = $true)] [string] $Source,
  [Parameter(Mandatory = $true)] [string] $Sheet,
  [string] $TargetDir = 'public/assets/items/icons',
  [string] $Manifest = '',
  [int] $Merge = 14,
  [int] $MinArea = 2500,
  [int] $Padding = 3,
  [int] $RowTolerance = 60
)

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class BlobIconSplitter {
  static bool IsWhite(byte[] p, int i) {
    int b = p[i], g = p[i + 1], r = p[i + 2], a = p[i + 3];
    if (a < 10) return true;
    int mn = Math.Min(r, Math.Min(g, b)), mx = Math.Max(r, Math.Max(g, b));
    return mn >= 232 && mx - mn < 24;
  }

  public static byte[] Pixels(Bitmap bmp, out int stride) {
    var data = bmp.LockBits(new Rectangle(0, 0, bmp.Width, bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    stride = data.Stride;
    var px = new byte[stride * bmp.Height];
    Marshal.Copy(data.Scan0, px, 0, px.Length);
    bmp.UnlockBits(data);
    return px;
  }

  // Vrací [x, y, w, h] každé oblasti (bez rozšíření masky) s plochou >= minArea.
  public static List<int[]> Find(Bitmap bmp, int merge, int minArea) {
    int w = bmp.Width, h = bmp.Height, stride;
    var px = Pixels(bmp, out stride);
    var solid = new bool[w * h];
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) solid[y * w + x] = !IsWhite(px, y * stride + x * 4);

    // Rozšíření masky (čtverec merge×merge) přes dva průchody.
    var horiz = new bool[w * h];
    for (int y = 0; y < h; y++) {
      int last = -100000;
      for (int x = 0; x < w; x++) if (solid[y * w + x]) last = x; else if (x - last <= merge) horiz[y * w + x] = true;
      last = 100000;
      for (int x = w - 1; x >= 0; x--) if (solid[y * w + x]) last = x; else if (last - x <= merge) horiz[y * w + x] = true;
      for (int x = 0; x < w; x++) if (solid[y * w + x]) horiz[y * w + x] = true;
    }
    var grown = new bool[w * h];
    for (int x = 0; x < w; x++) {
      int last = -100000;
      for (int y = 0; y < h; y++) if (horiz[y * w + x]) last = y; else if (y - last <= merge) grown[y * w + x] = true;
      last = 100000;
      for (int y = h - 1; y >= 0; y--) if (horiz[y * w + x]) last = y; else if (last - y <= merge) grown[y * w + x] = true;
      for (int y = 0; y < h; y++) if (horiz[y * w + x]) grown[y * w + x] = true;
    }

    var label = new int[w * h];
    var boxes = new List<int[]>();
    var stack = new Stack<int>();
    int next = 0;
    for (int start = 0; start < w * h; start++) {
      if (!grown[start] || label[start] != 0) continue;
      next++;
      int x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0;
      label[start] = next; stack.Push(start);
      while (stack.Count > 0) {
        int p = stack.Pop(); int cx = p % w, cy = p / w;
        if (solid[p]) { area++; if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy; }
        if (cx > 0 && grown[p - 1] && label[p - 1] == 0) { label[p - 1] = next; stack.Push(p - 1); }
        if (cx < w - 1 && grown[p + 1] && label[p + 1] == 0) { label[p + 1] = next; stack.Push(p + 1); }
        if (cy > 0 && grown[p - w] && label[p - w] == 0) { label[p - w] = next; stack.Push(p - w); }
        if (cy < h - 1 && grown[p + w] && label[p + w] == 0) { label[p + w] = next; stack.Push(p + w); }
      }
      if (area >= minArea) boxes.Add(new int[] { x0, y0, x1 - x0 + 1, y1 - y0 + 1 });
    }
    return boxes;
  }

  // Výřez; bílá spojená s okrajem zprůhlední, světlý lem se zjemní.
  public static Bitmap Cut(Bitmap src, int x, int y, int w, int h) {
    var outBmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(outBmp)) g.DrawImage(src, new Rectangle(0, 0, w, h), new Rectangle(x, y, w, h), GraphicsUnit.Pixel);
    var data = outBmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = data.Stride;
    var px = new byte[stride * h];
    Marshal.Copy(data.Scan0, px, 0, px.Length);
    var removed = new bool[w * h];
    var stack = new Stack<int>();
    Action<int, int> push = (cx, cy) => {
      int p = cy * w + cx;
      if (removed[p] || !IsWhite(px, cy * stride + cx * 4)) return;
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
    for (int cy = 1; cy < h - 1; cy++) for (int cx = 1; cx < w - 1; cx++) {
      int p = cy * w + cx;
      if (removed[p]) continue;
      if (!(removed[p - 1] || removed[p + 1] || removed[p - w] || removed[p + w])) continue;
      int i = cy * stride + cx * 4;
      int bright = Math.Min(px[i], Math.Min(px[i + 1], px[i + 2]));
      if (bright > 190) px[i + 3] = (byte)(px[i + 3] * Math.Max(0.0, 1.0 - (bright - 190) / 65.0));
    }
    Marshal.Copy(px, 0, data.Scan0, px.Length);
    outBmp.UnlockBits(data);
    return outBmp;
  }
}
'@

New-Item -ItemType Directory -Force $TargetDir | Out-Null
$target = (Resolve-Path $TargetDir).Path
$bitmap = New-Object System.Drawing.Bitmap ((Resolve-Path $Source).Path)
$boxes = [BlobIconSplitter]::Find($bitmap, $Merge, $MinArea)

$rows = @()
foreach ($box in ($boxes | Sort-Object { $_[1] + $_[3] / 2 })) {
  $cy = $box[1] + $box[3] / 2
  $row = $rows | Where-Object { [math]::Abs($_.cy - $cy) -lt $RowTolerance } | Select-Object -First 1
  if ($row) { $row.items += , $box } else { $rows += [pscustomobject]@{ cy = $cy; items = @(, $box) } }
}

$entries = @()
$index = 0
$summary = @()
foreach ($row in ($rows | Sort-Object cy)) {
  $summary += $row.items.Count
  foreach ($box in ($row.items | Sort-Object { $_[0] })) {
    $index++
    $x = [math]::Max(0, $box[0] - $Padding)
    $y = [math]::Max(0, $box[1] - $Padding)
    $w = [math]::Min($bitmap.Width - $x, $box[2] + 2 * $Padding)
    $h = [math]::Min($bitmap.Height - $y, $box[3] + 2 * $Padding)
    $key = '{0}_{1:000}' -f $Sheet, $index
    $icon = [BlobIconSplitter]::Cut($bitmap, $x, $y, $w, $h)
    $icon.Save((Join-Path $target "$key.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $icon.Dispose()
    $entries += [ordered]@{ key = $key; file = "assets/items/icons/$key.png"; sheet = $Sheet; index = $index; w = $w; h = $h }
  }
}
$bitmap.Dispose()
if ($Manifest) {
  $manifestPath = if ([System.IO.Path]::IsPathRooted($Manifest)) { $Manifest } else { Join-Path (Get-Location).Path $Manifest }
  [System.IO.File]::WriteAllText($manifestPath, ($entries | ConvertTo-Json -Depth 3), (New-Object System.Text.UTF8Encoding $false))
}
Write-Output ("{0}: {1} ikon, řady: {2}" -f $Sheet, $index, ($summary -join ' '))
