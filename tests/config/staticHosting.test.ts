import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readPublicFile(name: string): string {
  return readFileSync(path.resolve(process.cwd(), 'public', name), 'utf8');
}

function readProjectFile(name: string): string {
  return readFileSync(path.resolve(process.cwd(), name), 'utf8');
}

describe('static hosting configuration', () => {
  it('keeps hashed bundles immutable and unknown paths as real 404s', () => {
    const headers = readPublicFile('_headers');
    const redirects = readPublicFile('_redirects');

    expect(headers).toContain('/assets/*');
    expect(headers).toContain('max-age=31536000, immutable');
    expect(headers).toContain('Strict-Transport-Security: max-age=63072000; includeSubDomains; preload');
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain('Content-Security-Policy:');
    expect(headers).not.toContain('Content-Security-Policy-Report-Only:');
    expect(headers.indexOf('/*')).toBeLessThan(headers.indexOf('/assets/*'));
    expect(redirects).toContain('/bot-selection /index.html 200');
    expect(redirects.trim().endsWith('/* /404.html 404')).toBe(true);
  });

  it('pins the Netlify build runtime and publishes only the production build', () => {
    const netlify = readProjectFile('netlify.toml');

    expect(netlify).toContain('command = "npm run build"');
    expect(netlify).toContain('publish = "dist"');
    expect(netlify).toContain('NODE_VERSION = "22.22.2"');
  });

  it('ships real discovery files instead of the SPA shell', () => {
    expect(JSON.parse(readPublicFile('manifest.webmanifest')).name).toBe('Wisdom Duel');
    expect(readPublicFile('robots.txt')).toContain('Sitemap: https://wisdomduel.mythicalbeings.io/sitemap.xml');
    expect(readPublicFile('sitemap.xml')).toContain('<loc>https://wisdomduel.mythicalbeings.io/</loc>');
  });
});
