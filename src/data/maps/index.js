import { GREENVALE_MAP } from './greenvale.js';
import { TILE_BY_CHAR } from '../tiles.js';

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
  const definition = MAPS[regionId] ?? createPlaceholderMap(regionId);
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

  return { ...definition, width, height, tiles };
}
