import { QrScanner } from "./QrScanner";

/** The merchant's own scanner: point the phone at a customer's QR (booking or battery swap) without leaving the dashboard. */
export default function MerchantScannerPage() {
  return (
    <div className="space-y-4 pb-10 pt-2">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Scan customer QR</h1>
        <p className="mt-1 text-sm text-zinc-500">Point the camera at the QR on the customer&apos;s booking page.</p>
      </div>
      <QrScanner />
    </div>
  );
}
