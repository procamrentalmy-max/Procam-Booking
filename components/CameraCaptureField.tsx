"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Every captured photo is resampled to this exact square before it's kept,
 * regardless of the source camera's native resolution or aspect ratio — so
 * every submitted photo is the same size and detailed enough to review,
 * whether it came from a cheap Android camera or a recent iPhone.
 */
const CAPTURE_SIZE = 1600;
const JPEG_QUALITY = 0.85;

function captureSquareFrame(video: HTMLVideoElement): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = CAPTURE_SIZE;
  canvas.height = CAPTURE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("This device can't process photos."));

  const side = Math.min(video.videoWidth, video.videoHeight);
  const sx = (video.videoWidth - side) / 2;
  const sy = (video.videoHeight - side) / 2;
  ctx.drawImage(video, sx, sy, side, side, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Couldn't process that photo."));
          return;
        }
        resolve(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

/**
 * Photo capture via the device's live camera only — there is deliberately
 * no file input here, so there's no "choose from library" escape hatch to
 * upload an unrelated or old photo. Every capture goes through the same
 * square resample, so photo dimensions are always consistent regardless of
 * device.
 */
export function CameraCaptureField({
  photos,
  onChange,
  multiple = false,
}: {
  photos: File[];
  onChange: (photos: File[]) => void;
  multiple?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  }

  useEffect(() => stopCamera, []);

  // The <video> element only mounts once `live` is true, so it doesn't
  // exist yet at the point openCamera() gets the stream — attaching
  // srcObject has to happen here, after that mount actually commits,
  // otherwise the stream sits unused and the video shows black.
  useEffect(() => {
    if (!live || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {});
  }, [live]);

  async function openCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access isn't available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: CAPTURE_SIZE }, height: { ideal: CAPTURE_SIZE } },
        audio: false,
      });
      streamRef.current = stream;
      setLive(true);
    } catch {
      setCameraError("Couldn't access the camera. Check your browser's camera permission and try again.");
    }
  }

  async function capture() {
    if (!videoRef.current) return;
    try {
      const file = await captureSquareFrame(videoRef.current);
      onChange(multiple ? [...photos, file] : [file]);
    } catch {
      setCameraError("Couldn't process that photo. Try again.");
    } finally {
      stopCamera();
    }
  }

  if (live) {
    return (
      <div className="space-y-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={stopCamera}
            className="flex-1 rounded-full border border-zinc-300 py-3 font-medium dark:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={capture}
            className="flex-1 rounded-full bg-black py-3 font-semibold text-white dark:bg-white dark:text-black"
          >
            Capture
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cameraError && <p className="text-center text-sm text-red-600">{cameraError}</p>}

      {!multiple && photos[0] && (
        <div className="aspect-square w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimizable */}
          <img src={URL.createObjectURL(photos[0])} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      {multiple && photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((file, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimizable */}
              <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
                aria-label="Remove photo"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {(multiple || !photos[0]) && (
        <button
          type="button"
          onClick={openCamera}
          className={
            multiple
              ? "w-full rounded-lg border-2 border-dashed border-zinc-300 py-3 text-sm text-zinc-400 dark:border-zinc-700"
              : "flex aspect-square w-full items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 text-sm text-zinc-400 dark:border-zinc-700"
          }
        >
          {multiple ? (photos.length > 0 ? "Add another photo" : "Tap to take a photo") : "Tap to take photo"}
        </button>
      )}

      {!multiple && photos[0] && (
        <button type="button" onClick={openCamera} className="w-full text-center text-sm text-zinc-500 underline underline-offset-2">
          Retake
        </button>
      )}
    </div>
  );
}
