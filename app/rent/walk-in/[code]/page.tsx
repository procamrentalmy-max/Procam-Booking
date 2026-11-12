import { notFound, redirect } from "next/navigation";
import { shopIdForWalkInCode } from "@/lib/droneRental/walkInRequests";

// The answer depends on the code only, but the page it goes to is live, so never cache the redirect.
export const dynamic = "force-dynamic";

/**
 * The shop's standing QR. There is no separate walk-in page any more: it opens the shop's booking page with "Now" already chosen on
 * the times step (a shop that is not open for booking shows its rates there, like Check Rates does).
 */
export default async function WalkInQrLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const shopId = await shopIdForWalkInCode(code);
  if (!shopId) notFound();
  redirect(`/rent/${shopId}?now=1`);
}
