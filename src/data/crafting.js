import { statPart, monsterBonus, heroStatSuffix } from './heroStatLabels.js';
// Řemeslnictví podle zadání „Řemeslnictví“ (návrh: dokument „Řemeslnictví – návrh systému“).
// Šperky, nekovové vybavení, fokusy a talismany, brašny a cestovní vybavení, Soul Crystaly.
// Kovové díly (stříbrný / zlatý ingot, drát, uzávěr…) dodává Kovářství, drahokamy a krystaly Těžba.
//
//   CRAFTING_INTERMEDIATES  M01–M10: broušení drahokamů, vyčiněná kůže, pevná šňůra, krystalové jádro
//                           (do 108 receptů se nepočítají)
//   CRAFTING_RECIPES        107 receptů (F18 Zrcadlo duše odstraněno): A amulety 22, B prsteny 22, C fokusy a talismany 20,
//                           D brašny a cestovní vybavení 19, E Soul Crystaly 5, F ostatní 20
//
// Účinek receptu (effect):
//   gear:   { slot, bonus, resist, elementDamage } – velitelský bonus v % všem monstrům v partě
//           (stejně jako výbava z Kovářství; Řemeslník ×1,2)
//   bag:    { bag: počet stránek inventáře }       – použití rozšíří inventář (trvale)
//   travel: { explore: { klíč: hodnota }, minutes | battles } – dočasný průzkumný bonus
//           (stejné klíče jako průzkumné přípravky Alchymie)
//   use:    { use: 'training' }                     – jednorázové použití mimo souboj
//   tool:   { tool: 'popis' }                       – nástroj Řemeslnictví (z inventáře)
//   crystal:{ crystal: 'basic' … 'dragonSoul' }     – Soul Crystal pro ochočení
//   null    mezivýrobek

const R = (no, id, name, category, level, station, qty, ingredients, effect, origin, extra = {}) =>
  ({ no, id, name, category, level, station, qty, ingredients, effect, origin: origin ?? (level <= 10 ? 'base' : 'crafter'), profession: 'crafting', ...extra });

// Pracoviště (nejsou to stupně – recept jde vyrobit jen na svém pracovišti).
export const CRAFTING_STATIONS = {
  1: { id: 'leather', name: 'Koželužský stůl' },
  2: { id: 'jeweler', name: 'Šperkařský stůl' },
  3: { id: 'soul', name: 'Soul Crystal Workbench' }
};
const LEATHER = 1;
const JEWELER = 2;
const SOUL = 3;

export const CRAFTING_CATEGORIES = [
  { id: 'M', label: 'Broušení a díly' },
  { id: 'A', label: 'Amulety' },
  { id: 'B', label: 'Prsteny' },
  { id: 'C', label: 'Fokusy a talismany' },
  { id: 'D', label: 'Brašny a cesty' },
  { id: 'E', label: 'Soul Crystaly' },
  { id: 'F', label: 'Ostatní' },
  { id: 'T', label: 'Řemeslník', specialization: 'crafting' } // recepty za talenty stromu Řemesla
];

export const CRAFTING_ORIGINS = {
  base: 'Odemkne se úrovní Řemeslnictví',
  crafter: 'Řemeslnice (návrh)',
  found: 'Nalezený recept (návrh)',
  quest: 'Úkol (návrh)',
  talent: 'Talent stromu Řemesla (specializace Řemeslník)'
};

export const CRAFTING_CLASSES = [
  { id: 'I', name: 'Začátečník', from: 1 },
  { id: 'II', name: 'Učeň', from: 16 },
  { id: 'III', name: 'Řemeslník', from: 31 },
  { id: 'IV', name: 'Mistr', from: 51 },
  { id: 'V', name: 'Velmistr', from: 71 },
  { id: 'VI', name: 'Legendární řemeslník', from: 91 }
];
export const craftingClass = (level) => [...CRAFTING_CLASSES].reverse().find((c) => level >= c.from) ?? CRAFTING_CLASSES[0];

// Zkratky surovin: kovové díly z Kovářství a mezivýrobky Řemeslnictví.
const K = {
  ag: 'sm_silver_ingot', au: 'sm_gold_ingot', wire: 'sm_copper_wire', clasp: 'iron_clasp', mith: 'sm_mithril_ingot',
  adam: 'sm_adamantite_ingot', ori: 'sm_orichalcum_ingot', star: 'sm_star_metal',
  ruby: 'cr_cut_ruby', sapphire: 'cr_cut_sapphire', emerald: 'cr_cut_emerald', amethyst: 'cr_cut_amethyst',
  topaz: 'cr_cut_topaz', diamond: 'cr_cut_diamond', blackDiamond: 'cr_cut_black_diamond',
  leather: 'cr_tanned_leather', cord: 'cr_strong_cord', core: 'cr_focus_core'
};
const ESSENCE_ANY = 'mat_plamenna_esence|mat_vodni_esence|mat_kamenna_esence|mat_vzdusna_esence|mat_verdantska_esence';
const DRAGON_HEART = 'mat_prvotni_draci_plamen|mat_srdce_vecneho_ledu|mat_srdce_abyssu|mat_srdce_hvezdneho_svetla';
const DRAGON_SCALE = 'mat_supina_ignarotha|mat_supina_frostmournu|mat_supina_nythrakara|mat_supina_aureliona';

// Kůže z monster (kůže a kožešiny z dropu): kterákoli dá surovinu Kůže. Běžné jsou první,
// aby se při výrobě spotřebovaly dřív než neobvyklé.
const ANY_HIDE = 'mat_direwolfi_kozesina|mat_vetrna_kozesina|mat_zephyrova_kozesina|mat_mechem_pokryta_kozesina|mat_kometoocasa_kozesina|mat_medvedi_kuze|mat_trolli_kuze|mat_horska_trolli_kuze|mat_ogrska_kuze|mat_pekelna_kuze|mat_bahenni_uhori_kuze|mat_demonicka_kuze|mat_divoka_kuze|mat_berani_kuze|mat_trojita_psi_kuze|mat_drsna_obrska_kuze|mat_ropuchova_kuze|mat_kuze_lovce_noci';

const g = (slot, bonus, extra = {}) => ({ slot, bonus, ...extra });
const travel = (explore, time) => ({ travel: true, explore, ...time });

// --------------------------------------------------- mezivýrobky (mimo 108)
export const CRAFTING_INTERMEDIATES = [
  R(0, K.ruby, 'Broušený rubín', 'M', 14, JEWELER, 1, { gem_ruby: 1, quartz: 1 }, null, 'base'),
  R(0, K.sapphire, 'Broušený safír', 'M', 14, JEWELER, 1, { gem_sapphire: 1, quartz: 1 }, null, 'base'),
  R(0, K.emerald, 'Broušený smaragd', 'M', 14, JEWELER, 1, { gem_emerald: 1, quartz: 1 }, null, 'base'),
  R(0, K.amethyst, 'Broušený ametyst', 'M', 14, JEWELER, 1, { gem_amethyst: 1, quartz: 1 }, null, 'base'),
  R(0, K.topaz, 'Broušený topaz', 'M', 14, JEWELER, 1, { gem_topaz: 1, quartz: 1 }, null, 'base'),
  R(0, K.diamond, 'Broušený diamant', 'M', 50, JEWELER, 1, { gem_diamond: 1, quartz: 2 }, null, 'base'),
  R(0, K.blackDiamond, 'Broušený černý diamant', 'M', 80, JEWELER, 1, { gem_black_diamond: 1, quartz: 2, mat_stinovy_prach: 1 }, null, 'base'),
  R(0, 'cr_hide_to_leather', 'Kůže (z kůže monstra)', 'M', 1, LEATHER, 1, { [ANY_HIDE]: 1 }, null, 'base', { output: 'leather' }),
  R(0, K.leather, 'Vyčiněná kůže', 'M', 1, LEATHER, 2, { leather: 2, salt: 1 }, null, 'base'),
  R(0, 'cr_leather_to_strap', 'Kožený řemínek', 'M', 1, LEATHER, 2, { leather: 1 }, null, 'base', { output: 'leather_strap' }),
  R(0, K.cord, 'Pevná šňůra', 'M', 1, LEATHER, 2, { fiber: 2, wax: 1 }, null, 'base'),
  R(0, K.core, 'Krystalové jádro fokusu', 'M', 6, JEWELER, 1, { mat_kristalovy_strep: 2, 'mat_vilovy_prach|mat_arkanni_prach': 1 }, null, 'base')
];

// --------------------------------------------------- A. Amulety a náhrdelníky (22)
const AMULETS = [
  R(1, 'A01', 'Amulet z vlčího tesáku', 'A', 1, JEWELER, 1, { [K.cord]: 1, 'mat_goblini_zub|mat_vlci_tesak': 1 }, g('amulet', { attack: 2 })),
  R(2, 'A02', 'Amulet poutníka', 'A', 4, JEWELER, 1, { [K.cord]: 1, wood: 1, wayfarer_thyme: 1 }, g('amulet', { speed: 2 }), null, { output: 'pilgrim_amulet' }),
  R(3, 'A03', 'Amulet soustředění', 'A', 6, JEWELER, 1, { [K.cord]: 1, mat_kristalovy_strep: 1, blue_herbs: 1 }, g('amulet', { aether: 2 }), null, { output: 'focus_amulet' }),
  R(4, 'A04', 'Kostěný amulet lovce', 'A', 9, JEWELER, 1, { [K.cord]: 1, 'mat_lesni_kost|mat_obri_kost|mat_hrbitovni_kost': 2 }, g('amulet', { attack: 2, defense: 1 })),
  R(5, 'A05', 'Bylinný ochranný amulet', 'A', 12, JEWELER, 1, { [K.cord]: 1, healing_herbs: 2, mat_vilovy_prach: 1 }, g('amulet', { maxHp: 3 }, { resist: { verdant: 2 } })),
  R(6, 'A06', 'Rubínový přívěsek', 'A', 16, JEWELER, 1, { [K.wire]: 2, [K.ruby]: 1 }, g('amulet', { attack: 3 }, { elementDamage: { fire: 3 } })),
  R(7, 'A07', 'Safírový přívěsek', 'A', 18, JEWELER, 1, { [K.wire]: 2, [K.sapphire]: 1 }, g('amulet', { aether: 3 }, { elementDamage: { water: 3 } })),
  R(8, 'A08', 'Smaragdový přívěsek', 'A', 20, JEWELER, 1, { [K.wire]: 2, [K.emerald]: 1 }, g('amulet', { maxHp: 4 }, { elementDamage: { verdant: 3 } })),
  R(9, 'A09', 'Ametystový přívěsek', 'A', 22, JEWELER, 1, { [K.wire]: 2, [K.amethyst]: 1 }, g('amulet', { resolve: 4 }, { resist: { dark: 3 } })),
  R(10, 'A10', 'Topazový přívěsek', 'A', 24, JEWELER, 1, { [K.wire]: 2, [K.topaz]: 1 }, g('amulet', { speed: 3 }, { elementDamage: { air: 3 } })),
  R(11, 'A11', 'Perlový náhrdelník', 'A', 28, JEWELER, 1, { [K.ag]: 1, common_pearl: 3 }, g('amulet', { resolve: 3 }, { resist: { water: 5 } })),
  R(12, 'A12', 'Fénixův náhrdelník', 'A', 34, JEWELER, 1, { [K.au]: 1, mat_fenixovo_pirko: 2, mat_znovuzrozeny_popel: 1 }, g('amulet', { maxHp: 5 }, { resist: { fire: 6 } })),
  R(13, 'A13', 'Gryfoní amulet', 'A', 38, JEWELER, 1, { [K.ag]: 1, mat_gryfoni_pirko: 2, [K.topaz]: 1 }, g('amulet', { speed: 5, attack: 2 })),
  R(14, 'A14', 'Amulet kamenného srdce', 'A', 42, JEWELER, 1, { [K.ag]: 1, mat_kamenici_zlaza: 1, mat_tezke_kamenne_jadro: 1 }, g('amulet', { defense: 6 }, { resist: { earth: 6 } })),
  R(15, 'A15', 'Hydří amulet', 'A', 46, JEWELER, 1, { [K.ag]: 2, mat_hydri_supina: 2, mat_vicehlava_jedova_zlaza: 1 }, g('amulet', { maxHp: 6, resolve: 3 })),
  R(16, 'A16', 'Amulet měsíčního světla', 'A', 52, JEWELER, 1, { [K.au]: 2, [K.sapphire]: 1, moon_flower: 1, mat_mesicni_esence: 1 }, g('amulet', { aether: 7, resolve: 3 })),
  R(17, 'A17', 'Amulet bouřného oka', 'A', 56, JEWELER, 1, { [K.mith]: 1, crystal_air: 1, mat_bourkova_esence: 2 }, g('amulet', { speed: 6 }, { elementDamage: { air: 6 } })),
  R(18, 'A18', 'Duchovní amulet', 'A', 60, JEWELER, 1, { [K.mith]: 1, mat_duchovni_vlakno: 2, mat_ektoplazma: 2, [K.amethyst]: 1 }, g('amulet', { resolve: 8 }, { resist: { dark: 6 } })),
  R(19, 'A19', 'Amulet dračího kamene', 'A', 66, JEWELER, 1, { [K.au]: 2, [K.diamond]: 1, rune_stone: 1 }, g('amulet', { aether: 6, attack: 4 }), 'found', { output: 'dragonstone_amulet' }),
  R(20, 'A20', 'Jednorožčí náhrdelník', 'A', 74, JEWELER, 1, { [K.mith]: 2, mat_jednorozci_roh: 1, mat_cista_esence: 2, [K.diamond]: 1 }, g('amulet', { maxHp: 8, resolve: 6 }, { resist: { light: 6 } }), 'found'),
  R(21, 'A21', 'Stínový náhrdelník', 'A', 84, JEWELER, 1, { [K.adam]: 1, [K.blackDiamond]: 1, crystal_shadow: 1, shadow_lily: 1 }, g('amulet', { aether: 10 }, { elementDamage: { dark: 8 } }), 'found'),
  R(22, 'A22', 'Astrální amulet věčnosti', 'A', 95, JEWELER, 1, { [K.ori]: 2, [K.diamond]: 2, crystal_astral: 2, astral_orchid: 1, mat_srdce_hvezdneho_svetla: 1 }, g('amulet', { attack: 6, aether: 10, maxHp: 8 }), 'quest')
];

// --------------------------------------------------- B. Prsteny (22)
const RINGS = [
  R(23, 'B01', 'Měděný prsten', 'B', 1, JEWELER, 1, { [K.wire]: 1, quartz: 1 }, g('ring', { defense: 2 })),
  R(24, 'B02', 'Prsten lesního štěstí', 'B', 4, JEWELER, 1, { [K.wire]: 1, mat_vilovy_prach: 1, forest_sage: 1 }, g('ring', { speed: 2 }), null, { output: 'forest_luck_ring' }),
  R(25, 'B03', 'Prsten soustředění', 'B', 7, JEWELER, 1, { [K.wire]: 1, mat_kristalovy_strep: 1 }, g('ring', { aether: 2 }), null, { output: 'focus_ring' }),
  R(26, 'B04', 'Prsten pevné vůle', 'B', 10, JEWELER, 1, { [K.wire]: 1, quartz: 1, cleansing_herbs: 1 }, g('ring', { resolve: 3 }), null, { output: 'willpower_ring' }),
  R(27, 'B05', 'Ochranný prsten', 'B', 13, JEWELER, 1, { [K.clasp]: 1, granite: 1, mat_kamenny_strep: 1 }, g('ring', { defense: 2, resolve: 2 }), null, { output: 'protective_ring' }),
  R(28, 'B06', 'Prsten jasné mysli', 'B', 15, JEWELER, 1, { [K.ag]: 1, raw_cut_crystal: 1 }, g('ring', { aether: 3, resolve: 1 }), null, { output: 'clear_mind_ring' }),
  R(29, 'B07', 'Prsten vyjednavače', 'B', 18, JEWELER, 1, { [K.au]: 1, common_pearl: 1 }, g('ring', { resolve: 2, speed: 2 }), null, { output: 'negotiator_ring' }),
  R(30, 'B08', 'Rubínový prsten', 'B', 20, JEWELER, 1, { [K.ag]: 1, [K.ruby]: 1 }, g('ring', { attack: 4 })),
  R(31, 'B09', 'Safírový prsten', 'B', 22, JEWELER, 1, { [K.ag]: 1, [K.sapphire]: 1 }, g('ring', { aether: 4 })),
  R(32, 'B10', 'Smaragdový prsten', 'B', 24, JEWELER, 1, { [K.ag]: 1, [K.emerald]: 1 }, g('ring', { maxHp: 5 })),
  R(33, 'B11', 'Ametystový prsten', 'B', 26, JEWELER, 1, { [K.ag]: 1, [K.amethyst]: 1 }, g('ring', { resolve: 5 })),
  R(34, 'B12', 'Topazový prsten', 'B', 28, JEWELER, 1, { [K.ag]: 1, [K.topaz]: 1 }, g('ring', { speed: 4 })),
  R(35, 'B13', 'Prsten z kančího klu', 'B', 32, JEWELER, 1, { [K.ag]: 1, mat_kanci_kel: 2, mat_divoka_kuze: 1 }, g('ring', { attack: 4, defense: 2 })),
  R(36, 'B14', 'Prsten mořského příboje', 'B', 36, JEWELER, 1, { [K.ag]: 1, mat_morska_perla: 1, mat_vodni_esence: 1 }, g('ring', { resolve: 3 }, { elementDamage: { water: 5 } })),
  R(37, 'B15', 'Prsten žhavého srdce', 'B', 40, JEWELER, 1, { [K.au]: 1, [K.ruby]: 1, mat_salamandri_zarova_zlaza: 1, fire_sage: 1 }, g('ring', { attack: 4 }, { elementDamage: { fire: 6 } })),
  R(38, 'B16', 'Prsten ledového dechu', 'B', 44, JEWELER, 1, { [K.au]: 1, [K.sapphire]: 1, mat_krystal_namrazy: 1, ice_mint: 1 }, g('ring', { aether: 4 }, { resist: { fire: 6 } })),
  R(39, 'B17', 'Prsten mistra mysli', 'B', 50, JEWELER, 1, { [K.au]: 1, [K.sapphire]: 1, [K.amethyst]: 1, mat_snova_esence: 1 }, g('ring', { aether: 5, resolve: 5 })),
  R(40, 'B18', 'Prsten lovce bouří', 'B', 55, JEWELER, 1, { [K.mith]: 1, [K.topaz]: 1, mat_bleskova_zlaza: 1, storm_fern: 1 }, g('ring', { speed: 5, attack: 4 })),
  R(41, 'B19', 'Prsten věčné vitality', 'B', 62, JEWELER, 1, { [K.mith]: 1, [K.emerald]: 2, sun_thistle: 1, mat_prastara_miza: 1 }, g('ring', { maxHp: 9, defense: 3 })),
  R(42, 'B20', 'Diamantový prsten mistra', 'B', 72, JEWELER, 1, { [K.mith]: 2, [K.diamond]: 1, mat_kristalove_jadro: 1 }, g('ring', { attack: 5, aether: 5, defense: 3 }), 'found'),
  R(43, 'B21', 'Prsten noční lilie', 'B', 82, JEWELER, 1, { [K.adam]: 1, [K.blackDiamond]: 1, mat_nocni_esence: 2, shadow_lily: 1 }, g('ring', { aether: 8 }, { elementDamage: { dark: 8 }, resist: { dark: 5 } }), 'found'),
  R(44, 'B22', 'Hvězdný prsten osudu', 'B', 93, JEWELER, 1, { [K.ori]: 1, [K.star]: 1, [K.diamond]: 1, mat_hvezdny_prach: 2, meteor_core_fragment: 1 }, g('ring', { attack: 7, aether: 7, speed: 5 }), 'quest')
];

// --------------------------------------------------- C. Fokusy a talismany (20) – druhá ruka
const FOCI = [
  R(45, 'C01', 'Dřevěný talisman', 'C', 1, JEWELER, 1, { wood: 2, [K.cord]: 1 }, g('shield', { resolve: 2 })),
  R(46, 'C02', 'Kostěný totem', 'C', 5, JEWELER, 1, { 'mat_lesni_kost|mat_hrbitovni_kost|mat_obri_kost': 2, [K.cord]: 1 }, g('shield', { attack: 2, defense: 1 })),
  R(47, 'C03', 'Křišťálový fokus', 'C', 8, JEWELER, 1, { [K.core]: 1, wood: 1 }, g('shield', { aether: 3 })),
  R(48, 'C04', 'Bylinný talisman ochrany', 'C', 11, JEWELER, 1, { [K.cord]: 1, bitter_root: 1, cleansing_herbs: 1, wood: 1 }, g('shield', { resolve: 3 }, { resist: { verdant: 4 } })),
  R(49, 'C05', 'Šamanský fokus', 'C', 15, JEWELER, 1, { mat_samansky_totem: 1, [K.core]: 1 }, g('shield', { aether: 4, resolve: 1 })),
  R(50, 'C06', 'Runový talisman', 'C', 20, JEWELER, 1, { mat_ryty_runovy_kamen: 1, [K.leather]: 1 }, g('shield', { defense: 3, resolve: 3 })),
  R(51, 'C07', 'Plamenný fokus', 'C', 24, JEWELER, 1, { [K.core]: 1, mat_plamenna_esence: 2 }, g('shield', { aether: 3 }, { elementDamage: { fire: 5 } })),
  R(52, 'C08', 'Vodní fokus', 'C', 26, JEWELER, 1, { [K.core]: 1, mat_vodni_esence: 2 }, g('shield', { aether: 3 }, { elementDamage: { water: 5 } })),
  R(53, 'C09', 'Kamenný talisman', 'C', 28, JEWELER, 1, { mat_kamenna_esence: 2, mat_tezke_kamenne_jadro: 1, [K.leather]: 1 }, g('shield', { defense: 5 }, { resist: { earth: 5 } })),
  R(54, 'C10', 'Vzdušný fokus', 'C', 30, JEWELER, 1, { [K.core]: 1, mat_vzdusna_esence: 2 }, g('shield', { speed: 3 }, { elementDamage: { air: 5 } })),
  R(55, 'C11', 'Verdantský fokus', 'C', 32, JEWELER, 1, { [K.core]: 1, mat_verdantska_esence: 2, mat_zive_drevo: 1 }, g('shield', { maxHp: 3 }, { elementDamage: { verdant: 5 } })),
  R(56, 'C12', 'Talisman lovce noci', 'C', 38, JEWELER, 1, { mat_kuze_lovce_noci: 1, mat_stinovy_prach: 2, [K.amethyst]: 1 }, g('shield', { resolve: 5 }, { resist: { dark: 6 } })),
  R(57, 'C13', 'Fokus jasného světla', 'C', 42, JEWELER, 1, { [K.core]: 1, mat_svetelna_esence: 2, mat_hranolovy_strep: 1 }, g('shield', { aether: 5 }, { elementDamage: { light: 6 } })),
  R(58, 'C14', 'Elementální fokus', 'C', 50, JEWELER, 1, { [K.core]: 2, 'crystal_flame|crystal_water|crystal_stone|crystal_air|crystal_verdant': 2 }, g('shield', { aether: 7, attack: 3 })),
  R(59, 'C15', 'Talisman pevné mysli', 'C', 54, JEWELER, 1, { [K.au]: 1, [K.amethyst]: 1, mat_duchovni_esence: 2, mat_prach_z_uvazku_duse: 1 }, g('shield', { resolve: 9 })),
  R(60, 'C16', 'Křišťálová koule jasnozřivosti', 'C', 60, JEWELER, 1, { mat_kristalove_jadro: 2, [K.sapphire]: 1, mat_arkanni_prach: 2 }, g('shield', { aether: 10 })),
  R(61, 'C17', 'Stínový grimoár', 'C', 68, JEWELER, 1, { crystal_shadow: 1, mat_stinove_hedvabi: 2, [K.leather]: 2, mat_snovy_prach: 2 }, g('shield', { aether: 9 }, { elementDamage: { dark: 9 } }), 'found'),
  R(62, 'C18', 'Fokus nebeského větru', 'C', 76, JEWELER, 1, { crystal_air: 2, mat_rocari_pero: 2, mat_nebeska_supina: 1, [K.topaz]: 1 }, g('shield', { speed: 8 }, { elementDamage: { air: 8 } }), 'found'),
  R(63, 'C19', 'Runový štítový talisman', 'C', 84, JEWELER, 1, { rune_stone: 2, ancient_rune_fragment: 1, [K.mith]: 1, [K.diamond]: 1 }, g('shield', { defense: 9, resolve: 9 }), 'found'),
  R(64, 'C20', 'Astrální fokus prastarých', 'C', 94, JEWELER, 1, { crystal_astral: 2, astral_shard: 2, mat_astralni_esence: 2, astral_orchid: 1, living_mineral: 1 }, g('shield', { aether: 15, resolve: 5 }), 'quest')
];

// --------------------------------------------------- D. Brašny a cestovní vybavení (19)
const TRAVEL = [
  R(65, 'D01', 'Malá kožená brašna', 'D', 1, LEATHER, 1, { [K.leather]: 2, [K.cord]: 1 }, { bag: 2 }),
  R(66, 'D02', 'Lovecký kompas', 'D', 3, LEATHER, 1, { wood: 1, [K.wire]: 1, quartz: 1 }, travel({ move: 10 }, { minutes: 20 })),
  R(67, 'D03', 'Pochodeň s plašícím kouřem', 'D', 6, LEATHER, 2, { wood: 2, wax: 1, bitter_root: 1 }, travel({ encounters: -0.5 }, { minutes: 15 })),
  R(68, 'D04', 'Rybářský košík', 'D', 9, LEATHER, 1, { fiber: 3, wood: 1 }, travel({ fishWait: 0.85 }, { minutes: 30 })),
  R(69, 'D05', 'Lovecká brašna', 'D', 20, LEATHER, 1, { [K.leather]: 4, mat_direwolfi_kozesina: 2, [K.clasp]: 1 }, { bag: 3 }),
  R(70, 'D06', 'Vábnička z peří', 'D', 14, LEATHER, 2, { 'mat_hrebenate_pirko|mat_oblackove_pirko|mat_harpyjni_pirko': 2, [K.cord]: 1 }, travel({ encounters: 0.5 }, { minutes: 15 })),
  R(71, 'D07', 'Horolezecké lano', 'D', 18, LEATHER, 1, { [K.cord]: 3, [K.clasp]: 1 }, travel({ mineTime: 0.9 }, { minutes: 30 })),
  R(72, 'D08', 'Bylinkářská torna', 'D', 22, LEATHER, 1, { [K.leather]: 2, [K.cord]: 1, forest_sage: 1 }, travel({ herbExtra: 0.15 }, { minutes: 30 })),
  R(73, 'D09', 'Cestovní vak', 'D', 40, LEATHER, 1, { [K.leather]: 6, 'mat_medvedi_kuze|mat_trolli_kuze': 2, [K.clasp]: 2, mat_pavouci_hedvabi: 2 }, { bag: 4 }),
  R(74, 'D10', 'Krotitelská síť', 'D', 26, LEATHER, 1, { [K.cord]: 4, mat_pavouci_hedvabi: 2 }, travel({ tame: 0.08 }, { minutes: 10 })),
  R(75, 'D11', 'Kouřová bomba', 'D', 30, LEATHER, 2, { mat_sazovy_prasek: 2, sulfur: 1, [K.leather]: 1 }, travel({ escape: 1 }, { battles: 1 })),
  R(76, 'D12', 'Vak na trofeje', 'D', 34, LEATHER, 1, { [K.leather]: 3, 'mat_lesni_drap|mat_jeskynni_drap|mat_rysi_drap': 2 }, travel({ drop: 0.15 }, { minutes: 20 })),
  R(77, 'D13', 'Výpravní vak', 'D', 60, LEATHER, 1, { [K.leather]: 8, mat_kristalove_hedvabi: 2, mat_vzdusne_hedvabi: 2, [K.ag]: 1 }, { bag: 5 }, 'crafter'),
  R(78, 'D14', 'Hlubinná rybářská síť', 'D', 45, LEATHER, 1, { [K.cord]: 4, mat_hlubinne_chapadlove_vlakno: 1, mat_morska_supina: 2 }, travel({ fishDeep: 1.5 }, { minutes: 30 })),
  R(79, 'D15', 'Výcvikový deník lovce', 'D', 50, LEATHER, 1, { [K.leather]: 2, mat_arkanni_prach: 1, wax: 1 }, travel({ monsterXp: 0.1 }, { minutes: 20 })),
  R(80, 'D16', 'Proutkařský přívěsek', 'D', 55, LEATHER, 1, { [K.wire]: 2, quartz: 2, mat_vetrny_krystal: 1 }, travel({ dowsing: 1 }, { minutes: 15 })),
  R(81, 'D17', 'Bezedný vak', 'D', 85, LEATHER, 1, { [K.leather]: 10, mat_stinove_hedvabi: 3, mat_arkanni_prach: 3, mat_snova_esence: 2, [K.mith]: 1 }, { bag: 6 }, 'quest'),
  R(82, 'D18', 'Obojek důvěry', 'D', 65, LEATHER, 1, { [K.leather]: 2, [K.ag]: 1, mat_cista_esence: 1 }, travel({ bond: 2 }, { battles: 5 })),
  R(83, 'D19', 'Mistrovská sada řemeslníka', 'D', 75, LEATHER, 1, { [K.mith]: 1, [K.leather]: 2, mat_zlaty_prach: 2 }, travel({ craftXp: 0.15 }, { minutes: 30 }))
];

// --------------------------------------------------- E. Soul Crystaly (5) – řetězec 2× předchozí
export const DRAGON_CRYSTAL_STORY_ITEM = 'dragon_seal';
const CRYSTALS = [
  R(84, 'E01', 'Basic Soul Crystal', 'E', 1, SOUL, 2, { mat_kristalovy_strep: 1, fiber: 1 }, { crystal: 'basic' }, 'base', { output: 'basic_crystal' }),
  R(85, 'E02', 'Greater Soul Crystal', 'E', 16, SOUL, 1, { basic_crystal: 2, gem_amethyst: 1 }, { crystal: 'greater' }, 'base', { output: 'greater_crystal' }),
  R(86, 'E03', 'Elemental Soul Crystal', 'E', 35, SOUL, 1, { greater_crystal: 2, [ESSENCE_ANY]: 2 }, { crystal: 'elemental' }, 'base', { output: 'elemental_crystal' }),
  R(87, 'E04', 'Ancient Soul Crystal', 'E', 60, SOUL, 1, { elemental_crystal: 2, astral_shard: 1, 'mat_prastare_semeno|ancient_rune_fragment': 1 }, { crystal: 'ancient' }, 'base', { output: 'ancient_crystal' }),
  R(88, 'E05', 'Dragon Soul Crystal', 'E', 91, SOUL, 1, { ancient_crystal: 2, [DRAGON_HEART]: 1 }, { crystal: 'dragonSoul' }, 'quest',
    { output: 'dragon_crystal', story: { item: DRAGON_CRYSTAL_STORY_ITEM, text: 'Jen s Dračí pečetí (příběh).' } })
];

// --------------------------------------------------- F. Ostatní užitečné předměty (20)
const OTHER = [
  R(89, 'F01', 'Kožená čelenka lovce', 'F', 6, LEATHER, 1, { [K.leather]: 2, [K.cord]: 1 }, g('helmet', { attack: 2, aether: 1 }), null, { output: 'hunter_headband', replaceDescription: true }),
  R(90, 'F02', 'Zesílená lovecká vesta', 'F', 12, LEATHER, 1, { [K.leather]: 4, 'mat_divoka_kuze|mat_direwolfi_kozesina': 2, [K.clasp]: 1 }, g('armor', { defense: 4 }), null, { output: 'reinforced_vest', replaceDescription: true }),
  R(91, 'F03', 'Plášť horské mlhy', 'F', 28, LEATHER, 1, { [K.leather]: 2, mat_vzdusne_hedvabi: 2, mat_horska_trolli_kuze: 1 }, g('armor', { resolve: 6 }, { resist: { water: 4 } }), null, { output: 'mist_cloak', replaceDescription: true }),
  R(92, 'F04', 'Boty rychlého posla', 'F', 20, LEATHER, 1, { [K.leather]: 3, 'mat_tvrde_kopyto|mat_vetrna_kozesina': 1, wayfarer_thyme: 1 }, g('boots', { speed: 5 }), null, { output: 'courier_boots', replaceDescription: true }),
  R(93, 'F05', 'Rukavice přesného sesilatele', 'F', 35, LEATHER, 1, { [K.leather]: 2, mat_pavouci_hedvabi: 2, [K.sapphire]: 1 }, g('shield', { aether: 6 }), null, { output: 'caster_gloves', replaceDescription: true }),
  R(94, 'F06', 'Kožené holenice stopaře', 'F', 16, LEATHER, 1, { [K.leather]: 3, [K.cord]: 1 }, g('legs', { defense: 2, speed: 2 })),
  R(95, 'F07', 'Kožešinová kapuce', 'F', 24, LEATHER, 1, { mat_mechem_pokryta_kozesina: 2, [K.leather]: 1 }, g('helmet', { resolve: 3 }, { resist: { verdant: 4 } })),
  R(96, 'F08', 'Šupinová vesta', 'F', 44, LEATHER, 1, { 'mat_kurova_supina|mat_morska_supina': 4, [K.leather]: 2, [K.clasp]: 1 }, g('armor', { defense: 7 }, { resist: { water: 4 } })),
  R(97, 'F09', 'Boty z trollí kůže', 'F', 48, LEATHER, 1, { mat_horska_trolli_kuze: 2, [K.leather]: 2 }, g('boots', { maxHp: 4, defense: 3 })),
  R(98, 'F10', 'Hedvábný plášť mága', 'F', 58, LEATHER, 1, { mat_kristalove_hedvabi: 3, mat_arkanni_prach: 2, [K.amethyst]: 1 }, g('armor', { aether: 6, resolve: 6 })),
  R(99, 'F11', 'Pegasí boty', 'F', 70, LEATHER, 1, { mat_pegasi_zine: 2, mat_nebeske_pirko: 2, [K.leather]: 2 }, g('boots', { speed: 9 }), 'found'),
  R(100, 'F12', 'Čelenka hvězdného mudrce', 'F', 80, JEWELER, 1, { [K.au]: 2, [K.diamond]: 1, mat_hvezdny_prach: 2 }, g('helmet', { aether: 8, resolve: 5 }), 'found'),
  R(101, 'F13', 'Plášť stínového lovce', 'F', 88, LEATHER, 1, { mat_stinove_hedvabi: 3, mat_kuze_lovce_noci: 2, [K.blackDiamond]: 1 }, g('armor', { attack: 6, speed: 6 }, { resist: { dark: 6 } }), 'found'),
  R(102, 'F14', 'Šperkařská lupa', 'F', 10, JEWELER, 1, { [K.wire]: 1, quartz: 2, wood: 1 }, { tool: 'Broušení drahokamů: 25 % šance na +1 kus.' }),
  R(103, 'F15', 'Koželužské nože', 'F', 8, LEATHER, 1, { [K.clasp]: 1, wood: 1, granite: 1 }, { tool: 'Vyčiněná kůže: +1 kus.' }),
  R(104, 'F16', 'Výcvikové závaží', 'F', 40, LEATHER, 1, { [K.leather]: 2, granite: 3, mat_tezka_kost: 1 }, { use: 'training' }),
  R(105, 'F17', 'Rybářský talisman', 'F', 46, JEWELER, 1, { [K.cord]: 1, mat_morska_perla: 1, mat_supina_leviathana: 1 }, travel({ fishRare: 1.5 }, { minutes: 30 })),
  // F18 Zrcadlo duše (obnova použití technik) odstraněno – počet použití schopností se už neomezuje.
  R(107, 'F19', 'Lovecké chrániče předloktí', 'F', 30, LEATHER, 1, { [K.leather]: 3, mat_jeskynni_chitin: 2 }, g('shield', { attack: 3, defense: 3 })),
  R(108, 'F20', 'Plášť z dračí kůže', 'F', 96, LEATHER, 1, { [DRAGON_SCALE]: 1, [K.leather]: 4, [K.ori]: 1 }, g('armor', { defense: 8, resolve: 8, maxHp: 8 }), 'quest',
    { story: { item: DRAGON_CRYSTAL_STORY_ITEM, text: 'Jen s Dračí pečetí (příběh).' } })
];

// --------------------------------------------------- T. Řemeslník (recepty za talenty)
// Jen pro specializaci Řemeslník (talent: { id, rank } nebo { final }). Vzácná kořist z Greenvale.
const TR = (no, id, name, slot, level, station, ingredients, bonus, talent, rarity = 'rare') =>
  R(no, id, name, 'T', level, station, 1, ingredients, g(slot, bonus), 'talent', { talent, rarity });
const TALENT_RECIPES = [
  // Zručný řemeslník – nekovová výbava na 1., 3. a 5. hodnosti
  TR(201, 'T01', 'Vesta z divoké kůže', 'armor', 3, LEATHER, { mat_divoka_kuze: 2, leather: 1 }, { defense: 2, maxHp: 2 }, { id: 'skilled_crafter', rank: 1 }, 'uncommon'),
  TR(202, 'T02', 'Amulet větrného drápu', 'amulet', 6, JEWELER, { mat_vetrny_drap: 2, [K.cord]: 1 }, { speed: 3 }, { id: 'skilled_crafter', rank: 3 }),
  TR(203, 'T03', 'Boty zephyrova běhu', 'boots', 9, LEATHER, { mat_zephyrova_kozesina: 2, mat_vetrny_drap: 1, mat_bojovnikuv_kozeny_remen: 1 }, { speed: 3, defense: 1 }, { id: 'skilled_crafter', rank: 5 }),
  // Mistrovská výroba – 3. hodnost: zbroj vůdce smečky
  TR(204, 'T04', 'Zbroj vůdce smečky', 'armor', 10, LEATHER, { mat_direwolfi_kozesina: 3, mat_divoka_kuze: 2, mat_bojovnikuv_kozeny_remen: 1 }, { defense: 5, attack: 1 }, { id: 'masterwork', rank: 3 }),
  // Legendární řemeslník (dokončený strom Řemesla) – unikátní amulet ze vzácné kořisti celé oblasti
  TR(205, 'T05', 'Srdce Greenvale', 'amulet', 10, JEWELER,
    { mat_vlci_tesak: 1, mat_vetrny_drap: 1, mat_divoka_kuze: 1, mat_orci_zelezny_ulomek: 1, mat_vetrny_krystal: 1, [K.cord]: 1 },
    { attack: 3, aether: 3, defense: 3, resolve: 3, speed: 2, maxHp: 3 }, { final: 'crafting' }, 'legendary')
];

// ----------------------------------------------- Štěstí a Charisma v amuletech a prstenech
// Každý amulet a prsten má Štěstí nebo Charisma (ploché body hrdiny), škálované podle obtížnosti:
// 1 bod do úrovně 19, +1 za každých 20 úrovní (úr. 80+ = 5 bodů). Nalezené a úkolové kusy
// (těžko získatelné) mají navíc i druhou statistiku o bod nižší.
const HERO_STAT_THEME = {
  A02: 'charisma', A11: 'charisma', A13: 'luck', A16: 'luck', A20: 'luck', A22: 'luck',
  B02: 'luck', B07: 'charisma', B12: 'luck', B18: 'luck', B22: 'luck'
};
[...AMULETS, ...RINGS].forEach((r, i) => {
  const bonus = r.effect?.bonus;
  if (!bonus) return;
  const value = Math.min(5, 1 + Math.floor(r.level / 20));
  const stat = HERO_STAT_THEME[r.id] ?? (i % 2 ? 'charisma' : 'luck');
  bonus[stat] = value;
  if (r.origin === 'found' || r.origin === 'quest') bonus[stat === 'luck' ? 'charisma' : 'luck'] = Math.max(1, value - 1);
});
// Pár vzácných a těžko získatelných kusů mimo šperky (+ recepty za talenty Řemeslníka).
for (const [id, extra] of [
  ['T02', { luck: 2 }], ['T05', { luck: 3, charisma: 3 }],
  ['C20', { luck: 3 }], ['F11', { luck: 2 }], ['F12', { charisma: 3 }], ['F20', { charisma: 3, luck: 2 }]
]) {
  const r = [...TALENT_RECIPES, ...FOCI, ...OTHER].find((t) => t.id === id);
  if (r?.effect?.bonus) Object.assign(r.effect.bonus, extra);
}

export const CRAFTING_RECIPES = [...AMULETS, ...RINGS, ...FOCI, ...TRAVEL, ...CRYSTALS, ...OTHER, ...TALENT_RECIPES];
export const ALL_CRAFTING = [...CRAFTING_INTERMEDIATES, ...CRAFTING_RECIPES];
export const CRAFTING_BY_ID = Object.fromEntries(ALL_CRAFTING.map((r) => [r.id, r]));

// Výsledný předmět: mezivýrobek = id receptu, jinak `output` (existující předmět) nebo cr_<id>.
export const craftingOutputId = (recipe) => recipe.output ?? (recipe.category === 'M' ? recipe.id : `cr_${recipe.id.toLowerCase()}`);

// XP za výrobu: 10 + 3× úroveň receptu (mezivýrobky polovic).
export const craftingXp = (recipe) => Math.round((10 + 3 * recipe.level) * (recipe.category === 'M' ? 0.5 : 1));
export const xpToNextCraftingLevel = (level) => Math.round(20 * level ** 1.5);

// --------------------------------------------------- popisy
const STAT = { attack: 'Fyzický útok', aether: 'Magický útok', defense: 'Obrana', resolve: 'Magická odolnost', speed: 'Rychlost', maxHp: 'Max. HP' };
const ELEMENT = { fire: 'oheň', water: 'voda', earth: 'země', air: 'vzduch', verdant: 'příroda', dark: 'stín', light: 'světlo' };
const SLOT = { amulet: 'Amulet', ring: 'Prsten', shield: 'Druhá ruka', helmet: 'Hlava', armor: 'Tělo', legs: 'Nohy', boots: 'Boty' };
const CRYSTAL = { basic: '×1', greater: '×1,35', elemental: '×1,5', ancient: '×1,8', dragonSoul: '×2 (jen dračí monstra)' };
const EXPLORE = {
  move: (v) => `rychlost pohybu +${v} %`, encounters: (v) => `náhodná setkání ${v > 0 ? '+' : ''}${Math.round(v * 100)} %`,
  fishWait: (v) => `rybolov: čekání −${Math.round((1 - v) * 100)} %`, fishDeep: (v) => `rybolov: hlubinné úlovky ×${String(v).replace('.', ',')}`,
  fishRare: (v) => `rybolov: vzácné úlovky ×${String(v).replace('.', ',')}`, mineTime: (v) => `těžba o ${Math.round((1 - v) * 100)} % rychlejší`,
  herbExtra: (v) => `Sběr bylin: ${Math.round(v * 100)} % na +1 kus`, tame: (v) => `ochočení +${Math.round(v * 100)} %`,
  escape: () => 'útěk ze souboje vždy uspěje', drop: (v) => `drop z monster +${Math.round(v * 100)} %`,
  monsterXp: (v) => `zkušenosti monster +${Math.round(v * 100)} %`, dowsing: () => 'ukazuje připravená naleziště',
  bond: (v) => `důvěra za vítězství ×${v}`, craftXp: (v) => `zkušenosti výrobních profesí +${Math.round(v * 100)} %`
};

export function describeCraftGear(e) {
  const parts = Object.entries(monsterBonus(e.bonus)).map(([k, v]) => statPart(STAT, k, v));
  for (const [k, v] of Object.entries(e.elementDamage ?? {})) parts.push(`útoky ${ELEMENT[k]} +${v} %`);
  for (const [k, v] of Object.entries(e.resist ?? {})) parts.push(`odolnost ${ELEMENT[k]} ${v} %`);
  return parts.join(', ');
}

export function describeCrafting(e) {
  if (!e) return 'Mezivýrobek pro další recepty.';
  if (e.slot) return `${SLOT[e.slot]}: ${describeCraftGear(e)} všem monstrům v partě (velitelský bonus).${heroStatSuffix(e.bonus)}`;
  if (e.bag) return `Použij: inventář bude mít ${e.bag} stránek po 40 políčkách (trvale).`;
  if (e.travel) {
    const parts = Object.entries(e.explore).map(([k, v]) => EXPLORE[k]?.(v) ?? k);
    return `Použij mimo souboj: ${parts.join(', ')} (${e.minutes ? `${e.minutes} min` : `${e.battles} ${e.battles === 1 ? 'souboj' : 'soubojů'}`}).`;
  }
  if (e.crystal) return `Soul Crystal pro ochočení – násobitel šance ${CRYSTAL[e.crystal]}. V souboji se použije nejlepší krystal.`;
  if (e.use === 'training') return 'Použij: monstrum v partě s nejméně volnými body dostane +3 tréninkové body.';
  if (e.tool) return `Nástroj (z inventáře): ${e.tool}`;
  return '';
}
