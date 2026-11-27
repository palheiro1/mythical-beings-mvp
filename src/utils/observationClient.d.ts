export function createObservationClient(options: {
  product: string; mode: string; endpoint?: string; publicKey?: string;
  population?: 'public' | 'internal' | 'technical_test'; browser?: Window;
  fetcher?: typeof fetch; clock?: () => number;
}): {emit(name: string, journey: string, occurrence: string): string | null; flush(): Promise<void>; dispose(): void};
export function readJourney(browser?: Window): string;
