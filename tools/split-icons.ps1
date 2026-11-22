# Rozdělí listy ikon (bílé pozadí) na jednotlivé obrázky s průhledným pozadím.
#
# Postup pro každý list:
#   1. Maska = pixely, které nejsou bílé pozadí.
#   2. Maska se rozšíří o -Merge px, aby se k ikoně přidaly i odlesky a jiskry kolem ní.
#   3. Spojité oblasti = ikony (malé zbytky se zahodí), seřazené po řádcích zleva doprava.
#   4. Každá ikona se vyřízne, bílá dotýkající se okraje výřezu zprůhlední a uloží se jako PNG.
#   5. Seznam ikon se zapíše do src/data/itemIcons.json (klíč, soubor, list, pořadí).
#
# Použití:
#   powershell -File tools/split-icons.ps1
#   powershell -File tools/split-icons.ps1 -Sheets icons01,icons02 -Merge 6

param(
  [string[]] $Sheets = @('icons01', 'icons02', 'icons03', 'icons04', 'icons05', 'icons06'),
  [string] $SourceDir = 'public/assets/ui/inventory',
  [string] $TargetDir = 'public/assets/items/icons',
  [string] $Manifest = 'src/data/itemIcons.json',
  [int] $Merge = 5,
  [int] $MinArea = 900,
  [int] $Padding = 3
)

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class IconSplitter {
  static bool IsWhite(byte[] p, int i) {
    int b = p[i], g = p[i + 1], r = p[i + 2], a = p[i + 3];
    if (a < 10) return true;
    int mn = Math.Min(r, Math.Min(g, b)), mx = Math.Max(r, Math.Max(g, b));
    return mn >= 232 && mx - mn < 24;
  }

  // Pásy: řady podle vodorovných mezer, v každé řadě sloupce podle svislých mezer.
  // Slepené úseky (delší než 1,45× běžná velikost ikony) se rozdělí v nejtenčím místě.
  static List<int[]> Runs(int[] profile, int threshold, int minLen) {
    var runs = new List<int[]>(); int s = -1;
    for (int i = 0; i <= profile.Length; i++) {
      bool on = i < profile.Length && profile[i] > threshold;
      if (on && s < 0) s = i;
      if (!on && s >= 0) { if (i - s >= minLen) runs.Add(new int[] { s, i - 1 }); s = -1; }
    }
    return runs;
  }

  static List<int[]> SplitWide(List<int[]> runs, int[] profile, double typical) {
    var result = new List<int[]>();
    foreach (var r in runs) {
      int len = r[1] - r[0] + 1;
      int parts = (int)Math.Round(len / typical);
      if (len < typical * 1.45 || parts < 2) { result.Add(r); continue; }
      int start = r[0];
      for (int k = 1; k < parts; k++) {
        int target = r[0] + (int)(len * k / (double)parts);
        int best = target, bestVal = int.MaxValue;
        for (int i = Math.Max(start + 10, target - 18); i <= Math.Min(r[1] - 10, target + 18); i++)
          if (profile[i] < bestVal) { bestVal = profile[i]; best = i; }
        result.Add(new int[] { start, best - 1 });
        start = best + 1;
      }
      result.Add(new int[] { start, r[1] });
    }
    return result;
  }

  static double Median(List<int[]> runs) {
    var lens = new List<int>(); foreach (var r in runs) lens.Add(r[1] - r[0] + 1);
    lens.Sort(); return lens.Count == 0 ? 90 : lens[lens.Count / 2];
  }

  public static List<int[]> Find(Bitmap bmp, int merge, int minArea) {
    int w = bmp.Width, h = bmp.Height;
    var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    var px = new byte[data.Stride * h];
    Marshal.Copy(data.Scan0, px, 0, px.Length);
    int stride = data.Stride;
    bmp.UnlockBits(data);

    var solid = new bool[w * h];
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) solid[y * w + x] = !IsWhite(px, y * stride + x * 4);

    var rowProfile = new int[h];
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) if (solid[y * w + x]) rowProfile[y]++;
    var rows = Runs(rowProfile, 2, 12);
    double rowTypical = Math.Min(Median(rows), 104);
    rows = SplitWide(rows, rowProfile, rowTypical);

    var boxes = new List<int[]>();
    foreach (var row in rows) {
      var colProfile = new int[w];
      for (int y = row[0]; y <= row[1]; y++) for (int x = 0; x < w; x++) if (solid[y * w + x]) colProfile[x]++;
      var cols = Runs(colProfile, 1, 12);
      cols = SplitWide(cols, colProfile, Math.Min(Median(cols), 96));
      foreach (var col in cols) {
        int x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0;
        for (int y = row[0]; y <= row[1]; y++) for (int x = col[0]; x <= col[1]; x++) {
          if (!solid[y * w + x]) continue;
          area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        if (area >= minArea) boxes.Add(new int[] { x0, y0, x1 - x0 + 1, y1 - y0 + 1 });
      }
    }
    return boxes;
  }

  // Výřez + bílá od okraje → průhledná, světlý lem se zjemní.
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
      if (removed[p]) return;
      if (!IsWhite(px, cy * stride + cx * 4)) return;
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
$entries = @()

foreach ($sheet in $Sheets) {
  $path = Join-Path $SourceDir "$sheet.png"
  $bitmap = New-Object System.Drawing.Bitmap ((Resolve-Path $path).Path)
  $boxes = [IconSplitter]::Find($bitmap, $Merge, $MinArea)

  # Řazení po řádcích: ikona patří do řádku, pokud její střed leží v pásu předchozí ikony.
  $sorted = $boxes | Sort-Object { $_[1] + $_[3] / 2 }
  $rows = @()
  foreach ($box in $sorted) {
    $cy = $box[1] + $box[3] / 2
    $row = $rows | Where-Object { [math]::Abs($_.cy - $cy) -lt 40 } | Select-Object -First 1
    if ($row) { $row.items += , $box } else { $rows += [pscustomobject]@{ cy = $cy; items = @(, $box) } }
  }

  $index = 0
  foreach ($row in ($rows | Sort-Object cy)) {
    foreach ($box in ($row.items | Sort-Object { $_[0] })) {
      $index++
      $x = [math]::Max(0, $box[0] - $Padding)
      $y = [math]::Max(0, $box[1] - $Padding)
      $w = [math]::Min($bitmap.Width - $x, $box[2] + 2 * $Padding)
      $h = [math]::Min($bitmap.Height - $y, $box[3] + 2 * $Padding)
      $key = '{0}_{1:000}' -f $sheet, $index
      $icon = [IconSplitter]::Cut($bitmap, $x, $y, $w, $h)
      $icon.Save((Join-Path (Resolve-Path $TargetDir).Path "$key.png"), [System.Drawing.Imaging.ImageFormat]::Png)
      $icon.Dispose()
      $entries += [ordered]@{ key = $key; file = "assets/items/icons/$key.png"; sheet = $sheet; index = $index; w = $w; h = $h }
    }
  }
  $bitmap.Dispose()
  Write-Output ("{0}: {1} ikon" -f $sheet, $index)
}

$json = $entries | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $Manifest), $json, (New-Object System.Text.UTF8Encoding $false))
Write-Output ("Celkem {0} ikon, seznam: {1}" -f $entries.Count, $Manifest)
