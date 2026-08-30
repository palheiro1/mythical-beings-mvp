export const prepareAuthoritativeAllowedOrigins = (
  allowedOrigins: readonly string[],
): ReadonlySet<string> => {
  if (allowedOrigins.includes('*')) {
    throw new Error('An authoritative endpoint cannot use a wildcard CORS origin.');
  }
  return new Set(allowedOrigins.map((value) => {
    const url = new URL(value);
    if (url.pathname !== '/' || url.search || url.hash || url.origin === 'null') {
      throw new Error(`Allowed origin must contain only scheme, host, and optional port: ${value}`);
    }
    return url.origin;
  }));
};

export const parseAuthoritativeBearerToken = (
  authorization: string | null,
): string | null => {
  const match = authorization?.match(/^Bearer ([^\s,]+)$/);
  return match?.[1] ?? null;
};

export class AuthoritativeHttpOperationTimeoutError extends Error {
  constructor() {
    super('Authoritative HTTP operation exceeded its time budget.');
    this.name = 'AuthoritativeHttpOperationTimeoutError';
  }
}

export const validateAuthoritativeOperationTimeout = (timeoutMs: number): number => {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 30_000) {
    throw new Error('Authoritative HTTP timeout must be between 10 and 30000 milliseconds.');
  }
  return timeoutMs;
};

export function createAuthoritativeOperationSignal(
  request: Request,
  timeoutMs: number,
): AbortSignal {
  return AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]);
}

export async function awaitAuthoritativeDependency<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) throw new AuthoritativeHttpOperationTimeoutError();
  return await new Promise<T>((resolve, reject) => {
    const abort = () => reject(new AuthoritativeHttpOperationTimeoutError());
    signal.addEventListener('abort', abort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}

export interface AuthoritativeHttpResponseContext {
  originAllowed: boolean;
  headers: Headers;
  jsonResponse: (body: unknown, status: number, extraHeaders?: HeadersInit) => Response;
  emptyResponse: (status: number, extraHeaders?: HeadersInit) => Response;
}

export function createAuthoritativeHttpResponseContext(
  request: Request,
  allowedOrigins: ReadonlySet<string>,
  requestId: string,
  allowedMethods: readonly string[],
): AuthoritativeHttpResponseContext {
  const requestOrigin = request.headers.get('Origin');
  const originAllowed = !requestOrigin || allowedOrigins.has(requestOrigin);
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    'Vary': 'Origin, Access-Control-Request-Headers, Access-Control-Request-Method',
    'X-Content-Type-Options': 'nosniff',
    'X-Request-Id': requestId,
  });

  if (requestOrigin && originAllowed) {
    headers.set('Access-Control-Allow-Origin', requestOrigin);
    headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info');
    headers.set('Access-Control-Allow-Methods', [...allowedMethods, 'OPTIONS'].join(', '));
    headers.set('Access-Control-Max-Age', '600');
  }

  const responseHeaders = (extraHeaders?: HeadersInit) => {
    const output = new Headers(headers);
    if (extraHeaders) new Headers(extraHeaders).forEach((value, key) => output.set(key, value));
    return output;
  };

  return {
    originAllowed,
    headers,
    jsonResponse: (body, status, extraHeaders) => new Response(JSON.stringify(body), {
      status,
      headers: responseHeaders(extraHeaders),
    }),
    emptyResponse: (status, extraHeaders) => {
      const output = responseHeaders(extraHeaders);
      output.delete('Content-Type');
      return new Response(null, { status, headers: output });
    },
  };
}
