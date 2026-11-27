import { statPart, monsterBonus, heroStatSuffix } from './heroStatLabels.js';
// Kovářství podle schváleného dokumentu „Kovářství – návrh systému“.
//
//   SMITHING_INTERMEDIATES  tavení a mezivýrobky (M01–M19, do 112 receptů se nepočítají)
//   SMITHING_RECIPES        A zbraně 28, B zbroje = 11 sad podle kovu × 5 kusů (55), C nástroje, D výztuhy 16, E vzácné 20
//
// Účinek receptu (effect):
//   gear:      { slot, bonus: { attack, aether, defense, resolve, speed, maxHp }, resist: { element: % }, elementDamage: { element: % } }
//              – velitelský bonus v % všem monstrům v partě, dokud je předmět nasazený
//   reinforce: { reinforce: true, bonus, resist, elementDamage, battles } – výztuha na počet soubojů (jedna aktivní)
//   tool:      { tool: 'popis' } – nástroj Těžby / Rybolovu / Sběru bylin (účinek řeší jejich systém)
//   null       mezivýrobek
// Prvky: fire, water, earth, air, verdant, dark, light.

const R = (id, name, category, level, station, qty, ingredients, effect, origin = 'smith') =>
  ({ id, name, category, level, station, qty, ingredients, effect, origin, profession: 'smithing' });

// Pracoviště podle úrovně receptu (1 do 19, 2 do 44, 3 do 69, 4 od 70).
const st = (level) => (level >= 70 ? 4 : level >= 45 ? 3 : level >= 20 ? 2 : 1);

export const SMITHING_STATIONS = {
  1: { id: 'anvil', name: 'Kovadlina' },
  2: { id: 'smithy', name: 'Kovárna' },
  3: { id: 'forge', name: 'Velká výheň' },
  4: { id: 'master', name: 'Mistrovská výheň' }
};

export const SMITHING_CATEGORIES = [
  { id: 'M', label: 'Tavení a díly' },
  { id: 'A', label: 'Zbraně' },
  { id: 'B', label: 'Zbroje a štíty' },
  { id: 'C', label: 'Nástroje' },
  { id: 'D', label: 'Výztuhy' },
  { id: 'T', label: 'Řemeslník', specialization: 'crafting' } // recepty za talenty stromu Řemesla
];
// Vzácné a kalené kusy (E01–E20) nemají vlastní kategorii: zbraně patří do Zbraní, ostatní
// do Zbrojí a štítů pod podfiltr „Vzácné a kalené“.

export const SMITHING_ORIGINS = {
  base: 'Odemkne se úrovní Kovářství',
  smith: 'Kovář (návrh)',
  found: 'Nalezený recept (návrh)',
  quest: 'Úkol (návrh)',
  talent: 'Talent stromu Řemesla (specializace Řemeslník)'
};

// Zkratky surovin (ids předmětů).
const I = {
  cu: 'sm_copper_ingot', fe: 'sm_iron_ingot', sn: 'sm_tin_ingot', bronze: 'sm_bronze_ingot', wire: 'sm_copper_wire',
  clasp: 'iron_clasp', steel: 'sm_steel', ag: 'sm_silver_ingot', au: 'sm_gold_ingot', msteel: 'sm_mountain_steel',
  bsteel: 'sm_black_steel', mith: 'sm_mithril_ingot', adam: 'sm_adamantite_ingot', ori: 'sm_orichalcum_ingot',
  star: 'sm_star_metal', dragon: 'sm_dragon_iron', fishPlate: 'sm_fish_scale_plate', coralBrace: 'sm_coral_brace',
  deepLayer: 'sm_deep_scale_layer',
  leather: 'leather', strap: 'leather_strap', wood: 'wood'
};

// ------------------------------------------------------- tavení a mezivýrobky
export const SMITHING_INTERMEDIATES = [
  R(I.cu, 'Měděný ingot', 'M', 1, 1, 1, { copper_ore: 2, coal: 1 }, null, 'base'),
  R(I.fe, 'Železný ingot', 'M', 3, 1, 1, { iron_ore: 2, coal: 1 }, null, 'base'),
  R(I.sn, 'Cínový ingot', 'M', 5, 1, 1, { tin_ore: 2, coal: 1 }, null, 'base'),
  R(I.bronze, 'Bronzový ingot', 'M', 6, 1, 2, { [I.cu]: 1, [I.sn]: 1 }, null, 'base'),
  R(I.wire, 'Měděný drát', 'M', 2, 1, 3, { [I.cu]: 1 }, null, 'base'),
  R(I.clasp, 'Železný uzávěr', 'M', 4, 1, 2, { [I.fe]: 1 }, null, 'base'),
  R(I.steel, 'Ocel', 'M', 18, 1, 1, { [I.fe]: 2, coal: 2, pyrite: 1 }, null, 'base'),
  R(I.ag, 'Stříbrný ingot', 'M', 20, 2, 1, { silver_ore: 2, coal: 1 }, null, 'base'),
  R(I.au, 'Zlatý ingot', 'M', 28, 2, 1, { gold_ore: 2, coal: 1 }, null, 'base'),
  R(I.msteel, 'Horská ocel', 'M', 32, 2, 1, { mountain_ore: 2, [I.steel]: 1, coal: 1 }, null, 'base'),
  R(I.bsteel, 'Černá ocel', 'M', 45, 3, 1, { blacksteel_ore: 2, [I.steel]: 1, coal: 2 }, null, 'base'),
  R(I.mith, 'Mithrilový ingot', 'M', 50, 3, 1, { mithril_ore: 3, coal: 1, quartz: 1 }, null, 'base'),
  R(I.adam, 'Adamantitový ingot', 'M', 72, 4, 1, { adamantite_ore: 3, coal: 2, granite: 1 }, null, 'base'),
  R(I.ori, 'Orichalkový ingot', 'M', 80, 4, 1, { orichalcum_ore: 3, crystal_flame: 1 }, null, 'base'),
  R(I.star, 'Hvězdný kov', 'M', 85, 4, 1, { star_ore: 3, astral_shard: 1 }, null, 'base'),
  R(I.dragon, 'Dračí železo', 'M', 92, 4, 1, { dragon_iron_ore: 3, obsidian: 1, mat_uhlik_ziveho_plamene: 1 }, null, 'base'),
  R(I.fishPlate, 'Rybí šupinová destička', 'M', 12, 1, 1, { tough_fish_scale: 3, [I.wire]: 1 }, null, 'base'),
  R(I.coralBrace, 'Zpevněná korálová výztuha', 'M', 28, 2, 1, { hardened_coral: 1, [I.fe]: 1 }, null, 'base'),
  R(I.deepLayer, 'Hlubinná šupinová vrstva', 'M', 60, 3, 1, { deep_magic_scale: 2, [I.mith]: 1 }, null, 'base')
];

// Výbava: slot + bonusy v %.
const g = (slot, bonus, extra = {}) => ({ slot, bonus, ...extra });
// Výztuha na počet soubojů.
const rf = (battles, bonus, extra = {}) => ({ reinforce: true, battles, bonus, ...extra });

const W = (id, name, level, ingredients, bonus, extra, origin) => R(id, name, 'A', level, st(level), 1, ingredients, g('weapon', bonus, extra), origin ?? (level <= 10 ? 'base' : 'smith'));
const A = (id, name, slot, level, ingredients, bonus, extra, origin) => R(id, name, 'B', level, st(level), 1, ingredients, g(slot, bonus, extra), origin ?? (level <= 10 ? 'base' : 'smith'));

// ------------------------------------------------------- A. Zbraně (28)
const WEAPONS = [
  W('A01', 'Měděná dýka', 1, { [I.cu]: 2, [I.strap]: 1 }, { attack: 2 }),
  W('A02', 'Bronzový meč', 6, { [I.bronze]: 3, [I.strap]: 1 }, { attack: 3 }),
  W('A03', 'Železná sekera', 8, { [I.fe]: 3, [I.wood]: 1 }, { attack: 4 }),
  W('A04', 'Železný meč', 10, { [I.fe]: 4, [I.strap]: 1 }, { attack: 4, speed: 1 }),
  W('A05', 'Lovecké kopí', 12, { [I.fe]: 3, [I.wood]: 2, mat_kanci_kel: 1 }, { attack: 3, speed: 2 }),
  W('A06', 'Kyj s železnými hroty', 14, { [I.fe]: 2, [I.wood]: 2, mat_trolli_kost: 1 }, { attack: 4, defense: 1 }),
  W('A07', 'Gobliní sekáček', 16, { [I.fe]: 3, mat_goblini_zelezny_ulomek: 2 }, { attack: 5 }, {}, 'found'),
  W('A08', 'Ocelový meč', 20, { [I.steel]: 4, [I.strap]: 1 }, { attack: 5, speed: 1 }),
  W('A09', 'Ocelová válečná sekera', 24, { [I.steel]: 5, [I.wood]: 1, [I.clasp]: 1 }, { attack: 6 }),
  W('A10', 'Stříbrná čepel', 26, { [I.steel]: 3, [I.ag]: 2 }, { attack: 5, aether: 2 }),
  W('A11', 'Kopí bouřného příboje', 30, { [I.steel]: 5, mat_bourkova_ploutev: 1, mat_vodni_esence: 1 }, { attack: 6, aether: 3 }),
  W('A12', 'Válečné kladivo z horské oceli', 34, { [I.msteel]: 4, [I.wood]: 1, mat_obrska_kost: 1 }, { attack: 7, defense: 2 }),
  W('A13', 'Wyverní kopí', 36, { [I.steel]: 4, mat_wyverni_supina: 1, mat_jedovaty_osten: 1 }, { attack: 6, speed: 3 }, {}, 'found'),
  W('A14', 'Gryfí šavle', 38, { [I.msteel]: 4, mat_dravci_spar: 2 }, { attack: 7, speed: 2 }),
  W('A15', 'Velitelův meč se zlatem', 40, { [I.msteel]: 4, [I.au]: 2, gem_ruby: 1 }, { attack: 6, aether: 3 }),
  W('A16', 'Meč z černé oceli', 46, { [I.bsteel]: 5, [I.strap]: 1 }, { attack: 9 }),
  W('A17', 'Sekera z černé oceli', 48, { [I.bsteel]: 5, mat_stare_zive_drevo: 1 }, { attack: 9, defense: 2 }),
  W('A18', 'Mithrilová čepel', 54, { [I.mith]: 4, [I.strap]: 1 }, { attack: 8, speed: 4 }),
  W('A19', 'Mithrilové kopí', 56, { [I.mith]: 4, [I.wood]: 2, mat_dravci_spar: 1 }, { attack: 8, speed: 5 }),
  W('A20', 'Kladivo kamenného strážce', 58, { [I.msteel]: 5, mat_strazcovo_zelezo: 2, crystal_stone: 1 }, { attack: 9, defense: 4 }, {}, 'found'),
  W('A21', 'Runová čepel', 60, { [I.mith]: 4, rune_stone: 2, mat_ryty_runovy_kamen: 1 }, { aether: 10 }, {}, 'found'),
  W('A22', 'Adamantitový meč', 72, { [I.adam]: 5, [I.strap]: 1, gem_diamond: 1 }, { attack: 12 }),
  W('A23', 'Adamantitová válečná sekera', 75, { [I.adam]: 6, mat_stare_zive_drevo: 1 }, { attack: 13, defense: 2 }),
  W('A24', 'Orichalková čepel', 82, { [I.ori]: 4, [I.adam]: 2, gem_ruby: 1 }, { attack: 12, aether: 5 }),
  W('A25', 'Hvězdné kopí', 86, { [I.star]: 4, [I.mith]: 2, crystal_astral: 1 }, { attack: 11, aether: 6, speed: 4 }, {}, 'found'),
  W('A26', 'Meč z dračího železa', 92, { [I.dragon]: 5, [I.ori]: 2, gem_black_diamond: 1 }, { attack: 15 }, {}, 'quest'),
  W('A27', 'Dýka černého diamantu', 93, { [I.dragon]: 3, gem_black_diamond: 1, mat_stinova_esence: 1 }, { attack: 12, speed: 6 }, {}, 'found'),
  W('A28', 'Dvojbřitá sekera z dračího železa', 95, { [I.dragon]: 6, mat_obri_kost: 1 }, { attack: 15, defense: 3 }, {}, 'quest')
];

// ------------------------------------------------------- B. Zbroje – kompletní sady podle kovu
// Každý kov má sadu 5 kusů: přilba, zbroj, holenice, boty, štít (úroveň L až L+4).
// Síla roste se stupněm kovu (p); některé kovy mají navíc vlastní zaměření.
const METAL_SETS = [
  { key: 'cu', ingot: I.cu, level: 2, p: 1, adj: ['Měděná', 'Měděné', 'Měděný'] },
  { key: 'bz', ingot: I.bronze, level: 7, p: 1.5, adj: ['Bronzová', 'Bronzové', 'Bronzový'] },
  { key: 'fe', ingot: I.fe, level: 10, p: 2, adj: ['Železná', 'Železné', 'Železný'] },
  { key: 'st', ingot: I.steel, level: 21, p: 3, adj: ['Ocelová', 'Ocelové', 'Ocelový'] },
  { key: 'ms', ingot: I.msteel, level: 34, p: 4, gen: 'z horské oceli', extra: { maxHp: 0.3 } },
  { key: 'bs', ingot: I.bsteel, level: 46, p: 5, gen: 'z černé oceli', extra: { defense: 0.15 } },
  { key: 'mi', ingot: I.mith, level: 53, p: 6, adj: ['Mithrilová', 'Mithrilové', 'Mithrilový'], extra: { speed: 0.35 } },
  { key: 'ad', ingot: I.adam, level: 72, p: 8, adj: ['Adamantitová', 'Adamantitové', 'Adamantitový'], extra: { maxHp: 0.4 } },
  { key: 'or', ingot: I.ori, level: 81, p: 9, adj: ['Orichalková', 'Orichalkové', 'Orichalkový'], extra: { aether: 0.4 } },
  { key: 'sm', ingot: I.star, level: 86, p: 9.5, gen: 'z hvězdného kovu', extra: { resolve: 0.4 }, resist: 'light' },
  { key: 'dr', ingot: I.dragon, level: 93, p: 11, gen: 'z dračího železa', extra: { maxHp: 0.4 }, resist: 'fire' }
];
// Kusy sady: rod názvu (f / pl / m), slot, posun úrovně, množství ingotů a další suroviny, bonusy (× p).
const SET_PIECES = [
  { slot: 'helmet', noun: 'přilba', g: 0, dl: 0, ingots: 3, more: { [I.leather]: 1 }, stats: { defense: 0.6, resolve: 0.6 } },
  { slot: 'boots', noun: 'boty', g: 1, dl: 1, ingots: 2, more: { [I.leather]: 2 }, stats: { speed: 0.5, defense: 0.4 } },
  { slot: 'legs', noun: 'holenice', g: 1, dl: 2, ingots: 4, more: { [I.leather]: 1 }, stats: { defense: 0.9 } },
  { slot: 'shield', noun: 'štít', g: 2, dl: 3, ingots: 4, more: { [I.wood]: 2 }, stats: { defense: 1.1, resolve: 0.5 } },
  { slot: 'armor', noun: 'zbroj', g: 0, dl: 4, ingots: 6, more: { [I.strap]: 1, [I.leather]: 1 }, stats: { defense: 1.6 } }
];
const setName = (metal, piece) => (metal.adj
  ? `${metal.adj[piece.g]} ${piece.noun}`
  : `${piece.noun.charAt(0).toUpperCase()}${piece.noun.slice(1)} ${metal.gen}`);
const ARMORS = METAL_SETS.flatMap((metal, mi) => SET_PIECES.map((piece, pi) => {
  const bonus = {};
  for (const [stat, k] of Object.entries(piece.stats)) bonus[stat] = Math.max(1, Math.round(k * metal.p));
  for (const [stat, k] of Object.entries(metal.extra ?? {})) bonus[stat] = (bonus[stat] ?? 0) + Math.max(1, Math.round(k * metal.p * (piece.slot === 'armor' ? 1.5 : 1)));
  const extra = metal.resist && (piece.slot === 'armor' || piece.slot === 'shield') ? { resist: { [metal.resist]: piece.slot === 'armor' ? 15 : 10 } } : {};
  const level = Math.min(100, metal.level + piece.dl);
  const recipe = A(`BS${String(mi * 5 + pi + 1).padStart(2, '0')}`, setName(metal, piece), piece.slot, level,
    { [metal.ingot]: piece.ingots, ...piece.more }, bonus, extra, level <= 12 ? 'base' : 'smith');
  return { ...recipe, set: metal.key, setTier: mi };
}));
export const SMITHING_SET_TIERS = METAL_SETS.length;
// Podfiltry kategorie Zbroje a štíty (okno výroby): sady podle kovu + vzácné a kalené.
const SET_LABELS = { cu: 'Měď', bz: 'Bronz', fe: 'Železo', st: 'Ocel', ms: 'Horská ocel', bs: 'Černá ocel', mi: 'Mithril', ad: 'Adamantit', or: 'Orichalk', sm: 'Hvězdný kov', dr: 'Dračí železo' };
export const SMITHING_SUBFILTERS = {
  B: [...METAL_SETS.map((m) => ({ id: m.key, label: SET_LABELS[m.key] })), { id: 'rare', label: 'Vzácné a kalené' }]
};

// Původní jednotlivé zbroje (B01–B28) jsou nahrazené sadami – ponechány jen pro přehled, ve hře se nepoužívají.
const OLD_ARMORS = [
  A('B01', 'Měděná přilba', 'helmet', 2, { [I.cu]: 2, [I.leather]: 1 }, { defense: 1, resolve: 1 }),
  A('B02', 'Železná přilba', 'helmet', 9, { [I.fe]: 3, [I.leather]: 1 }, { defense: 2, resolve: 1 }),
  A('B03', 'Železný kruhový štít', 'shield', 10, { [I.fe]: 4, [I.wood]: 2 }, { defense: 3, resolve: 1 }),
  A('B04', 'Kroužková košile', 'armor', 11, { [I.fe]: 5, [I.clasp]: 2 }, { defense: 4 }),
  A('B05', 'Železné holenice', 'legs', 12, { [I.fe]: 3, [I.leather]: 1 }, { defense: 2 }),
  A('B06', 'Okované boty', 'boots', 13, { [I.fe]: 2, [I.leather]: 2 }, { speed: 1, defense: 1 }),
  A('B07', 'Šupinová vesta z říčních ryb', 'armor', 15, { [I.fe]: 2, [I.fishPlate]: 1, [I.leather]: 2 }, { defense: 4, resolve: 2 }),
  A('B08', 'Ocelová přilba', 'helmet', 21, { [I.steel]: 3, [I.leather]: 1 }, { defense: 3, resolve: 2 }),
  A('B09', 'Ocelový kyrys', 'armor', 22, { [I.steel]: 6, [I.clasp]: 2, [I.leather]: 1 }, { defense: 6 }),
  A('B10', 'Ocelové holenice', 'legs', 23, { [I.steel]: 4 }, { defense: 3 }),
  A('B11', 'Ocelový štít', 'shield', 24, { [I.steel]: 5, [I.wood]: 1, [I.clasp]: 1 }, { defense: 4, resolve: 2 }),
  A('B12', 'Plátová zbroj přístavního strážce', 'armor', 28, { [I.steel]: 7, [I.coralBrace]: 1, [I.leather]: 2 }, { defense: 7 }),
  A('B13', 'Štít s korálovou výztuhou', 'shield', 30, { [I.steel]: 4, [I.coralBrace]: 1, mat_perletovy_ulomek_krunyre: 1 }, { defense: 5, resolve: 3 }),
  A('B14', 'Šupinová zbroj mořského hada', 'armor', 33, { [I.steel]: 6, mat_morska_supina: 3, mat_vodni_esence: 1 }, { defense: 6, resolve: 4 }),
  A('B15', 'Pancéřová šupinová zbroj', 'armor', 38, { [I.steel]: 5, armored_sea_scale: 3 }, { defense: 7, resolve: 4, maxHp: 2 }),
  A('B16', 'Přilba z horské oceli', 'helmet', 35, { [I.msteel]: 3, [I.leather]: 1 }, { defense: 4, resolve: 3 }),
  A('B17', 'Boty horského poutníka', 'boots', 36, { [I.msteel]: 2, [I.leather]: 2, mat_vetrna_kozesina: 1 }, { speed: 3, defense: 1 }),
  A('B18', 'Horský plátový kyrys', 'armor', 37, { [I.msteel]: 6, [I.clasp]: 2 }, { defense: 9 }),
  A('B19', 'Zbroj přílivového strážce', 'armor', 42, { [I.steel]: 8, deep_coral: 1, mat_morska_supina: 2 }, { defense: 8, resolve: 3 }, {}, 'found'),
  A('B20', 'Holenice z černé oceli', 'legs', 46, { [I.bsteel]: 4 }, { defense: 5 }),
  A('B21', 'Kyrys z černé oceli', 'armor', 47, { [I.bsteel]: 7, [I.clasp]: 2, [I.leather]: 1 }, { defense: 11 }),
  A('B22', 'Věžový štít z černé oceli', 'shield', 50, { [I.bsteel]: 6, mat_stare_zive_drevo: 1 }, { defense: 7, resolve: 3 }),
  A('B23', 'Mithrilová přilba', 'helmet', 53, { [I.mith]: 3 }, { defense: 3, resolve: 6 }),
  A('B24', 'Mithrilová kroužková zbroj', 'armor', 55, { [I.mith]: 6, [I.leather]: 1 }, { defense: 9, speed: 3 }),
  A('B25', 'Mithrilové boty', 'boots', 57, { [I.mith]: 3, [I.leather]: 2 }, { speed: 5 }),
  A('B26', 'Hlubinná šupinová zbroj', 'armor', 62, { [I.mith]: 6, [I.deepLayer]: 1, mat_hlubinna_esence: 1 }, { defense: 10, resolve: 7 }, {}, 'found'),
  A('B27', 'Adamantitový plátový kyrys', 'armor', 74, { [I.adam]: 8, [I.clasp]: 2 }, { defense: 15, maxHp: 4 }),
  A('B28', 'Adamantitový věžový štít', 'shield', 78, { [I.adam]: 6, gem_diamond: 1 }, { defense: 10, resolve: 5 })
];
void OLD_ARMORS;

// ------------------------------------------------------- C. Nástroje a výbava pro průzkum (20)
// Výstup = stejné předměty jako u Těžby a Rybolovu (krumpáče, nástroje, kovové části).
const T = (id, output, name, level, qty, ingredients, text, origin) =>
  ({ ...R(id, name, 'C', level, st(level), qty, ingredients, { tool: text }, origin ?? (level <= 10 ? 'base' : 'smith')), output });
const TOOLS = [
  T('C01', 'pick_basic', 'Základní důlní krumpáč', 3, 1, { [I.fe]: 2, [I.wood]: 1 }, 'Těžba: krumpáč I.'),
  // Srpy Sběru bylin (rukojeť ze dřeva nebo z Lesní pryskyřice).
  T('C02', 'herb_sickle', 'Zahradnický srp', 3, 1, { [I.fe]: 1, 'wood|herb_forest_resin': 1 }, 'Sběr bylin: srp I (běžné a neobvyklé rostliny).'),
  T('C03', 'fishing_hook', 'Rybářský hák', 5, 1, { [I.fe]: 1, [I.wire]: 1 }, 'Rybolov ve sladkých vodách.'),
  T('C04', 'tool_ore_hammer', 'Kladivo na rudu', 10, 1, { [I.fe]: 2, [I.wood]: 1, granite: 1 }, 'Rudné žíly a sloje −15 % doba těžby.'),
  T('C05', 'reinforced_fishing_hook', 'Zesílený rybářský hák', 12, 1, { [I.fe]: 2, mat_goblini_zelezny_ulomek: 1 }, 'Vzácné a vyšší úlovky ×1,25.'),
  T('C06', 'pick_iron', 'Železný krumpáč', 15, 1, { [I.fe]: 4, [I.wood]: 1, [I.strap]: 1 }, 'Těžba: krumpáč II.'),
  T('C07', 'tool_wedge', 'Těžební klín', 20, 1, { [I.steel]: 3 }, 'Rudné žíly +10 % na +1 kus.'),
  T('C08', 'tool_crystal_tongs', 'Kleště na krystaly', 25, 1, { [I.steel]: 2, [I.ag]: 1 }, 'Drahokamy a krystaly +10 % na +1 kus; nutné pro Krystalové geody.'),
  T('C09', 'pick_steel', 'Ocelový krumpáč', 30, 1, { [I.steel]: 4, [I.wood]: 1, [I.strap]: 1 }, 'Těžba: krumpáč III.'),
  T('C10', 'sea_reel', 'Mořský naviják', 30, 1, { [I.fe]: 5, mat_hlubinne_chapadlove_vlakno: 1, [I.wood]: 1 }, 'Rybolov u pobřeží a na hlubokém moři.'),
  T('C11', 'tool_chisel', 'Průzkumnický majzlík', 35, 1, { [I.msteel]: 2, quartz: 1 }, 'Vedlejší nález +5 procentních bodů.'),
  T('C12', 'tool_support', 'Důlní podpěra s kovovým hrotem', 40, 3, { [I.steel]: 1, [I.wood]: 2 }, 'Otevře Skrytou žílu (spotřební).'),
  T('C13', 'silver_herb_sickle', 'Mistrný srp', 26, 1, { [I.ag]: 2, [I.steel]: 1, 'wood|herb_forest_resin': 1 }, 'Sběr bylin: srp II (i vzácné rostliny), +15 % na +1 kus u vzácných.'),
  T('C14', 'hydra_spear', 'Rybářský bodec z hydří šupiny', 45, 1, { [I.steel]: 5, mat_hydri_supina: 1 }, 'Magické vody, vzácné úlovky ×1,25.'),
  T('C15', 'tool_drill', 'Dlouhý důlní vrták', 45, 1, { [I.bsteel]: 4, pyrite: 2, obsidian: 1 }, 'Hlubinné doly +15 % na +1 kus, relikvie ×2.'),
  T('C16', 'pick_mithril', 'Mithrilový krumpáč', 50, 1, { [I.mith]: 4, [I.steel]: 2, mat_zive_drevo: 1 }, 'Těžba: krumpáč IV.'),
  T('C17', 'tool_astral_hammer', 'Kladivo na astrální kámen', 60, 1, { [I.mith]: 3, astral_shard: 2 }, 'Runová ložiska +10 %; nutné pro Hvězdné meteority.'),
  T('C18', 'tool_safety_tongs', 'Ochranné důlní kleště', 70, 1, { [I.bsteel]: 3, [I.mith]: 1, obsidian: 1, mat_zhava_supina: 1 }, 'Nutné pro Žhavá rudná ložiska.'),
  T('C19', 'pick_adamantite', 'Adamantitový krumpáč', 72, 1, { [I.adam]: 4, [I.mith]: 2, mat_stare_zive_drevo: 1 }, 'Těžba: krumpáč V.'),
  T('C20', 'pick_dragon', 'Dračí krumpáč', 92, 1, { [I.dragon]: 4, [I.adam]: 2, mat_stare_zive_drevo: 1, mat_wyverni_supina: 1 }, 'Těžba: krumpáč VI.', 'quest'),
  // Mosaz ve hře není – čepel Sběrače je ze slitiny bronzu a mědi.
  T('C21', 'brass_herb_gatherer', 'Sběrač bylin s mosaznou čepelí', 50, 1, { [I.bronze]: 2, [I.cu]: 1, [I.steel]: 1, [I.strap]: 1 }, 'Sběr bylin: srp III (i velmi vzácné), +20 % na +1 kus, obnova −10 %.'),
  T('C22', 'mithril_sickle', 'Mithrilový srp', 68, 1, { [I.mith]: 2, [I.steel]: 1, 'wood|herb_forest_resin': 1 }, 'Sběr bylin: srp IV (i magické), vzácné nálezy +3 b., sběr −15 %.'),
  T('C23', 'star_sickle', 'Hvězdný srp', 88, 1, { [I.star]: 2, [I.mith]: 1, 'wood|herb_forest_resin': 1 }, 'Sběr bylin: srp V (i legendární), speciální nález 15 %.')
];

// ------------------------------------------------------- D. Opravy, vylepšení a výztuhy (16)
const D = (id, name, level, qty, ingredients, effect, origin) => R(id, name, 'D', level, st(level), qty, ingredients, effect, origin ?? (level <= 10 ? 'base' : 'smith'));
const REINFORCEMENTS = [
  D('D01', 'Brousek', 1, 3, { granite: 1, quartz: 1 }, rf(5, { attack: 3 })),
  D('D02', 'Kovářské nýty a záplaty', 6, 2, { [I.fe]: 1, [I.leather]: 1 }, rf(5, { defense: 3 })),
  D('D03', 'Rybí šupinové záplaty', 14, 2, { [I.fishPlate]: 1, [I.clasp]: 1 }, rf(6, { defense: 4, resolve: 2 })),
  D('D04', 'Zpevnění živým dřevem', 22, 2, { mat_zive_drevo: 1, [I.steel]: 1 }, rf(6, { defense: 5, maxHp: 2 })),
  D('D05', 'Ochranná destička z krunýře', 26, 2, { mat_perletovy_ulomek_krunyre: 1, [I.steel]: 1 }, rf(8, { defense: 6 })),
  D('D06', 'Chitinová výztuha', 30, 2, { mat_jeskynni_chitin: 2, [I.steel]: 1 }, rf(8, { defense: 5, resolve: 3 })),
  D('D07', 'Korálové pancéřování', 34, 2, { [I.coralBrace]: 1, [I.clasp]: 1 }, rf(8, { defense: 5 }, { resist: { water: 10 } })),
  D('D08', 'Kostěná výztuha obrů', 38, 2, { mat_obrska_kost: 1, [I.msteel]: 1 }, rf(8, { maxHp: 5, defense: 3 })),
  D('D09', 'Ohnivé kalení', 50, 2, { alch_L078: 1, [I.steel]: 1 }, rf(8, { attack: 5 }, { elementDamage: { fire: 10 } })),
  D('D10', 'Ledové kalení', 52, 2, { alch_L079: 1, [I.steel]: 1 }, rf(8, { attack: 5 }, { elementDamage: { water: 10 } })),
  D('D11', 'Bleskové kalení', 54, 2, { alch_L080: 1, [I.steel]: 1 }, rf(8, { attack: 5 }, { elementDamage: { air: 10 } })),
  D('D12', 'Pancéřování z hlubinných šupin', 60, 2, { [I.deepLayer]: 1, [I.mith]: 1 }, rf(10, { defense: 8, resolve: 6 })),
  D('D13', 'Runové rytí', 64, 2, { rune_stone: 2, [I.mith]: 1 }, rf(10, { aether: 8 }), 'found'),
  D('D14', 'Dračí výztuha', 80, 2, { mat_wyverni_supina: 2, [I.adam]: 1 }, rf(10, { defense: 10 }, { resist: { fire: 15 } })),
  D('D15', 'Víceelementové runy', 85, 2, { alch_L086: 1, rune_stone: 2, [I.star]: 1 },
    rf(10, {}, { resist: { fire: 12, water: 12, earth: 12, air: 12, verdant: 12, dark: 12, light: 12 } }), 'found'),
  D('D16', 'Legendární zakalení', 95, 1, { meteor_core_fragment: 1, [I.dragon]: 1, mat_duchovni_esence: 1 }, rf(12, { attack: 10, aether: 10 }), 'quest')
];

// ------------------------------------------------------- E. Vzácné a elementálně kalené (20)
const E = (id, name, slot, level, ingredients, bonus, extra, origin = 'found') => ({
  ...R(id, name, slot === 'weapon' ? 'A' : 'B', level, st(level), 1, ingredients, g(slot, bonus, extra), origin),
  ...(slot === 'weapon' ? {} : { set: 'rare' })
});
const RARE = [
  E('E01', 'Plamenná čepel', 'weapon', 44, { [I.steel]: 4, al_fire_concentrate: 1, mat_zhava_supina: 1 }, { attack: 7 }, { elementDamage: { fire: 15 } }),
  E('E02', 'Mrazivé kopí', 'weapon', 52, { [I.msteel]: 4, al_water_concentrate: 1, mat_krystal_namrazy: 1 }, { attack: 8 }, { elementDamage: { water: 15 } }),
  E('E03', 'Kladivo země', 'weapon', 56, { [I.msteel]: 5, crystal_stone: 1, mat_kamenna_esence: 1 }, { attack: 9 }, { elementDamage: { earth: 15 } }),
  E('E04', 'Plamenný kyrys', 'armor', 58, { [I.bsteel]: 6, crystal_flame: 1, mat_pekelna_kuze: 2 }, { defense: 9 }, { resist: { fire: 20 } }),
  E('E05', 'Verdantská sekera', 'weapon', 58, { [I.mith]: 4, crystal_verdant: 1, mat_prastara_miza: 1 }, { attack: 8, maxHp: 3 }, { elementDamage: { verdant: 15 } }),
  E('E06', 'Zbroj přílivu', 'armor', 60, { [I.mith]: 6, crystal_water: 1, armored_sea_scale: 2 }, { defense: 9, resolve: 3 }, { resist: { water: 20 } }),
  E('E07', 'Štít kamenné hory', 'shield', 62, { [I.bsteel]: 5, crystal_stone: 1, mat_kamenne_jadro: 1 }, { defense: 9 }, { resist: { earth: 20 } }),
  E('E08', 'Bouřková šavle', 'weapon', 64, { [I.mith]: 4, crystal_air: 1, mat_bourkova_esence: 1 }, { attack: 8, speed: 4 }, { elementDamage: { air: 15 } }),
  E('E09', 'Boty větrného běžce', 'boots', 66, { [I.mith]: 3, crystal_air: 1, mat_zephyrova_kozesina: 2 }, { speed: 8 }, { resist: { air: 15 } }),
  E('E10', 'Zbroj živého hvozdu', 'armor', 68, { [I.mith]: 6, crystal_verdant: 1, mat_kurova_supina: 2 }, { defense: 10 }, { resist: { verdant: 20 } }),
  E('E11', 'Duchovní čepel', 'weapon', 70, { [I.mith]: 4, alch_L081: 1, mat_duchovni_esence: 2, mat_ektoplazma: 1 }, { aether: 11, resolve: 5 }),
  E('E12', 'Hlubinný trojzubec', 'weapon', 74, { [I.adam]: 4, deep_magic_scale: 2, deep_coral: 1, mat_vodni_esence: 1 }, { attack: 11 }, { elementDamage: { water: 15 } }),
  E('E13', 'Stínová dýka', 'weapon', 76, { [I.adam]: 3, crystal_shadow: 1, mat_serohedvabi: 1 }, { attack: 10, speed: 4 }, { elementDamage: { dark: 15 } }),
  E('E14', 'Zbroj nočního lovce', 'armor', 80, { [I.adam]: 6, crystal_shadow: 1, mat_kuze_lovce_noci: 2 }, { defense: 12 }, { resist: { dark: 20 } }),
  E('E15', 'Astrální meč', 'weapon', 86, { [I.star]: 4, crystal_astral: 1, mat_astralni_esence: 1 }, { aether: 14 }, { elementDamage: { light: 15 } }),
  E('E16', 'Hvězdná přilba', 'helmet', 87, { [I.star]: 3, crystal_astral: 1 }, { resolve: 10 }, { resist: { light: 20 } }),
  E('E17', 'Orichalková zbroj slunce', 'armor', 88, { [I.ori]: 7, mat_slunecni_krunyr: 1, crystal_flame: 1 }, { defense: 14 }, { resist: { light: 15 } }),
  E('E18', 'Dračí šupinová zbroj', 'armor', 93, { [I.dragon]: 6, mat_wyverni_supina: 3, mat_supina_ignarotha: 1 }, { defense: 16, maxHp: 5 }, { resist: { fire: 25 } }, 'quest'),
  E('E19', 'Dračí štít', 'shield', 96, { [I.dragon]: 5, mat_srdce_vecneho_ledu: 1, gem_diamond: 1 }, { defense: 12, resolve: 8 }, { resist: { water: 20 } }, 'quest'),
  E('E20', 'Čepel prvotního plamene', 'weapon', 100, { [I.dragon]: 5, mat_prvotni_draci_plamen: 1, meteor_core_fragment: 1, gem_black_diamond: 1 }, { attack: 18 }, { elementDamage: { fire: 20 } }, 'quest')
];

// ------------------------------------------------------- T. Řemeslník (recepty za talenty)
// Jen pro specializaci Řemeslník: odemyká je hodnost talentu (talent: { id, rank }) nebo
// dokončený strom (talent: { final }). Suroviny = vzácná kořist z Greenvale.
const TR = (id, name, slot, level, ingredients, bonus, talent, rarity = 'rare') =>
  ({ ...R(id, name, 'T', level, st(level), 1, ingredients, g(slot, bonus), 'talent'), talent, rarity });
const TALENT_RECIPES = [
  // Kovářský mistr – kovová výbava na 1., 3. a 5. hodnosti
  TR('T01', 'Gobliní lovecký nůž', 'weapon', 3, { [I.cu]: 2, mat_zcizena_kovova_soucastka: 2 }, { attack: 3, speed: 1 }, { id: 'master_smith', rank: 1 }, 'uncommon'),
  TR('T02', 'Orčí kroužková košile', 'armor', 7, { [I.cu]: 3, mat_orci_zelezny_ulomek: 2, [I.strap]: 1 }, { defense: 4, maxHp: 2 }, { id: 'master_smith', rank: 3 }),
  TR('T03', 'Štít orčího bojovníka', 'shield', 10, { [I.bronze]: 3, mat_orci_kovovy_zeton: 2, mat_bojovnikuv_kozeny_remen: 1 }, { defense: 4, resolve: 2 }, { id: 'master_smith', rank: 5 }),
  // Mistrovská výroba – vyšší kovové kusy na 1. a 5. hodnosti (3. hodnost = Řemeslnictví)
  TR('T04', 'Meč z vlčích tesáků', 'weapon', 8, { [I.bronze]: 3, mat_vlci_tesak: 2, [I.strap]: 1 }, { attack: 5, speed: 1 }, { id: 'masterwork', rank: 1 }),
  TR('T05', 'Sekera orčího válečníka', 'weapon', 10, { [I.fe]: 3, mat_orci_zelezny_ulomek: 3, mat_bojovnikuv_kozeny_remen: 1 }, { attack: 7 }, { id: 'masterwork', rank: 5 }, 'epic')
];

// Štěstí (ploché body hrdiny) u pár vzácných kousků.
for (const [id, extra] of [['E13', { luck: 2 }], ['T05', { luck: 1 }]]) {
  const r = [...RARE, ...TALENT_RECIPES].find((t) => t.id === id);
  const bonus = r?.effect?.bonus ?? r?.bonus;
  if (bonus) Object.assign(bonus, extra);
}

export const SMITHING_RECIPES = [...WEAPONS, ...ARMORS, ...TOOLS, ...REINFORCEMENTS, ...RARE, ...TALENT_RECIPES];
export const ALL_SMITHING = [...SMITHING_INTERMEDIATES, ...SMITHING_RECIPES];
export const SMITHING_BY_ID = Object.fromEntries(ALL_SMITHING.map((r) => [r.id, r]));

// Výstupní předmět: mezivýrobek = jeho id, nástroj = existující předmět, jinak smith_Xnn.
export const smithingOutputId = (recipe) =>
  recipe.category === 'M' ? recipe.id : recipe.output ?? `smith_${recipe.id}`;
export const SMITHING_BY_OUTPUT = Object.fromEntries(ALL_SMITHING.map((r) => [smithingOutputId(r), r]));

export const smithingXp = (recipe) => Math.round((8 + 1.5 * recipe.level) * (recipe.category === 'M' ? 0.5 : 1));

export const SLOT_LABELS = { weapon: 'Zbraň', shield: 'Štít', helmet: 'Přilba', armor: 'Zbroj', legs: 'Holenice', boots: 'Boty' };
export const GEAR_STAT_LABELS = {
  attack: 'Fyzický útok', aether: 'Magický útok', defense: 'Obrana', resolve: 'Magická odolnost', speed: 'Rychlost', maxHp: 'Max. HP'
};
export const ELEMENT_NAMES = { fire: 'oheň', water: 'voda', earth: 'země', air: 'vzduch', verdant: 'příroda', dark: 'temnota', light: 'světlo' };
const ELEMENT_ATTACK = { fire: 'ohnivé', water: 'vodní', earth: 'zemní', air: 'vzdušné', verdant: 'přírodní', dark: 'temné', light: 'světelné' };

// Čitelný popis bonusů (výbava, výztuha).
export function describeGearBonus(e) {
  const parts = Object.entries(monsterBonus(e.bonus)).map(([stat, v]) => statPart(GEAR_STAT_LABELS, stat, v));
  const resist = Object.entries(e.resist ?? {});
  if (resist.length >= 7) parts.push(`odolnost všem elementům +${resist[0][1]} %`);
  else for (const [el, v] of resist) parts.push(`odolnost ${ELEMENT_NAMES[el]} +${v} %`);
  for (const [el, v] of Object.entries(e.elementDamage ?? {})) parts.push(`${ELEMENT_ATTACK[el]} útoky +${v} %`);
  return parts.join(', ');
}

export function describeSmithing(e) {
  if (!e) return 'Mezivýrobek pro další recepty.';
  if (e.tool) return `Nástroj: ${e.tool}`;
  if (e.reinforce) return `Výztuha (${e.battles} soubojů): ${describeGearBonus(e)} všem monstrům v partě.`;
  return `${SLOT_LABELS[e.slot]}: ${describeGearBonus(e)} všem monstrům v partě (velitelský bonus).${heroStatSuffix(e.bonus)}`;
}
