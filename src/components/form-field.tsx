type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export const inputClass =
  "rounded border border-border bg-transparent px-3 py-2 aria-invalid:border-danger";

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
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded border border-danger px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

export const buttonClass =
  "rounded border border-border px-4 py-2 font-medium hover:bg-surface disabled:opacity-50";

export const selectClass = "rounded border border-border bg-background px-2 py-1 text-sm";
