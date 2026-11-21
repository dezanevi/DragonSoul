import { TEXT_FONT, CARD_WIDTH } from './cardLayout.js';

// Bublina s popisem (vybavení, dovednosti). Leží v nejvyšší vrstvě karty.
export default class CardTooltip {
  constructor(scene, parent) {
    this.container = scene.add.container(0, 0).setVisible(false);
    this.background = scene.add.graphics();
    this.title = scene.add
      .text(18, 14, '', {
        fontFamily: TEXT_FONT,
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffe39a'
      })
      .setResolution(2);
    this.body = scene.add
      .text(18, 50, '', {
        fontFamily: TEXT_FONT,
        fontSize: '21px',
        color: '#e8eef5',
        lineSpacing: 4,
        wordWrap: { width: 330 }
      })
      .setResolution(2);

    this.container.add([this.background, this.title, this.body]);
    parent.add(this.container);
  }

  // anchor = oblast prvku; tooltip se ukáže vedle ní (vpravo, nebo vlevo u kraje).
  show(anchor, title, lines, accent = 0xd6a23a, titleColor = '#ffe39a') {
    this.title.setText(title).setColor(titleColor);
    this.body.setText(lines.join('\n'));

    const width = Math.max(this.title.width, this.body.width) + 36;
    const height = 50 + this.body.height + 16;

    this.background.clear();
    this.background.fillStyle(0x07111f, 0.96).fillRoundedRect(0, 0, width, height, 10);
    this.background.lineStyle(3, accent, 1).strokeRoundedRect(1.5, 1.5, width - 3, height - 3, 10);

    let x = anchor.x + anchor.w + 14;
    if (x + width > CARD_WIDTH - 20) x = anchor.x - width - 14;

    this.container.setPosition(x, anchor.y + anchor.h / 2 - height / 2).setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }
}
