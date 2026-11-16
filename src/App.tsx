import { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  clearDriveAccessToken,
  getAccessToken,
  googleSignIn,
  googleSignInRedirect,
  initAuth,
  logout,
} from './lib/firebase';
import {
  checkIsAdmin,
  subscribePublicFlashFiles,
} from './lib/flashFilesRepo';
import { subscribeSiteSettings } from './lib/siteSettingsRepo';
import {
  startVisitorPresence,
  trackVisitorEvent,
} from './lib/analyticsClient';
import { FlashFileRecord } from './types/flashFile';
import { DEFAULT_SITE_SETTINGS, SiteSettings } from './types/siteSettings';
import { Navbar } from './components/Navbar';
import { PublicCatalog } from './components/PublicCatalog';
import { AdminPanel } from './components/AdminPanel';
import { AdSenseScriptLoader } from './components/AdSenseBanner';
import { LegalPoliciesModal, PolicyTab } from './components/LegalPoliciesModal';
import { CookieConsentBanner } from './components/CookieConsentBanner';

export default function App() {
  const [activeView, setActiveView] = useState<'catalog' | 'admin'>('catalog');

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

  // Track public pageview once per initial load & keep real-time presence heartbeat
  useEffect(() => {
    trackVisitorEvent({
      type: 'pageview',
      path: window.location.pathname || '/',
      label: 'Jonnoi Telecom Home',
    });
    const stopPresence = startVisitorPresence(
      () => window.location.pathname || '/'
    );
    return () => stopPresence();
  }, []);

  // Subscribe to Auth State
  useEffect(() => {
    const unsubscribeAuth = initAuth(
      async (firebaseUser, token) => {
        setUser(firebaseUser);
        setAccessToken(token || getAccessToken());
        if (firebaseUser) {
          setAuthRedirectError(null);
          const adminStatus = await checkIsAdmin(
            firebaseUser.uid,
            firebaseUser.email,
            firebaseUser.emailVerified
          );
          setIsAdmin(adminStatus);
        } else {
          setIsAdmin(false);
        }
        setAuthChecking(false);
      },
      (errMessage) => {
        setAuthRedirectError(errMessage);
      }
    );

    return () => unsubscribeAuth();
  }, []);

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

  const handleGoogleLogin = async (forceDriveConsent = false) => {
    setAuthRedirectError(null);
    const result = await googleSignIn(forceDriveConsent);
    if (result) {
      setUser(result.user);
      setAccessToken(result.accessToken);
      const adminStatus = await checkIsAdmin(
        result.user.uid,
        result.user.email,
        result.user.emailVerified
      );
      setIsAdmin(adminStatus);
    }
  };

  const handleGoogleLoginRedirect = async (forceDriveConsent = false) => {
    setAuthRedirectError(null);
    await googleSignInRedirect(forceDriveConsent);
  };

  const handleClearDriveToken = useCallback(() => {
    clearDriveAccessToken();
    setAccessToken(null);
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setIsAdmin(false);
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

      <Navbar
        activeView={activeView}
        onNavigateView={setActiveView}
        isAdminSignedIn={Boolean(user && isAdmin)}
        headerBgTheme={siteSettings.headerBgTheme}
      />

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
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium text-slate-700">
              {siteSettings.shopName} · যোগাযোগ:{' '}
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
