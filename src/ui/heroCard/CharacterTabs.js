import FantasyButton from './FantasyButton.js';
import {
  TABS,
  CARD_TEXTURE,
  HERO_TAB_PAINTED,
  HERO_TAB_IDLE_TEXTURE
} from './cardLayout.js';
import { activeTabKey } from './tabSprites.js';

// O kolik je modrá záložka větší než klikací plocha (přesah přes zlatý rám).
const ACTIVE_TAB_PAD_X = 4;
const ACTIVE_TAB_PAD_Y = 6;

// Kopie namalované záložky Hrdina s modrou plochou přebarvenou na klidovou barvu.
// Zlatý rám, ikona a bílý text se nemění (nejsou modré).
function ensureIdleHeroTab(scene) {
  if (scene.textures.exists(HERO_TAB_IDLE_TEXTURE)) return true;
  if (!scene.textures.exists(CARD_TEXTURE)) return false;

  const source = scene.textures.get(CARD_TEXTURE).getSourceImage();
  const { x, y, w, h } = HERO_TAB_PAINTED;
  const canvas = scene.textures.createCanvas(HERO_TAB_IDLE_TEXTURE, w, h);
  const ctx = canvas.getContext();

  ctx.drawImage(source, x, y, w, h, 0, 0, w, h);

  const image = ctx.getImageData(0, 0, w, h);
  const px = image.data;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];

    if (b > 80 && b > r + 35 && b > g + 8) {
      const light = 0.3 * r + 0.59 * g + 0.11 * b;
      px[i] = light * 0.1 + 4;
      px[i + 1] = light * 0.17 + 8;
      px[i + 2] = light * 0.36 + 18;
    }
  }

  ctx.putImageData(image, 0, 0);
  canvas.refresh();
  return true;
}

// Horní navigace karty – sdílená všemi záložkami, aktivní je vždy jen jedna.
export default class CharacterTabs {
  constructor(scene, parent, onSelect) {
    this.onSelect = onSelect;
    this.activeId = TABS[0].id;

    this.idleHeroTab = ensureIdleHeroTab(scene)
      ? scene.add
          .image(HERO_TAB_PAINTED.x, HERO_TAB_PAINTED.y, HERO_TAB_IDLE_TEXTURE)
          .setOrigin(0)
          .setVisible(false)
      : null;
    if (this.idleHeroTab) parent.add(this.idleHeroTab);

    // Aktivní záložka = modrá varianta ze 3. řádku listu stavů, přes namalovanou záložku.
    this.activeSprites = TABS.map((tab, index) => {
      const key = activeTabKey(index);
      if (!scene.textures.exists(key)) return null;

      const { x, y, w, h } = tab.area;
      const sprite = scene.add
        .image(x + w / 2, y + h / 2, key)
        .setDisplaySize(w + ACTIVE_TAB_PAD_X, h + ACTIVE_TAB_PAD_Y)
        .setVisible(tab.id === this.activeId);
      parent.add(sprite);
      return sprite;
    });
    const hasSprites = this.activeSprites.every(Boolean);

    this.buttons = TABS.map(
      (tab) =>
        new FantasyButton(scene, parent, tab.area, {
          label: tab.label,
          radius: 8,
          active: tab.id === this.activeId,
          drawActive: !hasSprites,
          onClick: () => this.select(tab.id)
        })
    );
  }

  select(id) {
    if (!TABS.some((tab) => tab.id === id)) return;

    this.activeId = id;
    this.idleHeroTab?.setVisible(id !== TABS[0].id);
    this.activeSprites.forEach((sprite, index) => sprite?.setVisible(TABS[index].id === id));
    this.buttons.forEach((button, index) => button.setActive(TABS[index].id === id));
    this.onSelect?.(TABS.find((tab) => tab.id === id));
  }

  setDisabled(id, disabled) {
    const index = TABS.findIndex((tab) => tab.id === id);
    if (index >= 0) this.buttons[index].setDisabled(disabled);
  }
}
