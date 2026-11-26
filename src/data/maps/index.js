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

// Převede textovou mapu na čísla dlaždic a zkontroluje, že sedí rozměry.
export function loadWorldMap(regionId) {
  const base = MAPS[regionId] ?? generateRegionMap(regionId) ?? createPlaceholderMap(regionId);
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
