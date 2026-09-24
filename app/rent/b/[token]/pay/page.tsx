import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createDroneRentalFeePaymentIntent } from "@/lib/droneRental/payment";
import { PaymentForm } from "@/components/PaymentForm";
import { devBypassDronePaymentAction } from "./actions";

/** Only ever a same-origin relative path (e.g. /merchant/pickup/<id> for a walk-in) — never an absolute/protocol-relative URL, so this can't be turned into an open redirect via the `next` query param. */
function safeNextPath(next: string | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export default async function DroneBookingPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { token } = await params;
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("dr_bookings")
    .select("id,status,rental_fee_myr,deposit_myr")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) notFound();
  if (booking.status !== "PENDING_PAYMENT") redirect(nextPath ?? `/rent/b/${token}`);

  // Stripe may not be configured with a real key in this environment yet —
  // the dev bypass button below still needs the page to render regardless.
  let clientSecret: string | null = null;
  try {
    ({ clientSecret } = await createDroneRentalFeePaymentIntent(booking.id));
  } catch {
    clientSecret = null;
  }

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}${nextPath ?? `/rent/b/${token}`}`;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Pay to confirm</h1>
        <p className="mt-1 text-sm text-zinc-500">
          RM{booking.rental_fee_myr} rental fee now · RM{booking.deposit_myr} refundable deposit held on your card too.
        </p>
      </div>

      {clientSecret ? (
        <PaymentForm clientSecret={clientSecret} returnUrl={returnUrl} locale="en" />
      ) : (
        <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
          Payment is temporarily unavailable — please try again shortly.
        </p>
      )}

      {/* DEV ONLY — remove this before launch. Bypasses Stripe entirely. */}
      <form action={devBypassDronePaymentAction} className="border-t border-dashed border-amber-400 pt-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="next" value={nextPath ?? ""} />
        <button
          type="submit"
          className="flex h-10 w-full items-center justify-center rounded-full border border-dashed border-amber-500 text-xs font-medium text-amber-700 dark:text-amber-400"
        >
          [DEV] Skip payment
        </button>
      </form>
    </div>
  );
}
