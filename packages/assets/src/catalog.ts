import catalogRaw from "./catalog.generated.json";
import { ASSET_REGISTRY } from "./runtime";

export interface CatalogRecord {
  readonly id: string;
  readonly sourceFile: string;
  readonly pack: string;
  readonly category: string;
  readonly format: "glb" | "gltf";
  readonly bytes: number;
}

export const ASSET_CATALOG = Object.freeze(catalogRaw as CatalogRecord[]);

export function isAssetUsed(sourceFile: string): boolean {
  return Object.values(ASSET_REGISTRY).some((asset) => asset.sourceFile === sourceFile);
}
