import "server-only";
import QRCode from "qrcode";

export async function generateQrDataUrl(text: string, width: number = 240): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width });
}

/** A print-quality PNG of a QR (plain black on white with a quiet margin), as bytes for a download. */
export async function generateQrPng(text: string, width: number = 1200): Promise<Buffer> {
  return QRCode.toBuffer(text, { margin: 3, width, type: "png", errorCorrectionLevel: "M" });
}
