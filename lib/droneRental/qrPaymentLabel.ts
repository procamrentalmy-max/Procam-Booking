/** What an incoming QR payment is for, in the words the merchant reads: "Walk-in rental" or "Battery swap, 2 batteries". */
export function describeQrPayment(p: { kind: "RENTAL_FEE" | "BATTERY_SWAP_FEE"; batteryCount: number | null }): string {
  if (p.kind === "RENTAL_FEE") return "Walk-in rental";
  const n = p.batteryCount ?? 1;
  return `Battery swap, ${n} ${n === 1 ? "battery" : "batteries"}`;
}
