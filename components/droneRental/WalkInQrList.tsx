import { walkInUrl } from "@/lib/walkInQr";

export type WalkInQrShop = { id: string; name: string; walkin_code: string };

/** Each shop's standing walk-in QR: the same picture and address for ever, with a button to save it as a PNG to print. */
export function WalkInQrList({ shops, empty }: { shops: WalkInQrShop[]; empty: string }) {
  if (shops.length === 0) return <p className="text-center text-sm text-zinc-400">{empty}</p>;
  return (
    <>
      {shops.map((shop) => (
        <div key={shop.id} className="rounded-2xl border border-zinc-200 bg-white p-5 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-base font-semibold text-black dark:text-zinc-50">{shop.name}</p>
          <p className="text-sm text-zinc-500">Scan to rent a drone now</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a generated QR picture from our own route */}
          <img src={`/rent/walk-in/${shop.walkin_code}/qr`} alt={`Walk-in QR code for ${shop.name}`} loading="lazy" className="mx-auto mt-3 h-72 w-72 max-w-full rounded-lg" />
          <a
            href={`/rent/walk-in/${shop.walkin_code}/qr?download=1`}
            className="mx-auto mt-3 flex h-11 w-full max-w-72 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold dark:border-zinc-700"
          >
            Download QR (PNG)
          </a>
          <p className="mt-3 break-all text-[11px] text-zinc-400">{walkInUrl(shop.walkin_code)}</p>
        </div>
      ))}
    </>
  );
}
