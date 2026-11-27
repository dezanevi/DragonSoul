// Nově odemčené recepty: když nová úroveň výrobní dovednosti (Vaření, Alchymie, Kovářství,
// Řemeslnictví) zpřístupní recepty, označí se zlatou hvězdičkou (karta Dovednosti → Recepty
// a okna výroby), dokud přes ně hráč nepřejede myší.
//
// Stav: state.newRecipes = { 'smithing:T01': true, … } (klíč profese:id – id se mezi profesemi opakují)
import { RECIPE_BOOKS } from './ProfessionDatabase.js';
import { onSkillXp } from './SkillXpEvents.js';

export const recipeKey = (prof, id) => `${prof}:${id}`;

// Naučené recepty s úrovní v nově dosaženém rozsahu (from, to].
export function unlockedRecipes(state, prof, from, to) {
  const book = RECIPE_BOOKS[prof];
  if (!book || !state || to <= from) return [];
  return book.all.filter((r) => r.level > from && r.level <= to && book.known(state, r));
}

export const isNewRecipe = (state, prof, id) => Boolean(state?.newRecipes?.[recipeKey(prof, id)]);

// Hráč recept viděl (najel na něj myší) – hvězdička zmizí. Vrací true, když byl nový.
export function seeRecipe(state, prof, id) {
  const key = recipeKey(prof, id);
  if (!state?.newRecipes?.[key]) return false;
  delete state.newRecipes[key];
  return true;
}

// Nová úroveň → označit odemčené recepty (běží před vyskakovacím oknem, to si vezme event.unlocked).
onSkillXp((event) => {
  const list = unlockedRecipes(event.state, event.prof, event.before.level, event.after.level);
  event.unlocked = list.length;
  if (!list.length) return;
  event.state.newRecipes ??= {};
  for (const r of list) event.state.newRecipes[recipeKey(event.prof, r.id)] = true;
});

// Počet nových (nevyzkoumaných) receptů profese; category = jen recepty té podskupiny.
export function newRecipeCount(state, prof, category = null) {
  const book = RECIPE_BOOKS[prof];
  if (!book || !state?.newRecipes) return 0;
  const prefix = `${prof}:`;
  let count = 0;
  for (const key of Object.keys(state.newRecipes)) {
    if (!key.startsWith(prefix)) continue;
    if (!category) { count += 1; continue; }
    const id = key.slice(prefix.length);
    if (book.all.some((r) => r.id === id && r.category === category)) count += 1;
  }
  return count;
}
