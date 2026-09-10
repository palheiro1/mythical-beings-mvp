export const CLOUDFLARE_WEB_ANALYTICS_HOST = 'wisdomduel.mythicalbeings.io';
export const CLOUDFLARE_WEB_ANALYTICS_SCRIPT =
  'https://static.cloudflareinsights.com/beacon.min.js';

const beaconId = 'wisdom-duel-cloudflare-web-analytics';
// A Web Analytics site tag is intentionally public in every instrumented page;
// it authorizes no Cloudflare API access. Keep the API read token separate.
const productionSiteTag = '11360ed76d184fc288ade1b4149b8d09';

export interface CloudflareWebAnalyticsOptions {
  token: string | undefined;
  hostname: string;
}

export function shouldEnableCloudflareWebAnalytics({
  token,
  hostname,
}: CloudflareWebAnalyticsOptions): boolean {
  return Boolean(token?.trim()) && hostname.toLowerCase() === CLOUDFLARE_WEB_ANALYTICS_HOST;
}

/** Load privacy-first aggregate RUM only on the public production host. */
export function startCloudflareWebAnalytics(
  options?: Partial<CloudflareWebAnalyticsOptions>,
): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const token = options?.token ?? import.meta.env.VITE_CF_WEB_ANALYTICS_TOKEN ?? productionSiteTag;
  const hostname = options?.hostname ?? window.location.hostname;
  if (!shouldEnableCloudflareWebAnalytics({ token, hostname })) return false;
  if (document.getElementById(beaconId)) return true;

  const beacon = document.createElement('script');
  beacon.id = beaconId;
  beacon.src = CLOUDFLARE_WEB_ANALYTICS_SCRIPT;
  beacon.defer = true;
  beacon.setAttribute('data-cf-beacon', JSON.stringify({ token: token!.trim(), spa: true }));
  document.body.append(beacon);
  return true;
}
