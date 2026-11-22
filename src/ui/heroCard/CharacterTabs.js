import FantasyButton from './FantasyButton.js';
import { TABS } from './cardLayout.js';
import { tabStateKey } from './tabSprites.js';

// O kolik je obrázek záložky větší než klikací plocha (přesah přes zlatý rám).
const TAB_PAD_X = 4;
const TAB_PAD_Y = 6;

// Horní navigace karty – sdílená všemi záložkami, aktivní je vždy jen jedna.
// Každá záložka je obrázek ze stavového listu (tab-states.png):
// klid = 1. řádek, pod myší = 2. řádek (zlatý), aktivní = 3. řádek (modrý).
// Obrázky leží přes namalovanou lištu podkladu.
export default class CharacterTabs {
  constructor(scene, parent, onSelect) {
    this.scene = scene;
    this.onSelect = onSelect;
    this.activeId = TABS[0].id;
    this.hoverId = null;

    this.sprites = TABS.map((tab, index) => {
      if (!scene.textures.exists(tabStateKey('normal', index))) return null;
      const { x, y, w, h } = tab.area;
      const sprite = scene.add.image(x + w / 2, y + h / 2, tabStateKey('normal', index));
      parent.add(sprite);
      return sprite;
    });
    const hasSprites = this.sprites.every(Boolean);

    this.buttons = TABS.map(
      (tab) =>
        new FantasyButton(scene, parent, tab.area, {
          label: tab.label,
          radius: 8,
          active: tab.id === this.activeId,
          // Stav kreslí obrázky; záře tlačítka jen jako záloha bez grafiky.
          drawActive: !hasSprites,
          drawHover: !hasSprites,
          onClick: () => this.select(tab.id),
          onHover: () => { this.hoverId = tab.id; this.refreshSprites(); },
          onOut: () => { if (this.hoverId === tab.id) this.hoverId = null; this.refreshSprites(); }
        })
    );

    this.refreshSprites();
  }

  refreshSprites() {
    TABS.forEach((tab, index) => {
      const sprite = this.sprites[index];
      if (!sprite) return;
      const state = tab.id === this.activeId ? 'active' : tab.id === this.hoverId ? 'hover' : 'normal';
      const { w, h } = tab.area;
      sprite.setTexture(tabStateKey(state, index)).setDisplaySize(w + TAB_PAD_X, h + TAB_PAD_Y);
    });
  }

  select(id) {
    if (!TABS.some((tab) => tab.id === id)) return;

    this.activeId = id;
    this.buttons.forEach((button, index) => button.setActive(TABS[index].id === id));
    this.refreshSprites();
    this.onSelect?.(TABS.find((tab) => tab.id === id));
  }

  setDisabled(id, disabled) {
    const index = TABS.findIndex((tab) => tab.id === id);
    if (index >= 0) this.buttons[index].setDisabled(disabled);
  }
}
