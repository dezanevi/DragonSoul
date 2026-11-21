// Perspektivní pohled na bojiště: mřížka leží na zemi a kamera se na ni dívá
// zepředu šikmo shora. Vzdálené řady (y = 0) jsou užší a výš, blízké (y = ROWS)
// širší a níž. Sloupce běží zleva (hráč) doprava (nepřátelé).
//
// Projekce: řada r leží v hloubce z(r) mezi Z_FAR a Z_NEAR,
//   y = horizont + F / z,   poloviční šířka = HALF_NEAR * Z_NEAR / z.

export default class BoardProjection {
  constructor({ columns, rows, centerX, topY, bottomY, nearHalfWidth, depthRatio = 1.45 }) {
    this.columns = columns;
    this.rows = rows;
    this.centerX = centerX;
    this.zNear = 1;
    this.zFar = depthRatio;
    this.nearHalfWidth = nearHalfWidth;

    // F a horizont tak, aby řada 0 byla na topY a řada ROWS na bottomY.
    this.focal = (bottomY - topY) / (1 / this.zNear - 1 / this.zFar);
    this.horizonY = bottomY - this.focal / this.zNear;
  }

  depthAt(rowEdge) {
    return this.zFar - (this.zFar - this.zNear) * (rowEdge / this.rows);
  }

  // Bod na zemi v souřadnicích mřížky (desetinná čísla) → obrazovka.
  point(gx, gy) {
    const z = this.depthAt(gy);
    const halfWidth = this.nearHalfWidth * (this.zNear / z);

    return {
      x: this.centerX - halfWidth + (gx / this.columns) * halfWidth * 2,
      y: this.horizonY + this.focal / z
    };
  }

  // Měřítko postav v řadě (1 = nejbližší řada).
  scaleAt(gy) {
    return this.zNear / this.depthAt(gy);
  }

  cellCenter(x, y) {
    return this.point(x + 0.5, y + 0.5);
  }

  cellQuad(x, y, inset = 0) {
    const i = inset;
    return [
      this.point(x + i, y + i),
      this.point(x + 1 - i, y + i),
      this.point(x + 1 - i, y + 1 - i),
      this.point(x + i, y + 1 - i)
    ];
  }

  boardQuad(margin = 0) {
    return [
      this.point(-margin, -margin),
      this.point(this.columns + margin, -margin),
      this.point(this.columns + margin, this.rows + margin),
      this.point(-margin, this.rows + margin)
    ];
  }

  // Obrazovka → pole mřížky (nebo null mimo mřížku).
  cellAt(screenX, screenY) {
    const zInv = (screenY - this.horizonY) / this.focal;
    if (zInv <= 0) return null;

    const z = 1 / zInv;
    const gy = ((this.zFar - z) / (this.zFar - this.zNear)) * this.rows;
    const halfWidth = this.nearHalfWidth * (this.zNear / z);
    const gx = ((screenX - (this.centerX - halfWidth)) / (halfWidth * 2)) * this.columns;

    const x = Math.floor(gx);
    const y = Math.floor(gy);
    if (x < 0 || y < 0 || x >= this.columns || y >= this.rows) return null;
    return { x, y };
  }
}
