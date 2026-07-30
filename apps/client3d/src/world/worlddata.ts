/**
 * World data: all terrain, props, and interactables.
 * Pure data + pure helpers, no Three.js.
 */

export const WORLD_SIZE = 120;
export const WORLD_MIN = -60;
export const WORLD_MAX = 60;

export type Surface = 'grass' | 'darkgrass' | 'dirt' | 'cobble' | 'stone' | 'water';

export const SURFACE_COLOR: Record<Surface, number> = {
  grass: 0x7ec850,
  darkgrass: 0x5a8a3a,
  dirt: 0x8b7355,
  cobble: 0xa0a0a0,
  stone: 0x7a7a7a,
  water: 0x4a90e2,
};

export const WALKABLE: Record<Surface, boolean> = {
  grass: true,
  darkgrass: true,
  dirt: true,
  cobble: true,
  stone: true,
  water: false,
};

// ============================================================================
// PAINT: declarative terrain
// ============================================================================

export type Paint =
  | { shape: 'rect'; surface: Surface; x: number; z: number; w: number; d: number }
  | { shape: 'circle'; surface: Surface; x: number; z: number; r: number }
  | { shape: 'path'; surface: Surface; from: [number, number]; to: [number, number]; width: number };

export const PAINT: Paint[] = [
  // Base layer: entire map is grass
  { shape: 'rect', surface: 'grass', x: -60, z: -60, w: 120, d: 120 },

  // Loomwood Forest (west)
  { shape: 'rect', surface: 'darkgrass', x: -60, z: -30, w: 34, d: 64 },

  // Burrow Mine (north)
  { shape: 'rect', surface: 'stone', x: -14, z: -60, w: 40, d: 26 },

  // Training Grounds (east)
  { shape: 'rect', surface: 'dirt', x: 24, z: -12, w: 32, d: 34 },

  // Silverthread River (south)
  { shape: 'rect', surface: 'water', x: -60, z: 34, w: 120, d: 16 },

  // Thimblewick square (town circle)
  { shape: 'circle', surface: 'cobble', x: 0, z: 4, r: 15 },

  // 4 dirt roads
  // Road to forest (west): from (0,4) to (-43, -30)
  { shape: 'path', surface: 'dirt', from: [0, 4], to: [-43, -30], width: 3 },

  // Road to mine (north): from (0,4) to (6, -47)
  { shape: 'path', surface: 'dirt', from: [0, 4], to: [6, -47], width: 3 },

  // Road to training (east): from (0,4) to (40, 5)
  { shape: 'path', surface: 'dirt', from: [0, 4], to: [40, 5], width: 3 },

  // Road to river (south): from (0,4) to (0, 33)
  { shape: 'path', surface: 'dirt', from: [0, 4], to: [0, 33], width: 3 },
];

// ============================================================================
// PROPS: static objects with optional collision blocks
// ============================================================================

export interface PropPlacement {
  model: string;
  x: number;
  z: number;
  rotY?: number;
  scale?: number;
  blocks?: number;
  tint?: number;
}

/**
 * Deterministic scatter using seeded LCG.
 */
class SeededRandom {
  seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

/**
 * Compose a cottage from modular pieces.
 * ox, oz: origin (centre of building)
 * rot: Y rotation in radians
 * wide: if true, 2 walls wide; else 1 wall (square base)
 */
function cottage(ox: number, oz: number, rot: number, wide: boolean): PropPlacement[] {
  const pieces: PropPlacement[] = [];
  const rotDeg = rot * (180 / Math.PI);

  // Wall dimensions (assumes each wall is ~1 unit)
  const wallDist = wide ? 1.5 : 1;

  if (wide) {
    // 2x1 cottage
    pieces.push({
      model: 'kenney-fantasy/wall.glb',
      x: ox - wallDist,
      z: oz,
      rotY: rot,
    });
    pieces.push({
      model: 'kenney-fantasy/wall.glb',
      x: ox + wallDist,
      z: oz,
      rotY: rot,
    });
    pieces.push({
      model: 'kenney-fantasy/wall-window-shutters.glb',
      x: ox,
      z: oz - wallDist,
      rotY: rot,
    });
    pieces.push({
      model: 'kenney-fantasy/wall-door.glb',
      x: ox,
      z: oz + wallDist,
      rotY: rot,
    });
  } else {
    // 1x1 cottage
    pieces.push({
      model: 'kenney-fantasy/wall.glb',
      x: ox - wallDist / 2,
      z: oz,
      rotY: rot,
    });
    pieces.push({
      model: 'kenney-fantasy/wall-window-shutters.glb',
      x: ox + wallDist / 2,
      z: oz,
      rotY: rot,
    });
    pieces.push({
      model: 'kenney-fantasy/wall-door.glb',
      x: ox,
      z: oz - wallDist / 2,
      rotY: rot,
    });
  }

  // Roof pieces (gable + end)
  pieces.push({
    model: 'kenney-fantasy/roof-gable.glb',
    x: ox,
    z: oz,
    rotY: rot,
    scale: 1.1,
  });
  pieces.push({
    model: 'kenney-fantasy/roof-gable-end.glb',
    x: ox,
    z: oz - (wide ? 0.8 : 0.5),
    rotY: rot,
  });

  // Chimney
  pieces.push({
    model: 'kenney-fantasy/chimney.glb',
    x: ox + 0.6,
    z: oz,
    rotY: rot,
    scale: 0.8,
  });

  return pieces;
}

/**
 * Scatter objects deterministically within a region, avoiding obstacles.
 */
function scatter(
  count: number,
  regionX: [number, number],
  regionZ: [number, number],
  model: string,
  opts?: {
    seed?: number;
    scale?: [number, number];
    blocks?: number;
    keepOutRadius?: number;
    keepOutCenters?: Array<{ x: number; z: number; r: number }>;
  }
): PropPlacement[] {
  const rng = new SeededRandom(opts?.seed ?? 42);
  const result: PropPlacement[] = [];
  const keepOutCenters = opts?.keepOutCenters ?? [];
  const keepOutRadius = opts?.keepOutRadius ?? 0;
  const [minX, maxX] = regionX;
  const [minZ, maxZ] = regionZ;

  for (let i = 0; i < count; i++) {
    let x: number, z: number;
    let attempts = 0;
    let valid = false;

    do {
      x = rng.nextRange(minX, maxX);
      z = rng.nextRange(minZ, maxZ);

      // Check keepOut circles
      valid = true;
      for (const center of keepOutCenters) {
        const dist = Math.sqrt((x - center.x) ** 2 + (z - center.z) ** 2);
        if (dist < center.r + keepOutRadius) {
          valid = false;
          break;
        }
      }

      attempts++;
    } while (!valid && attempts < 30);

    if (valid) {
      let scale: number | undefined;
      if (opts?.scale && opts.scale[0] !== opts.scale[1]) {
        scale = rng.nextRange(opts.scale[0], opts.scale[1]);
      } else if (opts?.scale?.[0]) {
        scale = opts.scale[0];
      }

      const placement: PropPlacement = {
        model,
        x,
        z,
        rotY: rng.nextRange(0, Math.PI * 2),
      };
      if (scale !== undefined) placement.scale = scale;
      if (opts?.blocks !== undefined) placement.blocks = opts.blocks;

      result.push(placement);
    }
  }

  return result;
}

export const PROPS: PropPlacement[] = [];

// Town square: fountain, cart, lanterns, banner, hedges
(() => {
  // Fountain at town centre
  PROPS.push({
    model: 'kenney-fantasy/fountain-round.glb',
    x: 0,
    z: 4,
    blocks: 2.2,
  });

  // Cart
  PROPS.push({
    model: 'kenney-fantasy/cart.glb',
    x: -8,
    z: -5,
    rotY: 0.5,
  });

  // 2 lanterns
  PROPS.push({
    model: 'kenney-fantasy/lantern.glb',
    x: 10,
    z: 8,
    scale: 1.2,
  });
  PROPS.push({
    model: 'kenney-fantasy/lantern.glb',
    x: -10,
    z: 0,
    scale: 1.2,
  });

  // Banner
  PROPS.push({
    model: 'kenney-fantasy/banner-green.glb',
    x: 8,
    z: -8,
    rotY: Math.PI / 4,
  });

  // Hedges for square decoration
  PROPS.push({
    model: 'kenney-fantasy/hedge-large.glb',
    x: 12,
    z: 12,
  });
  PROPS.push({
    model: 'kenney-fantasy/hedge-large.glb',
    x: -12,
    z: -12,
  });
})();

// 4 cottages around the square
(() => {
  const cottages = [
    { x: -20, z: -18, rot: 0, wide: true },
    { x: 20, z: -18, rot: Math.PI / 2, wide: true },
    { x: 20, z: 26, rot: Math.PI, wide: true },
    { x: -20, z: 26, rot: (3 * Math.PI) / 2, wide: true },
  ];

  for (const c of cottages) {
    const pieces = cottage(c.x, c.z, c.rot, c.wide);
    PROPS.push(...pieces);
  }
})();

// Mine mouth (north region)
(() => {
  PROPS.push({
    model: 'kaykit-dungeon/wall_arched.gltf.glb',
    x: 6,
    z: -47,
    scale: 2.2,
    blocks: 1.8,
  });

  PROPS.push({
    model: 'kaykit-dungeon/torch_lit.gltf.glb',
    x: 0,
    z: -47,
    scale: 1.2,
  });
  PROPS.push({
    model: 'kaykit-dungeon/torch_lit.gltf.glb',
    x: 12,
    z: -47,
    scale: 1.2,
  });

  PROPS.push({
    model: 'kaykit-dungeon/barrel_small.gltf.glb',
    x: 6,
    z: -40,
  });

  PROPS.push({
    model: 'kaykit-dungeon/crates_stacked.gltf.glb',
    x: -6,
    z: -45,
    scale: 1.1,
  });
})();

// Loomwood Forest: ~46 scattered trees
(() => {
  const trees = scatter(46, [-60, -26], [-30, 34], 'kenney-nature/tree_cone.glb', {
    seed: 101,
    scale: [1.4, 2.4],
    blocks: 1.1,
    keepOutCenters: [
      { x: 0, z: 4, r: 15 }, // Town square
      { x: -43, z: -30, r: 5 }, // Road endpoint
      { x: 0, z: 4, r: 5 }, // Road endpoint
    ],
  });
  PROPS.push(...trees);
})();

// Burrow Mine: ~16 scattered large rocks
(() => {
  const rockModels: string[] = [
    'kenney-nature/rock_largeA.glb',
    'kenney-nature/rock_largeB.glb',
    'kenney-nature/rock_largeC.glb',
    'kenney-nature/rock_largeD.glb',
  ];
  const rng = new SeededRandom(102);

  for (let i = 0; i < 16; i++) {
    const idx = rng.nextInt(rockModels.length);
    const model = rockModels[idx]!;
    const x = rng.nextRange(-14, 26);
    const z = rng.nextRange(-60, -34);

    // Skip near mine mouth and road endpoints
    const distToMouth = Math.sqrt((x - 6) ** 2 + (z + 47) ** 2);
    const distToRoadEnd = Math.sqrt((x - 6) ** 2 + (z + 60) ** 2);
    if (distToMouth < 8 || distToRoadEnd < 5) continue;

    const prop: PropPlacement = {
      model,
      x,
      z,
      scale: rng.nextRange(1.0, 1.4),
      blocks: 1.6,
      rotY: rng.nextRange(0, Math.PI * 2),
    };
    PROPS.push(prop);
  }
})();

// Riverbank foliage (scattered plants/bushes along the water edge)
(() => {
  const foliageModels: string[] = [
    'kenney-nature/plant_bush.glb',
    'kenney-nature/plant_bushLarge.glb',
    'kenney-nature/grass_large.glb',
  ];
  const rng = new SeededRandom(103);

  for (let i = 0; i < 12; i++) {
    const idx = rng.nextInt(foliageModels.length);
    const model = foliageModels[idx]!;
    const x = rng.nextRange(-60, 60);
    const z = rng.nextRange(25, 34); // Just before water

    const prop: PropPlacement = {
      model,
      x,
      z,
      scale: rng.nextRange(0.8, 1.5),
      rotY: rng.nextRange(0, Math.PI * 2),
    };
    PROPS.push(prop);
  }
})();

// Training Grounds: fences along north and south edges
(() => {
  for (let i = 0; i < 8; i++) {
    const x = 24 + (i * 4);
    PROPS.push({
      model: 'kenney-fantasy/fence.glb',
      x,
      z: -12,
      rotY: 0,
    });
    PROPS.push({
      model: 'kenney-fantasy/fence.glb',
      x,
      z: 22,
      rotY: 0,
    });
  }
})();

// Bridge over river at approximately (-4, 38), rotated 90°
PROPS.push({
  model: 'kenney-nature/bridge_wood.glb',
  x: -4,
  z: 38,
  rotY: Math.PI / 2,
  scale: 1.2,
});

// ============================================================================
// INTERACTABLES: objects with interaction logic
// ============================================================================

export type InteractKind =
  | 'tree'
  | 'rock'
  | 'fishing'
  | 'furnace'
  | 'anvil'
  | 'cookfire'
  | 'bank'
  | 'npc'
  | 'enemy'
  | 'grounditem'
  | 'dungeondoor';

export interface Interactable {
  id: string;
  kind: InteractKind;
  label: string;
  x: number;
  z: number;
  model?: string;
  scale?: number;
  tint?: number;
  nodeId?: string;
  itemId?: string;
  enemyId?: string;
  pick?: number;
}

export const INTERACTABLES: Interactable[] = [];

// Trees in Loomwood
(() => {
  const treeData = [
    {
      id: 'tree_1',
      nodeId: 'meadowrest_pine',
      model: 'kenney-nature/tree_cone.glb',
      x: -45,
      z: -10,
    },
    {
      id: 'tree_2',
      nodeId: 'meadowrest_willow',
      model: 'kenney-nature/tree_detailed.glb',
      x: -35,
      z: 15,
    },
    {
      id: 'tree_3',
      nodeId: 'meadowrest_pine',
      model: 'kenney-nature/tree_cone.glb',
      x: -50,
      z: 5,
    },
    {
      id: 'tree_4',
      nodeId: 'meadowrest_willow',
      model: 'kenney-nature/tree_detailed.glb',
      x: -28,
      z: -20,
    },
    {
      id: 'tree_5',
      nodeId: 'meadowrest_oak',
      model: 'kenney-nature/tree_oak.glb',
      x: -55,
      z: 25,
    },
  ];

  for (const t of treeData) {
    INTERACTABLES.push({
      id: t.id,
      kind: 'tree',
      label: 'Tree',
      x: t.x,
      z: t.z,
      model: t.model,
      scale: 1.4,
      nodeId: t.nodeId,
      pick: 2.2,
    });
  }
})();

// Rocks in Burrow Mine
(() => {
  const rockData = [
    {
      id: 'rock_cu1',
      nodeId: 'meadowrest_copper_vein',
      x: -8,
      z: -50,
      tint: 0xb8703a,
    },
    {
      id: 'rock_cu2',
      nodeId: 'meadowrest_copper_vein',
      x: 8,
      z: -55,
      tint: 0xb8703a,
    },
    {
      id: 'rock_sn1',
      nodeId: 'meadowrest_tin_vein',
      x: 0,
      z: -42,
      tint: 0xc9ccd2,
    },
    {
      id: 'rock_fe1',
      nodeId: 'ashen_iron',
      x: 15,
      z: -48,
      tint: 0x8a6a58,
    },
  ];

  for (const r of rockData) {
    INTERACTABLES.push({
      id: r.id,
      kind: 'rock',
      label: 'Rock',
      x: r.x,
      z: r.z,
      model: 'kenney-nature/rock_largeA.glb',
      scale: 1.2,
      tint: r.tint,
      nodeId: r.nodeId,
      pick: 2.3,
    });
  }
})();

// Fishing spots (grass bank at z≈33)
(() => {
  const fishingData = [
    { id: 'fish_1', nodeId: 'meadowrest_minnow_pool', x: -30, z: 33 },
    { id: 'fish_2', nodeId: 'meadowrest_trout_stream', x: 0, z: 33 },
    { id: 'fish_3', nodeId: 'meadowrest_trout_stream', x: 30, z: 33 },
  ];

  for (const f of fishingData) {
    const interactable: Interactable = {
      id: f.id,
      kind: 'fishing',
      label: 'Fishing Spot',
      x: f.x,
      z: f.z,
      nodeId: f.nodeId,
      pick: 2.1,
    };
    INTERACTABLES.push(interactable);
  }
})();

// Town facilities
INTERACTABLES.push({
  id: 'furnace',
  kind: 'furnace',
  label: 'Furnace',
  x: -8,
  z: 8,
  model: 'kaykit-dungeon/pillar_decorated.gltf.glb',
  scale: 1.5,
  pick: 2.2,
});

INTERACTABLES.push({
  id: 'anvil',
  kind: 'anvil',
  label: 'Anvil',
  x: 8,
  z: 8,
  model: 'kaykit-dungeon/crates_stacked.gltf.glb',
  scale: 0.8,
  pick: 2.2,
});

INTERACTABLES.push({
  id: 'cookfire',
  kind: 'cookfire',
  label: 'Cookfire',
  x: 0,
  z: 15,
  nodeId: 'meadowrest_campfire',
  model: 'kaykit-dungeon/torch_lit.gltf.glb',
  scale: 0.7,
  pick: 2.0,
});

INTERACTABLES.push({
  id: 'bank',
  kind: 'bank',
  label: 'Bank',
  x: -10,
  z: 18,
  model: 'kaykit-dungeon/chest_gold.glb',
  scale: 1.3,
  pick: 2.2,
});

// NPCs
(() => {
  const npc1: Interactable = {
    id: 'npc_wren',
    kind: 'npc',
    label: 'Wren the Weaver',
    x: 5,
    z: -5,
    pick: 2.1,
  };
  INTERACTABLES.push(npc1);

  const npc2: Interactable = {
    id: 'npc_guard',
    kind: 'npc',
    label: 'Watchman Bram',
    x: -5,
    z: -8,
    pick: 2.1,
  };
  INTERACTABLES.push(npc2);
})();

// Ground items
(() => {
  const gi1: Interactable = {
    id: 'gi_hatchet',
    kind: 'grounditem',
    label: 'Worn Hatchet',
    x: -28,
    z: -8,
    itemId: 'worn_hatchet',
    pick: 2.2,
  };
  INTERACTABLES.push(gi1);

  const gi2: Interactable = {
    id: 'gi_pickaxe',
    kind: 'grounditem',
    label: 'Worn Pickaxe',
    x: 8,
    z: -35,
    itemId: 'worn_pickaxe',
    pick: 2.2,
  };
  INTERACTABLES.push(gi2);

  const gi3: Interactable = {
    id: 'gi_rod',
    kind: 'grounditem',
    label: 'Worn Fishing Rod',
    x: -15,
    z: 33,
    itemId: 'worn_fishing_rod',
    pick: 2.2,
  };
  INTERACTABLES.push(gi3);
})();

// Enemies in Training Grounds
(() => {
  const enemyData = [
    { id: 'sk_1', enemyId: 'Skeleton_Minion', model: 'kaykit-skeletons/Skeleton_Minion.glb', x: 30, z: -5 },
    { id: 'sk_2', enemyId: 'Skeleton_Rogue', model: 'kaykit-skeletons/Skeleton_Rogue.glb', x: 40, z: 5 },
    { id: 'sk_3', enemyId: 'Skeleton_Warrior', model: 'kaykit-skeletons/Skeleton_Warrior.glb', x: 35, z: 10 },
    { id: 'sk_4', enemyId: 'Skeleton_Mage', model: 'kaykit-skeletons/Skeleton_Mage.glb', x: 45, z: 0 },
    { id: 'sk_5', enemyId: 'Skeleton_Minion', model: 'kaykit-skeletons/Skeleton_Minion.glb', x: 50, z: 15 },
  ];

  for (const e of enemyData) {
    INTERACTABLES.push({
      id: e.id,
      kind: 'enemy',
      label: 'Skeleton',
      x: e.x,
      z: e.z,
      model: e.model,
      scale: 1.0,
      enemyId: e.enemyId,
      pick: 2.3,
    });
  }

  // Boss: reuse Warrior scaled 1.45x with dark tint
  INTERACTABLES.push({
    id: 'boss',
    kind: 'enemy',
    label: 'The Unravelled King',
    x: 40,
    z: 12,
    model: 'kaykit-skeletons/Skeleton_Warrior.glb',
    scale: 1.45,
    tint: 0x1a1a1a,
    enemyId: 'Skeleton_Warrior',
    pick: 2.5,
  });
})();

// Dungeon door (back of mine)
(() => {
  const door: Interactable = {
    id: 'dungeon_door',
    kind: 'dungeondoor',
    label: 'Dungeon Door',
    x: 6,
    z: -58,
    pick: 2.4,
  };
  INTERACTABLES.push(door);
})();

// ============================================================================
// SPAWN: player starting position
// ============================================================================

export const SPAWN = { x: 0, z: 12 };
