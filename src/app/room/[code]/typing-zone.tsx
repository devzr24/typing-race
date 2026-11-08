"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { buttonClass, inputClass } from "@/components/form-field";
import { useI18n } from "@/i18n/client";
import { errorText } from "@/i18n/format";
import type { ErrorCode } from "@/i18n/messages";
import type { RaceSelf } from "@/lib/race/engine";
import { createInputBatcher } from "@/lib/race/input-batcher";
import { accuracy, netMpm } from "@/lib/race/metrics";
import { characterState, initialTypingState, predictKeys, reduceTyping } from "@/lib/race/typing-state";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/rooms/events";
import type { RaceConfig } from "@/lib/rooms/types";

export function TypingZone({ self, selfId, code, startsAt, clockOffset, errorMode, socket, connected }: {
  self: RaceSelf; selfId: string; code: string; startsAt: number; clockOffset: number;
  errorMode: RaceConfig["errorMode"]; socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  connected: boolean;
}) {
  const { locale, m } = useI18n();
  const [state, dispatch] = useReducer((state: ReturnType<typeof initialTypingState>, action: Parameters<typeof reduceTyping>[1]) => reduceTyping(state, action, errorMode), self, initialTypingState);
  const [now, setNow] = useState(startsAt);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [notice, setNotice] = useState<{ type: "minus3" | "plus3" | "fog"; id: number } | null>(null);
  const [abandoning, setAbandoning] = useState(false);
  const [abandoned, setAbandoned] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const offsetRef = useRef(clockOffset);
  const batcher = useRef<ReturnType<typeof createInputBatcher> | null>(null);
  const prediction = predictKeys(state.base, state.pending, errorMode);
  const frozen = !connected || abandoning || abandoned || prediction.position >= prediction.text.length;

  useEffect(() => {
    offsetRef.current = clockOffset;
  }, [clockOffset]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offsetRef.current), 100);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let through = 0;
    let active = true;
    // Une nouvelle instance après rechargement doit dépasser la séquence de l'ancienne.
    const sender = createInputBatcher(({ seq, keys }) => {
      through += keys.length;
      const sentThrough = through;
      socket.timeout(10000).emit("race:input", { code, seq, keys }, (timeout, response) => {
        if (!active) return;
        if (timeout || !response) {
          // L'acceptation est inconnue : room:watch rétablit une base certaine.
          socket.disconnect().connect();
          return;
        }
        dispatch({ type: "ack", through: sentThrough, response });
        setError(response.ok ? null : response.error);
      });
    }, Date.now());
    batcher.current = sender;
    const receiveSelf: ServerToClientEvents["race:self"] = (self) => dispatch({ type: "self", self });
    const receiveBonus: ServerToClientEvents["race:bonus"] = (grant) => {
      if (grant.targetId === selfId) setNotice((previous) => ({ type: grant.type, id: (previous?.id ?? 0) + 1 }));
    };
    const disconnect = () => sender.dispose();
    socket.on("race:self", receiveSelf);
    socket.on("race:bonus", receiveBonus);
    socket.on("disconnect", disconnect);
    const field = input.current;
    const beforeInput = (event: InputEvent) => {
      if (event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop") event.preventDefault();
    };
    field?.addEventListener("beforeinput", beforeInput);
    // Le champ masqué sur mobile ne doit pas ouvrir le clavier virtuel.
    if (!window.matchMedia("(pointer: coarse) and (max-width: 767px)").matches) input.current?.focus();
    return () => {
      active = false;
      sender.dispose();
      batcher.current = null;
      socket.off("race:self", receiveSelf);
      socket.off("race:bonus", receiveBonus);
      socket.off("disconnect", disconnect);
      field?.removeEventListener("beforeinput", beforeInput);
    };
  }, [code, selfId, socket]);

  const correct = errorMode === "CORRECTION" ? prediction.position : Math.max(0, prediction.position - prediction.errors);
  const total = correct + prediction.errors;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  // Le mot courant reste lisible ; le brouillard ne touche que les mots suivants.
  const wordEnd = prediction.text.indexOf(" ", prediction.position);
  const fogStart = wordEnd < 0 ? prediction.text.length : wordEnd + 1;
  const classes = { correct: "text-cyan", error: "bg-alert/15 text-alert underline", current: "bg-steel text-ink", remaining: "text-mist" };

  if (abandoned) return <p role="status">{m.race.provisional}: {m.race.statuses.abandoned}</p>;

  return <>
    <p className="typing-mobile rounded border border-line bg-card p-4">{m.race.keyboardRecommended}</p>
    <div className="typing-desktop flex flex-col gap-3">
      <section aria-label={m.room.raceText} className="whitespace-pre-wrap break-words rounded border border-line bg-card p-4 font-mono text-lg">
        {prediction.text.split("").map((character, index) => <span key={index}
          className={`${classes[characterState(index, prediction)]}${prediction.fogUntil > now && index >= fogStart ? " race-fog" : ""}`}>{character}</span>)}
      </section>
      <label className="flex flex-col gap-1">{m.race.inputLabel}
        <input ref={input} className={inputClass} value="" disabled={frozen} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          onPaste={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Backspace") event.preventDefault();
          }}
          onChange={(event) => {
            const native = event.nativeEvent as InputEvent;
            const keys = event.currentTarget.value;
            event.currentTarget.value = "";
            if (frozen || !socket.connected || native.inputType === "insertFromPaste" || native.inputType === "insertFromDrop" || !keys) return;
            dispatch({ type: "keys", keys });
            batcher.current?.push(keys);
          }} />
      </label>
      <div className="flex flex-wrap gap-4 font-mono text-sm">
        <span>{m.race.netMpm}: {number.format(netMpm(correct, Math.max(0, now - startsAt)))}</span>
        <span>{m.race.accuracy}: {new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(accuracy(correct, total) / 100)}</span>
      </div>
      <p aria-live="polite">{notice ? <span key={notice.id}>{m.race.bonuses[notice.type]}</span> : null}</p>
      {error ? <p role="alert" className="text-alert">{errorText(m, error)}</p> : null}
    </div>
    <button className={buttonClass} disabled={frozen} onClick={() => dialog.current?.showModal()}>{m.race.abandon}</button>
    <dialog ref={dialog} aria-label={m.race.confirmAbandon} onClose={() => input.current?.focus()} className="m-auto max-w-md rounded border border-line bg-card p-4 text-ink">
      <form method="dialog" className="flex flex-col gap-3" onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        if (!(submitter instanceof HTMLButtonElement) || submitter.value !== "abandon") return;
        batcher.current?.dispose();
        setAbandoning(true);
        socket.timeout(10000).emit("race:abandon", { code }, (timeout, response) => {
          setAbandoning(false);
          if (timeout || !response) {
            setError("serverError");
            socket.disconnect().connect();
          } else if (!response.ok) {
            setError(response.error);
            socket.disconnect().connect();
          } else setAbandoned(true);
        });
      }}>
        <p>{m.race.confirmAbandon}</p>
        <div className="flex flex-wrap gap-3">
          <button className={buttonClass} value="cancel" autoFocus>{m.race.cancel}</button>
          <button className={buttonClass} value="abandon">{m.race.abandon}</button>
        </div>
      </form>
    </dialog>
  </>;
}
