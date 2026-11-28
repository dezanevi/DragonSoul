// Sběr bylin podle schváleného dokumentu „Sběr bylin – návrh systému“ (bez minihry:
// E u naleziště → okno naleziště → Sbírat → ukazatel 2–5 s → okno kořisti).
// Čísla jsou výchozí návrh, ladíme je spolu.
//
//   HERB_RARITY        6 vzácností → výtěžnost, obnova, doba sběru, XP, cena
//   HERB_CATALOG       16 schválených rostlin (předměty už existují – items.js / cooking.js)
//   HERB_SITES         19 běžných nalezišť + 3 záhony statku
//   SPECIAL_HERB_SITES husté porosty, skryté lesní naleziště, magická zahrada, prastaré naleziště
//   SICKLES, HERB_RARE_FINDS, HERB_SPECIALIZATIONS, HERBALIST_STOCK

export const HERB_RARITY = {
  // Obnova: běžné a neobvyklé (i záhony) za 12 min, vzácné a lepší za 48 min (přání hráče).
  common: { label: 'Běžná', yield: [2, 4], respawnMin: 12, seconds: 2, xp: 10, price: 3, tier: 1 },
  uncommon: { label: 'Neobvyklá', yield: [1, 3], respawnMin: 12, seconds: 2.5, xp: 18, price: 8, tier: 1 },
  rare: { label: 'Vzácná', yield: [1, 2], respawnMin: 48, seconds: 3, xp: 30, price: 20, tier: 2 },
  epic: { label: 'Velmi vzácná', yield: [1, 1], respawnMin: 48, seconds: 3.5, xp: 45, price: 45, tier: 3 },
  magic: { label: 'Magická', yield: [1, 1], respawnMin: 48, seconds: 4, xp: 65, price: 90, tier: 4 },
  legendary: { label: 'Legendární', yield: [1, 1], respawnMin: 48, seconds: 5, xp: 100, price: 250, tier: 5 }
};

// Vzácnost rostliny → vzácnost předmětu (barvy v inventáři používají klíče common … legendary).
export const ITEM_RARITY = { common: 'common', uncommon: 'uncommon', rare: 'rare', epic: 'epic', magic: 'epic', legendary: 'legendary' };

export const HERB_RULES = {
  maxLevel: 100,
  minSeconds: 1.5,
  secondsPerLevel: 0.01, // −1 % doby sběru za úroveň nad úrovní rostliny
  bonusYieldOver: 25, // od úrovně rostliny + 25: maximum +1 (běžné a neobvyklé)
  sideChance: 0.25, // vedlejší rostlina naleziště
  rareBase: 0.1, // šance na vzácný nález: 10 % + 0,2 % za úroveň, strop 25 %
  rarePerLevel: 0.002,
  rareCap: 0.25,
  levelXpScale: 25, // XP = základ × (1 + úroveň rostliny / 25)
  specialXp: 1.5,
  cultivatedXp: 0.5,
  cultivatedRespawnMin: 12,
  firstHarvestXp: 5, // herbář: první sběr rostliny = 5× základní XP navíc
  hiddenMinutes: 30,
  specializationLevel: 25,
  specializationChangeCost: 250
};

export const HERB_CLASSES = [
  { id: 'I', name: 'Začátečník', from: 1 },
  { id: 'II', name: 'Učeň', from: 16 },
  { id: 'III', name: 'Bylinkář', from: 31 },
  { id: 'IV', name: 'Mistr bylinář', from: 51 },
  { id: 'V', name: 'Velmistr', from: 71 },
  { id: 'VI', name: 'Legendární bylinář', from: 91 }
];
export const herbClass = (level) => [...HERB_CLASSES].reverse().find((c) => level >= c.from) ?? HERB_CLASSES[0];

export const BIOMES = {
  meadow: 'Louky', forest: 'Lesy a mýtiny', wetland: 'Mokřady', shade: 'Voda a stín', mountain: 'Hory',
  magic: 'Magické a prastaré', volcanic: 'Sopečné', ancient: 'Prastaré', cultivated: 'Kultivované'
};

// [#, id, název, popis vzhledu, vzácnost, úroveň, hlavní biom, vedlejší biom]
const CATALOG_ROWS = [
  [1, 'healing_herbs', 'Léčivé byliny', 'Nízké trsy širokých listů s bílými kvítky.', 'common', 1, 'meadow', 'forest'],
  [2, 'cleansing_herbs', 'Čistící byliny', 'Stříbřitě zelené stonky s vůní mýdla.', 'common', 1, 'wetland', 'meadow'],
  [3, 'blue_herbs', 'Modré byliny', 'Modrofialové lístky, ve stínu slabě světélkují.', 'common', 2, 'shade', 'wetland'],
  [4, 'bitter_root', 'Hořký kořen', 'Tmavý zkroucený kořen s hořkou vůní.', 'common', 2, 'forest', 'meadow'],
  [5, 'forest_sage', 'Lesní šalvěj', 'Šedozelené sametové listy na mýtinách.', 'uncommon', 4, 'forest', 'meadow'],
  [6, 'wayfarer_thyme', 'Poutnický tymián', 'Drobné fialové kvítky podél cest.', 'uncommon', 8, 'meadow', 'mountain'],
  [7, 'mat_vodni_kvet', 'Vodní květ', 'Bílomodrý květ na hladině.', 'uncommon', 7, 'wetland', 'shade'], // úroveň 7 (úkol Byliny III)
  [8, 'mat_svitici_list', 'Svítící list', 'List s jemně zářícími žilkami.', 'uncommon', 8, 'forest', 'magic'],
  [9, 'mountain_root', 'Horský kořen', 'Tvrdý kořen obalený drobnými kamínky.', 'uncommon', 8, 'mountain', 'forest'],
  [10, 'storm_fern', 'Bouřková kapradina', 'Kapradina s jiskřícími okraji listů.', 'rare', 16, 'mountain', 'magic'],
  [11, 'sun_thistle', 'Sluneční bodlák', 'Zlatý bodlák natáčející se za sluncem.', 'rare', 22, 'volcanic', 'meadow'],
  [12, 'fire_sage', 'Ohnivá šalvěj', 'Rudé listy, teplé na dotek.', 'rare', 24, 'volcanic', 'mountain'],
  [13, 'ice_mint', 'Ledová máta', 'Modrobílá máta pokrytá jinovatkou.', 'rare', 26, 'mountain', 'shade'],
  [14, 'moon_flower', 'Měsíční květ', 'Stříbrný květ, otevírá se jen v noci.', 'epic', 40, 'magic', 'forest'],
  [15, 'shadow_lily', 'Stínová lilie', 'Černá lilie s fialovým leskem.', 'magic', 55, 'magic', 'shade'],
  [16, 'astral_orchid', 'Astrální orchidej', 'Průsvitná orchidej s hvězdnými tečkami.', 'legendary', 82, 'ancient', 'magic']
];

export const HERB_CATALOG = CATALOG_ROWS.map(([no, id, name, look, rarity, level, biome, biome2]) => ({
  no, id, name, look, rarity, level, biome, biome2, tier: HERB_RARITY[rarity].tier,
  price: Math.round(HERB_RARITY[rarity].price * (1 + level / 50))
}));
export const HERB_BY_ID = Object.fromEntries(HERB_CATALOG.map((h) => [h.id, h]));

// [id, název, region, biom, hlavní rostlina, vedlejší rostlina]
const SITE_ROWS = [
  ['H01', 'Louka u lesa', 'Greenvale', 'meadow', 'healing_herbs', 'bitter_root'],
  ['H02', 'Břeh řeky', 'Greenvale', 'wetland', 'cleansing_herbs', 'blue_herbs'],
  ['H03', 'Stín u vodopádu', 'Greenvale', 'shade', 'blue_herbs', 'mat_vodni_kvet'],
  ['H04', 'Les', 'Greenvale', 'forest', 'bitter_root', 'forest_sage'],
  ['H05', 'Okraj lesa', 'Greenvale', 'forest', 'forest_sage', 'healing_herbs'],
  ['H06', 'Skály u vodopádu', 'Greenvale', 'mountain', 'mountain_root', 'bitter_root'],
  ['H07', 'Tůňky u řeky', 'Greenvale', 'wetland', 'mat_vodni_kvet', 'cleansing_herbs'],
  ['H08', 'Lesní cesta', 'Verdant Forest', 'meadow', 'wayfarer_thyme', 'healing_herbs'],
  ['H09', 'Hluboký les', 'Verdant Forest', 'forest', 'mat_svitici_list', 'forest_sage'],
  ['H10', 'Slunná louka', 'Verdant Forest', 'meadow', 'sun_thistle', 'wayfarer_thyme'],
  ['H11', 'Horské svahy', 'Stonehelm Range', 'mountain', 'mountain_root', 'storm_fern'],
  ['H12', 'Štíty', 'Stonehelm Range', 'mountain', 'storm_fern', 'mountain_root'],
  ['H13', 'Horské stezky', 'Skyreach Citadel', 'mountain', 'wayfarer_thyme', 'storm_fern'],
  ['H14', 'Sopečné úbočí', 'Sandwraith Wastes', 'volcanic', 'fire_sage', 'sun_thistle'],
  ['H15', 'Ledové prameny', 'Frostlands', 'mountain', 'ice_mint', 'blue_herbs'],
  ['H16', 'Laguna', 'Azure Coast', 'shade', 'mat_vodni_kvet', 'blue_herbs'],
  ['H17', 'Noční mýtina', 'Mystic Isles', 'magic', 'moon_flower', 'mat_svitici_list'],
  ['H18', 'Stinné jezírko', 'Shadow Realm', 'magic', 'shadow_lily', 'moon_flower'],
  ['H19', 'Žhavé svahy', "Dragon's Nest", 'volcanic', 'fire_sage', 'sun_thistle'],
  // Záhony statku: kultivované, obnova 10 min, bez vedlejších a vzácných nálezů, poloviční XP.
  ['Z01', 'Záhon statku – Léčivé byliny', 'Greenvale', 'cultivated', 'healing_herbs', null],
  ['Z02', 'Záhon statku – Čistící byliny', 'Greenvale', 'cultivated', 'cleansing_herbs', null],
  ['Z03', 'Záhon statku – Poutnický tymián', 'Greenvale', 'cultivated', 'wayfarer_thyme', null],
  // Zahrádky domů v Greenvale (bylinky do úrovně 10).
  ['G01', 'Zahrádka u domu', 'Greenvale', 'meadow', 'healing_herbs', 'cleansing_herbs'],
  ['G02', 'Zahrádka u domu', 'Greenvale', 'forest', 'forest_sage', 'healing_herbs'],
  ['G03', 'Zahrádka Řemeslné dílny', 'Greenvale', 'wetland', 'cleansing_herbs', 'healing_herbs'],
  ['G04', 'Zahrádka Řemeslné dílny', 'Greenvale', 'forest', 'bitter_root', 'forest_sage'],
  ['G05', 'Zahrádka u domu', 'Greenvale', 'meadow', 'healing_herbs', 'bitter_root'],
  ['G06', 'Zahrádka u domu', 'Greenvale', 'shade', 'blue_herbs', 'cleansing_herbs'],
  ['G07', 'Zahrádka Lovecké chaty', 'Greenvale', 'forest', 'bitter_root', 'healing_herbs'],
  ['G08', 'Zahrádka u domu', 'Greenvale', 'meadow', 'wayfarer_thyme', 'healing_herbs'],
  ['G09', 'Zahrádka u domu', 'Greenvale', 'wetland', 'cleansing_herbs', 'blue_herbs'],
  ['G10', 'Zahrádka Rybářské chaty', 'Greenvale', 'shade', 'blue_herbs', 'mat_vodni_kvet'],
  ['G11', 'Zahrádka u domu', 'Greenvale', 'forest', 'forest_sage', 'bitter_root'],
  ['G12', 'Zahrádka u domu', 'Greenvale', 'meadow', 'healing_herbs', 'wayfarer_thyme'],
  // Byliny uvnitř ohrady statku (jeden velký statek, do úrovně 10).
  ['L01', 'Statek – bylinkový záhon', 'Greenvale', 'meadow', 'healing_herbs', 'cleansing_herbs'],
  ['L02', 'Statek – mokřina', 'Greenvale', 'wetland', 'cleansing_herbs', 'blue_herbs'],
  ['L03', 'Statek – stín', 'Greenvale', 'shade', 'blue_herbs', 'bitter_root'],
  ['L04', 'Statek – remízek', 'Greenvale', 'forest', 'bitter_root', 'forest_sage'],
  ['L05', 'Statek – bylinkový záhon', 'Greenvale', 'meadow', 'forest_sage', 'healing_herbs'],
  ['L06', 'Statek – bylinkový záhon', 'Greenvale', 'meadow', 'wayfarer_thyme', 'healing_herbs'],
  ['L07', 'Statek – tůňka', 'Greenvale', 'wetland', 'mat_vodni_kvet', 'cleansing_herbs'],
  ['L08', 'Statek – remízek', 'Greenvale', 'forest', 'mat_svitici_list', 'forest_sage'],
  ['L09', 'Statek – kamení', 'Greenvale', 'mountain', 'mountain_root', 'bitter_root']
];

export const HERB_SITES = SITE_ROWS.map(([id, name, region, biome, main, side]) => {
  const herb = HERB_BY_ID[main];
  const cultivated = biome === 'cultivated';
  return {
    id, name, region, biome, main, side, cultivated,
    minLevel: herb.level, tier: herb.tier, rarity: herb.rarity,
    respawnMs: (cultivated ? HERB_RULES.cultivatedRespawnMin : HERB_RARITY[herb.rarity].respawnMin) * 60000
  };
});

// Speciální naleziště: několik tahů z vlastní tabulky (váhy v %).
export const SPECIAL_HERB_SITES = [
  { id: 'SH1', name: 'Hustý bylinný porost', special: 'thicket', region: 'Greenvale', biome: 'meadow',
    minLevel: 10, tier: 1, draws: 3, extraYield: 1, rareChance: 0.08, respawnMs: 48 * 60000,
    table: { healing_herbs: 35, cleansing_herbs: 25, forest_sage: 20, wayfarer_thyme: 20 },
    finds: ['herb_rare_seeds', 'herb_botanical_note'] },
  { id: 'SH2', name: 'Skryté lesní naleziště', special: 'hidden', region: 'Greenvale', biome: 'forest',
    minLevel: 25, tier: 2, draws: 3, extraYield: 0, rareChance: 0.15, respawnMs: 48 * 60000,
    table: { mat_svitici_list: 50, forest_sage: 45, moon_flower: 5 },
    finds: ['herb_rare_seeds', 'herb_forest_resin', 'herb_botanical_note'] },
  { id: 'SH3', name: 'Magická zahrada', special: 'garden', region: 'Mystic Isles', biome: 'magic',
    minLevel: 45, tier: 3, draws: 2, extraYield: 0, rareChance: 0.12, respawnMs: 48 * 60000,
    table: { moon_flower: 50, mat_svitici_list: 45, shadow_lily: 5 },
    finds: ['herb_pollen', 'herb_flower_essence'] },
  { id: 'SH4', name: 'Prastaré botanické naleziště', special: 'ancient', region: 'Mystic Isles', biome: 'ancient',
    minLevel: 82, tier: 5, draws: 1, extraYield: 0, rareChance: 0.2, respawnMs: 48 * 60000,
    guaranteed: 'astral_orchid', table: { shadow_lily: 50, moon_flower: 50 },
    finds: ['mat_prastare_semeno'] }
];

export const ALL_HERB_SITES = [...HERB_SITES, ...SPECIAL_HERB_SITES];
export const HERB_SITE_BY_ID = Object.fromEntries(ALL_HERB_SITES.map((s) => [s.id, s]));

// Srpy (vyrábí Kovářství). Stupeň srpu = nejvyšší vzácnost, kterou jde sbírat.
export const SICKLES = [
  // Dárek od Bylinkářky: základní srp bez bonusů, prodá se za 1 zlatý.
  { id: 'old_sickle', name: 'Starý srp', tier: 1, level: 1, smithing: 0, starter: 'Bylinkářka' },
  { id: 'herb_sickle', name: 'Zahradnický srp', tier: 1, level: 1, smithing: 3, price: 30 },
  { id: 'silver_herb_sickle', name: 'Mistrný srp', tier: 2, level: 15, smithing: 26 },
  { id: 'brass_herb_gatherer', name: 'Sběrač bylin s mosaznou čepelí', tier: 3, level: 35, smithing: 50 },
  { id: 'mithril_sickle', name: 'Mithrilový srp', tier: 4, level: 52, smithing: 68 },
  { id: 'star_sickle', name: 'Hvězdný srp', tier: 5, level: 80, smithing: 88 }
];
export const SICKLE_EFFECTS = {
  old_sickle: 'Sbírá běžné a neobvyklé rostliny.',
  herb_sickle: 'Sbírá běžné a neobvyklé rostliny.',
  silver_herb_sickle: 'Sbírá i vzácné rostliny; +15 % šance na +1 kus u vzácných, vzácné nálezy +2 b.',
  brass_herb_gatherer: 'Sbírá i velmi vzácné rostliny; +20 % šance na +1 kus u vzácných a velmi vzácných, obnova −10 %.',
  mithril_sickle: 'Sbírá i magické rostliny; vzácné nálezy +3 b., doba sběru −15 %.',
  star_sickle: 'Sbírá i legendární rostliny; speciální nález u legendárních 15 % místo 10 %.'
};
export const HERB_TIER_LABEL = ['', 'I', 'II', 'III', 'IV', 'V'];

// Vzácné vedlejší nálezy (vlastní hod po sběru, nikdy zaručené).
export const HERB_RARE_FINDS = [
  { id: 'herb_rare_seeds', name: 'Vzácná semena', rarity: 'uncommon', price: 25,
    description: 'Husté porosty a skrytá naleziště. Použij u záhonu statku: záhon na 2 h ponese neobvyklou rostlinu. Bylinkářka je vykupuje.' },
  { id: 'herb_pollen', name: 'Sušené květní pylové zrno', rarity: 'rare', price: 40,
    description: 'Velmi vzácné, magické a legendární rostliny. Alchymie: katalyzátor magických receptů.' },
  { id: 'herb_forest_resin', name: 'Lesní pryskyřice', rarity: 'uncommon', price: 15,
    description: 'Lesní naleziště. Kovářství: rukojeti srpů (místo dřeva); později Řemeslnictví.' },
  { id: 'herb_flower_essence', name: 'Vonná květní esence', rarity: 'rare', price: 35,
    description: 'Vodní květ, Sluneční bodlák, Měsíční květ. Vaření: místo Aromatického prášku; Alchymie: Elixír bystrosti.' },
  { id: 'herb_botanical_note', name: 'Botanický zápis', rarity: 'rare', price: 60,
    description: 'Použij: odhalí v tomto regionu Skryté lesní naleziště na 30 min.' }
];
// Vzácný nález podle rostliny / naleziště (běžná naleziště).
export const FLOWER_HERBS = new Set(['mat_vodni_kvet', 'sun_thistle', 'moon_flower']);
export const POLLEN_RARITIES = new Set(['epic', 'magic', 'legendary']);

export const HERB_SPECIALIZATIONS = [
  { id: 'healer', name: 'Znalec léčivých rostlin', focus: 'léčivé a regenerační byliny',
    herbs: ['healing_herbs', 'cleansing_herbs', 'forest_sage', 'mat_vodni_kvet', 'sun_thistle'],
    text: 'Léčivé a Čistící byliny, Lesní šalvěj, Vodní květ, Sluneční bodlák: 35 % na +1 kus, vedlejší rostlina 35 %. Elementální a magické rostliny −10 % XP.' },
  { id: 'elemental', name: 'Elementální bylinář', focus: 'elementální a magické rostliny',
    herbs: ['fire_sage', 'ice_mint', 'storm_fern'],
    text: 'Ohnivá šalvěj, Ledová máta, Bouřková kapradina: 35 % na +1 kus, obnova −20 %; magické rostliny: pylové zrno 14 %. Běžné rostliny bez bonusu od úrovně.' },
  { id: 'explorer', name: 'Průzkumník divoké přírody', focus: 'objevování nalezišť',
    herbs: [],
    text: 'Les: 4 % odhalit Skryté naleziště; vzácné nálezy ×1,5; husté porosty +1 kus; Botanický zápis 4 %. Běžná naleziště a záhony bez bonusu od úrovně.' }
];

// Bylinkářka: omezená denní zásoba běžných bylin (vzácné se neprodávají) a startovní srp.
export const HERBALIST_STOCK = [
  { id: 'healing_herbs', price: 4, daily: 10 },
  { id: 'cleansing_herbs', price: 4, daily: 10 },
  { id: 'blue_herbs', price: 5, daily: 8 },
  { id: 'wayfarer_thyme', price: 12, daily: 4 }
];

export const xpToNextHerbLevel = (level) => Math.round(20 * level ** 1.5);
