// Mapy regionů Aurie (kromě ručně navrženého Greenvale) – zatím ze základních dlaždic.
// Každý region se generuje z pevného seedu, takže vypadá pokaždé stejně. Rozměry a
// složení terénu jsou v REGION_RECIPES – velikosti regionů budeme ladit později.
//
// Znaky dlaždic: viz src/data/tiles.js. Brány do sousedních regionů (exits) leží na okraji
// mapy ve směru souseda (podle polohy na mapě světa, RegionSystem.mapX/mapY) a vede k nim cesta.

import { REGIONS } from '../../systems/RegionSystem.js';

// base  = hlavní terén (setkání s monstry mimo cesty)
// feats = doplňky: [znak, hustota, „shlukovitost“ 0–1]
// edge  = okraj mapy, water = jezera/řeky
const REGION_RECIPES = {
  'Verdant Forest': { size: [60, 60], base: '.', zone: ',', zoneShare: 0.45, feats: [['T', 0.32, 0.8], ['S', 0.12, 0.7], ['R', 0.02, 0]], edge: '~', river: true },
  'Stonehelm Range': { size: [60, 60], base: 'g', feats: [['^', 0.22, 0.9], ['R', 0.08, 0.3], ['S', 0.05, 0.6]], edge: '^', cave: true },
  Frostlands: { size: [60, 60], base: '*', feats: [['S', 0.12, 0.75], ['R', 0.04, 0.2], ['~', 0.08, 0.95]], edge: '~' },
  'Skyreach Citadel': { size: [56, 56], base: '.', zone: ',', zoneShare: 0.5, feats: [['T', 0.06, 0.6], ['R', 0.03, 0.2]], edge: '^', citadel: true },
  'Shadow Realm': { size: [60, 60], base: 'd', feats: [['T', 0.1, 0.7], ['R', 0.06, 0.3], ['^', 0.08, 0.9]], edge: '^' },
  "Dragon's Nest": { size: [60, 60], base: 'a', feats: [['L', 0.14, 0.9], ['R', 0.08, 0.3], ['^', 0.08, 0.9]], edge: '^' },
  'Sandwraith Wastes': { size: [64, 56], base: 's', feats: [['R', 0.06, 0.3], ['#', 0.04, 0.9], ['~', 0.03, 0.95], ['T', 0.02, 0.8]], edge: '^' },
  'Azure Coast': { size: [60, 56], base: '.', zone: ',', zoneShare: 0.35, feats: [['T', 0.1, 0.7], ['R', 0.03, 0.2]], edge: '~', coast: true },
  'Mystic Isles': { size: [60, 60], base: 'c', feats: [['T', 0.06, 0.6], ['R', 0.04, 0.3]], edge: '~', islands: true }
};

// Deterministický šum: hash souřadnic → 0..1, vyhlazený přes mřížku.
function makeNoise(seed) {
  const hash = (x, y) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (x, y, cell) => {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    const fx = (x / cell) - gx;
    const fy = (y / cell) - gy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash(gx, gy), b = hash(gx + 1, gy), c = hash(gx, gy + 1), d = hash(gx + 1, gy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  return { hash, smooth };
}

const seedOf = (text) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);

// Okrajový bod mapy ve směru (dx, dy).
function edgePoint(width, height, dx, dy, margin) {
  const cx = width / 2;
  const cy = height / 2;
  const sx = dx === 0 ? Infinity : (cx - margin) / Math.abs(dx);
  const sy = dy === 0 ? Infinity : (cy - margin) / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: Math.round(cx + dx * s), y: Math.round(cy + dy * s) };
}

export function generateRegionMap(regionId) {
  const recipe = REGION_RECIPES[regionId];
  if (!recipe) return null;
  const [width, height] = recipe.size;
  const { hash, smooth } = makeNoise(seedOf(regionId));
  const grid = Array.from({ length: height }, () => Array(width).fill(recipe.base));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < width && y < height) grid[y][x] = c; };
  const get = (x, y) => grid[y]?.[x];

  // 1) Základ: zóny setkání (tmavší louka) jen u travnatých regionů.
  if (recipe.zone) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (smooth(x + 500, y + 500, 9) < recipe.zoneShare) set(x, y, recipe.zone);
    }
  }

  // 2) Ostrovy (Mystic Isles): voda všude, kde šum nedosáhne prahu.
  if (recipe.islands) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (smooth(x, y, 8) < 0.48) set(x, y, '~');
    }
  }

  // 3) Pobřeží (Azure Coast): jižní a východní moře, písečná pláž.
  if (recipe.coast) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const shore = (x / width) * 0.55 + (y / height) * 0.75 + smooth(x, y, 7) * 0.25;
      if (shore > 1.05) set(x, y, '~');
      else if (shore > 0.94) set(x, y, 's');
    }
  }

  // 4) Doplňky podle receptu (stromy, skály, útesy, láva, jezera…).
  recipe.feats.forEach(([char, density, clump], i) => {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const c = get(x, y);
      if (c === '~' || c === 's' && recipe.coast) continue;
      const n = clump > 0 ? smooth(x + i * 97, y + i * 61, 5) * clump + hash(x + i * 13, y) * (1 - clump) : hash(x + i * 13, y);
      if (n > 1 - density) set(x, y, char);
    }
  });

  // 5) Řeka (Verdant Forest) – vlnitý pás vody napříč mapou.
  if (recipe.river) {
    for (let x = 0; x < width; x++) {
      const yc = Math.round(height * 0.62 + Math.sin(x / 7) * 4 + (smooth(x, 0, 6) - 0.5) * 6);
      for (let dy = -1; dy <= 1; dy++) set(x, yc + dy, '~');
    }
  }

  // 6) Citadela (Skyreach): dlážděné nádvoří s hradbami uprostřed.
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  if (recipe.citadel) {
    for (let y = cy - 8; y <= cy + 8; y++) for (let x = cx - 8; x <= cx + 8; x++) {
      const wall = Math.abs(x - cx) === 8 || Math.abs(y - cy) === 8;
      set(x, y, wall ? '^' : '#');
    }
  }

  // 7) Okraj mapy (voda nebo útesy, 2 pole).
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) set(x, y, recipe.edge);
  }

  // 8) Brány do sousedů a cesty k nim ze středu (cesta přes vodu/lávu = most).
  const region = REGIONS.find((r) => r.id === regionId);
  const exits = [];
  const carve = (x, y) => {
    const c = get(x, y);
    if (c === undefined) return;
    set(x, y, c === '~' || c === 'L' ? '=' : ':');
  };
  const carveLine = (x0, y0, x1, y1) => {
    let x = x0, y = y0;
    while (x !== x1 || y !== y1) {
      carve(x, y); carve(x + 1, y);
      if (Math.abs(x1 - x) > Math.abs(y1 - y)) x += Math.sign(x1 - x); else y += Math.sign(y1 - y);
    }
    carve(x, y);
  };
  for (const to of region?.connections ?? []) {
    const target = REGIONS.find((r) => r.id === to);
    if (!target) continue;
    const dx = target.mapX - region.mapX;
    const dy = target.mapY - region.mapY;
    const len = Math.hypot(dx, dy) || 1;
    const p = edgePoint(width, height, dx / len, dy / len, 2);
    carveLine(cx, cy, p.x, p.y);
    set(p.x, p.y, 'G');
    exits.push({ x: p.x, y: p.y, to });
  }

  // 9) Město uprostřed: náměstí 9 × 9, čtyři stavební parcely 4 × 4 v rozích
  //    a čtyři připravená místa pro NPC (role a jména doplníme). Skyreach má město v citadele.
  const half = 4;
  for (let y = cy - half; y <= cy + half; y++) for (let x = cx - half; x <= cx + half; x++) {
    if (!recipe.citadel || Math.abs(x - cx) < 8 && Math.abs(y - cy) < 8) set(x, y, '#');
  }
  const plots = [];
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = sx < 0 ? cx - half - 5 : cx + half + 1;
    const py = sy < 0 ? cy - half - 5 : cy + half + 1;
    if (recipe.citadel) continue; // v citadele jsou parcely uvnitř hradeb
    for (let y = py; y < py + 4; y++) for (let x = px; x < px + 4; x++) set(x, y, '_');
    plots.push({ x: px, y: py, width: 4, height: 4 });
  }
  if (recipe.citadel) {
    for (const [px, py] of [[cx - 7, cy - 7], [cx + 3, cy - 7], [cx - 7, cy + 3], [cx + 3, cy + 3]]) {
      for (let y = py; y < py + 4; y++) for (let x = px; x < px + 4; x++) set(x, y, '_');
      plots.push({ x: px, y: py, width: 4, height: 4 });
    }
  }
  // Cesty z náměstí k branám vedou dál (přepsané dlažbou uvnitř města).
  const npcs = [
    { id: `${seedOf(regionId)}-merchant`, role: 'merchant', label: 'Obchodník', x: cx - 2, y: cy - 2 },
    { id: `${seedOf(regionId)}-healer`, role: 'healer', label: 'Léčitel', x: cx + 2, y: cy - 2 },
    { id: `${seedOf(regionId)}-elder`, role: 'elder', label: 'Představený', x: cx - 2, y: cy + 2 },
    { id: `${seedOf(regionId)}-trainer`, role: 'trainer', label: 'Trenér', x: cx + 2, y: cy + 2 }
  ];
  const town = { name: `Město – ${regionId}`, x: cx - half, y: cy - half, width: half * 2 + 1, height: half * 2 + 1, plots };
  if (recipe.cave) set(cx + 12, cy - 12, 'C');

  return {
    id: regionId,
    name: regionId,
    ground: grid.map((row) => row.join('')),
    spawn: { x: cx, y: cy },
    towns: [town],
    npcs,
    buildings: [],
    decor: [],
    points: [],
    exits,
    generated: true
  };
}
