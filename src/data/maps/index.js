import { GREENVALE_MAP } from './greenvale.js';
import { TILE_BY_CHAR } from '../tiles.js';
import { generateRegionMap } from './auria.js';

// Brány z ručně navržených map do sousedních regionů.
const HAND_MAP_EXITS = {
  // Konec dlážděné cesty na jihovýchodním okraji Greenvale (nové rozložení oblasti).
  Greenvale: [{ x: 98, y: 121, to: 'Verdant Forest' }]
};

const MAPS = {
  Greenvale: GREENVALE_MAP
};

// Oblasti, které ještě nemají vlastní mapu, dostanou louku obklopenou vodou.
function createPlaceholderMap(regionId) {
  const width = 40;
  const height = 24;
  const ground = [];

  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      row += edge ? '~' : '.';
    }
    ground.push(row);
  }

  return {
    id: regionId,
    name: regionId,
    ground,
    spawn: { x: 20, y: 12 },
    buildings: [],
    points: []
  };
}

// Kultivace cest (ručně kreslené mapy s cultivatePaths): stromy těsně u cesty a stromy hned
// před ní (jejich koruna by cestu na obrazovce zakryla) zmizí, louka, která cesty přímo
// dotýká, se změní na trávu – mezi cestou a loukou je vždy pruh trávy.
const PATH_CHARS = ':#=';
function cultivatePaths(ground) {
  const rows = ground.map((row) => [...row]);
  const isPath = (x, y) => PATH_CHARS.includes(rows[y]?.[x] ?? '~');
  const near = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const front = [[1, 1], [2, 1], [1, 2], [2, 2], [2, 0], [0, 2]];
  const out = rows.map((row) => [...row]);
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const c = rows[y][x];
      if ((c === 'T' || c === 'S') && (near.some(([dx, dy]) => isPath(x + dx, y + dy)) || front.some(([dx, dy]) => isPath(x - dx, y - dy)))) out[y][x] = '.';
      if (c === ',' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isPath(x + dx, y + dy))) out[y][x] = '.';
    }
  }
  return out.map((row) => row.join(''));
}

// Pojmenovaná oblast na poli (x, y): nejdřív map.areas (kromě záložní), pak louky setkání,
// pak záložní oblast (fallback: true, např. Vesnice Greenvale). Nic = jen název regionu.
export function areaAt(map, x, y) {
  const inside = (a) => x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1;
  const areas = map.areas ?? [];
  return areas.find((a) => !a.fallback && inside(a))?.name
    ?? encounterZoneAt(map, x, y)?.name
    ?? areas.find((a) => a.fallback && inside(a))?.name
    ?? null;
}

// Převede textovou mapu na čísla dlaždic a zkontroluje, že sedí rozměry.
export function loadWorldMap(regionId) {
  const raw = MAPS[regionId] ?? generateRegionMap(regionId) ?? createPlaceholderMap(regionId);
  const base = raw.cultivatePaths ? { ...raw, ground: cultivatePaths(raw.ground) } : raw;
  const definition = { exits: [], ...base, exits: base.exits ?? HAND_MAP_EXITS[regionId] ?? [] };
  const height = definition.ground.length;
  const width = definition.ground[0].length;
  const fallback = TILE_BY_CHAR.get('.');

  const tiles = definition.ground.map((row, y) => {
    if (row.length !== width) {
      console.warn(
        `Mapa ${definition.id}: řádek ${y} má ${row.length} znaků, očekáváno ${width}.`
      );
    }

    return Array.from({ length: width }, (_, x) => {
      const char = row[x] ?? '.';
      const tile = TILE_BY_CHAR.get(char);

      if (!tile) {
        console.warn(`Mapa ${definition.id}: neznámý znak "${char}" na poli ${x},${y}.`);
        return fallback;
      }

      return tile;
    });
  });

  // Vchod do jeskyně (map.caveEntrance) – nastaví se při načtení, aby ho nové vygenerování
  // oblasti z editoru nesmazalo.
  if (definition.caveEntrance && tiles[definition.caveEntrance.y]?.[definition.caveEntrance.x]) {
    const { x: cx, y: cy } = definition.caveEntrance;
    tiles[cy][cx] = TILE_BY_CHAR.get('C');
    // Mýtina před vchodem: stromy, jejichž koruna by vchod nebo hrdinu u něj zakryla, zmizí.
    for (let y = cy - 1; y <= cy + 3; y++) {
      for (let x = cx - 2; x <= cx + 3; x++) {
        if (['tree', 'spruce'].includes(tiles[y]?.[x]?.id)) tiles[y][x] = TILE_BY_CHAR.get('.');
      }
    }
  }

  // Pole bran jsou vždy dlaždice brány.
  const gate = TILE_BY_CHAR.get('G');
  for (const exit of definition.exits) {
    if (tiles[exit.y]?.[exit.x]) tiles[exit.y][exit.x] = gate;
  }

  // Náhodná vzácná naleziště ve skrytých mýtinách: aktivní se přidají k běžným nalezištím.
  const rare = activeRareSpots(definition);
  const pick = (kind, key) => rare.filter((s) => s.kind === kind).map((s) => ({ [key]: s[key], x: s.x, y: s.y, rare: true }));
  return {
    ...definition, width, height, tiles,
    herbSpots: [...(definition.herbSpots ?? []), ...pick('herb', 'site')],
    miningSpots: [...(definition.miningSpots ?? []), ...pick('mining', 'deposit')],
    fishingSpots: [...(definition.fishingSpots ?? []), ...pick('fishing', 'location')]
  };
}

// Vzácná naleziště: z mýtin (map.rareSpots) jsou aktivní vždy RARE_ACTIVE, výběr se mění
// každých RARE_PERIOD_MS (stejný pro všechny načtení v tomto okně).
const RARE_ACTIVE = 2;
const RARE_PERIOD_MS = 3 * 3600000;
export function activeRareSpots(map, now = Date.now()) {
  const list = map.rareSpots ?? [];
  if (list.length <= RARE_ACTIVE) return list;
  let seed = Math.floor(now / RARE_PERIOD_MS) * 2654435761 + list.length;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pool = [...list];
  const chosen = [];
  while (chosen.length < RARE_ACTIVE) chosen.push(...pool.splice(Math.floor(rand() * pool.length), 1));
  return chosen;
}

// Louka setkání na poli (x, y): první zóna mapy, jejíž obdélník pole obsahuje.
export function encounterZoneAt(map, x, y) {
  return (map.encounterZones ?? []).find((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) ?? null;
}
