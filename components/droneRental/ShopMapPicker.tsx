"use client";

import { PendingLink } from "@/components/PendingLink";
import { useEffect, useRef, useState } from "react";
import { getShopsWithAvailabilityAction } from "@/app/rent/actions";
import { formatMalaysiaTime, type Locale } from "@/lib/i18n/locale";
import { droneText, type DroneText } from "@/lib/i18n/drone";
import { pressableClass } from "@/components/formStyles";
import { trackLocation } from "@/components/FunnelBeacon";
import { loadGoogleMaps } from "@/lib/maps/loadGoogleMaps";

export type ShopMarker = {
  id: string;
  humanId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  googleMapsUrl: string | null;
  distanceKm: number | null;
  /** Open for booking: only these show Book here and Get direction; the others show Too Far and Check Rates. */
  bookable: boolean;
  firstAvailableAt: string | null;
};

/** Malaysia's rough geographic center — the map's fallback view whenever the customer's own location isn't known (denied, unsupported, or not yet resolved). */
const DEFAULT_CENTER = { lat: 4.2105, lng: 101.9758 };
const DEFAULT_ZOOM = 6;
const LOCATED_ZOOM = 12;
const SHOP_ZOOM = 14;

function availabilityLabel(shop: ShopMarker, t: DroneText["shops"], locale: Locale): string {
  if (!shop.bookable) return "";
  if (!shop.firstAvailableAt) return t.none;
  const at = new Date(shop.firstAvailableAt);
  return at.getTime() <= Date.now() ? t.nowAvailable : t.availableAt(formatMalaysiaTime(at, locale));
}

type LatLng = { lat: number; lng: number };

function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The nearest location that can be booked (the ones that show Too Far are not what "nearest to me" is for). */
function nearestShop(shops: ShopMarker[], origin: LatLng): ShopMarker | null {
  let best: { shop: ShopMarker; km: number } | null = null;
  for (const shop of shops) {
    if (!shop.bookable) continue;
    const km = haversineKm(origin, shop);
    if (!best || km < best.km) best = { shop, km };
  }
  return best?.shop ?? null;
}

type LocationStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable" | "unsupported";

export function ShopMapPicker({ initialShops, locale = "en", carry }: { initialShops: ShopMarker[]; locale?: Locale; /** The package picked on the landing page, as an address query, passed on to the booking page. */ carry?: string }) {
  const t = droneText(locale).shops;
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const wantNearestRef = useRef(false);
  const [shops, setShops] = useState<ShopMarker[]>(initialShops);
  // With a single shop there's nothing to choose between, so it starts selected (Book button showing).
  const [selectedShopId, setSelectedShopId] = useState<string | null>(initialShops.length === 1 ? initialShops[0].id : null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  /** Frames the shop on the map — together with the customer's own dot when we know where they are, so "how far is it" is visible at a glance. */
  function focusShop(shop: ShopMarker, origin: LatLng | null) {
    setSelectedShopId(shop.id);
    const map = mapRef.current;
    if (!map) return;
    if (origin) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(origin);
      bounds.extend({ lat: shop.lat, lng: shop.lng });
      map.fitBounds(bounds, 56);
    } else {
      map.panTo({ lat: shop.lat, lng: shop.lng });
      map.setZoom(LOCATED_ZOOM);
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      return;
    }
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(location);
        setLocationStatus("granted");
        getShopsWithAvailabilityAction(location)
          .then(setShops)
          .catch(() => {});
        if (wantNearestRef.current) {
          wantNearestRef.current = false;
          const nearest = nearestShop(shops, location);
          if (nearest) focusShop(nearest, location);
        }
      },
      (err) => {
        wantNearestRef.current = false;
        // 1 = PERMISSION_DENIED; 2/3 = position unavailable / timed out — a different problem with a different fix.
        setLocationStatus(err.code === 1 ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  function handleNearestClick() {
    if (userLocation) {
      const nearest = nearestShop(shops, userLocation);
      if (nearest) focusShop(nearest, userLocation);
      return;
    }
    // No fix yet: ask for one, and jump to the nearest shop the moment it arrives.
    wantNearestRef.current = true;
    requestLocation();
  }

  // Ask for location as soon as the page loads — the whole point of this
  // page is "closest shop to me," so there's no reason to wait for a click.
  useEffect(() => {
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!apiKey || !mapDivRef.current) return;
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapDivRef.current) return;
        mapRef.current = new google.maps.Map(mapDivRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          disableDefaultUI: true,
          zoomControl: true,
        });
        setMapsReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // (Re)draw shop markers whenever the map is ready or the shop list changes.
  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = shops.map((shop) => {
      const marker = new google.maps.Marker({
        position: { lat: shop.lat, lng: shop.lng },
        map: mapRef.current!,
        title: shop.name,
      });
      marker.addListener("click", () => {
        setSelectedShopId(shop.id);
        trackLocation("SELECT", shop.id);
      });
      return marker;
    });
  }, [mapsReady, shops]);

  // Without a location fix, frame the shops themselves (not all of Malaysia). Capped at a street-level zoom
  // so one lone shop doesn't zoom in absurdly far.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapsReady || !map || userLocation || shops.length === 0) return;
    if (shops.length === 1) {
      map.setCenter({ lat: shops[0].lat, lng: shops[0].lng });
      map.setZoom(SHOP_ZOOM);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    shops.forEach((shop) => bounds.extend({ lat: shop.lat, lng: shop.lng }));
    map.fitBounds(bounds, 56);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsReady, shops.length]);

  // The customer's own "you are here" dot. Keyed on BOTH the map being ready
  // and a location fix existing, since either can arrive first — the old
  // version only recentered inside the geolocation callback, which silently
  // did nothing whenever the fix landed before the map had finished loading.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapsReady || !map || !userLocation) return;

    if (!userMarkerRef.current) {
      userMarkerRef.current = new google.maps.Marker({
        position: userLocation,
        map,
        title: t.youAreHere,
        zIndex: 999,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });
    } else {
      userMarkerRef.current.setPosition(userLocation);
    }

    const nearest = nearestShop(shops, userLocation);
    if (nearest) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(userLocation);
      bounds.extend({ lat: nearest.lat, lng: nearest.lng });
      map.fitBounds(bounds, 56);
    } else {
      map.setCenter(userLocation);
      map.setZoom(LOCATED_ZOOM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsReady, userLocation]);

  const nearestId = userLocation ? (nearestShop(shops, userLocation)?.id ?? null) : null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleNearestClick}
          disabled={locationStatus === "requesting" || shops.length === 0}
          className="flex h-11 w-full items-center justify-center rounded-full bg-black text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {locationStatus === "requesting" ? t.finding : t.nearest}
        </button>

        {locationStatus === "granted" && (
          <p className="text-center text-xs text-zinc-500">{t.granted}</p>
        )}
        {locationStatus === "denied" && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-center text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {t.deniedBefore}
            <button type="button" onClick={requestLocation} className="underline">
              {t.deniedLink}
            </button>
            {t.deniedAfter}
          </p>
        )}
        {locationStatus === "unavailable" && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-center text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {t.unavailableMsg}{" "}
            <button type="button" onClick={requestLocation} className="underline">
              {t.tryAgain}
            </button>
          </p>
        )}
        {locationStatus === "unsupported" && (
          <p className="text-center text-xs text-zinc-500">{t.unsupported}</p>
        )}
      </div>

      {apiKey && !mapsError ? (
        <div ref={mapDivRef} className="h-64 w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800" />
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-400 dark:border-zinc-700">
          {t.mapUnavailable}
        </p>
      )}

      <div className="space-y-2">
        {shops.map((shop) => {
          const selected = selectedShopId === shop.id;
          return (
            <div
              key={shop.id}
              className={`rounded-xl border p-3 text-sm ${selected ? "border-black bg-white dark:border-white dark:bg-zinc-800" : "cursor-pointer border-zinc-300 bg-zinc-50 shadow-sm transition hover:border-black hover:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-white"}`}
            >
              <button
                type="button"
                onClick={() => {
                  focusShop(shop, userLocation);
                  trackLocation("SELECT", shop.id);
                }}
                className="w-full text-left"
                aria-pressed={selected}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-black dark:text-zinc-50">
                    {shop.name}
                    {nearestId === shop.id && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
                        {t.nearestBadge}
                      </span>
                    )}
                  </span>
                  {shop.distanceKm !== null && <span className="shrink-0 text-xs text-zinc-400">{shop.distanceKm.toFixed(1)} km</span>}
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">{shop.address}</p>
                {availabilityLabel(shop, t, locale) && <p className="mt-1 text-xs font-medium">{availabilityLabel(shop, t, locale)}</p>}
              </button>
              {/* A location open for booking always shows its buttons; the others show theirs once tapped. */}
              {(selected || shop.bookable) &&
                (shop.bookable ? (
                  <div className="mt-3 flex gap-2">
                    <PendingLink
                      href={carry ? `/rent/${shop.id}?${carry}` : `/rent/${shop.id}`}
                      className="flex h-11 flex-1 items-center justify-center rounded-full bg-black text-sm font-semibold text-white dark:bg-white dark:text-black"
                    >
                      {t.book}
                    </PendingLink>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackLocation("DIRECTIONS", shop.id)}
                      className={`flex h-11 items-center justify-center rounded-full border px-4 text-sm font-medium ${pressableClass}`}
                    >
                      {t.directions}
                    </a>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <span
                      aria-disabled="true"
                      className="flex h-11 flex-1 cursor-not-allowed items-center justify-center rounded-full border border-zinc-200 text-sm font-semibold text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
                    >
                      {t.tooFar}
                    </span>
                    <PendingLink
                      href={carry ? `/rent/${shop.id}?${carry}` : `/rent/${shop.id}`}
                      className={`flex h-11 flex-1 items-center justify-center rounded-full border px-4 text-sm font-semibold ${pressableClass}`}
                    >
                      {t.checkRates}
                    </PendingLink>
                  </div>
                ))}
            </div>
          );
        })}
        {shops.length === 0 && <p className="text-center text-sm text-zinc-400">{t.noShops}</p>}
      </div>
    </div>
  );
}
