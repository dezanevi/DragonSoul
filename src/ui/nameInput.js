import { cardText, cardButton, nineImage } from './fantasyCard.js';

// Okno pro zadání jména (pojmenování monstra, přejmenování obchodu…). Píše se na klávesnici;
// klávesy se berou přímo z prohlížeče (fronta Phaseru spojuje rychle napsané znaky v jednom
// snímku) a klávesnice scény je mezitím vypnutá, aby psaní nespouštělo zkratky karty.
//
// options:
//   title     nadpis okna
//   current   dosavadní jméno (předvyplněné, dá se smazat)
//   fallback  jméno při prázdném poli (tlačítko vpravo) – např. jméno druhu
//   fallbackLabel  popisek tlačítka vpravo (výchozí „Výchozí jméno“)
//   maxLength nejvíc znaků (výchozí 16)
//   depth     hloubka okna
//   onDone(name | null)  potvrzené jméno; null = zrušeno (Esc)
export function askName(scene, options) {
  const {
    title, current = '', fallback = '', fallbackLabel = 'Výchozí jméno', maxLength = 16, depth = 9000, onDone
  } = options;
  const keyboard = scene.input.keyboard;
  const keyboardWasEnabled = keyboard?.enabled;
  if (keyboard) keyboard.enabled = false;

  const cx = scene.scale.width / 2;
  const w = 760;
  const h = 330;
  const x = cx - w / 2;
  const y = scene.scale.height / 2 - h / 2 - 40;
  const layer = scene.add.container(0, 0).setDepth(depth);
  const shade = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x02060a, 0.5).setOrigin(0).setInteractive();
  layer.add(shade);
  const bg = nineImage(scene, 'nu-panel', x, y, w, h, 0.75);
  if (bg) layer.add(bg);
  else {
    const g = scene.add.graphics();
    g.fillStyle(0x10151a, 0.96).fillRoundedRect(x, y, w, h, 18).lineStyle(3, 0xd6a23a, 1).strokeRoundedRect(x, y, w, h, 18);
    layer.add(g);
  }
  const field = nineImage(scene, 'nu-slot', x + 70, y + 96, w - 140, 72, 0.4);
  if (field) layer.add(field);
  layer.add(cardText(scene, cx, y + 28, title, { size: 30, bold: true, color: '#ffe7ae', originX: 0.5 }));
  const text = cardText(scene, cx, y + 132, '', { size: 30, bold: true, originX: 0.5, originY: 0.5 });
  layer.add(text);
  layer.add(cardText(scene, cx, y + 188, `Piš na klávesnici · Enter = potvrdit · Esc = zrušit · nejvíc ${maxLength} znaků`, {
    size: 18, color: '#9fb3c8', originX: 0.5
  }));

  let name = String(current ?? '').slice(0, maxLength);
  let caret = true;
  let closed = false;
  const draw = () => text.setText(name ? `${name}${caret ? '|' : ' '}` : `${caret ? '|' : ' '}${fallback}`).setAlpha(name ? 1 : 0.55);
  const blink = scene.time.addEvent({ delay: 450, loop: true, callback: () => { caret = !caret; draw(); } });

  const close = (result) => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey);
    scene.events.off('shutdown', cleanup);
    blink.remove();
    layer.destroy();
    // Stejný stisk (Enter / Esc) nesmí hned spustit akci karty pod oknem.
    scene.time.delayedCall(120, () => {
      if (keyboard) { keyboard.enabled = keyboardWasEnabled ?? true; keyboard.resetKeys?.(); }
    });
    onDone?.(result);
  };
  const confirm = () => close(name.trim() || fallback || null);
  const onKey = (event) => {
    event.preventDefault?.();
    if (event.key === 'Enter') { confirm(); return; }
    if (event.key === 'Escape') { close(null); return; }
    if (event.key === 'Backspace') name = name.slice(0, -1);
    else if (event.key.length === 1 && name.length < maxLength && /[\p{L}\p{N} '.,&!-]/u.test(event.key)) name += event.key;
    draw();
  };
  window.addEventListener('keydown', onKey);
  const cleanup = () => window.removeEventListener('keydown', onKey);
  scene.events.once('shutdown', cleanup);

  const bw = 250;
  for (const o of cardButton(scene, null, x + 60, y + h - 92, bw, 60, 'Potvrdit (Enter)', confirm, { size: 22 }).objects) layer.add(o);
  if (fallback) {
    for (const o of cardButton(scene, null, x + w - 60 - bw, y + h - 92, bw, 60, fallbackLabel, () => close(fallback), { size: 22 }).objects) layer.add(o);
  }
  draw();
  return { close: () => close(null) };
}

// Ikonka přejmenování (✎) bez rámečku: jen znak, plocha pro klik 54 × 54 px, pod myší
// zezlátne. (x, y) = levý horní roh plochy. Vrací pole objektů.
export function renameIcon(scene, x, y, onClick, { size = 30, color = '#c9b98f', hover = '#ffd76a' } = {}) {
  const glyph = cardText(scene, x + 27, y + 27, '✎', { size, bold: true, color, originX: 0.5, originY: 0.5 });
  const zone = scene.add.zone(x, y, 54, 54).setOrigin(0).setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => glyph.setColor(hover));
  zone.on('pointerout', () => glyph.setColor(color));
  zone.on('pointerdown', onClick);
  return [glyph, zone];
}

// Okno pro volbu množství (Prodat X…). Číslo se píše na klávesnici nebo mění tlačítky
// −10 / −1 / +1 / +10 / Max (šipky nahoru / dolů = ±1). Výsledek je vždy 1…max.
//
// options:
//   title    nadpis okna
//   max      nejvyšší množství (≥ 1)
//   initial  předvyplněné množství (výchozí 1)
//   note(qty)  řádek pod číslem (např. „dostaneš 24 zlata“)
//   confirmLabel  popisek potvrzení (výchozí „Potvrdit (Enter)“)
//   depth    hloubka okna
//   onDone(qty | null)  zvolené množství; null = zrušeno (Esc / Zrušit)
export function askQuantity(scene, options) {
  const { title, max: maxRaw, initial = 1, note, confirmLabel = 'Potvrdit (Enter)', depth = 9000, onDone } = options;
  const max = Math.max(1, Math.floor(Number(maxRaw) || 1));
  const clamp = (n) => Math.min(max, Math.max(1, Math.floor(Number(n) || 1)));
  const keyboard = scene.input.keyboard;
  const keyboardWasEnabled = keyboard?.enabled;
  if (keyboard) keyboard.enabled = false;

  const cx = scene.scale.width / 2;
  const w = 820;
  const h = 420;
  const x = cx - w / 2;
  const y = scene.scale.height / 2 - h / 2 - 40;
  const layer = scene.add.container(0, 0).setDepth(depth);
  layer.add(scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x02060a, 0.5).setOrigin(0).setInteractive());
  const bg = nineImage(scene, 'nu-panel', x, y, w, h, 0.75);
  if (bg) layer.add(bg);
  else {
    const g = scene.add.graphics();
    g.fillStyle(0x10151a, 0.96).fillRoundedRect(x, y, w, h, 18).lineStyle(3, 0xd6a23a, 1).strokeRoundedRect(x, y, w, h, 18);
    layer.add(g);
  }
  layer.add(cardText(scene, cx, y + 28, title, { size: 30, bold: true, color: '#ffe7ae', originX: 0.5 }));
  const field = nineImage(scene, 'nu-slot', cx - 120, y + 88, 240, 72, 0.4);
  if (field) layer.add(field);
  const text = cardText(scene, cx, y + 124, '', { size: 34, bold: true, originX: 0.5, originY: 0.5 });
  const noteText = cardText(scene, cx, y + 176, '', { size: 20, color: '#ffd76a', originX: 0.5 });
  layer.add([text, noteText]);

  let qty = clamp(initial);
  let typed = ''; // rozepsané číslo z klávesnice (první číslice přepíše hodnotu)
  let closed = false;
  const draw = () => {
    text.setText(`${typed || qty} / ${max}`);
    noteText.setText(note ? note(qty) : '');
  };
  const set = (n) => { typed = ''; qty = clamp(n); draw(); };

  const close = (result) => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey);
    scene.events.off('shutdown', cleanup);
    layer.destroy();
    scene.time.delayedCall(120, () => {
      if (keyboard) { keyboard.enabled = keyboardWasEnabled ?? true; keyboard.resetKeys?.(); }
    });
    onDone?.(result);
  };
  const confirm = () => close(qty);
  const onKey = (event) => {
    event.preventDefault?.();
    if (event.key === 'Enter') { confirm(); return; }
    if (event.key === 'Escape') { close(null); return; }
    if (event.key === 'ArrowUp' || event.key === '+') { set(qty + 1); return; }
    if (event.key === 'ArrowDown' || event.key === '-') { set(qty - 1); return; }
    if (event.key === 'Backspace') {
      typed = (typed || String(qty)).slice(0, -1);
      qty = clamp(typed || 1);
    } else if (/^[0-9]$/.test(event.key)) {
      typed = `${typed}${event.key}`.replace(/^0+/, '').slice(0, 6);
      if (Number(typed) > max) typed = String(max);
      qty = clamp(typed || 1);
    }
    draw();
  };
  window.addEventListener('keydown', onKey);
  const cleanup = () => window.removeEventListener('keydown', onKey);
  scene.events.once('shutdown', cleanup);

  // Řada úprav: −10 −1 +1 +10 Max (tlačítka 54 px+, písmo 20+).
  const steps = [['−10', () => set(qty - 10)], ['−1', () => set(qty - 1)], ['+1', () => set(qty + 1)], ['+10', () => set(qty + 10)], ['Max', () => set(max)]];
  const sw = 130;
  const gap = 14;
  const sx = cx - (steps.length * sw + (steps.length - 1) * gap) / 2;
  steps.forEach(([label, fn], i) => {
    for (const o of cardButton(scene, null, sx + i * (sw + gap), y + 222, sw, 58, label, fn, { size: 22 }).objects) layer.add(o);
  });
  layer.add(cardText(scene, cx, y + 290, 'Piš číslo nebo šipky ↑ ↓ · Enter = potvrdit · Esc = zrušit', { size: 18, color: '#9fb3c8', originX: 0.5 }));

  const bw = 270;
  for (const o of cardButton(scene, null, x + 60, y + h - 92, bw, 60, confirmLabel, confirm, { size: 22 }).objects) layer.add(o);
  for (const o of cardButton(scene, null, x + w - 60 - bw, y + h - 92, bw, 60, 'Zrušit (Esc)', () => close(null), { size: 22 }).objects) layer.add(o);
  draw();
  return { close: () => close(null) };
}
