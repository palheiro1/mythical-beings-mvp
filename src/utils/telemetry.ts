import { APP_VERSION, BUILD_SHA } from '../config/build.js';

export type TelemetryKind = 'application_error' | 'unhandled_rejection' | 'web_vitals';

export interface TelemetryPayload {
  schema: 'wisdom-duel-telemetry-v1';
  kind: TelemetryKind;
  timestamp: string;
  appVersion: string;
  buildSha: string;
  route: string;
  data: Record<string, unknown>;
}

const enabledFlag = String(import.meta.env.VITE_OBSERVABILITY_ENABLED ?? '').trim().toLowerCase();
const endpointValue = String(import.meta.env.VITE_OBSERVABILITY_ENDPOINT ?? '').trim();
const configuredSampleRate = Number(import.meta.env.VITE_OBSERVABILITY_SAMPLE_RATE ?? '1');

export const OBSERVABILITY_ENABLED = enabledFlag === 'true' && endpointValue.length > 0;
export const OBSERVABILITY_SAMPLE_RATE = Number.isFinite(configuredSampleRate)
  ? Math.min(1, Math.max(0, configuredSampleRate))
  : 1;

const SENSITIVE_KEY_PATTERN = /(authorization|token|secret|password|cookie|email|wallet|address|private|state|hand|deck|payload)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const EVM_ADDRESS_PATTERN = /\b0x[a-f0-9]{40}\b/gi;
const JWT_PATTERN = /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

let globalHandlersInstalled = false;
let rumStarted = false;

function sanitizeString(value: string): string {
  return value
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(EVM_ADDRESS_PATTERN, '[redacted-address]')
    .replace(JWT_PATTERN, '[redacted-token]')
    .replace(UUID_PATTERN, '[redacted-id]')
    .slice(0, 500);
}

export function sanitizeTelemetryValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[truncated]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (value instanceof Error) {
    return {
      name: sanitizeString(value.name),
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeTelemetryValue(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 20)
        .map(([key, item]) => [
          key,
          SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeTelemetryValue(item, depth + 1),
        ]),
    );
  }
  return sanitizeString(String(value));
}

export function normalizeTelemetryRoute(pathname: string): string {
  const normalized = pathname
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)) return ':id';
      if (/^0x[a-f0-9]{40}$/i.test(segment)) return ':address';
      if (/^[A-Z0-9]{6,12}$/.test(segment)) return ':code';
      if (segment.length > 48) return ':id';
      return segment;
    })
    .join('/');
  return normalized || '/';
}

export function createTelemetryPayload(
  kind: TelemetryKind,
  data: Record<string, unknown>,
  pathname = typeof window === 'undefined' ? '/' : window.location.pathname,
): TelemetryPayload {
  return {
    schema: 'wisdom-duel-telemetry-v1',
    kind,
    timestamp: new Date().toISOString(),
    appVersion: APP_VERSION,
    buildSha: BUILD_SHA,
    route: normalizeTelemetryRoute(pathname),
    data: sanitizeTelemetryValue(data) as Record<string, unknown>,
  };
}

function resolveEndpoint(): URL | null {
  if (!OBSERVABILITY_ENABLED || typeof window === 'undefined') return null;
  try {
    const endpoint = new URL(endpointValue, window.location.origin);
    const isLocal = endpoint.hostname === 'localhost' || endpoint.hostname === '127.0.0.1';
    return endpoint.protocol === 'https:' || isLocal ? endpoint : null;
  } catch {
    return null;
  }
}

function transmit(payload: TelemetryPayload): void {
  if (Math.random() > OBSERVABILITY_SAMPLE_RATE) return;
  const endpoint = resolveEndpoint();
  if (!endpoint) return;
  const body = JSON.stringify(payload);

  if (typeof navigator.sendBeacon === 'function'
    && navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))) {
    return;
  }

  void fetch(endpoint, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    keepalive: true,
  }).catch(() => undefined);
}

export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  if (!OBSERVABILITY_ENABLED) return;
  transmit(createTelemetryPayload('application_error', { error, ...context }));
}

export function installGlobalErrorHandlers(): () => void {
  if (!OBSERVABILITY_ENABLED || typeof window === 'undefined' || globalHandlersInstalled) {
    return () => undefined;
  }
  globalHandlersInstalled = true;

  const onError = (event: ErrorEvent) => {
    reportError(event.error ?? event.message, { source: 'window.error' });
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    transmit(createTelemetryPayload('unhandled_rejection', {
      error: event.reason instanceof Error ? event.reason : String(event.reason),
    }));
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    globalHandlersInstalled = false;
  };
}

type LayoutShiftEntry = PerformanceEntry & { value?: number; hadRecentInput?: boolean };
type InteractionEntry = PerformanceEntry & { duration?: number; interactionId?: number };

export function startRumCollection(): () => void {
  if (!OBSERVABILITY_ENABLED || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined' || rumStarted) {
    return () => undefined;
  }
  rumStarted = true;
  const observers: PerformanceObserver[] = [];
  const metrics: Record<string, number> = {};
  let cls = 0;

  const observe = (type: string, callback: (entries: PerformanceEntry[]) => void) => {
    try {
      const observer = new PerformanceObserver((list) => callback(list.getEntries()));
      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch {
      // Older browsers may not support every entry type.
    }
  };

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (navigation) metrics.ttfb = Math.max(0, navigation.responseStart - navigation.requestStart);

  observe('paint', (entries) => {
    const fcp = entries.find((entry) => entry.name === 'first-contentful-paint');
    if (fcp) metrics.fcp = fcp.startTime;
  });
  observe('largest-contentful-paint', (entries) => {
    const lcp = entries.at(-1);
    if (lcp) metrics.lcp = lcp.startTime;
  });
  observe('layout-shift', (entries) => {
    entries.forEach((entry) => {
      const shift = entry as LayoutShiftEntry;
      if (!shift.hadRecentInput) cls += shift.value ?? 0;
    });
    metrics.cls = cls;
  });
  observe('event', (entries) => {
    entries.forEach((entry) => {
      const interaction = entry as InteractionEntry;
      if ((interaction.interactionId ?? 0) > 0) {
        metrics.inp = Math.max(metrics.inp ?? 0, interaction.duration ?? entry.duration);
      }
    });
  });

  const flush = () => {
    if (Object.keys(metrics).length > 0) {
      transmit(createTelemetryPayload('web_vitals', { metrics }));
    }
  };
  window.addEventListener('pagehide', flush, { once: true });

  return () => {
    flush();
    observers.forEach((observer) => observer.disconnect());
    window.removeEventListener('pagehide', flush);
    rumStarted = false;
  };
}
