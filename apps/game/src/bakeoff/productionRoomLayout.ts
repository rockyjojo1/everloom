import type { AssetPlacement, ProductionRoomLayout, ProductionRoomProfile, RoomDimensions, CharacterInstance } from "./productionRoomTypes";

export const ROOM_DIMENSIONS: RoomDimensions = {
  groundWidth: 48,
  groundDepth: 34,
  playerStartX: 0,
  playerStartY: 0,
  playerStartZ: -5,
  riverCentreZ: 8,
  riverWidth: 50,
  riverDepth: 7,
  cameraFollowOffset: [12, 13, 16],
  playerMovementSpeed: 4.5,
};

/** Simple deterministic hash for generating positions from an index. */
function deterministicHash(index: number, seed: number): number {
  let x = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Get core placements common to all profiles. */
function getCoreplacements(): AssetPlacement[] {
  return [
    {
      instance: "cottage-main",
      runtimeAssetId: "town.cottage",
      position: [-10, 0, -4],
      rotationY: 0.25,
      scale: 1.15,
      castShadow: true,
      receiveShadow: true,
      role: "shelter",
    },
    {
      instance: "bridge-main",
      runtimeAssetId: "nature.bridge",
      position: [0, 0, 8],
      rotationY: 0,
      scale: 1.2,
      castShadow: true,
      receiveShadow: true,
      role: "crossing",
    },
    {
      instance: "campfire-main",
      runtimeAssetId: "nature.campfire",
      position: [7, 0, -5],
      rotationY: 0,
      scale: 1.15,
      castShadow: true,
      receiveShadow: true,
      role: "light-source",
    },
    {
      instance: "oak-a",
      runtimeAssetId: "nature.oak",
      position: [9, 0, 0],
      rotationY: 0.2,
      scale: 1,
      castShadow: true,
      receiveShadow: true,
      role: "woodcutting-tree",
    },
    {
      instance: "oak-b",
      runtimeAssetId: "nature.oak",
      position: [12, 0, 2.5],
      rotationY: 1.4,
      scale: 1.08,
      castShadow: true,
      receiveShadow: true,
      role: "woodcutting-tree",
    },
    {
      instance: "oak-c",
      runtimeAssetId: "nature.oak",
      position: [10.5, 0, 5],
      rotationY: 2.5,
      scale: 0.95,
      castShadow: true,
      receiveShadow: true,
      role: "woodcutting-tree",
    },
    {
      instance: "canopy-northwest",
      runtimeAssetId: "nature.tree-detailed",
      position: [-18, 0, -8],
      rotationY: 0.5,
      scale: 1.35,
      castShadow: false,
      receiveShadow: true,
      role: "boundary-canopy",
    },
    {
      instance: "canopy-west",
      runtimeAssetId: "nature.tree-detailed",
      position: [-17, 0, 4],
      rotationY: 1.7,
      scale: 1.25,
      castShadow: false,
      receiveShadow: true,
      role: "boundary-canopy",
    },
    {
      instance: "canopy-northeast",
      runtimeAssetId: "nature.tree-detailed",
      position: [17, 0, -8],
      rotationY: 2.2,
      scale: 1.35,
      castShadow: false,
      receiveShadow: true,
      role: "boundary-canopy",
    },
    {
      instance: "canopy-east",
      runtimeAssetId: "nature.tree-detailed",
      position: [18, 0, 7],
      rotationY: 0.9,
      scale: 1.2,
      castShadow: false,
      receiveShadow: true,
      role: "boundary-canopy",
    },
    // Northern cliff line
    {
      instance: "cliff-0",
      runtimeAssetId: "nature.cliff-block",
      position: [-12, 0, 14],
      rotationY: 0,
      scale: 1.05,
      castShadow: false,
      receiveShadow: true,
      role: "cliff",
    },
    {
      instance: "cliff-1",
      runtimeAssetId: "nature.cliff-block",
      position: [-4, 0, 14],
      rotationY: 1.57,
      scale: 1.15,
      castShadow: false,
      receiveShadow: true,
      role: "cliff",
    },
    {
      instance: "cliff-2",
      runtimeAssetId: "nature.cliff-block",
      position: [4, 0, 14],
      rotationY: 3.14,
      scale: 1.25,
      castShadow: false,
      receiveShadow: true,
      role: "cliff",
    },
    {
      instance: "cliff-3",
      runtimeAssetId: "nature.cliff-block",
      position: [12, 0, 14],
      rotationY: 0,
      scale: 1.1,
      castShadow: false,
      receiveShadow: true,
      role: "cliff",
    },
    {
      instance: "cliff-large-0",
      runtimeAssetId: "nature.cliff-large",
      position: [-18, 0, 13],
      rotationY: 1.57,
      scale: 1.2,
      castShadow: false,
      receiveShadow: true,
      role: "cliff",
    },
    {
      instance: "cliff-large-1",
      runtimeAssetId: "nature.cliff-large",
      position: [18, 0, 13],
      rotationY: 0,
      scale: 1.3,
      castShadow: false,
      receiveShadow: true,
      role: "cliff",
    },
    // Edge rocks
    {
      instance: "rock-tall-0",
      runtimeAssetId: "nature.rock-tall",
      position: [-20, 0, -1],
      rotationY: 0.8,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "edge-rock",
    },
    {
      instance: "rock-tall-b-0",
      runtimeAssetId: "nature.rock-tall-b",
      position: [-19, 0, 8],
      rotationY: 1.5,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "edge-rock",
    },
    {
      instance: "rock-tall-1",
      runtimeAssetId: "nature.rock-tall",
      position: [-14, 0, 12],
      rotationY: 2.1,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "edge-rock",
    },
    {
      instance: "rock-tall-b-1",
      runtimeAssetId: "nature.rock-tall-b",
      position: [14, 0, 12],
      rotationY: 0.5,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "edge-rock",
    },
    {
      instance: "rock-tall-2",
      runtimeAssetId: "nature.rock-tall",
      position: [19, 0, 7],
      rotationY: 1.2,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "edge-rock",
    },
    {
      instance: "rock-tall-b-2",
      runtimeAssetId: "nature.rock-tall-b",
      position: [20, 0, -2],
      rotationY: 2.8,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "edge-rock",
    },
    // Path detail
    {
      instance: "path-0",
      runtimeAssetId: "nature.path-rocks",
      position: [-7, 0, -3],
      rotationY: 0,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "path",
    },
    {
      instance: "path-1",
      runtimeAssetId: "nature.path-rocks",
      position: [-5, 0, -3.5],
      rotationY: 1.57,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "path",
    },
    {
      instance: "path-2",
      runtimeAssetId: "nature.path-rocks",
      position: [-3, 0, -4],
      rotationY: 0,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "path",
    },
    {
      instance: "path-3",
      runtimeAssetId: "nature.path-rocks",
      position: [-1, 0, -4.5],
      rotationY: 1.57,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "path",
    },
    {
      instance: "path-4",
      runtimeAssetId: "nature.path-rocks",
      position: [1, 0, -3.8],
      rotationY: 0,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "path",
    },
    {
      instance: "path-5",
      runtimeAssetId: "nature.path-rocks",
      position: [3, 0, -2.5],
      rotationY: 1.57,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "path",
    },
    {
      instance: "path-6",
      runtimeAssetId: "nature.path-rocks",
      position: [4.5, 0, -0.5],
      rotationY: 0,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "path",
    },
    {
      instance: "path-7",
      runtimeAssetId: "nature.path-rocks",
      position: [3.5, 0, 2],
      rotationY: 1.57,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "path",
    },
    {
      instance: "path-8",
      runtimeAssetId: "nature.path-rocks",
      position: [2, 0, 4.5],
      rotationY: 0,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "path",
    },
    {
      instance: "path-9",
      runtimeAssetId: "nature.path-rocks",
      position: [0.8, 0, 6.5],
      rotationY: 1.57,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "path",
    },
    // Shoreline
    {
      instance: "lily-pad-0",
      runtimeAssetId: "nature.lily-pad",
      position: [-8, -0.05, 8],
      rotationY: 0,
      scale: 1,
      castShadow: false,
      receiveShadow: false,
      role: "water-detail",
    },
    {
      instance: "lily-pad-1",
      runtimeAssetId: "nature.lily-pad",
      position: [-4, -0.05, 9.5],
      rotationY: 0,
      scale: 1,
      castShadow: false,
      receiveShadow: false,
      role: "water-detail",
    },
    {
      instance: "lily-pad-2",
      runtimeAssetId: "nature.lily-pad",
      position: [7, -0.05, 8.8],
      rotationY: 0,
      scale: 1,
      castShadow: false,
      receiveShadow: false,
      role: "water-detail",
    },
    {
      instance: "lily-pad-3",
      runtimeAssetId: "nature.lily-pad",
      position: [12, -0.05, 7.5],
      rotationY: 0,
      scale: 1,
      castShadow: false,
      receiveShadow: false,
      role: "water-detail",
    },
    {
      instance: "rock-flat-0",
      runtimeAssetId: "nature.rock-flat",
      position: [-14, 0, 5.7],
      rotationY: 0.4,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "shore-rock",
    },
    {
      instance: "rock-flat-1",
      runtimeAssetId: "nature.rock-flat",
      position: [-10, 0, 6.3],
      rotationY: 1.1,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "shore-rock",
    },
    {
      instance: "rock-flat-2",
      runtimeAssetId: "nature.rock-flat",
      position: [-6, 0, 6],
      rotationY: 2.3,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "shore-rock",
    },
    {
      instance: "rock-flat-3",
      runtimeAssetId: "nature.rock-flat",
      position: [6, 0, 6.1],
      rotationY: 0.7,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "shore-rock",
    },
    {
      instance: "rock-flat-4",
      runtimeAssetId: "nature.rock-flat",
      position: [10, 0, 6.5],
      rotationY: 1.9,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "shore-rock",
    },
    {
      instance: "rock-flat-5",
      runtimeAssetId: "nature.rock-flat",
      position: [15, 0, 5.8],
      rotationY: 2.6,
      scale: 1,
      castShadow: false,
      receiveShadow: true,
      role: "shore-rock",
    },
    // Ground prop
    {
      instance: "worn-hatchet",
      runtimeAssetId: "custom.tool-hatchet",
      position: [2, 0, -3.5],
      rotationY: 0.6,
      scale: 0.85,
      castShadow: true,
      receiveShadow: true,
      role: "prop",
    },
  ];
}

/** Generate additional deterministic tree placements based on profile. */
function getAdditionalTrees(profile: ProductionRoomProfile): AssetPlacement[] {
  const count = profile === "balanced" ? 6 : 12;
  const trees: AssetPlacement[] = [];
  const treeAssets: string[] = ["nature.tree-round", "nature.pine", "nature.oak-fall"];

  for (let i = 0; i < count; i++) {
    const h1 = deterministicHash(i, 1001);
    const h2 = deterministicHash(i, 1002);
    const h3 = deterministicHash(i, 1003);

    // Place away from central area, within bounds
    let x = (h1 - 0.5) * 40;
    let z = (h2 - 0.5) * 28;

    // Keep away from water and central path
    if (Math.abs(z - ROOM_DIMENSIONS.riverCentreZ) < 5 || Math.abs(z + 5) < 4) {
      z = z > ROOM_DIMENSIONS.riverCentreZ ? z + 6 : z - 6;
    }
    if (Math.abs(x) < 8 && Math.abs(z + 5) < 6) {
      x = x > 0 ? x + 8 : x - 8;
    }

    // Clamp to bounds
    x = Math.max(-22, Math.min(22, x));
    z = Math.max(-14, Math.min(14, z));

    const assetIdx = Math.floor(h3 * treeAssets.length) % treeAssets.length;
    const assetId = treeAssets[assetIdx] ?? "nature.tree-round";
    trees.push({
      instance: `additional-tree-${i}`,
      runtimeAssetId: assetId as string,
      position: [x, 0, z],
      rotationY: h3 * Math.PI * 2,
      scale: 0.8 + h2 * 0.4,
      castShadow: profile === "quality",
      receiveShadow: true,
      role: "additional-tree",
    });
  }

  return trees;
}

/** Generate additional deterministic rock placements based on profile. */
function getAdditionalRocks(profile: ProductionRoomProfile): AssetPlacement[] {
  const count = profile === "balanced" ? 10 : 20;
  const rocks: AssetPlacement[] = [];
  const rockAssets: string[] = ["nature.rock-small", "nature.rock-large"];

  for (let i = 0; i < count; i++) {
    const h1 = deterministicHash(i, 2001);
    const h2 = deterministicHash(i, 2002);
    const h3 = deterministicHash(i, 2003);

    let x = (h1 - 0.5) * 40;
    let z = (h2 - 0.5) * 28;

    // Keep away from water
    if (Math.abs(z - ROOM_DIMENSIONS.riverCentreZ) < 6) {
      z = z > ROOM_DIMENSIONS.riverCentreZ ? z + 7 : z - 7;
    }

    // Clamp
    x = Math.max(-22, Math.min(22, x));
    z = Math.max(-14, Math.min(14, z));

    const assetIdx = Math.floor(h3 * rockAssets.length) % rockAssets.length;
    const assetId = rockAssets[assetIdx] ?? "nature.rock-small";
    rocks.push({
      instance: `additional-rock-${i}`,
      runtimeAssetId: assetId as string,
      position: [x, 0, z],
      rotationY: h3 * Math.PI * 2,
      scale: 0.6 + h2 * 0.6,
      castShadow: profile === "quality",
      receiveShadow: true,
      role: "additional-rock",
    });
  }

  return rocks;
}

export function getProductionRoomLayout(profile: ProductionRoomProfile): ProductionRoomLayout {
  const corePlacements = getCoreplacements();
  const additionalTrees = getAdditionalTrees(profile);
  const additionalRocks = getAdditionalRocks(profile);

  return {
    profile,
    placements: [...corePlacements, ...additionalTrees, ...additionalRocks],
  };
}

export function getCharacterPlacements(profile: ProductionRoomProfile): CharacterInstance[] {
  return [
    {
      runtimeAssetId: "player.adventurer",
      position: [0, 0, -5],
      rotationY: 0,
      tint: "#5fbf5a",
      animation: "Idle",
    },
    {
      runtimeAssetId: "player.adventurer",
      position: [-7, 0, -2.5],
      rotationY: 0.5,
      tint: "#8a5a34",
      animation: "Idle",
      accessory: "custom.npc-mara-shawl",
    },
    {
      runtimeAssetId: "enemy.skeleton-warrior",
      position: [9, 0, 11.5],
      rotationY: 3.14,
      tint: "#ffffff",
      animation: "Idle",
    },
  ];
}

export function getProfileSettings(profile: ProductionRoomProfile) {
  return profile === "balanced"
    ? {
        pixelRatioCap: 1.5,
        shadowMapSize: 1024,
        grassTuftCount: 100,
        additionalTreeCount: 6,
        additionalRockCount: 10,
        shadowCasters: [
          "cottage-main",
          "bridge-main",
          "campfire-main",
          "oak-a",
          "oak-b",
          "oak-c",
          "worn-hatchet",
        ],
      }
    : {
        pixelRatioCap: 2,
        shadowMapSize: 1536,
        grassTuftCount: 220,
        additionalTreeCount: 12,
        additionalRockCount: 20,
        shadowCasters: "all",
      };
}
