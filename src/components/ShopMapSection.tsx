import React, { useCallback, useEffect, useState } from 'react';
import {
  AdvancedMarker,
  APILoadingStatus,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  MapCameraChangedEvent,
  MapCameraProps,
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

const EmbeddedGoogleMapFallback: React.FC<{
  lat: number;
  lng: number;
  zoom: number;
  pinSet: boolean;
  shopName: string;
  shopAddress: string;
  editable?: boolean;
  heightClassName: string;
}> = ({
  lat,
  lng,
  zoom,
  pinSet,
  shopName,
  shopAddress,
  editable,
  heightClassName,
}) => {
  const mapQuery =
    !pinSet && shopAddress.trim()
      ? `${shopAddress.trim()}, Bangladesh`
      : `${lat},${lng}`;
  const effectiveZoom = !pinSet && shopAddress.trim() ? 13 : zoom;
  const embedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(
    mapQuery
  )}&z=${effectiveZoom}&hl=bn&output=embed`;

  return (
    <div
      className={`relative ${heightClassName} min-h-[288px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100`}
    >
      <iframe
        title={`${shopName} — Google Map`}
        src={embedSrc}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-full w-full border-0"
        allowFullScreen
      />
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto rounded-lg border border-slate-200/90 bg-white/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur-sm">
          <p className="font-display font-bold text-slate-900">{shopName}</p>
          {shopAddress && (
            <p className="text-[11px] text-slate-600">{shopAddress}</p>
          )}
          {editable && (
            <p className="mt-0.5 text-[10px] text-sky-700">
              উপরের Latitude/Longitude বা &quot;GPS অবস্থান নিন&quot; ব্যবহার করে পিন পরিবর্তন করুন
            </p>
          )}
        </div>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            mapQuery
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Google Maps-এ খুলুন</span>
        </a>
      </div>
    </div>
  );
};

const MapLoadingGuard: React.FC<{
  children: React.ReactNode;
  lat: number;
  lng: number;
  zoom: number;
  pinSet: boolean;
  shopName: string;
  shopAddress: string;
  editable?: boolean;
  heightClassName: string;
}> = ({
  children,
  lat,
  lng,
  zoom,
  pinSet,
  shopName,
  shopAddress,
  editable,
  heightClassName,
}) => {
  const status = useApiLoadingStatus();

  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  ) {
    return (
      <EmbeddedGoogleMapFallback
        lat={lat}
        lng={lng}
        zoom={zoom}
        pinSet={pinSet}
        shopName={shopName}
        shopAddress={shopAddress}
        editable={editable}
        heightClassName={heightClassName}
      />
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
  const targetZoom = pinSet ? 15 : 13;
  const [cameraProps, setCameraProps] = useState<MapCameraProps>({
    center: { lat, lng },
    zoom: targetZoom,
  });

  useEffect(() => {
    setCameraProps({
      center: { lat, lng },
      zoom: targetZoom,
    });
  }, [lat, lng, targetZoom]);

  const handleCameraChange = useCallback((ev: MapCameraChangedEvent) => {
    setCameraProps(ev.detail);
  }, []);

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
      <EmbeddedGoogleMapFallback
        lat={lat}
        lng={lng}
        zoom={targetZoom}
        pinSet={pinSet}
        shopName={shopName}
        shopAddress={shopAddress}
        editable={editable}
        heightClassName={heightClassName}
      />
    );
  }

  return (
    <div
      className={`relative ${heightClassName} min-h-[288px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100`}
    >
      <APIProvider
        apiKey={MAPS_API_KEY}
        libraries={['marker']}
        language="bn"
        region="BD"
      >
        <MapLoadingGuard
          lat={lat}
          lng={lng}
          zoom={targetZoom}
          pinSet={pinSet}
          shopName={shopName}
          shopAddress={shopAddress}
          editable={editable}
          heightClassName="h-full"
        >
          <GoogleMap
            {...cameraProps}
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            gestureHandling="cooperative"
            onCameraChanged={handleCameraChange}
            onClick={handleMapClick}
            style={{ width: '100%', height: '100%', minHeight: '288px' }}
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
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          !pinSet && shopAddress.trim()
            ? `${shopAddress.trim()}, Bangladesh`
            : `${lat},${lng}`
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 shadow-sm hover:bg-white"
      >
        <MapPin className="h-3.5 w-3.5 text-sky-600" />
        <span>Google Maps-এ খুলুন</span>
      </a>
    </div>
  );
};
