import catalogRaw from "./catalog.generated.json";
import registryRaw from "./registry.json";

export interface AssetRecord {
  readonly id: string;
  readonly sourceFile: string;
  readonly pack: string;
  readonly category: string;
  readonly scale: number;
  readonly interactionType: string | null;
  readonly licence: string;
  readonly sourceUrl: string | null;
  readonly notes: string;
}

export interface CatalogRecord {
  readonly id: string;
  readonly sourceFile: string;
  readonly pack: string;
  readonly category: string;
  readonly format: "glb" | "gltf";
  readonly bytes: number;
}

export const ASSET_REGISTRY = Object.freeze(
  Object.fromEntries((registryRaw as AssetRecord[]).map((asset) => [asset.id, Object.freeze(asset)])),
) as Readonly<Record<string, AssetRecord>>;

export const ASSET_CATALOG = Object.freeze(catalogRaw as CatalogRecord[]);

export function assetUrl(assetId: string): string {
  const asset = ASSET_REGISTRY[assetId];
  if (!asset) throw new Error(`Unknown asset ID: ${assetId}`);
  if (asset.sourceFile.startsWith("procedural://")) return asset.sourceFile;
  return `/models/${asset.sourceFile}`;
}

export function isAssetUsed(sourceFile: string): boolean {
  return Object.values(ASSET_REGISTRY).some((asset) => asset.sourceFile === sourceFile);
}
