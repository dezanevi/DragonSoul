# Vyřízne ze starých podkladů karet prvky, které nová sada UI nemá, do public/assets/ui/legacy.
# Staré podklady se pak nepoužívají a jsou ve složce public/assets/ui/_stare.
#
# Použití (stačí jednou, výstup je v repozitáři):
#   powershell -ExecutionPolicy Bypass -File tools/extract-legacy-ui.ps1

param(
  [string] $Old = 'public/assets/ui/_stare',
  [string] $Out = 'public/assets/ui/legacy'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $Out | Out-Null

function Crop($file, $name, $x, $y, $w, $h) {
  $src = [System.Drawing.Image]::FromFile((Resolve-Path (Join-Path $Old $file)).Path)
  $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), (New-Object System.Drawing.Rectangle $x, $y, $w, $h), [System.Drawing.GraphicsUnit]::Pixel)
  $bmp.Save((Join-Path (Resolve-Path $Out).Path "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $src.Dispose()
}

# Karta hrdiny: portrét a postava ve výbavě (muž / žena), obrázek oblasti.
Crop 'hero/hero_card.png' 'hero_portrait_male' 50 122 266 424
Crop 'hero/hero_card_female.png' 'hero_portrait_female' 50 122 266 424
Crop 'hero/hero_card.png' 'hero_figure_male' 462 423 236 262
Crop 'hero/hero_card_female.png' 'hero_figure_female' 462 423 236 262
Crop 'hero/hero_card.png' 'region_greenvale' 1172 693 276 78

# Inventář: postava s magickým kruhem, šipky stránek.
Crop 'inventory/inventory.png' 'inventory_figure' 190 175 300 395
Crop 'inventory/inventory.png' 'arrow_left' 677 688 38 66
Crop 'inventory/inventory.png' 'arrow_right' 868 688 38 66

# Talenty: ikony 30 talentů (levá část políčka) – [strom][levé, pravé] × stupně I–V.
$nodeX = @(@(@(48, 274), @(282, 507)), @(@(550, 764), @(771, 984)), @(@(1026, 1252), @(1259, 1490)))
$nodeY = @(@(287, 346), @(382, 441), @(475, 533), @(567, 626), @(659, 718))
$trees = @('combat', 'crafting', 'wizard')
for ($t = 0; $t -lt 3; $t++) { for ($tier = 0; $tier -lt 5; $tier++) { for ($s = 0; $s -lt 2; $s++) {
  $x0 = $nodeX[$t][$s][0]; $y0 = $nodeY[$tier][0]; $y1 = $nodeY[$tier][1]
  $size = $y1 - $y0 - 2
  Crop 'talents/talent-card.png' ("talent_{0}_{1}_{2}" -f $trees[$t], ($tier + 1), $s) ($x0 + 3) ($y0 + 1) $size $size
} } }
"Hotovo: $((Get-ChildItem $Out).Count) souborů v $Out"
