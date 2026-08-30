import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CardArtwork from '../../src/components/CardArtwork.js';
import { getResponsiveCardSrcSet } from '../../src/utils/cardAssets.js';

describe('CardArtwork', () => {
  it('offers correctly sized local WebP candidates and intrinsic dimensions', () => {
    render(
      <CardArtwork
        src="/images/beings/adaro.webp"
        alt="Adaro"
        sizes="150px"
        loading="lazy"
      />,
    );

    const artwork = screen.getByRole('img', { name: 'Adaro' });
    expect(artwork).toHaveAttribute(
      'srcset',
      '/images/beings/adaro-360.webp 360w, /images/beings/adaro.webp 720w',
    );
    expect(artwork).toHaveAttribute('sizes', '150px');
    expect(artwork).toHaveAttribute('width', '720');
    expect(artwork).toHaveAttribute('height', '951');
    expect(artwork).toHaveAttribute('loading', 'lazy');
  });

  it('does not invent local variants for remote or vector artwork', () => {
    expect(getResponsiveCardSrcSet('https://cdn.example/card.webp')).toBeUndefined();
    expect(getResponsiveCardSrcSet('/images/beings/lafaic.svg')).toBeUndefined();
  });
});
