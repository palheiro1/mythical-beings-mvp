import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readPublicFile(name: string): string {
  return readFileSync(path.resolve(process.cwd(), 'public', name), 'utf8');
}

describe('static hosting configuration', () => {
  it('keeps hashed bundles immutable and unknown paths as real 404s', () => {
    const headers = readPublicFile('_headers');
    const redirects = readPublicFile('_redirects');

    expect(headers).toContain('/assets/*');
    expect(headers).toContain('max-age=31536000, immutable');
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(redirects).toContain('/bot-selection /index.html 200');
    expect(redirects.trim().endsWith('/* /404.html 404')).toBe(true);
  });

  it('ships real discovery files instead of the SPA shell', () => {
    expect(JSON.parse(readPublicFile('manifest.webmanifest')).name).toBe('Wisdom Duel');
    expect(readPublicFile('robots.txt')).toContain('Sitemap: https://wisdomduel.mythicalbeings.io/sitemap.xml');
    expect(readPublicFile('sitemap.xml')).toContain('<loc>https://wisdomduel.mythicalbeings.io/</loc>');
  });
});
