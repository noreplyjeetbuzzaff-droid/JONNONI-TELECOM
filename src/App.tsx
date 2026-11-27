import { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  auth,
  clearDriveAccessToken,
  consumePendingAdminRedirect,
  getAccessToken,
  getEffectiveUserEmail,
  GoogleConsentMode,
  googleSignIn,
  googleSignInRedirect,
  initAuth,
  logout,
  PENDING_ADMIN_REDIRECT_KEY,
} from './lib/firebase';
import { recordAdminLoginEvent } from './lib/loginHistoryRepo';
import {
  checkIsAdmin,
  subscribePublicFlashFiles,
} from './lib/flashFilesRepo';
import { subscribeSiteSettings } from './lib/siteSettingsRepo';
import {
  startVisitorPresence,
  trackInitialPageviewOnce,
} from './lib/analyticsClient';
import { FlashFileRecord } from './types/flashFile';
import { DEFAULT_SITE_SETTINGS, SiteSettings } from './types/siteSettings';
import { Navbar } from './components/Navbar';
import { PublicCatalog } from './components/PublicCatalog';
import { AdminPanel } from './components/AdminPanel';
import { AdSenseScriptLoader } from './components/AdSenseBanner';
import { LegalPoliciesModal, PolicyTab } from './components/LegalPoliciesModal';
import { CookieConsentBanner } from './components/CookieConsentBanner';

function getInitialActiveView(): 'catalog' | 'admin' {
  if (typeof window === 'undefined') return 'catalog';
  try {
    const url = new URL(window.location.href);
    if (
      url.searchParams.get('view') === 'admin' ||
      url.searchParams.has('admin') ||
      url.pathname === '/admin' ||
      url.hash === '#admin'
    ) {
      return 'admin';
    }
    if (sessionStorage.getItem(PENDING_ADMIN_REDIRECT_KEY) === '1') {
      return 'admin';
    }
  } catch {
    // Ignore URL or storage parsing errors
  }
  return 'catalog';
}

export default function App() {
  const [activeView, setActiveView] = useState<'catalog' | 'admin'>(() =>
    getInitialActiveView()
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (activeView === 'admin') {
        if (url.searchParams.get('view') !== 'admin') {
          url.searchParams.set('view', 'admin');
          window.history.replaceState(null, '', url.toString());
        }
      } else if (url.searchParams.has('view') || url.searchParams.has('admin')) {
        url.searchParams.delete('view');
        url.searchParams.delete('admin');
        window.history.replaceState(null, '', url.toString());
      }
    } catch {
      // Ignore history API errors inside restricted iframes
    }
  }, [activeView]);

  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authRedirectError, setAuthRedirectError] = useState<string | null>(
    null
  );

  const [publicFiles, setPublicFiles] = useState<FlashFileRecord[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState<string | null>(null);

  const [siteSettings, setSiteSettings] = useState<SiteSettings>(
    DEFAULT_SITE_SETTINGS
  );
  const [policyTab, setPolicyTab] = useState<PolicyTab | null>(null);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  // Google Maps Platform Quota Exceeded Listener (Case A Demo Key)
  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () =>
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  // Dynamic Canonical & OpenGraph URL Resolution for SEO
  useEffect(() => {
    const currentUrl = window.location.origin + window.location.pathname;
    let canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    );
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = currentUrl;

    let ogUrl = document.querySelector<HTMLMetaElement>(
      'meta[property="og:url"]'
    );
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.content = currentUrl;
  }, []);

  // Dynamic SEO Meta Description & Keywords Sync from Firestore
  useEffect(() => {
    const desc =
      siteSettings.seoDescription?.trim() || DEFAULT_SITE_SETTINGS.seoDescription;
    const kw =
      siteSettings.seoKeywords?.trim() || DEFAULT_SITE_SETTINGS.seoKeywords;

    const upsertMeta = (
      selector: string,
      attrKey: 'name' | 'property',
      attrVal: string,
      content: string
    ) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrKey, attrVal);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    upsertMeta('meta[name="description"]', 'name', 'description', desc);
    upsertMeta('meta[name="keywords"]', 'name', 'keywords', kw);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', desc);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', desc);
  }, [siteSettings.seoDescription, siteSettings.seoKeywords]);

  // Track public pageview once per session (prevents recounting on F5/refresh) & keep live presence on catalog
  useEffect(() => {
    if (activeView === 'admin') return;
    trackInitialPageviewOnce({
      path: window.location.pathname || '/',
      label: 'Jonnoi Telecom Home',
    });
    const stopPresence = startVisitorPresence(
      () => window.location.pathname || '/'
    );
    return () => stopPresence();
  }, [activeView]);

  const resolveAdminForUser = useCallback(async (firebaseUser: User) => {
    let resolvedEmail = getEffectiveUserEmail(firebaseUser);
    let resolvedVerified = firebaseUser.emailVerified;
    const hasGoogleProvider =
      firebaseUser.providerData?.some(
        (p) => p?.providerId === 'google.com'
      ) ?? false;

    if (!resolvedEmail) {
      try {
        const tokenRes = await firebaseUser.getIdTokenResult();
        const claimEmail = tokenRes.claims?.email;
        if (typeof claimEmail === 'string' && claimEmail.trim()) {
          resolvedEmail = claimEmail.trim();
        }
        if (tokenRes.claims?.email_verified === true) {
          resolvedVerified = true;
        }
      } catch {
        // Ignore token claim fallback error
      }
    }

    return checkIsAdmin(
      firebaseUser.uid,
      resolvedEmail,
      resolvedVerified,
      hasGoogleProvider
    );
  }, []);

  // Subscribe to Auth State
  useEffect(() => {
    const unsubscribeAuth = initAuth(
      async (firebaseUser, token) => {
        try {
          if (firebaseUser) {
            setAuthChecking(true);
            setUser(firebaseUser);
            setAccessToken(token || getAccessToken());
            setAuthRedirectError(null);

            const adminStatus = await resolveAdminForUser(firebaseUser);
            setIsAdmin(adminStatus);
            if (adminStatus) {
              if (consumePendingAdminRedirect()) {
                setActiveView('admin');
              }
              try {
                const sessionKey = `jt_login_logged_${firebaseUser.uid}`;
                if (!sessionStorage.getItem(sessionKey)) {
                  sessionStorage.setItem(sessionKey, '1');
                  recordAdminLoginEvent({
                    user: firebaseUser,
                    eventType: 'admin_login',
                    status: 'success',
                  });
                }
              } catch {
                // ignore sessionStorage failure
              }
            }
          } else {
            setUser(null);
            setAccessToken(null);
            setIsAdmin(false);
          }
        } finally {
          setAuthChecking(false);
        }
      },
      (errMessage) => {
        setAuthRedirectError(errMessage);
        setAuthChecking(false);
      }
    );

    return () => unsubscribeAuth();
  }, [resolveAdminForUser]);

  // Subscribe to Public Catalog Files
  useEffect(() => {
    setPublicLoading(true);
    setPublicError(null);
    const unsubscribeFiles = subscribePublicFlashFiles(
      (files) => {
        setPublicFiles(files);
        setPublicLoading(false);
      },
      (err) => {
        setPublicError(err.message);
        setPublicLoading(false);
      }
    );

    return () => unsubscribeFiles();
  }, []);

  // Subscribe to Public Site Settings (Shop Map On/Off, Header BG Theme, AdSense)
  useEffect(() => {
    const unsubscribeSettings = subscribeSiteSettings((settings) => {
      setSiteSettings(settings);
    });
    return () => unsubscribeSettings();
  }, []);

  const handleGoogleLogin = async (
    forceDriveConsent: GoogleConsentMode = false
  ) => {
    setAuthRedirectError(null);
    try {
      const result = await googleSignIn(forceDriveConsent);
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        const hasGoogleProvider =
          result.user.providerData?.some(
            (p) => p?.providerId === 'google.com'
          ) ?? false;
        const adminStatus = await checkIsAdmin(
          result.user.uid,
          getEffectiveUserEmail(result.user),
          result.user.emailVerified,
          hasGoogleProvider
        );
        setIsAdmin(adminStatus);
        if (adminStatus) {
          setActiveView('admin');
          if (forceDriveConsent === 'gmail') {
            recordAdminLoginEvent({
              user: result.user,
              eventType: 'gmail_connect',
              status: 'success',
            });
          } else if (
            forceDriveConsent === true ||
            forceDriveConsent === 'drive'
          ) {
            recordAdminLoginEvent({
              user: result.user,
              eventType: 'drive_connect',
              status: 'success',
            });
          } else {
            try {
              sessionStorage.setItem(`jt_login_logged_${result.user.uid}`, '1');
            } catch {
              // ignore
            }
            recordAdminLoginEvent({
              user: result.user,
              eventType: 'admin_login',
              status: 'success',
            });
          }
        }
      }
    } catch (err) {
      if (auth.currentUser && !forceDriveConsent) {
        const recoveredAdmin = await resolveAdminForUser(auth.currentUser);
        setUser(auth.currentUser);
        setIsAdmin(recoveredAdmin);
        if (recoveredAdmin) {
          setActiveView('admin');
          return;
        }
      }
      if (user && isAdmin && forceDriveConsent) {
        const msg = err instanceof Error ? err.message : String(err || '');
        const isBlocked =
          msg.toLowerCase().includes('access_denied') ||
          msg.includes('ব্লক') ||
          msg.toLowerCase().includes('blocked');
        recordAdminLoginEvent({
          user,
          eventType: 'drive_blocked',
          status: isBlocked ? 'blocked' : 'failed',
          errorMessage: msg,
        });
      }
      throw err;
    }
  };

  const handleGoogleLoginRedirect = async (
    forceDriveConsent: GoogleConsentMode = false
  ) => {
    setAuthRedirectError(null);
    await googleSignInRedirect(forceDriveConsent);
  };

  const handleClearDriveToken = useCallback(() => {
    clearDriveAccessToken();
    setAccessToken(null);
  }, []);

  const handleLogout = async () => {
    consumePendingAdminRedirect();
    if (user && isAdmin) {
      try {
        sessionStorage.removeItem(`jt_login_logged_${user.uid}`);
      } catch {
        // ignore
      }
      await recordAdminLoginEvent({
        user,
        eventType: 'logout',
        status: 'success',
      });
    }
    await logout();
    setUser(null);
    setAccessToken(null);
    setIsAdmin(false);
  };

  const handleSwitchAccount = async () => {
    clearDriveAccessToken();
    setAccessToken(null);
    await handleGoogleLogin(false);
  };

  const handleReverifyAdmin = async () => {
    const active = auth.currentUser;
    if (!active) return;
    setAuthChecking(true);
    try {
      await active.reload().catch(() => {});
      await active.getIdToken(true).catch(() => {});
      const adminStatus = await resolveAdminForUser(active);
      setUser(active);
      setIsAdmin(adminStatus);
      if (adminStatus) {
        setActiveView('admin');
      }
    } finally {
      setAuthChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <AdSenseScriptLoader
        enabled={siteSettings.adsenseEnabled}
        publisherId={siteSettings.adsensePublisherId}
      />

      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <div className="print:hidden">
        <Navbar
          activeView={activeView}
          onNavigateView={setActiveView}
          isAdminSignedIn={Boolean(user && isAdmin)}
          headerBgTheme={siteSettings.headerBgTheme}
        />
      </div>

      <main className="flex-1">
        {activeView === 'catalog' ? (
          <PublicCatalog
            files={publicFiles}
            loading={publicLoading}
            error={publicError}
            siteSettings={siteSettings}
            onOpenAdmin={() => setActiveView('admin')}
          />
        ) : (
          <AdminPanel
            user={user}
            accessToken={accessToken}
            isAdmin={isAdmin}
            authChecking={authChecking}
            authRedirectError={authRedirectError}
            siteSettings={siteSettings}
            onGoogleLogin={handleGoogleLogin}
            onGoogleLoginRedirect={handleGoogleLoginRedirect}
            onClearDriveToken={handleClearDriveToken}
            onLogout={handleLogout}
            onSwitchAccount={handleSwitchAccount}
            onReverifyAdmin={handleReverifyAdmin}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium text-slate-700">
              {siteSettings.shopName} ·{' '}
              {siteSettings.shopAddress || 'মানিকগঞ্জ, খানসামা, দিনাজপুর'} ·
              যোগাযোগ:{' '}
              <a
                href="tel:01738266366"
                className="font-mono font-semibold text-slate-900 hover:text-sky-700"
              >
                01738266366
              </a>
            </p>
            <div className="flex flex-wrap items-center gap-4 sm:gap-5">
              <button
                type="button"
                onClick={() => setActiveView('catalog')}
                className="hover:text-slate-900 cursor-pointer"
              >
                ফাইল ক্যাটালগ
              </button>
              <button
                type="button"
                onClick={() => setPolicyTab('about')}
                className="hover:text-slate-900 cursor-pointer"
              >
                আমাদের সম্পর্কে
              </button>
              <button
                type="button"
                onClick={() => setPolicyTab('privacy')}
                className="hover:text-slate-900 cursor-pointer"
              >
                গোপনীয়তা নীতি
              </button>
              <button
                type="button"
                onClick={() => setPolicyTab('terms')}
                className="hover:text-slate-900 cursor-pointer"
              >
                শর্তাবলী
              </button>
              <button
                type="button"
                onClick={() => setPolicyTab('disclaimer')}
                className="hover:text-slate-900 cursor-pointer"
              >
                ডিসক্লেইমার ও DMCA
              </button>
              <button
                type="button"
                onClick={() => setActiveView('admin')}
                className="font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                অ্যাডমিন প্যানেল
              </button>
            </div>
          </div>
        </div>
      </footer>

      <LegalPoliciesModal
        activeTab={policyTab}
        onSelectTab={setPolicyTab}
        onClose={() => setPolicyTab(null)}
      />

      <CookieConsentBanner onOpenPrivacy={() => setPolicyTab('privacy')} />
    </div>
  );
}
