import React, { useEffect, useRef, useState } from 'react';
import firebaseConfig from '../../firebase-applet-config.json';

interface CredentialResponse {
  credential?: string;
}

interface GoogleAccountsIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    ux_mode?: 'popup' | 'redirect';
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
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  const clientId = (firebaseConfig as { oAuthClientId?: string }).oAuthClientId;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    let cancelled = false;

    loadGsiScript().then((loaded) => {
      if (cancelled || !loaded || !containerRef.current) return;
      const gsi = window.google?.accounts?.id;
      if (!gsi) return;

      try {
        gsi.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) {
              void callbackRef.current(response.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          ux_mode: 'popup',
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
        setReady(true);
      } catch {
        setReady(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) return null;

  return (
    <div
      className={ready ? 'mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5' : 'hidden'}
    >
      <p className="text-xs font-semibold text-emerald-950">
        থার্ড-পার্টি কুকি বন্ধ থাকলে — সরাসরি Google অ্যাকাউন্ট দিয়ে সাইন ইন:
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-emerald-800">
        উপরের বাটনে ক্লিক করার পর আবার লগইন পেজে ফিরে আসলে নিচের বাটন ব্যবহার
        করুন (এটি ব্রাউজারের কুকি-ব্লক থাকলেও কাজ করে):
      </p>
      <div
        className={`mt-2.5 inline-block ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <div ref={containerRef} />
      </div>
    </div>
  );
};
