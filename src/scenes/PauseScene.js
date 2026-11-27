import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { cardText, cardButton, uiWindow, uiTitle, nineImage, openCardModal } from '../ui/fantasyCard.js';
import { submitBugReport, bugContext, loadBugReports, downloadBugReports } from '../systems/BugReportSystem.js';

// Nabídka pauzy (Esc ve světě): Vrátit se do hry, Uložit hru, Načíst hru, Nastavení,
// Hlavní menu, Vypnout hru (Nastavení a Vypnout hru zatím nedostupné).
// Svět je během nabídky pozastavený.

const W = 560;
const H = 720;
const X = (GAME_WIDTH - W) / 2;
const Y = (GAME_HEIGHT - H) / 2;

export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(data) {
    this.state = data.state;
    this.returnScene = data.returnScene ?? 'World';
    this.closing = false;
    this.layer = null;
    this.onKey = (event) => {
      if (event.repeat || event.code !== 'Escape') return;
      if (this.modal) { this.modal.destroy(); this.modal = null; return; }
      if (this.view !== 'main') this.showMain();
      else this.resumeGame();
    };
    // Stejné stisknutí Esc, které pauzu otevřelo, ji nesmí hned zavřít.
    this.time.delayedCall(200, () => this.input.keyboard.on('keydown', this.onKey));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown', this.onKey);
      this.removeBugInput(); // pole pro text je HTML – po zavření pauzy nesmí zůstat
    });
    this.showMain();
  }

  clear() {
    this.removeBugInput();
    this.children.removeAll(true);
    this.modal = null;
  }

  // ------------------------------------------------------------ hlášení chyb
  // Okno s polem pro popis chyby (HTML textarea nad plátnem – psaní s diakritikou, více řádků).
  // K popisu se připojí poloha, oblast, úroveň a sledovaný úkol (BugReportSystem.bugContext).
  showBugReport() {
    this.clear();
    this.view = 'bug';
    const BW = 980;
    const BH = 700;
    const BX = (GAME_WIDTH - BW) / 2;
    const BY = (GAME_HEIGHT - BH) / 2;
    uiWindow(this, BX, BY, BW, BH, { shade: 0.55 });
    uiTitle(this, BX + 40, BY + 26, 'Nahlásit chybu', { icon: 'scroll', size: 36 });
    const ctx = bugContext(this.state);
    cardText(this, BX + 40, BY + 92, 'Popiš, co se stalo a co jsi čekal. Poloha a stav hry se přidají samy:', { size: 20, color: '#dbe6f3' });
    cardText(this, BX + 40, BY + 124, `${ctx.region}${ctx.interior ? ` – ${ctx.interior}` : ''} · pole ${ctx.position.x ?? '?'}, ${ctx.position.y ?? '?'} · úroveň ${ctx.level ?? '?'}`, { size: 18, color: '#9fb3c8' });
    nineImage(this, 'nu-slot', BX + 40, BY + 160, BW - 80, 330, 0.4);
    this.createBugInput(BX + 52, BY + 172, BW - 104, 306);
    const count = loadBugReports().length;
    cardText(this, BX + 40, BY + 506, `V tomto prohlížeči je uloženo hlášení: ${count}.`, { size: 18, color: '#9fb3c8' });
    cardButton(this, null, BX + 40, BY + BH - 96, 280, 62, 'Odeslat (Ctrl+Enter)', () => this.sendBugReport(), { size: 22 });
    cardButton(this, null, BX + 340, BY + BH - 96, 300, 62, 'Stáhnout reporty', () => { downloadBugReports(); this.flash('Reporty se stáhly jako soubor .md.'); }, { size: 22, disabled: count === 0 });
    cardButton(this, null, BX + BW - 300, BY + BH - 96, 260, 62, 'Zpět (Esc)', () => this.showMain(), { size: 22, danger: true });
  }

  // Pozice prvku na plátně (souřadnice hry 1920 × 1080 → stránka).
  createBugInput(x, y, w, h) {
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / GAME_WIDTH;
    const sy = rect.height / GAME_HEIGHT;
    const area = document.createElement('textarea');
    area.placeholder = 'Např.: U Bylinkářky se po přijetí úkolu nezobrazil obchod…';
    area.maxLength = 2000;
    Object.assign(area.style, {
      position: 'fixed', left: `${rect.left + x * sx}px`, top: `${rect.top + y * sy}px`, width: `${w * sx}px`, height: `${h * sy}px`,
      zIndex: 60, resize: 'none', boxSizing: 'border-box', padding: '10px', borderRadius: '8px',
      background: 'rgba(5, 8, 12, 0.92)', color: '#f3e4bd', border: '2px solid #d6a23a',
      font: `${Math.max(14, Math.round(22 * sy))}px Lora, Georgia, serif`
    });
    area.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter' && event.ctrlKey) { event.preventDefault(); this.sendBugReport(); }
      if (event.key === 'Escape') { event.preventDefault(); this.showMain(); }
    });
    document.body.appendChild(area);
    this.bugInput = area;
    // Klávesnice Phaseru nesmí brát znaky (mezerník, šipky) z pole pro text.
    this.input.keyboard.disableGlobalCapture();
    this.input.keyboard.enabled = false;
    setTimeout(() => area.focus(), 50);
  }

  removeBugInput() {
    if (!this.bugInput) return;
    this.bugInput.remove();
    this.bugInput = null;
    this.input.keyboard.enabled = true;
    this.input.keyboard.enableGlobalCapture();
  }

  async sendBugReport() {
    const text = this.bugInput?.value ?? '';
    if (text.trim().length < 3) { this.flash('Napiš prosím aspoň krátký popis chyby.', '#ff9a8a'); return; }
    const result = await submitBugReport(this.state, text);
    this.showMain();
    this.flash(result.server ? 'Díky! Hlášení je uložené ve složce bug-reports.' : 'Díky! Hlášení je uložené v prohlížeči (Stáhnout reporty).', '#8ff0b0');
  }

  showMain() {
    this.clear();
    this.view = 'main';
    uiWindow(this, X, Y, W, H, { shade: 0.55 });
    uiTitle(this, GAME_WIDTH / 2, Y + 28, 'Pauza', { icon: 'hero_wheel', size: 38, center: true });
    const items = [
      ['Vrátit se do hry', () => this.resumeGame()],
      ['Uložit hru', () => this.showSlots('save')],
      ['Načíst hru', () => this.showSlots('load')],
      ['Nastavení', null],
      ['Nahlásit chybu', () => this.showBugReport()],
      ['Hlavní menu', () => this.toMenu()],
      ['Vypnout hru', null]
    ];
    items.forEach(([label, fn], i) => {
      cardButton(this, null, X + 70, Y + 110 + i * 82, W - 140, 66, label, fn ?? (() => {}), { size: 24, disabled: !fn, danger: label === 'Hlavní menu' });
    });
  }

  resumeGame() {
    if (this.closing) return;
    this.closing = true;
    this.scene.stop();
    this.scene.resume(this.returnScene);
  }

  toMenu() {
    SaveSystem.save(this.state);
    this.scene.stop(this.returnScene);
    this.scene.start('Menu', { state: this.state });
  }

  flash(message, color = '#ffd76a') {
    this.flashText?.destroy();
    this.flashText = cardText(this, GAME_WIDTH / 2, Y + H + 24, message, { size: 22, bold: true, color, originX: 0.5, strokeThickness: 5 });
    this.tweens.add({ targets: this.flashText, alpha: 0, delay: 2400, duration: 500 });
  }

  // ------------------------------------------------------------ sloty
  showSlots(mode) {
    this.clear();
    this.view = 'slots';
    const SW = 1180;
    const SH = 860;
    const SX = (GAME_WIDTH - SW) / 2;
    const SY = (GAME_HEIGHT - SH) / 2;
    uiWindow(this, SX, SY, SW, SH, { shade: 0.55 });
    uiTitle(this, SX + 40, SY + 26, mode === 'save' ? 'Uložit hru' : 'Načíst hru', { icon: mode === 'save' ? 'scroll' : 'book', size: 36 });
    const ROW = 120;
    SaveSystem.listSlots().forEach((slot, i) => {
      const y = SY + 100 + i * (ROW + 8);
      nineImage(this, 'nu-slot', SX + 36, y, SW - 72, ROW, 0.4);
      const px = SX + 56;
      const py = y + 12;
      this.add.rectangle(px, py, 192, 108, 0x05080c, 0.9).setOrigin(0).setStrokeStyle(2, 0xd6a23a);
      if (!slot.empty && slot.preview) {
        const key = `slot-preview-${slot.index}-${slot.savedAt}`;
        const show = () => { if (this.view === 'slots' && this.textures.exists(key)) this.add.image(px, py, key).setOrigin(0).setDisplaySize(192, 108); };
        if (this.textures.exists(key)) show();
        else { this.textures.once(`addtexture-${key}`, show); this.textures.addBase64(key, slot.preview); }
      }
      cardText(this, px + 216, y + 18, slot.empty ? `Slot ${slot.index} – prázdný` : `Slot ${slot.index} – ${slot.playerName}`, { size: 26, bold: true, color: slot.empty ? '#9fb3c8' : '#ffe7ae' });
      cardText(this, px + 216, y + 58, slot.empty ? (mode === 'save' ? 'Ulož sem rozehranou hru.' : 'Zatím nic uloženého.')
        : `Úroveň ${slot.level} · ${slot.region} · Zlato ${slot.gold}\nUloženo ${new Date(slot.savedAt).toLocaleString('cs-CZ')}`, { size: 19, color: '#dbe6f3', lineSpacing: 6 });
      cardButton(this, null, SX + SW - 290, y + ROW / 2 - 30, 220, 60, mode === 'save' ? 'Uložit sem' : 'Načíst',
        () => (mode === 'save' ? this.saveTo(slot) : this.loadFrom(slot)), { disabled: mode === 'load' && slot.empty });
    });
    cardButton(this, null, GAME_WIDTH / 2 - 120, SY + SH - 84, 240, 60, 'Zpět (Esc)', () => this.showMain(), { danger: true });
  }

  saveTo(slot) {
    const write = () => {
      const ok = SaveSystem.saveToSlot(slot.index, this.state);
      this.showSlots('save');
      this.flash(ok ? `Hra je uložená ve slotu ${slot.index}.` : 'Hru se nepodařilo uložit.', ok ? '#8ff0b0' : '#ff9a8a');
    };
    if (slot.empty) { write(); return; }
    this.modal = openCardModal(this, `Přepsat slot ${slot.index}?`, [`Ve slotu je ${slot.playerName}, úroveň ${slot.level}. Uložená hra se nahradí.`], [
      { label: 'Přepsat', danger: true, onClick: () => { this.modal?.destroy(); this.modal = null; write(); } },
      { label: 'Zrušit', onClick: () => { this.modal?.destroy(); this.modal = null; } }
    ]);
  }

  loadFrom(slot) {
    const state = SaveSystem.loadSlot(slot.index);
    if (!state) { this.flash('Slot se nepodařilo načíst.', '#ff9a8a'); return; }
    SaveSystem.save(state);
    this.scene.stop(this.returnScene);
    if (state.interiorId) this.scene.start('Interior', { state, interiorId: state.interiorId, fromWorld: false });
    else this.scene.start('World', { state });
  }

}
