import { useId, type InputHTMLAttributes, type ReactNode } from "react";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  suffix?: ReactNode;
  mono?: boolean;
}

/** Every input goes through here: 44px minimum, 16px text on phones, wired error. */
export function Field({ label, hint, error, suffix, mono, className = "", ...rest }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const described = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-medium text-text-2">
        {label}
      </label>
      <div
        className={`flex min-h-11 items-center gap-2 rounded-[var(--radius-ctl)] bg-raise px-3 transition-shadow duration-200 focus-within:shadow-[inset_0_0_0_1.5px_var(--color-brand)] ${
          error ? "shadow-[inset_0_0_0_1.5px_var(--color-refuse)]" : "hairline"
        }`}
      >
        <input
          {...rest}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={`h-11 w-full min-w-0 bg-transparent text-base text-text placeholder:text-text-3 focus:outline-none sm:text-[15px] ${mono ? "font-mono text-[14px]" : ""}`}
        />
        {suffix ? <span className="shrink-0 text-sm text-text-3">{suffix}</span> : null}
      </div>
      {hint && !error ? (
        <p id={hintId} className="text-[12.5px] leading-snug text-text-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="font-mono text-[12px] text-refuse">
          {error}
        </p>
      ) : null}
    </div>
  );
}
