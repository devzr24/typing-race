"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect } from "react";
import { useEffectsEnabled, useWideFinePointer } from "@/components/motion-effects";

/** Halo cyan qui suit doucement le curseur, derrière le contenu. */
export function CursorHalo() {
  const effectsOn = useEffectsEnabled();
  const wideScreen = useWideFinePointer();
  const enabled = effectsOn && wideScreen;
  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  // Ressort souple : le halo rattrape le curseur avec un léger retard.
  const springX = useSpring(x, { stiffness: 120, damping: 20, mass: 0.6 });
  const springY = useSpring(y, { stiffness: 120, damping: 20, mass: 0.6 });

  useEffect(() => {
    if (!enabled) return;
    const move = (event: PointerEvent) => {
      if (document.documentElement.classList.contains("race-active")) return;
      x.set(event.clientX);
      y.set(event.clientY);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [enabled, x, y]);

  if (!enabled) return null;
  return <motion.div className="cursor-halo" style={{ x: springX, y: springY }} aria-hidden="true" />;
}

