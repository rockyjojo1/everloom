export declare const MODEL_ROOT: string;
export declare const REPOSITORY_ROOT: string;
export declare const MODEL_ROOT_RELATIVE: string;
export declare function resolvePathWithinRoot(
  root: string,
  relativePath: string,
  options?: { allowRoot?: boolean },
): string;
export declare function resolveModelPath(sourceFile: string): string;
