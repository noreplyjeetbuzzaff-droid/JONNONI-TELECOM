import React, { useEffect, useRef } from 'react';

interface AdSenseScriptLoaderProps {
  enabled: boolean;
  publisherId: string;
}

export const AdSenseScriptLoader: React.FC<AdSenseScriptLoaderProps> = ({
  enabled,
  publisherId,
}) => {
  useEffect(() => {
    const cleanId = publisherId.trim();
    if (!enabled || !/^ca-pub-\d{10,20}$/.test(cleanId)) {
      return;
    }

    // Add <meta name="google-adsense-account" content="..."> for AdSense verification
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="google-adsense-account"]'
    );
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'google-adsense-account';
      document.head.appendChild(meta);
    }
    meta.content = cleanId;

    // Load AdSense script once (skip if already embedded in index.html)
    const scriptId = 'google-adsense-script';
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
    );
    if (!document.getElementById(scriptId) && !existingScript) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        cleanId
      )}`;
      document.head.appendChild(script);
    }
  }, [enabled, publisherId]);

  return null;
};

interface AdSenseUnitProps {
  enabled: boolean;
  publisherId: string;
  slotId: string;
}

export const AdSenseUnit: React.FC<AdSenseUnitProps> = ({
  enabled,
  publisherId,
  slotId,
}) => {
  const cleanPub = publisherId.trim();
  const cleanSlot = slotId.trim();
  const insRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    if (
      !enabled ||
      !/^ca-pub-\d{10,20}$/.test(cleanPub) ||
      !/^\d{6,20}$/.test(cleanSlot)
    ) {
      return;
    }

    const insEl = insRef.current;
    if (!insEl || insEl.getAttribute('data-adsbygoogle-status')) {
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        if (insEl.getAttribute('data-adsbygoogle-status')) return;
        const w = window as unknown as { adsbygoogle?: unknown[] };
        w.adsbygoogle = w.adsbygoogle || [];
        w.adsbygoogle.push({});
      } catch {
        // AdSense script blocked by ad-blocker or domain still under review
      }
    }, 150);

    return () => window.clearTimeout(timer);
  }, [enabled, cleanPub, cleanSlot]);

  if (
    !enabled ||
    !/^ca-pub-\d{10,20}$/.test(cleanPub) ||
    !/^\d{6,20}$/.test(cleanSlot)
  ) {
    return null;
  }

  return (
    <div className="mx-auto my-4 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-center">
        <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">
          বিজ্ঞাপন
        </p>
        <ins
          ref={insRef}
          className="adsbygoogle block w-full"
          style={{ display: 'block', minHeight: '90px' }}
          data-ad-client={cleanPub}
          data-ad-slot={cleanSlot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
};
