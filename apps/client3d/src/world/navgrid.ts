/**
 * Navigation grid: A* pathfinding, cell blocking, walkability.
 */

export class NavGrid {
  size: number;
  min: number;
  blocked: Uint8Array;

  constructor(size: number, min: number) {
    this.size = size;
    this.min = min;
    this.blocked = new Uint8Array(size * size);
  }

  /** Convert world position to grid cell. */
  worldToCell(x: number, z: number): { cx: number; cz: number } {
    const cx = Math.floor(x - this.min);
    const cz = Math.floor(z - this.min);
    return { cx, cz };
  }

  /** Convert grid cell to world position (cell CENTRE, not corner). */
  cellToWorld(cx: number, cz: number): { x: number; z: number } {
    const x = this.min + cx + 0.5;
    const z = this.min + cz + 0.5;
    return { x, z };
  }

  private inBounds(cx: number, cz: number): boolean {
    return cx >= 0 && cx < this.size && cz >= 0 && cz < this.size;
  }

  private getIndex(cx: number, cz: number): number {
    return cz * this.size + cx;
  }

  isWalkable(cx: number, cz: number): boolean {
    if (!this.inBounds(cx, cz)) return false;
    return this.blocked[this.getIndex(cx, cz)] === 0;
  }

  /** Mark all cells within radius r as blocked. */
  blockCircle(x: number, z: number, r: number): void {
    const { cx: centerCx, cz: centerCz } = this.worldToCell(x, z);
    const radiusCells = Math.ceil(r);

    for (let cz = centerCz - radiusCells; cz <= centerCz + radiusCells; cz++) {
      for (let cx = centerCx - radiusCells; cx <= centerCx + radiusCells; cx++) {
        if (!this.inBounds(cx, cz)) continue;

        const dx = cx - centerCx;
        const dz = cz - centerCz;
        const distSq = dx * dx + dz * dz;
        if (distSq <= r * r) {
          this.blocked[this.getIndex(cx, cz)] = 1;
        }
      }
    }
  }

  /**
   * A* pathfinding: 8-directional, no corner-cutting.
   * Returns world-space waypoints. Caps explored nodes at 20000.
   */
  findPath(from: { x: number; z: number }, to: { x: number; z: number }): Array<{ x: number; z: number }> {
    const startCell = this.worldToCell(from.x, from.z);
    const endCell = this.worldToCell(to.x, to.z);

    if (!this.isWalkable(endCell.cx, endCell.cz)) {
      return [];
    }

    const openSet: Array<{ cx: number; cz: number; f: number }> = [];
    const gScore = new Map<number, number>();
    const fScore = new Map<number, number>();
    const cameFrom = new Map<number, number>();
    const closed = new Set<number>();
    const exploredCount = { value: 0 };

    const key = (cx: number, cz: number) => cz * this.size + cx;
    const h = (cx: number, cz: number) => {
      const dx = Math.abs(cx - endCell.cx);
      const dz = Math.abs(cz - endCell.cz);
      return dx + dz + (Math.min(dx, dz) - 1) * (Math.sqrt(2) - 1); // Octile
    };

    const startKey = key(startCell.cx, startCell.cz);
    const endKey = key(endCell.cx, endCell.cz);

    gScore.set(startKey, 0);
    fScore.set(startKey, h(startCell.cx, startCell.cz));
    openSet.push({
      cx: startCell.cx,
      cz: startCell.cz,
      f: fScore.get(startKey)!,
    });

    const directions = [
      { dx: 0, dz: -1 }, // N
      { dx: 1, dz: -1 }, // NE
      { dx: 1, dz: 0 }, // E
      { dx: 1, dz: 1 }, // SE
      { dx: 0, dz: 1 }, // S
      { dx: -1, dz: 1 }, // SW
      { dx: -1, dz: 0 }, // W
      { dx: -1, dz: -1 }, // NW
    ];

    while (openSet.length > 0) {
      // Check if we've explored too many nodes
      if (exploredCount.value > 20000) {
        return [];
      }

      // Find lowest f-score node
      let current = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i]!.f < openSet[current]!.f) {
          current = i;
        }
      }

      const node = openSet[current]!;
      const nodeKey = key(node.cx, node.cz);

      if (nodeKey === endKey) {
        // Reconstruct path
        const path: Array<{ x: number; z: number }> = [];
        let curr = nodeKey;
        while (cameFrom.has(curr)) {
          const prevKey = cameFrom.get(curr)!;
          const cx = prevKey % this.size;
          const cz = Math.floor(prevKey / this.size);
          path.unshift(this.cellToWorld(cx, cz));
          curr = prevKey;
        }
        return path;
      }

      openSet.splice(current, 1);
      closed.add(nodeKey);
      exploredCount.value++;

      // Check neighbors
      for (const dir of directions) {
        const nCx = node.cx + dir.dx;
        const nCz = node.cz + dir.dz;

        if (!this.isWalkable(nCx, nCz)) continue;

        const neighborKey = key(nCx, nCz);
        if (closed.has(neighborKey)) continue;

        const nodeG = gScore.get(nodeKey);
        if (nodeG === undefined) continue;

        const tentativeG = nodeG + (dir.dx === 0 || dir.dz === 0 ? 1 : Math.sqrt(2));
        const currentG = gScore.get(neighborKey);

        if (currentG === undefined || tentativeG < currentG) {
          cameFrom.set(neighborKey, nodeKey);
          gScore.set(neighborKey, tentativeG);
          const f = tentativeG + h(nCx, nCz);
          fScore.set(neighborKey, f);

          // Add to open set if not already there
          if (!openSet.find(n => n.cx === nCx && n.cz === nCz)) {
            openSet.push({ cx: nCx, cz: nCz, f });
          }
        }
      }
    }

    return [];
  }

  /**
   * Nearest walkable cell to a point via spiral search.
   */
  nearestWalkable(x: number, z: number, maxR: number = 20): { x: number; z: number } | null {
    const { cx, cz } = this.worldToCell(x, z);

    if (this.isWalkable(cx, cz)) {
      return this.cellToWorld(cx, cz);
    }

    for (let r = 1; r <= maxR; r++) {
      // Spiral outward
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue; // Only check perimeter

          const ncx = cx + dx;
          const ncz = cz + dz;

          if (this.isWalkable(ncx, ncz)) {
            return this.cellToWorld(ncx, ncz);
          }
        }
      }
    }

    return null;
  }
}
