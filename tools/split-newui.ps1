# Rozdělí novou sadu UI (public/assets/ui/newui) na samostatné obrázky s průhledným pozadím.
#
# Postup pro každý list:
#   1. Pozadí = průhledné pixely nebo světlé neutrální pixely (bílá / šachovnice) spojené s okrajem
#      listu. Velké uzavřené světlé plochy (vnitřek prázdného rámečku) se berou také jako pozadí.
#   2. Zbytek se rozšíří o -Merge px (záře a odlesky patří k dílu), spojité oblasti = díly.
#   3. Díly se seřadí po řádcích zleva doprava, vyříznou s okrajem -Padding a pozadí v nich zprůhlední.
#   4. Uloží se do public/assets/ui/newui/split/<list>/<název>.png a seznam do src/data/newUi.json.
#
# Použití:
#   powershell -ExecutionPolicy Bypass -File tools/split-newui.ps1

param(
  [string] $SourceDir = 'public/assets/ui/newui',
  [string] $TargetDir = 'public/assets/ui/newui/split',
  [string] $Manifest = 'src/data/newUi.json',
  [int] $Merge = 6,
  [int] $MinArea = 1500,
  [int] $Padding = 4,
  [int] $EnclosedArea = 6000,
  [switch] $Force
)

$ErrorActionPreference = 'Stop'
# Výstup už mohl někdo ručně přejmenovat nebo protřídit – bez -Force se nic nepřepíše.
if ((Test-Path $TargetDir) -and -not $Force) {
  Write-Host "Složka $TargetDir už existuje. Ruční úpravy by se přepsaly – spusť znovu s -Force, pokud je to záměr."
  exit 1
}
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class UiSplitter {
  // Světlý neutrální pixel (bílé pozadí nebo šachovnice průhlednosti) nebo průhledný pixel.
  static bool Light(byte[] p, int i) {
    int b = p[i], g = p[i + 1], r = p[i + 2], a = p[i + 3];
    if (a < 16) return true;
    int mn = Math.Min(r, Math.Min(g, b)), mx = Math.Max(r, Math.Max(g, b));
    return mn >= 226 && mx - mn < 22;
  }

  public static List<int[]> Split(string path, string outDir, string[] names, int merge, int minArea, int padding, int enclosedArea, int bigArea) {
    var src = new Bitmap(path);
    int w = src.Width, h = src.Height;
    var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (var gr = Graphics.FromImage(bmp)) gr.DrawImage(src, 0, 0, w, h);
    src.Dispose();
    var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    var px = new byte[w * h * 4];
    Marshal.Copy(data.Scan0, px, 0, px.Length);
    bmp.UnlockBits(data);

    // 1) pozadí: světlé pixely spojené s okrajem (flood fill), pak velké uzavřené světlé plochy
    var bg = new bool[w * h];
    var light = new bool[w * h];
    for (int i = 0; i < w * h; i++) light[i] = Light(px, i * 4);
    var queue = new Queue<int>();
    for (int x = 0; x < w; x++) { Seed(light, bg, queue, x); Seed(light, bg, queue, (h - 1) * w + x); }
    for (int y = 0; y < h; y++) { Seed(light, bg, queue, y * w); Seed(light, bg, queue, y * w + w - 1); }
    Fill(light, bg, queue, w, h);
    var seen = new bool[w * h];
    for (int i = 0; i < w * h; i++) {
      if (!light[i] || bg[i] || seen[i]) continue;
      var region = new List<int>();
      var q = new Queue<int>(); q.Enqueue(i); seen[i] = true;
      while (q.Count > 0) {
        int c = q.Dequeue(); region.Add(c);
        int cx = c % w, cy = c / w;
        foreach (int n in new[] { cx > 0 ? c - 1 : -1, cx < w - 1 ? c + 1 : -1, cy > 0 ? c - w : -1, cy < h - 1 ? c + w : -1 })
          if (n >= 0 && light[n] && !bg[n] && !seen[n]) { seen[n] = true; q.Enqueue(n); }
      }
      // Velká plocha (vnitřek rámečku) = pozadí vždy. Menší jen když ji obklopuje tmavá kontura
      // (otvor v ikoně); světlé odlesky uvnitř barevných ploch zůstanou.
      bool hole = region.Count >= bigArea;
      if (!hole && region.Count >= enclosedArea) {
        var inRegion = new HashSet<int>(region);
        int border = 0, dark = 0;
        foreach (int c in region) {
          int cx = c % w, cy = c / w;
          foreach (int n in new[] { cx > 0 ? c - 1 : -1, cx < w - 1 ? c + 1 : -1, cy > 0 ? c - w : -1, cy < h - 1 ? c + w : -1 }) {
            if (n < 0 || inRegion.Contains(n)) continue;
            // první netmavý soused může být přechod; podíváme se o 3 px dál stejným směrem
            border++;
            int dx = (n % w) - cx, dy = (n / w) - cy, darkHit = 0;
            for (int s = 0; s <= 3; s++) {
              int sx = cx + dx * (s + 1), sy = cy + dy * (s + 1);
              if (sx < 0 || sy < 0 || sx >= w || sy >= h) break;
              int si = (sy * w + sx) * 4;
              if (Math.Max(px[si], Math.Max(px[si + 1], px[si + 2])) < 90) { darkHit = 1; break; }
            }
            dark += darkHit;
          }
        }
        hole = border > 0 && dark >= border * 0.6;
      }
      if (hole) foreach (int c in region) bg[c] = true;
    }

    // 2) díly = rozšířené popředí, spojité oblasti
    var fg = new bool[w * h];
    for (int i = 0; i < w * h; i++) fg[i] = !bg[i];
    var grown = Dilate(fg, w, h, merge);
    var label = new int[w * h];
    var boxes = new List<int[]>();
    for (int i = 0; i < w * h; i++) {
      if (!grown[i] || label[i] != 0) continue;
      int id = boxes.Count + 1, minX = w, minY = h, maxX = 0, maxY = 0, area = 0;
      var q = new Queue<int>(); q.Enqueue(i); label[i] = id;
      while (q.Count > 0) {
        int c = q.Dequeue(); int cx = c % w, cy = c / w;
        if (fg[c]) { area++; if (cx < minX) minX = cx; if (cx > maxX) maxX = cx; if (cy < minY) minY = cy; if (cy > maxY) maxY = cy; }
        foreach (int n in new[] { cx > 0 ? c - 1 : -1, cx < w - 1 ? c + 1 : -1, cy > 0 ? c - w : -1, cy < h - 1 ? c + w : -1 })
          if (n >= 0 && grown[n] && label[n] == 0) { label[n] = id; q.Enqueue(n); }
      }
      boxes.Add(new int[] { minX, minY, maxX, maxY, area, id });
    }
    boxes.RemoveAll(b => b[4] < minArea);

    // 3) pořadí: řádky podle středu (tolerance = polovina výšky dílu), v řádku zleva doprava
    boxes.Sort((a, b) => ((a[1] + a[3]) / 2).CompareTo((b[1] + b[3]) / 2));
    var rows = new List<List<int[]>>();
    foreach (var b in boxes) {
      int cy = (b[1] + b[3]) / 2;
      var row = rows.Find(r => Math.Abs(cy - (r[0][1] + r[0][3]) / 2) < (r[0][3] - r[0][1]) / 2);
      if (row == null) rows.Add(new List<int[]> { b }); else row.Add(b);
    }
    var ordered = new List<int[]>();
    foreach (var r in rows) { r.Sort((a, b) => a[0].CompareTo(b[0])); ordered.AddRange(r); }

    // 4) výřezy: pixely dílu (stejný label) mimo pozadí, ostatní průhledné
    var result = new List<int[]>();
    for (int k = 0; k < ordered.Count; k++) {
      var b = ordered[k];
      int x0 = Math.Max(0, b[0] - padding), y0 = Math.Max(0, b[1] - padding);
      int x1 = Math.Min(w - 1, b[2] + padding), y1 = Math.Min(h - 1, b[3] + padding);
      int cw = x1 - x0 + 1, ch = y1 - y0 + 1;
      var outPx = new byte[cw * ch * 4];
      for (int y = 0; y < ch; y++) for (int x = 0; x < cw; x++) {
        int si = (y0 + y) * w + (x0 + x), di = (y * cw + x) * 4;
        if (bg[si] || label[si] != b[5]) continue;
        outPx[di] = px[si * 4]; outPx[di + 1] = px[si * 4 + 1]; outPx[di + 2] = px[si * 4 + 2]; outPx[di + 3] = px[si * 4 + 3];
      }
      var outBmp = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
      var od = outBmp.LockBits(new Rectangle(0, 0, cw, ch), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
      Marshal.Copy(outPx, 0, od.Scan0, outPx.Length);
      outBmp.UnlockBits(od);
      string name = k < names.Length ? names[k] : ("part_" + (k + 1).ToString("00"));
      outBmp.Save(System.IO.Path.Combine(outDir, name + ".png"), ImageFormat.Png);
      outBmp.Dispose();
      result.Add(new int[] { k, x0, y0, cw, ch });
    }
    bmp.Dispose();
    return result;
  }

  static void Seed(bool[] light, bool[] bg, Queue<int> q, int i) { if (light[i] && !bg[i]) { bg[i] = true; q.Enqueue(i); } }

  static void Fill(bool[] light, bool[] bg, Queue<int> q, int w, int h) {
    while (q.Count > 0) {
      int c = q.Dequeue(); int cx = c % w, cy = c / w;
      foreach (int n in new[] { cx > 0 ? c - 1 : -1, cx < w - 1 ? c + 1 : -1, cy > 0 ? c - w : -1, cy < h - 1 ? c + w : -1 })
        if (n >= 0 && light[n] && !bg[n]) { bg[n] = true; q.Enqueue(n); }
    }
  }

  // Rozšíření masky čtvercem (2r+1): nejdřív vodorovně, pak svisle (prefixové součty).
  static bool[] Dilate(bool[] m, int w, int h, int r) {
    var tmp = new bool[w * h]; var outM = new bool[w * h];
    for (int y = 0; y < h; y++) {
      var pre = new int[w + 1];
      for (int x = 0; x < w; x++) pre[x + 1] = pre[x] + (m[y * w + x] ? 1 : 0);
      for (int x = 0; x < w; x++) tmp[y * w + x] = pre[Math.Min(w, x + r + 1)] - pre[Math.Max(0, x - r)] > 0;
    }
    for (int x = 0; x < w; x++) {
      var pre = new int[h + 1];
      for (int y = 0; y < h; y++) pre[y + 1] = pre[y] + (tmp[y * w + x] ? 1 : 0);
      for (int y = 0; y < h; y++) outM[y * w + x] = pre[Math.Min(h, y + r + 1)] - pre[Math.Max(0, y - r)] > 0;
    }
    return outM;
  }
}
'@

# Názvy dílů v pořadí (po řádcích zleva doprava). Popisy doplní autor grafiky.
$sheets = [ordered]@{
  'Buttons' = @('button_blue', 'button_blue_hover', 'button_gold', 'button_grey')
  'buttons-red' = @('button_red_set_blue', 'button_red_set_blue_hover', 'button_red', 'button_red_set_grey')
  'Icon_frame' = @('icon_frame_blue', 'icon_frame_blue_hover', 'icon_frame_empty', 'icon_frame_gold', 'icon_frame_grey')
  'card_frame' = @('card_panel', 'card_frame_large', 'card_tooltip', 'card_slot')
  'Icons_cards' = @(
    'icon_hero_wheel', 'icon_star', 'icon_party', 'icon_bag', 'icon_anvil', 'icon_paw', 'icon_map', 'icon_scroll_quest', 'icon_book',
    'icon_crossed_swords', 'icon_magic_staff', 'icon_shield_defense', 'icon_shield_magic', 'icon_brain', 'icon_magic_star', 'icon_winged_boot', 'icon_clover', 'icon_heart',
    'icon_fire', 'icon_water', 'icon_leaf', 'icon_air', 'icon_sun', 'icon_moon', 'icon_dragon_gold', 'icon_gear', 'icon_compass',
    'icon_herbs', 'icon_potion', 'icon_pickaxe', 'icon_fishing_rod', 'icon_cooking_pot', 'icon_ingots', 'icon_handshake', 'icon_crown', 'icon_dragon_purple',
    'icon_sword', 'icon_helmet', 'icon_armor', 'icon_legs', 'icon_boots', 'icon_ring', 'icon_amulet', 'icon_spellbook', 'icon_scroll',
    'icon_chest', 'icon_crystal', 'icon_key', 'icon_flag', 'icon_target', 'icon_vortex', 'icon_coins', 'icon_map_pin', 'icon_castle'
  )
}

$root = Resolve-Path '.'
$entries = @()
foreach ($sheet in $sheets.Keys) {
  $source = Join-Path $root "$SourceDir/$sheet.png"
  $outDir = Join-Path $root "$TargetDir/$($sheet.ToLower())"
  New-Item -ItemType Directory -Force $outDir | Out-Null
  Get-ChildItem $outDir -Filter *.png | Remove-Item -Force
  $names = [string[]] $sheets[$sheet]
  # Ikony leží blízko u sebe – menší rozšíření, aby se sousední nespojily.
  $merge = if ($sheet -eq 'Icons_cards') { 2 } else { $Merge }
  # V ikonách jsou i malé otvory (ozubené kolo, oko klíče, špendlík) – také pozadí.
  $enclosed = if ($sheet -eq 'Icons_cards') { 300 } else { $EnclosedArea }
  $parts = [UiSplitter]::Split($source, $outDir, $names, $merge, $MinArea, $Padding, $enclosed, $EnclosedArea)
  "{0}: {1} dílů (očekáváno {2})" -f $sheet, $parts.Count, $names.Count
  foreach ($p in $parts) {
    $name = if ($p[0] -lt $names.Count) { $names[$p[0]] } else { 'part_{0:00}' -f ($p[0] + 1) }
    $entries += [ordered]@{
      key = "newui-$name"; file = "assets/ui/newui/split/$($sheet.ToLower())/$name.png"; sheet = $sheet
      index = $p[0] + 1; x = $p[1]; y = $p[2]; width = $p[3]; height = $p[4]; description = ''
    }
  }
}
$json = $entries | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText((Join-Path $root $Manifest), $json, (New-Object System.Text.UTF8Encoding $false))
"Uloženo: $($entries.Count) dílů, seznam $Manifest"
