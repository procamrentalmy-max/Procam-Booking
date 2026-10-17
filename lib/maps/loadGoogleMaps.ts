let mapsLoaderPromise: Promise<void> | null = null;
let mapsCallbackCounter = 0;

/**
 * Loads the Google Maps JS API exactly once per page, however many components ask, resolving only once google.maps.Map/Marker are
 * genuinely safe to construct. Uses the classic `callback=` query param (Google calls the named global only when the whole library is
 * ready), not `loading=async` + `importLibrary`, which is not defined yet when a plain script tag's onload fires.
 */
export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.Map) return Promise.resolve();
  if (mapsLoaderPromise) return mapsLoaderPromise;

  mapsLoaderPromise = new Promise((resolve, reject) => {
    const callbackName = `__shopMapPickerInit${mapsCallbackCounter++}`;
    (window as unknown as Record<string, () => void>)[callbackName] = () => resolve();

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return mapsLoaderPromise;
}
