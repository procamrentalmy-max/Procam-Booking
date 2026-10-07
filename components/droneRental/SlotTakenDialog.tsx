"use client";

import { useRouter } from "next/navigation";

/** The popup shown when the last drone for a time was booked (and paid for) by someone else first. */
export function SlotTakenDialog({
  onChooseAnother,
  shopId,
  walkIn = false,
}: {
  /** Called when the customer taps the button, to go back to choosing a time with their details still filled in. */
  onChooseAnother?: () => void;
  /** Without an `onChooseAnother`, the button goes back to this shop's booking page, where the details they typed are still there. */
  shopId?: string;
  /** A walk-in is at the shop: there is no time to pick, only the staff to ask. */
  walkIn?: boolean;
}) {
  const router = useRouter();
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="slot-taken-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-zinc-900">
        <p id="slot-taken-title" className="text-lg font-semibold text-black dark:text-zinc-50">
          {walkIn ? "That drone was just taken" : "The last drone for this session has been booked"}
        </p>
        <p className="mt-2 text-sm text-zinc-500">{walkIn ? "Someone else got it first. Please ask the staff." : "Please choose another time."}</p>
        {!walkIn && (
          <button
            type="button"
            onClick={() => (onChooseAnother ? onChooseAnother() : router.push(`/rent/${shopId}?retry=1`))}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-black text-sm font-semibold text-white dark:bg-white dark:text-black"
          >
            Choose another time
          </button>
        )}
      </div>
    </div>
  );
}
