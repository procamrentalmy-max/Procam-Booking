function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** The URL printed on a partner's physical QR voucher. */
export function partnerLandingUrl(referralCode: string): string {
  return `${appUrl()}/p/${referralCode}`;
}

/** A customer's secure rental dashboard link. */
export function bookingDashboardUrl(secureToken: string): string {
  return `${appUrl()}/r/${secureToken}`;
}
