// Ladicí panel pohledu na bojiště. Posuvníky mění BATTLE_VIEW a scéna se hned překreslí.
// Otevírá se klávesami Alt+F9 v souboji (BattleScene.setupInput), v nápovědě záměrně není. Hodnoty se ukládají
// do localStorage, „Kopírovat hodnoty“ je dá do schránky, aby šly zapsat do kódu.

const STORAGE_KEY = 'dragon-souls-battle-view';

export const VIEW_SLIDERS = [
  { key: 'topY', label: 'Vzdálená hrana desky (Y)', min: 150, max: 700, step: 5 },
  { key: 'bottomY', label: 'Blízká hrana desky (Y)', min: 700, max: 1060, step: 5 },
  { key: 'centerX', label: 'Střed desky (X)', min: 700, max: 1300, step: 5 },
  { key: 'nearHalfWidth', label: 'Poloviční šířka blízké hrany', min: 400, max: 960, step: 5 },
  { key: 'depthRatio', label: 'Zkrácení do hloubky (1 = žádné)', min: 1, max: 2.5, step: 0.01 },
  { key: 'modelScale', label: 'Velikost postav', min: 0.6, max: 2.2, step: 0.01 },
  { key: 'gridAlpha', label: 'Viditelnost mřížky', min: 0, max: 1, step: 0.01 },
  { key: 'gridWidth', label: 'Tloušťka mřížky', min: 0.5, max: 5, step: 0.1 }
];

// Uložené hodnoty z dřívějšího ladění (jen v tomhle prohlížeči).
export function loadSavedBattleView(view) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved) return;
    for (const { key } of VIEW_SLIDERS) {
      if (Number.isFinite(saved[key])) view[key] = saved[key];
    }
  } catch {
    // Bez úložiště zůstanou výchozí hodnoty.
  }
}

function saveBattleView(view) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(view));
  } catch {
    // Nevadí – hodnoty platí aspoň do obnovení stránky.
  }
}

function clearSavedBattleView() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nic k mazání.
  }
}

export default class BattleViewTuner {
  // view = objekt BATTLE_VIEW, defaults = jeho výchozí kopie, onChange = překreslení scény.
  constructor({ view, defaults, onChange }) {
    this.view = view;
    this.defaults = defaults;
    this.onChange = onChange;
    this.root = null;
  }

  get isOpen() {
    return Boolean(this.root);
  }

  toggle() {
    if (this.root) this.close();
    else this.open();
  }

  open() {
    if (this.root) return;
    const root = document.createElement('div');
    root.style.cssText = [
      'position:fixed', 'top:12px', 'right:12px', 'z-index:1000', 'width:330px',
      'max-height:calc(100vh - 24px)', 'overflow-y:auto', 'box-sizing:border-box',
      'padding:14px 16px', 'border-radius:10px', 'background:rgba(8,14,22,0.92)',
      'border:1px solid #d6a23a', 'color:#e8eef5', 'font:13px/1.35 system-ui,sans-serif',
      'box-shadow:0 8px 30px rgba(0,0,0,0.5)', 'user-select:none'
    ].join(';');
    // Klávesy v panelu (šipky na posuvníku…) nesmí ovládat souboj.
    for (const type of ['keydown', 'keyup']) {
      root.addEventListener(type, (event) => {
        if (event.code !== 'F9') event.stopPropagation(); // Alt+F9 panel zavře i z posuvníku
      });
    }

    const title = document.createElement('div');
    title.textContent = 'Pohled na bojiště (Alt+F9 zavře)';
    title.style.cssText = 'font-weight:700;color:#ffe7ae;font-size:15px;margin-bottom:10px';
    root.appendChild(title);

    this.inputs = {};
    for (const slider of VIEW_SLIDERS) root.appendChild(this.createRow(slider));

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:8px;margin-top:12px';
    buttons.appendChild(this.createButton('Kopírovat hodnoty', () => this.copyValues()));
    buttons.appendChild(this.createButton('Výchozí', () => this.reset()));
    root.appendChild(buttons);

    this.status = document.createElement('div');
    this.status.style.cssText = 'margin-top:8px;color:#9fb3c8;font-size:12px;min-height:16px';
    this.status.textContent = 'Hodnoty se pamatují v tomhle prohlížeči.';
    root.appendChild(this.status);

    document.body.appendChild(root);
    this.root = root;
  }

  createRow({ key, label, min, max, step }) {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin-bottom:8px';
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between';
    const name = document.createElement('span');
    name.textContent = label;
    const value = document.createElement('span');
    value.style.cssText = 'color:#ffd76a;font-variant-numeric:tabular-nums';
    head.append(name, value);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = this.view[key];
    input.style.cssText = 'width:100%;accent-color:#d6a23a';
    const decimals = step < 1 ? String(step).split('.')[1].length : 0;
    const show = () => { value.textContent = Number(this.view[key]).toFixed(decimals); };
    show();
    input.addEventListener('input', () => {
      this.view[key] = Number(input.value);
      show();
      saveBattleView(this.view);
      this.onChange();
    });
    this.inputs[key] = { input, show };

    row.append(head, input);
    return row;
  }

  createButton(text, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.style.cssText = [
      'flex:1', 'padding:7px 8px', 'border-radius:6px', 'border:1px solid #d6a23a',
      'background:#1c2a3a', 'color:#ffe7ae', 'font:600 13px system-ui,sans-serif', 'cursor:pointer'
    ].join(';');
    button.addEventListener('click', onClick);
    return button;
  }

  valuesText() {
    const lines = VIEW_SLIDERS.map(({ key }) => `  ${key}: ${this.view[key]}`);
    return `BATTLE_VIEW = {\n${lines.join(',\n')}\n}`;
  }

  async copyValues() {
    const text = this.valuesText();
    try {
      await navigator.clipboard.writeText(text);
      this.status.textContent = 'Zkopírováno – vlož mi hodnoty do chatu.';
    } catch {
      window.prompt('Zkopíruj hodnoty:', text.replace(/\n\s*/g, ' '));
    }
  }

  reset() {
    Object.assign(this.view, this.defaults);
    clearSavedBattleView();
    for (const [key, { input, show }] of Object.entries(this.inputs)) {
      input.value = this.view[key];
      show();
    }
    this.status.textContent = 'Vráceno na výchozí hodnoty.';
    this.onChange();
  }

  close() {
    this.root?.remove();
    this.root = null;
  }
}
