import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { generateQrDataUrl } from "@/lib/qr";
import { requestOrigin } from "@/lib/requestOrigin";
import { canAccessShop } from "@/lib/droneRental/access";
import { getWalkInRequestById, viewOf } from "@/lib/droneRental/walkInRequests";
import { DEPOSIT_MYR, formatMyr, rentalFeeMyr } from "@/lib/droneRental/pricingRules";
import { formatClock } from "@/lib/droneRental/format";
import { AutoRefresh } from "@/components/droneRental/AutoRefresh";
import { WalkInButtons } from "./WalkInButtons";

function Card({ children, tone }: { children: React.ReactNode; tone?: "good" | "warn" | "bad" }) {
  const tones = {
    good: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950",
    warn: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950",
    bad: "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950",
  } as const;
  return (
    <div className={`rounded-2xl border p-4 ${tone ? tones[tone] : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"}`}>{children}</div>
  );
}

export default async function WalkInPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const ctx = await getAuthContext();
  const request = await getWalkInRequestById(requestId);
  if (!request || !(await canAccessShop(ctx, request.shop_id))) notFound();

  const supabase = createServiceRoleClient();
  const [{ data: drone }, { data: shop }, bookingResult] = await Promise.all([
    supabase.from("dr_drones").select("human_id").eq("id", request.drone_id).single(),
    supabase.from("dr_shops").select("name").eq("id", request.shop_id).single(),
    request.booking_id ? supabase.from("dr_bookings").select("status,human_id").eq("id", request.booking_id).single() : Promise.resolve({ data: null }),
  ]);
  const booking = bookingResult.data;

  const view = viewOf(request);
  const hours = request.duration_minutes / 60;
  const summary = `${drone?.human_id ?? "—"} · ${hours} hour${hours === 1 ? "" : "s"} · ${formatMyr(rentalFeeMyr(request.duration_minutes))} + ${formatMyr(DEPOSIT_MYR)} deposit hold`;

  const bookingStatus = booking?.status ?? null;
  // Anything still moving keeps refreshing; finished or dead states don't.
  const stillMoving = view === "WAITING" || view === "SUBMITTED" || (view === "ACCEPTED" && (bookingStatus === "PENDING_PAYMENT" || bookingStatus === null));

  let qrDataUrl: string | null = null;
  let customerUrl = "";
  if (view === "WAITING") {
    customerUrl = `${await requestOrigin()}/rent/w/${request.public_token}`;
    qrDataUrl = await generateQrDataUrl(customerUrl);
  }

  return (
    <div className="space-y-4 pb-10 pt-4">
      {stillMoving && <AutoRefresh seconds={3} />}

      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Walk-in · {shop?.name ?? ""}</p>
        <p className="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">{summary}</p>
      </div>

      {view === "WAITING" && (
        <>
          <Card>
            <p className="text-center text-base font-semibold text-black dark:text-zinc-50">Ask the customer to scan this</p>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL, next/image can't optimize it
              <img src={qrDataUrl} alt="QR code for the customer to fill in their details" className="mx-auto mt-3 h-60 w-60 rounded-lg" />
            )}
            <p className="mt-3 text-center text-sm text-zinc-500">They fill in their name, phone and email on their own phone. You&apos;ll see them here.</p>
            <p className="mt-2 break-all text-center text-[11px] text-zinc-400">{customerUrl}</p>
          </Card>
          <Card tone="warn">
            <p className="text-center text-sm font-medium text-amber-900 dark:text-amber-200">Waiting for the customer to fill in their details…</p>
            <p className="mt-1 text-center text-xs text-amber-800/80 dark:text-amber-300/80">This QR works for 15 minutes (until {formatClock(new Date(request.expires_at))}).</p>
          </Card>
          <WalkInButtons requestId={request.id} mode="cancel" />
        </>
      )}

      {view === "SUBMITTED" && (
        <>
          <Card tone="good">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-800 dark:text-green-300">Customer filled in their details</p>
            <p className="mt-2 text-2xl font-bold text-black dark:text-zinc-50">{request.customer_name}</p>
            <p className="mt-1 text-base text-zinc-700 dark:text-zinc-300">{request.customer_phone}</p>
            <p className="text-sm text-zinc-500">{request.customer_email}</p>
          </Card>
          <p className="px-1 text-center text-xs text-zinc-500">
            Check these match the person in front of you. Accepting sends their phone to payment — you&apos;ll see here when it&apos;s paid.
          </p>
          <WalkInButtons requestId={request.id} mode="approve" />
        </>
      )}

      {view === "ACCEPTED" && (bookingStatus === "PENDING_PAYMENT" || bookingStatus === null) && (
        <Card tone="warn">
          <p className="text-center text-base font-semibold text-amber-900 dark:text-amber-200">Accepted — waiting for {request.customer_name} to pay</p>
          <p className="mt-1 text-center text-sm text-amber-800 dark:text-amber-300">
            Their phone is on the payment page now ({formatMyr(rentalFeeMyr(request.duration_minutes))} + {formatMyr(DEPOSIT_MYR)} deposit hold). This updates by itself.
          </p>
        </Card>
      )}

      {view === "ACCEPTED" && bookingStatus === "CONFIRMED" && booking && request.booking_id && (
        <>
          <Card tone="good">
            <p className="text-center text-lg font-bold text-green-900 dark:text-green-100">Paid — ready to hand over</p>
            <p className="mt-1 text-center text-sm text-green-800 dark:text-green-200">
              {request.customer_name} · {booking.human_id}
            </p>
          </Card>
          <Link
            href={`/merchant/pickup/${request.booking_id}`}
            className="flex h-14 items-center justify-center rounded-2xl bg-black text-base font-semibold text-white dark:bg-white dark:text-black"
          >
            Hand over the drone
          </Link>
        </>
      )}

      {view === "ACCEPTED" && bookingStatus !== null && bookingStatus !== "PENDING_PAYMENT" && bookingStatus !== "CONFIRMED" && (
        <Card tone="bad">
          <p className="text-center text-sm font-semibold text-red-900 dark:text-red-200">
            {bookingStatus === "EXPIRED" ? "Payment wasn't completed in time, so the booking expired." : "This booking is no longer pending."}
          </p>
          <Link href="/merchant/instant-booking" className="mt-3 flex h-11 items-center justify-center rounded-xl bg-black text-sm font-semibold text-white dark:bg-white dark:text-black">
            Start a new walk-in
          </Link>
        </Card>
      )}

      {(view === "DECLINED" || view === "CANCELLED" || view === "EXPIRED") && (
        <Card tone="bad">
          <p className="text-center text-sm font-semibold text-red-900 dark:text-red-200">
            {view === "DECLINED" ? "You declined this walk-in." : view === "CANCELLED" ? "This walk-in was cancelled." : "This QR expired before it was completed."}
          </p>
          <Link href="/merchant/instant-booking" className="mt-3 flex h-11 items-center justify-center rounded-xl bg-black text-sm font-semibold text-white dark:bg-white dark:text-black">
            Start a new walk-in
          </Link>
        </Card>
      )}

      <Link href="/merchant" className="block text-center text-sm text-zinc-500 underline underline-offset-2">
        Back to dashboard
      </Link>
    </div>
  );
}
