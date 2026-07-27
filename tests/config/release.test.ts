import { describe, expect, it } from 'vitest';
import { PVP_ENABLED, TRAINING_PREVIEW_ENABLED } from '../../src/config/release.js';

describe('release mode', () => {
  it('defaults public builds to the training-only preview', () => {
    expect(PVP_ENABLED).toBe(false);
    expect(TRAINING_PREVIEW_ENABLED).toBe(true);
  });
});
