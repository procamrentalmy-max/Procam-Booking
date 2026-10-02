"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getShopsWithAvailabilityAction } from "@/app/rent/actions";
import { formatMalaysiaTime } from "@/lib/i18n/locale";

export type ShopMarker = {
  id: string;
  humanId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  googleMapsUrl: string | null;
  distanceKm: number | null;
  firstAvailableAt: string | null;
};

/** Malaysia's rough geographic center — the map's fallback view whenever the customer's own location isn't known (denied, unsupported, or not yet resolved). */
const DEFAULT_CENTER = { lat: 4.2105, lng: 101.9758 };
const DEFAULT_ZOOM = 6;
const LOCATED_ZOOM = 12;

let mapsLoaderPromise: Promise<void> | null = null;
let mapsCallbackCounter = 0;

/**
 * Loads the Google Maps JS API exactly once per page, however many times
 * this component mounts, resolving only once google.maps.Map/Marker are
 * genuinely safe to construct.
 *
 * Uses the classic `callback=` query param rather than `loading=async` +
 * `importLibrary`: that combination requires Google's special inline
 * bootstrap snippet to actually define `google.maps.importLibrary` — a
 * plain <script src="...&loading=async"> tag's own `onload` fires as soon
 * as that small stub is fetched, well before `importLibrary` exists at
 * all, which was throwing "google.maps.importLibrary is not a function"
 * every time. `callback=` is the older, plainer contract: Google calls the
 * named global function only once the full library (Map, Marker, the
 * works) is actually loaded and ready to use — nothing to import.
 */
function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.Map) return Promise.resolve();
  if (mapsLoaderPromise) return mapsLoaderPromise;

  mapsLoaderPromise = new Promise((resolve, reject) => {
    const callbackName = `__shopMapPickerInit${mapsCallbackCounter++}`;
    (window as unknown as Record<string, () => void>)[callbackName] = () => resolve();

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return mapsLoaderPromise;
}

function availabilityLabel(shop: ShopMarker): string {
  if (!shop.firstAvailableAt) return "No drones available right now";
  const at = new Date(shop.firstAvailableAt);
  return at.getTime() <= Date.now() ? "First available now" : `Available at ${formatMalaysiaTime(at, "en")}`;
}

type LatLng = { lat: number; lng: number };

function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function nearestShop(shops: ShopMarker[], origin: LatLng): ShopMarker | null {
  let best: { shop: ShopMarker; km: number } | null = null;
  for (const shop of shops) {
    const km = haversineKm(origin, shop);
    if (!best || km < best.km) best = { shop, km };
  }
  return best?.shop ?? null;
}

type LocationStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable" | "unsupported";

export function ShopMapPicker({ initialShops }: { initialShops: ShopMarker[] }) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const wantNearestRef = useRef(false);
  const [shops, setShops] = useState<ShopMarker[]>(initialShops);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
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
      marker.addListener("click", () => setSelectedShopId(shop.id));
      return marker;
    });
  }, [mapsReady, shops]);

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
        title: "You are here",
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

  const selectedShop = shops.find((s) => s.id === selectedShopId) ?? null;
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
          {locationStatus === "requesting" ? "Finding your location…" : "Nearest to me"}
        </button>

        {locationStatus === "granted" && (
          <p className="text-center text-xs text-zinc-500">Showing distances from your current location (blue dot).</p>
        )}
        {locationStatus === "denied" && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-center text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Location access is blocked for this site. Allow it from the lock/tune icon next to the address bar (or your phone&apos;s browser
            settings), then{" "}
            <button type="button" onClick={requestLocation} className="underline">
              try again
            </button>
            .
          </p>
        )}
        {locationStatus === "unavailable" && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-center text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Couldn&apos;t work out where you are right now (is location turned on for your device?).{" "}
            <button type="button" onClick={requestLocation} className="underline">
              Try again
            </button>
          </p>
        )}
        {locationStatus === "unsupported" && (
          <p className="text-center text-xs text-zinc-500">This browser can&apos;t share your location — pick a shop from the list below.</p>
        )}
      </div>

      {apiKey && !mapsError ? (
        <div ref={mapDivRef} className="h-64 w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800" />
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-400 dark:border-zinc-700">
          Map unavailable — pick a shop from the list below.
        </p>
      )}

      {selectedShop && (
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="font-medium text-black dark:text-zinc-50">{selectedShop.name}</p>
          <p className="text-sm text-zinc-500">{selectedShop.address}</p>
          <p className="mt-1 text-sm font-medium">{availabilityLabel(selectedShop)}</p>
          <Link
            href={`/rent/${selectedShop.id}`}
            className="mt-3 flex h-11 items-center justify-center rounded-full bg-black text-sm font-semibold text-white dark:bg-white dark:text-black"
          >
            Book at this shop
          </Link>
        </div>
      )}

      <div className="space-y-2">
        {shops.map((shop) => (
          <button
            key={shop.id}
            type="button"
            onClick={() => focusShop(shop, userLocation)}
            className={`w-full rounded-xl border p-3 text-left text-sm ${
              selectedShopId === shop.id ? "border-black dark:border-white" : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-black dark:text-zinc-50">
                {shop.name}
                {nearestId === shop.id && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
                    Nearest
                  </span>
                )}
              </span>
              {shop.distanceKm !== null && <span className="text-xs text-zinc-400">{shop.distanceKm.toFixed(1)} km</span>}
            </div>
            <p className="text-xs text-zinc-500">{shop.address}</p>
            <p className="mt-1 text-xs font-medium">{availabilityLabel(shop)}</p>
          </button>
        ))}
        {shops.length === 0 && <p className="text-center text-sm text-zinc-400">No shops are open right now.</p>}
      </div>
    </div>
  );
}
