"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { rentalFeeMyr } from "@/lib/droneRental/pricingRules";
import { getMerchantInstantOptionsAction, createInstantBookingAction } from "./actions";
import type { MerchantInstantOptions } from "@/lib/droneRental/merchantBooking";

type Shop = { id: string; name: string };
type Drone = { id: string; human_id: string; shop_id: string };

export function InstantBookingForm({ shops, drones }: { shops: Shop[]; drones: Drone[] }) {
  const router = useRouter();
  const [shopId, setShopId] = useState(shops[0]?.id ?? "");
  const dronesForShop = drones.filter((d) => d.shop_id === shopId);
  const [droneId, setDroneId] = useState(dronesForShop[0]?.id ?? "");
  const [options, setOptions] = useState<MerchantInstantOptions | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const next = drones.find((d) => d.shop_id === shopId);
    setDroneId(next?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  useEffect(() => {
    if (!shopId || !droneId) {
      setOptions(null);
      return;
    }
    let cancelled = false;
    setOptions(null);
    setDurationMinutes(null);
    getMerchantInstantOptionsAction({ shopId, droneId })
      .then((result) => {
        if (cancelled) return;
        setOptions(result);
        if (result.allowed) setDurationMinutes(result.offeredDurationsMinutes[0]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [shopId, droneId]);

  async function submit() {
    if (!durationMinutes) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createInstantBookingAction({ shopId, droneId, durationMinutes, name, phone, email });
      // Same pay -> webhook -> CONFIRMED path an online booking goes
      // through — hand the device to the customer to pay here, then the
      // deposit hold gets placed automatically same as online (see
      // lib/droneRental/payment.ts::confirmDroneBookingAfterPayment).
      router.push(`/rent/b/${result.secureToken}/pay?next=${encodeURIComponent(`/merchant/pickup/${result.bookingId}`)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  if (shops.length === 0) {
    return <p className="text-center text-sm text-zinc-400">No shops assigned to your account yet.</p>;
  }

  return (
    <div className="space-y-4">
      {shops.length > 1 && (
        <select value={shopId} onChange={(e) => setShopId(e.target.value)} className={`w-full ${inputClass}`}>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      {dronesForShop.length === 0 ? (
        <p className="text-center text-sm text-zinc-400">No drones available at this shop right now.</p>
      ) : (
        <select value={droneId} onChange={(e) => setDroneId(e.target.value)} className={`w-full ${inputClass}`}>
          {dronesForShop.map((d) => (
            <option key={d.id} value={d.id}>
              {d.human_id}
            </option>
          ))}
        </select>
      )}

      {options && !options.allowed && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-center text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Too close to an existing booking on this drone to take a walk-in right now.
        </p>
      )}

      {options?.allowed && (
        <div>
          <p className="mb-2 text-sm font-medium">How many hours?</p>
          <div className="grid grid-cols-4 gap-2">
            {options.offeredDurationsMinutes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDurationMinutes(m)}
                className={`rounded-lg border py-3 text-sm font-medium ${
                  durationMinutes === m ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {m / 60}h
              </button>
            ))}
          </div>
          {durationMinutes && <p className="mt-2 text-center text-sm text-zinc-500">RM{rentalFeeMyr(durationMinutes)} rental fee</p>}
        </div>
      )}

      <div className="space-y-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" className={`w-full ${inputClass}`} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className={`w-full ${inputClass}`} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className={`w-full ${inputClass}`} />
      </div>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <button
        type="button"
        disabled={loading || !options?.allowed || !durationMinutes || !name || !phone || !email}
        onClick={submit}
        className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}
      >
        {loading ? "Booking…" : "Book now & collect payment"}
      </button>
      <p className="text-center text-xs text-zinc-400">
        Next: hand your device to the customer to pay by card — the RM100 deposit hold goes on automatically, same as an online booking.
      </p>
    </div>
  );
}
