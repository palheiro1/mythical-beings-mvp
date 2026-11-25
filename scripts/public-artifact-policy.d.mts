export interface PublicArtifactFinding {
  relativePath: string;
  kind: string;
}

export function isForbiddenPublicFile(relativePath: string): boolean;
export function scanPublicText(relativePath: string, text: string): PublicArtifactFinding[];
