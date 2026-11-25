import { describe, expect, it } from 'vitest';
import { guideGlowSequence } from '../../src/hooks/useGuideGlow.js';

describe('guideGlowSequence', () => {
  it('pulses the banner before the market card on the draw step', () => {
    expect(guideGlowSequence('draw', null)).toEqual(['coach', 'market']);
  });

  it('pulses the creature to rotate', () => {
    expect(guideGlowSequence('rotate', null)).toEqual(['creature']);
  });

  it('moves the summon pulse from the hand card to the chosen creature', () => {
    expect(guideGlowSequence('summon', null)).toEqual(['hand']);
    expect(guideGlowSequence('summon', 'aerial1-1')).toEqual(['creature']);
  });

  it('pulses the closing controls of the lesson', () => {
    expect(guideGlowSequence('end', null)).toEqual(['end']);
    expect(guideGlowSequence('strike', null)).toEqual(['bonus']);
    expect(guideGlowSequence('complete', null)).toEqual(['continue']);
    expect(guideGlowSequence('handoff', null)).toEqual(['continue']);
  });

  it('glows nothing while the lesson narrates or is over', () => {
    (['welcome', 'watch', 'wait-for-strike', 'free'] as const).forEach(step => {
      expect(guideGlowSequence(step, 'aerial1-1')).toEqual([]);
    });
  });
});
