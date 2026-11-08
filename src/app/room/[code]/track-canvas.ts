// Dessine les marqueurs dans un canvas unique à chaque état reçu, avec effacements locaux (mesures : ADR 0020).
import type { RaceSnapshot } from "@/lib/race/engine";

type Racer = RaceSnapshot["racers"][number];
const MAX_CANVAS_PIXELS = 8_000_000;
type TrackStore = {
  getSnapshot: () => RaceSnapshot | null;
  subscribe: (subscriber: () => void) => () => void;
};
type Point = {
  bar: HTMLElement;
  left: number; width: number; y: number;
  progress: number;
  drawnX: number | null;
};

export function mountTrackCanvas(container: HTMLElement, canvas: HTMLCanvasElement, store: TrackStore, results?: Racer[]) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const points = new Map<string, Point>();
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  let color = getComputedStyle(canvas).color;
  let frame: number | null = null;

  for (const bar of container.querySelectorAll<HTMLElement>("[data-racer-id]")) {
    points.set(bar.dataset.racerId!, { bar, left: 0, width: 0, y: 0, progress: 0, drawnX: null });
  }

  const schedule = () => {
    if (frame === null) frame = requestAnimationFrame(draw);
  };
  const draw = () => {
    frame = null;
    context.fillStyle = color;
    for (const point of points.values()) {
      const x = point.left + point.width * point.progress;
      if (point.drawnX === x) continue;
      // Un pixel de marge efface aussi les pixels anticrénelés du disque précédent.
      if (point.drawnX !== null) context.clearRect(point.drawnX - 7, point.y - 7, 14, 14);
      context.beginPath();
      context.arc(x, point.y, 6, 0, Math.PI * 2);
      context.fill();
      point.drawnX = x;
    }
  };
  const update = () => {
    for (const racer of results ?? store.getSnapshot()?.racers ?? []) {
      const point = points.get(racer.id);
      if (!point) continue;
      const progress = Math.max(0, Math.min(1, racer.progress));
      if (point.drawnX === null || point.progress !== progress) {
        point.progress = progress;
        schedule();
      }
    }
  };
  const invalidate = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const point of points.values()) point.drawnX = null;
    schedule();
  };
  const measure = () => {
    const bounds = container.getBoundingClientRect();
    const cssWidth = Math.max(1, bounds.width);
    const cssHeight = Math.max(1, bounds.height);
    const ratio = Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_CANVAS_PIXELS / (cssWidth * cssHeight)));
    const width = Math.max(1, Math.floor(cssWidth * ratio));
    const height = Math.max(1, Math.floor(cssHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    for (const point of points.values()) {
      const bar = point.bar.getBoundingClientRect();
      const style = getComputedStyle(point.bar);
      const left = parseFloat(style.paddingLeft);
      point.left = bar.left - bounds.left + left;
      point.width = Math.max(0, bar.width - left - parseFloat(style.paddingRight));
      point.y = bar.top - bounds.top + bar.height / 2;
    }
    invalidate();
  };
  const themeChanged = () => {
    // La propriété calculée résout light-dark(), contrairement au jeton --color-cyan.
    const nextColor = getComputedStyle(canvas).color;
    if (nextColor !== color) {
      color = nextColor;
      invalidate();
    }
  };
  let resolution = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  const resolutionChanged = () => {
    resolution.removeEventListener("change", resolutionChanged);
    resolution = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    resolution.addEventListener("change", resolutionChanged);
    measure();
  };
  resolution.addEventListener("change", resolutionChanged);
  const resize = new ResizeObserver(measure);
  resize.observe(container);
  for (const point of points.values()) {
    resize.observe(point.bar);
    if (point.bar.parentElement) resize.observe(point.bar.parentElement);
  }
  const theme = new MutationObserver(themeChanged);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  scheme.addEventListener("change", themeChanged);
  window.addEventListener("resize", measure);
  const unsubscribe = store.subscribe(update);
  // Le premier dessin part de l'état reçu, sans glissement depuis zéro au montage.
  for (const racer of results ?? store.getSnapshot()?.racers ?? []) {
    const point = points.get(racer.id);
    if (point) point.progress = Math.max(0, Math.min(1, racer.progress));
  }
  measure();
  return () => {
    unsubscribe();
    resize.disconnect();
    theme.disconnect();
    scheme.removeEventListener("change", themeChanged);
    resolution.removeEventListener("change", resolutionChanged);
    window.removeEventListener("resize", measure);
    if (frame !== null) cancelAnimationFrame(frame);
  };
}
