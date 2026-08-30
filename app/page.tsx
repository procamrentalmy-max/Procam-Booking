export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        ProCam
      </h1>
      <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        Scan the QR code at your hotel reception to rent an action camera.
      </p>
    </div>
  );
}
