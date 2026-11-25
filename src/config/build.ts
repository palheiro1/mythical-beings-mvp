export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.1.0';
export const BUILD_SHA = import.meta.env.VITE_BUILD_SHA || 'local';
export const SHORT_BUILD_SHA = BUILD_SHA === 'local' ? BUILD_SHA : BUILD_SHA.slice(0, 7);
export const BUILD_LABEL = `v${APP_VERSION} · ${SHORT_BUILD_SHA}`;
