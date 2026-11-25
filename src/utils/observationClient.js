/** Product-scoped browser observations; never reads account, wallet or email. */
export function createObservationClient({product, mode, endpoint, publicKey, population = 'public',
    browser = globalThis.window, fetcher = globalThis.fetch, clock = Date.now}) {
    const uuid = () => globalThis.crypto.randomUUID();
    const key = `mythical.observations.v1.${product}`;
    const once = new Set();
    let draining = false;
    let state = {pseudonym: uuid(), createdAt: clock(), queue: []};
    try {
        const saved = JSON.parse(browser?.localStorage.getItem(key) || 'null');
        if (saved && clock() - saved.createdAt < 90 * 86400000 && typeof saved.pseudonym === 'string') state = saved;
    } catch { /* Storage denied: use an ephemeral product identity. */ }
    const persist = () => {try {browser?.localStorage.setItem(key, JSON.stringify(state));} catch { /* best effort */ }};
    const enabled = () => Boolean(endpoint && publicKey && browser && browser.navigator?.doNotTrack !== '1' && !browser.navigator?.globalPrivacyControl);
    async function flush() {
        if (draining || !enabled()) return;
        draining = true;
        state.queue = state.queue.filter(item => clock() - Date.parse(item.event.occurred_at) < 86400000).slice(-40);
        try {
            for (const item of [...state.queue]) {
                if (item.nextAt > clock() || item.attempts >= 3) continue;
                item.attempts += 1;
                item.nextAt = clock() + 30000 * item.attempts;
                persist();
                try {
                    const response = await fetcher(endpoint, {method:'POST', credentials:'omit', referrerPolicy:'no-referrer',
                        redirect:'error', keepalive:true, signal:AbortSignal.timeout(8000),
                        headers:{'content-type':'application/json', apikey:publicKey, authorization:`Bearer ${publicKey}`},
                        body:JSON.stringify(item.event)});
                    const receipt = response.ok ? await response.json() : null;
                    if ((receipt?.accepted === true && receipt.event_id === item.event.event_id) || [400,403,409,415].includes(response.status)) {
                        state.queue = state.queue.filter(row => row.event.event_id !== item.event.event_id);
                    }
                } catch { /* Retry this same event identity only, never a new event. */ }
                persist();
            }
        } finally {draining = false;}
    }
    function emit(eventName, journeyId, occurrence) {
        if (!enabled()) return null;
        const dedupe = `${eventName}:${occurrence}`;
        if (once.has(dedupe)) return null;
        once.add(dedupe);
        const event = {version:1,event_id:uuid(),product,mode,event_name:eventName,occurred_at:new Date(clock()).toISOString(),
            pseudonym:state.pseudonym,journey_id:journeyId,population};
        state.queue.push({event, attempts:0, nextAt:0});
        state.queue = state.queue.slice(-40);
        persist(); void flush();
        return event.event_id;
    }
    browser?.addEventListener('online', flush);
    const interval = browser?.setInterval(flush, 30000);
    void flush();
    return {emit,flush,dispose:()=>{browser?.removeEventListener('online',flush);browser?.clearInterval(interval);}};
}

export function readJourney(browser = globalThis.window) {
    try {
        const url = new URL(browser.location.href);
        const candidate = url.searchParams.get('oe_journey');
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate || '')) {
            url.searchParams.delete('oe_journey');
            browser.history.replaceState(browser.history.state, '', url.pathname + url.search + url.hash);
            return candidate;
        }
    } catch { /* Direct entry is an independent journey, not inferred Hub use. */ }
    return globalThis.crypto.randomUUID();
}
