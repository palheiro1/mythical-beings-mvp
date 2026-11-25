import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLOUDFLARE_WEB_ANALYTICS_SCRIPT,
  shouldEnableCloudflareWebAnalytics,
  startCloudflareWebAnalytics,
} from '../../src/utils/cloudflareWebAnalytics.js';

describe('Cloudflare Web Analytics', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is enabled only for the production host with a site token', () => {
    expect(
      shouldEnableCloudflareWebAnalytics({
        token: 'site-token',
        hostname: 'wisdomduel.mythicalbeings.io',
      }),
    ).toBe(true);
    expect(
      shouldEnableCloudflareWebAnalytics({ token: 'site-token', hostname: 'localhost' }),
    ).toBe(false);
    expect(
      shouldEnableCloudflareWebAnalytics({
        token: '',
        hostname: 'wisdomduel.mythicalbeings.io',
      }),
    ).toBe(false);
  });

  it('uses the Wisdom Duel installation snippet token by default', () => {
    vi.stubEnv('VITE_CF_WEB_ANALYTICS_TOKEN', undefined);
    startCloudflareWebAnalytics({ hostname: 'wisdomduel.mythicalbeings.io' });

    const script = document.querySelector(`script[src="${CLOUDFLARE_WEB_ANALYTICS_SCRIPT}"]`);
    const config = JSON.parse(script?.getAttribute('data-cf-beacon') ?? '{}');
    expect(config.token).toBe('c22df15381c049ccb03e6aed3cf31adc');
  });

  it('loads a single deferred aggregate beacon', () => {
    const options = { token: 'site-token', hostname: 'wisdomduel.mythicalbeings.io' };
    expect(startCloudflareWebAnalytics(options)).toBe(true);
    expect(startCloudflareWebAnalytics(options)).toBe(true);
    const beacons = document.querySelectorAll(`script[src="${CLOUDFLARE_WEB_ANALYTICS_SCRIPT}"]`);
    expect(beacons).toHaveLength(1);
    expect(beacons[0]?.getAttribute('data-cf-beacon')).toContain('"spa":true');
  });
});
