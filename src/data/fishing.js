// Rybolov podle schváleného dokumentu „Rybolov – návrh systému“ (bez minihry:
// po nahození se podle úrovně za 3–10 s (úr. 1) až 1–3 s (úr. 100) objeví úlovek). Čísla jsou výchozí návrh, ladíme je spolu.
//
//   FISH / WATER_MATERIALS  úlovky (z nich vznikají předměty v items.js)
//   LOCATIONS               rybářské lokality s tabulkami úlovků (váhy v %, součet 100)
//   BAITS, RODS, METAL_PARTS náčiní a návnady

// Vzácnost dokumentu → vzácnost předmětů ve hře.
export const RARITY = {
  common: { label: 'Běžné', xp: 1, price: 1, color: '#c9cdd2' },
  uncommon: { label: 'Neobvyklé', xp: 1.5, price: 2, color: '#7fd67a' },
  rare: { label: 'Vzácné', xp: 2.5, price: 4, color: '#6fb6ff' },
  epic: { label: 'Velmi vzácné', xp: 4, price: 8, color: '#c48bff' },
  legendary: { label: 'Legendární', xp: 10, price: 25, color: '#ffcf5a' }
};
const RARE_OR_BETTER = new Set(['rare', 'epic', 'legendary']);
export const isRareOrBetter = (rarity) => RARE_OR_BETTER.has(rarity);

const FISH_ICON = 'icons01_043';

// [id, název, vzácnost, voda, min. úroveň, skupiny pro návnady]
const FISH_ROWS = [
  ['fish_roach', 'Plotice', 'common', 'rybník, řeka', 1, ['fresh']],
  ['fish_perch', 'Okoun', 'common', 'řeka, jezero', 1, ['fresh']],
  ['fish_carp', 'Kapr', 'common', 'rybník, jezero', 5, ['fresh']],
  ['fish_tench', 'Lín', 'uncommon', 'rybník', 5, ['fresh']],
  ['fish_trout', 'Pstruh potoční', 'uncommon', 'řeka', 8, ['fresh']],
  ['fish_pike', 'Štika', 'uncommon', 'řeka, jezero', 15, ['fresh', 'predator']],
  ['fish_eel', 'Úhoř říční', 'rare', 'řeka', 18, ['fresh', 'predator']],
  ['fish_catfish', 'Sumec', 'rare', 'řeka, jezero', 20, ['fresh', 'predator']],
  ['fish_ice_char', 'Ledový siven', 'uncommon', 'ledové jezero', 25, ['fresh', 'ice']],
  ['fish_frost_whitefish', 'Mrazivý síh', 'rare', 'ledové jezero', 30, ['fresh', 'ice']],
  ['fish_oasis_carp', 'Oázový kapr', 'uncommon', 'oáza', 35, ['fresh']],
  ['fish_golden_carp', 'Zlatý kapr', 'epic', 'rybník, jezero', 40, ['fresh']],
  ['fish_sardine', 'Sardinka', 'common', 'pobřeží', 30, ['sea']],
  ['fish_mackerel', 'Makrela', 'common', 'pobřeží, moře', 30, ['sea']],
  ['fish_cod', 'Treska', 'uncommon', 'pobřeží, moře', 32, ['sea']],
  ['fish_sea_bass', 'Mořský okoun', 'uncommon', 'pobřeží', 35, ['sea']],
  ['fish_coralfish', 'Korálovka', 'rare', 'korálový útes', 40, ['sea']],
  ['fish_tuna', 'Tuňák', 'rare', 'hluboké moře', 50, ['sea', 'deep']],
  ['fish_glowing_deep', 'Světélkující hlubinná ryba', 'rare', 'hluboké moře, laguna', 55, ['sea', 'deep']],
  ['fish_swordfish', 'Mečoun', 'epic', 'hluboké moře', 60, ['sea', 'deep']],
  ['fish_deep_eel', 'Hlubinný úhoř', 'epic', 'hluboké moře', 65, ['deep']],
  ['fish_shadow', 'Stínová ryba', 'rare', 'stínové jezero', 60, ['magic']],
  ['fish_elemental', 'Elementální ryba', 'rare', 'magické vody (element podle lokality)', 60, ['magic', 'elemental']],
  ['fish_moon', 'Měsíční ryba', 'epic', 'magické vody', 70, ['magic', 'moon']],
  ['fish_old_one', 'Stařec z tůně', 'legendary', 'rybník u Rybářské chaty', 50, ['fresh']],
  ['fish_astral', 'Astrální ryba', 'legendary', 'laguna, nebeská jezírka', 85, ['magic']],
  ['fish_dragon_carp', 'Dračí kapr', 'legendary', 'termy v Dračím hnízdě', 90, ['magic']]
];

const fishXp = (minLevel, rarity) => Math.round((10 + 3 * minLevel) * RARITY[rarity].xp);
const fishPrice = (minLevel, rarity) => Math.round((2 + 0.6 * minLevel) * RARITY[rarity].price);

export const FISH = FISH_ROWS.map(([id, name, rarity, water, minLevel, tags]) => ({
  id, name, rarity, water, minLevel, tags, kind: 'fish',
  xp: fishXp(minLevel, rarity), price: fishPrice(minLevel, rarity), icon: FISH_ICON
}));

// Vodní suroviny pro Řemeslnictví. Naplavené dřevo se počítá jako běžné Dřevo (wood).
// [id, název, vzácnost, kde, cena, XP, ikona, skupiny]
const MATERIAL_ROWS = [
  ['river_shell', 'Říční lastura', 'common', 'sladké vody', 2, 8, 'icons05_039', ['fresh']],
  ['sea_shell', 'Mořská lastura', 'common', 'pobřeží, moře', 4, 15, 'icons05_039', ['sea']],
  ['common_pearl', 'Běžná perla', 'uncommon', 'sladké vody', 15, 30, 'icons05_040', ['pearl']],
  ['quality_pearl', 'Kvalitní perla', 'rare', 'jezera, oáza, moře', 50, 120, 'icons05_041', ['pearl']],
  ['mat_morska_perla', 'Mořská perla', 'epic', 'pobřeží, moře', 150, 300, null, ['pearl', 'sea']],
  ['deep_pearl', 'Hlubinná perla', 'epic', 'hluboké moře, laguna', 220, 450, 'icons05_041', ['pearl', 'deep']],
  ['magic_pearl', 'Magická perla', 'legendary', 'magické vody', 600, 1200, 'icons05_040', ['pearl', 'moon']],
  ['common_coral', 'Běžný korál', 'uncommon', 'pobřeží', 12, 40, 'icons05_037', ['sea']],
  ['hardened_coral', 'Zpevněný korál', 'rare', 'pobřeží, útes', 45, 130, 'icons05_038', ['sea']],
  ['deep_coral', 'Hlubinný korál', 'epic', 'útes, hluboké moře, laguna', 180, 400, 'icons05_038', ['deep']],
  ['magic_coral', 'Magický korál', 'legendary', 'Mlžná laguna', 550, 1100, 'icons05_037', ['magic']]
];

// Šupiny pro Kovářství (vedlejší úlovek dravých a hlubinných ryb), od určité úrovně Rybolovu.
// [id, název, vzácnost, kde, cena, XP, ikona, skupiny, úroveň]
const SCALE_ROWS = [
  ['tough_fish_scale', 'Odolná rybí šupina', 'uncommon', 'řeky a jezera (štika, sumec, candát)', 6, 25, 'icons05_039', ['fresh'], 10],
  ['armored_sea_scale', 'Mořská pancéřová šupina', 'rare', 'pobřeží, útes, hluboké moře (mečoun, tuňák)', 40, 120, 'icons05_039', ['sea'], 30],
  ['deep_magic_scale', 'Hlubinná magická šupina', 'epic', 'hluboké moře, laguna, stínové jezero', 160, 400, 'icons05_039', ['deep', 'magic'], 50]
];

export const WATER_MATERIALS = [
  ...MATERIAL_ROWS.map(([id, name, rarity, water, price, xp, icon, tags]) => ({
    id, name, rarity, water, minLevel: 1, tags, kind: 'material', price, xp, icon, uses: 'Řemeslnictví'
  })),
  ...SCALE_ROWS.map(([id, name, rarity, water, price, xp, icon, tags, minLevel]) => ({
    id, name, rarity, water, minLevel, tags, kind: 'material', price, xp, icon, uses: 'Kovářství (šupinové zbroje a výztuhy)'
  }))
];

// Naplavené dřevo = běžné Dřevo z inventáře.
const WOOD_CATCH = { id: 'wood', name: 'Naplavené dřevo', rarity: 'common', minLevel: 1, tags: ['fresh'], kind: 'material', price: 1, xp: 5 };

export const CATCHES = Object.fromEntries([...FISH, ...WATER_MATERIALS, WOOD_CATCH].map((c) => [c.id, c]));

// Elementální ryba podle lokality (zobrazí se v názvu úlovku v okně).
const E = 'fish_elemental';

export const LOCATIONS = [
  { id: 'greenvale_pond', name: 'Rybník u Rybářské chaty', region: 'Greenvale', water: 'rybník', minLevel: 1, metal: 'hook',
    table: { fish_roach: 30, fish_perch: 20, fish_carp: 18, fish_tench: 12, river_shell: 10, wood: 6, common_pearl: 3, fish_golden_carp: 0.9, fish_old_one: 0.1 } },
  { id: 'greenvale_dock', name: 'Molo na řece', region: 'Greenvale', water: 'řeka', minLevel: 1, metal: 'hook',
    table: { fish_roach: 25, fish_perch: 25, fish_trout: 15, fish_carp: 10, river_shell: 8, fish_pike: 6, fish_eel: 5, wood: 5, common_pearl: 1 } },
  { id: 'verdant_river', name: 'Lesní řeka', region: 'Verdant Forest', water: 'řeka', minLevel: 10, metal: 'hook',
    table: { fish_trout: 22, fish_perch: 20, fish_pike: 14, fish_roach: 12, fish_eel: 10, fish_catfish: 8, river_shell: 8, common_pearl: 3, wood: 3, tough_fish_scale: 8 } },
  { id: 'stonehelm_lake', name: 'Horské jezero', region: 'Stonehelm Range', water: 'jezero', minLevel: 20, metal: 'hook',
    table: { fish_perch: 18, fish_carp: 18, fish_pike: 18, fish_catfish: 14, fish_trout: 12, river_shell: 9, common_pearl: 6, quality_pearl: 4, fish_golden_carp: 1, tough_fish_scale: 8 } },
  { id: 'frost_lake', name: 'Ledové jezero', region: 'Frostlands', water: 'jezero', minLevel: 25, metal: 'hook', element: 'led',
    table: { fish_ice_char: 35, fish_perch: 20, fish_frost_whitefish: 15, fish_pike: 12, fish_catfish: 6, river_shell: 6, quality_pearl: 4, [E]: 2, tough_fish_scale: 6 } },
  { id: 'sand_oasis', name: 'Oáza', region: 'Sandwraith Wastes', water: 'rybník', minLevel: 35, metal: 'hook', element: 'oheň',
    table: { fish_oasis_carp: 35, fish_carp: 20, fish_tench: 15, river_shell: 10, fish_eel: 7, quality_pearl: 6, [E]: 4, fish_golden_carp: 3 } },
  { id: 'azure_coast', name: 'Pobřeží', region: 'Azure Coast', water: 'pobřežní vody', minLevel: 30, metal: 'reel',
    table: { fish_sardine: 22, fish_mackerel: 20, fish_cod: 14, fish_sea_bass: 12, sea_shell: 12, common_coral: 7, fish_coralfish: 6, hardened_coral: 3, quality_pearl: 3, mat_morska_perla: 1, armored_sea_scale: 5 } },
  { id: 'azure_reef', name: 'Korálový útes', region: 'Azure Coast', water: 'pobřežní vody', minLevel: 40, metal: 'reel',
    table: { fish_coralfish: 18, fish_sea_bass: 18, fish_cod: 14, fish_mackerel: 12, common_coral: 12, hardened_coral: 8, sea_shell: 8, quality_pearl: 6, mat_morska_perla: 3, deep_coral: 1, armored_sea_scale: 6 } },
  { id: 'mystic_deep_sea', name: 'Hluboké moře', region: 'Mystic Isles', water: 'hluboké moře', minLevel: 50, metal: 'reel',
    table: { fish_tuna: 20, fish_cod: 18, fish_mackerel: 17, fish_glowing_deep: 15, sea_shell: 8, mat_morska_perla: 6, fish_swordfish: 5, fish_deep_eel: 4, deep_coral: 4, deep_pearl: 3, armored_sea_scale: 4, deep_magic_scale: 3 } },
  { id: 'shadow_lake', name: 'Stínové jezero', region: 'Shadow Realm', water: 'magická voda', minLevel: 60, metal: 'spear', element: 'stín',
    table: { fish_shadow: 30, fish_catfish: 20, fish_eel: 15, [E]: 10, river_shell: 8, quality_pearl: 7, fish_deep_eel: 5, fish_moon: 4, magic_pearl: 1, deep_magic_scale: 2 } },
  { id: 'mystic_lagoon', name: 'Mlžná laguna', region: 'Mystic Isles', water: 'magická voda', minLevel: 70, metal: 'spear', element: 'voda',
    table: { [E]: 19, fish_glowing_deep: 19, fish_moon: 15, fish_coralfish: 15, sea_shell: 14, deep_coral: 9, deep_pearl: 7, magic_coral: 1, magic_pearl: 0.5, fish_astral: 0.5, deep_magic_scale: 3 } },
  { id: 'skyreach_ponds', name: 'Nebeská jezírka', region: 'Skyreach Citadel', water: 'magická voda', minLevel: 80, metal: 'spear', element: 'vzduch',
    table: { fish_moon: 25, [E]: 25, fish_trout: 20, quality_pearl: 12, fish_golden_carp: 8, river_shell: 8, magic_pearl: 1, fish_astral: 1 } },
  { id: 'dragon_springs', name: 'Termální prameny', region: "Dragon's Nest", water: 'magická voda', minLevel: 90, metal: 'spear', element: 'oheň',
    table: { [E]: 42, fish_catfish: 15, fish_deep_eel: 15, quality_pearl: 13, fish_moon: 13, magic_pearl: 1, fish_dragon_carp: 1 } }
];
export const LOCATION_BY_ID = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));
export const SEA_WATERS = new Set(['pobřežní vody', 'hluboké moře']);

// Kovové části (Kovářství, schválené recepty). Vyšší umí vše, co nižší.
// tier: hook 1 < reinforced 2 < reel 3 < spear 4.
export const METAL_PARTS = [
  // Dárek od Rybáře: základní háček bez bonusů, prodá se za 1 zlatý.
  { id: 'old_hook', name: 'Starý háček', tier: 1, rareBonus: 1, starter: 'Rybář',
    description: 'Starý háček od Rybáře. Rybolov ve sladkých vodách, bez bonusů.' },
  { id: 'fishing_hook', name: 'Rybářský hák', tier: 1, rareBonus: 1, price: 20,
    description: 'Kovová část rybářského náčiní. Rybolov ve sladkých vodách. (Kovářství 5: 1 železo, měděný drát; zatím prodává Rybářská chata.)' },
  { id: 'reinforced_fishing_hook', name: 'Zesílený rybářský hák', tier: 2, rareBonus: 1.25,
    description: 'Sladké vody, vzácné a vyšší úlovky ×1,25. (Kovářství 12: 2 železa, Gobliní železný úlomek.)' },
  { id: 'sea_reel', name: 'Mořský naviják', tier: 3, rareBonus: 1.25,
    description: 'Nutný pro pobřeží a hluboké moře. (Kovářství 30: 5 želez, Hlubinné chapadlové vlákno, dřevo.)' },
  { id: 'hydra_spear', name: 'Rybářský bodec z hydří šupiny', tier: 4, rareBonus: 1.25,
    description: 'Nutný pro magické vody, vzácné a vyšší úlovky ×1,25. (Kovářství 45: 5 ocelí, Hydří šupina.)' }
];
// Co lokalita vyžaduje (nejnižší tier kovové části).
export const METAL_REQUIREMENT = {
  hook: { tier: 1, label: 'Rybářský hák' },
  reel: { tier: 3, label: 'Mořský naviják' },
  spear: { tier: 4, label: 'Rybářský bodec z hydří šupiny' }
};

// Pruty (Řemeslnictví – návrh). wait = násobek doby čekání.
export const RODS = [
  // Dárek od Rybáře: základní prut bez bonusů, prodá se za 1 zlatý.
  { id: 'old_rod', name: 'Starý prut', wait: 1, starter: 'Rybář',
    description: 'Starý prut od Rybáře, bez bonusů.' },
  { id: 'simple_rod', name: 'Jednoduchý prut', wait: 1, price: 15,
    description: 'Základní prut. (Řemeslnictví 1: 2× Dřevo, 2× Vlákno; prodává Rybářská chata.)' },
  { id: 'flexible_rod', name: 'Pružný prut', wait: 0.9,
    description: 'Čekání na úlovek ×0,9. (Řemeslnictví 25: 2× Živé dřevo, 2× Kořenové vlákno, 2× Vlákno.)' },
  { id: 'master_rod', name: 'Mistrovský prut', wait: 0.8,
    description: 'Čekání na úlovek ×0,8. (Řemeslnictví 60: Pružný prut, Staré živé dřevo, 2× Hlubinné chapadlové vlákno.)' }
];

// Návnady: wait = násobek čekání (jen ve vyznačené vodě), boost = násobky vah skupin úlovků.
// Skupiny: fresh, sea, deep, predator, ice, elemental, moon, pearl, common, uncommon, legendary.
export const BAITS = [
  { id: 'bread_bait', name: 'Chlebová návnada', price: 1, pack: 5, wait: 0.95, waters: 'all',
    effect: 'Čekání −5 %.' },
  { id: 'worm_bait', name: 'Žížaly', price: 2, pack: 5, wait: 0.9, waters: 'fresh', boost: { commonFresh: 1.2 },
    effect: 'Čekání −10 % ve sladké vodě, běžné ryby ×1,2.' },
  { id: 'herbal_bait', name: 'Bylinková návnada', boost: { uncommonFresh: 1.5 },
    effect: 'Neobvyklé sladkovodní úlovky ×1,5. (Řemeslnictví 5: Lesní šalvěj, Léčivé byliny → 5 ks.)' },
  { id: 'spiced_bait', name: 'Kořeněná návnada', boost: { predator: 2 },
    effect: 'Štika, Sumec, Úhoř ×2. (Řemeslnictví 20: Hořký kořen, Poutnický tymián → 5 ks.)' },
  { id: 'ice_bait', name: 'Ledová návnada', boost: { ice: 1.5, elementalIce: 2 },
    effect: 'Ledový siven a Mrazivý síh ×1,5, Elementální ryba v ledu ×2. (Řemeslnictví 25.)' },
  { id: 'sea_bait', name: 'Mořská návnada', wait: 0.9, waters: 'sea', boost: { uncommonSea: 1.5 },
    effect: 'Čekání −10 % v moři, neobvyklé mořské ×1,5. (Řemeslnictví 30.)' },
  { id: 'fire_bait', name: 'Ohnivá návnada', boost: { elementalFire: 2 },
    effect: 'Elementální ryba ×2 v oáze a termech. (Řemeslnictví 35.)' },
  { id: 'glow_bait', name: 'Svítivá návnada', boost: { deep: 2, deepPearlCoral: 1.5 },
    effect: 'Hlubinné ryby ×2, hlubinná perla a korál ×1,5. (Řemeslnictví 50.)' },
  { id: 'moon_bait', name: 'Měsíční návnada', boost: { moonFish: 2, magicPearl: 1.5 },
    effect: 'Měsíční ryba ×2, Magická perla ×1,5. (Řemeslnictví 70.)' },
  { id: 'astral_bait', name: 'Astrální návnada', boost: { legendary: 2 },
    effect: 'Legendární úlovky ×2 (stále nejvýš 1 %). (Řemeslnictví 90.)' }
];
export const BAIT_BY_ID = Object.fromEntries(BAITS.map((b) => [b.id, b]));

// Pravidla (odd. 3, 7, 8 návrhu).
export const FISHING_RULES = {
  maxLevel: 100,
  // Doba čekání: náhodně v intervalu podle úrovně Rybolovu – úroveň 1: 3–10 s, úroveň 100: 1–3 s
  // (mezi nimi plynule). Prut, návnada a Návnadový olej ji dál zkracují.
  waitAtLevel1: [3, 10],
  waitAtMaxLevel: [1, 3],
  minWait: 0.8,
  maxWait: 10,
  legendaryCap: 1, // % v tabulce po všech úpravách
  legendaryCooldownMs: 30 * 60 * 1000,
  dailyDemandBonus: 1.5,
  dailyDemandLimit: 10,
  otherMerchantRate: 0.8
};

export const xpToNextFishingLevel = (level) => Math.round(20 * Math.pow(Math.max(1, level), 1.5));
