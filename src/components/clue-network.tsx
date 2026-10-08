"use client";

import { useEffect, useRef } from "react";
import { useFeedback } from "@/components/effects";

const MAX_POINTS = 40;
const MOBILE_POINTS = 24; // moins de calculs sur téléphone
const LINK_DISTANCE = 150; // px : deux points plus proches sont reliés
const SPEED = 0.12; // px par image : mouvement très lent
const FRAME_MS = 1000 / 30; // 30 images/s suffisent pour un mouvement aussi lent

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
 * Rien n'est dessiné si les effets sont coupés ou si le système demande moins de mouvement.
 */
export function ClueNetwork() {
  const { effects, reducedMotion } = useFeedback();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enabled = effects && !reducedMotion;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!enabled || !canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let points: Point[] = [];
    let colors = { point: "", line: "" };

    const readColors = () => {
      colors = { point: resolveColor("--color-cyan"), line: resolveColor("--color-steel") };
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = width < 640 ? MOBILE_POINTS : MAX_POINTS;
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() * 2 - 1) * SPEED,
        vy: (Math.random() * 2 - 1) * SPEED,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of points) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.line;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const dx = points[i].x - points[j].x;
          const dy = points[i].y - points[j].y;
          const distance = Math.hypot(dx, dy);
          if (distance > LINK_DISTANCE) continue;
          ctx.globalAlpha = 1 - distance / LINK_DISTANCE;
          ctx.beginPath();
          ctx.moveTo(points[i].x, points[i].y);
          ctx.lineTo(points[j].x, points[j].y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.point;
      ctx.shadowColor = colors.point;
      ctx.shadowBlur = 6;
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
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

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scheme.removeEventListener("change", readColors);
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, width, height);
    };
  }, [enabled]);

  return <canvas ref={canvasRef} className="clue-network" aria-hidden="true" />;
}
