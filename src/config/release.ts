const pvpFlag = String(import.meta.env.VITE_ENABLE_PVP ?? '').trim().toLowerCase();

export const PVP_ENABLED = pvpFlag === 'true';
export const TRAINING_PREVIEW_ENABLED = !PVP_ENABLED;

export const TRAINING_PREVIEW_LABEL = 'Training Preview';
export const CHAMPIONSHIP_MESSAGE =
  'Multiplayer competition opens with the Wisdom Duel Championship in the coming months.';
