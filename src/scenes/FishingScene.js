import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getItem } from '../data/items.js';
import { BAITS, RARITY } from '../data/fishing.js';
import { getItemCount } from '../systems/InventorySystem.js';
import {
  normalizeFishing, locationById, checkLocation, bestRod, bestMetal, waitSeconds, catchTable, completeCast, strikeWindow, missCast
} from '../systems/FishingSystem.js';
import { CARD_GOLD, cardText, cardButton, uiWindow, uiTitle, uiProgressBar } from '../ui/fantasyCard.js';
import { openLoot } from './LootScene.js';

// Panel rybolovu u rybářského místa (E u vody). Nahodit → čekání podle úrovně (3–10 s až 1–3 s)
// → Záběr! (splávek se potopí) → do 1,2–1,8 s zaseknout (mezerník / E / tlačítko) → úlovek v okně
// kořisti. Zaseknutí moc brzy nebo pozdě = nic se nechytí a návnada je pryč.
// ESC nebo Zavřít rybolov ukončí; přerušené čekání návnadu nespotřebuje.

const W = 980;
const H = 700;
const X = GAME_WIDTH / 2 - W / 2;
const Y = GAME_HEIGHT / 2 - H / 2;
const BAIT_TEXT_W = 300; // šířka názvu návnady mezi šipkami

export default class FishingScene extends Phaser.Scene {
  constructor() {
    super('Fishing');
  }

  create(data) {
    this.state = data.state;
    this.returnScene = data.returnScene ?? 'World';
    this.location = locationById(data.locationId);
    this.closing = false;
    this.waiting = null;
    normalizeFishing(this.state);
    if (!this.location) {
      this.close();
      return;
    }

    uiWindow(this, X, Y, W, H, { shade: 0.45 });

    const loc = this.location;
    uiTitle(this, X + 36, Y + 24, loc.name, { icon: 'fishing_rod', size: 36 });
    cardText(this, X + 36, Y + 72, `${loc.region} · ${loc.water} · Rybolov od úrovně ${loc.minLevel}`, { size: 19, color: '#9fc4e6' });
    this.levelText = cardText(this, X + W - 36, Y + 30, '', { size: 20, color: '#cfe2f5', originX: 1 });
    this.gearText = cardText(this, X + 36, Y + 116, '', { size: 19, color: '#f3e4bd', lineSpacing: 6 });

    // Návnada: šipky / klávesy ← →.
    this.baitIndex = 0;
    cardText(this, X + 36, Y + 192, 'Návnada:', { size: 20, bold: true });
    // Název návnady mezi šipkami (šířka BAIT_TEXT_W, delší název se zmenší, aby nezalezl pod šipky).
    this.baitText = cardText(this, X + 200 + BAIT_TEXT_W / 2, Y + 202, '', { size: 20, color: '#ffd76a', originX: 0.5, originY: 0.5 });
    cardButton(this, null, X + 140, Y + 175, 54, 54, '<', () => this.cycleBait(-1), { size: 22 });
    cardButton(this, null, X + 206 + BAIT_TEXT_W, Y + 175, 54, 54, '>', () => this.cycleBait(1), { size: 22 });
    this.baitEffect = cardText(this, X + 280 + BAIT_TEXT_W, Y + 184, '', { size: 17, color: '#9fb3c8', wrap: W - 316 - BAIT_TEXT_W });

    cardText(this, X + 36, Y + 246, 'Možné úlovky (s touto návnadou a vybavením):', { size: 19, bold: true });
    this.tableLayer = this.add.container(0, 0);

    // Čekání.
    this.reasonText = cardText(this, GAME_WIDTH / 2, Y + H - 150, '', { size: 20, color: '#ff9a8a', originX: 0.5 });
    this.bar = uiProgressBar(this, GAME_WIDTH / 2 - (W - 380) / 2 - 40, Y + H - 118, W - 380, 18, 0x4fb0ff);
    this.bar.setVisible(false);
    this.waitText = cardText(this, GAME_WIDTH / 2, Y + H - 150, '', { size: 20, color: '#cfe2f5', originX: 0.5 });
    this.bobber = this.add.circle(X + W - 90, Y + H - 120, 10, 0xff5a4a).setStrokeStyle(3, 0xffffff).setVisible(false);

    this.castButton = cardButton(this, null, X + 36, Y + H - 82, 260, 58, 'Nahodit (mezerník)', () => this.action());
    cardButton(this, null, X + W - 36 - 200, Y + H - 82, 200, 58, 'Zavřít (ESC)', () => this.close(), { danger: true });

    this.onKey = (event) => {
      if (event.repeat) return;
      if (event.code === 'Escape') this.close();
      else if (event.code === 'Space' || event.code === 'KeyE') this.action();
      else if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.cycleBait(-1);
      else if (event.code === 'ArrowRight' || event.code === 'KeyD') this.cycleBait(1);
    };
    this.time.delayedCall(200, () => this.input.keyboard.on('keydown', this.onKey));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));

    this.refresh();
  }

  // Návnady, které hráč má (+ „bez návnady“).
  baitOptions() {
    return [null, ...BAITS.filter((bait) => getItemCount(this.state, bait.id) > 0).map((bait) => bait.id)];
  }

  currentBait() {
    const options = this.baitOptions();
    if (this.baitIndex >= options.length) this.baitIndex = 0;
    return options[this.baitIndex];
  }

  cycleBait(step) {
    if (this.waiting) return;
    const options = this.baitOptions();
    this.baitIndex = (this.baitIndex + step + options.length) % options.length;
    this.refresh();
  }

  refresh() {
    const prof = this.state.professions.fishing;
    this.levelText.setText(`Rybolov úr. ${prof.level}  ·  ${prof.exp} / ${prof.next} XP`);
    const rod = bestRod(this.state);
    const metal = bestMetal(this.state);
    this.gearText.setText(`Prut: ${rod?.name ?? '— chybí —'}\nKovová část: ${metal?.name ?? '— chybí —'}`);

    const baitId = this.currentBait();
    const bait = BAITS.find((b) => b.id === baitId);
    this.baitText.setScale(1).setText(bait ? `${bait.name} (${getItemCount(this.state, bait.id)} ks)` : 'bez návnady');
    if (this.baitText.width > BAIT_TEXT_W) this.baitText.setScale(BAIT_TEXT_W / this.baitText.width);
    this.baitEffect.setText(bait?.effect?.replace(/\s*\(Řemeslnictví.*\)$/, '') ?? '');

    // Tabulka úlovků: chycené druhy jménem, nechycené jako „???“.
    this.tableLayer.removeAll(true);
    const rows = catchTable(this.state, this.location, baitId).sort((a, b) => b.percent - a.percent);
    const cols = 2;
    rows.forEach((row, index) => {
      const col = index % cols;
      const line = Math.floor(index / cols);
      const known = (this.state.fishing.log[row.id] ?? 0) > 0;
      const name = known ? (row.id === 'fish_elemental' && this.location.element ? `${row.entry.name} (${this.location.element})` : row.entry.name) : '???';
      const color = (RARITY[row.entry.rarity] ?? RARITY.common).color;
      const percent = row.percent >= 1 ? row.percent.toFixed(1) : row.percent.toFixed(2);
      this.tableLayer.add(cardText(this, X + 50 + col * 460, Y + 284 + line * 30, `${name}`, { size: 18, color }));
      this.tableLayer.add(cardText(this, X + 420 + col * 460, Y + 284 + line * 30, `${percent.replace('.', ',')} %`, { size: 18, color: '#cfd6de', originX: 1 }));
    });

    const check = checkLocation(this.state, this.location);
    this.reasonText.setText(check.ok || this.waiting ? '' : check.reason);
    this.castButton.setDisabled(!this.waiting && !check.ok);
    this.castButton.setLabel(this.waiting ? (this.waiting.bite ? 'ZASEKNOUT!' : 'Zaseknout') : this.lastCatch ? 'Nahodit znovu' : 'Nahodit (mezerník)');
  }

  // Mezerník / E / tlačítko: nahodit, nebo při čekání zaseknout.
  action() {
    if (this.closing) return;
    if (this.waiting) this.strike();
    else this.cast();
  }

  strike() {
    if (this.waiting.bite) this.land();
    else this.miss('Zasekl jsi moc brzy – ryba se lekla a návnada je pryč.');
  }

  miss(message) {
    const { baitId } = this.waiting;
    this.stopWaiting();
    missCast(this.state, baitId);
    this.lastCatch = null;
    SaveSystem.save(this.state);
    this.refresh();
    this.waitText.setColor('#ff9a8a').setText(message);
  }

  cast() {
    if (this.waiting || this.closing) return;
    if (!checkLocation(this.state, this.location).ok) return;
    const baitId = this.currentBait();
    const seconds = waitSeconds(this.state, this.location, baitId);
    this.waiting = { baitId, total: seconds * 1000, elapsed: 0, bite: false, window: strikeWindow(this.state) * 1000 };
    this.waitText.setColor('#cfe2f5');
    this.bobber.setVisible(true);
    this.bobberTween = this.tweens.add({ targets: this.bobber, y: this.bobber.y + 6, duration: 420, yoyo: true, repeat: -1 });
    this.refresh();
  }

  update(time, delta) {
    if (!this.waiting) return;
    this.waiting.elapsed += delta;
    const { elapsed, total, window } = this.waiting;
    if (elapsed < total) {
      this.bar.setVisible(true).set(Math.min(1, elapsed / total));
      this.waitText.setText('Čekáš na záběr… (zaseknout až při záběru)');
      return;
    }
    if (!this.waiting.bite) this.startBite();
    const left = total + window - elapsed;
    this.bar.set(Math.max(0, left / window));
    if (left <= 0) this.miss('Pozdě – ryba utekla i s návnadou.');
  }

  // Záběr: splávek se potopí, lišta ukazuje zbývající čas na zaseknutí.
  startBite() {
    this.waiting.bite = true;
    this.bobberTween?.stop();
    this.bobber.setY(Y + H - 120);
    this.bobberTween = this.tweens.add({ targets: this.bobber, y: this.bobber.y + 14, duration: 90, yoyo: true, repeat: -1 });
    this.waitText.setColor('#ffd76a').setText('ZÁBĚR! Zasekni (mezerník / E)');
    this.cameras.main.shake(120, 0.002);
    this.refresh();
  }

  stopWaiting() {
    this.waiting = null;
    this.bobberTween?.stop();
    this.bobber?.setVisible(false).setY(Y + H - 120);
    this.bar?.setVisible(false);
    this.waitText?.setColor('#cfe2f5').setText('');
  }

  land() {
    const { baitId } = this.waiting;
    this.stopWaiting();
    const result = completeCast(this.state, this.location, baitId);
    if (!result) {
      this.refresh();
      return;
    }
    this.lastCatch = result;
    SaveSystem.save(this.state);
    const lines = [`Rybolov: +${result.xp} XP${result.newSpecies ? '  ·  Nový druh!' : ''}`];
    if (result.levelsGained > 0) lines.push(`Rybolov postoupil na úroveň ${result.level}!`);
    if (result.qty > 1) lines.push('Rybářská trpělivost: bonusový kus!');
    openLoot(this, {
      state: this.state,
      title: 'Úlovek',
      lines,
      items: [{ id: result.entry.id, qty: result.qty, label: result.label }],
      onClose: () => {
        SaveSystem.save(this.state);
        this.input.keyboard.resetKeys();
        this.refresh();
      }
    });
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    this.stopWaiting?.();
    SaveSystem.save(this.state);
    this.scene.stop();
    this.scene.resume(this.returnScene);
  }
}
