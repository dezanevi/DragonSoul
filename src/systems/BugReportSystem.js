// ======================================================================
// Hlášení chyb (Pauza → Nahlásit chybu).
//   1. Report se vždy uloží v prohlížeči (localStorage, klíč BUG_KEY) – i na GitHub Pages.
//   2. Při vývoji (npm run dev) se navíc pošle na vývojový server (POST /__bug-report,
//      plugin ve vite.config.js), který ho zapíše do složky bug-reports/ v projektu
//      (jeden .json na report + souhrn REPORTY.md). Na GitHub Pages žádný server není –
//      odeslání tiše selže a report zůstane jen v prohlížeči (dá se stáhnout jako soubor).
// ======================================================================

const BUG_KEY = 'aurion-bug-reports';
const MAX_REPORTS = 200;

export function loadBugReports() {
  try {
    const list = JSON.parse(localStorage.getItem(BUG_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Co hráč dělal: oblast, poloha, interiér, úroveň, sledovaný úkol, prohlížeč.
export function bugContext(state) {
  const tile = (v) => (Number.isFinite(v) ? Math.floor(v / 64) : null);
  return {
    player: state?.playerName ?? '',
    level: state?.level ?? null,
    region: state?.region ?? 'Greenvale',
    position: { x: tile(state?.x), y: tile(state?.y) },
    interior: state?.interiorId ?? null,
    trackedQuest: state?.trackedQuest ?? null,
    gold: state?.gold ?? null,
    screen: `${window.innerWidth}×${window.innerHeight}`,
    userAgent: navigator.userAgent,
    url: location.href
  };
}

// Uloží report. Vrací { local: true, server: true|false }.
export async function submitBugReport(state, text) {
  const report = { id: `bug-${Date.now().toString(36)}`, createdAt: new Date().toISOString(), text: String(text).trim(), context: bugContext(state) };
  const list = loadBugReports();
  list.push(report);
  try { localStorage.setItem(BUG_KEY, JSON.stringify(list.slice(-MAX_REPORTS))); } catch { /* plné úložiště */ }
  let server = false;
  try {
    const response = await fetch('__bug-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
    server = response.ok;
  } catch { server = false; }
  return { local: true, server, report };
}

// Všechny reporty z prohlížeče jako Markdown (Stáhnout reporty).
export function bugReportsMarkdown(list = loadBugReports()) {
  const lines = ['# AURION – hlášení chyb', ''];
  for (const r of list) {
    const c = r.context ?? {};
    lines.push(`## ${new Date(r.createdAt).toLocaleString('cs-CZ')} – ${c.region ?? ''}${c.interior ? ` (${c.interior})` : ''}`, '',
      r.text, '', `- Poloha: ${c.position?.x ?? '?'}, ${c.position?.y ?? '?'} · úroveň ${c.level ?? '?'} · úkol ${c.trackedQuest ?? '–'}`,
      `- Obrazovka ${c.screen ?? '?'} · ${c.userAgent ?? ''}`, '');
  }
  return lines.join('\n');
}

export function downloadBugReports() {
  const blob = new Blob([bugReportsMarkdown()], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `aurion-bug-reporty-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
