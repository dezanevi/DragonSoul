import { GREENVALE_MAP } from './greenvale.js';
import { TILE_BY_CHAR } from '../tiles.js';
import { generateRegionMap } from './auria.js';

// Brány z ručně navržených map do sousedních regionů.
const HAND_MAP_EXITS = {
  // Konec cesty od mostu na jižním pobřeží Greenvale.
  Greenvale: [{ x: 93, y: 97, to: 'Verdant Forest' }]
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

  return { ...definition, width, height, tiles };
}
