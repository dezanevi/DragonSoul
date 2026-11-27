import { statPart } from './heroStatLabels.js';
// Vaření podle schváleného dokumentu „Vaření – návrh systému“: suroviny, mezivýrobky
// a 104 hlavních receptů. Čísla jsou výchozí návrh, ladíme je spolu.
//
// Recept: [id, název, kategorie, úroveň, pracoviště, kusů, ingredience, účinek, původ]
//   ingredience: { itemId: počet } nebo { 'a|b': počet } = libovolná kombinace a / b
//   pracoviště: 1 ohniště, 2 sporák, 3 profesionální kuchyně, 4 hostinská kuchyně
//   účinek (kladné hodnoty):
//     heal      HP nejvíc zraněnému monstru     healAll  HP všem monstrům v partě
//     mana      many hrdinovi                   regen / manaRegen  po každém souboji
//     buffs     { attack, aether, defense, resolve, speed, maxHp, maxMp } v % (souboje)
//     battles   délka regenerace a bonusů (počet soubojů)
//     move      rychlost pohybu na mapě v %     explore  HP monstrům každých 50 kroků
//     minutes   délka cestovních bonusů (minuty)
//   původ: base = odemkne se úrovní; ostatní (rybář, kuchař, úkol, nalezený recept) – návrh

// --------------------------------------------------------------- byliny
// 16 schválených rostlin (Sběr bylin). Tři už ve hře jsou, ostatní přibydou.
export const HERBS = [
  ['healing_herbs', 'Léčivé byliny'], ['cleansing_herbs', 'Čistící byliny'], ['blue_herbs', 'Modré byliny'],
  ['mat_svitici_list', 'Svítící list'], ['mat_vodni_kvet', 'Vodní květ'], ['forest_sage', 'Lesní šalvěj'],
  ['bitter_root', 'Hořký kořen'], ['fire_sage', 'Ohnivá šalvěj'], ['ice_mint', 'Ledová máta'],
  ['storm_fern', 'Bouřková kapradina'], ['shadow_lily', 'Stínová lilie'], ['astral_orchid', 'Astrální orchidej'],
  ['sun_thistle', 'Sluneční bodlák'], ['moon_flower', 'Měsíční květ'], ['mountain_root', 'Horský kořen'],
  ['wayfarer_thyme', 'Poutnický tymián']
];
export const NEW_HERBS = HERBS.slice(3);

// ------------------------------------------------- kuchyňské suroviny
export const STAPLES = [
  { id: 'salt', name: 'Sůl', price: 1, description: 'Kuchyňská surovina. Prodávají obchodníci.' },
  { id: 'flour', name: 'Mouka', price: 1, description: 'Kuchyňská surovina. Prodávají obchodníci.' },
  { id: 'vegetables', name: 'Zelenina', price: 2, description: 'Kuchyňská surovina. Prodávají obchodníci.' }
];

// Maso z monster (nový drop, šance 50 %). Klíč zdroje = id druhu (slug anglického názvu).
export const MEATS = [
  { id: 'meat_wolf', name: 'Vlčí maso', rarity: 'common', from: ['dire_wolf', 'zephyr_hound'] },
  { id: 'meat_beast', name: 'Maso šelmy', rarity: 'common', from: ['galecrest_lynx', 'mossveil_lynx', 'windscar_stalker', 'comet_tail_fox'] },
  { id: 'meat_boar', name: 'Kančí maso', rarity: 'common', from: ['wild_boar'] },
  { id: 'meat_bird', name: 'Ptačí maso', rarity: 'common', from: ['ashen_kestrel', 'cloudmantle_owl'] },
  { id: 'meat_venison', name: 'Jelení zvěřina', rarity: 'uncommon', from: ['thornroot_stag', 'emberhorn_ram'] },
  { id: 'meat_bear', name: 'Medvědí maso', rarity: 'uncommon', from: ['cave_bear'] },
  { id: 'meat_reptile', name: 'Plazí maso', rarity: 'uncommon', from: ['cinderback_salamander', 'barkplate_pangolin'] },
  { id: 'meat_aquatic', name: 'Maso vodních tvorů', rarity: 'uncommon', from: ['siltjaw_eel', 'sea_serpent', 'pearlback_tortoise'] },
  { id: 'meat_rare_flyer', name: 'Maso vzácných letců', rarity: 'rare', from: ['griffin', 'hippogriff', 'roc'] },
  { id: 'meat_wyvern', name: 'Wyverní maso', rarity: 'rare', from: ['wyvern'] },
  { id: 'kraken_tentacle', name: 'Krakení chapadlo', rarity: 'rare', from: ['kraken'] },
  { id: 'meat_moon_venison', name: 'Měsíční zvěřina', rarity: 'epic', from: ['moon_stag'] },
  { id: 'behemoth_shoulder', name: 'Behemothí plec', rarity: 'epic', from: ['behemoth'] }
];
export const MEAT_DROP_CHANCE = 0.5;

// Dřevo nejde těžit: běžný drop z dřevěných monster (a prodávají ho obchodníci).
export const WOOD_DROP = { id: 'wood', chance: 0.6, from: ['treant', 'dryad', 'barkplate_pangolin'] };

// Speciální materiály z monster (už existují v items.js) – jen přes mezivýrobek.
const M = {
  emberFeather: 'mat_zhave_pirko', liveCoral: 'mat_zivy_koral', pegasusHair: 'mat_pegasi_zine',
  demonMembrane: 'mat_demonicka_blana', starDust: 'mat_hvezdny_prach'
};

export const STATIONS = {
  1: { id: 'campfire', name: 'Ohniště' },
  2: { id: 'stove', name: 'Kuchyňský sporák' },
  3: { id: 'pro', name: 'Profesionální kuchyně' },
  4: { id: 'inn', name: 'Hostinská kuchyně' }
};

export const CATEGORIES = [
  { id: 'M', label: 'Mezivýrobky' },
  { id: 'A', label: 'Masové pokrmy' },
  { id: 'B', label: 'Sladkovodní ryby' },
  { id: 'C', label: 'Mořské ryby' },
  { id: 'D', label: 'Vývary a polévky' },
  { id: 'E', label: 'Regenerační' },
  { id: 'F', label: 'Mana a soustředění' },
  { id: 'G', label: 'Monsterové speciality' },
  { id: 'H', label: 'Cestovní zásoby' },
  { id: 'I', label: 'Regionální kuchyně' },
  { id: 'J', label: 'Mistrovská a legendární' }
];

export const ORIGINS = {
  base: 'Odemkne se úrovní Vaření',
  fisher: 'Rybář v Greenvale (návrh)',
  cook: 'Kuchař v hostinci (návrh)',
  found: 'Nalezený recept (návrh)',
  quest: 'Úkol (návrh)',
  region: 'Kuchař nebo hostinec v regionu (návrh)'
};

// ------------------------------------------------------- mezivýrobky
const R = (id, name, category, level, station, qty, ingredients, effect, origin = 'base') =>
  ({ id, name, category, level, station, qty, ingredients, effect, origin });

export const INTERMEDIATES = [
  R('cm_fish_stock', 'Rybí vývarový základ', 'M', 1, 2, 2, { fish_roach: 2, clean_water: 1 }, null),
  R('cm_meat_stock', 'Masový vývarový základ', 'M', 15, 2, 2, { 'meat_boar|meat_wolf': 1, vegetables: 1, clean_water: 1 }, null),
  R('cm_dried_spice', 'Sušené koření', 'M', 20, 1, 3, { forest_sage: 1, wayfarer_thyme: 1 }, null),
  R('cm_preserved_fish', 'Konzervovaná ryba', 'M', 8, 1, 2, { 'fish_roach|fish_perch|fish_sardine': 2, salt: 1, wood: 1 }, null),
  R('cm_fire_extract', 'Ohnivý extrakt', 'M', 32, 2, 2, { [M.emberFeather]: 1, fire_sage: 1 }, null),
  R('cm_coral_salt', 'Korálová sůl', 'M', 35, 2, 3, { [M.liveCoral]: 1, salt: 2 }, null),
  R('cm_aroma_powder', 'Aromatický prášek', 'M', 48, 3, 3, { [M.pegasusHair]: 1, sun_thistle: 1 }, null),
  R('cm_demon_spice', 'Démonické koření', 'M', 60, 3, 2, { [M.demonMembrane]: 1, cleansing_herbs: 2 }, null),
  R('cm_star_spice', 'Hvězdné koření', 'M', 85, 4, 1, { [M.starDust]: 1, astral_orchid: 1 }, null)
];

// ------------------------------------------------------- 104 receptů
const b = (battles, buffs) => ({ buffs, battles });

export const RECIPES = [
  // A Masové pokrmy
  R('V001', 'Opečené vlčí maso', 'A', 1, 1, 2, { meat_wolf: 1, salt: 1 }, { heal: 25 }),
  R('V002', 'Kančí špíz', 'A', 4, 1, 2, { meat_boar: 1, vegetables: 1 }, b(3, { attack: 3 })),
  R('V003', 'Pečená zvěřina se šalvějí', 'A', 8, 1, 2, { meat_venison: 1, forest_sage: 1 }, { healAll: 12 }),
  R('V004', 'Medvědí plec na houbách', 'A', 12, 2, 1, { meat_bear: 1, forest_mushrooms: 2 }, b(3, { defense: 3 })),
  R('V005', 'Ptačí stehýnka na tymiánu', 'A', 14, 1, 2, { meat_bird: 2, wayfarer_thyme: 1 }, b(3, { speed: 3 })),
  R('V006', 'Dušené maso šelmy', 'A', 18, 2, 2, { meat_beast: 1, vegetables: 1, salt: 1 }, { heal: 50 }),
  R('V007', 'Kančí guláš', 'A', 22, 2, 2, { meat_boar: 2, vegetables: 1, fire_sage: 1 }, b(3, { attack: 5 })),
  R('V008', 'Plazí pečeně s kořenem', 'A', 26, 2, 1, { meat_reptile: 1, mountain_root: 1 }, b(4, { defense: 5 })),
  R('V009', 'Zvěřinová paštika', 'A', 34, 2, 2, { meat_venison: 2, cm_dried_spice: 1, flour: 1 }, b(4, { maxHp: 7 }), 'cook'),
  R('V010', 'Medvědí pečeně s hořkým kořenem', 'A', 42, 3, 1, { meat_bear: 2, bitter_root: 1, cm_dried_spice: 1 }, b(4, { defense: 7, maxHp: 5 }), 'cook'),
  R('V011', 'Pečeně z vzácného letce', 'A', 58, 3, 1, { meat_rare_flyer: 1, storm_fern: 1, 'cm_aroma_powder|herb_flower_essence': 1 }, b(5, { speed: 9 }), 'found'),
  R('V012', 'Wyverní steak', 'A', 66, 3, 1, { meat_wyvern: 1, cm_fire_extract: 1, mountain_root: 1 }, b(5, { attack: 9 }), 'found'),

  // B Sladkovodní rybí pokrmy
  R('V013', 'Pečená plotice', 'B', 1, 1, 1, { fish_roach: 1, healing_herbs: 1 }, { heal: 25 }),
  R('V014', 'Okoun s modrými bylinami', 'B', 3, 1, 1, { fish_perch: 1, blue_herbs: 1 }, { mana: 5 }),
  R('V015', 'Pečený kapr', 'B', 6, 2, 2, { fish_carp: 1, salt: 1, flour: 1 }, { healAll: 12 }),
  R('V016', 'Lín na houbách', 'B', 9, 2, 1, { fish_tench: 1, forest_mushrooms: 2 }, b(3, { resolve: 3 }), 'fisher'),
  R('V017', 'Pstruh se šalvějí', 'B', 11, 1, 1, { fish_trout: 1, forest_sage: 1 }, b(3, { aether: 3 })),
  R('V018', 'Pečený lín s léčivými bylinami', 'B', 13, 1, 1, { fish_tench: 1, healing_herbs: 2 }, { regen: 5, battles: 3 }),
  R('V019', 'Štika na kořenech', 'B', 17, 2, 1, { fish_pike: 1, mountain_root: 1, vegetables: 1 }, b(3, { speed: 5 })),
  R('V020', 'Uzený úhoř', 'B', 21, 1, 2, { fish_eel: 1, wood: 1 }, { regen: 10, battles: 4 }, 'fisher'),
  R('V021', 'Pečený sumec s cibulí', 'B', 25, 2, 2, { fish_catfish: 1, vegetables: 1, flour: 1 }, { healAll: 25 }),
  R('V022', 'Ledový siven s mátou', 'B', 28, 1, 1, { fish_ice_char: 1, ice_mint: 1 }, { mana: 10 }),
  R('V023', 'Mrazivý síh v solné krustě', 'B', 33, 3, 1, { fish_frost_whitefish: 1, salt: 2, ice_mint: 1 }, b(4, { maxMp: 7 })),
  R('V024', 'Štičí knedlíčky', 'B', 38, 2, 3, { fish_pike: 2, flour: 1, forest_sage: 1 }, { heal: 90 }),
  R('V025', 'Zlatý kapr po hostinsku', 'B', 45, 4, 1, { fish_golden_carp: 1, sun_thistle: 1, cm_dried_spice: 1 }, b(4, { maxHp: 7, defense: 5 }), 'cook'),
  R('V026', 'Úhoř na bouřkové kapradině', 'B', 47, 3, 1, { fish_eel: 2, storm_fern: 1 }, b(4, { speed: 7 })),

  // C Mořské rybí pokrmy
  R('V027', 'Grilované sardinky', 'C', 30, 1, 2, { fish_sardine: 2, salt: 1 }, { heal: 50 }),
  R('V028', 'Makrela s tymiánem', 'C', 31, 1, 1, { fish_mackerel: 1, wayfarer_thyme: 1 }, b(4, { attack: 7 })),
  R('V029', 'Pečená treska s houbami', 'C', 33, 2, 2, { fish_cod: 1, forest_mushrooms: 1, flour: 1 }, { healAll: 45 }),
  R('V030', 'Sardinková paštika', 'C', 35, 2, 3, { fish_sardine: 3, flour: 1 }, { mana: 18 }),
  R('V031', 'Mořský okoun v korálové soli', 'C', 37, 3, 1, { fish_sea_bass: 1, cm_coral_salt: 1 }, b(4, { resolve: 7 })),
  R('V032', 'Treskové filé s bylinkami', 'C', 39, 1, 1, { fish_cod: 1, healing_herbs: 1, forest_sage: 1 }, { heal: 90 }),
  R('V033', 'Korálovka na vodním květu', 'C', 42, 3, 1, { fish_coralfish: 1, mat_vodni_kvet: 1, cm_coral_salt: 1 }, { regen: 18, battles: 4 }),
  R('V034', 'Makrela na ledové mátě', 'C', 44, 1, 2, { fish_mackerel: 2, ice_mint: 1 }, { manaRegen: 6, battles: 4 }),
  R('V035', 'Mořská hostinská specialita', 'C', 48, 4, 2, { fish_sea_bass: 1, fish_cod: 1, cm_coral_salt: 1, cm_dried_spice: 1 }, { healAll: 45, ...b(4, { defense: 5 }) }, 'cook'),
  R('V036', 'Tuňákový steak', 'C', 52, 3, 1, { fish_tuna: 1, salt: 1, cm_dried_spice: 1 }, b(5, { attack: 9 })),
  R('V037', 'Tuňák s horským kořenem', 'C', 56, 2, 2, { fish_tuna: 1, mountain_root: 1, vegetables: 1 }, b(5, { maxHp: 9 })),
  R('V038', 'Mečoun z grilu', 'C', 62, 3, 1, { fish_swordfish: 1, cm_fire_extract: 1, cm_coral_salt: 1 }, b(5, { attack: 9, speed: 6 }), 'found'),

  // D Vývary a polévky
  R('V039', 'Jednoduchý rybí vývar', 'D', 3, 2, 2, { cm_fish_stock: 1, vegetables: 1 }, { healAll: 12 }),
  R('V040', 'Bylinková polévka', 'D', 5, 2, 2, { clean_water: 1, healing_herbs: 1, forest_sage: 1 }, { regen: 5, battles: 4 }),
  R('V041', 'Houbová polévka', 'D', 10, 2, 2, { forest_mushrooms: 2, clean_water: 1, salt: 1 }, { manaRegen: 2, battles: 3 }),
  R('V042', 'Výživný rybí vývar', 'D', 19, 2, 2, { cm_fish_stock: 1, fish_carp: 1, forest_sage: 1 }, { healAll: 25 }),
  R('V043', 'Masový vývar se zeleninou', 'D', 23, 2, 3, { cm_meat_stock: 1, vegetables: 2 }, { regen: 10, battles: 4 }),
  R('V044', 'Ohnivá polévka z kančího masa', 'D', 29, 2, 2, { meat_boar: 1, fire_sage: 1, clean_water: 1 }, b(3, { maxHp: 5 })),
  R('V045', 'Ledová polévka s mátou', 'D', 36, 2, 2, { ice_mint: 1, mat_vodni_kvet: 1, clean_water: 1 }, b(4, { aether: 7 })),
  R('V046', 'Pobřežní rybí polévka', 'D', 40, 2, 3, { cm_fish_stock: 1, fish_cod: 1, fish_mackerel: 1, vegetables: 1 }, { healAll: 45 }),
  R('V047', 'Vývar z vodních tvorů', 'D', 54, 3, 2, { meat_aquatic: 1, cm_fish_stock: 1, mat_vodni_kvet: 1 }, { regen: 28, battles: 5 }),
  R('V048', 'Krakení polévka', 'D', 68, 3, 2, { kraken_tentacle: 1, cm_fish_stock: 1, cm_coral_salt: 1, blue_herbs: 1 }, { manaRegen: 9, ...b(5, { maxMp: 6 }) }, 'found'),

  // E Regenerační pokrmy
  R('V049', 'Léčivá kaše', 'E', 7, 2, 2, { flour: 1, healing_herbs: 2, clean_water: 1 }, { regen: 6, battles: 5 }),
  R('V050', 'Dušená zelenina s vodním květem', 'E', 20, 2, 2, { vegetables: 2, mat_vodni_kvet: 1 }, { regen: 10, battles: 4 }),
  R('V051', 'Kančí pečeně s léčivými bylinami', 'E', 32, 2, 2, { meat_boar: 1, healing_herbs: 2, salt: 1 }, { regen: 18, battles: 4 }),
  R('V052', 'Jelení vývar se slunečním bodlákem', 'E', 46, 2, 2, { meat_venison: 1, sun_thistle: 1, cm_meat_stock: 1 }, { regen: 18, ...b(4, { maxHp: 5 }) }, 'cook'),
  R('V053', 'Výživná medvědí pečeně', 'E', 52, 3, 2, { meat_bear: 2, mountain_root: 1, sun_thistle: 1 }, { regen: 28, battles: 5 }),
  R('V054', 'Hlubinný regenerační pokrm', 'E', 60, 3, 1, { fish_glowing_deep: 1, mat_vodni_kvet: 1, shadow_lily: 1 }, { heal: 140, regen: 28, battles: 5 }, 'found'),
  R('V055', 'Hlubinný úhoř na vodním květu', 'E', 72, 3, 1, { fish_deep_eel: 1, mat_vodni_kvet: 2, healing_herbs: 1 }, { heal: 200, regen: 40, battles: 5 }, 'found'),
  R('V056', 'Měsíční zvěřina s měsíčním květem', 'E', 82, 4, 1, { meat_moon_venison: 1, moon_flower: 1, 'cm_aroma_powder|herb_flower_essence': 1 }, { regen: 40, manaRegen: 12, battles: 5 }, 'quest'),

  // F Mana a soustředění
  R('V057', 'Modrá bylinková placka', 'F', 4, 1, 2, { flour: 1, blue_herbs: 1 }, { mana: 8 }),
  R('V058', 'Svítící listy na páře', 'F', 15, 2, 2, { mat_svitici_list: 2, clean_water: 1 }, { mana: 5, ...b(3, { aether: 3 }) }),
  R('V059', 'Bylinkový čaj soustředění', 'F', 24, 2, 2, { 'mat_vodni_kvet|moon_flower': 1, blue_herbs: 1, clean_water: 1 }, b(3, { maxMp: 5 })),
  R('V060', 'Pstruh s měsíčním květem', 'F', 27, 1, 1, { fish_trout: 1, 'blue_herbs|moon_flower': 1 }, { manaRegen: 4, battles: 4 }),
  R('V061', 'Rybí knedlíčky s modrými bylinami', 'F', 41, 2, 3, { cm_fish_stock: 1, blue_herbs: 1, flour: 1 }, { mana: 18 }),
  R('V062', 'Elementální ryba na páře', 'F', 61, 3, 1, { fish_elemental: 1, mat_svitici_list: 1, blue_herbs: 1 }, b(5, { aether: 9 })),
  R('V063', 'Stínová ryba se stínovou lilií', 'F', 64, 3, 1, { fish_shadow: 1, shadow_lily: 1, cm_dried_spice: 1 }, b(5, { resolve: 9 })),
  R('V064', 'Měsíční ryba s měsíčním květem', 'F', 74, 3, 1, { fish_moon: 1, moon_flower: 2 }, { manaRegen: 12, ...b(6, { maxMp: 12 }) }, 'found'),

  // G Monsterové speciality
  R('V065', 'Ohnivé ptačí stehno', 'G', 36, 1, 2, { meat_bird: 2, cm_fire_extract: 1 }, b(4, { attack: 7 })),
  R('V066', 'Dušené maso vodních tvorů', 'G', 44, 2, 2, { meat_aquatic: 1, cleansing_herbs: 1, cm_coral_salt: 1 }, b(4, { defense: 7 })),
  R('V067', 'Plazí guláš s ohnivým extraktem', 'G', 48, 2, 2, { meat_reptile: 2, cm_fire_extract: 1, vegetables: 1 }, b(4, { attack: 5, defense: 5 })),
  R('V068', 'Pečeně s aromatickým práškem', 'G', 50, 3, 1, { meat_venison: 1, cm_aroma_powder: 1, sun_thistle: 1 }, b(4, { maxHp: 7, aether: 5 }), 'cook'),
  R('V069', 'Krakení chapadla na ohni', 'G', 58, 1, 1, { kraken_tentacle: 1, cm_coral_salt: 1 }, b(5, { resolve: 9 })),
  R('V070', 'Démonicky kořeněná kančí plec', 'G', 63, 3, 1, { meat_boar: 2, cm_demon_spice: 1, bitter_root: 1 }, b(5, { attack: 9, aether: 6 }), 'found'),
  R('V071', 'Wyverní ragú', 'G', 70, 3, 2, { meat_wyvern: 1, meat_reptile: 1, cm_demon_spice: 1, vegetables: 1 }, b(5, { defense: 9, maxHp: 6 }), 'found'),
  R('V072', 'Letecká hostina', 'G', 76, 3, 1, { meat_rare_flyer: 2, storm_fern: 1, 'cm_aroma_powder|herb_flower_essence': 1 }, b(6, { speed: 12 }), 'found'),
  R('V073', 'Behemothí plec pečená v hlíně', 'G', 78, 4, 2, { behemoth_shoulder: 1, mountain_root: 1, cm_dried_spice: 2 }, b(6, { maxHp: 12, defense: 8 }), 'quest'),
  R('V074', 'Měsíční zvěřina s astrální orchidejí', 'G', 86, 4, 1, { meat_moon_venison: 1, astral_orchid: 1, 'cm_aroma_powder|herb_flower_essence': 1 }, b(6, { aether: 12, maxMp: 8 }), 'quest'),

  // H Cestovní zásoby
  R('V075', 'Cestovní jídlo', 'H', 1, 1, 3, { flour: 1, salt: 1, vegetables: 1 }, { mana: 5, heal: 15 }),
  R('V076', 'Sušená ryba', 'H', 2, 1, 3, { fish_roach: 2, salt: 1 }, { heal: 20 }),
  R('V077', 'Sušené maso', 'H', 6, 1, 3, { meat_wolf: 1, salt: 1 }, { explore: 3, minutes: 10 }),
  R('V078', 'Poutnický chléb s tymiánem', 'H', 9, 1, 3, { flour: 2, wayfarer_thyme: 1 }, { move: 5, minutes: 10 }),
  R('V079', 'Rybí cestovní příděl', 'H', 12, 1, 3, { cm_preserved_fish: 1, flour: 1 }, { heal: 25, mana: 5 }),
  R('V080', 'Výživná rybí svačina', 'H', 20, 1, 2, { cm_preserved_fish: 1, sun_thistle: 1 }, { explore: 6, minutes: 15 }),
  R('V081', 'Konzervovaný rybí pokrm', 'H', 32, 2, 4, { cm_preserved_fish: 2, vegetables: 1, salt: 1 }, { heal: 60 }),
  R('V082', 'Horský krajíc s kořenem', 'H', 38, 1, 3, { flour: 1, mountain_root: 1, meat_bear: 1 }, { explore: 10, minutes: 15 }),
  R('V083', 'Rybí zásoba s mátou', 'H', 50, 2, 3, { cm_preserved_fish: 1, ice_mint: 1, mat_vodni_kvet: 1 }, { move: 8, minutes: 15, mana: 18 }),
  R('V084', 'Výpravní hostina', 'H', 66, 4, 4, { fish_tuna: 1, cm_preserved_fish: 1, wayfarer_thyme: 1, cm_dried_spice: 1 }, { move: 10, explore: 12, minutes: 20 }, 'cook'),

  // I Regionální kuchyně
  R('V085', 'Greenvalská rybí placka', 'I', 10, 1, 2, { fish_roach: 1, fish_perch: 1, flour: 1 }, { heal: 25, ...b(3, { speed: 3 }) }, 'fisher'),
  R('V086', 'Říční hostinská mísa', 'I', 16, 4, 2, { fish_carp: 1, fish_tench: 1, healing_herbs: 1 }, { healAll: 25 }, 'cook'),
  R('V087', 'Verdantský pstruh v listech', 'I', 24, 1, 1, { fish_trout: 1, forest_sage: 1, mat_svitici_list: 1 }, b(3, { aether: 5 }), 'region'),
  R('V088', 'Jezerní hostina', 'I', 30, 2, 2, { fish_catfish: 1, fish_pike: 1, vegetables: 1 }, { healAll: 25, ...b(3, { defense: 3 }) }, 'region'),
  R('V089', 'Stonehelmský horský guláš', 'I', 34, 2, 2, { fish_pike: 1, meat_bear: 1, mountain_root: 1 }, b(4, { defense: 7 }), 'region'),
  R('V090', 'Mrazivá polévka z Frostlands', 'I', 37, 2, 2, { fish_ice_char: 1, fish_frost_whitefish: 1, fire_sage: 1 }, { healAll: 45, ...b(4, { resolve: 5 }) }, 'region'),
  R('V091', 'Oázový kapr na slunečním bodláku', 'I', 43, 1, 1, { fish_oasis_carp: 1, sun_thistle: 1 }, b(4, { maxHp: 7 }), 'region'),
  R('V092', 'Azurová pobřežní mísa', 'I', 49, 4, 2, { fish_sardine: 1, fish_sea_bass: 1, cm_coral_salt: 1, mat_vodni_kvet: 1 }, { regen: 12, ...b(4, { resolve: 7 }) }, 'region'),
  R('V093', 'Ostrovní hlubinná specialita', 'I', 57, 3, 1, { fish_tuna: 1, fish_glowing_deep: 1, mat_svitici_list: 1 }, b(5, { aether: 9 }), 'region'),
  R('V094', 'Stínová krmě', 'I', 67, 3, 1, { fish_shadow: 1, fish_catfish: 1, shadow_lily: 1 }, b(5, { resolve: 9, maxMp: 6 }), 'region'),
  R('V095', 'Skyreachský nebeský pstruh', 'I', 73, 4, 1, { fish_trout: 1, fish_moon: 1, 'cm_aroma_powder|herb_flower_essence': 1 }, b(6, { speed: 12 }), 'region'),
  R('V096', 'Dračí termální vývar', 'I', 84, 4, 2, { fish_elemental: 1, cm_fire_extract: 1, cm_meat_stock: 1, bitter_root: 1 }, b(6, { attack: 12 }), 'region'),

  // J Mistrovská a legendární jídla
  R('V097', 'Hlubinný úhoř po mistrovsku', 'J', 80, 3, 2, { fish_deep_eel: 1, fish_swordfish: 1, shadow_lily: 1 }, b(6, { defense: 12, resolve: 10 }), 'found'),
  R('V098', 'Astrální rybí specialita', 'J', 88, 4, 1, { fish_moon: 1, astral_orchid: 1, cm_star_spice: 1 }, b(6, { aether: 12, maxMp: 10 }), 'quest'),
  R('V099', 'Hostina mistra kuchaře', 'J', 90, 4, 4, { fish_swordfish: 1, behemoth_shoulder: 1, cm_dried_spice: 1, sun_thistle: 1 }, { healAll: 100, regen: 40, battles: 6 }, 'quest'),
  R('V100', 'Legendární výpravní hostina', 'J', 92, 4, 6, { fish_tuna: 1, meat_moon_venison: 1, astral_orchid: 1, wayfarer_thyme: 1 }, { ...b(8, { speed: 10 }), move: 15, explore: 25, minutes: 30 }, 'quest'),
  R('V101', 'Polévka sedmi vod', 'J', 94, 4, 7, { fish_roach: 1, fish_ice_char: 1, fish_oasis_carp: 1, fish_cod: 1, fish_glowing_deep: 1, fish_shadow: 1, fish_elemental: 1 }, { healAll: 150, regen: 60, manaRegen: 16, battles: 6 }, 'quest'),
  R('V102', 'Starcova slavnostní tabule', 'J', 95, 4, 6, { fish_old_one: 1, fish_golden_carp: 1, astral_orchid: 1, cm_star_spice: 1 }, b(8, { maxHp: 15, defense: 12 }), 'fisher'),
  R('V103', 'Astrální ryba v hvězdném koření', 'J', 97, 4, 4, { fish_astral: 1, cm_star_spice: 1, moon_flower: 1 }, { mana: 50, ...b(8, { aether: 15, maxMp: 12 }) }, 'quest'),
  R('V104', 'Dračí kapr na žhavých kamenech', 'J', 99, 4, 4, { fish_dragon_carp: 1, cm_fire_extract: 1, cm_star_spice: 1, cm_demon_spice: 1 }, b(8, { attack: 15, speed: 12 }), 'quest')
];

// Opakující se pokrmy (stejný účinek jako jiný recept na podobné úrovni) dávají místo toho
// Štěstí nebo Charisma hrdiny (ploché body na pár soubojů): 1 bod do úr. 24, +1 za každých 25 úrovní.
// Masový vývar se zeleninou (V043) zůstává – je to snídaně k noclehu v hostinci.
const HERO_STAT_MEALS = {
  V013: 'charisma', V015: 'charisma', V039: 'luck', V027: 'luck', V091: 'charisma', V036: 'luck',
  V020: 'luck', V050: 'charisma', V042: 'charisma', V086: 'luck', V032: 'charisma', V065: 'luck',
  V046: 'charisma', V061: 'luck', V033: 'luck', V047: 'charisma', V093: 'luck', V069: 'charisma',
  V089: 'charisma', V095: 'luck'
};
for (const r of RECIPES) {
  const stat = HERO_STAT_MEALS[r.id];
  if (stat) r.effect = { buffs: { [stat]: 1 + Math.floor(r.level / 25) }, battles: r.level >= 50 ? 5 : 4 };
}

export const ALL_COOKING = [...INTERMEDIATES, ...RECIPES];
export const COOKING_BY_ID = Object.fromEntries(ALL_COOKING.map((r) => [r.id, r]));

// Výsledný předmět receptu (mezivýrobek má id receptu, pokrm „meal_V001“; Cestovní jídlo = travel_ration).
export const outputItemId = (recipe) =>
  recipe.category === 'M' ? recipe.id : recipe.id === 'V075' ? 'travel_ration' : `meal_${recipe.id}`;

export const STAT_LABELS = {
  attack: 'Fyzický útok', aether: 'Magický útok', defense: 'Obrana', resolve: 'Magická odolnost',
  speed: 'Rychlost', maxHp: 'Max. HP', maxMp: 'Max. mana'
};

// Čitelný popis účinku (pro předmět a okno Vaření).
export function describeEffect(e) {
  if (!e) return 'Mezivýrobek pro další recepty.';
  const parts = [];
  if (e.heal) parts.push(`${e.heal} HP nejvíc zraněnému monstru`);
  if (e.healAll) parts.push(`${e.healAll} HP všem monstrům v partě`);
  if (e.mana) parts.push(`+${e.mana} many`);
  if (e.regen) parts.push(`regenerace ${e.regen} HP po každém souboji`);
  if (e.manaRegen) parts.push(`mana +${e.manaRegen} po každém souboji`);
  for (const [stat, value] of Object.entries(e.buffs ?? {})) parts.push(statPart(STAT_LABELS, stat, value));
  let text = parts.join(', ');
  if (e.battles && (e.regen || e.manaRegen || e.buffs)) text += ` (${e.battles} ${e.battles < 5 ? 'souboje' : 'soubojů'})`;
  const travel = [];
  if (e.move) travel.push(`rychlost pohybu na mapě +${e.move} %`);
  if (e.explore) travel.push(`průzkum: +${e.explore} HP monstrům každých 50 kroků`);
  if (travel.length) text += `${text ? '; ' : ''}${travel.join(', ')} (${e.minutes} min)`;
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}

export const hasLastingEffect = (e) => Boolean(e && (e.regen || e.manaRegen || e.buffs || e.move || e.explore));
export const cookingXp = (recipe) => Math.round(8 + 1.5 * recipe.level);
