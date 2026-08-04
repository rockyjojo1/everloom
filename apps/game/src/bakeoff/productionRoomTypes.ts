export type ProductionRoomProfile = "balanced" | "quality";

export interface AssetPlacement {
  instance: string;
  runtimeAssetId: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
  castShadow: boolean;
  receiveShadow: boolean;
  role: string;
}

export interface ProductionRoomLayout {
  profile: ProductionRoomProfile;
  placements: AssetPlacement[];
}

export interface CharacterInstance {
  runtimeAssetId: string;
  position: [number, number, number];
  rotationY: number;
  tint: string;
  animation: string;
  accessory?: string;
}

export interface RoomDimensions {
  groundWidth: number;
  groundDepth: number;
  playerStartX: number;
  playerStartY: number;
  playerStartZ: number;
  riverCentreZ: number;
  riverWidth: number;
  riverDepth: number;
  cameraFollowOffset: [number, number, number];
  playerMovementSpeed: number;
}

export interface RendererMetrics {
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
}

export interface ViewportMetrics {
  width: number;
  height: number;
  devicePixelRatio: number;
  effectivePixelRatio: number;
}

export interface BakeoffMetrics {
  version: 1;
  room: "meadowrest";
  profile: ProductionRoomProfile;
  ready: boolean;
  startedAtMs: number;
  readyAtMs: number | null;
  loadMs: number | null;
  assetsExpected: string[];
  assetsLoaded: string[];
  failedAssets: string[];
  currentPlayerAnimation: string;
  playerPosition: { x: number; y: number; z: number };
  movementTarget: { x: number; y: number; z: number } | null;
  frameSamples: number;
  averageFps: number | null;
  p95FrameMs: number | null;
  worstFrameMs: number | null;
  longFramesOver50Ms: number;
  renderer: RendererMetrics;
  viewport: ViewportMetrics;
  contextLost: boolean;
  lastUpdatedAtMs: number;
  firstCompleteFrameRendered: boolean;
  grassInstances: number;
  additionalTrees: number;
  additionalRocks: number;
  shadowCastingMeshes: number;
  shadowCasterInstanceIds?: string[];
  maraShawlAttached: boolean;
  maraShawlParentBone: string | null;
}
