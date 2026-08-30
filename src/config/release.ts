const pvpFlag = String(import.meta.env.VITE_ENABLE_PVP ?? '').trim().toLowerCase();

export const PVP_ENABLED = pvpFlag === 'true';
export const TRAINING_PREVIEW_ENABLED = !PVP_ENABLED;

export const PVP_DISABLED_CODE = 'multiplayer_disabled';
export const PVP_DISABLED_MESSAGE =
  'Wisdom Duel multiplayer is disabled while the Training Preview is active.';

export class PvpDisabledError extends Error {
  readonly code = PVP_DISABLED_CODE;

  constructor() {
    super(PVP_DISABLED_MESSAGE);
    this.name = 'PvpDisabledError';
  }
}

export function assertPvpEnabled(): void {
  if (!PVP_ENABLED) {
    throw new PvpDisabledError();
  }
}

export const TRAINING_PREVIEW_LABEL = 'Training Preview';
export const CHAMPIONSHIP_MESSAGE =
  'Multiplayer competition opens with the Wisdom Duel Championship in the coming months.';
