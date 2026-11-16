import { VisitorSummary } from '../types/siteSettings';

const VISITOR_STORAGE_KEY = 'jt_visitor_id_v1';

function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const created = `v_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    localStorage.setItem(VISITOR_STORAGE_KEY, created);
    return created;
  } catch {
    return `v_${Date.now().toString(36)}`;
  }
}

export async function trackVisitorEvent(payload: {
  type: 'pageview' | 'search' | 'download';
  path?: string;
  label?: string;
}): Promise<void> {
  try {
    const visitorId = getOrCreateVisitorId();
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        type: payload.type,
        path: payload.path || window.location.pathname || '/',
        label: (payload.label || '').slice(0, 120),
        visitorId,
        referrer: document.referrer ? document.referrer.slice(0, 180) : 'Direct',
      }),
    });
  } catch {
    // Non-blocking visitor analytics
  }
}

export async function fetchVisitorSummary(
  idToken: string
): Promise<VisitorSummary> {
  const res = await fetch('/api/analytics/summary', {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error || 'ভিজিটর পরিসংখ্যান লোড করতে সমস্যা হয়েছে।'
    );
  }
  return res.json();
}

export async function resetVisitorStats(idToken: string): Promise<void> {
  const res = await fetch('/api/analytics/reset', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error || 'ভিজিটর পরিসংখ্যান রিসেট করা যায়নি।'
    );
  }
}

export function startVisitorPresence(getPath: () => string): () => void {
  const visitorId = getOrCreateVisitorId();
  let stopped = false;

  const sendHeartbeat = () => {
    if (stopped) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    fetch('/api/analytics/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        visitorId,
        path: getPath().slice(0, 120),
      }),
    }).catch(() => {});
  };

  const sendLeave = () => {
    const body = JSON.stringify({ visitorId });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/leave', blob);
      return;
    }
    fetch('/api/analytics/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body,
    }).catch(() => {});
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      sendHeartbeat();
    }
  };

  sendHeartbeat();
  const intervalId = window.setInterval(sendHeartbeat, 20_000);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('pagehide', sendLeave);

  return () => {
    stopped = true;
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('pagehide', sendLeave);
    sendLeave();
  };
}

export function subscribeVisitorStream(
  getToken: () => Promise<string>,
  onSummary: (summary: VisitorSummary) => void,
  onStatus: (connected: boolean) => void,
  onError: (err: Error) => void
): () => void {
  let closed = false;
  let activeController: AbortController | null = null;
  let reconnectTimer: number | null = null;

  const connect = async () => {
    if (closed) return;
    activeController = new AbortController();
    try {
      const idToken = await getToken();
      if (closed) return;

      const res = await fetch('/api/analytics/stream', {
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'text/event-stream',
        },
        signal: activeController.signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson?.error || 'রিয়েল-টাইম ভিজিটর স্ট্রিম সংযোগ ব্যর্থ হয়েছে।'
        );
      }

      if (!res.body) {
        throw new Error('SSE stream not supported by browser.');
      }

      onStatus(true);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIdx = buffer.indexOf('\n\n');
        while (sepIdx !== -1) {
          const chunk = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          sepIdx = buffer.indexOf('\n\n');

          const dataLines = chunk
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim());

          if (dataLines.length > 0) {
            try {
              const parsed = JSON.parse(dataLines.join('\n')) as VisitorSummary;
              onSummary(parsed);
            } catch {
              // ignore malformed chunk
            }
          }
        }
      }
    } catch (err) {
      if (closed) return;
      onStatus(false);
      onError(
        err instanceof Error
          ? err
          : new Error('রিয়েল-টাইম সংযোগ বিচ্ছিন্ন হয়েছে।')
      );
    }

    if (!closed) {
      onStatus(false);
      reconnectTimer = window.setTimeout(connect, 3000);
    }
  };

  connect();

  return () => {
    closed = true;
    onStatus(false);
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
    }
    if (activeController) {
      activeController.abort();
    }
  };
}
