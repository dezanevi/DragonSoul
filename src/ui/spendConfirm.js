import { cardText, cardButton, coinAmount } from './fantasyCard.js';
import { goldText } from './goldText.js';

// Potvrzení útraty: před každou platbou zlatem (obchody, hostinec, dům, specializace…)
// okno „Zaplatit N zlata?“ se stavem zlata před a po. Enter = zaplatit, Esc = zrušit.
//   title     – nadpis (co se kupuje)
//   lines     – volitelné řádky popisu (např. položky nákupu)
//   cost      – kolik zlata odejde (> 0)
//   gold      – zlato před platbou (výchozí scene.state.gold)
//   income    – volitelně zlato, které zároveň přijde (prodej v košíku)
//   onConfirm / onCancel
export function confirmSpend(scene, { title: titleText, lines = [], cost, gold, income = 0, confirmLabel, onConfirm, onCancel }) {
  const before = Math.floor(Number(gold ?? scene.state?.gold) || 0);
  const after = before + income - cost;
  const W = 760;
  const cx = scene.scale.width / 2;
  const x = cx - W / 2;
  // Texty nejdřív (zalomené řádky mají různou výšku), pak okno podle nich.
  const title = cardText(scene, cx, 0, titleText ?? 'Potvrdit platbu', { size: 30, bold: true, color: '#ffe7ae', originX: 0.5, wrap: W - 80 });
  const body = lines.slice(0, 8).map((line) => cardText(scene, x + 48, 0, line, { size: 20, color: '#e8dcc0', wrap: W - 96 }));
  if (lines.length > 8) body.push(cardText(scene, x + 48, 0, `… a ${lines.length - 8} dalších`, { size: 18, color: '#9fb3c8' }));
  const bodyH = body.reduce((sum, t) => sum + t.height + 8, 0);
  const H = 64 + title.height + bodyH + 12 + (income ? 36 : 0) + 76 + 104;
  const y = scene.scale.height / 2 - H / 2;
  const layer = scene.add.container(0, 0).setDepth(9600);
  const shade = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x02060a, 0.6).setOrigin(0).setInteractive();
  const g = scene.add.graphics();
  g.fillStyle(0x0d1d33, 0.98).fillRoundedRect(x, y, W, H, 18).lineStyle(4, 0xd6a23a, 1).strokeRoundedRect(x, y, W, H, 18);
  title.setY(y + 26);
  layer.add([shade, g, title]);
  let ly = y + 26 + title.height + 22;
  for (const t of body) { layer.add(t.setY(ly)); ly += t.height + 8; }
  ly += 12;
  if (income) {
    layer.add(coinAmount(scene, x + 48, ly, `+${income} zlata`, { size: 22, bold: true, color: '#7ee08a' }, { prefix: 'Prodej:' }));
    ly += 36;
  }
  layer.add(coinAmount(scene, x + 48, ly, `${cost} zlata`, { size: 24, bold: true, color: '#ff9a8a' }, { prefix: 'Zaplatíš:' }));
  ly += 38;
  layer.add(coinAmount(scene, x + 48, ly, `${before} → ${after}`, { size: 22, bold: true, color: '#f3e4bd' }, { prefix: 'Zlato:' }));
  scene.spendConfirmOpen = true;
  layer.once('destroy', () => { scene.spendConfirmOpen = false; });

  const keyboard = scene.input.keyboard;
  let closed = false;
  const finish = (ok) => {
    if (closed) return;
    closed = true;
    layer.destroy();
    (ok ? onConfirm : onCancel)?.();
  };
  const onKey = (event) => {
    if (event.key === 'Enter') { event.preventDefault?.(); event.stopPropagation?.(); finish(true); }
    else if (event.key === 'Escape') { event.preventDefault?.(); event.stopPropagation?.(); finish(false); }
  };
  window.addEventListener('keydown', onKey, true);
  // Klávesa nesmí zároveň zavřít okno pod potvrzením: klávesnice scény chvíli nereaguje.
  if (keyboard) {
    keyboard.enabled = false;
    layer.once('destroy', () => scene.time.delayedCall(150, () => { keyboard.enabled = true; keyboard.resetKeys?.(); }));
  }
  const removeCapture = () => window.removeEventListener('keydown', onKey, true);
  scene.events.once('shutdown', removeCapture);
  layer.once('destroy', removeCapture);
  const bw = 300;
  const by = y + H - 84;
  for (const o of cardButton(scene, null, cx - bw - 12, by, bw, 62, confirmLabel ?? `Zaplatit ${goldText(cost)} (Enter)`, () => finish(true), { size: 22 }).objects) layer.add(o);
  for (const o of cardButton(scene, null, cx + 12, by, bw, 62, 'Zrušit (Esc)', () => finish(false), { size: 22, danger: true }).objects) layer.add(o);
  return { close: () => finish(false) };
}

// Platba jen když něco stojí a hráč na ni má: jinak run() rovnou (nic se neplatí,
// nebo systém sám ohlásí nedostatek zlata).
export function withSpend(scene, cost, opts, run) {
  const gold = Math.floor(Number(scene.state?.gold) || 0);
  if (!(cost > 0) || gold < cost) { run(); return; }
  confirmSpend(scene, { ...opts, cost, gold, onConfirm: run });
}
