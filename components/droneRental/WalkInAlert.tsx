"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "procam-walkin-alerts";

/** Three short beeps. The audio context is made after a tap (browsers keep sound off until the person has tapped something). */
function beep(ctx: AudioContext) {
  const now = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, now + i * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.5, now + i * 0.35 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.35 + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.35);
    osc.stop(now + i * 0.35 + 0.3);
  }
}

/**
 * A new walk-in order waiting for the merchant to confirm makes this phone beep, vibrate, flash the tab title and (if allowed) show a
 * notification, so the customer isn't left standing. It works while the merchant dashboard is open, which is how it is left at the counter.
 * The merchant turns it on once with the button (that tap is what lets the browser play sound).
 */
export function WalkInAlert({ waitingIds, waitingNames }: { waitingIds: string[]; waitingNames: string[] }) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const originalTitle = useRef<string>("");

  function context(): AudioContext | null {
    try {
      if (!audio.current) audio.current = new AudioContext();
      if (audio.current.state === "suspended") void audio.current.resume();
      return audio.current;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    originalTitle.current = document.title;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "on") setOn(true);
    } catch {
      // alerts just start off
    }
    setReady(true);
  }, []);

  // After a reload the sound is locked again until the next tap anywhere on the page.
  useEffect(() => {
    if (!on) return;
    const unlock = () => void context();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [on]);

  // Which orders were already waiting when the page was opened is the baseline; only ones that arrive later make a noise.
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(waitingIds);
      return;
    }
    const fresh = waitingIds.filter((id) => !seen.current!.has(id));
    waitingIds.forEach((id) => seen.current!.add(id));
    if (fresh.length === 0 || !on) return;
    const ctx = context();
    if (ctx) beep(ctx);
    try {
      navigator.vibrate?.([300, 150, 300, 150, 300]);
    } catch {
      // not every phone can vibrate
    }
    const who = waitingNames[waitingIds.indexOf(fresh[0])] ?? "A customer";
    try {
      if ("Notification" in window && Notification.permission === "granted") new Notification("New walk-in order", { body: `${who} is waiting for you to confirm.` });
    } catch {
      // a notification is a bonus
    }
    document.title = "(1) New walk-in order";
    const stop = setTimeout(() => (document.title = originalTitle.current), 15000);
    return () => clearTimeout(stop);
  }, [waitingIds, waitingNames, on]);

  // Nothing waiting any more: put the tab title back.
  useEffect(() => {
    if (waitingIds.length === 0 && originalTitle.current) document.title = originalTitle.current;
  }, [waitingIds.length]);

  async function turnOn() {
    // On straight away: the permission question for notifications can wait for an answer, and the sound does not depend on it.
    const ctx = context();
    if (ctx) beep(ctx);
    try {
      window.localStorage.setItem(STORAGE_KEY, "on");
    } catch {
      // stays on for this visit only
    }
    setOn(true);
    try {
      if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    } catch {
      // no notifications, sound still works
    }
  }

  function turnOff() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "off");
    } catch {
      // ignore
    }
    setOn(false);
  }

  if (!ready) return null;
  return on ? (
    <button type="button" onClick={turnOff} className="w-full rounded-2xl border border-green-300 bg-green-50 px-4 py-2 text-left text-xs text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
      Walk-in alerts are on: this phone beeps when a customer sends an order. Keep this page open. Tap to turn off.
    </button>
  ) : (
    <button type="button" onClick={turnOn} className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-900">
      Turn on walk-in alerts (sound and vibration)
    </button>
  );
}
