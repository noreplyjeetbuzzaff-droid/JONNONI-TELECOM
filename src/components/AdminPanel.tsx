import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Activity,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  FolderOpen,
  Globe,
  HardDrive,
  History,
  Link2,
  Lock,
  LogOut,
  MapPin,
  Megaphone,
  Monitor,
  Palette,
  Pencil,
  Printer,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  CATEGORY_LABELS_BN,
  CHIPSET_LABELS_BN,
  CHIPSET_PLATFORMS,
  ChipsetPlatform,
  COMMON_BRANDS,
  FILE_CATEGORIES,
  FileCategory,
  FlashFileRecord,
  formatBytes,
  formatPriceBn,
  formatTimestamp,
  UpdateFlashFileInput,
} from '../types/flashFile';
import {
  DEFAULT_SITE_SETTINGS,
  getContrastTextColor,
  HEADER_THEME_META,
  HeaderBgTheme,
  isValidHexColor,
  SiteSettings,
  TICKER_COLOR_PRESETS,
  VisitorSummary,
} from '../types/siteSettings';
import {
  createFlashFileRecord,
  deleteFlashFileRecord,
  subscribeAdminFlashFiles,
  updateFlashFileRecord,
} from '../lib/flashFilesRepo';
import { saveSiteSettings } from '../lib/siteSettingsRepo';
import {
  fetchVisitorSummary,
  resetVisitorStats,
  subscribeVisitorStream,
} from '../lib/analyticsClient';
import {
  deleteDriveFile,
  DriveStorageInfo,
  ensureAppFolder,
  getDriveStorageInfo,
  setDrivePublicPermission,
  uploadFileToDrive,
} from '../lib/googleDrive';
import {
  checkTokenScopes,
  getEffectiveUserEmail,
  getStoredDriveProfile,
  GoogleConsentMode,
  isBootstrappedAdminEmail,
  isPrimaryAdminEmail,
  markDriveLinkedForEmail,
} from '../lib/firebase';
import {
  ClientDeviceInfo,
  detectClientDeviceInfo,
} from '../lib/loginHistoryRepo';
import {
  ADMIN_ROLE_META,
  AdminAccessState,
  createDeniedAdminAccess,
  DEFAULT_ALL_PERMISSIONS,
  DEFAULT_SECONDARY_PERMISSIONS,
} from '../types/adminAccess';
import { AdminManagementTab } from './AdminManagementTab';
import { AdminSeoModule } from './AdminSeoModule';
import { GoogleSignInButton } from './GoogleSignInButton';
import { ConfirmDialog } from './ConfirmDialog';
import { EditFileModal } from './EditFileModal';
import { LoadingSpinner } from './LoadingSpinner';
import { LoginHistoryTab } from './LoginHistoryTab';
import { ShopMapSection } from './ShopMapSection';

interface AdminPanelProps {
  user: User | null;
  accessToken: string | null;
  driveLinked?: boolean;
  isAdmin: boolean;
  adminAccess?: AdminAccessState;
  authChecking: boolean;
  authRedirectError?: string | null;
  autoLogoutNotice?: string | null;
  idleRemainingSeconds?: number;
  siteSettings: SiteSettings;
  onGoogleLogin: (forceDriveConsent?: GoogleConsentMode) => Promise<void>;
  onClearDriveToken?: () => void;
  onEnsureDriveToken?: (forceFresh?: boolean) => Promise<string | null>;
  onUnlinkDrive?: () => void;
  onLogout: () => Promise<void>;
  onSwitchAccount?: () => Promise<void>;
  onReverifyAdmin?: () => Promise<void>;
}

function isDriveScopeOrAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return (
    msg.includes('403') ||
    msg.includes('401') ||
    msg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
    msg.includes('insufficientPermissions')
  );
}

function extractGoogleDriveFileId(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{10,120}$/.test(trimmed)) {
    return trimmed;
  }
  const pathMatch = trimmed.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{5,120})/);
  if (pathMatch?.[1]) return pathMatch[1];
  try {
    const url = new URL(trimmed);
    const idParam = url.searchParams.get('id');
    if (idParam && /^[a-zA-Z0-9_-]{5,120}$/.test(idParam)) {
      return idParam;
    }
  } catch {
    // not a valid URL
  }
  return null;
}

type AdminTab = 'files' | 'visitors' | 'seo' | 'settings' | 'admins' | 'history';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  user,
  accessToken,
  driveLinked = false,
  isAdmin,
  adminAccess,
  authChecking,
  authRedirectError,
  autoLogoutNotice,
  idleRemainingSeconds = 900,
  siteSettings,
  onGoogleLogin,
  onClearDriveToken,
  onEnsureDriveToken,
  onUnlinkDrive,
  onLogout,
  onSwitchAccount,
  onReverifyAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('files');
  const [currentDevice, setCurrentDevice] = useState<ClientDeviceInfo | null>(
    null
  );

  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const [driveInfo, setDriveInfo] = useState<DriveStorageInfo | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);

  const [adminFiles, setAdminFiles] = useState<FlashFileRecord[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [adminSearch, setAdminSearch] = useState('');

  // Upload form state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [driveLinkInput, setDriveLinkInput] = useState('');
  const [linkFileName, setLinkFileName] = useState('');
  const [linkFileSizeMb, setLinkFileSizeMb] = useState('0');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [brandSelect, setBrandSelect] = useState<string>('Samsung');
  const [customBrand, setCustomBrand] = useState<string>('');
  const [model, setModel] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FileCategory>('Stock Firmware');
  const [chipset, setChipset] = useState<ChipsetPlatform>('MediaTek (MTK)');
  const [version, setVersion] = useState('');
  const [price, setPrice] = useState<string>('0');
  const [notes, setNotes] = useState('');
  const [makePublic, setMakePublic] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Edit & Delete state
  const [editingFile, setEditingFile] = useState<FlashFileRecord | null>(null);
  const [deletingFile, setDeletingFile] = useState<FlashFileRecord | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // Visitor Tracking State
  const [visitorSummary, setVisitorSummary] = useState<VisitorSummary | null>(
    null
  );
  const [visitorsLoading, setVisitorsLoading] = useState(false);
  const [visitorsError, setVisitorsError] = useState<string | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [confirmResetVisitors, setConfirmResetVisitors] = useState(false);
  const [resettingVisitors, setResettingVisitors] = useState(false);

  // Site Settings (24h Open/Off, Map On/Off, Header BG, AdSense) Draft State
  const [draftSettings, setDraftSettings] =
    useState<SiteSettings>(siteSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [togglingShop24h, setTogglingShop24h] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const effectiveEmail = getEffectiveUserEmail(user);
  const isPrimaryAdmin = isPrimaryAdminEmail(effectiveEmail);

  const effectiveAccess: AdminAccessState = useMemo(() => {
    if (adminAccess) return adminAccess;
    if (isPrimaryAdmin) {
      return {
        isAdmin: true,
        isPrimary: true,
        active: true,
        isSuspended: false,
        role: 'super_admin',
        permissions: { ...DEFAULT_ALL_PERMISSIONS },
      };
    }
    if (isAdmin) {
      return {
        isAdmin: true,
        isPrimary: false,
        active: true,
        isSuspended: false,
        role: 'admin',
        permissions: { ...DEFAULT_SECONDARY_PERMISSIONS },
      };
    }
    return createDeniedAdminAccess();
  }, [adminAccess, isPrimaryAdmin, isAdmin]);

  const isBootstrapped =
    isBootstrappedAdminEmail(effectiveEmail) || effectiveAccess.isAdmin;

  const canFiles = effectiveAccess.permissions.manageFiles;
  const canVisitors = effectiveAccess.permissions.viewVisitors;
  const canSeo = effectiveAccess.permissions.manageSeo;
  const canSettings = effectiveAccess.permissions.manageSettings;
  const canAdmins =
    effectiveAccess.isPrimary || effectiveAccess.permissions.manageAdmins;
  const canHistory = effectiveAccess.permissions.viewLoginHistory;

  const allowedTabs = useMemo<AdminTab[]>(() => {
    const list: AdminTab[] = [];
    if (canFiles) list.push('files');
    if (canVisitors) list.push('visitors');
    if (canSeo) list.push('seo');
    if (canSettings) list.push('settings');
    if (canAdmins) list.push('admins');
    if (canHistory) list.push('history');
    return list;
  }, [canFiles, canVisitors, canSeo, canSettings, canAdmins, canHistory]);

  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [activeTab, allowedTabs]);

  useEffect(() => {
    setDraftSettings(siteSettings);
  }, [siteSettings]);

  useEffect(() => {
    let cancelled = false;
    detectClientDeviceInfo()
      .then((info) => {
        if (!cancelled) setCurrentDevice(info);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user || !isAdmin || !canFiles) {
      setDriveInfo(null);
      return;
    }
    if (!accessToken) {
      const stored = getStoredDriveProfile(effectiveEmail);
      if (stored) {
        setDriveInfo({
          userEmail: stored.userEmail || stored.email,
          userName: stored.userName || '',
          usageBytes: stored.usageBytes || 0,
          limitBytes: stored.limitBytes ?? null,
        });
        setDriveError(null);
      } else {
        setDriveInfo(null);
      }
      return;
    }
    let cancelled = false;
    getDriveStorageInfo(accessToken)
      .then((info) => {
        if (!cancelled) {
          setDriveInfo(info);
          setDriveError(null);
          markDriveLinkedForEmail(effectiveEmail, info);
        }
      })
      .catch(async (err) => {
        if (cancelled) return;
        if (isDriveScopeOrAuthError(err)) {
          const scopes = await checkTokenScopes(accessToken);
          if (cancelled) return;
          if (!scopes.hasDrive) {
            onClearDriveToken?.();
            if (!driveLinked) {
              setDriveInfo(null);
              setDriveError(
                'গুগল ড্রাইভে ফাইল আপলোডের জন্য নিচের "গুগল ড্রাইভ সংযুক্ত করুন" বাটনে ক্লিক করে ড্রাইভ অনুমতি দিন।'
              );
            }
            return;
          }
          setDriveError(
            'গুগল ড্রাইভ সংযুক্ত আছে, তবে স্টোরেজ কোটার তথ্য পড়া যায়নি।'
          );
          return;
        }
        setDriveError(
          err instanceof Error
            ? err.message
            : 'গুগল ড্রাইভ অ্যাকাউন্টের তথ্য পড়া যায়নি।'
        );
      });
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin, canFiles, accessToken, driveLinked, effectiveEmail, onClearDriveToken]);

  useEffect(() => {
    if (!user || !isAdmin || !canFiles) {
      setAdminFiles([]);
      setFilesLoading(false);
      return;
    }
    setFilesLoading(true);
    setFilesError(null);
    const unsubscribe = subscribeAdminFlashFiles(
      user.uid,
      Boolean(isBootstrapped),
      (records) => {
        setAdminFiles(records);
        setFilesLoading(false);
      },
      (err) => {
        setFilesError(err.message);
        setFilesLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user, isAdmin, canFiles, isBootstrapped]);

  const loadVisitorAnalytics = async () => {
    if (!user || !isAdmin || !canVisitors) return;
    setVisitorsLoading(true);
    setVisitorsError(null);
    try {
      const idToken = await user.getIdToken();
      const summary = await fetchVisitorSummary(idToken);
      setVisitorSummary(summary);
    } catch (err) {
      setVisitorsError(
        err instanceof Error
          ? err.message
          : 'ভিজিটর পরিসংখ্যান লোড করতে সমস্যা হয়েছে।'
      );
    } finally {
      setVisitorsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'visitors' || !user || !isAdmin || !canVisitors) {
      setStreamConnected(false);
      return;
    }

    setVisitorsLoading(true);
    setVisitorsError(null);
    const unsubscribeStream = subscribeVisitorStream(
      () => user.getIdToken(),
      (summary) => {
        setVisitorSummary(summary);
        setVisitorsLoading(false);
        setVisitorsError(null);
      },
      (connected) => {
        setStreamConnected(connected);
      },
      (err) => {
        setVisitorsLoading(false);
        setVisitorsError(err.message);
      }
    );

    return () => {
      unsubscribeStream();
    };
  }, [activeTab, user, isAdmin, canVisitors]);

  const handleQuickToggleShop24Hours = async () => {
    if (!user || !canSettings || togglingShop24h) return;
    setTogglingShop24h(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const nextOpen = !siteSettings.shopOpen24Hours;
      const nextSettings: SiteSettings = {
        ...siteSettings,
        shopOpen24Hours: nextOpen,
      };
      const idToken = await user.getIdToken();
      await saveSiteSettings(user.uid, nextSettings, idToken);
      setDraftSettings((prev) => ({ ...prev, shopOpen24Hours: nextOpen }));
      setSettingsSuccess(
        nextOpen
          ? 'দোকান এখন "২৪ ঘণ্টা খোলা (ON)" হিসেবে লাইভ হয়েছে।'
          : 'দোকান এখন "বন্ধ (OFF)" হিসেবে আপডেট করা হয়েছে।'
      );
    } catch (err) {
      setSettingsError(
        err instanceof Error
          ? err.message
          : 'শপ স্ট্যাটাস পরিবর্তন করা যায়নি।'
      );
    } finally {
      setTogglingShop24h(false);
    }
  };

  const filteredAdminFiles = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();
    if (!q) return adminFiles;
    return adminFiles.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.brand.toLowerCase().includes(q) ||
        f.model.toLowerCase().includes(q) ||
        f.fileName.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    );
  }, [adminFiles, adminSearch]);

  const handleLoginClick = async (
    forceDriveConsent: GoogleConsentMode = false
  ) => {
    setLoggingIn(true);
    setLoginError(null);
    try {
      await onGoogleLogin(forceDriveConsent);
    } catch (err) {
      setLoginError(
        err instanceof Error
          ? err.message
          : 'গুগল সাইন-ইন বাতিল হয়েছে বা ব্যর্থ হয়েছে।'
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setUploadError(null);
    setUploadSuccess(null);
    if (file && !title.trim()) {
      const activeBrand =
        brandSelect === 'Other' ? customBrand.trim() : brandSelect;
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
      if (activeBrand && model.trim()) {
        setTitle(`${activeBrand} ${model.trim()} — ${cleanName}`.slice(0, 160));
      } else {
        setTitle(cleanName.slice(0, 160));
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!user) {
      setUploadError('অনুগ্রহ করে পুনরায় গুগল দিয়ে সাইন ইন করুন।');
      return;
    }

    const finalBrand =
      brandSelect === 'Other' ? customBrand.trim() : brandSelect.trim();
    if (!finalBrand) {
      setUploadError('অনুগ্রহ করে মোবাইল ব্র্যান্ডের নাম লিখুন।');
      return;
    }
    if (!model.trim()) {
      setUploadError('অনুগ্রহ করে মোবাইলের মডেল নাম বা মডেল কোড লিখুন।');
      return;
    }

    const parsedPrice = Math.max(0, Number(price) || 0);

    if (uploadMode === 'link') {
      const parsedDriveId = extractGoogleDriveFileId(driveLinkInput);
      if (!parsedDriveId) {
        setUploadError(
          'সঠিক Google Drive লিংক বা File ID দিন (যেমন: https://drive.google.com/file/d/1ABC.../view)।'
        );
        return;
      }
      const finalFileName =
        linkFileName.trim() ||
        `${finalBrand}_${model.trim().replace(/\s+/g, '_')}.zip`.slice(0, 200);
      const finalTitle =
        title.trim() ||
        `${finalBrand} ${model.trim()} ${finalFileName}`.slice(0, 160);
      if (finalTitle.length < 2) {
        setUploadError('ফাইলের শিরোনাম কমপক্ষে ২ অক্ষরের হতে হবে।');
        return;
      }
      const mbVal = Math.max(0, Number(linkFileSizeMb) || 0);
      const sizeBytes = Math.round(mbVal * 1024 * 1024);

      setUploading(true);
      setUploadProgress(50);
      try {
        setUploadStatus('ক্যাটালগে ড্রাইভ লিংক সংরক্ষণ হচ্ছে...');
        await createFlashFileRecord({
          title: finalTitle,
          brand: finalBrand,
          model: model.trim(),
          category,
          chipset,
          version: version.trim() || 'Universal',
          fileName: finalFileName,
          fileSizeBytes: sizeBytes,
          driveFileId: parsedDriveId,
          downloadUrl: `https://drive.google.com/uc?export=download&id=${parsedDriveId}`,
          viewUrl: `https://drive.google.com/file/d/${parsedDriveId}/view`,
          notes: notes.trim(),
          price: parsedPrice,
          isPublicDrive: makePublic,
          uploadedByUid: user.uid,
          uploadedByName: user.displayName || 'জননী টেলিকম অ্যাডমিন',
        });

        setUploadProgress(100);
        setUploadSuccess(
          `"${finalTitle}" সফলভাবে Google Drive লিংকসহ ক্যাটালগে প্রকাশ করা হয়েছে।`
        );
        setDriveLinkInput('');
        setLinkFileName('');
        setLinkFileSizeMb('0');
        setModel('');
        setTitle('');
        setVersion('');
        setPrice('0');
        setNotes('');
        setUploadProgress(0);
      } catch (err) {
        setUploadError(
          err instanceof Error
            ? err.message
            : 'ফাইল সংরক্ষণ ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
        );
      } finally {
        setUploading(false);
        setUploadStatus(null);
      }
      return;
    }

    let activeDriveToken = accessToken;
    if (!activeDriveToken && driveLinked && onEnsureDriveToken) {
      try {
        activeDriveToken = await onEnsureDriveToken(false);
      } catch (err) {
        setUploadError(
          err instanceof Error
            ? err.message
            : 'গুগল ড্রাইভ সেশন নবায়ন করা যায়নি।'
        );
        return;
      }
    }

    if (!activeDriveToken) {
      setUploadError(
        'গুগল ড্রাইভ সংযুক্ত নেই। উপরের "গুগল ড্রাইভ সংযুক্ত করুন" চাপুন অথবা "ড্রাইভ লিংক দিয়ে প্রকাশ" ট্যাব ব্যবহার করুন।'
      );
      return;
    }

    if (!selectedFile) {
      setUploadError(
        'অনুগ্রহ করে যেকোনো ফ্ল্যাশ টুল, ফার্মওয়্যার বা ড্রাইভার ফাইল নির্বাচন করুন।'
      );
      return;
    }

    const finalTitle =
      title.trim() ||
      `${finalBrand} ${model.trim()} ${selectedFile.name}`.slice(0, 160);
    if (finalTitle.length < 2) {
      setUploadError('ফাইলের শিরোনাম কমপক্ষে ২ অক্ষরের হতে হবে।');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const performDriveUpload = async (tokenToUse: string) => {
        setUploadStatus('গুগল ড্রাইভ ফোল্ডার প্রস্তুত হচ্ছে...');
        const folderId = await ensureAppFolder(tokenToUse);

        setUploadStatus('গুগল ড্রাইভে ফাইল আপলোড হচ্ছে...');
        return uploadFileToDrive({
          accessToken: tokenToUse,
          file: selectedFile,
          folderId,
          makePublic,
          onProgress: (pct) => setUploadProgress(pct),
        });
      };

      let driveResult;
      try {
        driveResult = await performDriveUpload(activeDriveToken);
      } catch (firstErr) {
        if (isDriveScopeOrAuthError(firstErr) && onEnsureDriveToken) {
          setUploadStatus('গুগল ড্রাইভ সেশন স্বয়ংক্রিয়ভাবে নবায়ন হচ্ছে...');
          const refreshedToken = await onEnsureDriveToken(true);
          if (!refreshedToken) {
            throw firstErr;
          }
          activeDriveToken = refreshedToken;
          driveResult = await performDriveUpload(refreshedToken);
        } else {
          throw firstErr;
        }
      }

      setUploadStatus('ক্যাটালগে ফাইলের তথ্য সংরক্ষণ হচ্ছে...');
      await createFlashFileRecord({
        title: finalTitle,
        brand: finalBrand,
        model: model.trim(),
        category,
        chipset,
        version: version.trim() || 'Universal',
        fileName: driveResult.fileName,
        fileSizeBytes: driveResult.fileSizeBytes,
        driveFileId: driveResult.driveFileId,
        downloadUrl: driveResult.downloadUrl,
        viewUrl: driveResult.viewUrl,
        notes: notes.trim(),
        price: parsedPrice,
        isPublicDrive: makePublic,
        uploadedByUid: user.uid,
        uploadedByName: user.displayName || 'জননী টেলিকম অ্যাডমিন',
      });

      setUploadSuccess(
        `"${finalTitle}" সফলভাবে গুগল ড্রাইভে আপলোড ও ক্যাটালগে প্রকাশ করা হয়েছে।`
      );
      setSelectedFile(null);
      setModel('');
      setTitle('');
      setVersion('');
      setPrice('0');
      setNotes('');
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (activeDriveToken) {
        getDriveStorageInfo(activeDriveToken)
          .then((info) => {
            setDriveInfo(info);
            markDriveLinkedForEmail(effectiveEmail, info);
          })
          .catch(() => {});
      }
    } catch (err) {
      if (isDriveScopeOrAuthError(err)) {
        onClearDriveToken?.();
        setUploadError(
          'গুগল ড্রাইভের অনুমতি বা সেশন নবায়ন করা যায়নি। পুনরায় ড্রাইভ সংযুক্ত করুন।'
        );
      } else {
        setUploadError(
          err instanceof Error
            ? err.message
            : 'আপলোড ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
        );
      }
    } finally {
      setUploading(false);
      setUploadStatus(null);
    }
  };

  const handleSaveEdit = async (
    file: FlashFileRecord,
    updates: UpdateFlashFileInput
  ) => {
    let tokenToUse = accessToken;
    if (!tokenToUse && driveLinked && updates.isPublicDrive !== file.isPublicDrive && onEnsureDriveToken) {
      tokenToUse = await onEnsureDriveToken(false);
    }
    if (tokenToUse && updates.isPublicDrive !== file.isPublicDrive) {
      try {
        await setDrivePublicPermission(
          tokenToUse,
          file.driveFileId,
          updates.isPublicDrive
        );
      } catch (err) {
        if (isDriveScopeOrAuthError(err) && onEnsureDriveToken) {
          const refreshed = await onEnsureDriveToken(true);
          if (refreshed) {
            await setDrivePublicPermission(
              refreshed,
              file.driveFileId,
              updates.isPublicDrive
            );
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }
    await updateFlashFileRecord(file.id, updates);
  };

  const handleConfirmDelete = async () => {
    if (!deletingFile) return;
    setDeletingBusy(true);
    setFilesError(null);
    try {
      let tokenToUse = accessToken;
      if (!tokenToUse && driveLinked && onEnsureDriveToken) {
        tokenToUse = await onEnsureDriveToken(false);
      }
      if (tokenToUse) {
        try {
          await deleteDriveFile(tokenToUse, deletingFile.driveFileId);
        } catch (driveErr) {
          if (isDriveScopeOrAuthError(driveErr) && onEnsureDriveToken) {
            const refreshed = await onEnsureDriveToken(true);
            if (refreshed) {
              tokenToUse = refreshed;
              await deleteDriveFile(refreshed, deletingFile.driveFileId);
            } else {
              throw driveErr;
            }
          } else {
            throw driveErr;
          }
        }
      }
      await deleteFlashFileRecord(deletingFile.id);
      setDeletingFile(null);
      if (tokenToUse) {
        getDriveStorageInfo(tokenToUse)
          .then((info) => {
            setDriveInfo(info);
            markDriveLinkedForEmail(effectiveEmail, info);
          })
          .catch(() => {});
      }
    } catch (err) {
      if (isDriveScopeOrAuthError(err)) {
        onClearDriveToken?.();
        setFilesError(
          'গুগল ড্রাইভ থেকে ফাইল মুছতে ড্রাইভ অনুমতি প্রয়োজন। পুনরায় ড্রাইভ অনুমতি দিন।'
        );
      } else {
        setFilesError(
          err instanceof Error ? err.message : 'ফাইল মুছতে সমস্যা হয়েছে।'
        );
      }
      setDeletingFile(null);
    } finally {
      setDeletingBusy(false);
    }
  };

  const handleResetVisitorsConfirm = async () => {
    if (!user) return;
    setResettingVisitors(true);
    try {
      const idToken = await user.getIdToken();
      await resetVisitorStats(idToken);
      setConfirmResetVisitors(false);
      await loadVisitorAnalytics();
    } catch (err) {
      setVisitorsError(
        err instanceof Error ? err.message : 'রিসেট করা যায়নি।'
      );
      setConfirmResetVisitors(false);
    } finally {
      setResettingVisitors(false);
    }
  };

  const handlePrintVisitorAnalytics = () => {
    window.print();
  };

  const handleExportVisitorCsv = () => {
    if (!visitorSummary) return;
    const escapeCsv = (value: string) =>
      `"${String(value || '').replace(/"/g, '""')}"`;

    const headers = [
      'সময়',
      'ধরন',
      'সার্চ কীওয়ার্ড / বিবরণ',
      'ফোন / ডিভাইস নাম',
      'OS',
      'ব্রাউজার',
      'IP ঠিকানা',
      'সোর্স',
    ];

    const rows = visitorSummary.recentEvents.map((ev) => {
      const eventTypeLabel =
        ev.type === 'download'
          ? 'ডাউনলোড'
          : ev.type === 'search'
            ? 'সার্চ'
            : 'ভিজিট';
      const deviceTypeLabel =
        ev.device === 'mobile'
          ? 'মোবাইল'
          : ev.device === 'tablet'
            ? 'ট্যাবলেট'
            : 'ডেস্কটপ';
      return [
        new Date(ev.timestamp).toLocaleString('bn-BD'),
        eventTypeLabel,
        ev.searchKeyword || ev.label || ev.path,
        ev.deviceName || deviceTypeLabel,
        ev.os,
        ev.browser,
        ev.ipAddress || '—',
        ev.trafficSource || ev.referrer || 'Direct (সরাসরি)',
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csv = `\uFEFF${[headers.map(escapeCsv).join(','), ...rows].join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `visitor-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setSettingsError('আপনার ব্রাউজারে GPS লোকেশন সুবিধা নেই।');
      return;
    }
    setLocatingGps(true);
    setSettingsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraftSettings((prev) => ({
          ...prev,
          shopLat: Number(pos.coords.latitude.toFixed(6)),
          shopLng: Number(pos.coords.longitude.toFixed(6)),
          shopPinSet: true,
        }));
        setLocatingGps(false);
      },
      () => {
        setSettingsError(
          'বর্তমান লোকেশন নেওয়া যায়নি। ম্যাপে ক্লিক করে অথবা ম্যানুয়ালি Latitude/Longitude দিন।'
        );
        setLocatingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canSettings) return;
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const idToken = await user.getIdToken();
      await saveSiteSettings(user.uid, draftSettings, idToken);
      setSettingsSuccess(
        'শপ ম্যাপ, হেডার কালার, সর্বশেষ আপডেট বর্ডার/ব্যাকগ্রাউন্ড কালার ও AdSense সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে।'
      );
    } catch (err) {
      setSettingsError(
        err instanceof Error
          ? err.message
          : 'সেটিংস সংরক্ষণ করতে সমস্যা হয়েছে।'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  if (authChecking) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-10">
          <LoadingSpinner
            size="lg"
            label="অ্যাডমিন সেশন যাচাই করা হচ্ছে..."
            className="text-sky-600 text-sm font-medium"
          />
        </div>
      </div>
    );
  }

  // Not signed in -> Show Admin Login Screen
  if (!user) {
    const activeLoginError = loginError || authRedirectError || null;
    const inIframe =
      typeof window !== 'undefined' && window.self !== window.top;
    const isUnauthorizedDomain = Boolean(
      activeLoginError?.includes('auth/unauthorized-domain')
    );
    const currentHostname =
      typeof window !== 'undefined' ? window.location.hostname : '';
    const firebaseAuthSettingsUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

    const handleCopyDomain = async () => {
      if (!currentHostname) return;
      try {
        await navigator.clipboard.writeText(currentHostname);
        setCopiedDomain(true);
        setTimeout(() => setCopiedDomain(false), 2000);
      } catch {
        // Ignore clipboard errors if denied
      }
    };

    const adminTabUrl = (() => {
      if (typeof window === 'undefined') return '/?view=admin';
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'admin');
        return url.toString();
      } catch {
        return '/?view=admin';
      }
    })();

    return (
      <section className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <div className="card-3d rounded-xl border border-slate-200 bg-white p-7 sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-800">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-slate-900">
            অ্যাডমিন প্যানেল লগইন
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            <span className="font-medium text-slate-900">
              জননী টেলিকম অ্যান্ড মোবাইল সার্ভিসিং ট্রেনিং সেন্টার
            </span>
            -এর অনুমোদিত গুগল অ্যাকাউন্ট দিয়ে সাইন ইন করে ফাইল আপলোড,
            ভিজিটর ট্র্যাকিং, শপ গুগল ম্যাপ ও হেডার সেটিংস পরিচালনা করুন।
          </p>

          {autoLogoutNotice && !activeLoginError && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              {autoLogoutNotice}
            </div>
          )}

          {activeLoginError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">
              {activeLoginError}
            </div>
          )}

          {isUnauthorizedDomain && currentHostname && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
              <p className="font-semibold text-amber-900">
                কাস্টম ডোমেইনে লগইন চালু করার নিয়ম:
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 leading-relaxed text-amber-900">
                <li>
                  নিচের{' '}
                  <span className="font-semibold">
                    Firebase Console Authorized Domains
                  </span>{' '}
                  বাটনে ক্লিক করুন।
                </li>
                <li>
                  <span className="font-semibold">
                    Authentication → Settings → Authorized domains
                  </span>{' '}
                  অংশে <span className="font-semibold">Add domain</span> চাপুন।
                </li>
                <li>
                  নিচের ডোমেইন নামটি বসিয়ে সেভ করুন এবং পেজ রিলোড করে পুনরায়
                  লগইন করুন:
                </li>
              </ol>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <code className="rounded border border-amber-300 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-900">
                  {currentHostname}
                </code>
                <button
                  type="button"
                  onClick={handleCopyDomain}
                  className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2.5 py-1 font-medium text-amber-900 hover:bg-amber-100 cursor-pointer"
                >
                  {copiedDomain ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span>কপি হয়েছে</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>ডোমেইন কপি করুন</span>
                    </>
                  )}
                </button>
              </div>
              <a
                href={firebaseAuthSettingsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-700 px-3 py-1.5 font-semibold text-white hover:bg-amber-800"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Firebase Console Authorized Domains খুলুন</span>
              </a>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <GoogleSignInButton
              onClick={() => handleLoginClick(false)}
              disabled={loggingIn}
              label={
                loggingIn
                  ? 'গুগল অ্যাকাউন্ট সংযুক্ত হচ্ছে...'
                  : 'Sign in with Google'
              }
            />
            {loggingIn && (
              <LoadingSpinner size="sm" className="text-sky-600" />
            )}
          </div>

          {(inIframe || (activeLoginError && !isUnauthorizedDomain)) && (
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
              <p className="leading-relaxed">
                {inIframe ? (
                  <>
                    প্রিভিউ ফ্রেমের ভেতরে ব্রাউজার সাইন-ইন সীমিত করতে পারে। নিচের
                    বাটনে ক্লিক করে সরাসরি Chrome/Safari-এর নতুন ট্যাবে খুলে
                    লগইন করুন (অথবা Facebook/Messenger-এর ভেতর থেকে খুললে উপরে
                    ডানদিকে <strong>⋮ → Open in Chrome</strong> চাপুন):
                  </>
                ) : (
                  <>
                    সরাসরি আলাদা ট্যাবে খুলে গুগল সাইন-ইন করতে চাইলে নিচের
                    বাটনে ক্লিক করুন:
                  </>
                )}
              </p>
              <a
                href={adminTabUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>নতুন ট্যাবে খুলে লগইন করুন</span>
              </a>
            </div>
          )}

          <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
            আপলোডকৃত সকল ফাইল আপনার গুগল ড্রাইভের{' '}
            <span className="font-mono text-slate-700">
              Jonnoi Telecom - Flash Files
            </span>{' '}
            ফোল্ডারে সংরক্ষিত থাকবে এবং ক্রেতারা ওয়েবসাইট থেকে সরাসরি
            ডাউনলোড করতে পারবেন।
          </div>
        </div>
      </section>
    );
  }

  // Signed in with non-admin or suspended email
  if (!isAdmin) {
    const isSuspended = effectiveAccess.isSuspended;
    return (
      <section className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <div
          className={`rounded-xl border bg-white p-8 ${
            isSuspended ? 'border-amber-300' : 'border-red-200'
          }`}
        >
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-lg ${
              isSuspended
                ? 'bg-amber-50 text-amber-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="mt-5 font-display text-xl font-bold text-slate-900">
            {isSuspended
              ? 'অ্যাডমিন অ্যাক্সেস সাময়িকভাবে স্থগিত করা হয়েছে (Suspended)'
              : 'অ্যাডমিন অনুমতি প্রয়োজন'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {isSuspended ? (
              <>
                আপনি{' '}
                <span className="font-mono font-medium text-slate-900">
                  {effectiveEmail || user.email || 'অজানা অ্যাকাউন্ট'}
                </span>{' '}
                অ্যাকাউন্ট দিয়ে সাইন ইন করেছেন, কিন্তু প্রধান অ্যাডমিনিস্ট্রেটর
                এই অ্যাডমিন অ্যাকাউন্টটি সাময়িকভাবে স্থগিত (Suspended) করেছেন।
              </>
            ) : (
              <>
                আপনি{' '}
                <span className="font-mono font-medium text-slate-900">
                  {effectiveEmail || user.email || 'অজানা অ্যাকাউন্ট'}
                </span>{' '}
                অ্যাকাউন্ট দিয়ে সাইন ইন করেছেন, কিন্তু এই অ্যাকাউন্টে জননী
                টেলিকম অ্যান্ড মোবাইল সার্ভিসিং ট্রেনিং সেন্টারের অ্যাডমিন
                অনুমতি নেই।
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {isSuspended
              ? 'পুনরায় অ্যাডমিন অ্যাক্সেস চালু করতে প্রধান অ্যাডমিনিস্ট্রেটরের সাথে যোগাযোগ করুন অথবা অনুমোদিত অন্য অ্যাকাউন্ট ব্যবহার করুন।'
              : 'প্রধান অ্যাডমিনিস্ট্রেটর "অ্যাডমিন ও অ্যাক্সেস কন্ট্রোল" ট্যাব থেকে আপনার জিমেইল যুক্ত করলে অথবা অনুমোদিত অ্যাডমিন জিমেইল বেছে নিলে লগইন করতে পারবেন।'}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {onSwitchAccount && (
              <button
                type="button"
                onClick={onSwitchAccount}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>অন্য গুগল অ্যাকাউন্ট দিয়ে সাইন-ইন করুন</span>
              </button>
            )}
            {onReverifyAdmin && (
              <button
                type="button"
                onClick={onReverifyAdmin}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                <span>পুনরায় যাচাই করুন</span>
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>সাইন আউট করুন</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  const totalDevices = visitorSummary
    ? Math.max(
        1,
        visitorSummary.deviceCounts.mobile +
          visitorSummary.deviceCounts.desktop +
          visitorSummary.deviceCounts.tablet
      )
    : 1;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Admin Header & Session Strip */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between print:hidden">
        <div>
          <p className="text-xs font-medium text-slate-500">
            জননী টেলিকম অ্যান্ড মোবাইল সার্ভিসিং ট্রেনিং সেন্টার · অ্যাডমিন কনসোল
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
            অ্যাডমিন ড্যাশবোর্ড ও ওয়েবসাইট নিয়ন্ত্রণ
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canSettings && (
            <button
              type="button"
              onClick={handleQuickToggleShop24Hours}
              disabled={togglingShop24h}
              title="এক ক্লিকে শপ ২৪ ঘণ্টা খোলা বা বন্ধ করুন"
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 ${
                siteSettings.shopOpen24Hours
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              {togglingShop24h ? (
                <LoadingSpinner size="xs" label="আপডেট হচ্ছে..." />
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {siteSettings.shopOpen24Hours
                      ? 'শপ: ২৪ ঘণ্টা খোলা (ON)'
                      : 'শপ: বন্ধ (OFF)'}
                  </span>
                </>
              )}
            </button>
          )}

          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${ADMIN_ROLE_META[effectiveAccess.role].badgeClass}`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{ADMIN_ROLE_META[effectiveAccess.role].label}</span>
          </span>

          {(() => {
            const CurrentDeviceIcon =
              currentDevice?.deviceType === 'mobile'
                ? Smartphone
                : currentDevice?.deviceType === 'tablet'
                  ? Tablet
                  : Monitor;
            const mins = Math.floor(Math.max(0, idleRemainingSeconds) / 60);
            const secs = Math.max(0, idleRemainingSeconds) % 60;
            const countdownLabel = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            const isWarningWindow = idleRemainingSeconds <= 120;

            return (
              <>
                <div
                  title={
                    currentDevice
                      ? `বর্তমান ডিভাইস: ${currentDevice.deviceName} (${currentDevice.os} · ${currentDevice.browser})`
                      : 'বর্তমান লগইন ডিভাইস'
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                >
                  <CurrentDeviceIcon className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                  <span className="text-slate-500">ডিভাইস:</span>
                  <span className="font-medium text-slate-900 max-w-[160px] truncate">
                    {currentDevice?.deviceName || 'শনাক্ত হচ্ছে...'}
                  </span>
                </div>

                <div
                  title="১৫ মিনিট কোনো কাজ না করলে অটো লগআউট হবে"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold tabular-nums ${
                    isWarningWindow
                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>অটো লগআউট: {countdownLabel}</span>
                </div>
              </>
            );
          })()}

          <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-700">
            <span className="text-slate-500">সাইন ইন: </span>
            <span className="font-mono font-medium text-slate-900">
              {effectiveEmail || user.email}
            </span>
          </div>
          <button
            type="button"
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              try {
                await onLogout();
              } finally {
                setLoggingOut(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60"
          >
            {loggingOut ? (
              <LoadingSpinner size="xs" label="সাইন আউট হচ্ছে..." />
            ) : (
              <>
                <LogOut className="h-3.5 w-3.5" />
                <span>সাইন আউট</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      {allowedTabs.length > 0 ? (
        <div
          className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 print:hidden"
          role="tablist"
          aria-label="অ্যাডমিন সেকশনসমূহ"
        >
          {canFiles && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'files'}
              onClick={() => setActiveTab('files')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'files'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <HardDrive className="h-4 w-4" />
              <span>ফাইল আপলোড ও ড্রাইভ</span>
            </button>
          )}

          {canVisitors && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'visitors'}
              onClick={() => setActiveTab('visitors')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'visitors'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>রিয়েল-টাইম ভিজিটর</span>
            </button>
          )}

          {canSeo && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'seo'}
              onClick={() => setActiveTab('seo')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'seo'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Globe className="h-4 w-4" />
              <span>SEO ও মেটা ট্যাগ</span>
            </button>
          )}

          {canSettings && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>শপ ২৪ ঘণ্টা, ম্যাপ ও হেডার</span>
            </button>
          )}

          {canAdmins && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'admins'}
              onClick={() => setActiveTab('admins')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'admins'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>অ্যাডমিন ও অ্যাক্সেস কন্ট্রোল</span>
            </button>
          )}

          {canHistory && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <History className="h-4 w-4" />
              <span>লগইন হিস্ট্রি</span>
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <Lock className="mx-auto h-7 w-7 text-amber-600" />
          <h2 className="mt-2 font-display text-base font-bold text-slate-900">
            কোনো মডিউল অনুমতি সক্রিয় নেই
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            আপনার অ্যাডমিন অ্যাকাউন্টটি সক্রিয় আছে, তবে এই মুহূর্তে কোনো মডিউল
            (ফাইল, ভিজিটর, SEO, সেটিংস বা হিস্ট্রি) অ্যাক্সেস চালু নেই। প্রধান
            অ্যাডমিনিস্ট্রেটরের সাথে যোগাযোগ করুন।
          </p>
        </div>
      )}

      {/* TAB 1: DRIVE UPLOAD & CATALOG */}
      {activeTab === 'files' && canFiles && (
        <div>
          {/* Drive Quota Summary Strip */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card-3d rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <HardDrive className="h-4 w-4 text-sky-600" />
                  <span>গুগল ড্রাইভ স্টোরেজ</span>
                </div>
                {(accessToken || driveLinked) && (
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>লাইফটাইম সংযুক্ত</span>
                  </span>
                )}
              </div>
              <p className="mt-2 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {driveInfo && driveInfo.usageBytes > 0
                  ? `${formatBytes(driveInfo.usageBytes)}${
                      driveInfo.limitBytes
                        ? ` / ${formatBytes(driveInfo.limitBytes)}`
                        : ''
                    }`
                  : accessToken || driveLinked
                    ? 'সংযুক্ত (স্থায়ী)'
                    : 'সংযুক্ত নয়'}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 truncate">
                {driveInfo?.userEmail || effectiveEmail || user.email}
              </p>
            </div>

            <div className="card-3d rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <FolderOpen className="h-4 w-4 text-sky-600" />
                <span>ড্রাইভ ফোল্ডার</span>
              </div>
              <p className="mt-2 font-display text-base font-semibold text-slate-900 truncate">
                Jonnoi Telecom - Flash Files
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                আপনার গুগল ড্রাইভে স্বয়ংক্রিয়ভাবে সংরক্ষিত
              </p>
            </div>

            <div className="card-3d rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <Upload className="h-4 w-4 text-sky-600" />
                <span>মোট ক্যাটালগ ফাইল</span>
              </div>
              <p className="mt-2 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {adminFiles.length}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {adminFiles.filter((f) => f.isPublicDrive).length}টি ফাইল সবার
                ডাউনলোডের জন্য উন্মুক্ত
              </p>
            </div>
          </div>

          {driveError && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {driveError}
            </div>
          )}

          {/* Main Split: Upload Form + File Table */}
          <div className="mt-7 grid grid-cols-1 gap-7 lg:grid-cols-12 lg:items-start">
            {/* Upload Any Model File Form */}
            <div className="card-3d rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                যেকোনো মডেলের ফাইল আপলোড করুন
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                যেকোনো মোবাইল ফ্ল্যাশ টুলস, স্টক রম, ড্রাইভার বা আনলক ফাইল সরাসরি
                গুগল ড্রাইভে আপলোড করুন।
              </p>

              {/* Upload Mode Toggle */}
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode('file');
                    setUploadError(null);
                  }}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    uploadMode === 'file'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>সরাসরি আপলোড</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode('link');
                    setUploadError(null);
                  }}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    uploadMode === 'link'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span>ড্রাইভ লিংক দিয়ে প্রকাশ</span>
                </button>
              </div>

              {uploadMode === 'file' && (accessToken || driveLinked) && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>
                        Google Drive লাইফটাইম সংযুক্ত আছে (
                        {driveInfo?.userEmail || effectiveEmail || user.email})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!accessToken && (
                        <button
                          type="button"
                          onClick={() => handleLoginClick('drive_silent')}
                          disabled={loggingIn}
                          className="rounded border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer disabled:opacity-60"
                        >
                          {loggingIn ? 'সিঙ্ক হচ্ছে...' : 'সেশন রিফ্রেশ'}
                        </button>
                      )}
                      {onUnlinkDrive && (
                        <button
                          type="button"
                          onClick={onUnlinkDrive}
                          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          বিচ্ছিন্ন করুন
                        </button>
                      )}
                    </div>
                  </div>
                  {!accessToken && (
                    <p className="mt-1.5 text-[11px] text-emerald-800">
                      ফাইল আপলোড বা ডিলিট করলেই ড্রাইভ সেশন স্বয়ংক্রিয়ভাবে
                      সক্রিয় হয়ে যাবে—আলাদা করে সংযোগ করতে হবে না।
                    </p>
                  )}
                </div>
              )}

              {uploadMode === 'file' && !accessToken && !driveLinked && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-2.5">
                  <p className="leading-relaxed">
                    গুগল ড্রাইভে সরাসরি ফাইল আপলোড করতে একবার ড্রাইভ সংযুক্ত
                    করুন (একবার সংযুক্ত করলে স্থায়ীভাবে লিংক থাকবে)।
                  </p>
                  {loginError && (
                    <p className="rounded border border-red-200 bg-red-50 p-2 text-red-700 font-medium leading-relaxed">
                      {loginError}
                    </p>
                  )}
                  <GoogleSignInButton
                    onClick={() => handleLoginClick('drive')}
                    disabled={loggingIn}
                    label={
                      loggingIn
                        ? 'গুগল ড্রাইভ সংযুক্ত হচ্ছে...'
                        : 'গুগল ড্রাইভ সংযুক্ত করুন'
                    }
                  />
                  <div className="rounded border border-amber-300/80 bg-white/80 p-2.5 text-[11px] leading-relaxed text-amber-950 space-y-1.5">
                    <p className="font-semibold">
                      Google Drive &quot;Blocked / Access Denied&quot; দেখালে সমাধান:
                    </p>
                    <p>
                      প্রধান অ্যাডমিন ({'noreply.jeetbuzzaff@gmail.com'}) Google Cloud Console-এর{' '}
                      <span className="font-semibold">Google Auth Platform → Audience</span>{' '}
                      থেকে{' '}
                      <span className="font-semibold">Test users</span> তালিকায়{' '}
                      <span className="font-mono font-semibold">
                        {effectiveEmail || user.email}
                      </span>{' '}
                      যোগ করলে অথবা অ্যাপটি <span className="font-semibold">Publish App</span> করলে ব্লক উঠে যাবে। অথবা এখনই{' '}
                      <button
                        type="button"
                        onClick={() => setUploadMode('link')}
                        className="font-semibold text-sky-700 underline cursor-pointer"
                      >
                        &quot;ড্রাইভ লিংক দিয়ে প্রকাশ&quot;
                      </button>{' '}
                      মোডে কাজ চালিয়ে যান।
                    </p>
                    <a
                      href={`https://console.cloud.google.com/auth/audience?project=${firebaseConfig.projectId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-amber-900 underline hover:text-amber-700"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Google Cloud Audience / Test Users খুলুন</span>
                    </a>
                  </div>
                </div>
              )}

              <form onSubmit={handleUploadSubmit} className="mt-5 space-y-4">
                {uploadError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                    {uploadError}
                  </div>
                )}
                {uploadSuccess && (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{uploadSuccess}</span>
                  </div>
                )}

                {uploadMode === 'file' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      ফ্ল্যাশ টুল / ফার্মওয়্যার ফাইল নির্বাচন করুন
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center hover:border-sky-500 hover:bg-sky-50/40 transition-colors"
                    >
                      <FileUp className="h-6 w-6 text-slate-400" />
                      {selectedFile ? (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-slate-900 break-all">
                            {selectedFile.name}
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                            {formatBytes(selectedFile.size)}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-slate-700">
                            ফাইল বেছে নিতে ক্লিক করুন
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            .zip, .rar, .7z, .tar, .md5, .bin, .exe, .pac, .ofp, .img
                          </p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={(e) =>
                        handleFileChange(
                          e.target.files && e.target.files[0]
                            ? e.target.files[0]
                            : null
                        )
                      }
                      className="sr-only"
                    />
                  </div>
                ) : (
                  <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/40 p-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Google Drive শেয়ার লিংক অথবা File ID
                      </label>
                      <input
                        type="text"
                        placeholder="https://drive.google.com/file/d/1AbC.../view?usp=sharing"
                        value={driveLinkInput}
                        onChange={(e) => setDriveLinkInput(e.target.value)}
                        required
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        ড্রাইভ ফাইলটি &quot;Anyone with the link&quot; হিসেবে শেয়ার
                        করে লিংক এখানে বসান (ড্রাইভ OAuth ছাড়াই কাজ করবে)।
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-700">
                          ফাইলের নাম (ঐচ্ছিক)
                        </label>
                        <input
                          type="text"
                          placeholder="যেমন: SM-A546E_Firmware.zip"
                          value={linkFileName}
                          onChange={(e) => setLinkFileName(e.target.value)}
                          maxLength={200}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700">
                          ফাইলের সাইজ (MB)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={linkFileSizeMb}
                          onChange={(e) => setLinkFileSizeMb(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Brand & Model */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      মোবাইল ব্র্যান্ড
                    </label>
                    <select
                      value={brandSelect}
                      onChange={(e) => setBrandSelect(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                    >
                      {COMMON_BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                      <option value="Other">অন্যান্য (যেকোনো ব্র্যান্ড)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      মডেল নাম / কোড
                    </label>
                    <input
                      type="text"
                      placeholder="যেমন: SM-A546E / Redmi Note 12"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      maxLength={80}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                    />
                  </div>
                </div>

                {brandSelect === 'Other' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      ব্র্যান্ডের নাম লিখুন
                    </label>
                    <input
                      type="text"
                      placeholder="যেকোনো ব্র্যান্ডের নাম (যেমন: Lava, Tecno, Google Pixel)"
                      value={customBrand}
                      onChange={(e) => setCustomBrand(e.target.value)}
                      maxLength={50}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    প্রদর্শিত শিরোনাম (Title)
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: Samsung A54 5G Official 4-File Firmware"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={160}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      ক্যাটাগরি
                    </label>
                    <select
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as FileCategory)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                    >
                      {FILE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABELS_BN[c]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      চিপসেট / সিপিইউ
                    </label>
                    <select
                      value={chipset}
                      onChange={(e) =>
                        setChipset(e.target.value as ChipsetPlatform)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                    >
                      {CHIPSET_PLATFORMS.map((chip) => (
                        <option key={chip} value={chip}>
                          {CHIPSET_LABELS_BN[chip]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      ভার্সন / অ্যান্ড্রয়েড ওএস
                    </label>
                    <input
                      type="text"
                      placeholder="যেমন: Android 14 / v5.2"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      maxLength={60}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      অ্যাপ / ফাইল মূল্য (৳ টাকা — ০ দিলে ফ্রি)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1000000}
                      step={1}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    ফ্ল্যাশিং নোট / পাসওয়ার্ড (ঐচ্ছিক)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Tested OK. Odin3 v3.14.4 দিয়ে ফ্ল্যাশ করুন। পাসওয়ার্ড লাগলে কল করুন 01738266366"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={1000}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                  />
                </div>

                <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={makePublic}
                    onChange={(e) => setMakePublic(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                  />
                  <span>
                    ওয়েবসাইটে সকল ব্যবহারকারীর ডাউনলোডের জন্য উন্মুক্ত করুন
                  </span>
                </label>

                {uploading && (
                  <div className="space-y-1.5 rounded-lg border border-sky-200 bg-sky-50 p-3">
                    <div className="flex items-center justify-between text-xs font-medium text-sky-900">
                      <LoadingSpinner
                        size="sm"
                        label={uploadStatus || 'গুগল ড্রাইভে আপলোড হচ্ছে...'}
                        className="text-sky-700"
                      />
                      <span className="font-mono tabular-nums">
                        {uploadProgress}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-sky-200">
                      <div
                        className="h-full bg-sky-600 transition-all duration-150"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploading}
                  className="btn-3d-primary inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {uploading ? (
                    <LoadingSpinner
                      size="sm"
                      label={
                        uploadMode === 'link'
                          ? 'ড্রাইভ লিংক প্রকাশ হচ্ছে...'
                          : 'গুগল ড্রাইভে আপলোড হচ্ছে...'
                      }
                    />
                  ) : uploadMode === 'link' ? (
                    <>
                      <Link2 className="h-4 w-4" />
                      <span>ড্রাইভ লিংক দিয়ে প্রকাশ করুন</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>গুগল ড্রাইভে আপলোড করুন</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Uploaded Files Table */}
            <div className="card-3d rounded-xl border border-slate-200 bg-white lg:col-span-7">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    আপলোডকৃত ড্রাইভ ফাইলসমূহ
                  </h2>
                  <p className="text-xs text-slate-500">
                    ফাইলের মূল্য, তথ্য পরিবর্তন, বা গুগল ড্রাইভ থেকে মুছে ফেলুন।
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="আপলোড করা ফাইল খুঁজুন..."
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {filesError && (
                <div className="m-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                  {filesError}
                </div>
              )}

              {filesLoading ? (
                <div className="flex items-center justify-center p-12">
                  <LoadingSpinner
                    size="md"
                    label="আপলোড তালিকা লোড হচ্ছে..."
                    className="text-sky-600 text-sm"
                  />
                </div>
              ) : filteredAdminFiles.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <p className="text-sm font-medium text-slate-900">
                    এখনো কোনো ফাইল আপলোড করা হয়নি
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    বাম পাশের ফর্ম ব্যবহার করে যেকোনো মডেলের ফ্ল্যাশ টুলস বা
                    ফার্মওয়্যার গুগল ড্রাইভে আপলোড করুন।
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {filteredAdminFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex flex-col gap-3 px-5 py-4 hover:bg-slate-50/70 transition-colors sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm text-slate-900 truncate">
                            {file.title}
                          </p>
                          <span
                            className={`font-mono text-xs font-bold tabular-nums shrink-0 ${
                              file.price && file.price > 0
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {formatPriceBn(file.price)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {file.brand} · {file.model} ·{' '}
                          {CATEGORY_LABELS_BN[file.category] || file.category} ·{' '}
                          <span className="font-mono tabular-nums">
                            {formatBytes(file.fileSizeBytes)}
                          </span>{' '}
                          ·{' '}
                          <span
                            className={
                              file.isPublicDrive
                                ? 'text-emerald-700 font-medium'
                                : 'text-amber-700 font-medium'
                            }
                          >
                            {file.isPublicDrive ? 'পাবলিক' : 'প্রাইভেট'}
                          </span>{' '}
                          · {formatTimestamp(file.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={file.viewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="গুগল ড্রাইভে দেখুন"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>ড্রাইভ</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => setEditingFile(file)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>সম্পাদনা</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingFile(file)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>মুছুন</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REAL-TIME VISITOR TRACKING DASHBOARD */}
      {activeTab === 'visitors' && canVisitors && (
        <div className="mt-6 space-y-6">
          {/* Print / PDF Only Report Header */}
          <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
            <h1 className="font-display text-xl font-bold text-slate-900">
              {siteSettings.shopName} — রিয়েল-টাইম ভিজিটর ট্র্যাকিং ও বিশ্লেষণ রিপোর্ট
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              প্রিন্ট তারিখ ও সময়:{' '}
              {new Date().toLocaleString('bn-BD', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {visitorSummary
                ? ` · মোট পেজ ভিজিট: ${visitorSummary.totalVisits} · আজকের ভিজিট: ${visitorSummary.todayVisits} · মোট সার্চ: ${visitorSummary.totalSearches} · মোট ডাউনলোড: ${visitorSummary.totalDownloads}`
                : ''}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  রিয়েল-টাইম ভিজিটর ট্র্যাকিং ও বিশ্লেষণ
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold print:hidden ${
                    streamConnected
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  <Radio
                    className={`h-3 w-3 ${
                      streamConnected ? 'animate-pulse text-emerald-600' : ''
                    }`}
                  />
                  <span>
                    {streamConnected ? 'লাইভ স্ট্রিম চালু' : 'সংযুক্ত হচ্ছে...'}
                  </span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                সাইটে বর্তমানে থাকা লাইভ ভিজিটর, ফোন/ডিভাইস নাম, IP ঠিকানা,
                সার্চ কীওয়ার্ড ও ডাউনলোড রিয়েল-টাইমে পর্যবেক্ষণ করুন।
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={loadVisitorAnalytics}
                disabled={visitorsLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    visitorsLoading ? 'animate-spin' : ''
                  }`}
                />
                <span>রিফ্রেশ</span>
              </button>
              <button
                type="button"
                onClick={handlePrintVisitorAnalytics}
                disabled={!visitorSummary}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                <Printer className="h-3.5 w-3.5 text-slate-700" />
                <span>প্রিন্ট / PDF</span>
              </button>
              <button
                type="button"
                onClick={handleExportVisitorCsv}
                disabled={!visitorSummary || visitorSummary.recentEvents.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-sky-700" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetVisitors(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>ডাটা রিসেট</span>
              </button>
            </div>
          </div>

          {visitorsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {visitorsError}
            </div>
          )}

          {visitorsLoading && !visitorSummary ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-14">
              <LoadingSpinner
                size="md"
                label="রিয়েল-টাইম ভিজিটর ডাটা লোড হচ্ছে..."
                className="text-sky-600 text-sm"
              />
            </div>
          ) : (
            visitorSummary && (
              <>
                {/* 5 KPI Summary Cards (including Real-Time Online Visitors) */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                  <div className="card-3d rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>এখন অনলাইনে (Live)</span>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold text-emerald-900 tabular-nums">
                      {visitorSummary.liveVisitorsCount ?? 0}
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-700">
                      সক্রিয় লাইভ সেশন
                    </p>
                  </div>

                  <div className="card-3d rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <Activity className="h-4 w-4 text-sky-600" />
                      <span>মোট পেজ ভিজিট</span>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                      {visitorSummary.totalVisits}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      সর্বমোট ওয়েবসাইট লোড
                    </p>
                  </div>

                  <div className="card-3d rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <Users className="h-4 w-4 text-emerald-600" />
                      <span>আজকের ভিজিট</span>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                      {visitorSummary.todayVisits}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      আজকের ইউনিক ভিজিটর: {visitorSummary.todayUniqueVisitors}
                    </p>
                  </div>

                  <div className="card-3d rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <Globe className="h-4 w-4 text-indigo-600" />
                      <span>মোট ইউনিক ভিজিটর</span>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                      {visitorSummary.uniqueVisitors}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      মোট সার্চ: {visitorSummary.totalSearches}টি
                    </p>
                  </div>

                  <div className="card-3d rounded-xl border border-slate-200 bg-white p-4 col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <Upload className="h-4 w-4 text-amber-600 rotate-180" />
                      <span>মোট ফাইল ডাউনলোড</span>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                      {visitorSummary.totalDownloads}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      ওয়েবসাইট থেকে সরাসরি ডাউনলোড
                    </p>
                  </div>
                </div>

                {/* Live Active Visitors Feed */}
                <div className="card-3d rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-display text-sm font-bold text-slate-900">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>এখন ওয়েবসাইটে সক্রিয় ভিজিটর (Real-Time)</span>
                    </h3>
                    <span className="font-mono text-xs font-semibold text-emerald-700">
                      {visitorSummary.liveVisitorsCount ?? 0} জন অনলাইন
                    </span>
                  </div>
                  {!visitorSummary.activeVisitors ||
                  visitorSummary.activeVisitors.length === 0 ? (
                    <p className="mt-3 text-xs text-slate-500">
                      এই মুহূর্তে কোনো সক্রিয় পাবলিক ভিজিটর সেশন নেই। কেউ
                      সাইট খুললেই এখানে সাথে সাথে দেখা যাবে।
                    </p>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {visitorSummary.activeVisitors.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="font-semibold text-slate-900 truncate">
                              {v.deviceName ||
                                (v.device === 'mobile'
                                  ? 'মোবাইল ফোন'
                                  : v.device === 'tablet'
                                    ? 'ট্যাবলেট'
                                    : 'ডেস্কটপ / পিসি')}
                            </p>
                            <p className="text-[11px] text-slate-600 truncate">
                              {v.os} / {v.browser}
                              {v.ipAddress ? (
                                <span className="ml-1.5 font-mono text-slate-700">
                                  · IP: {v.ipAddress}
                                </span>
                              ) : null}
                            </p>
                            {v.searchKeyword && (
                              <p className="font-mono text-[11px] font-medium text-amber-800 truncate">
                                সার্চ: &quot;{v.searchKeyword}&quot;
                              </p>
                            )}
                            <p className="text-[11px] font-medium text-sky-700 truncate">
                              সোর্স: {v.trafficSource || 'Direct (সরাসরি)'}
                            </p>
                            <p className="font-mono text-[11px] text-slate-500 truncate">
                              পেজ: {v.path} · ID #{v.id}
                            </p>
                          </div>
                          <span className="ml-2 shrink-0 font-mono text-[11px] font-semibold text-emerald-700">
                            {v.lastActiveSecondsAgo <= 5
                              ? 'এইমাত্র'
                              : `${v.lastActiveSecondsAgo}সে. আগে`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Device Breakdown, Traffic Sources & Top Searches / Top Downloads */}
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                  {/* Device Breakdown */}
                  <div className="card-3d rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      ভিজিটর ডিভাইস অনুপাত
                    </h3>
                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-700">
                          <span className="inline-flex items-center gap-1.5">
                            <Smartphone className="h-3.5 w-3.5 text-sky-600" />
                            <span>মোবাইল ফোন</span>
                          </span>
                          <span className="font-mono font-semibold tabular-nums">
                            {visitorSummary.deviceCounts.mobile} (
                            {Math.round(
                              (visitorSummary.deviceCounts.mobile /
                                totalDevices) *
                                100
                            )}
                            %)
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full bg-sky-600"
                            style={{
                              width: `${Math.round(
                                (visitorSummary.deviceCounts.mobile /
                                  totalDevices) *
                                  100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-700">
                          <span className="inline-flex items-center gap-1.5">
                            <Monitor className="h-3.5 w-3.5 text-indigo-600" />
                            <span>ডেস্কটপ / ল্যাপটপ</span>
                          </span>
                          <span className="font-mono font-semibold tabular-nums">
                            {visitorSummary.deviceCounts.desktop} (
                            {Math.round(
                              (visitorSummary.deviceCounts.desktop /
                                totalDevices) *
                                100
                            )}
                            %)
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full bg-indigo-600"
                            style={{
                              width: `${Math.round(
                                (visitorSummary.deviceCounts.desktop /
                                  totalDevices) *
                                  100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Traffic Sources (YouTube / TikTok / Facebook / Google / Direct) */}
                  <div className="card-3d rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      কোথা থেকে এসেছে (Traffic Source)
                    </h3>
                    {!visitorSummary.topSources ||
                    visitorSummary.topSources.length === 0 ? (
                      <p className="mt-4 text-xs text-slate-500">
                        YouTube, TikTok, Facebook বা Google থেকে ভিজিট এলে এখানে দেখা যাবে।
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-slate-100 text-xs">
                        {visitorSummary.topSources.map((src) => (
                          <li
                            key={src.source}
                            className="flex items-center justify-between py-2"
                          >
                            <span className="font-semibold text-slate-800 truncate pr-2">
                              {src.source}
                            </span>
                            <span className="font-mono font-semibold text-indigo-700 tabular-nums shrink-0">
                              {src.count} জন
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Top Searched Models */}
                  <div className="card-3d rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      বেশি খোঁজা হয়েছে (Top Search)
                    </h3>
                    {visitorSummary.topSearches.length === 0 ? (
                      <p className="mt-4 text-xs text-slate-500">
                        এখনো কোনো সার্চ রেকর্ড হয়নি।
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-slate-100 text-xs">
                        {visitorSummary.topSearches.map((item) => (
                          <li
                            key={item.term}
                            className="flex items-center justify-between py-2"
                          >
                            <span className="font-medium text-slate-800 truncate pr-2">
                              {item.term}
                            </span>
                            <span className="font-mono font-semibold text-sky-700 tabular-nums">
                              {item.count} বার
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Top Downloads */}
                  <div className="card-3d rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      বেশি ডাউনলোড হয়েছে
                    </h3>
                    {visitorSummary.topDownloads.length === 0 ? (
                      <p className="mt-4 text-xs text-slate-500">
                        এখনো কোনো ডাউনলোড রেকর্ড হয়নি।
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-slate-100 text-xs">
                        {visitorSummary.topDownloads.map((item) => (
                          <li
                            key={item.title}
                            className="flex items-center justify-between py-2"
                          >
                            <span className="font-mono text-slate-800 truncate pr-2">
                              {item.title}
                            </span>
                            <span className="font-mono font-semibold text-emerald-700 tabular-nums shrink-0">
                              {item.count} বার
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Recent Visitor Events Feed */}
                <div className="card-3d rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      সাম্প্রতিক ভিজিটর কার্যক্রম লগ
                    </h3>
                  </div>
                  {visitorSummary.recentEvents.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      এখনো কোনো ভিজিটর ইভেন্ট রেকর্ড হয়নি।
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2.5 font-medium">সময়</th>
                            <th className="px-4 py-2.5 font-medium">ধরন</th>
                            <th className="px-4 py-2.5 font-medium">সার্চ কীওয়ার্ড / বিবরণ</th>
                            <th className="px-4 py-2.5 font-medium">ফোন / ডিভাইস নাম</th>
                            <th className="px-4 py-2.5 font-medium">IP ঠিকানা</th>
                            <th className="px-4 py-2.5 font-medium">সোর্স</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {visitorSummary.recentEvents.map((ev) => (
                            <tr key={ev.id} className="hover:bg-slate-50/70">
                              <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                {new Date(ev.timestamp).toLocaleString('bn-BD', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <span
                                  className={`font-semibold ${
                                    ev.type === 'download'
                                      ? 'text-emerald-700'
                                      : ev.type === 'search'
                                        ? 'text-amber-700'
                                        : 'text-sky-700'
                                  }`}
                                >
                                  {ev.type === 'download'
                                    ? 'ডাউনলোড'
                                    : ev.type === 'search'
                                      ? 'সার্চ'
                                      : 'ভিজিট'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[11px] max-w-[240px]">
                                <p className="truncate font-medium text-slate-800">
                                  {ev.type === 'search' && ev.searchKeyword
                                    ? `🔍 ${ev.searchKeyword}`
                                    : ev.label || ev.path}
                                </p>
                                {ev.type !== 'search' && ev.searchKeyword && (
                                  <p className="truncate text-[10px] text-amber-700">
                                    সার্চ: {ev.searchKeyword}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <p className="font-medium text-slate-900">
                                  {ev.deviceName ||
                                    (ev.device === 'mobile'
                                      ? 'মোবাইল ফোন'
                                      : ev.device === 'tablet'
                                        ? 'ট্যাবলেট'
                                        : 'ডেস্কটপ / পিসি')}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {ev.os} / {ev.browser}
                                </p>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                                {ev.ipAddress || '—'}
                              </td>
                              <td className="px-4 py-2.5 text-slate-700 max-w-[180px]">
                                <p className="font-semibold text-sky-800 truncate">
                                  {ev.trafficSource || 'Direct (সরাসরি)'}
                                </p>
                                {ev.referrer &&
                                  ev.referrer !== 'Direct' &&
                                  ev.referrer !== ev.trafficSource && (
                                    <p className="font-mono text-[10px] text-slate-400 truncate">
                                      {ev.referrer}
                                    </p>
                                  )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )
          )}
        </div>
      )}

      {/* TAB 3: DYNAMIC SEO META DESCRIPTION & KEYWORDS */}
      {activeTab === 'seo' && canSeo && (
        <AdminSeoModule
          uid={user.uid}
          getIdToken={() => user.getIdToken()}
          siteSettings={siteSettings}
        />
      )}

      {/* TAB 5: ADMINISTRATOR ADMIN CREATE, ACCESS CONTROL & BANGLA GMAIL */}
      {activeTab === 'admins' && canAdmins && (
        <AdminManagementTab
          currentAdminUid={user.uid}
          currentAdminEmail={effectiveEmail || user.email || ''}
          shopName={siteSettings.shopName}
          accessToken={accessToken}
          onConnectWorkspace={() => handleLoginClick('gmail')}
          onClearToken={onClearDriveToken}
        />
      )}

      {/* TAB 6: ADMIN LOGIN INFO & HISTORY (DEVICE NAME, IP, PRINT/PDF) */}
      {activeTab === 'history' && canHistory && (
        <LoginHistoryTab
          user={user}
          isBootstrapped={Boolean(effectiveAccess.isPrimary)}
          shopName={siteSettings.shopName}
          hasDriveConnected={Boolean(accessToken || driveLinked)}
        />
      )}

      {/* TAB 4: SHOP GOOGLE MAPS ON/OFF, HEADER BG COLOR, ADSENSE & SEO */}
      {activeTab === 'settings' && canSettings && (
        <form onSubmit={handleSaveSiteSettings} className="mt-6 space-y-6">
          {settingsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {settingsError}
            </div>
          )}
          {settingsSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{settingsSuccess}</span>
            </div>
          )}

          {/* Shop 24 Hours On/Off System Card */}
          <div className="card-3d rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-sky-600" />
                  <h2 className="font-display text-base font-bold text-slate-900">
                    শপ ২৪ ঘণ্টা খোলা / বন্ধ সিস্টেম (24 Hours On / Off)
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  দোকান ২৪ ঘণ্টা খোলা রাখবেন নাকি সাময়িকভাবে বন্ধ দেখাবেন তা
                  এখান থেকে নির্ধারণ করুন। এটি হিরো ব্যানার ও যোগাযোগ সেকশনে
                  তাৎক্ষণিকভাবে দেখাবে।
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={draftSettings.shopOpen24Hours}
                onClick={() =>
                  setDraftSettings((prev) => ({
                    ...prev,
                    shopOpen24Hours: !prev.shopOpen24Hours,
                  }))
                }
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  draftSettings.shopOpen24Hours
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-rose-600 text-white hover:bg-rose-700'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {draftSettings.shopOpen24Hours
                    ? '২৪ ঘণ্টা খোলা (ON)'
                    : 'দোকান বন্ধ (OFF)'}
                </span>
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-700">
                কাস্টম স্ট্যাটাস বার্তা / সময়সূচী নোট (ঐচ্ছিক)
              </label>
              <input
                type="text"
                placeholder="যেমন: ২৪ ঘণ্টা অনলাইন ফ্ল্যাশ ফাইল ও সার্ভিসিং সাপোর্ট চালু আছে"
                value={draftSettings.shopStatusNote}
                onChange={(e) =>
                  setDraftSettings((prev) => ({
                    ...prev,
                    shopStatusNote: e.target.value,
                  }))
                }
                maxLength={140}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Shop Google Maps On/Off & Location Pin Picker */}
            <div className="card-3d rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7 space-y-4">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-sky-600" />
                    <h2 className="font-display text-base font-bold text-slate-900">
                      শপ গুগল ম্যাপ চালু / বন্ধ (On / Off)
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    পাবলিক ওয়েবসাইটের যোগাযোগ সেকশনে আপনার দোকানের Google Map
                    দেখাবেন কিনা তা নিয়ন্ত্রণ করুন।
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={draftSettings.shopMapEnabled}
                  onClick={() =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      shopMapEnabled: !prev.shopMapEnabled,
                    }))
                  }
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                    draftSettings.shopMapEnabled
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  <span>
                    {draftSettings.shopMapEnabled ? 'ম্যাপ চালু (ON)' : 'ম্যাপ বন্ধ (OFF)'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    দোকানের নাম
                  </label>
                  <input
                    type="text"
                    value={draftSettings.shopName}
                    onChange={(e) =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        shopName: e.target.value,
                      }))
                    }
                    maxLength={120}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    দোকানের ঠিকানা (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: স্টেশন রোড, মার্কেট ২য় তলা"
                    value={draftSettings.shopAddress}
                    onChange={(e) =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        shopAddress: e.target.value,
                      }))
                    }
                    maxLength={300}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Latitude (অক্ষাংশ)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    min={-90}
                    max={90}
                    value={draftSettings.shopLat}
                    onChange={(e) =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        shopLat: Number(e.target.value),
                        shopPinSet: true,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Longitude (দ্রাঘিমাংশ)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    min={-180}
                    max={180}
                    value={draftSettings.shopLng}
                    onChange={(e) =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        shopLng: Number(e.target.value),
                        shopPinSet: true,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={locatingGps}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer disabled:opacity-60"
                >
                  {locatingGps ? (
                    <LoadingSpinner size="xs" label="GPS খুঁজছে..." />
                  ) : (
                    <>
                      <Compass className="h-4 w-4 text-sky-600" />
                      <span>GPS অবস্থান নিন</span>
                    </>
                  )}
                </button>
              </div>

              <div>
                <p className="mb-2 text-xs text-slate-500">
                  ম্যাপের যেকোনো স্থানে ক্লিক করে আপনার দোকানের পিন নির্ধারণ করুন:
                </p>
                <ShopMapSection
                  shopName={draftSettings.shopName}
                  shopAddress={draftSettings.shopAddress}
                  lat={draftSettings.shopLat}
                  lng={draftSettings.shopLng}
                  pinSet={draftSettings.shopPinSet}
                  editable
                  heightClassName="h-64"
                  onSelectLocation={(lat, lng) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      shopLat: lat,
                      shopLng: lng,
                      shopPinSet: true,
                    }))
                  }
                />
              </div>
            </div>

            {/* Right Column: Header Background Color & AdSense + SEO */}
            <div className="space-y-6 lg:col-span-5">
              {/* Header Background Color Selector */}
              <div className="card-3d rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-sky-600" />
                  <h2 className="font-display text-base font-bold text-slate-900">
                    হেডার ব্যাকগ্রাউন্ড কালার পরিবর্তন
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  ওয়েবসাইটের উপরের নেভিগেশন হেডারের রঙ পছন্দমতো পরিবর্তন করুন।
                </p>

                <div className="mt-4 grid grid-cols-1 gap-2">
                  {(Object.keys(HEADER_THEME_META) as HeaderBgTheme[]).map(
                    (key) => {
                      const item = HEADER_THEME_META[key];
                      const selected = draftSettings.headerBgTheme === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            setDraftSettings((prev) => ({
                              ...prev,
                              headerBgTheme: key,
                            }))
                          }
                          className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                            selected
                              ? 'border-sky-600 bg-sky-50 text-sky-950'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span
                              className={`h-5 w-5 rounded-md ${item.swatchClass}`}
                              aria-hidden="true"
                            />
                            <span>{item.labelBn}</span>
                          </span>
                          {selected && (
                            <CheckCircle2 className="h-4 w-4 text-sky-600" />
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Latest Update Border & Background Color Selector */}
              <div className="card-3d rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-5 w-5 text-sky-600" />
                      <h2 className="font-display text-base font-bold text-slate-900">
                        সর্বশেষ আপডেট বর্ডার ও ব্যাকগ্রাউন্ড কালার
                      </h2>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      ওয়েবসাইটের চলমান &quot;সর্বশেষ আপডেট&quot; বারের
                      ব্যাকগ্রাউন্ড, উপরের/নিচের বর্ডার ও ব্যাজ রঙ পরিবর্তন করুন।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        tickerBgColor: DEFAULT_SITE_SETTINGS.tickerBgColor,
                        tickerBorderColor:
                          DEFAULT_SITE_SETTINGS.tickerBorderColor,
                        tickerBadgeBgColor:
                          DEFAULT_SITE_SETTINGS.tickerBadgeBgColor,
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>ডিফল্ট</span>
                  </button>
                </div>

                {/* Live Preview of News Ticker */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <p className="mb-1.5 text-[11px] font-medium text-slate-500">
                    লাইভ প্রিভিউ:
                  </p>
                  <div
                    className="flex items-center overflow-hidden rounded border-y-2 transition-colors duration-150"
                    style={{
                      backgroundColor: draftSettings.tickerBgColor,
                      borderTopColor: draftSettings.tickerBorderColor,
                      borderBottomColor: draftSettings.tickerBorderColor,
                      color: getContrastTextColor(draftSettings.tickerBgColor),
                    }}
                  >
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: draftSettings.tickerBadgeBgColor,
                        color: getContrastTextColor(
                          draftSettings.tickerBadgeBgColor
                        ),
                      }}
                    >
                      <Megaphone className="h-3 w-3" />
                      <span>সর্বশেষ আপডেট</span>
                    </span>
                    <span className="truncate px-3 py-1 text-[11px] font-medium">
                      সকল ধরনের বাটন ও স্মার্টফোনের শতভাগ পরীক্ষিত ফ্লাশ ফাইল...
                    </span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-700">
                    দ্রুত কালার প্রিসেট বেছে নিন:
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {TICKER_COLOR_PRESETS.map((preset) => {
                      const active =
                        draftSettings.tickerBgColor.toLowerCase() ===
                          preset.tickerBgColor &&
                        draftSettings.tickerBorderColor.toLowerCase() ===
                          preset.tickerBorderColor;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            setDraftSettings((prev) => ({
                              ...prev,
                              tickerBgColor: preset.tickerBgColor,
                              tickerBorderColor: preset.tickerBorderColor,
                              tickerBadgeBgColor: preset.tickerBadgeBgColor,
                            }))
                          }
                          className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition-colors cursor-pointer ${
                            active
                              ? 'border-sky-600 bg-sky-50 text-sky-950'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-5 w-7 shrink-0 rounded border-2"
                              style={{
                                backgroundColor: preset.tickerBgColor,
                                borderColor: preset.tickerBorderColor,
                              }}
                              aria-hidden="true"
                            />
                            <span className="truncate">{preset.labelBn}</span>
                          </span>
                          {active && (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Color Pickers */}
                <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700">
                      ব্যাকগ্রাউন্ড কালার
                    </label>
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="color"
                        aria-label="সর্বশেষ আপডেট ব্যাকগ্রাউন্ড কালার"
                        value={
                          isValidHexColor(draftSettings.tickerBgColor)
                            ? draftSettings.tickerBgColor
                            : '#0f172a'
                        }
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            tickerBgColor: e.target.value,
                          }))
                        }
                        className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                      />
                      <input
                        type="text"
                        maxLength={7}
                        value={draftSettings.tickerBgColor}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            tickerBgColor: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700">
                      বর্ডার কালার
                    </label>
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="color"
                        aria-label="সর্বশেষ আপডেট বর্ডার কালার"
                        value={
                          isValidHexColor(draftSettings.tickerBorderColor)
                            ? draftSettings.tickerBorderColor
                            : '#0284c7'
                        }
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            tickerBorderColor: e.target.value,
                          }))
                        }
                        className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                      />
                      <input
                        type="text"
                        maxLength={7}
                        value={draftSettings.tickerBorderColor}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            tickerBorderColor: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700">
                      ব্যাজ কালার
                    </label>
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="color"
                        aria-label="সর্বশেষ আপডেট ব্যাজ কালার"
                        value={
                          isValidHexColor(draftSettings.tickerBadgeBgColor)
                            ? draftSettings.tickerBadgeBgColor
                            : '#0284c7'
                        }
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            tickerBadgeBgColor: e.target.value,
                          }))
                        }
                        className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                      />
                      <input
                        type="text"
                        maxLength={7}
                        value={draftSettings.tickerBadgeBgColor}
                        onChange={(e) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            tickerBadgeBgColor: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Google AdSense & SEO Readiness Panel */}
              <div className="card-3d rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900">
                      Google AdSense ও SEO সেটিংস
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      AdSense অনুমোদন এবং Google সার্চ র‍্যাংকিংয়ের জন্য
                      কনফিগারেশন।
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draftSettings.adsenseEnabled}
                    onClick={() =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        adsenseEnabled: !prev.adsenseEnabled,
                      }))
                    }
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer shrink-0 ${
                      draftSettings.adsenseEnabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {draftSettings.adsenseEnabled ? 'চালু' : 'বন্ধ'}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    AdSense Publisher ID
                  </label>
                  <input
                    type="text"
                    placeholder="ca-pub-1234567890123456"
                    value={draftSettings.adsensePublisherId}
                    onChange={(e) =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        adsensePublisherId: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Top Ad Slot ID
                    </label>
                    <input
                      type="text"
                      placeholder="1234567890"
                      value={draftSettings.adsenseSlotTop}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          adsenseSlotTop: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Bottom Ad Slot ID
                    </label>
                    <input
                      type="text"
                      placeholder="0987654321"
                      value={draftSettings.adsenseSlotBottom}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          adsenseSlotBottom: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* AdSense & SEO Verification Checklist */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1.5">
                  <p className="font-semibold text-slate-900">
                    AdSense অনুমোদন ও Google SEO স্ট্যাটাস:
                  </p>
                  <p className="text-emerald-700">
                    ✓ AdSense স্ক্রিপ্ট ও ads.txt ({draftSettings.adsensePublisherId || 'ca-pub-4269885349192047'}) সক্রিয়
                  </p>
                  <p className="text-emerald-700">
                    ✓ Privacy Policy, Terms, Disclaimer, About Us ও Cookie বার
                    সক্রিয়
                  </p>
                  <p className="text-emerald-700">
                    ✓ Schema.org JSON-LD, OpenGraph ও Twitter Card যুক্ত
                  </p>
                  <p className="pt-1 text-[11px] leading-relaxed text-slate-600">
                    বিজ্ঞাপন দেখানোর জন্য Google AdSense ড্যাশবোর্ডে আপনার
                    সাইটটি <span className="font-semibold text-slate-800">&quot;Ready&quot;</span>{' '}
                    অবস্থায় থাকতে হবে এবং <span className="font-semibold text-slate-800">Auto Ads</span>{' '}
                    চালু অথবা উপরের Top/Bottom Ad Slot ID বসাতে হবে (ব্রাউজারে AdBlocker থাকলে বন্ধ রাখুন)।
                  </p>
                  <div className="flex flex-wrap gap-3 pt-1 font-mono text-[11px]">
                    <a
                      href="/robots.txt"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-700 underline"
                    >
                      /robots.txt
                    </a>
                    <a
                      href="/sitemap.xml"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-700 underline"
                    >
                      /sitemap.xml
                    </a>
                    <a
                      href="/ads.txt"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-700 underline"
                    >
                      /ads.txt
                    </a>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="btn-3d-primary inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700 transition-colors cursor-pointer disabled:opacity-60"
              >
                {savingSettings ? (
                  <LoadingSpinner size="sm" label="সংরক্ষণ হচ্ছে..." />
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>সব সেটিংস সংরক্ষণ করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Edit Modal */}
      {editingFile && (
        <EditFileModal
          key={editingFile.id}
          file={editingFile}
          onClose={() => setEditingFile(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Mandatory Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingFile)}
        title="গুগল ড্রাইভ থেকে ফাইল মুছে ফেলবেন?"
        description={
          deletingFile
            ? `আপনি কি নিশ্চিত যে "${deletingFile.title}" (${deletingFile.fileName}) ফাইলটি ওয়েবসাইট এবং গুগল ড্রাইভ উভয় জায়গা থেকে স্থায়ীভাবে মুছে ফেলতে চান? এটি পুনরুদ্ধার করা যাবে না।`
            : ''
        }
        confirmLabel="স্থায়ীভাবে মুছুন"
        variant="danger"
        busy={deletingBusy}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingFile(null)}
      />

      {/* Reset Visitor Analytics Confirmation Dialog */}
      <ConfirmDialog
        open={confirmResetVisitors}
        title="ভিজিটর পরিসংখ্যান রিসেট করবেন?"
        description="আপনি কি নিশ্চিত যে সকল সংরক্ষিত ভিজিটর কাউন্ট, সার্চ লগ এবং ডাউনলোড পরিসংখ্যান মুছে শূন্য থেকে শুরু করতে চান?"
        confirmLabel="হ্যাঁ, রিসেট করুন"
        variant="danger"
        busy={resettingVisitors}
        onConfirm={handleResetVisitorsConfirm}
        onCancel={() => setConfirmResetVisitors(false)}
      />
    </section>
  );
};
