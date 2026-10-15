"use client";

import { useState } from "react";
import Link from "next/link";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";
import { pressableClass } from "@/components/formStyles";

type Shop = { id: string; name: string; address: string; lat: number; lng: number; googleMapsUrl: string | null; charged: number; openNow: boolean; hoursToday: string };

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** The shops a customer can swap a battery at, nearest first once their location is shared, each with how many charged batteries it has. */
export function SwapShopList({ token, shops, locale }: { token: string; shops: Shop[]; locale: Locale }) {
  const t = droneText(locale).swap;
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [state, setState] = useState<"idle" | "finding" | "off">("idle");

  function locate() {
    if (!navigator.geolocation) return setState("off");
    setState("finding");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setHere({ lat: p.coords.latitude, lng: p.coords.longitude });
        setState("idle");
      },
      () => setState("off"),
      { timeout: 10000 }
    );
  }

  const sorted = [...shops]
    .map((s) => ({ ...s, km: here ? distanceKm(here, s) : null }))
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-3">
      <button type="button" onClick={locate} disabled={state === "finding"} className={`h-11 w-full rounded-full border text-sm font-semibold disabled:opacity-60 ${pressableClass}`}>
        {state === "finding" ? t.finding : t.nearest}
      </button>
      {state === "off" && <p className="text-xs text-zinc-500">{t.locationOff}</p>}
      <ul className="space-y-3">
        {sorted.map((s, i) => (
          <li key={s.id} className="space-y-2 rounded-xl border border-zinc-300 bg-zinc-50 p-4 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-black dark:text-zinc-50">{s.name}</p>
                <p className="text-xs text-zinc-500">{s.address}</p>
              </div>
              {s.km !== null && (
                <span className="shrink-0 text-xs text-zinc-500">
                  {s.km.toFixed(1)} km{i === 0 ? " ★" : ""}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">{t.hoursToday(s.hoursToday)}</p>
            <p className={`text-xs font-medium ${s.charged > 0 && s.openNow ? "text-green-700 dark:text-green-400" : "text-zinc-500"}`}>{!s.openNow ? t.closedNow : s.charged > 0 ? t.charged(s.charged) : t.none}</p>
            <div className="flex gap-2">
              {s.charged > 0 && s.openNow ? (
                <Link href={`/rent/b/${token}/swap/${s.id}`} className="flex h-11 flex-1 items-center justify-center rounded-full bg-black text-sm font-semibold text-white dark:bg-white dark:text-black">
                  {t.swapHere}
                </Link>
              ) : (
                <span className="flex h-11 flex-1 items-center justify-center rounded-full border border-zinc-200 text-sm text-zinc-400 dark:border-zinc-800">{s.openNow ? t.none : t.closedNow}</span>
              )}
              {s.googleMapsUrl && (
                <a href={s.googleMapsUrl} target="_blank" rel="noreferrer" className={`flex h-11 items-center justify-center rounded-full border px-4 text-sm font-medium ${pressableClass}`}>
                  {t.directions}
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
