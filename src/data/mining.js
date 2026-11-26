// Těžba podle schváleného dokumentu „Těžba – návrh systému“ (bez minihry: E u naleziště →
// okno naleziště → Těžit → ukazatel 3–8 s → okno kořisti). Čísla jsou výchozí návrh.
//
//   MINING_MATERIALS  40 surovin (předměty vznikají v items.js; 7 už ve hře existuje)
//   DEPOSITS          39 běžných nalezišť (jedno na surovinu, Hvězdná ruda jen z meteoritu)
//   SPECIAL_DEPOSITS  geoda, runové ložisko, žhavé ložisko, hvězdný meteorit
//   PICKAXES, MINING_TOOLS, RARE_FINDS, MINING_SPECIALIZATIONS

// Vzácnost → výtěžnost, obnova, doba těžby, násobek XP a ceny (klíče jako u předmětů).
export const MINING_RARITY = {
  common: { label: 'Běžná', yield: [2, 4], respawnMin: 5, seconds: 3, xp: 1, price: 1 },
  uncommon: { label: 'Neobvyklá', yield: [1, 3], respawnMin: 15, seconds: 4, xp: 1.5, price: 2 },
  rare: { label: 'Vzácná', yield: [1, 2], respawnMin: 45, seconds: 5, xp: 2.5, price: 4 },
  epic: { label: 'Velmi vzácná', yield: [1, 1], respawnMin: 180, seconds: 6, xp: 4, price: 8 }
};

export const MINING_RULES = {
  maxLevel: 100,
  specialSeconds: 8,
  minSeconds: 1.5,
  specialXp: 5,
  hiddenXp: 1.5,
  sideBase: 0.12,
  sidePerLevel: 0.002,
  sideCap: 0.2,
  extraCap: 0.6,
  bonusYieldOver: 25, // od úrovně min. + 25 maximum +1 (běžné a neobvyklé)
  hiddenMinutes: 30,
  meteorHours: 24,
  specializationLevel: 25,
  specializationChangeCost: 250
};

export const CLASSES = [
  { id: 'I', name: 'Začátečník', from: 1 },
  { id: 'II', name: 'Učeň', from: 16 },
  { id: 'III', name: 'Horník', from: 31 },
  { id: 'IV', name: 'Mistr', from: 51 },
  { id: 'V', name: 'Velmistr', from: 71 },
  { id: 'VI', name: 'Legendární horník', from: 91 }
];
export const miningClass = (level) => [...CLASSES].reverse().find((c) => level >= c.from) ?? CLASSES[0];

const ICONS = { ore: 'icons01_037', gem: 'icons01_039', elemental: 'icons05_162', crystal: 'icons05_162', aux: 'icons01_038' };

// [#, id, název, vzácnost, kategorie, úroveň, krumpáč (1–6), hlavní oblast, využití]
// Kategorie: ore (rudy a kovy), gem (drahokamy), elemental (elementální krystaly),
// crystal (krystalické a magické minerály), aux (pomocné materiály).
const MATERIAL_ROWS = [
  [1, 'copper_ore', 'Měděná ruda', 'common', 'ore', 1, 1, 'Greenvale – lom', 'Kovářství: měděný ingot, drát, bronz.'],
  [2, 'iron_ore', 'Železná ruda', 'common', 'ore', 5, 1, 'Greenvale – jeskyně', 'Kovářství: železný ingot, ocel.'],
  [3, 'tin_ore', 'Cínová ruda', 'common', 'ore', 8, 1, 'Verdant Forest – lom', 'Kovářství: cínový ingot, bronz.'],
  [4, 'silver_ore', 'Stříbrná ruda', 'uncommon', 'ore', 20, 2, 'Stonehelm – doly', 'Kovářství: stříbrný ingot; Řemeslnictví: prsteny.'],
  [5, 'gold_ore', 'Zlatá ruda', 'uncommon', 'ore', 28, 2, 'Sandwraith – starý důl', 'Řemeslnictví: šperky; Kovářství: zlacení.'],
  [6, 'mountain_ore', 'Horská ruda', 'uncommon', 'ore', 32, 3, 'Stonehelm – hory', 'Kovářství: odolné zbroje a štíty.'],
  [7, 'blacksteel_ore', 'Ruda černé oceli', 'rare', 'ore', 45, 3, 'Stonehelm – hlubinné doly', 'Kovářství: černá ocel.'],
  [8, 'mithril_ore', 'Mithrilová ruda', 'rare', 'ore', 52, 4, 'Stonehelm – hlubinné doly', 'Kovářství: mithrilový ingot.'],
  [9, 'adamantite_ore', 'Adamantitová ruda', 'epic', 'ore', 72, 5, 'Frostlands – ledovec', 'Kovářství: adamantitový ingot.'],
  [10, 'orichalcum_ore', 'Orichalková ruda', 'epic', 'ore', 80, 5, "Dragon's Nest – sopky", 'Kovářství: legendární výrobky.'],
  [11, 'dragon_iron_ore', 'Dračí železná ruda', 'epic', 'ore', 92, 6, "Dragon's Nest – žhavá ložiska", 'Kovářství: dračí železo.'],
  [12, 'star_ore', 'Hvězdná ruda', 'epic', 'ore', 85, 5, 'Hvězdné meteority', 'Kovářství: hvězdný kov.'],
  [13, 'gem_ruby', 'Rubín', 'uncommon', 'gem', 34, 2, 'Sandwraith – sopečný okraj', 'Řemeslnictví: ohnivé doplňky; Kovářství: ohnivé kalení.'],
  [14, 'gem_sapphire', 'Safír', 'uncommon', 'gem', 30, 2, 'Frostlands – ledovcová stěna', 'Řemeslnictví: vodní a magické doplňky.'],
  [15, 'gem_emerald', 'Smaragd', 'uncommon', 'gem', 26, 2, 'Verdant Forest – kořenová jeskyně', 'Řemeslnictví: přírodní a regenerační doplňky.'],
  [16, 'gem_amethyst', 'Ametyst', 'uncommon', 'gem', 18, 2, 'Stonehelm – krystalová jeskyně', 'Řemeslnictví: duchovní doplňky.'],
  [17, 'gem_topaz', 'Topaz', 'uncommon', 'gem', 22, 2, 'Sandwraith – větrné skály', 'Řemeslnictví: vzdušné doplňky.'],
  [18, 'gem_diamond', 'Diamant', 'rare', 'gem', 55, 4, 'Frostlands – ledová jeskyně', 'Řemeslnictví a Kovářství: mistrovské výrobky.'],
  [19, 'gem_black_diamond', 'Černý diamant', 'epic', 'gem', 88, 5, 'Shadow Realm – ruiny', 'Stínové a legendární výrobky.'],
  [20, 'crystal_flame', 'Plamenný krystal', 'rare', 'elemental', 56, 4, 'Sandwraith – sopka', 'Alchymie: Plamenný koncentrát; Kovářství: kalení.'],
  [21, 'crystal_water', 'Vodní krystal', 'rare', 'elemental', 54, 4, 'Azure Coast – útesová jeskyně', 'Alchymie: Vodní koncentrát; Kovářství: kalení.'],
  [22, 'crystal_stone', 'Kamenný krystal', 'rare', 'elemental', 51, 4, 'Stonehelm – hory', 'Alchymie: Kamenný koncentrát; obranné vybavení.'],
  [23, 'crystal_air', 'Vzdušný krystal', 'rare', 'elemental', 58, 4, 'Skyreach – římsy', 'Alchymie: Vzdušný koncentrát; rychlostní vybavení.'],
  [24, 'crystal_verdant', 'Verdantský krystal', 'rare', 'elemental', 53, 4, 'Verdant Forest – hluboká kořenová jeskyně', 'Řemeslnictví a Kovářství: přírodní magické předměty.'],
  [25, 'crystal_shadow', 'Stínový krystal', 'epic', 'elemental', 75, 5, 'Shadow Realm', 'Alchymie: Stínový koncentrát; stínové vybavení.'],
  [26, 'crystal_astral', 'Astrální krystal', 'epic', 'elemental', 82, 5, 'Mystic Isles – ruiny', 'Alchymie: Astrální koncentrát; astrální výrobky.'],
  [27, 'mat_kristalovy_strep', 'Křišťálový střep', 'common', 'crystal', 10, 1, 'Greenvale – jeskyně', 'Základní magické recepty, Soul Crystaly.'],
  [28, 'mat_kristalove_jadro', 'Křišťálové jádro', 'uncommon', 'crystal', 38, 3, 'Stonehelm – krystalová jeskyně', 'Alchymie: Krystalická reagencie; pokročilé magické výrobky.'],
  [29, 'raw_cut_crystal', 'Broušený surový krystal', 'uncommon', 'crystal', 24, 2, 'Stonehelm – krystalová jeskyně', 'Řemeslnictví: doplňky, fokusy.'],
  [30, 'astral_shard', 'Astrální střep', 'rare', 'crystal', 60, 4, 'Mystic Isles – ruiny', 'Astrální receptury.'],
  [31, 'mat_hvezdny_prach', 'Hvězdný prach', 'rare', 'crystal', 65, 4, 'Skyreach – ruiny', 'Alchymie: Hvězdný katalyzátor, Teleportační prach.'],
  [32, 'living_mineral', 'Živý minerál', 'epic', 'crystal', 94, 6, "Dragon's Nest – svatyně", 'Prastaré magické předměty.'],
  [33, 'coal', 'Uhlí', 'common', 'aux', 1, 1, 'Greenvale – lom', 'Kovářství: palivo pro ingoty a ocel.'],
  [34, 'quartz', 'Křemen', 'common', 'aux', 3, 1, 'Greenvale – louka', 'Řemeslnictví: sklo, lucerny; Kovářství: tavidlo.'],
  [35, 'sulfur', 'Síra', 'uncommon', 'aux', 25, 2, 'Sandwraith – sirné prameny', 'Alchymie: Ohnivá směs; speciální slitiny.'],
  [36, 'salt', 'Sůl', 'common', 'aux', 4, 1, 'Greenvale – pobřeží', 'Vaření.'],
  [37, 'granite', 'Žulový kámen', 'common', 'aux', 1, 1, 'Greenvale – lom', 'Kovářství: kovadliny, brousky; stavební materiál.'],
  [38, 'obsidian', 'Obsidián', 'uncommon', 'aux', 40, 3, 'Sandwraith – sopka', 'Temné zbraně, magické výrobky.'],
  [39, 'pyrite', 'Pyrit', 'common', 'aux', 6, 1, 'Verdant Forest – lom', 'Kovářství: pomocná kovová surovina.'],
  [40, 'rune_stone', 'Runový kámen', 'rare', 'aux', 62, 4, 'Skyreach – ruiny', 'Runové vybavení, magické výrobky.']
];

const materialPrice = (level, rarity) => Math.round((2 + level / 5) * MINING_RARITY[rarity].price);

export const MINING_MATERIALS = MATERIAL_ROWS.map(([no, id, name, rarity, category, level, tier, area, uses]) => ({
  no, id, name, rarity, category, level, tier, area, uses, price: materialPrice(level, rarity), icon: ICONS[category]
}));
export const MINING_MATERIAL_BY_ID = Object.fromEntries(MINING_MATERIALS.map((m) => [m.id, m]));

// Typy nalezišť: vein = rudná žíla, quarry = povrchový lom, mine = podzemní důl,
// deep = hlubinný důl, mountain = horské, glacier = ledovec, volcano = sopka,
// crystal = krystalová jeskyně, ruins = prastaré ruiny.
export const DEPOSIT_TYPES = {
  vein: 'rudná žíla', quarry: 'povrchový lom', mine: 'podzemní důl', deep: 'hlubinný důl', mountain: 'horské naleziště',
  glacier: 'ledovec', volcano: 'sopka', crystal: 'krystalová jeskyně', ruins: 'prastaré ruiny'
};

// [id, název, typ, region, biom, hlavní surovina, vedlejší suroviny]
const DEPOSIT_ROWS = [
  ['N01', 'Měděná žíla', 'vein', 'Greenvale', 'lom', 'copper_ore', ['pyrite', 'quartz']],
  ['N02', 'Železná žíla', 'vein', 'Greenvale', 'jeskyně', 'iron_ore', ['coal', 'pyrite']],
  ['N03', 'Cínová žíla', 'vein', 'Verdant Forest', 'lom', 'tin_ore', ['copper_ore', 'quartz']],
  ['N04', 'Stříbrná žíla', 'mine', 'Stonehelm Range', 'doly', 'silver_ore', ['iron_ore', 'gem_amethyst']],
  ['N05', 'Zlatá žíla', 'mine', 'Sandwraith Wastes', 'starý důl', 'gold_ore', ['silver_ore', 'quartz']],
  ['N06', 'Horská žíla', 'mountain', 'Stonehelm Range', 'hory', 'mountain_ore', ['granite', 'iron_ore']],
  ['N07', 'Žíla černé oceli', 'deep', 'Stonehelm Range', 'hlubinné doly', 'blacksteel_ore', ['coal', 'obsidian']],
  ['N08', 'Mithrilová žíla', 'deep', 'Stonehelm Range', 'hlubinné doly', 'mithril_ore', ['silver_ore', 'crystal_stone']],
  ['N09', 'Adamantitová žíla', 'glacier', 'Frostlands', 'ledovec', 'adamantite_ore', ['mountain_ore', 'gem_diamond']],
  ['N10', 'Orichalková žíla', 'volcano', "Dragon's Nest", 'sopky', 'orichalcum_ore', ['obsidian', 'crystal_flame']],
  ['N11', 'Žíla dračího železa', 'volcano', "Dragon's Nest", 'sopky', 'dragon_iron_ore', ['orichalcum_ore', 'gem_ruby']],
  ['N13', 'Rubínová žíla', 'volcano', 'Sandwraith Wastes', 'sopečný okraj', 'gem_ruby', ['obsidian', 'sulfur']],
  ['N14', 'Safírová stěna', 'glacier', 'Frostlands', 'ledovcová stěna', 'gem_sapphire', ['mat_kristalovy_strep', 'gem_diamond']],
  ['N15', 'Smaragdová dutina', 'crystal', 'Verdant Forest', 'kořenová jeskyně', 'gem_emerald', ['mat_kristalovy_strep', 'crystal_verdant']],
  ['N16', 'Ametystová dutina', 'crystal', 'Stonehelm Range', 'krystalová jeskyně', 'gem_amethyst', ['mat_kristalovy_strep', 'raw_cut_crystal']],
  ['N17', 'Topazová skála', 'mountain', 'Sandwraith Wastes', 'větrné skály', 'gem_topaz', ['quartz', 'gold_ore']],
  ['N18', 'Diamantová žíla', 'crystal', 'Frostlands', 'ledová jeskyně', 'gem_diamond', ['gem_sapphire', 'mat_kristalove_jadro']],
  ['N19', 'Ložisko černého diamantu', 'ruins', 'Shadow Realm', 'ruiny', 'gem_black_diamond', ['crystal_shadow', 'obsidian']],
  ['N20', 'Plamenná krystalová žíla', 'volcano', 'Sandwraith Wastes', 'sopka', 'crystal_flame', ['gem_ruby', 'sulfur']],
  ['N21', 'Vodní krystalová jeskyně', 'crystal', 'Azure Coast', 'útesová jeskyně', 'crystal_water', ['gem_sapphire', 'salt']],
  ['N22', 'Kamenná krystalová žíla', 'mountain', 'Stonehelm Range', 'hory', 'crystal_stone', ['granite', 'mountain_ore']],
  ['N23', 'Vzdušná krystalová římsa', 'mountain', 'Skyreach Citadel', 'římsy', 'crystal_air', ['gem_topaz', 'quartz']],
  ['N24', 'Verdantská krystalová jeskyně', 'crystal', 'Verdant Forest', 'hluboká kořenová jeskyně', 'crystal_verdant', ['gem_emerald', 'mat_kristalovy_strep']],
  ['N25', 'Stínová krystalová žíla', 'ruins', 'Shadow Realm', 'ruiny', 'crystal_shadow', ['obsidian', 'gem_amethyst']],
  ['N26', 'Astrální krystalová žíla', 'ruins', 'Mystic Isles', 'ruiny', 'crystal_astral', ['astral_shard', 'mat_hvezdny_prach']],
  ['N27', 'Krystalová puklina', 'crystal', 'Greenvale', 'jeskyně', 'mat_kristalovy_strep', ['quartz', 'gem_amethyst']],
  ['N28', 'Jádrová krystalová dutina', 'crystal', 'Stonehelm Range', 'krystalová jeskyně', 'mat_kristalove_jadro', ['mat_kristalovy_strep', 'raw_cut_crystal']],
  ['N29', 'Krystalová štěrbina', 'crystal', 'Stonehelm Range', 'krystalová jeskyně', 'raw_cut_crystal', ['mat_kristalovy_strep', 'gem_amethyst']],
  ['N30', 'Astrální sutiny', 'ruins', 'Mystic Isles', 'ruiny', 'astral_shard', ['mat_kristalovy_strep', 'rune_stone']],
  ['N31', 'Hvězdné ložisko', 'ruins', 'Skyreach Citadel', 'ruiny', 'mat_hvezdny_prach', ['astral_shard', 'quartz']],
  ['N32', 'Prastará minerální svatyně', 'ruins', "Dragon's Nest", 'svatyně', 'living_mineral', ['crystal_astral', 'dragon_iron_ore']],
  ['N33', 'Uhelná sloj', 'quarry', 'Greenvale', 'lom', 'coal', ['pyrite', 'granite']],
  ['N34', 'Křemenná žíla', 'quarry', 'Greenvale', 'louka', 'quartz', ['mat_kristalovy_strep', 'pyrite']],
  ['N35', 'Sirné prameny', 'volcano', 'Sandwraith Wastes', 'sirné prameny', 'sulfur', ['salt', 'obsidian']],
  ['N36', 'Solná skála', 'quarry', 'Greenvale', 'pobřeží', 'salt', ['quartz']],
  ['N37', 'Žulový lom', 'quarry', 'Greenvale', 'lom', 'granite', ['quartz', 'copper_ore']],
  ['N38', 'Obsidiánové pole', 'volcano', 'Sandwraith Wastes', 'sopka', 'obsidian', ['sulfur', 'gem_ruby']],
  ['N39', 'Pyritová žíla', 'quarry', 'Verdant Forest', 'lom', 'pyrite', ['iron_ore', 'copper_ore']],
  ['N40', 'Runová skála', 'ruins', 'Skyreach Citadel', 'ruiny', 'rune_stone', ['astral_shard', 'mat_kristalovy_strep']]
];

export const DEPOSITS = DEPOSIT_ROWS.map(([id, name, type, region, biome, main, sides]) => {
  const material = MINING_MATERIAL_BY_ID[main];
  return {
    id, name, type, region, biome, main, sides,
    minLevel: material.level, tier: material.tier, rarity: material.rarity, category: material.category,
    respawnMs: MINING_RARITY[material.rarity].respawnMin * 60000
  };
});

// Speciální naleziště: několik tahů z vlastní tabulky (váhy v %), nutný doplňkový nástroj.
export const SPECIAL_DEPOSITS = [
  { id: 'S1', name: 'Krystalová geoda', type: 'crystal', special: 'geode', region: 'Stonehelm Range', biome: 'krystalové jeskyně',
    minLevel: 35, tier: 3, tool: 'tool_crystal_tongs', draws: 3, respawnMs: 6 * 3600000,
    table: { mat_kristalovy_strep: 40, gem_amethyst: 8, gem_topaz: 8, gem_emerald: 8, gem_sapphire: 8, gem_ruby: 8, mat_kristalove_jadro: 15, gem_diamond: 5 },
    rareFind: { id: 'uncut_gem', chance: 0.08 } },
  { id: 'S2', name: 'Runové ložisko', type: 'ruins', special: 'runic', region: 'Skyreach Citadel', biome: 'prastaré ruiny',
    minLevel: 60, tier: 4, tool: null, draws: 3, respawnMs: 12 * 3600000,
    table: { rune_stone: 40, astral_shard: 30, mat_hvezdny_prach: 25, star_ore: 5 },
    rareFind: { id: 'ancient_rune_fragment', chance: 0.04 } },
  { id: 'S3', name: 'Žhavé rudné ložisko', type: 'volcano', special: 'molten', region: "Dragon's Nest", biome: 'sopky',
    minLevel: 70, tier: 5, tool: 'tool_safety_tongs', draws: 3, respawnMs: 12 * 3600000,
    table: { obsidian: 35, crystal_flame: 30, gem_ruby: 25, dragon_iron_ore: 10 } },
  { id: 'S4', name: 'Hvězdný meteorit', type: 'ruins', special: 'meteor', region: '(náhodný region)', biome: 'místo dopadu',
    minLevel: 85, tier: 5, tool: 'tool_astral_hammer', draws: 4, respawnMs: 0,
    table: { star_ore: 45, crystal_astral: 25, astral_shard: 20, mat_hvezdny_prach: 10 },
    rareFind: { id: 'meteor_core_fragment', chance: 0.15 } }
];

export const ALL_DEPOSITS = [...DEPOSITS, ...SPECIAL_DEPOSITS];
export const DEPOSIT_BY_ID = Object.fromEntries(ALL_DEPOSITS.map((d) => [d.id, d]));

// Krumpáče (vyrábí Kovářství; do jeho dokončení I–III prodává Hornický mistr).
export const PICKAXES = [
  { id: 'pick_basic', name: 'Základní důlní krumpáč', tier: 1, level: 1, smithing: 3, price: 15 },
  { id: 'pick_iron', name: 'Železný krumpáč', tier: 2, level: 16, smithing: 15, price: 80 },
  { id: 'pick_steel', name: 'Ocelový krumpáč', tier: 3, level: 31, smithing: 30, price: 250 },
  { id: 'pick_mithril', name: 'Mithrilový krumpáč', tier: 4, level: 51, smithing: 50 },
  { id: 'pick_adamantite', name: 'Adamantitový krumpáč', tier: 5, level: 71, smithing: 72 },
  { id: 'pick_dragon', name: 'Dračí krumpáč', tier: 6, level: 91, smithing: 92 }
];
export const TIER_LABEL = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

// Doplňkové nástroje: účinkují z inventáře.
export const MINING_TOOLS = [
  { id: 'tool_ore_hammer', name: 'Kladivo na rudu', level: 5, smithing: 10, effect: 'Rudné žíly a sloje: −15 % doba těžby.' },
  { id: 'tool_wedge', name: 'Těžební klín', level: 16, smithing: 20, effect: 'Rudné žíly: +10 % šance na +1 kus.' },
  { id: 'tool_crystal_tongs', name: 'Kleště na krystaly', level: 20, smithing: 25, effect: 'Drahokamy a krystaly: +10 % šance na +1 kus; nutné pro Krystalové geody.' },
  { id: 'tool_chisel', name: 'Průzkumnický majzlík', level: 25, smithing: 35, effect: 'Všechna naleziště: vedlejší nález +5 procentních bodů.' },
  { id: 'tool_support', name: 'Důlní podpěra s kovovým hrotem', level: 20, smithing: 40, price: 40, consumable: true,
    effect: 'Spotřební: otevře Skrytou žílu odhalenou Starodávnou důlní mapou.' },
  { id: 'tool_drill', name: 'Dlouhý důlní vrták', level: 45, smithing: 45, effect: 'Hlubinné doly: +15 % šance na +1 kus, Důlní relikvie ×2.' },
  { id: 'tool_astral_hammer', name: 'Kladivo na astrální kámen', level: 60, smithing: 60, effect: 'Runová ložiska a astrální suroviny: +10 % šance na +1 kus; nutné pro Hvězdné meteority.' },
  { id: 'tool_safety_tongs', name: 'Ochranné důlní kleště', level: 70, smithing: 70, effect: 'Nutné pro Žhavá rudná ložiska.' }
];

// Vzácné nálezy (vlastní hod po každé těžbě).
export const RARE_FINDS = [
  { id: 'ancient_mine_map', name: 'Starodávná důlní mapa', rarity: 'rare', price: 60,
    description: 'Použij: odhalí Skrytou žílu v tomto regionu na 30 min (otevře ji Důlní podpěra).' },
  { id: 'miner_chest', name: 'Zapomenutá truhla horníka', rarity: 'rare', price: 0,
    description: 'Použij: otevře truhlu – rudy podle tvé úrovně Těžby a 20–60 zlata.' },
  { id: 'ancient_rune_fragment', name: 'Prastarý runový úlomek', rarity: 'epic', price: 150,
    description: 'Runová ložiska. Magické recepty Kovářství a Řemeslnictví.' },
  { id: 'uncut_gem', name: 'Neopracovaný drahokam', rarity: 'rare', price: 80,
    description: 'Krystalové geody. Řemeslnictví: brus na drahokam podle volby.' },
  { id: 'meteor_core_fragment', name: 'Zlomek meteoritického jádra', rarity: 'legendary', price: 400,
    description: 'Hvězdné meteority. Legendární recepty.' },
  { id: 'mine_relic', name: 'Důlní relikvie', rarity: 'epic', price: 120,
    description: 'Hlubinné doly. Sběratelská hodnota, později úkoly.' }
];

export const MINING_SPECIALIZATIONS = [
  { id: 'deep', name: 'Hlubinný horník', focus: 'rudy a kovy',
    text: 'Rudy: +25 % šance na +1 kus a vedlejší nález +5 b.; naleziště s krumpáčem III+ o 20 % rychleji; doly +10 % XP. Bez bonusu u drahokamů, krystalů a speciálních nalezišť.' },
  { id: 'gems', name: 'Hledač drahokamů', focus: 'drahokamy a krystaly',
    text: 'Drahokamy a krystaly: +25 % šance na +1 kus; geoda +1 tah; Neopracovaný drahokam a Křišťálové jádro ×1,5; u rudných žil 3 % na drahokam. Bez bonusu u rud a pomocných surovin.' },
  { id: 'explorer', name: 'Průzkumník nalezišť', focus: 'vzácná a speciální naleziště',
    text: 'Vzácné nálezy ×2; speciální naleziště +1 tah a obnova o 25 % kratší; 3 % po těžbě odhalit Skrytou žílu; meteorit vidíš na mapě světa. Bez bonusu k výtěžnosti běžných nalezišť.' }
];

export const xpToNextMiningLevel = (level) => Math.round(20 * level ** 1.5);
