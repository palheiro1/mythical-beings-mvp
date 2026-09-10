import { beforeEach, describe, expect, it } from 'vitest';
import {
  CLOUDFLARE_WEB_ANALYTICS_SCRIPT,
  shouldEnableCloudflareWebAnalytics,
  startCloudflareWebAnalytics,
} from '../../src/utils/cloudflareWebAnalytics.js';

describe('Cloudflare Web Analytics', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
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

  it('loads a single deferred aggregate beacon', () => {
    const options = { token: 'site-token', hostname: 'wisdomduel.mythicalbeings.io' };
    expect(startCloudflareWebAnalytics(options)).toBe(true);
    expect(startCloudflareWebAnalytics(options)).toBe(true);
    const beacons = document.querySelectorAll(`script[src="${CLOUDFLARE_WEB_ANALYTICS_SCRIPT}"]`);
    expect(beacons).toHaveLength(1);
    expect(beacons[0]?.getAttribute('data-cf-beacon')).toContain('"spa":true');
  });
});
