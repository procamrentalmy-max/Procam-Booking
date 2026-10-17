"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { inputClass } from "@/components/formStyles";
import { WEEKDAY_NAMES, type DayHours } from "@/lib/droneRental/hours";
import { updateShopInfoAction } from "./actions";

export type ShopInfo = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  googleMapsUrl: string | null;
  active: boolean;
  /** Always seven entries, Sunday first (a shop with no hours set shows the default 08:00 to 22:00). */
  hours: DayHours[];
  /** The address is still the one a new account starts with, so the form asks for the real one. */
  needsDetails: boolean;
};

/** Edit info: everything about the merchant's shop in one form: name, address, map position, opening hours, and whether customers can see it. */
export function EditShopInfoForm({ shop }: { shop: ShopInfo }) {
  return (
    <details open={shop.needsDetails || undefined}>
      <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-sm text-zinc-500 underline underline-offset-2">
        Edit info
        {shop.needsDetails && (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white" title="The shop still needs its address" aria-label="The shop still needs its address">
            !
          </span>
        )}
      </summary>
      <ActionForm action={updateShopInfoAction} submitLabel="Save info" savedText="Saved." className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="shopId" value={shop.id} />
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Shop name</span>
          <input name="name" defaultValue={shop.name} required className={`w-full ${inputClass}`} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Address</span>
          <input name="address" defaultValue={shop.needsDetails ? "" : shop.address} placeholder="Where customers collect the drone" required className={`w-full ${inputClass}`} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Latitude</span>
          <input name="lat" type="number" step="0.000001" defaultValue={shop.needsDetails ? "" : shop.lat} required className={`w-full ${inputClass}`} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Longitude</span>
          <input name="lng" type="number" step="0.000001" defaultValue={shop.needsDetails ? "" : shop.lng} required className={`w-full ${inputClass}`} />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="text-zinc-500">Google Maps link (optional)</span>
          <input name="googleMapsUrl" type="url" defaultValue={shop.googleMapsUrl ?? ""} className={`w-full ${inputClass}`} />
        </label>
        <p className="text-xs text-zinc-500 sm:col-span-2">Get the exact position by right-clicking the spot on Google Maps and copying the latitude and longitude shown.</p>

        <div className="space-y-1.5 sm:col-span-2">
          <p className="text-sm font-medium">Opening hours</p>
          <p className="text-xs text-zinc-500">
            Malaysia time, on the hour or half hour. Customers can only book times inside the hours (the rental has to end by closing), and the shop shows as closed outside them for swaps and walk-ins.
          </p>
          {WEEKDAY_NAMES.map((dayName, day) => {
            const d = shop.hours[day];
            return (
              <div key={dayName} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-24 shrink-0">{dayName}</span>
                <input type="time" step={1800} name={`open-${day}`} defaultValue={d?.open ?? "08:00"} aria-label={`${dayName} opens`} className={inputClass} />
                <span className="text-zinc-500">to</span>
                <input type="time" step={1800} name={`close-${day}`} defaultValue={d?.close ?? "22:00"} aria-label={`${dayName} closes`} className={inputClass} />
                <label className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                  <input type="checkbox" name={`closed-${day}`} defaultChecked={d === null} />
                  Closed
                </label>
              </div>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="active" defaultChecked={shop.active} />
          Open to customers (shown on the shop list and map)
        </label>
      </ActionForm>
    </details>
  );
}
