export default class BattleGrid {
  constructor(columns = 10, rows = 8, blockedCells = []) {
    this.columns = columns;
    this.rows = rows;
    this.blocked = new Set(
      blockedCells.map((cell) => this.key(cell.x, cell.y))
    );
  }

  key(x, y) {
    return `${x},${y}`;
  }

  isInside(x, y) {
    return x >= 0 && x < this.columns && y >= 0 && y < this.rows;
  }

  isBlocked(x, y) {
    return this.blocked.has(this.key(x, y));
  }

  distance(ax, ay, bx, by) {
    return Math.max(
      Math.abs(ax - bx),
      Math.abs(ay - by)
    );
  }


  getReachable(unit, units) {
    const start = {
      x: unit.x,
      y: unit.y,
      distance: 0
    };

    const queue = [start];
    const visited = new Map([[this.key(start.x, start.y), 0]]);

    while (queue.length > 0) {
      const current = queue.shift();

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 }
      ];

      for (const next of neighbors) {
        if (!this.isInside(next.x, next.y)) continue;
        if (this.isBlocked(next.x, next.y)) continue;

        const occupied = units.some(
          (other) =>
            other !== unit &&
            other.hp > 0 &&
            other.x === next.x &&
            other.y === next.y
        );

        if (occupied) continue;

        const nextDistance = current.distance + 1;
        const nextKey = this.key(next.x, next.y);

        if (nextDistance > unit.move) continue;

        const previousDistance = visited.get(nextKey);

        if (
          previousDistance !== undefined &&
          previousDistance <= nextDistance
        ) {
          continue;
        }

        visited.set(nextKey, nextDistance);
        queue.push({
          x: next.x,
          y: next.y,
          distance: nextDistance
        });
      }
    }

    return Array.from(visited.entries(), ([cellKey, distance]) => {
      const [x, y] = cellKey.split(',').map(Number);
      return { x, y, distance };
    });
  }
}
