// Předměty podle dokumentu „Crafting a řemesla – návrh“ (sekce Itemy).
// icon = klíč obrázku z public/assets/items/icons (seznam v src/data/itemIcons.json,
// vzniká nástrojem tools/split-icons.ps1).
//
//   category  armor | materials | potions | accessories | keys | other (filtry v inventáři)
//   stack     kolik kusů se vejde do jednoho slotu
//   use       účinek při Použít (restoreMana, healMonster, food)
//   slot      slot výbavy pro Vybavit (weapon, shield, ring, amulet, helmet, armor, legs, boots)
//   effect    zamýšlený účinek výbavy (bonusy statistik zatím systém nepočítá)

import { FISH, WATER_MATERIALS, BAITS, RODS, METAL_PARTS, RARITY } from './fishing.js';
import { NEW_HERBS, STAPLES, MEATS, INTERMEDIATES, RECIPES, outputItemId, describeEffect } from './cooking.js';
import { ALCHEMY_INTERMEDIATES, ALCHEMY_RECIPES, alchemyOutputId, describeAlchemy, alchemyUseContext, GAME_ITEM_RECIPES } from './alchemy.js';
import { SMITHING_INTERMEDIATES, SMITHING_RECIPES, smithingOutputId, describeSmithing } from './smithing.js';
import { MINING_MATERIALS, MINING_RARITY, PICKAXES, MINING_TOOLS, RARE_FINDS, TIER_LABEL } from './mining.js';
import { HERB_CATALOG, HERB_RARITY, HERB_SITES, SICKLES, SICKLE_EFFECTS, HERB_RARE_FINDS, HERB_TIER_LABEL, ITEM_RARITY, BIOMES } from './herbalism.js';
import { CRAFTING_INTERMEDIATES, CRAFTING_RECIPES, ALL_CRAFTING, craftingOutputId, describeCrafting } from './crafting.js';

export const ITEM_CATEGORIES = [
  { id: 'armor', label: 'Zbroj' },
  { id: 'materials', label: 'Materiály' },
  { id: 'potions', label: 'Potiony' },
  { id: 'accessories', label: 'Doplňky' },
  { id: 'keys', label: 'Klíče' },
  { id: 'other', label: 'Ostatní' }
];

const item = (id, name, category, icon, description, extra = {}) => ({
  id, name, category, icon, description, rarity: 'common', stack: 99, ...extra
});

// ----------------------------------------------------------- 1. spotřební
const CONSUMABLES = [
  item('minor_healing_tonic', 'Menší léčivý tonik', 'potions', 'icons01_001',
    'Obnoví malé množství HP (30) nejvíc zraněnému monstru v partě.', { use: { type: 'healMonster', amount: 30 } }),
  item('healing_tonic', 'Léčivý tonik', 'potions', 'icons01_002',
    'Obnoví větší množství HP (80) nejvíc zraněnému monstru v partě.', { use: { type: 'healMonster', amount: 80 }, rarity: 'uncommon' }),
  item('mana_potion', 'Tonik many', 'potions', 'icons01_003',
    'Obnoví část hrdinovy many (15).', { use: { type: 'restoreMana', amount: 15 } }),
  item('strong_mana_tonic', 'Silný tonik many', 'potions', 'icons01_004',
    'Obnoví větší množství many (40).', { use: { type: 'restoreMana', amount: 40 }, rarity: 'uncommon' }),
  item('antidote', 'Protijed', 'potions', 'icons01_005',
    'Odstraní otravu. Použije se v souboji (stavové efekty mimo souboj nepřetrvávají).'),
  item('travel_ration', 'Cestovní jídlo', 'potions', 'icons01_006',
    'Obnoví malé množství zdrojů: 5 many a 15 HP nejvíc zraněnému monstru.', { use: { type: 'food', mana: 5, heal: 15 } })
];

// ------------------------------------------------------ 2. Soul Crystaly
const CRYSTALS = [
  item('basic_crystal', 'Basic Soul Crystal', 'other', 'icons01_030',
    'Základní krystal pro ochočení divokých monster v souboji (akce Ochočení).'),
  item('greater_crystal', 'Greater Soul Crystal', 'other', 'icons01_008',
    'Silnější krystal s vyšší šancí na ochočení.', { rarity: 'uncommon' }),
  item('elemental_crystal', 'Elemental Soul Crystal', 'other', 'icons01_009',
    'Krystal se zvýšenou účinností při ochočení.', { rarity: 'rare' }),
  item('ancient_crystal', 'Ancient Soul Crystal', 'other', 'icons01_010',
    'Vzácný krystal s vyšším násobitelem šance.', { rarity: 'epic' }),
  item('dragon_crystal', 'Dragon Soul Crystal', 'other', 'icons01_012',
    'Nejsilnější krystal. Získání prastarých draků bude mít navíc příběhové podmínky.', { rarity: 'legendary' })
];

// ------------------------------------------------------ 3. vybavení
const GEAR = [
  item('hunting_fang', 'Lovecký tesák', 'armor', 'icons01_013', 'Zbraň: Fyzický útok +2 % všem monstrům v partě (velitelský bonus).', { slot: 'weapon', stack: 1, effect: { physicalAttack: 2 }, gear: { bonus: { attack: 2 } } }),
  item('hunter_headband', 'Kožená čelenka lovce', 'armor', 'icons03_141', 'Přilba: Magický útok +1 % všem monstrům v partě (velitelský bonus).', { slot: 'helmet', stack: 1, effect: { intellect: 1 }, gear: { bonus: { aether: 1 } } }),
  item('reinforced_vest', 'Zesílená lovecká vesta', 'armor', 'icons03_143', 'Zbroj: Obrana +2 % všem monstrům v partě (velitelský bonus).', { slot: 'armor', stack: 1, effect: { defense: 2 }, gear: { bonus: { defense: 2 } } }),
  item('mist_cloak', 'Plášť horské mlhy', 'armor', 'icons03_147', 'Plášť. Přidá Magickou odolnost. (Slot pláště zatím ve hře není.)', { stack: 1, effect: { magicResistance: 2 } }),
  item('courier_boots', 'Boty rychlého posla', 'armor', 'icons03_150', 'Boty: Rychlost +1 % všem monstrům v partě (velitelský bonus).', { slot: 'boots', stack: 1, effect: { speed: 1 }, gear: { bonus: { speed: 1 } } }),
  item('caster_gloves', 'Rukavice přesného sesilatele', 'armor', 'icons03_148', 'Rukavice. Přidají Spell Power. (Slot rukavic zatím ve hře není.)', { stack: 1, effect: { spellPower: 1 } })
];

// ------------------------------------------------------ 4. doplňky
const ACCESSORIES = [
  item('focus_amulet', 'Amulet soustředění', 'accessories', 'icons01_019', 'Přidá Intelekt nebo Spell Power.', { slot: 'amulet', stack: 1, effect: { spellPower: 1 } }),
  item('pilgrim_amulet', 'Amulet poutníka', 'accessories', 'icons01_020', 'Zlepší pohyb po mapě.', { slot: 'amulet', stack: 1, effect: { speed: 1 } }),
  item('dragonstone_amulet', 'Amulet dračího kamene', 'accessories', 'icons01_021', 'Přidá Intelekt a Spell Power; propojí se s dračím systémem.', { slot: 'amulet', stack: 1, rarity: 'rare', effect: { intellect: 1, spellPower: 1 } }),
  item('clear_mind_ring', 'Prsten jasné mysli', 'accessories', 'icons01_022', 'Přidá Intelekt nebo maximální manu.', { slot: 'ring', stack: 1, effect: { maxMana: 5 } }),
  item('focus_ring', 'Prsten soustředění', 'accessories', 'icons01_023', 'Přidá Magický útok.', { slot: 'ring', stack: 1, effect: { magicAttack: 1 } }),
  item('willpower_ring', 'Prsten pevné vůle', 'accessories', 'icons01_026', 'Přidá Magickou odolnost.', { slot: 'ring', stack: 1, effect: { magicResistance: 1 } }),
  item('forest_luck_ring', 'Prsten lesního štěstí', 'accessories', 'icons01_024', 'Mírně zvýší Štěstí, s limitem.', { slot: 'ring', stack: 1, effect: { luck: 1 } }),
  item('negotiator_ring', 'Prsten vyjednavače', 'accessories', 'icons01_025', 'Zlepší obchodní ceny nebo Charisma.', { slot: 'ring', stack: 1, effect: { charisma: 1 } }),
  item('protective_ring', 'Ochranný prsten', 'accessories', 'icons03_153', 'Přidá Magickou odolnost.', { slot: 'ring', stack: 1, effect: { magicResistance: 1 } })
];

// ------------------------------------------------------ 5. klíčové předměty
const KEY_ITEMS = [
  item('hunting_permit', 'Lovecké povolení Greenvale', 'keys', 'icons01_027', 'Potvrzuje splnění lovecké zkoušky a povoluje odchod do Verdant Forest.', { stack: 1, rarity: 'rare' }),
  item('cave_gate_key', 'Starý klíč od jeskynní brány', 'keys', 'icons01_028', 'Otevře zamčenou část jeskyně nebo dungeonu.', { stack: 1 }),
  item('ruin_warden_key', 'Klíč strážce ruin', 'keys', 'icons01_029', 'Otevře konkrétní chrám nebo podzemní lokaci.', { stack: 1, rarity: 'rare' }),
  item('magic_stone', 'Magický kámen', 'keys', 'icons01_032', 'Příběhový předmět spojený s dračími silami.', { stack: 1, rarity: 'epic' }),
  item('dragon_seal', 'Dračí pečeť', 'keys', 'icons01_031', 'Otevře příběhovou bránu nebo přístup k dračímu místu.', { stack: 1, rarity: 'legendary' }),
  item('teleport_crystal', 'Krystal pro teleportaci', 'keys', 'icons01_039', 'Aktivuje či opravuje magický kámen pro budoucí rychlé cestování.', { rarity: 'rare' })
];

// ------------------------------------------------------ 6. suroviny
const RAW = [
  ['healing_herbs', 'Léčivé byliny', 'icons01_033', 'Sběr bylin, obchody. Léčivé toniky a vaření.'],
  ['cleansing_herbs', 'Čistící byliny', 'icons01_034', 'Sběr v lesích a vlhkých oblastech. Protijed a alchymie.'],
  ['blue_herbs', 'Modré byliny', 'icons01_035', 'Vodní či stinné oblasti. Lektvary many.'],
  ['forest_mushrooms', 'Lesní houby', 'icons01_036', 'Lesy a jeskyně. Vaření a alchymie.'],
  ['iron_ore', 'Železná ruda', 'icons01_037', 'Těžba v dolech. Kovářství a kovové vybavení.'],
  ['copper_ore', 'Měděná ruda', 'icons01_038', 'Těžba v nalezištích. Prsteny, úchyty a nástroje.'],
  ['astral_shard', 'Astrální střep', 'icons05_162', 'Vzácné oblasti a poklady. Magické doplňky a předměty.'],
  ['wood', 'Dřevo', 'icons01_040', 'Sběr na určených místech. Nástroje a nekovové výrobky.'],
  ['leather', 'Kůže', 'icons01_041', 'Lov, obchod, úkoly. Vesty, boty a další výbava.'],
  ['fiber', 'Vlákno', 'icons01_042', 'Rostliny, obchod. Oblečení a řemeslné výrobky.'],
  ['fish', 'Ryby', 'icons01_043', 'Rybolov. Vaření, úkoly a případně obchod.'],
  ['clean_water', 'Čistá voda', 'icons01_044', 'Prameny, studny, obchod. Alchymie a vaření.'],
  ['leather_strap', 'Kožený řemínek', 'icons01_045', 'Řemeslnictví, obchod. Zbraně a kovové vybavení.'],
  ['iron_clasp', 'Železný uzávěr', 'icons01_046', 'Kovářství. Zesílená výstroj a vybavení.'],
  ['wax', 'Vosk', 'icons01_047', 'Sběr nebo obchod. Voděodolné vybavení a řemesla.']
].map(([id, name, icon, description]) => item(id, name, 'materials', icon, description));

// ------------------------------------------- 7. dropy monster (materiály)
// Po boji hrdina nezíská peníze, ale materiály poražených monster. † = legendární.
export const MONSTER_DROPS = {
  fire: {
    'Ashen Kestrel': ['Žhavé pírko', 'Popelavý letkový hrot'],
    'Balor': ['Démonická kůže', 'Pekelný žárový kámen'],
    'Cerberus': ['Pekelný tesák', 'Trojitá psí kůže'],
    'Chimera': ['Chimérický roh', 'Směsná šupina'],
    'Cinderback Salamander': ['Žhavá šupina', 'Salamandří žárová žláza'],
    'Demon Warrior': ['Démonická kůže', 'Pekelné železo'],
    'Emberhorn Ram': ['Žhavý roh', 'Beraní kůže'],
    'Fire Elemental': ['Plamenná esence', 'Uhlík živého plamene'],
    'Hellhound': ['Pekelná kůže', 'Žárový tesák'],
    'Ignaroth': ['Šupina Ignarotha', 'Prvotní dračí plamen'],
    'Orc Warrior': ['Orčí železný úlomek', 'Bojovníkův kožený řemen'],
    'Phoenix': ['Fénixovo pírko', 'Znovuzrozený popel'],
    'Pit Fiend': ['Pekelné železo', 'Jádro propasti'],
    'Sootveil Moth': ['Popelavé křídlo', 'Sazový prášek'],
    'Wyvern': ['Wyverní šupina', 'Jedovatý osten']
  },
  water: {
    'Brineglass Jelly': ['Solný gel', 'Průsvitná medúzová blána'],
    'Coral Guardian': ['Živý korál', 'Přílivové jádro'],
    'Drowned Bellkeeper': ['Zatopený bronz', 'Hlubinná esence'],
    'Frostmourn': ['Šupina Frostmournu', 'Srdce věčného ledu'],
    'Hydra': ['Hydří šupina', 'Vícehlavá jedová žláza'],
    'Ice Golem': ['Ledové jádro', 'Krystal námrazy'],
    'Kraken': ['Přísavka krakena', 'Hlubinné chapadlové vlákno'],
    'Leviathan Spawn': ['Šupina Leviathana', 'Propastná perla'],
    'Merfolk Warrior': ['Mořská šupina', 'Korálová zbraňová ozdoba'],
    'Pearlback Tortoise': ['Perleťový úlomek krunýře', 'Přílivový kámen'],
    'Sea Serpent': ['Mořská šupina', 'Hadí tesák'],
    'Siltjaw Eel': ['Bahenní úhoří kůže', 'Výbojová žláza'],
    'Siren': ['Sirénin hlasový krystal', 'Mořská perla'],
    'Water Elemental': ['Vodní jádro', 'Vodní esence'],
    'Water Nymph': ['Vodní květ', 'Vodní esence']
  },
  earth: {
    'Behemoth': ['Obří kost', 'Těžké kamenné jádro'],
    'Cave Bear': ['Medvědí kůže', 'Jeskynní dráp'],
    'Cave Worm': ['Jeskynní chitin', 'Podzemní sliz'],
    'Cyclops': ['Kyklopí oko', 'Obrská kost'],
    'Earth Elemental': ['Zemní jádro', 'Kamenná esence'],
    'Forest Troll': ['Trollí kůže', 'Lesní kost'],
    'Gargoyle': ['Chrličový kámen', 'Stínový prach'],
    'Goblin': ['Gobliní zub', 'Zcizená kovová součástka'],
    'Hobgoblin': ['Orčí kovový žeton', 'Gobliní železný úlomek'],
    'Iron Guardian': ['Strážcovo železo', 'Runa ze starého jádra'],
    'Minotaur': ['Minotauří roh', 'Drsná obrská kůže'],
    'Mountain Troll': ['Horská trollí kůže', 'Žulová kost'],
    'Ogre': ['Ogrská kůže', 'Těžká kost'],
    'Rock Elemental': ['Skalní jádro', 'Kamenný střep'],
    'Stone Golem': ['Kamenné jádro', 'Rytý runový kámen'],
    'Troll': ['Trollí kůže', 'Trollí kost'],
    'Wild Boar': ['Kančí kel', 'Divoká kůže'],
    // Jeskynní sliz (boss úkolu) – v dokumentu chybí, materiály podle jeskynních monster.
    'Jeskynní sliz': ['Podzemní sliz', 'Kamenné jádro']
  },
  air: {
    'Air Elemental': ['Vzdušná esence', 'Větrný krystal'],
    'Cloudmantle Owl': ['Obláčkové pírko', 'Soví sklovité oko'],
    'Djinn': ['Bouřková esence', 'Větrný krystal'],
    'Galecrest Lynx': ['Větrná kožešina', 'Rysí dráp'],
    'Griffin': ['Gryfoní pírko', 'Dravčí spár'],
    'Harpy': ['Harpyjní pírko', 'Hlasový krystal'],
    'Hippogriff': ['Hippogryfí pírko', 'Tvrdé kopyto'],
    'Roc': ['Rocaří pero', 'Obří dráp'],
    'Skyribbon Serpent': ['Nebeská šupina', 'Vzdušné hedvábí'],
    'Stormneedle Manta': ['Bouřková ploutev', 'Bouřková esence'],
    'Thunderkite': ['Bouřkové pírko', 'Blesková žláza'],
    'Whistlewing Bat': ['Zvuková blána', 'Kožnaté křídlo'],
    'Windscar Stalker': ['Větrná kožešina', 'Dráp větrného lovce'],
    'Zephyr Hound': ['Zephyrová kožešina', 'Větrný dráp']
  },
  verdant: {
    'Barkplate Pangolin': ['Kůrová šupina', 'Živé dřevo'],
    'Basilisk': ['Baziliščí šupina', 'Baziliščí žláza'],
    'Briarbound Wisp': ['Trnité vlákno', 'Verdantská esence'],
    'Cockatrice': ['Hřebenaté pírko', 'Kamenící žláza'],
    'Dire Wolf': ['Direwolfí kožešina', 'Vlčí tesák'],
    'Dryad': ['Suchadří míza', 'Živé dřevo'],
    'Forest Sprite': ['Vílový prach', 'Svítící list'],
    'Giant Spider': ['Pavoučí hedvábí', 'Jedový váček'],
    'Manticore': ['Manticorův osten', 'Jedový váček'],
    'Mossveil Lynx': ['Mechem pokrytá kožešina', 'Lesní dráp'],
    'Pollen Oracle': ['Věštecký pyl', 'Prastaré semeno'],
    'Sporeback Toad': ['Výtrusný váček', 'Ropuchová kůže'],
    'Thornroot Stag': ['Trnitý paroh', 'Kořenové vlákno'],
    'Treant': ['Staré živé dřevo', 'Prastará míza']
  },
  dark: {
    'Death Knight': ['Prokletý úlomek zbroje', 'Hřbitovní železo'],
    'Ghost': ['Ektoplazma', 'Duchovní vlákno'],
    'Gloamweaver': ['Šerohedvábí', 'Stínová esence'],
    'Hollow Lantern': ['Strašidelné sklo', 'Duchovní plamen'],
    'Imp': ['Démonická blána', 'Impí křídlo'],
    'Incubus': ['Snový prach', 'Stínové hedvábí'],
    'Lich': ['Lichova kost', 'Prach z úvazku duše'],
    'Nightglass Stalker': ['Noční skleněný střep', 'Kůže lovce noci'],
    'Nythrakar': ['Šupina Nythrakara', 'Srdce Abyssu'],
    'Orc Shaman': ['Šamanský totem', 'Duchovní esence'],
    'Skeleton': ['Hřbitovní kost', 'Staré hřbitovní železo'],
    'Succubus': ['Snová esence', 'Démonická blána'],
    'Vampire': ['Zapečetěná krev', 'Noční esence'],
    'Wraith': ['Ektoplazma', 'Přízračné vlákno'],
    'Zombie': ['Hřbitovní kost', 'Rozkladný sliz']
  },
  light: {
    'Arcane Wisp': ['Arkánní prach', 'Zářivá esence'],
    'Aurelion': ['Šupina Aureliona', 'Srdce hvězdného světla'],
    'Comet-Tail Fox': ['Kometoocasá kožešina', 'Hvězdný prach'],
    'Crystal Golem': ['Křišťálový střep', 'Křišťálové jádro'],
    'Crystal Spider': ['Křišťálové hedvábí', 'Krystalický střep pavouka'],
    'Dawncoil Serpent': ['Šupina úsvitu', 'Jitřní esence'],
    'Moon Stag': ['Měsíční paroh', 'Měsíční esence'],
    'Pegasus': ['Nebeské pírko', 'Pegasí žíně'],
    'Prism Herald': ['Hranolový střep', 'Světelná esence'],
    'Sphinx': ['Sluneční prach', 'Rytý úlomek hádanky'],
    'Star Seraph': ['Hvězdné pírko', 'Astrální esence'],
    'Starwake Moth': ['Hvězdný prach', 'Svítící křídlo'],
    'Sunshard Beetle': ['Sluneční krunýř', 'Zlatý prach'],
    'Unicorn': ['Jednorožčí roh', 'Čistá esence']
  }
};
const LEGENDARY = new Set(['Ignaroth', 'Frostmourn', 'Nythrakar', 'Aurelion']);

// Ikony materiálů: list icons05 je seřazený po elementech (2 řádky po 16 ikonách,
// verdant/dark/light po jednom). Každá ikona má druh, materiál dostane volnou ikonu
// svého elementu podle druhu odvozeného z názvu (pírko, kůže, tesák, šupina, esence…).
const ICON_KINDS = {
  fire: ['feather', 'feather', 'scale', 'spike', 'organ', 'hide', 'stone', 'horn', 'crystal', 'orb', 'flame', 'fang', 'hide', 'stone', 'stone', 'orb',
    'claw', 'horn', 'stone', 'metal', 'crystal', 'orb', 'powder', 'stone', 'feather', 'feather', 'powder', 'feather', 'powder', 'stone', 'wing', 'wing'],
  water: ['essence', 'slime', 'membrane', 'membrane', 'coral', 'coral', 'shell', 'pearl', 'pearl', 'crystal', 'orb', 'ice', 'crystal', 'ice', 'ice', 'organ',
    'scale', 'crystal', 'fiber', 'fin', 'tentacle', 'tentacle', 'stone', 'fin', 'plant', 'fin', 'scale', 'scale', 'fang', 'hide', 'essence', 'essence'],
  earth: ['stone', 'stone', 'crystal', 'crystal', 'stone', 'stone', 'stone', 'stone', 'bone', 'bone', 'rune', 'rune', 'stone', 'stone', 'stone', 'stone',
    'hide', 'hide', 'claw', 'fang', 'horn', 'stone', 'metal', 'metal', 'stone', 'orb', 'stone', 'rune', 'crystal', 'stone', 'bone', 'stone'],
  air: ['essence', 'feather', 'feather', 'organ', 'essence', 'orb', 'crystal', 'essence', 'hide', 'claw', 'wing', 'feather', 'feather', 'claw', 'claw', 'scale',
    'feather', 'essence', 'essence', 'wing', 'wing', 'wing', 'hide', 'hide', 'claw', 'feather', 'hide', 'hide', 'plant', 'plant', 'plant', 'wood'],
  verdant: ['plant', 'plant', 'powder', 'seed', 'fiber', 'wood', 'sap', 'wood', 'slime', 'plant', 'plant', 'organ', 'organ', 'organ', 'fiber', 'fiber'],
  dark: ['flame', 'essence', 'flame', 'bone', 'bone', 'bone', 'stone', 'metal', 'crystal', 'crystal', 'feather', 'wing', 'organ', 'blood', 'orb', 'crystal'],
  light: ['orb', 'crystal', 'powder', 'essence', 'feather', 'hide', 'crystal', 'crystal', 'crystal', 'essence', 'horn', 'plant', 'plant', 'shell', 'seed', 'orb']
};
// Začátek řady elementu v icons05 (číslo ikony).
const ICON_START = { fire: 1, water: 33, earth: 65, air: 97, verdant: 129, dark: 145, light: 161 };
// Verdant má navíc mech a kůru z konce vzdušných řad.
const EXTRA_POOL = { verdant: [[123, 'plant'], [124, 'plant'], [125, 'plant'], [126, 'plant'], [127, 'plant'], [128, 'wood']] };

const KIND_WORDS = [
  // Nejdřív slova, která by jinak spolkla kratší (šeROHedvábí, bouřKOVá).
  ['fiber', ['hedvab', 'vlakn', 'remen']], ['fin', ['ploutev']],
  ['feather', ['pirko', 'pero']], ['membrane', ['medusova blana']], ['wing', ['kridlo', 'blana']],
  ['hide', ['kuze', 'kozesin', 'zine']], ['fang', ['tesak', 'zub', 'kel']], ['claw', ['drap', 'spar']],
  ['horn', ['roh', 'paroh', 'kopyto']], ['scale', ['supin']], ['shell', ['krunyr', 'chitin']],
  ['essence', ['esence', 'ektoplazm']], ['orb', ['jadro']], ['organ', ['srdce', 'zlaz', 'vacek', 'oko', 'prisavk']],
  ['bone', ['kost']], ['powder', ['prach', 'popel', 'pyl', 'prasek']], ['crystal', ['krystal', 'stres', 'sklo', 'sklen', 'perla', 'perlet']],
  ['rune', ['runa', 'runov', 'hadank']], ['stone', ['kamen', 'kamenn']], ['metal', ['zelez', 'bronz', 'kov', 'soucast', 'zeton', 'zbroj', 'ozdoba']],
  ['slime', ['sliz', 'gel']], ['fiber', ['hedvab', 'vlakn', 'remen']], ['wood', ['drevo', 'kur', 'totem']], ['sap', ['miza']],
  ['seed', ['semen']], ['plant', ['list', 'kvet', 'koral']], ['flame', ['plamen', 'uhlik']], ['spike', ['osten', 'hrot']],
  ['blood', ['krev']], ['fin', ['ploutev']], ['tentacle', ['chapadl']], ['ice', ['led', 'namraz']]
];
const KIND_FALLBACK = {
  membrane: ['wing', 'slime'], shell: ['scale'], organ: ['orb'], spike: ['fang', 'claw'], blood: ['organ'], sap: ['essence', 'slime'],
  slime: ['essence'], fiber: ['plant'], seed: ['plant'], metal: ['stone'], rune: ['stone'], fin: ['wing', 'scale'], tentacle: ['hide'],
  ice: ['crystal'], coral: ['plant'], flame: ['orb', 'essence'], wood: ['plant'], powder: ['crystal'], pearl: ['crystal'], essence: ['orb'],
  orb: ['essence', 'crystal'], horn: ['fang', 'bone'], bone: ['fang'], plant: ['seed'], hide: ['fiber'], wing: ['feather'], scale: ['shell']
};

// icons02: čísla ikon podle druhu (list není řazený po elementech).
const SHARED_ICONS = {
  hide: [3, 6, 11, 53, 72, 73, 75, 77, 82, 85, 91, 107, 109, 121],
  fang: [5, 12, 54, 65, 84, 92, 108, 110, 122],
  claw: [94, 98],
  organ: [57, 89],
  bone: [51, 58, 62, 74, 78, 83],
  horn: [7, 71],
  feather: [16, 88, 93, 95, 97, 103],
  wing: [101, 105, 106],
  scale: [8, 9, 13, 99, 111, 113, 115]
};

const plain = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (text) => plain(text).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const kindOf = (name) => KIND_WORDS.find(([, words]) => words.some((w) => plain(name).includes(w)))?.[0] ?? 'stone';
const iconKey = (n) => `icons05_${String(n).padStart(3, '0')}`;

function buildMaterials() {
  const pools = {};
  for (const [element, kinds] of Object.entries(ICON_KINDS)) {
    pools[element] = kinds.map((kind, i) => [ICON_START[element] + i, kind]).concat(EXTRA_POOL[element] ?? [])
      .map(([n, kind]) => [iconKey(n), kind]);
  }
  // Sdílená zásoba z icons02 (kožešiny, tesáky, drápy, kosti, pera, šupiny) pro elementy bez vlastní ikony.
  pools.shared = Object.entries(SHARED_ICONS).flatMap(([kind, list]) => list.map((n) => [`icons02_${String(n).padStart(3, '0')}`, kind]));

  // 1) Seznam materiálů (jedinečné názvy) a dropy podle druhu monstra.
  const materials = {};
  const drops = {};
  const entries = [];
  for (const [element, monsters] of Object.entries(MONSTER_DROPS)) {
    for (const [monster, names] of Object.entries(monsters)) {
      drops[slug(monster)] = names.map((name, index) => {
        const id = `mat_${slug(name)}`;
        if (!materials[id]) {
          materials[id] = item(id, name, 'materials', null, `Materiál z monster (${monster}). Použije se při výrobě.`, {
            rarity: LEGENDARY.has(monster) ? 'legendary' : index === 0 ? 'common' : 'uncommon',
            element
          });
          entries.push({ id, element, kind: kindOf(name) });
        }
        return id;
      });
    }
  }

  // 2) Ikony ve více kolech: přesný druh ve vlastním elementu → přesný druh jinde →
  //    náhradní druh u sebe → jinde → cokoli volného u sebe → sdílená ikona.
  const used = new Set();
  const others = (element) => ['shared', ...Object.keys(ICON_KINDS).filter((e) => e !== element)];
  const free = (els, kinds) => {
    for (const k of kinds) {
      for (const e of els) {
        const hit = pools[e].find(([n, pk]) => pk === k && !used.has(n));
        if (hit) return hit[0];
      }
    }
    return null;
  };
  const passes = [
    (m) => free([m.element], [m.kind]),
    (m) => free(others(m.element), [m.kind]),
    (m) => free([m.element], KIND_FALLBACK[m.kind] ?? []),
    (m) => free(others(m.element), KIND_FALLBACK[m.kind] ?? []),
    (m) => pools[m.element].find(([n]) => !used.has(n))?.[0] ?? null,
    (m) => (pools[m.element].find(([, pk]) => pk === m.kind) ?? pools[m.element][0])[0]
  ];
  // iconFit: jak ikona sedí – exact (správný druh), fallback (podobný druh), any (náhradní), shared (sdílená).
  const FIT = ['exact', 'exact', 'fallback', 'fallback', 'any', 'shared'];
  passes.forEach((pass, passIndex) => {
    for (const m of entries) {
      if (materials[m.id].icon) continue;
      const n = pass(m);
      if (n == null) continue;
      used.add(n);
      materials[m.id].icon = n;
      materials[m.id].iconFit = FIT[passIndex];
      materials[m.id].iconKind = m.kind;
    }
  });
  return { materials, drops };
}

const { materials: MATERIALS, drops: DROPS_BY_SPECIES } = buildMaterials();

// Dropy podle druhu monstra (klíč = id druhu, např. dire_wolf; boss Jeskynní sliz = jeskynni_sliz).
export const SPECIES_DROPS = { ...DROPS_BY_SPECIES, cave_slime: DROPS_BY_SPECIES.jeskynni_sliz };

// ------------------------------------------------------ 8. rybolov (src/data/fishing.js)
// Ikony ryb, návnad a náčiní jsou zatím společné (viz dokument Chybějící ikony předmětů).
const FISHING_ITEMS = [
  ...FISH.map((f) => item(f.id, f.name, 'materials', f.icon,
    `Ryba (${RARITY[f.rarity].label.toLowerCase()}). Voda: ${f.water}. Rybolov od úrovně ${f.minLevel}. Vaření a obchod.`,
    { rarity: f.rarity, price: f.price, fishing: true })),
  ...WATER_MATERIALS.filter((m) => !MATERIALS[m.id]).map((m) => item(m.id, m.name, 'materials', m.icon,
    `Vodní surovina z rybolovu (${m.water}${m.minLevel > 1 ? `, Rybolov ${m.minLevel}+` : ''}). ${m.uses}.`, { rarity: m.rarity, price: m.price, fishing: true })),
  ...BAITS.map((b) => item(b.id, b.name, 'other', 'icons01_036', `Návnada na ryby. ${b.effect}`, { bait: true })),
  ...RODS.map((r) => item(r.id, r.name, 'other', 'icons01_040', `Rybářský prut. ${r.description}`, { stack: 1, rod: true })),
  ...METAL_PARTS.map((m) => item(m.id, m.name, 'other', 'icons01_046', m.description, { stack: 1, fishingMetal: true }))
];
// ------------------------------------------------------ 9. vaření (src/data/cooking.js)
// Ikony jsou zatím společné (viz dokument Chybějící ikony předmětů).
const COOKING_ITEMS = [
  // Vodní květ a Svítící list už existují jako drop monster (Water Nymph, Forest Sprite) – stejný předmět.
  ...NEW_HERBS.filter(([id]) => !MATERIALS[id]).map(([id, name]) => item(id, name, 'materials', 'icons01_033', 'Bylina (Sběr bylin). Vaření, alchymie a návnady.')),
  ...STAPLES.map((s) => item(s.id, s.name, 'materials', 'icons01_044', s.description, { price: s.price })),
  ...MEATS.map((m) => item(m.id, m.name, 'materials', 'icons01_041', 'Maso z monster. Vaření.', { rarity: m.rarity })),
  ...INTERMEDIATES.map((r) => item(outputItemId(r), r.name, 'materials', 'icons01_047', 'Kuchyňský mezivýrobek pro další recepty.')),
  ...RECIPES.filter((r) => outputItemId(r) !== 'travel_ration').map((r) => item(outputItemId(r), r.name, 'potions', 'icons01_006',
    `Pokrm (Vaření ${r.level}). ${describeEffect(r.effect)} Jí se mimo souboj.`,
    { use: { type: 'meal', recipe: r.id }, rarity: r.level >= 91 ? 'legendary' : r.level >= 71 ? 'epic' : r.level >= 51 ? 'rare' : r.level >= 31 ? 'uncommon' : 'common' }))
];

// ------------------------------------------------------ 10. alchymie (src/data/alchemy.js)
// Ikony zatím společné (viz dokument Chybějící ikony předmětů).
const ALCHEMY_ICONS = { A: 'icons01_001', B: 'icons01_005', C: 'icons01_004', D: 'icons01_047', E: 'icons01_003' };
const USE_NOTE = { any: 'Jde použít mimo souboj i v souboji (akce Předmět).', battle: 'Použije se v souboji (akce Předmět).', world: 'Použije se mimo souboj.', none: '' };
const ALCHEMY_ITEMS = [
  ...ALCHEMY_INTERMEDIATES.map((r) => item(alchemyOutputId(r), r.name, 'materials', 'icons01_047', 'Alchymistický mezivýrobek pro další recepty.')),
  ...ALCHEMY_RECIPES.filter((r) => !GAME_ITEM_RECIPES.includes(r.id)).map((r) => {
    const context = alchemyUseContext(r.effect);
    const catalyst = Boolean(r.effect?.catalyst);
    return item(alchemyOutputId(r), r.name, catalyst ? 'materials' : 'potions', ALCHEMY_ICONS[r.category],
      `Alchymie ${r.level}. ${describeAlchemy(r.effect)} ${USE_NOTE[context]}`.trim(),
      { use: context === 'none' || context === 'battle' ? undefined : { type: 'alchemy', recipe: r.id },
        battleUse: context === 'any' || context === 'battle' ? r.id : undefined,
        rarity: r.level >= 91 ? 'legendary' : r.level >= 71 ? 'epic' : r.level >= 51 ? 'rare' : r.level >= 31 ? 'uncommon' : 'common' });
  })
];
// Toniky a protijed (už ve hře) jdou nově použít i v souboji.
for (const id of GAME_ITEM_RECIPES) {
  const recipe = ALCHEMY_RECIPES.find((r) => r.id === id);
  const target = [...CONSUMABLES].find((it) => it.id === alchemyOutputId(recipe));
  if (target) target.battleUse = id;
}

// Mořská perla už existuje jako materiál z monster (Siren) – z rybolovu dostane cenu.
for (const m of WATER_MATERIALS) if (MATERIALS[m.id]) Object.assign(MATERIALS[m.id], { price: m.price, fishing: true });

// ------------------------------------------------------ 11. těžba (src/data/mining.js)
// Ikony zatím společné (viz dokument Chybějící ikony předmětů).
const miningDescription = (m) =>
  `${MINING_RARITY[m.rarity].label} surovina z Těžby (úroveň ${m.level}, krumpáč ${TIER_LABEL[m.tier]}). ${m.area}. ${m.uses}`;
const MINING_ITEMS = [
  ...MINING_MATERIALS.map((m) => item(m.id, m.name, 'materials', m.icon, miningDescription(m), { rarity: m.rarity, price: m.price, mining: true })),
  ...PICKAXES.map((p) => item(p.id, p.name, 'other', 'icons01_046',
    `Krumpáč stupně ${TIER_LABEL[p.tier]} (Těžba ${p.level}+). Stačí ho mít v inventáři. Vyrábí Kovářství (úroveň ${p.smithing}).`,
    { stack: 1, pickaxe: p.tier, rarity: ['common', 'common', 'uncommon', 'rare', 'epic', 'legendary'][p.tier - 1] })),
  ...MINING_TOOLS.map((t) => item(t.id, t.name, 'other', 'icons01_046',
    `Těžební nástroj (Těžba ${t.level}+). ${t.effect} Vyrábí Kovářství (úroveň ${t.smithing}).`,
    { stack: t.consumable ? 99 : 1, miningTool: true, rarity: t.level >= 60 ? 'epic' : t.level >= 40 ? 'rare' : 'uncommon' })),
  ...RARE_FINDS.map((f) => item(f.id, f.name, f.id === 'ancient_mine_map' || f.id === 'miner_chest' ? 'other' : 'materials',
    f.id === 'ancient_mine_map' ? 'icons01_042' : f.id === 'miner_chest' ? 'icons01_031' : 'icons01_039', f.description,
    { rarity: f.rarity, price: f.price || undefined, mining: Boolean(f.price),
      use: f.id === 'ancient_mine_map' ? { type: 'miningMap' } : f.id === 'miner_chest' ? { type: 'minerChest' } : undefined }))
];

// Suroviny, které už ve hře jsou (rudy, Astrální střep, Sůl, dropy monster) – jeden předmět, nový zdroj.
const EXISTING_BEFORE_MINING = Object.fromEntries(
  [...RAW, ...Object.values(MATERIALS), ...COOKING_ITEMS].map((it) => [it.id, it])
);
for (const m of MINING_MATERIALS) {
  const existing = EXISTING_BEFORE_MINING[m.id];
  if (!existing) continue;
  // Cena nesmí být vyšší než nákup u obchodníka (Sůl), jinak by šlo kupovat a prodávat se ziskem.
  Object.assign(existing, { mining: true, price: Math.min(existing.price ?? Infinity, m.price), description: `${existing.description} Těžba: ${m.area}.` });
}

// ------------------------------------------------------ 12. kovářství (src/data/smithing.js)
// Ikony zatím společné (viz dokument Chybějící ikony předmětů). Nástroje z Těžby a Rybolovu
// jsou stejné předměty – recept jim jen přidá výrobu.
const SMITH_ICONS = { weapon: 'icons01_013', shield: 'icons03_143', helmet: 'icons03_141', armor: 'icons03_143', legs: 'icons03_143', boots: 'icons03_150' };
const levelRarity = (level) => (level >= 91 ? 'legendary' : level >= 71 ? 'epic' : level >= 51 ? 'rare' : level >= 31 ? 'uncommon' : 'common');
const SMITHING_ITEMS = [
  ...SMITHING_INTERMEDIATES.filter((r) => r.id !== 'iron_clasp').map((r) => item(r.id, r.name, 'materials', 'icons01_046',
    `Kovářský mezivýrobek (Kovářství ${r.level}). Tavení a díly pro další recepty.`, { smithing: true })),
  ...SMITHING_RECIPES.filter((r) => !r.output).map((r) => {
    const e = r.effect;
    if (e.reinforce) {
      return item(smithingOutputId(r), r.name, 'other', 'icons01_046', `Kovářství ${r.level}. ${describeSmithing(e)} Použije se mimo souboj.`,
        { use: { type: 'reinforce', recipe: r.id }, rarity: levelRarity(r.level), smithing: true });
    }
    return item(smithingOutputId(r), r.name, 'armor', SMITH_ICONS[e.slot], `Kovářství ${r.level}. ${describeSmithing(e)}`,
      { slot: e.slot, stack: 1, gear: { bonus: { ...e.bonus }, resist: { ...(e.resist ?? {}) }, elementDamage: { ...(e.elementDamage ?? {}) } },
        smithed: true, smithing: true, rarity: levelRarity(r.level) });
  }),
];

// ------------------------------------------------------ 15. řemeslnictví (src/data/crafting.js)
// Nové výrobky (cr_…) a mezivýrobky; recepty s `output` vyrábějí existující předměty (amulety,
// prsteny, Soul Crystaly) – těm se níž doplní účinek. Výbava působí jako výbava z Kovářství.
const craftRarity = (level) => (level >= 91 ? 'legendary' : level >= 71 ? 'epic' : level >= 51 ? 'rare' : level >= 31 ? 'uncommon' : 'common');
const CRAFT_SLOT_CATEGORY = { amulet: 'accessories', ring: 'accessories', shield: 'accessories', helmet: 'armor', armor: 'armor', legs: 'armor', boots: 'armor' };
const craftExtra = (r) => {
  const e = r.effect;
  if (e?.slot) return { slot: e.slot, stack: 1, gear: { bonus: { ...e.bonus }, resist: { ...(e.resist ?? {}) }, elementDamage: { ...(e.elementDamage ?? {}) } }, crafted: true };
  if (e?.bag || e?.travel || e?.use) return { use: { type: 'craft', recipe: r.id }, stack: e.bag ? 1 : 20 };
  if (e?.tool) return { stack: 1 };
  return {};
};
const CRAFTING_ITEMS = [
  ...CRAFTING_INTERMEDIATES.filter((r) => !r.output).map((r) => item(r.id, r.name, 'materials', 'icons01_047', `Mezivýrobek Řemeslnictví (úroveň ${r.level}).`, { crafting: true })),
  ...CRAFTING_RECIPES.filter((r) => !r.output).map((r) => item(craftingOutputId(r), r.name,
    r.effect?.slot ? CRAFT_SLOT_CATEGORY[r.effect.slot] : 'other',
    r.effect?.bag ? 'icons01_040' : r.effect?.slot ? 'icons01_019' : 'icons01_046',
    `Řemeslnictví ${r.level}. ${describeCrafting(r.effect)}`,
    { rarity: craftRarity(r.level), crafting: true, craftIcon: Boolean(r.effect?.slot), ...craftExtra(r) }))
];

// ------------------------------------------------------ 14. sběr bylin (src/data/herbalism.js)
// Srpy (vyrábí Kovářství) a vzácné nálezy. Samotných 16 rostlin už existuje – níž jim přibude
// vzácnost, cena a popis výskytu.
const HERBALISM_ITEMS = [
  ...SICKLES.map((s) => item(s.id, s.name, 'other', 'icons01_046',
    `Srp pro Sběr bylin (stupeň ${HERB_TIER_LABEL[s.tier]}, Sběr bylin ${s.level}+). ${SICKLE_EFFECTS[s.id]} Vyrábí Kovářství (úroveň ${s.smithing}).`,
    { stack: 1, herbTool: true, rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary'][s.tier - 1], price: s.price })),
  ...HERB_RARE_FINDS.map((f) => item(f.id, f.name, f.id === 'herb_botanical_note' ? 'other' : 'materials', 'icons01_033', f.description,
    { rarity: f.rarity, price: f.price, herbal: true, use: f.id === 'herb_botanical_note' ? { type: 'botanicalNote' } : undefined }))
];

export const ITEMS = Object.fromEntries(
  [...CONSUMABLES, ...CRYSTALS, ...GEAR, ...ACCESSORIES, ...KEY_ITEMS, ...RAW, ...Object.values(MATERIALS), ...FISHING_ITEMS, ...COOKING_ITEMS, ...ALCHEMY_ITEMS,
    ...MINING_ITEMS.filter((it) => !EXISTING_BEFORE_MINING[it.id]), ...SMITHING_ITEMS, ...HERBALISM_ITEMS, ...CRAFTING_ITEMS].map((it) => [it.id, it])
);

// Existující předměty, které vyrábí Řemeslnictví (amulety, prsteny, Soul Crystaly): účinek a popis receptu.
for (const r of CRAFTING_RECIPES.filter((x) => x.output)) {
  const target = ITEMS[r.output];
  if (!target) continue;
  // replaceDescription: původní předmět (dokument Itemy) přebírá účinek receptu celý (F01–F05).
  const description = r.replaceDescription ? `Řemeslnictví ${r.level}. ${describeCrafting(r.effect)}` : `${target.description} Řemeslnictví ${r.level}: ${describeCrafting(r.effect)}`;
  Object.assign(target, { crafting: true, description });
  if (r.effect?.slot) Object.assign(target, craftExtra(r));
}

// 16 rostlin Sběru bylin: vzácnost, výkupní cena a popis výskytu podle herbalism.js.
for (const herb of HERB_CATALOG) {
  const target = ITEMS[herb.id];
  if (!target) continue;
  const regions = [...new Set(HERB_SITES.filter((s) => s.main === herb.id).map((s) => s.region))];
  Object.assign(target, {
    rarity: ITEM_RARITY[herb.rarity],
    price: herb.price,
    herbal: true,
    description: `${HERB_RARITY[herb.rarity].label} rostlina – Sběr bylin ${herb.level}+, srp ${HERB_TIER_LABEL[herb.tier]}. ${herb.look} ` +
      `Roste: ${BIOMES[herb.biome]}${regions.length ? ` (${regions.join(', ')})` : ' (speciální naleziště)'}. Alchymie a Vaření.`
  });
}

// ------------------------------------------------------ 13. vlastní ikony z nových listů
// icons07 = alchymistické mezivýrobky a esence, icons08 = materiály z dropů, ryby, vodní suroviny,
// návnady a náčiní, icons09 = Těžba, icons10 = výbava (8 řad po 16: přilby, zbroje, holenice,
// boty, amulety, prsteny, meče, štíty; sloupec roste se stupněm). Rozřezané nástroji
// tools/split-icons-blobs.ps1 a tools/split-icons-grid.ps1.
const sheetKey = (sheet, index) => `${sheet}_${String(index).padStart(3, '0')}`;
const sheetIcons = (sheet, ids, start = 1) => ids.map((id, i) => [id, sheetKey(sheet, start + i)]);
const ICON_OVERRIDES = Object.fromEntries([
  ...sheetIcons('icons07', [
    'am_fish_oil', 'am_deep_oil', 'am_water_extract', 'am_deep_extract', 'am_venom_concentrate', 'am_spirit_concentrate',
    'am_astral_concentrate', 'am_moon_water', 'am_elemental_water', 'am_astral_fish', 'am_glow_essence', 'am_coral_reagent',
    'mat_plamenna_esence', 'mat_vodni_esence', 'mat_kamenna_esence', 'mat_verdantska_esence', 'mat_duchovni_esence',
    'mat_bazilisci_zlaza', 'mat_krystalicky_strep_pavouka', 'mat_snovy_prach'
  ]),
  ...sheetIcons('icons08', [
    'mat_bojovnikuv_kozeny_remen', 'mat_zatopeny_bronz', 'mat_koralova_zbranova_ozdoba', 'mat_vybojova_zlaza', 'mat_jeskynni_chitin',
    'mat_kyklopi_oko', 'mat_stinovy_prach', 'mat_goblini_zelezny_ulomek', 'mat_strazcovo_zelezo', 'mat_vzdusne_hedvabi',
    'mat_bleskova_zlaza', 'mat_manticoruv_osten', 'mat_vestecky_pyl', 'mat_prastara_miza', 'mat_hrbitovni_zelezo',
    'mat_duchovni_vlakno', 'mat_serohedvabi', 'mat_snova_esence', 'mat_stinove_hedvabi', 'mat_prach_z_uvazku_duse',
    null /* Temná duchovní esence – teď Duchovní esence (icons07) */, 'mat_stare_hrbitovni_zelezo', 'mat_nocni_esence',
    'mat_prizracne_vlakno', 'mat_rozkladny_sliz', 'mat_supina_aureliona', 'mat_srdce_hvezdneho_svetla', 'mat_hvezdny_prach',
    // 25 ryb (Lín a Korálovka na listu nejsou)
    'fish_roach', 'fish_perch', 'fish_carp', 'fish_trout', 'fish_pike', 'fish_eel', 'fish_catfish', 'fish_ice_char',
    'fish_frost_whitefish', 'fish_oasis_carp', 'fish_golden_carp', 'fish_sardine', 'fish_mackerel', 'fish_cod', 'fish_sea_bass',
    'fish_tuna', 'fish_glowing_deep', 'fish_swordfish', 'fish_deep_eel', 'fish_shadow', 'fish_elemental', 'fish_moon',
    'fish_old_one', 'fish_astral', 'fish_dragon_carp',
    'river_shell', 'sea_shell', 'common_pearl', 'quality_pearl', 'deep_pearl', 'magic_pearl',
    'common_coral', 'hardened_coral', 'deep_coral', 'magic_coral',
    'bread_bait', 'worm_bait', 'herbal_bait', 'spiced_bait', 'ice_bait', 'sea_bait', 'fire_bait', 'glow_bait', 'moon_bait', 'astral_bait',
    'simple_rod', 'flexible_rod', 'master_rod', 'fishing_hook', 'reinforced_fishing_hook', 'sea_reel', 'hydra_spear',
    'mat_kristalove_hedvabi', 'mat_supina_usvitu', 'mat_mesicni_esence', 'mat_svetelna_esence', null /* modrá hvězdná lahvička – volná */,
    'mat_slunecni_prach', 'mat_astralni_esence', 'mat_zlaty_prach', 'mat_jednorozci_roh', 'mat_cista_esence'
  ]),
  // Lín a Korálovka zatím sdílí ikonu podobné ryby (viz dokument Chybějící ikony předmětů).
  ['fish_tench', sheetKey('icons08', 31)], ['fish_coralfish', sheetKey('icons08', 43)],
  ...sheetIcons('icons09', [
    'tin_ore', 'silver_ore', 'gold_ore', 'mountain_ore', 'blacksteel_ore', 'mithril_ore', 'adamantite_ore', 'orichalcum_ore',
    'dragon_iron_ore', 'star_ore',
    'gem_ruby', 'gem_sapphire', 'gem_emerald', 'gem_amethyst', 'gem_topaz', 'gem_diamond', 'gem_black_diamond',
    'crystal_flame', 'crystal_water', 'crystal_stone', 'crystal_air', 'crystal_verdant', 'crystal_shadow', 'crystal_astral',
    'raw_cut_crystal', 'living_mineral',
    'coal', 'quartz', 'sulfur', 'granite', 'obsidian', 'pyrite', 'rune_stone',
    'pick_basic', 'pick_iron', 'pick_steel', 'pick_mithril', 'pick_adamantite', 'pick_dragon',
    'tool_ore_hammer', 'tool_wedge', 'tool_crystal_tongs', 'tool_chisel', 'tool_support', 'tool_drill', 'tool_astral_hammer',
    'tool_safety_tongs',
    'ancient_mine_map', 'miner_chest', 'ancient_rune_fragment', 'uncut_gem', 'meteor_core_fragment', 'mine_relic'
  ])
].filter(([id]) => id));

// Kovaná výbava: řada listu icons10 podle slotu, sloupec podle úrovně výroby (0–15; stejné
// úrovně posunou další kus o sloupec dál, dokud je místo). Elementální kusy mají barvu prvku.
// Původní výbava (tesák, čelenka, vesta, boty, amulety, prsteny) má vlastní ikony z icons01/03.
// Amulety a prsteny (řady 4 a 5) zatím žádný kovaný předmět nepoužívá.
const GEAR_ROW = { helmet: 0, armor: 1, legs: 2, boots: 3, amulet: 4, ring: 5, weapon: 6, shield: 7 };
const gearIcon = (slot, col) => sheetKey('icons10', GEAR_ROW[slot] * 16 + col + 1);
const GEAR_ICON_COLUMN = {
  smith_E01: 8, smith_E02: 7, smith_E13: 12, smith_E15: 14, smith_E20: 15,
  smith_E04: 8, smith_E06: 11, smith_E14: 13, smith_E17: 14, smith_E18: 15,
  smith_E07: 10, smith_E19: 15, smith_E16: 15, smith_E09: 15
};
{
  const smithLevel = Object.fromEntries([
    ...SMITHING_RECIPES.filter((r) => !r.output).map((r) => [smithingOutputId(r), r.level]),
    ...CRAFTING_RECIPES.filter((r) => !r.output).map((r) => [craftingOutputId(r), r.level])
  ]);
  const bySlot = {};
  for (const it of Object.values(ITEMS)) if ((it.smithed || it.craftIcon) && GEAR_ROW[it.slot] !== undefined) (bySlot[it.slot] ??= []).push(it);
  for (const [slot, list] of Object.entries(bySlot)) {
    let prev = -1;
    for (const it of list.sort((a, b) => (smithLevel[a.id] ?? 0) - (smithLevel[b.id] ?? 0))) {
      let col = GEAR_ICON_COLUMN[it.id];
      if (col === undefined) {
        col = Math.min(15, Math.floor(((smithLevel[it.id] ?? 0) * 16) / 101));
        if (list.length <= 16) col = Math.min(15, Math.max(col, prev + 1));
      }
      prev = Math.max(prev, col);
      ICON_OVERRIDES[it.id] = gearIcon(slot, col);
    }
  }
}
for (const [id, icon] of Object.entries(ICON_OVERRIDES)) {
  const target = ITEMS[id];
  if (!target) continue;
  target.icon = icon;
  if (target.iconFit) target.iconFit = 'exact';
}

// Ceny kovářských výrobků = součet cen surovin × 1,3 (mezivýrobky postupně od nejnižší úrovně).
{
  const priceOf = (id) => ITEMS[id]?.price ?? 5;
  for (const r of [...SMITHING_INTERMEDIATES, ...SMITHING_RECIPES].sort((a, b) => a.level - b.level)) {
    const target = ITEMS[smithingOutputId(r)];
    if (!target || target.price) continue;
    const cost = Object.entries(r.ingredients).reduce((sum, [key, qty]) => sum + priceOf(key.split('|')[0]) * qty, 0);
    target.price = Math.max(1, Math.round((cost * 1.3) / r.qty));
  }
}

// Ceny výrobků Řemeslnictví stejně: součet cen surovin × 1,3 (od nejnižší úrovně, Soul Crystaly mají cenu vlastní).
{
  const priceOf = (id) => ITEMS[id]?.price ?? 5;
  for (const r of [...ALL_CRAFTING].sort((a, b) => a.level - b.level)) {
    const target = ITEMS[craftingOutputId(r)];
    if (!target || target.price) continue;
    const cost = Object.entries(r.ingredients).reduce((sum, [key, qty]) => sum + priceOf(key.split('|')[0]) * qty, 0);
    target.price = Math.max(1, Math.round((cost * 1.3) / r.qty));
  }
}

export const getItem = (id) => ITEMS[id] ?? null;

// Přejmenované materiály (sjednocení názvů esencí podle návrhu Alchymie). Staré kusy
// v uložených hrách se při načtení převedou na nové předměty.
export const RENAMED_ITEMS = {
  mat_ohniva_esence: 'mat_plamenna_esence',
  mat_prilivova_esence: 'mat_vodni_esence',
  mat_nymfina_cista_esence: 'mat_vodni_esence',
  mat_zivy_kamenny_strep: 'mat_kamenna_esence',
  mat_lesni_duchovni_esence: 'mat_verdantska_esence',
  mat_temna_duchovni_esence: 'mat_duchovni_esence',
  mat_brouseny_krystal: 'mat_krystalicky_strep_pavouka',
  // Těžba: Krystalické jádro (drop Crystal Golem) = Křišťálové jádro z naleziště.
  mat_krystalicke_jadro: 'mat_kristalove_jadro'
};
