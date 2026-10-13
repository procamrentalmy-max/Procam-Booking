import Link from "next/link";
import { FREE_CANCELLATION_HOURS, HOLD_DAYS, LEGAL_UPDATED } from "@/lib/legal";
import { LegalList, LegalSection, LegalTitle } from "../LegalSection";

export const metadata = {
  title: "Refund & Cancellation Policy — ProCam Rental",
  description: "When ProCam Rental refunds a booking, how cancellations work, and how card deposits are released.",
};

export default function RefundsPage() {
  return (
    <>
      <LegalTitle title="Refund & Cancellation Policy" updated={LEGAL_UPDATED} />

      <LegalSection title="1. You cancel">
        <LegalList
          items={[
            `Cancel at least ${FREE_CANCELLATION_HOURS} hours before your start time: you get the whole rental fee back.`,
            `Cancel less than ${FREE_CANCELLATION_HOURS} hours before the start, or do not turn up: the rental fee is not refunded. If we can rent the drone to someone else for that time, we will refund you.`,
            "To cancel, contact us (see the Contact page) with your booking number, the name and the phone number you booked with.",
          ]}
        />
      </LegalSection>

      <LegalSection title="2. We cancel, or something goes wrong: full refund">
        <p>You get the full rental fee back, and your deposit hold is released, when:</p>
        <LegalList
          items={[
            "the last drone for your time was taken by someone who paid just before you. This is refunded automatically and you are asked to choose another time;",
            "the wind forecast is above the drone's limit, or the shop judges the weather or the place unsafe to fly, and you are not able to rebook;",
            "the shop cannot give you the drone you booked, or the drone, battery or controller is faulty at hand-over;",
            "the shop cannot confirm who you are, or your ID does not match your booking;",
            "we cancel for any other reason.",
          ]}
        />
        <p>If we can offer you another time or drone instead, you can accept that, or take the refund.</p>
      </LegalSection>

      <LegalSection title="3. Once the drone is out">
        <LegalList
          items={[
            "The rental fee is not refunded for a rental you cut short or for time you did not use, unless the drone stops working through no fault of yours. In that case we refund the unused hours, or give you a replacement drone.",
            "Late fees and battery swaps are not refunded unless we charged them by mistake.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Your deposit">
        <LegalList
          items={[
            "The deposit is only ever a hold on your card. If everything comes back in good condition, the whole hold is released. No money was taken, so there is nothing to refund.",
            `If something is damaged, we charge only the cost of the repair, up to the amount held, and release the rest. If something is lost we keep the deposit held for that item. See the Terms for how this works.`,
            `Your bank decides how fast a released hold disappears from your statement. This usually takes a few working days. A hold that is not captured is released automatically after about ${HOLD_DAYS} days.`,
          ]}
        />
      </LegalSection>

      <LegalSection title="5. How refunds are paid">
        <p>
          Refunds go back to the card you paid with, in Malaysian Ringgit. We start the refund straight away. Your bank may take 5 to 10 working days to show it. Fees charged by the payment processor are not returned to us, but we never take them out of your
          refund. If you paid in cash at the shop, the shop returns the cash.
        </p>
      </LegalSection>

      <LegalSection title="6. A charge you disagree with">
        <p>
          If you think a damage charge, late fee or any other charge is wrong, contact us within 14 days. We will go through the hand-over and return photos with you and correct it if we got it wrong. Please contact us first, before asking your bank to reverse
          the payment, so we can fix it quickly.
        </p>
      </LegalSection>

      <LegalSection title="7. Contact">
        <p>
          Send us your booking number on the <Link href="/legal/contact" className="underline underline-offset-2">Contact page</Link>. See also the{" "}
          <Link href="/legal/terms" className="underline underline-offset-2">Terms & Conditions</Link>.
        </p>
      </LegalSection>
    </>
  );
}
