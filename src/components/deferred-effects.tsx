"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MagneticButtons, useEffectsEnabled, useWideFinePointer } from "@/components/motion-effects";

const ClueNetwork = dynamic(() => import("./clue-network").then((mod) => mod.ClueNetwork), { ssr: false });
const CursorHalo = dynamic(() => import("./cursor-halo").then((mod) => mod.CursorHalo), { ssr: false });

/** Les décors attendent le chargement et un créneau libre après l'intro. */
export function DeferredEffects() {
  const [ready, setReady] = useState(false);
  const enabled = useEffectsEnabled();
  const wideScreen = useWideFinePointer();

  useEffect(() => {
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout>;
    const start = () => {
      timer = setTimeout(() => {
        if ("requestIdleCallback" in window) {
          idle = window.requestIdleCallback(() => setReady(true), { timeout: 2000 });
        } else {
          setReady(true);
        }
      }, 1200);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback(idle);
    };
  }, []);

  if (!ready || !enabled) return null;
  return <><MagneticButtons />{wideScreen ? <><ClueNetwork /><CursorHalo /></> : null}</>;
}
