// Den a noc: herní čas běží jen při hraní (svět a interiéry, ne v kartách, pauze a souboji).
// 1 minuta hraní = 1 herní hodina → celý den trvá 24 minut:
//   úsvit 05:00–07:00 (světlá), den 07:00–21:00, soumrak 21:00–23:00 (tmavne), noc 23:00–05:00.
// Den = 05:00–23:00 (18 minut hraní), noc = 23:00–05:00 (6 minut hraní).
// Stav: state.time = { day: 1…, minute: 0…1439 } (minuty od půlnoci). Nová hra začíná úsvitem.

export const MINUTES_PER_DAY = 24 * 60;
export const REAL_MS_PER_GAME_MINUTE = 1000; // 60 s hraní = 1 herní hodina
export const DAWN = 5 * 60;      // 05:00 – začátek dne (nová hra, ráno v hostinci)
export const DAY_FULL = 7 * 60;  // 07:00 – plné světlo
export const DUSK = 21 * 60;     // 21:00 – začíná se stmívat
export const NIGHT = 23 * 60;    // 23:00 – noc

export function normalizeTime(state) {
  const t = state.time;
  if (!t || typeof t !== 'object') {
    state.time = { day: 1, minute: DAWN };
  } else {
    t.day = Math.max(1, Math.floor(Number(t.day) || 1));
    t.minute = ((Number(t.minute) || 0) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  }
  return state.time;
}

// Posun času o ms hraní. Vrací true, když se změnila celá herní minuta (pro hodiny v HUD).
export function tickTime(state, deltaMs) {
  const t = normalizeTime(state);
  const before = Math.floor(t.minute);
  advanceMinutes(state, Math.min(deltaMs, 250) / REAL_MS_PER_GAME_MINUTE);
  return Math.floor(state.time.minute) !== before;
}

export function advanceMinutes(state, minutes) {
  const t = normalizeTime(state);
  let m = t.minute + minutes;
  while (m >= MINUTES_PER_DAY) { m -= MINUTES_PER_DAY; t.day += 1; }
  t.minute = m;
}

// Přeskočí na nejbližší úsvit (05:00) – přenocování.
export function sleepUntilDawn(state) {
  const t = normalizeTime(state);
  if (t.minute >= DAWN) t.day += 1;
  t.minute = DAWN;
}

// Noc pro hostinec: od 20:00 do 05:00 se přenocovává, jinak se odpočívá.
export function isSleepTime(state) {
  const m = normalizeTime(state).minute;
  return m >= 20 * 60 || m < DAWN;
}

export function timePhase(state) {
  const m = normalizeTime(state).minute;
  if (m >= DAWN && m < DAY_FULL) return { id: 'dawn', name: 'Úsvit' };
  if (m >= DAY_FULL && m < DUSK) return { id: 'day', name: 'Den' };
  if (m >= DUSK && m < NIGHT) return { id: 'dusk', name: 'Soumrak' };
  return { id: 'night', name: 'Noc' };
}

// Tma 0 (den) … 1 (noc), plynule přes úsvit a soumrak.
// Rozednívá se už od 04:00 (v 05:00 je šero 0,6), plný den v 07:00.
const DAWN_GLOW = 0.6;
export function darkness(state) {
  const m = normalizeTime(state).minute;
  if (m >= DAY_FULL && m < DUSK) return 0;
  if (m >= DAWN && m < DAY_FULL) return DAWN_GLOW * (1 - (m - DAWN) / (DAY_FULL - DAWN));
  if (m >= DUSK && m < NIGHT) return (m - DUSK) / (NIGHT - DUSK);
  if (m >= DAWN - 60 && m < DAWN) return 1 - (1 - DAWN_GLOW) * (m - (DAWN - 60)) / 60;
  return 1;
}

export function clockText(state) {
  const t = normalizeTime(state);
  const m = Math.floor(t.minute);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// „Den 3 · 21:40 · Soumrak“
export function dayClockLabel(state) {
  return `Den ${normalizeTime(state).day} · ${clockText(state)} · ${timePhase(state).name}`;
}

// Doba v herním čase (1 s hraní = 1 herní minuta): „40 min“, „11 h 20 min“, „1 den 12 h“.
// Pro odpočty obnovy nalezišť a podobně (skutečné ms → herní čas).
export function formatGameDuration(realMs) {
  const total = Math.max(1, Math.ceil(realMs / REAL_MS_PER_GAME_MINUTE));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours < 24) return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  const dayWord = days === 1 ? 'den' : days < 5 ? 'dny' : 'dní';
  return restHours ? `${days} ${dayWord} ${restHours} h` : `${days} ${dayWord}`;
}
