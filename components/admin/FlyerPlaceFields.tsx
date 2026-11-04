"use client";

import { useEffect, useRef, useState } from "react";
import { inputClass } from "@/components/formStyles";
import { loadGoogleMaps } from "@/lib/maps/loadGoogleMaps";

type Suggestion = { id: string; main: string; secondary: string; prediction: google.maps.places.PlacePrediction };

/**
 * The fields of a flyer place. Typing in the business name suggests places from Google; picking one fills in the name, the address and the Google Maps
 * link on its own (all still editable). Falls back to plain typing if the Google search cannot load.
 */
export function FlyerPlaceFields({ defaults }: { defaults?: { name: string; contact: string | null; address: string | null; map_url: string | null; notes: string | null } }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const nameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const mapUrlRef = useRef<HTMLInputElement>(null);
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const latest = useRef(0);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !apiKey) return;
    const mine = ++latest.current;
    const timer = setTimeout(async () => {
      try {
        await loadGoogleMaps(apiKey);
        const { AutocompleteSuggestion, AutocompleteSessionToken } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
        token.current ??= new AutocompleteSessionToken();
        const { suggestions: found } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: q, includedRegionCodes: ["my"], sessionToken: token.current });
        if (mine !== latest.current) return;
        setSuggestions(
          found.flatMap((s) =>
            s.placePrediction ? [{ id: s.placePrediction.placeId, main: s.placePrediction.mainText?.text ?? s.placePrediction.text.text, secondary: s.placePrediction.secondaryText?.text ?? "", prediction: s.placePrediction }] : [],
          ),
        );
        setNote(null);
      } catch {
        if (mine === latest.current) setNote("The Google suggestions are not available right now. Type the name, address and link yourself.");
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, apiKey]);

  const showList = open && query.trim().length >= 2 && suggestions.length > 0;

  async function pick(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    setQuery("");
    try {
      const place = s.prediction.toPlace();
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "googleMapsURI"] });
      if (nameRef.current && place.displayName) nameRef.current.value = place.displayName;
      if (addressRef.current && place.formattedAddress) addressRef.current.value = place.formattedAddress;
      if (mapUrlRef.current && place.googleMapsURI) mapUrlRef.current.value = place.googleMapsURI;
      setNote("Address and Google Maps link filled in from Google. Change anything if you like, then press the button.");
      token.current = null;
    } catch {
      setNote("Could not get the details of that place. Type the address and link yourself.");
    }
  }

  return (
    <>
      <div className="relative">
        <input
          ref={nameRef}
          name="name"
          required
          maxLength={80}
          defaultValue={defaults?.name}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && showList) e.preventDefault(); // Enter while suggestions are showing must not save the form
          }}
          placeholder="Business name: type to search Google"
          aria-label="Business name"
          autoComplete="off"
          className={`w-full ${inputClass}`}
        />
        {showList && (
          <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-zinc-300 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)} className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <span className="font-medium text-black dark:text-zinc-50">{s.main}</span>
                  {s.secondary && <span className="block text-xs text-zinc-500">{s.secondary}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input name="contact" maxLength={200} defaultValue={defaults?.contact ?? ""} placeholder="Contact (phone or email, optional)" aria-label="Contact" className={inputClass} />
      <input ref={addressRef} name="address" maxLength={200} defaultValue={defaults?.address ?? ""} placeholder="Address or landmark (fills in by itself)" aria-label="Address" className={inputClass} />
      <input ref={mapUrlRef} name="map_url" maxLength={500} defaultValue={defaults?.map_url ?? ""} placeholder="Google Maps link (fills in by itself)" aria-label="Google Maps link" className={inputClass} />
      {note && <p className="text-xs text-zinc-500 sm:col-span-2">{note}</p>}
      <input name="notes" maxLength={500} defaultValue={defaults?.notes ?? ""} placeholder="Notes, e.g. bank details (optional)" aria-label="Notes" className={`sm:col-span-2 ${inputClass}`} />
    </>
  );
}
