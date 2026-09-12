import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions — ProCam",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-black dark:text-zinc-50">{title}</h2>
      <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </section>
  );
}

/**
 * One general agreement covering the whole service — booking, payment,
 * deposits, damage, verification, privacy, liability. This is separate from
 * the short per-product liability clause shown at booking confirmation
 * (product_terms_versions / booking_acknowledgements), which stays focused
 * and version-tracked per product; this page is the fuller reference it
 * links out to, not a replacement for it.
 */
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Terms &amp; Conditions</h1>
        <p className="mt-1 text-sm text-zinc-500">Last updated 13 September 2026.</p>
      </div>

      <Section title="1. The Service">
        <p>
          ProCam rents action cameras and underwater equipment from self-service smart lockers at partner
          locations in Langkawi, Malaysia. Booking, payment, pickup, and return are all handled through the
          booking pages linked from each locker&apos;s QR code — there is no counter or staff on site.
        </p>
      </Section>

      <Section title="2. Eligibility">
        <p>
          You must be at least 18 years old and able to enter a binding agreement to book a rental. By
          completing a booking, you confirm this is true.
        </p>
      </Section>

      <Section title="3. Booking, Pricing &amp; Payment">
        <p>
          Prices shown at booking are per the selected rental duration and are charged in Malaysian Ringgit
          (MYR). Bookings require at least 2 hours&apos; notice. The rental fee is charged first; a separate,
          refundable security deposit is then held on the same payment method immediately after — you will
          not be asked to pay twice. An unpaid booking that is not completed within a short window is
          automatically cancelled and the equipment released back to other customers.
        </p>
      </Section>

      <Section title="4. Identity Verification">
        <p>
          To book, you must complete an identity verification step (a government ID and a live selfie,
          processed by our verification provider). This confirms you are a real person able to be held
          responsible for the equipment for the rental period. We do not manually review or store copies of
          your ID ourselves — see <Link href="#privacy" className="underline underline-offset-2">Privacy</Link> below
          for how this data is handled.
        </p>
      </Section>

      <Section title="5. Pickup, Use &amp; Return">
        <p>
          You are responsible for the equipment and everything in its kit (cables, cases, accessories) from the
          moment you open the locker compartment until ProCam staff have inspected and accepted its return.
          Use the equipment only as intended and only for the duration booked. Each product page shows
          specific handling instructions (e.g. sealing checks for underwater housings) — following them is
          your responsibility, not something ProCam can verify remotely.
        </p>
        <p>
          Return the equipment to a self-service locker by your booked end time. Returning late incurs the
          late fee shown on your rental package at the time of booking, charged per hour or part-hour late.
        </p>
      </Section>

      <Section title="6. Security Deposit, Damage &amp; Loss">
        <p>
          The security deposit is refundable and is released after staff inspect the returned equipment. If
          the equipment is returned damaged, missing parts, or not returned at all, ProCam may capture some or
          all of the deposit to cover the cost of repair, replacement, or loss. If that cost exceeds the
          deposit amount, you remain responsible for the difference and may be charged separately.
        </p>
        <p>
          For underwater housings specifically: the deposit and any damage assessment cover the ProCam-owned
          housing and kit only. ProCam is not responsible for damage to your own phone or device, including
          water damage, if a housing seal failed — following the guided seal-check step before entering water
          is your responsibility.
        </p>
      </Section>

      <Section title="7. Cancellations &amp; Changes">
        <p>
          To cancel or reschedule a confirmed booking, contact ProCam support through your booking page as
          soon as possible. Refund eligibility depends on how much notice is given and whether the equipment
          has already been prepared for your pickup.
        </p>
      </Section>

      <Section title="8. Prohibited Use">
        <p>
          You may not sublet, resell, or lend the equipment to anyone else, attempt your own repairs, remove
          or tamper with any tracking or asset labels, or use the equipment for any unlawful purpose. Doing so
          voids any deposit refund and may result in additional charges.
        </p>
      </Section>

      <Section title="9. Limitation of Liability">
        <p>
          ProCam provides the equipment as-is and is not liable for indirect, incidental, or consequential
          damages arising from its use — including lost content, missed moments, or third-party claims — beyond
          the rental fee and deposit actually paid for that booking. Nothing in these terms limits liability
          that cannot be limited under Malaysian law.
        </p>
      </Section>

      <Section title="10. Privacy">
        <p id="privacy">
          We collect your name, phone number, and email to create and manage your booking, and process an ID
          document and selfie through our identity verification provider to confirm you're eligible to book.
          Payment details are handled directly by our payment processor — ProCam never sees or stores your
          card number. This information is used only for booking, verification, support, and legal/compliance
          purposes, and is handled in line with Malaysia&apos;s Personal Data Protection Act (PDPA).
        </p>
      </Section>

      <Section title="11. Governing Law">
        <p>
          These terms are governed by the laws of Malaysia. Any dispute arising from a booking is subject to
          the exclusive jurisdiction of the Malaysian courts.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>
          For questions about these terms, or about an active or past booking, message ProCam support from
          your booking page.
        </p>
      </Section>
    </div>
  );
}
