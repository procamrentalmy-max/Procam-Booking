import "server-only";
import QRCode from "qrcode";

export async function generateQrDataUrl(text: string, width: number = 240): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width });
}
