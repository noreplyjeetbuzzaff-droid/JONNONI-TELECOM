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
