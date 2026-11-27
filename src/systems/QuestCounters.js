// Počítadla událostí pro cíle úkolů (řemeslné linie): co hráč chytil, vytěžil, nasbíral,
// vyrobil, prodal, nasadil… Úkol si při přijetí uloží výchozí hodnotu (QuestSystem, goals),
// takže se počítá jen to, co hráč udělal po přijetí.
//
// Stav: state.questCounters = { 'fish': 12, 'mine:copper_ore': 7, 'craft:smithing:A01': 1, … }
// Modul nic neimportuje (volají ho systémy profesí i scény – bez kruhových importů).
//
// Klíče:
//   fish, fish:better (neobvyklá a lepší ryba), mine:<surovina>, herb:<rostlina>, herb:farm (statek),
//   craft:<profese>:<recept>, craft:crafting:jewel (prsten / amulet), use:<profese>:<recept>,
//   sold:<předmět>, sell:<obchod>, sell:jewel, sell:fishDemand (denní poptávka Rybáře),
//   equip (nasazená výbava), win:fed (vyhraný souboj s aktivním jídlem)

export function countQuestEvent(state, key, qty = 1) {
  const n = Number(qty) || 0;
  if (!state || !key || n <= 0) return;
  state.questCounters ??= {};
  state.questCounters[key] = (Number(state.questCounters[key]) || 0) + n;
}

export const questCounter = (state, key) => Number(state?.questCounters?.[key]) || 0;

// Prodej v obchodě (košík): sold:<id>, sell:<obchod>, u šperků sell:jewel.
export function countQuestSales(state, shop, lines, isJewel = () => false) {
  for (const { id, qty } of lines ?? []) {
    countQuestEvent(state, `sold:${id}`, qty);
    if (shop) countQuestEvent(state, `sell:${shop}`, qty);
    if (isJewel(id)) countQuestEvent(state, 'sell:jewel', qty);
  }
}
