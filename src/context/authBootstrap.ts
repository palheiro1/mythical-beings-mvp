const immediateAuthPaths = [
  '/auth',
  '/lobby',
  '/profile',
  '/game',
  '/game-initializing',
  '/nft-selection',
  '/waiting',
];

export interface AuthBootstrapScheduler {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (handle: number) => void;
}

export function shouldInitializeAuthImmediately(pathname: string): boolean {
  return immediateAuthPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function scheduleAuthInitialization(
  initialize: () => void,
  pathname: string,
  scheduler: AuthBootstrapScheduler = window,
): () => void {
  if (shouldInitializeAuthImmediately(pathname)) {
    initialize();
    return () => undefined;
  }

  let cancelled = false;
  const run = () => {
    if (!cancelled) initialize();
  };

  if (scheduler.requestIdleCallback) {
    const handle = scheduler.requestIdleCallback(run, { timeout: 2_000 });
    return () => {
      cancelled = true;
      scheduler.cancelIdleCallback?.(handle);
    };
  }

  const handle = scheduler.setTimeout(run, 1_000);
  return () => {
    cancelled = true;
    scheduler.clearTimeout(handle);
  };
}
