import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  DEFAULT_SITE_SETTINGS,
  HeaderBgTheme,
  SiteSettings,
} from '../types/siteSettings';

const COLLECTION_NAME = 'site_settings';
const PUBLIC_DOC_ID = 'public';
const VALID_THEMES: HeaderBgTheme[] = [
  'navy',
  'cobalt',
  'emerald',
  'charcoal',
  'white',
];

function normalizeSiteSettings(raw: Record<string, unknown> | undefined): SiteSettings {
  if (!raw) return DEFAULT_SITE_SETTINGS;
  const theme = VALID_THEMES.includes(raw.headerBgTheme as HeaderBgTheme)
    ? (raw.headerBgTheme as HeaderBgTheme)
    : DEFAULT_SITE_SETTINGS.headerBgTheme;

  const lat = Number(raw.shopLat);
  const lng = Number(raw.shopLng);

  return {
    shopMapEnabled:
      typeof raw.shopMapEnabled === 'boolean'
        ? raw.shopMapEnabled
        : DEFAULT_SITE_SETTINGS.shopMapEnabled,
    shopName:
      typeof raw.shopName === 'string' && raw.shopName.trim().length >= 2
        ? raw.shopName.trim().slice(0, 120)
        : DEFAULT_SITE_SETTINGS.shopName,
    shopAddress:
      typeof raw.shopAddress === 'string'
        ? raw.shopAddress.trim().slice(0, 300)
        : '',
    shopLat:
      Number.isFinite(lat) && lat >= -90 && lat <= 90
        ? lat
        : DEFAULT_SITE_SETTINGS.shopLat,
    shopLng:
      Number.isFinite(lng) && lng >= -180 && lng <= 180
        ? lng
        : DEFAULT_SITE_SETTINGS.shopLng,
    shopPinSet: Boolean(raw.shopPinSet),
    shopOpen24Hours:
      typeof raw.shopOpen24Hours === 'boolean'
        ? raw.shopOpen24Hours
        : DEFAULT_SITE_SETTINGS.shopOpen24Hours,
    shopStatusNote:
      typeof raw.shopStatusNote === 'string'
        ? raw.shopStatusNote.trim().slice(0, 140)
        : '',
    headerBgTheme: theme,
    adsenseEnabled:
      typeof raw.adsenseEnabled === 'boolean'
        ? raw.adsenseEnabled
        : DEFAULT_SITE_SETTINGS.adsenseEnabled,
    adsensePublisherId:
      typeof raw.adsensePublisherId === 'string' &&
      raw.adsensePublisherId.trim() !== ''
        ? raw.adsensePublisherId.trim()
        : DEFAULT_SITE_SETTINGS.adsensePublisherId,
    adsenseSlotTop:
      typeof raw.adsenseSlotTop === 'string' ? raw.adsenseSlotTop.trim() : '',
    adsenseSlotBottom:
      typeof raw.adsenseSlotBottom === 'string'
        ? raw.adsenseSlotBottom.trim()
        : '',
  };
}

export function subscribeSiteSettings(
  onData: (settings: SiteSettings) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const ref = doc(db, COLLECTION_NAME, PUBLIC_DOC_ID);
  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(DEFAULT_SITE_SETTINGS);
        return;
      }
      onData(normalizeSiteSettings(snapshot.data() as Record<string, unknown>));
    },
    (error) => {
      onData(DEFAULT_SITE_SETTINGS);
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  );
}

export async function saveSiteSettings(
  uid: string,
  settings: SiteSettings,
  idToken?: string
): Promise<void> {
  const path = `${COLLECTION_NAME}/${PUBLIC_DOC_ID}`;
  const cleanPubId = settings.adsensePublisherId.trim();
  if (cleanPubId && !/^ca-pub-\d{10,20}$/.test(cleanPubId)) {
    throw new Error(
      'সঠিক AdSense Publisher ID লিখুন (যেমন: ca-pub-1234567890123456)।'
    );
  }

  const cleanSlotTop = settings.adsenseSlotTop.trim();
  if (cleanSlotTop && !/^\d{6,20}$/.test(cleanSlotTop)) {
    throw new Error('সঠিক Top Ad Slot ID (শুধু সংখ্যা) লিখুন।');
  }

  const cleanSlotBottom = settings.adsenseSlotBottom.trim();
  if (cleanSlotBottom && !/^\d{6,20}$/.test(cleanSlotBottom)) {
    throw new Error('সঠিক Bottom Ad Slot ID (শুধু সংখ্যা) লিখুন।');
  }

  const lat = Number(settings.shopLat);
  const lng = Number(settings.shopLng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('Latitude অবশ্যই -90 থেকে 90 এর মধ্যে হতে হবে।');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error('Longitude অবশ্যই -180 থেকে 180 এর মধ্যে হতে হবে।');
  }

  const payload = {
    shopMapEnabled: Boolean(settings.shopMapEnabled),
    shopName:
      settings.shopName.trim().slice(0, 120) || DEFAULT_SITE_SETTINGS.shopName,
    shopAddress: settings.shopAddress.trim().slice(0, 300),
    shopLat: Number(lat.toFixed(6)),
    shopLng: Number(lng.toFixed(6)),
    shopPinSet: Boolean(settings.shopPinSet),
    shopOpen24Hours: Boolean(settings.shopOpen24Hours),
    shopStatusNote: (settings.shopStatusNote || '').trim().slice(0, 140),
    headerBgTheme: VALID_THEMES.includes(settings.headerBgTheme)
      ? settings.headerBgTheme
      : 'navy',
    adsenseEnabled: Boolean(settings.adsenseEnabled),
    adsensePublisherId: cleanPubId,
    adsenseSlotTop: cleanSlotTop,
    adsenseSlotBottom: cleanSlotBottom,
    updatedAt: serverTimestamp(),
    updatedByUid: uid,
  };

  try {
    await setDoc(doc(db, COLLECTION_NAME, PUBLIC_DOC_ID), payload);
    if (idToken) {
      await fetch('/api/admin/ads-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          adsensePublisherId: cleanPubId,
          adsenseEnabled: Boolean(settings.adsenseEnabled),
        }),
      }).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
