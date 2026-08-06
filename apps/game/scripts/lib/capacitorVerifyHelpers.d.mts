export function extractConfigField(source: string, fieldName: string): string | null;
export function hasServerUrlBlock(source: string): boolean;
export function containsLiveReloadAddress(source: string): boolean;
export function extractBundleIdentifiers(pbxprojSource: string): string[];
export function extractOrientationList(plistSource: string, keyName: string): string[];
export function containsShaReference(text: string, sha: string): boolean;
export function containsAuthoritativeMarker(text: string): boolean;
