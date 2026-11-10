// Story 4.35: one server-sent-events stream for the dashboard.
// Uses fetch (not EventSource) so the token travels in the Authorization header, never in the URL.
// No imports on purpose: Node tests load this file as it is.

/** SSE text -> complete events plus the unfinished rest (kept for the next chunk). Comment lines (":ping") are ignored. */
export function parseSse(buffer) {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop();
  const events = [];
  for (const block of blocks) {
    let name = 'message';
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) name = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    if (data.length || name !== 'message') events.push({ name, data: data.join('\n') });
  }
  return { events, rest };
}

/** 2 s, 4 s, 8 s ... capped at 30 s. */
export function reconnectDelay(attempt) {
  return Math.min(30000, 2000 * 2 ** attempt);
}

/**
 * Keeps the stream open and reconnects with a growing delay.
 * onUpdate(type) per "update" event; onStatus(true) on "hello", onStatus(false) whenever the stream is down.
 * A 401 or 403 stops for good (expired token or no permission): retrying cannot help.
 * Returns a function that closes the stream.
 */
export function connectLiveUpdates({ url, getToken, onUpdate, onStatus, fetchImpl = (...a) => fetch(...a) }) {
  let stopped = false;
  let controller = null;
  let timer = null;
  let attempt = 0;

  const run = async () => {
    controller = new AbortController();
    try {
      const res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${getToken()}`, Accept: 'text/event-stream' },
        signal: controller.signal
      });
      if (res.status === 401 || res.status === 403) { stopped = true; return; }
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSse(buffer);
        buffer = parsed.rest;
        for (const ev of parsed.events) {
          if (ev.name === 'hello') { attempt = 0; onStatus?.(true); }
          else if (ev.name === 'update') {
            try { onUpdate?.(JSON.parse(ev.data).type); } catch { /* a malformed event is ignored */ }
          }
        }
      }
    } catch { /* closed, offline or aborted: handled below */ }
    onStatus?.(false);
    if (!stopped) timer = setTimeout(run, reconnectDelay(attempt++));
  };

  run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    controller?.abort();
  };
}
