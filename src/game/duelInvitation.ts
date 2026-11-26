const roomCode = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const pendingKey = 'wisdom-duel:sign-in-invitation';

export function invitationCode(input: string): string | null {
  const value = input.trim();
  if (roomCode.test(value)) return value.toLowerCase();
  try {
    const url = new URL(value);
    const isInvitation = url.pathname === '/duels' ||
      (url.pathname === '/wagers' && url.searchParams.get('mode') === 'casual');
    const code = url.searchParams.get('join') ?? '';
    return url.origin === window.location.origin && isInvitation && roomCode.test(code) ? code.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function duelLobbyPath(code?: string | null) {
  return code ? `/duels?join=${encodeURIComponent(code)}` : '/duels';
}

export function duelAccountPath(code: string | null, publicLobby = false) {
  const intent = publicLobby ? (code ? `public-${code}` : 'public') : (code ?? 'new');
  return `/?duel=${encodeURIComponent(intent)}#account`;
}

function validIntent(intent: unknown): intent is string {
  return typeof intent === 'string' && (intent === 'new' || intent === 'public' || roomCode.test(intent) ||
    (intent.startsWith('public-') && roomCode.test(intent.slice(7))));
}

export function duelSignInIntent(search: string): string | null {
  const intent = new URLSearchParams(search).get('duel');
  return validIntent(intent) ? intent : null;
}

export function playHubRedirectUrl(): string {
  const { origin, pathname, search } = window.location;
  const intent = pathname === '/' ? duelSignInIntent(search) : null;
  try {
    if (intent) localStorage.setItem(pendingKey, JSON.stringify({ intent, until: Date.now() + 15 * 60_000 }));
    else localStorage.removeItem(pendingKey);
  } catch { /* The callback URL also carries the invitation. */ }
  return intent ? `${origin}/?duel=${intent}` : origin;
}

export function signedInDuelPath(search: string): string | null {
  let intent = duelSignInIntent(search);
  try {
    const saved = JSON.parse(localStorage.getItem(pendingKey) ?? 'null');
    localStorage.removeItem(pendingKey);
    if (!intent && saved?.until > Date.now() && validIntent(saved.intent)) {
      intent = saved.intent;
    }
  } catch { /* Storage is optional for URL-based callbacks. */ }
  if (intent === 'public') return '/duels/public';
  if (intent?.startsWith('public-')) return `/duels/public?join=${intent.slice(7)}`;
  return intent ? duelLobbyPath(intent === 'new' ? null : intent) : null;
}
