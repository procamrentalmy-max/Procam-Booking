import Link from "next/link";
import type { ReactNode } from "react";
import { CONTROLLER_PROFILES, DRONE_MODEL_PROFILES, MAX_RENTAL_DAYS, MULTI_DAY_DISCOUNT_PERCENT } from "@/lib/droneRental/pricingRules";
import { BUSINESS, FREE_CANCELLATION_HOURS, HOLD_DAYS, LATE_GRACE_MINUTES, legalUpdatedLabel, ONLINE_MAX_HOURS, registeredNameDiffers } from "@/lib/legal";
import { PENDING_PAYMENT_TIMEOUT_MINUTES } from "@/lib/state-machine/booking";
import { legalText, type LegalPage } from "@/lib/i18n/legal";
import type { Locale } from "@/lib/i18n/locale";
import { LegalList, LegalSection, LegalTitle } from "./LegalSection";

/** The numbers and names the legal text refers to, taken from the live pricing rules so the pages never disagree with the booking page. */
function legalValues(): Record<string, string> {
  const registered = registeredNameDiffers() ? ` (${BUSINESS.registeredName}${BUSINESS.ssmNumber ? `, SSM ${BUSINESS.ssmNumber}` : ""})` : BUSINESS.ssmNumber ? ` (SSM ${BUSINESS.ssmNumber})` : "";
  return {
    business: `${BUSINESS.brand}${registered}`,
    neo2Rate: `RM${DRONE_MODEL_PROFILES.NEO2.hourlyRateMyr}`,
    neoRate: `RM${DRONE_MODEL_PROFILES.NEO.hourlyRateMyr}`,
    rcRate: `RM${CONTROLLER_PROFILES.RC_N3.hourlyMyr}`,
    goggRate: `RM${CONTROLLER_PROFILES.GOGGLES_N3.hourlyMyr}`,
    maxHours: String(ONLINE_MAX_HOURS),
    maxDays: String(MAX_RENTAL_DAYS),
    dayRate: `RM${DRONE_MODEL_PROFILES.NEO2.dailyRateMyr?.NONE}`,
    dayRateRc: `RM${DRONE_MODEL_PROFILES.NEO2.dailyRateMyr?.RC_N3}`,
    dayOff: String(MULTI_DAY_DISCOUNT_PERCENT),
    dayOff3: String(MULTI_DAY_DISCOUNT_PERCENT * 2),
    payMinutes: String(PENDING_PAYMENT_TIMEOUT_MINUTES),
    neo2Dep: `RM${DRONE_MODEL_PROFILES.NEO2.depositDroneMyr}`,
    neoDep: `RM${DRONE_MODEL_PROFILES.NEO.depositDroneMyr}`,
    rcDep: `RM${CONTROLLER_PROFILES.RC_N3.depositMyr}`,
    goggDep: `RM${CONTROLLER_PROFILES.GOGGLES_N3.depositMyr}`,
    holdDays: String(HOLD_DAYS),
    grace: String(LATE_GRACE_MINUTES),
    freeHours: String(FREE_CANCELLATION_HOURS),
    neo2Wind: String(DRONE_MODEL_PROFILES.NEO2.maxWindMps),
    neoWind: String(DRONE_MODEL_PROFILES.NEO.maxWindMps),
  };
}

const LINK_PATHS: Record<string, string> = { terms: "/legal/terms", refunds: "/legal/refunds", privacy: "/legal/privacy", faq: "/legal/faq", contact: "/legal/contact" };

/** Fills {placeholders} with values and turns {link:name} into a link, named in the visitor's language. */
export function renderLegalText(text: string, locale: Locale): ReactNode[] {
  const values = legalValues();
  const names = legalText(locale).links as Record<string, string>;
  return text.split(/(\{link:\w+\}|\{\w+\})/g).map((part, i) => {
    const link = part.match(/^\{link:(\w+)\}$/);
    if (link && LINK_PATHS[link[1]]) {
      return (
        <Link key={i} href={LINK_PATHS[link[1]]} className="underline underline-offset-2">
          {names[link[1]]}
        </Link>
      );
    }
    const value = part.match(/^\{(\w+)\}$/);
    if (value && value[1] in values) return values[value[1]];
    return part;
  });
}

/** The FAQ page: each question opens to its answer. */
export function FaqDoc({ locale }: { locale: Locale }) {
  const t = legalText(locale);
  const faq = t.faq;
  return (
    <>
      <LegalTitle title={faq.title} updated={t.updated(legalUpdatedLabel(locale))} />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{renderLegalText(faq.intro, locale)}</p>
      {faq.sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-base font-semibold text-black dark:text-zinc-50">{section.title}</h2>
          <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {section.items.map((item) => (
              <details key={item.q} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-medium text-black dark:text-zinc-100 [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <span aria-hidden className="mt-0.5 text-zinc-400 transition group-open:rotate-45">+</span>
                </summary>
                <div className="mt-2 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {item.blocks.map((block, i) =>
                    "p" in block ? <p key={i}>{renderLegalText(block.p, locale)}</p> : <LegalList key={i} items={block.ul.map((li) => renderLegalText(li, locale))} />
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{renderLegalText(faq.stuck, locale)}</p>
    </>
  );
}

/** One legal page (Terms, Refunds or Privacy) in the visitor's language. */
export function LegalDoc({ page, locale }: { page: LegalPage; locale: Locale }) {
  const t = legalText(locale);
  return (
    <>
      <LegalTitle title={page.title} updated={t.updated(legalUpdatedLabel(locale))} />
      {page.sections.map((section) => (
        <LegalSection key={section.title} title={section.title}>
          {section.blocks.map((block, i) =>
            "p" in block ? <p key={i}>{renderLegalText(block.p, locale)}</p> : <LegalList key={i} items={block.ul.map((item) => renderLegalText(item, locale))} />
          )}
        </LegalSection>
      ))}
    </>
  );
}
