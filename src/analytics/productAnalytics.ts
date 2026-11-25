import {installProductAnalytics} from './vendor/analytics.js';
import publicConfig from './publicConfig.json';
let current: ReturnType<typeof installProductAnalytics> | undefined;
export function analytics() {
  if (!current) current = installProductAnalytics({...publicConfig, product: 'wisdom_duel', mode: 'training',
    appVersion: `analytics-v2-${import.meta.env.VITE_BUILD_SHA || 'local'}`, enabled: import.meta.env.VITE_PRODUCT_ANALYTICS_ENABLED !== 'false', replayValidated: false, launchEvent: 'game_open'});
  return current;
}
export function track(name: string, properties: Record<string,string> = {}) { return analytics().track(name, properties); }
