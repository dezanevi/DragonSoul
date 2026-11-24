// Velikost jednoho pole ve světě (px).
export const TILE_SIZE = 64;

// Typy polí v mapě. Zatím jen logika (kolize) a plochá barva –
// grafiku terénů ladíme odděleně v okně /lab.html.
//
//   char      znak v mapě
//   name      název (zobrazí se v ladicím režimu, klávesa G)
//   color     plochá barva pole
//   collides  true = hráč přes pole nepřejde
export const TILE_TYPES = [
  { char: '.', id: 'grass', name: 'Tráva', color: 0x6a9a50, collides: false },
  // Tmavá louka = vyhrazená zóna pro náhodná setkání (encounter).
  { char: ',', id: 'meadow', name: 'Louka (setkání)', color: 0x4e7f3c, collides: false, encounter: true },
  { char: ':', id: 'path', name: 'Cesta', color: 0xb8976a, collides: false },
  { char: '#', id: 'plaza', name: 'Dlažba', color: 0xa89c88, collides: false },
  { char: '_', id: 'plot', name: 'Stavební parcela', color: 0xa88560, collides: false },
  { char: '=', id: 'bridge', name: 'Most', color: 0x8a6a48, collides: false },
  { char: '~', id: 'water', name: 'Voda', color: 0x3a6f9a, collides: true },
  { char: '^', id: 'cliff', name: 'Útes', color: 0x76695c, collides: true },
  { char: 'T', id: 'tree', name: 'Strom', color: 0x6a9a50, collides: true, object: 'tree' },
  { char: 'S', id: 'spruce', name: 'Smrk', color: 0x4e7f3c, collides: true, object: 'spruce' },
  { char: 'R', id: 'rock', name: 'Skála', color: 0x6a9a50, collides: true, object: 'rock' },
  { char: 'D', id: 'dock', name: 'Molo', color: 0x9a7650, collides: false },
  { char: 'C', id: 'cave', name: 'Vstup do jeskyně', color: 0x2a2420, collides: false },
  { char: 'F', id: 'waterfall', name: 'Vodopád', color: 0x9cc8e0, collides: true },
  // Základní terény ostatních regionů (zatím ploché barvy, flat: true). Náhodná setkání zatím jen na louce v Greenvale.
  { char: 's', id: 'sand', name: 'Písek', color: 0xd8bd7a, collides: false, flat: true },
  { char: '*', id: 'snow', name: 'Sníh', color: 0xe4eef6, collides: false, flat: true },
  { char: 'g', id: 'gravel', name: 'Kamenitá suť', color: 0x8c8a84, collides: false, flat: true },
  { char: 'a', id: 'ash', name: 'Sopečný popel', color: 0x4a3e3a, collides: false, flat: true },
  { char: 'L', id: 'lava', name: 'Láva', color: 0xe2541c, collides: true, flat: true },
  { char: 'd', id: 'darkland', name: 'Temná půda', color: 0x3a2f4a, collides: false, flat: true },
  { char: 'c', id: 'crystal', name: 'Krystalická půda', color: 0x7fb0c8, collides: false, flat: true },
  // Brána do sousedního regionu (E u brány = cesta).
  { char: 'G', id: 'gate', name: 'Brána do regionu', color: 0xd6a23a, collides: false, flat: true }
];

export const TILE_BY_CHAR = new Map(
  TILE_TYPES.map((tile, index) => [tile.char, { ...tile, index }])
);
