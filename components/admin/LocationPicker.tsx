"use client";

import { useEffect, useRef, useState } from "react";
import { inputClass } from "@/components/formStyles";
import { loadGoogleMaps } from "@/lib/maps/loadGoogleMaps";

const MALAYSIA_CENTER = { lat: 4.2105, lng: 101.9758 };

/**
 * A merchant shop's address and position in one: type the address, press Find on map, then click the map (or drag the pin) to put it exactly
 * where customers collect the drone. Submits `address`, `lat` and `lng` with the form.
 */
export function LocationPicker({ defaultAddress = "", defaultLat = null, defaultLng = null }: { defaultAddress?: string; defaultLat?: number | null; defaultLng?: number | null }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapDiv = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const [address, setAddress] = useState(defaultAddress);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(defaultLat !== null && defaultLng !== null ? { lat: defaultLat, lng: defaultLng } : null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [finding, setFinding] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  function place(next: { lat: number; lng: number }, zoom?: number) {
    setPoint(next);
    if (!map.current) return;
    if (!marker.current) {
      marker.current = new google.maps.Marker({ position: next, map: map.current, draggable: true });
      marker.current.addListener("dragend", () => {
        const p = marker.current?.getPosition();
        if (p) setPoint({ lat: Number(p.lat().toFixed(6)), lng: Number(p.lng().toFixed(6)) });
      });
    } else {
      marker.current.setPosition(next);
    }
    map.current.panTo(next);
    if (zoom) map.current.setZoom(zoom);
  }

  useEffect(() => {
    if (!apiKey || !mapDiv.current) return;
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapDiv.current) return;
        map.current = new google.maps.Map(mapDiv.current, { center: point ?? MALAYSIA_CENTER, zoom: point ? 16 : 6, disableDefaultUI: true, zoomControl: true });
        map.current.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) place({ lat: Number(e.latLng.lat().toFixed(6)), lng: Number(e.latLng.lng().toFixed(6)) });
        });
        if (point) place(point, 16);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
    };
    // The map is built once; later changes of the point go through place().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  async function find() {
    const q = address.trim();
    if (!q) {
      setNote("Type the address first.");
      return;
    }
    setFinding(true);
    setNote(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&countrycodes=my`);
      const json = (await res.json()) as { lat: string; lon: string }[];
      if (json[0]) {
        place({ lat: Number(Number(json[0].lat).toFixed(6)), lng: Number(Number(json[0].lon).toFixed(6)) }, 16);
        setNote("Found. Click the map or drag the pin to put it exactly right.");
      } else {
        setNote("Could not find that address. Click the map to place the pin yourself.");
      }
    } catch {
      setNote("Could not look the address up. Click the map to place the pin yourself.");
    } finally {
      setFinding(false);
    }
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <label className="block space-y-1 text-sm">
        <span className="text-zinc-500">Address</span>
        <div className="flex gap-2">
          <input name="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Where customers collect the drone" required className={`min-w-0 flex-1 ${inputClass}`} />
          <button type="button" onClick={find} disabled={finding || !ready} className="shrink-0 rounded-lg border border-zinc-300 px-3 text-sm font-medium disabled:opacity-50 dark:border-zinc-700">
            {finding ? "Finding…" : "Find on map"}
          </button>
        </div>
      </label>
      <input type="hidden" name="lat" value={point ? point.lat : ""} />
      <input type="hidden" name="lng" value={point ? point.lng : ""} />
      {apiKey && !mapError ? (
        <div ref={mapDiv} className="h-64 w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800" aria-label="Map: click to place the shop" />
      ) : (
        <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700">The map could not be loaded, so the position cannot be set right now.</p>
      )}
      <p className="text-xs text-zinc-500">
        {point ? `Position set: ${point.lat}, ${point.lng}.` : "No position yet. Click the map where the shop is."}
        {note ? ` ${note}` : ""}
      </p>
    </div>
  );
}
