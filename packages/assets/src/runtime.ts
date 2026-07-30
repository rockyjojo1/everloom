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

export const ASSET_REGISTRY = Object.freeze(
  Object.fromEntries((registryRaw as AssetRecord[]).map((asset) => [asset.id, Object.freeze(asset)])),
) as Readonly<Record<string, AssetRecord>>;

export function assetUrl(assetId: string): string {
  const asset = ASSET_REGISTRY[assetId];
  if (!asset) throw new Error(`Unknown asset ID: ${assetId}`);
  if (asset.sourceFile.startsWith("procedural://") || asset.sourceFile.startsWith("composite://")) {
    return asset.sourceFile;
  }
  return `/models/${asset.sourceFile}`;
}
