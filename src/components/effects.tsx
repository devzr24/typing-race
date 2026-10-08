"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Volume2, VolumeX, Zap, ZapOff } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { EFFECTS_COOKIE, PREFERENCE_COOKIE_MAX_AGE, SOUND_COOKIE } from "@/i18n/config";
import { sounds, type SoundName } from "@/lib/sound";

/** Clés sessionStorage : intro et slogan ne sont joués qu'une fois par visite. */
export const INTRO_SEEN_KEY = "keyclue-intro";
export const TAGLINE_TYPED_KEY = "keyclue-tagline";

/**
 * Script exécuté dans <head>, avant l'affichage : décide sans flash si l'intro et le slogan tapé
 * doivent être joués. S'il échoue, l'intro se termine quand même seule (animation CSS).
 */
export const EFFECTS_BOOT_SCRIPT = `(function(){var d=document.documentElement;try{
var calm=d.classList.contains("fx-off")||matchMedia("(prefers-reduced-motion: reduce)").matches;
if(calm||sessionStorage.getItem("${INTRO_SEEN_KEY}")){d.classList.add("intro-skip")}else{sessionStorage.setItem("${INTRO_SEEN_KEY}","1")}
if(!calm&&!sessionStorage.getItem("${TAGLINE_TYPED_KEY}")){d.classList.add("type-tagline")}
}catch(e){d.classList.add("intro-skip")}})();`;

function writeCookie(name: string, value: string | null) {
  document.cookie =
    value === null
      ? `${name}=; path=/; max-age=0; samesite=lax`
      : `${name}=${value}; path=/; max-age=${PREFERENCE_COOKIE_MAX_AGE}; samesite=lax`;
}

function subscribeReducedMotion(onChange: () => void) {
  const query = matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Vrai si le système demande de réduire les animations. */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

type Feedback = {
  sound: boolean;
  effects: boolean;
  reducedMotion: boolean;
  setSound: (on: boolean) => void;
  setEffects: (on: boolean) => void;
  play: (name: SoundName) => void;
};

const FeedbackContext = createContext<Feedback | null>(null);

export function useFeedback(): Feedback {
  const value = use(FeedbackContext);
  if (!value) throw new Error("useFeedback doit être utilisé dans un FeedbackProvider.");
  return value;
}

/** Préférences Son / Effets (mémorisées en cookie) et sons de l'interface. */
export function FeedbackProvider({
  initialSound,
  initialEffects,
  children,
}: {
  initialSound: boolean;
  initialEffects: boolean;
  children: ReactNode;
}) {
  const [sound, setSoundState] = useState(initialSound);
  const [effects, setEffectsState] = useState(initialEffects);
  const reducedMotion = useReducedMotion();
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const play = useCallback((name: SoundName) => {
    if (soundRef.current) sounds[name]();
  }, []);

  const setSound = useCallback((on: boolean) => {
    setSoundState(on);
    writeCookie(SOUND_COOKIE, on ? "on" : null);
    if (on) sounds.click(); // confirme l'activation (et débloque l'audio du navigateur)
  }, []);

  const setEffects = useCallback((on: boolean) => {
    setEffectsState(on);
    writeCookie(EFFECTS_COOKIE, on ? null : "off");
    document.documentElement.classList.toggle("fx-off", !on);
  }, []);

  // Survol des boutons principaux et clic sur les boutons : délégation sur tout le document.
  useEffect(() => {
    let lastHovered: Element | null = null;
    const onOver = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest(".sfx-primary") ?? null;
      if (target && target !== lastHovered) play("hover");
      lastHovered = target;
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest("button")) play("click");
    };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("click", onClick);
    };
  }, [play]);

  return (
    <FeedbackContext value={{ sound, effects, reducedMotion, setSound, setEffects, play }}>
      {children}
    </FeedbackContext>
  );
}

export function SoundToggle() {
  const { m } = useI18n();
  const { sound, setSound } = useFeedback();
  const label = `${sound ? m.header.soundOn : m.header.soundOff} — ${m.header.soundLabel}`;
  const Icon = sound ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      className="icon-frame"
      aria-label={label}
      title={label}
      aria-pressed={sound}
      onClick={() => setSound(!sound)}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}

export function EffectsToggle() {
  const { m } = useI18n();
  const { effects, reducedMotion, setEffects } = useFeedback();
  // Mouvements réduits demandés par le système : effets désactivés, bouton inactif.
  const active = effects && !reducedMotion;
  const label = reducedMotion
    ? m.header.effectsReduced
    : `${active ? m.header.effectsOn : m.header.effectsOff} — ${m.header.effectsLabel}`;
  const Icon = active ? Zap : ZapOff;
  return (
    <button
      type="button"
      className="icon-frame"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={reducedMotion}
      onClick={() => setEffects(!effects)}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}

/** Écran d'intro (le rendu et l'animation sont en CSS) : un clic ou une touche le passe. */
export function Intro({ name }: { name: string }) {
  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains("intro-skip")) return;
    const skip = () => root.classList.add("intro-skip");
    const timer = setTimeout(skip, 1200);
    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, []);
  return (
    <div className="intro" aria-hidden="true">
      <span className="intro-word">{name}</span>
    </div>
  );
}

/** Slogan tapé lettre par lettre (une fois par visite), puis affiché en entier. */
export function TypedTagline({ text }: { text: string }) {
  // Rendu serveur : texte complet (masqué en CSS si html.type-tagline, le temps que la frappe démarre).
  const [count, setCount] = useState(text.length);
  const shown = text.slice(0, count);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains("type-tagline")) return;
    sessionStorage.setItem(TAGLINE_TYPED_KEY, "1");
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setCount(index);
      if (index === 1) root.classList.remove("type-tagline");
      if (index >= text.length) clearInterval(timer);
    }, 35);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <p className="font-mono">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="tagline-visible">
        {shown}
        <span className="tagline-cursor" />
      </span>
    </p>
  );
}
