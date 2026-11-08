"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useFeedback } from "@/components/effects";
import { decodeFrame } from "@/lib/decode";

/** Effets animés autorisés : bouton « Effets » activé et pas de mouvements réduits demandés. */
export function useEffectsEnabled(): boolean {
  const { effects, reducedMotion } = useFeedback();
  return effects && !reducedMotion;
}

const WIDE_FINE_POINTER = "(min-width: 768px) and (pointer: fine)";

function subscribeMedia(onChange: () => void) {
  const query = matchMedia(WIDE_FINE_POINTER);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Grand écran avec une souris : condition du halo et du réseau d'indices. */
export function useWideFinePointer(): boolean {
  return useSyncExternalStore(
    subscribeMedia,
    () => matchMedia(WIDE_FINE_POINTER).matches,
    () => false,
  );
}

const MAGNETIC_PULL = 0.18; // part du décalage curseur → centre du bouton
const MAGNETIC_MAX = 6; // px

/** Boutons « magnétiques » (.fx-magnetic) : ils suivent légèrement la souris. */
export function MagneticButtons() {
  const enabled = useEffectsEnabled();

  useEffect(() => {
    if (!enabled) return;
    let current: HTMLElement | null = null;
    let rect: DOMRect | undefined;
    const reset = (element: HTMLElement | null) => {
      element?.style.removeProperty("--mx");
      element?.style.removeProperty("--my");
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = (event.target as Element | null)?.closest<HTMLElement>(".fx-magnetic") ?? null;
      if (target !== current) {
        reset(current);
        current = target;
        rect = target?.getBoundingClientRect();
      }
      if (!target || !rect) return;
      const clamp = (v: number) => Math.max(-MAGNETIC_MAX, Math.min(MAGNETIC_MAX, v));
      const dx = clamp((event.clientX - (rect.left + rect.width / 2)) * MAGNETIC_PULL);
      const dy = clamp((event.clientY - (rect.top + rect.height / 2)) * MAGNETIC_PULL);
      target.style.setProperty("--mx", `${dx.toFixed(1)}px`);
      target.style.setProperty("--my", `${dy.toFixed(1)}px`);
    };
    const leave = () => {
      reset(current);
      current = null;
      rect = undefined;
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", leave, true);
    window.addEventListener("resize", leave);
    return () => {
      leave();
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", leave, true);
      window.removeEventListener("resize", leave);
    };
  }, [enabled]);

  return null;
}

const DECODE_TICK_MS = 45;
const TICKS_PER_LETTER = 3;

/**
 * Code affiché avec un effet « décodage » : des lettres aléatoires qui se fixent une à une.
 * Les lecteurs d'écran lisent toujours le code exact ; sans effets, il s'affiche directement.
 */
export function DecodedCode({ code, className }: { code: string; className?: string }) {
  const enabled = useEffectsEnabled();
  const [frame, setFrame] = useState(code);

  useEffect(() => {
    if (!enabled) return;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      const settled = Math.floor(tick / TICKS_PER_LETTER);
      setFrame(decodeFrame(code, settled));
      if (settled >= code.length) clearInterval(timer);
    }, DECODE_TICK_MS);
    return () => clearInterval(timer);
  }, [code, enabled]);

  return (
    <p className={className}>
      <span className="sr-only">{code}</span>
      <span aria-hidden="true">{enabled ? frame : code}</span>
    </p>
  );
}
