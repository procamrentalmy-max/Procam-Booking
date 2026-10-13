import Link from "next/link";
import { LEGAL_UPDATED } from "@/lib/legal";
import { LegalList, LegalSection, LegalTitle } from "../LegalSection";

export const metadata = {
  title: "Privacy Policy — ProCam Rental",
  description: "What personal data ProCam Rental collects, why, who sees it and how to ask us about it.",
};

export default function PrivacyPage() {
  return (
    <>
      <LegalTitle title="Privacy Policy" updated={LEGAL_UPDATED} />

      <LegalSection title="1. Who is responsible">
        <p>
          ProCam Rental decides how your personal data is used for your booking. We follow Malaysia&apos;s Personal Data Protection Act 2010 (PDPA). Our contact details are on the{" "}
          <Link href="/legal/contact" className="underline underline-offset-2">Contact page</Link>.
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <LegalList
          items={[
            "Your name, phone number and email, to make and manage your booking.",
            "An identity check: a photo of your ID and a live selfie, taken in the check from our verification provider, Didit. We receive the result of the check (passed or not) and the details needed to match you to the booking. We do not keep our own copy of your ID photo or selfie.",
            "Payment information. Your card details go straight to our payment processor, Stripe. We never see or store your card number. We keep a Stripe reference to your payment and saved card so we can release your deposit, and charge late fees, battery swaps or damage you agreed to.",
            "Photos of the drone and its accessories at hand-over and return, and notes about their condition. They show equipment, not you.",
            "Booking details: what you rented, when, from which shop, what you paid, and any late fee or damage review.",
            "Basic technical data when you use the site, such as the language you chose (kept in a cookie). We do not run advertising trackers.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Why we use it">
        <LegalList
          items={[
            "To confirm you are eligible, take your payment and hold your deposit.",
            "To hand over and take back the equipment, and to deal with late returns, damage and loss.",
            "To contact you about your booking and to give support.",
            "To keep our records, prevent fraud and meet legal and tax obligations.",
          ]}
        />
        <p>We do not sell your personal data, and we do not use it for advertising by other companies.</p>
      </LegalSection>

      <LegalSection title="4. Who else sees it">
        <LegalList
          items={[
            "The shop that rents you the drone sees your name, phone number and booking so that they can hand over the drone to the right person.",
            "Stripe (payments), Didit (identity check), Supabase (our database) and Vercel (our website hosting) process data for us under their own security and privacy terms. Some of them store data outside Malaysia.",
            "A weather service gets only the location of the shop to check the wind, never anything about you.",
            "The authorities, where the law requires, or to protect our equipment and rights, for example in a dispute or a case of theft.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. How long we keep it">
        <p>
          We keep booking and payment records for as long as we need them for the booking, for disputes and for the time the law requires us to keep accounting records. After that we delete them or remove what identifies you.
        </p>
      </LegalSection>

      <LegalSection title="6. Your rights">
        <p>
          Under the PDPA you can ask to see the personal data we hold about you, ask us to correct it, and ask us to stop using it for something that is not needed for your booking. Contact us through the{" "}
          <Link href="/legal/contact" className="underline underline-offset-2">Contact page</Link>. We may need to check who you are first, and we may have to keep some records the law requires. If you cannot agree to us using the data we need for an
          identity check or a payment, we cannot rent you a drone.
        </p>
      </LegalSection>

      <LegalSection title="7. Security">
        <p>
          Our website uses an encrypted connection. Access to bookings and personal data is limited to the people who need it for the rental. No system is perfectly secure, so please tell us at once if you think your data has been misused.
        </p>
      </LegalSection>

      <LegalSection title="8. Changes">
        <p>We may update this policy. The date at the top shows when it last changed.</p>
      </LegalSection>
    </>
  );
}
