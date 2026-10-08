type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export const inputClass =
  "rounded border border-line bg-transparent px-3 py-2 aria-invalid:border-alert";

export function FormField({ id, label, error, hint, className, ...inputProps }: FormFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={className ?? inputClass}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-mist">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded border border-alert px-3 py-2 text-sm text-alert">
      {message}
    </p>
  );
}

/** Bouton secondaire : contour (couleur line). */
export const buttonClass =
  "rounded border border-line px-4 py-2 font-medium hover:bg-card disabled:opacity-50";

/** Bouton principal (signature) : fond neon, texte night (le blanc manque de contraste en foncé). */
export const primaryButtonClass =
  // sfx-primary : repère pour le son au survol (src/components/effects.tsx).
  "sfx-primary rounded border border-neon bg-neon px-4 py-2 font-semibold text-night hover:opacity-90 disabled:opacity-50";

/** Gros bouton principal, avec une légère lueur néon. */
export const heroButtonClass = `${primaryButtonClass} glow-neon py-3 text-lg`;

export const selectClass = "rounded border border-line bg-night px-2 py-1 text-sm";
