export const REGIONS = [
  {
    id: 'Greenvale',
    mapX: 0.08,
    mapY: 0.68,
    connections: ['Verdant Forest']
  },
  {
    id: 'Verdant Forest',
    mapX: 0.22,
    mapY: 0.48,
    connections: ['Greenvale', 'Stonehelm Range', 'Sandwraith Wastes']
  },
  {
    id: 'Frostlands',
    mapX: 0.32,
    mapY: 0.12,
    connections: ['Stonehelm Range', 'Skyreach Citadel']
  },
  {
    id: 'Shadow Realm',
    mapX: 0.72,
    mapY: 0.42,
    connections: ['Skyreach Citadel', "Dragon's Nest"]
  },
  {
    id: 'Skyreach Citadel',
    mapX: 0.58,
    mapY: 0.2,
    connections: ['Stonehelm Range', 'Frostlands', 'Shadow Realm']
  },
  {
    id: "Dragon's Nest",
    mapX: 0.88,
    mapY: 0.43,
    connections: ['Shadow Realm', 'Mystic Isles']
  },
  {
    id: 'Stonehelm Range',
    mapX: 0.42,
    mapY: 0.42,
    connections: [
      'Verdant Forest',
      'Frostlands',
      'Skyreach Citadel',
      'Sandwraith Wastes'
    ]
  },
  {
    id: 'Sandwraith Wastes',
    mapX: 0.43,
    mapY: 0.76,
    connections: ['Verdant Forest', 'Stonehelm Range', 'Azure Coast']
  },
  {
    id: 'Azure Coast',
    mapX: 0.66,
    mapY: 0.76,
    connections: ['Sandwraith Wastes', 'Mystic Isles']
  },
  {
    id: 'Mystic Isles',
    mapX: 0.9,
    mapY: 0.78,
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

export function canTravelToRegion(state, destinationId) {
  if (!isRegionUnlocked(state, destinationId)) {
    return false;
  }

  const currentRegion = getRegion(state?.region);

  return currentRegion?.connections.includes(destinationId) ?? false;
}
