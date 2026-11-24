# Odstraní bílý lem kolem dílů nové UI sady (zbytek bílého pozadí smíchaný do hran).
#
# Pro pixely v pásu -Band px od průhledné plochy, které jsou světlé (nejtmavší kanál >= -MinLight):
#   krytí = (255 - nejtmavší kanál) / (255 - -EdgeDark)   – bílá příměs se odečte,
#   barva = (pozorovaná − (1 − krytí) × bílá) / krytí       – vrátí se barva bez bílé.
# Uvnitř dílů (dál od průhledné plochy) se nic nemění, takže odlesky zůstávají.
#
# Použití:
#   powershell -ExecutionPolicy Bypass -File tools/defringe-newui.ps1
#   powershell -ExecutionPolicy Bypass -File tools/defringe-newui.ps1 -Folders icons_cards -Band 4

param(
  [string] $Root = 'public/assets/ui/newui/split',
  [string[]] $Folders = @('buttons', 'icon_frame', 'icons_cards'),
  [int] $Band = 3,
  [int] $MinLight = 140,
  [int] $EdgeDark = 40
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class Defringe {
  public static int Run(string path, int band, int minLight, int edgeDark) {
    Bitmap bmp;
    using (var src = new Bitmap(path)) {
      bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb);
      using (var g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, src.Width, src.Height);
    }
    int w = bmp.Width, h = bmp.Height;
    var d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    var p = new byte[w * h * 4]; Marshal.Copy(d.Scan0, p, 0, p.Length);

    // vzdálenost (v krocích) od průhledného pixelu, nejvýš band
    var dist = new int[w * h]; var q = new Queue<int>();
    for (int i = 0; i < w * h; i++) { if (p[i * 4 + 3] == 0) { dist[i] = 0; q.Enqueue(i); } else dist[i] = int.MaxValue; }
    while (q.Count > 0) {
      int c = q.Dequeue(); if (dist[c] >= band) continue; int cx = c % w, cy = c / w;
      for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
        int nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        int n = ny * w + nx; if (dist[n] > dist[c] + 1) { dist[n] = dist[c] + 1; q.Enqueue(n); }
      }
    }

    int changed = 0;
    for (int i = 0; i < w * h; i++) {
      if (dist[i] == 0 || dist[i] > band) continue;
      int b = p[i * 4], g = p[i * 4 + 1], r = p[i * 4 + 2], a = p[i * 4 + 3];
      int mn = Math.Min(r, Math.Min(g, b));
      if (mn < minLight) continue;
      double k = Math.Max(0, Math.Min(1, (255.0 - mn) / (255.0 - edgeDark)));
      if (k <= 0.02) { p[i * 4 + 3] = 0; changed++; continue; }
      Func<int, byte> un = (v) => (byte)Math.Max(0, Math.Min(255, Math.Round((v - (1 - k) * 255) / k)));
      p[i * 4 + 2] = un(r); p[i * 4 + 1] = un(g); p[i * 4] = un(b);
      p[i * 4 + 3] = (byte)Math.Round(a * k);
      changed++;
    }
    Marshal.Copy(p, 0, d.Scan0, p.Length); bmp.UnlockBits(d);
    string tmp = path + ".tmp";
    bmp.Save(tmp, ImageFormat.Png); bmp.Dispose();
    System.IO.File.Copy(tmp, path, true); System.IO.File.Delete(tmp);
    return changed;
  }
}
'@

$total = 0
foreach ($folder in $Folders) {
  $dir = Join-Path (Resolve-Path $Root) $folder
  $files = Get-ChildItem $dir -Filter *.png
  $sum = 0
  foreach ($f in $files) { $sum += [Defringe]::Run($f.FullName, $Band, $MinLight, $EdgeDark) }
  "{0}: {1} souborů, upraveno {2} pixelů lemu" -f $folder, $files.Count, $sum
  $total += $sum
}
"Celkem $total pixelů."
