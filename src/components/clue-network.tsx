"use client";

import { useEffect, useRef } from "react";
import { useEffectsEnabled, useWideFinePointer } from "@/components/motion-effects";

const MAX_POINTS = 40;
const LINK_DISTANCE = 150; // px : deux points plus proches sont reliés
const SPEED = 0.12; // px par image : mouvement très lent
const FRAME_MS = 1000 / 30; // 30 images/s suffisent pour un mouvement aussi lent
const CURSOR_RADIUS = 170; // px : les lignes proches de la souris s'allument

type Point = { x: number; y: number; vx: number; vy: number };

/** Couleur calculée d'une variable CSS (light-dark() résolu selon le thème courant). */
function resolveColor(variable: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${variable})`;
  probe.style.display = "none";
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

/**
 * Réseau d'indices : points cyan reliés par des lignes steel, en arrière-plan.
 * Les lignes s'allument (cyan) à l'approche de la souris.
 * Rien n'est dessiné si les effets sont coupés, si le système demande moins de mouvement
 * ou sur petit écran / écran tactile.
 */
export function ClueNetwork() {
  const effectsOn = useEffectsEnabled();
  const wideScreen = useWideFinePointer();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enabled = effectsOn && wideScreen;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!enabled || !canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let points: Point[] = [];
    let colors = { point: "", line: "" };
    const mouse = { x: -9999, y: -9999 };

    const readColors = () => {
      colors = { point: resolveColor("--color-cyan"), line: resolveColor("--color-steel") };
      makeSprite();
    };

    // Lisibilité : la colonne centrale (où se trouve le texte) est presque effacée (12 %).
    // Calculé par élément : mask-image ou une composition « destination-out » coûtent trop cher.
    const centerFade = (x: number) => {
      const d = Math.abs(x - width / 2);
      return d <= 300 ? 0.12 : d >= 380 ? 1 : 0.12 + ((d - 300) / 80) * 0.88;
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      points = Array.from({ length: MAX_POINTS }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() * 2 - 1) * SPEED,
        vy: (Math.random() * 2 - 1) * SPEED,
      }));
    };

    // Lignes regroupées en quelques niveaux d'intensité : un seul tracé (stroke) par niveau.
    const LEVELS = 6;
    const buckets = Array.from({ length: LEVELS * 2 }, () => [] as number[]);

    // Lueur des points pré-rendue une fois (beaucoup moins coûteux que shadowBlur à chaque image).
    let sprite: HTMLCanvasElement | null = null;
    const makeSprite = () => {
      sprite = document.createElement("canvas");
      sprite.width = sprite.height = 16;
      const s = sprite.getContext("2d");
      if (!s) return;
      const gradient = s.createRadialGradient(8, 8, 0, 8, 8, 8);
      gradient.addColorStop(0, colors.point);
      gradient.addColorStop(0.35, colors.point);
      gradient.addColorStop(1, "transparent");
      s.fillStyle = gradient;
      s.fillRect(0, 0, 16, 16);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of points) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      }
      for (const bucket of buckets) bucket.length = 0;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i];
          const b = points[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance > LINK_DISTANCE) continue;
          // Proximité de la souris (milieu du segment) : la ligne s'allume en cyan.
          const near = Math.hypot((a.x + b.x) / 2 - mouse.x, (a.y + b.y) / 2 - mouse.y);
          const glow = Math.max(0, 1 - near / CURSOR_RADIUS);
          const strength =
            Math.min(1, (1 - distance / LINK_DISTANCE) * (1 + glow * 1.5)) * centerFade((a.x + b.x) / 2);
          const level = Math.min(LEVELS - 1, Math.floor(strength * LEVELS));
          buckets[(glow > 0 ? LEVELS : 0) + level].push(a.x, a.y, b.x, b.y);
        }
      }
      ctx.lineWidth = 1;
      buckets.forEach((segments, index) => {
        if (segments.length === 0) return;
        const lit = index >= LEVELS;
        ctx.strokeStyle = lit ? colors.point : colors.line;
        ctx.globalAlpha = ((index % LEVELS) + 1) / LEVELS;
        ctx.beginPath();
        for (let k = 0; k < segments.length; k += 4) {
          ctx.moveTo(segments[k], segments[k + 1]);
          ctx.lineTo(segments[k + 2], segments[k + 3]);
        }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      if (!sprite) return;
      for (const p of points) {
        const near = Math.max(0, 1 - Math.hypot(p.x - mouse.x, p.y - mouse.y) / CURSOR_RADIUS);
        const size = 8 + near * 6;
        ctx.globalAlpha = centerFade(p.x);
        ctx.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    };

    let frame = 0;
    let last = 0;
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      if (time - last < FRAME_MS) return;
      last = time;
      draw();
    };

    readColors();
    resize();
    frame = requestAnimationFrame(loop);

    // Changement de thème (classe sur <html> ou thème du système) : nouvelles couleurs.
    const observer = new MutationObserver(readColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", readColors);
    window.addEventListener("resize", resize);
    const onMove = (event: PointerEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };
    const onLeave = () => {
      mouse.x = mouse.y = -9999;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scheme.removeEventListener("change", readColors);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      ctx.clearRect(0, 0, width, height);
    };
  }, [enabled]);

  return <canvas ref={canvasRef} className="clue-network" aria-hidden="true" />;
}
