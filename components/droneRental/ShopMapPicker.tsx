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

/**
 * Loads the Google Maps JS API exactly once per page, however many times
 * this component mounts, and only resolves once google.maps.Map and
 * google.maps.Marker are actually safe to construct.
 *
 * With `loading=async`, the <script> tag's own `onload` fires as soon as
 * the small bootstrap loader is fetched — NOT once the actual Map/Marker
 * classes are ready, which load as separate dynamic chunks in the
 * background afterward. Constructing `new google.maps.Map(...)` right on
 * `onload` was racing that background load and throwing intermittently.
 * `google.maps.importLibrary(...)` is Google's own API for awaiting a
 * given library's real readiness — see
 * https://developers.google.com/maps/documentation/javascript/load-maps-js-api.
 */
async function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return;

  if (!mapsLoaderPromise) {
    mapsLoaderPromise = new Promise((resolve, reject) => {
      if (window.google?.maps) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Maps"));
      document.head.appendChild(script);
    });
  }

  await mapsLoaderPromise;
  await Promise.all([google.maps.importLibrary("maps"), google.maps.importLibrary("marker")]);
}

function availabilityLabel(shop: ShopMarker): string {
  if (!shop.firstAvailableAt) return "No drones available right now";
  const at = new Date(shop.firstAvailableAt);
  return at.getTime() <= Date.now() ? "First available now" : `Available at ${formatMalaysiaTime(at, "en")}`;
}

export function ShopMapPicker({ initialShops }: { initialShops: ShopMarker[] }) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [shops, setShops] = useState<ShopMarker[]>(initialShops);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "unsupported">("idle");
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      return;
    }
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocationStatus("granted");
        getShopsWithAvailabilityAction(location)
          .then(setShops)
          .catch(() => {});
        if (mapRef.current) {
          mapRef.current.setCenter(location);
          mapRef.current.setZoom(LOCATED_ZOOM);
        }
      },
      () => setLocationStatus("denied"),
      { enableHighAccuracy: false, timeout: 8000 }
    );
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
          mapId: "DRONE_RENTAL_MAP",
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

  // (Re)draw markers whenever the map is ready or the shop list changes.
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

  const selectedShop = shops.find((s) => s.id === selectedShopId) ?? null;

  return (
    <div className="space-y-4">
      {locationStatus === "denied" && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-center text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Location access was denied — shops are shown unsorted.{" "}
          <button type="button" onClick={requestLocation} className="underline">
            Try again
          </button>
        </p>
      )}

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
            onClick={() => {
              setSelectedShopId(shop.id);
              mapRef.current?.panTo({ lat: shop.lat, lng: shop.lng });
              mapRef.current?.setZoom(LOCATED_ZOOM);
            }}
            className={`w-full rounded-xl border p-3 text-left text-sm ${
              selectedShopId === shop.id
                ? "border-black dark:border-white"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-black dark:text-zinc-50">{shop.name}</span>
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
