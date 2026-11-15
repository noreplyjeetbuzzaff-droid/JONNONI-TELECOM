import React, { useCallback, useEffect, useState } from 'react';
import {
  AdvancedMarker,
  APILoadingStatus,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  MapMouseEvent,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import { ExternalLink, MapPin, Navigation, Phone } from 'lucide-react';

interface ShopMapSectionProps {
  shopName: string;
  shopAddress: string;
  lat: number;
  lng: number;
  pinSet: boolean;
  editable?: boolean;
  onSelectLocation?: (lat: number, lng: number) => void;
  heightClassName?: string;
}

const MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || '';

const MapLoadingGuard: React.FC<{
  children: React.ReactNode;
  lat: number;
  lng: number;
  shopName: string;
  shopAddress: string;
}> = ({ children, lat, lng, shopName, shopAddress }) => {
  const status = useApiLoadingStatus();

  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  ) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <MapPin className="h-7 w-7 text-amber-700" />
        <p className="mt-2 font-display text-sm font-semibold text-amber-950">
          গুগল ম্যাপ এই মুহূর্তে লোড করা যায়নি
        </p>
        {shopAddress && (
          <p className="mt-1 text-xs text-amber-900">{shopAddress}</p>
        )}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-800"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Google Maps-এ {shopName} দেখুন</span>
        </a>
      </div>
    );
  }

  return <>{children}</>;
};

const ShopMarkerAndWindow: React.FC<{
  shopName: string;
  shopAddress: string;
  lat: number;
  lng: number;
  editable?: boolean;
}> = ({ shopName, shopAddress, lat, lng, editable }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(!editable);

  useEffect(() => {
    setInfoOpen(!editable);
  }, [editable, lat, lng]);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat, lng }}
        title={shopName}
        onClick={() => setInfoOpen((prev) => !prev)}
      >
        <Pin
          background="#0284c7"
          borderColor="#075985"
          glyphColor="#ffffff"
          scale={1.15}
        />
      </AdvancedMarker>

      {infoOpen && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={260}
          onCloseClick={() => setInfoOpen(false)}
        >
          <div className="p-1 text-slate-900">
            <p className="font-display text-sm font-bold leading-snug">
              {shopName}
            </p>
            {shopAddress && (
              <p className="mt-1 text-xs text-slate-600">{shopAddress}</p>
            )}
            <p className="mt-1.5 flex items-center gap-1 font-mono text-xs font-semibold text-sky-700">
              <Phone className="h-3 w-3" />
              <span>01738266366</span>
            </p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 underline underline-offset-2"
            >
              <Navigation className="h-3 w-3" />
              <span>দিকনির্দেশনা নিন</span>
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export const ShopMapSection: React.FC<ShopMapSectionProps> = ({
  shopName,
  shopAddress,
  lat,
  lng,
  pinSet,
  editable = false,
  onSelectLocation,
  heightClassName = 'h-72 sm:h-80',
}) => {
  const handleMapClick = useCallback(
    (ev: MapMouseEvent) => {
      if (!editable || !onSelectLocation) return;
      const latLng = ev.detail.latLng;
      if (latLng) {
        onSelectLocation(
          Number(latLng.lat.toFixed(6)),
          Number(latLng.lng.toFixed(6))
        );
      }
    },
    [editable, onSelectLocation]
  );

  if (!MAPS_API_KEY) {
    return (
      <div
        className={`flex ${heightClassName} w-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-6 text-center`}
      >
        <MapPin className="h-7 w-7 text-sky-600" />
        <p className="mt-2 font-display text-sm font-semibold text-slate-900">
          {shopName}
        </p>
        {shopAddress ? (
          <p className="mt-1 text-xs text-slate-600">{shopAddress}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            দোকানের অবস্থান: <span className="font-mono">{lat}, {lng}</span>
          </p>
        )}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Google Maps অ্যাপে খুলুন</span>
        </a>
      </div>
    );
  }

  return (
    <div
      className={`${heightClassName} w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100`}
    >
      <APIProvider apiKey={MAPS_API_KEY} language="bn" region="BD">
        <MapLoadingGuard
          lat={lat}
          lng={lng}
          shopName={shopName}
          shopAddress={shopAddress}
        >
          <GoogleMap
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            center={{ lat, lng }}
            zoom={pinSet ? 15 : 7}
            gestureHandling="cooperative"
            onClick={handleMapClick}
            style={{ width: '100%', height: '100%' }}
          >
            <ShopMarkerAndWindow
              shopName={shopName}
              shopAddress={shopAddress}
              lat={lat}
              lng={lng}
              editable={editable}
            />
          </GoogleMap>
        </MapLoadingGuard>
      </APIProvider>
    </div>
  );
};
