import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import creatureData from '../../src/assets/creatures.json';
import knowledgeData from '../../src/assets/knowledges.json';

describe('card artwork', () => {
  it('references existing optimized assets for every card', () => {
    const cards = [...creatureData, ...knowledgeData];

    for (const card of cards) {
      const relativePath = card.image.replace(/^\//, '');
      const absolutePath = path.resolve(process.cwd(), 'public', relativePath);

      expect(card.image, `${card.name} should use WebP or the explicit SVG placeholder`).toMatch(/\.(webp|svg)$/);
      expect(existsSync(absolutePath), `${card.name} artwork should exist at ${card.image}`).toBe(true);
      expect(statSync(absolutePath).size, `${card.name} artwork should not be empty`).toBeGreaterThan(500);

      if (card.image.endsWith('.webp')) {
        const responsivePath = absolutePath.replace(/\.webp$/, '-360.webp');
        expect(existsSync(responsivePath), `${card.name} should have a 360px responsive variant`).toBe(true);
        expect(
          statSync(responsivePath).size,
          `${card.name} responsive artwork should be smaller than its 720px source`,
        ).toBeLessThan(statSync(absolutePath).size);
      }
    }
  });
});
