import React, { useEffect, useRef, useState } from 'react';
import firebaseConfig from '../../firebase-applet-config.json';

interface CredentialResponse {
  credential?: string;
}

interface PromptMomentNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
}

interface GoogleAccountsIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    ux_mode?: 'popup' | 'redirect';
    use_fedcm_for_prompt?: boolean;
    use_fedcm_for_button?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      logo_alignment?: 'left' | 'center';
      width?: number;
    }
  ) => void;
  prompt: (
    momentListener?: (notification: PromptMomentNotification) => void
  ) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsIdApi;
      };
    };
  }
}

interface GoogleIdentitySignInProps {
  onCredential: (idToken: string) => Promise<void>;
  disabled?: boolean;
  highlight?: boolean;
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let gsiScriptPromise: Promise<boolean> | null = null;

function loadGsiScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.google?.accounts?.id) return Promise.resolve(true);
  if (gsiScriptPromise) return gsiScriptPromise;

  gsiScriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener('load', () =>
        resolve(Boolean(window.google?.accounts?.id))
      );
      existing.addEventListener('error', () => resolve(false));
      setTimeout(() => resolve(Boolean(window.google?.accounts?.id)), 2500);
      return;
    }

    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(Boolean(window.google?.accounts?.id));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return gsiScriptPromise;
}

export const GoogleIdentitySignIn: React.FC<GoogleIdentitySignInProps> = ({
  onCredential,
  disabled = false,
  highlight = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  const clientId = (firebaseConfig as { oAuthClientId?: string }).oAuthClientId;
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
    'loading'
  );
  const [promptHint, setPromptHint] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId || !containerRef.current) {
      setStatus('unavailable');
      return;
    }
    let cancelled = false;

    loadGsiScript().then((loaded) => {
      if (cancelled || !containerRef.current) return;
      const gsi = window.google?.accounts?.id;
      if (!loaded || !gsi) {
        setStatus('unavailable');
        return;
      }

      try {
        gsi.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) {
              setPromptHint(null);
              void callbackRef.current(response.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          ux_mode: 'popup',
          use_fedcm_for_prompt: true,
          use_fedcm_for_button: true,
        });

        containerRef.current.innerHTML = '';
        gsi.renderButton(containerRef.current, {
          theme: 'filled_blue',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 280,
        });
        setStatus('ready');
      } catch {
        setStatus('unavailable');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const handleOneTapPrompt = () => {
    setPromptHint(null);
    const gsi = window.google?.accounts?.id;
    if (!gsi) {
      setPromptHint('Google Identity সার্ভিস এখনও লোড হয়নি।');
      return;
    }
    try {
      gsi.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setPromptHint(
            'সরাসরি Google প্রম্পট এই ব্রাউজার/ফ্রেমে বন্ধ রয়েছে — নিচের নীল Google বাটনে ক্লিক করুন অথবা নতুন ট্যাবে খুলুন।'
          );
        }
      });
    } catch {
      setPromptHint(
        'সরাসরি প্রম্পট খোলা যায়নি — নিচের বাটন বা নতুন ট্যাব ব্যবহার করুন।'
      );
    }
  };

  if (!clientId || status === 'unavailable') return null;

  return (
    <div
      className={`mt-4 rounded-lg border p-3.5 transition-colors ${
        highlight
          ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
          : 'border-emerald-200 bg-emerald-50/70'
      }`}
    >
      <p className="text-xs font-semibold text-emerald-950">
        পপআপ বা থার্ড-পার্টি কুকি ব্লক থাকলে — সরাসরি Google সাইন-ইন (FedCM):
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-emerald-800">
        নিচের বাটনটি ব্রাউজারের পপআপ ও কুকি-ব্লক এড়িয়ে সরাসরি Google
        অ্যাকাউন্ট দিয়ে লগইন করতে সাহায্য করে:
      </p>

      <div
        className={`mt-2.5 min-h-[44px] flex flex-wrap items-center gap-2.5 ${
          disabled ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        {/* Keep container visibly mounted (never display:none) so GIS iframe renders cleanly */}
        <div ref={containerRef} className="inline-block min-h-[40px]" />

        {status === 'ready' && (
          <button
            type="button"
            onClick={handleOneTapPrompt}
            disabled={disabled}
            className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 cursor-pointer"
          >
            ওয়ান-ট্যাপ লগইন চেষ্টা করুন
          </button>
        )}
      </div>

      {status === 'loading' && (
        <p className="mt-1 text-[11px] text-emerald-700">
          Google সাইন-ইন বাটন লোড হচ্ছে...
        </p>
      )}
      {promptHint && (
        <p className="mt-2 text-[11px] font-medium text-amber-800">
          {promptHint}
        </p>
      )}
    </div>
  );
};
