"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";

/** Only our own merchant QR pages are followed: the booking QR and the battery-swap QR (which carries ?shop=). */
const MERCHANT_QR_PATH = /^\/merchant\/(scan|swap)\/[A-Za-z0-9_-]+(\?shop=[A-Za-z0-9_-]+)?$/;

function merchantPathFromQr(text: string): string | null {
  try {
    const url = new URL(text);
    const path = url.pathname + url.search;
    return MERCHANT_QR_PATH.test(path) ? path : null;
  } catch {
    return null;
  }
}

export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("This browser can't use the camera here. Scan with the phone's camera app instead.");
        setStarting(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        setMessage("Camera is blocked. Allow the camera for this site in the browser settings, then try again.");
        setStarting(false);
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});
      setStarting(false);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !ctx) return;

      const tick = () => {
        if (stopped) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          // A smaller copy is enough to read a QR and keeps the phone cool.
          const scale = Math.min(1, 640 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            const path = merchantPathFromQr(code.data);
            if (path) {
              stopped = true;
              stream?.getTracks().forEach((t) => t.stop());
              router.push(path);
              return;
            }
            setMessage("That QR isn't a ProCam booking QR.");
          }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [router, attempt]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/80" />
        {starting && <p className="absolute inset-0 flex items-center justify-center text-sm text-white">Starting camera…</p>}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {message && (
        <p role="alert" className="text-center text-sm text-red-600">
          {message}
        </p>
      )}
      {message?.startsWith("Camera is blocked") && (
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setStarting(true);
            setAttempt((n) => n + 1);
          }}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-black text-base font-semibold text-white dark:bg-white dark:text-black"
        >
          Try again
        </button>
      )}
    </div>
  );
}
