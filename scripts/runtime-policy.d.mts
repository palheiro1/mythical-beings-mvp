export interface ParsedNodeVersion {
  major: number;
  minor: number;
  patch: number;
}

export const expectedNodeEngine: string;
export const expectedNvmVersion: string;
export function parseNodeVersion(version: string): ParsedNodeVersion | null;
export function isSupportedNodeVersion(version: string): boolean;
