// Petits sons d'interface générés avec la Web Audio API (aucun fichier audio).

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  context ??= new AudioContext();
  // Le navigateur suspend l'audio tant que l'utilisateur n'a pas interagi avec la page.
  if (context.state === "suspended") void context.resume();
  return context;
}

/** Une note brève avec une enveloppe douce, pour rester discret. */
function tone(frequency: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
  const ctx = audio();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export const sounds = {
  /** Survol d'un bouton principal. */
  hover: () => tone(1046.5, 0.05, "sine", 0.025),
  /** Clic sur un bouton. */
  click: () => tone(659.25, 0.07, "triangle", 0.05),
  /** Un joueur rejoint la salle : deux notes montantes. */
  join: () => {
    tone(523.25, 0.12, "sine", 0.05);
    tone(783.99, 0.18, "sine", 0.05, 0.1);
  },
};

export type SoundName = keyof typeof sounds;
