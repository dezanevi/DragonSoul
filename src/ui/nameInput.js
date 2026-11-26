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
