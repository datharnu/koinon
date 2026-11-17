import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "wouter";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-ctl)] font-medium " +
  "transition-[background-color,box-shadow,color,transform,opacity] duration-300 ease-[var(--ease-out)] active:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-45";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-on-brand hover:shadow-[0_0_0_2px_var(--color-ink),0_0_0_4px_color-mix(in_srgb,var(--color-brand)_55%,transparent)]",
  secondary: "bg-raise text-text hairline hover:bg-weak",
  ghost: "text-text-2 hover:bg-raise hover:text-text",
  danger:
    "bg-[color-mix(in_srgb,var(--color-refuse)_14%,transparent)] text-refuse hover:shadow-[0_0_0_2px_var(--color-ink),0_0_0_4px_color-mix(in_srgb,var(--color-refuse)_45%,transparent)]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-5 text-base",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Arrow() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 transition-transform duration-300 group-hover:translate-x-0.5">
      <path d="M3 8h9m-3.5-3.5L12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg aria-hidden viewBox="0 0 16 16" className="size-4 animate-spin motion-reduce:animate-none">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>{label}</span>
    </span>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: string | false;
  arrow?: boolean;
}

export function Button({ variant, size, busy, arrow, className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <button {...rest} disabled={disabled || Boolean(busy)} aria-busy={busy ? true : undefined} className={buttonClass(variant, size, className)}>
      {busy ? <Spinner label={busy} /> : children}
      {!busy && arrow ? <Arrow /> : null}
    </button>
  );
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  arrow?: boolean;
  external?: boolean;
  children: ReactNode;
}

export function ButtonLink({ href, variant, size, arrow, external, className = "", children, ...rest }: LinkProps) {
  const classes = buttonClass(variant, size, className);
  if (external) {
    return (
      <a {...rest} href={href} target="_blank" rel="noreferrer" className={classes}>
        {children}
        {arrow ? <Arrow /> : null}
      </a>
    );
  }
  return (
    <Link {...rest} href={href} className={classes}>
      {children}
      {arrow ? <Arrow /> : null}
    </Link>
  );
}
