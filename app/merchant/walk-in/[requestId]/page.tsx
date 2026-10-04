import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { canAccessShop } from "@/lib/droneRental/access";
import { eligibleDronesForRequest, getWalkInRequestById, viewOf } from "@/lib/droneRental/walkInRequests";
import { depositMyrFor, formatMyr, modelProfile, rentalFeeMyr } from "@/lib/droneRental/pricingRules";
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

/** A walk-in customer's order, from the shop's QR: the merchant checks it and confirms; payment and handover follow here. */
export default async function WalkInPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const ctx = await getAuthContext();
  const request = await getWalkInRequestById(requestId);
  if (!request || !(await canAccessShop(ctx, request.shop_id))) notFound();

  const supabase = createServiceRoleClient();
  const [{ data: drone }, { data: shop }, bookingResult] = await Promise.all([
    request.drone_id ? supabase.from("dr_drones").select("human_id").eq("id", request.drone_id).single() : Promise.resolve({ data: null }),
    supabase.from("dr_shops").select("name").eq("id", request.shop_id).single(),
    request.booking_id ? supabase.from("dr_bookings").select("status,human_id").eq("id", request.booking_id).single() : Promise.resolve({ data: null }),
  ]);
  const booking = bookingResult.data;

  const view = viewOf(request);
  const hours = request.duration_minutes / 60;
  const batteries = request.batteries_count === 1 ? 1 : 2;
  const summary = `${modelProfile(request.drone_model).shortName} · ${hours} hour${hours === 1 ? "" : "s"} · ${batteries} ${batteries === 1 ? "battery" : "batteries"} · ${formatMyr(rentalFeeMyr(request.duration_minutes, batteries, request.drone_model))} + ${formatMyr(depositMyrFor(request.drone_model))} deposit hold`;

  const bookingStatus = booking?.status ?? null;
  const droneOptions = view === "SUBMITTED" ? await eligibleDronesForRequest(request) : [];
  // Anything still moving keeps refreshing; finished or dead states don't.
  const stillMoving = view === "SUBMITTED" || (view === "ACCEPTED" && (bookingStatus === "PENDING_PAYMENT" || bookingStatus === null));

  return (
    <div className="space-y-4 pb-10 pt-4">
      {stillMoving && <AutoRefresh seconds={3} />}

      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Walk-in order · {shop?.name ?? ""}</p>
        <p className="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">{drone?.human_id ? `${drone.human_id} · ` : ""}{summary}</p>
      </div>

      {view === "SUBMITTED" && (
        <>
          <Card tone="good">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-800 dark:text-green-300">Customer&apos;s order</p>
            <p className="mt-2 text-2xl font-bold text-black dark:text-zinc-50">{request.customer_name}</p>
            <p className="mt-1 text-base text-zinc-700 dark:text-zinc-300">{request.customer_phone}</p>
            <p className="text-sm text-zinc-500">{request.customer_email}</p>
          </Card>
          <p className="px-1 text-center text-xs text-zinc-500">
            Check these match the person in front of you. Confirming sends their phone to payment, then you&apos;ll hand over here.
          </p>
          <WalkInButtons requestId={request.id} droneOptions={droneOptions} />
        </>
      )}

      {view === "ACCEPTED" && (bookingStatus === "PENDING_PAYMENT" || bookingStatus === null) && (
        <Card tone="warn">
          <p className="text-center text-base font-semibold text-amber-900 dark:text-amber-200">Confirmed. Waiting for {request.customer_name} to pay</p>
          <p className="mt-1 text-center text-sm text-amber-800 dark:text-amber-300">Their phone is on the payment page now. This updates by itself.</p>
        </Card>
      )}

      {view === "ACCEPTED" && bookingStatus === "CONFIRMED" && booking && request.booking_id && (
        <>
          <Card tone="good">
            <p className="text-center text-lg font-bold text-green-900 dark:text-green-100">Paid. Ready to hand over</p>
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
            {bookingStatus === "EXPIRED" ? "Payment wasn't completed in time, so the order expired." : "This order is no longer pending."}
          </p>
        </Card>
      )}

      {(view === "DECLINED" || view === "CANCELLED" || view === "EXPIRED" || view === "WAITING") && (
        <Card tone="bad">
          <p className="text-center text-sm font-semibold text-red-900 dark:text-red-200">
            {view === "DECLINED" ? "You declined this order." : view === "CANCELLED" ? "This order was cancelled." : "This order expired before it was confirmed."}
          </p>
        </Card>
      )}
    </div>
  );
}
