export const MULTIPLAYER_RELEASE_FLAG = "WISDOM_DUEL_PVP_ENABLED";
export const MULTIPLAYER_DISABLED_CODE = "multiplayer_disabled";
export const MULTIPLAYER_DISABLED_MESSAGE =
  "Wisdom Duel multiplayer is disabled while the Training Preview is active.";

export function isMultiplayerReleaseEnabled(value: string | null | undefined): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}
