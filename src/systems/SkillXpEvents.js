// Zisk XP v dovednostech (karta Hrdiny → Dovednosti) pro vyskakovací okno (SkillToastScene).
//
// Každá funkce add…Xp systémů dovedností si zapamatuje stav před přidáním (skillXpBefore)
// a po něm ohlásí zisk (reportSkillXp). Hromadná výroba (okno výroby) zisky sčítá:
// beginSkillXpBatch(prof) … endSkillXpBatch(prof) → jedno ohlášení se součtem až po skončení
// nebo přerušení výroby.
//
// Událost: { prof, amount, before: { level, exp, next }, after: { level, exp, next }, state }

const listeners = new Set();
const batches = new Map(); // prof → { before, amount, state }

export function onSkillXp(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const snapshot = (state, prof) => {
  const p = state?.professions?.[prof] ?? {};
  return { level: Math.max(1, Number(p.level) || 1), exp: Math.max(0, Number(p.exp) || 0), next: Math.max(1, Number(p.next) || 1) };
};

export const skillXpBefore = (state, prof) => snapshot(state, prof);

function emit(event) {
  for (const fn of listeners) {
    try { fn(event); } catch (error) { console.error(error); }
  }
}

export function reportSkillXp(state, prof, before, amount) {
  const gained = Math.round(Number(amount) || 0);
  if (gained <= 0) return;
  const batch = batches.get(prof);
  if (batch) {
    batch.before ??= before;
    batch.amount += gained;
    batch.state = state;
    return;
  }
  emit({ prof, amount: gained, before, after: snapshot(state, prof), state });
}

export function beginSkillXpBatch(prof) {
  if (!batches.has(prof)) batches.set(prof, { before: null, amount: 0, state: null });
}

export function endSkillXpBatch(prof) {
  const batch = batches.get(prof);
  batches.delete(prof);
  if (batch?.amount > 0 && batch.state) emit({ prof, amount: batch.amount, before: batch.before, after: snapshot(batch.state, prof), state: batch.state });
}
