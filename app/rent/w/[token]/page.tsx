import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getWalkInRequestByToken, viewOf } from "@/lib/droneRental/walkInRequests";
import { BATTERIES_INCLUDED, DEPOSIT_MYR, formatMyr, rentalFeeMyr } from "@/lib/droneRental/pricingRules";
import { AutoRefresh } from "@/components/droneRental/AutoRefresh";
import { WalkInDetailsForm } from "./WalkInDetailsForm";

// Per-visitor and time-sensitive (a QR expires, the merchant accepts) — must never be cached.
export const dynamic = "force-dynamic";

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-5 text-center dark:border-zinc-800">
      <p className="text-lg font-semibold text-black dark:text-zinc-50">{title}</p>
      <div className="mt-1 text-sm text-zinc-500">{children}</div>
    </div>
  );
}

export default async function WalkInCustomerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const request = await getWalkInRequestByToken(token);
  if (!request) notFound();

  const view = viewOf(request);
  const supabase = createServiceRoleClient();

  // The merchant accepted: send them straight on to pay for the booking that was just created —
  // but only while it's still waiting for payment. Once it's paid (or expired) this link must not
  // keep leading to that booking, so anyone who photographed the QR can't use it to peek at it later.
  let qrAlreadyUsed = false;
  if (view === "ACCEPTED" && request.booking_id) {
    const { data: booking } = await supabase.from("dr_bookings").select("secure_token,status").eq("id", request.booking_id).single();
    if (booking?.status === "PENDING_PAYMENT") redirect(`/rent/b/${booking.secure_token}/pay`);
    qrAlreadyUsed = true;
  }

  const { data: shop } = await supabase.from("dr_shops").select("name,address").eq("id", request.shop_id).single();
  const hours = request.duration_minutes / 60;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      {(view === "SUBMITTED" || (view === "ACCEPTED" && !request.booking_id)) && <AutoRefresh seconds={3} />}

      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-400">{shop?.name ?? "Drone rental"}</p>
        <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">Rent a drone now</h1>
      </div>

      {view === "WAITING" && (
        <>
          <div className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
            <p className="font-medium">DJI Neo 2 + RC-N3 controller</p>
            <p className="mt-1 text-zinc-500">
              {hours} hour{hours === 1 ? "" : "s"} · {formatMyr(rentalFeeMyr(request.duration_minutes))}
            </p>
            <p className="mt-2 text-zinc-500">
              Includes the drone, the controller and {BATTERIES_INCLUDED} batteries (one spare), charged at the shop.
            </p>
            <p className="mt-2 text-zinc-500">
              Plus a {formatMyr(DEPOSIT_MYR)} deposit — only a hold on your card, released when you return everything in good condition.
            </p>
          </div>
          <div>
            <p className="mb-3 text-sm font-medium">Your details</p>
            <WalkInDetailsForm token={token} />
          </div>
        </>
      )}

      {view === "SUBMITTED" && (
        <Message title={`Thanks, ${request.customer_name ?? ""}!`}>
          Waiting for the shop to accept. This page moves on to payment by itself — keep it open.
        </Message>
      )}

      {view === "ACCEPTED" && !request.booking_id && <Message title="Accepted — one moment…">Getting your booking ready.</Message>}
      {qrAlreadyUsed && <Message title="This QR code has already been used">If you&apos;ve just booked, the staff will hand over your drone.</Message>}

      {view === "DECLINED" && <Message title="The shop couldn't take this booking">Please check with the staff.</Message>}
      {view === "CANCELLED" && <Message title="This booking was cancelled">Please ask the staff for a new QR code.</Message>}
      {view === "EXPIRED" && <Message title="This QR code has expired">Please ask the staff for a new one.</Message>}
    </div>
  );
}
