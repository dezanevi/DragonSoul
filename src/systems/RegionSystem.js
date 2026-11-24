export const REGIONS = [
  {
    id: 'Greenvale',
    mapX: 0.1,
    mapY: 0.13,
    connections: ['Verdant Forest']
  },
  {
    id: 'Verdant Forest',
    mapX: 0.15,
    mapY: 0.44,
    connections: ['Greenvale', 'Stonehelm Range', 'Sandwraith Wastes']
  },
  {
    id: 'Frostlands',
    mapX: 0.63,
    mapY: 0.15,
    connections: ['Stonehelm Range', 'Skyreach Citadel']
  },
  {
    id: 'Shadow Realm',
    mapX: 0.6,
    mapY: 0.62,
    connections: ['Skyreach Citadel', "Dragon's Nest"]
  },
  {
    id: 'Skyreach Citadel',
    mapX: 0.63,
    mapY: 0.38,
    connections: ['Stonehelm Range', 'Frostlands', 'Shadow Realm']
  },
  {
    id: "Dragon's Nest",
    mapX: 0.87,
    mapY: 0.55,
    connections: ['Shadow Realm', 'Mystic Isles']
  },
  {
    id: 'Stonehelm Range',
    mapX: 0.38,
    mapY: 0.3,
    connections: [
      'Verdant Forest',
      'Frostlands',
      'Skyreach Citadel',
      'Sandwraith Wastes'
    ]
  },
  {
    id: 'Sandwraith Wastes',
    mapX: 0.22,
    mapY: 0.66,
    connections: ['Verdant Forest', 'Stonehelm Range', 'Azure Coast']
  },
  {
    id: 'Azure Coast',
    mapX: 0.3,
    mapY: 0.88,
    connections: ['Sandwraith Wastes', 'Mystic Isles']
  },
  {
    id: 'Mystic Isles',
    mapX: 0.64,
    mapY: 0.86,
    connections: ['Azure Coast', "Dragon's Nest"]
  }
];

const REGION_IDS = new Set(REGIONS.map((region) => region.id));

export function createInitialUnlockedRegions() {
  return ['Greenvale'];
}

export function normalizeUnlockedRegions(
  unlockedRegions,
  currentRegion = 'Greenvale'
) {
  const result = [];

  if (Array.isArray(unlockedRegions)) {
    for (const regionId of unlockedRegions) {
      if (REGION_IDS.has(regionId) && !result.includes(regionId)) {
        result.push(regionId);
      }
    }
  }

  if (!result.includes('Greenvale')) {
    result.unshift('Greenvale');
  }

  if (
    REGION_IDS.has(currentRegion) &&
    !result.includes(currentRegion)
  ) {
    result.push(currentRegion);
  }

  return result;
}

export function getRegion(regionId) {
  return REGIONS.find((region) => region.id === regionId) ?? null;
}

export function isRegionUnlocked(state, regionId) {
  const unlocked = normalizeUnlockedRegions(
    state?.unlockedRegions,
    state?.region
  );

  return unlocked.includes(regionId);
}

export function unlockRegion(state, regionId) {
  if (!state || !REGION_IDS.has(regionId)) {
    return false;
  }

  state.unlockedRegions = normalizeUnlockedRegions(
    state.unlockedRegions,
    state.region
  );

  if (state.unlockedRegions.includes(regionId)) {
    return false;
  }

  state.unlockedRegions.push(regionId);
  return true;
}

// Testování světa: všechny regiony průchozí bez ohledu na odemčení (vypnout = false).
export const ALL_REGIONS_OPEN_FOR_TESTING = true;

export function canTravelToRegion(state, destinationId) {
  if (!ALL_REGIONS_OPEN_FOR_TESTING && !isRegionUnlocked(state, destinationId)) {
    return false;
  }

  const currentRegion = getRegion(state?.region);

  return currentRegion?.connections.includes(destinationId) ?? false;
}
