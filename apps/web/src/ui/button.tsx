import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "wouter";

export type ButtonVariant = "primary" | "dark" | "soft" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "press relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold " +
  "disabled:pointer-events-none disabled:opacity-40";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover shadow-[0_6px_18px_-8px_color-mix(in_srgb,var(--color-brand)_70%,transparent)]",
  dark: "bg-ink text-surface hover:opacity-90",
  soft: "bg-brand-soft text-brand-ink hover:brightness-[0.97]",
  secondary: "bg-card text-ink hover:bg-card-2",
  ghost: "text-ink-2 hover:bg-card hover:text-ink",
  danger: "bg-bad-soft text-bad hover:brightness-[0.97]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[14px]",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-6 text-[16px]",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Spinner({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} className={`animate-spin motion-reduce:animate-none ${className}`}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Label shown with a spinner while the action runs. */
  busy?: string | false;
  icon?: ReactNode;
  block?: boolean;
}

export function Button({ variant, size, busy, icon, block, className = "", children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || Boolean(busy)}
      aria-busy={busy ? true : undefined}
      className={buttonClass(variant, size, `${block ? "w-full" : ""} ${className}`)}
    >
      {busy ? (
        <>
          <Spinner />
          {busy}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  external?: boolean;
  children: ReactNode;
}

export function ButtonLink({ href, variant, size, icon, external, className = "", children, ...rest }: LinkProps) {
  const classes = buttonClass(variant, size, className);
  if (external) {
    return (
      <a {...rest} href={href} target="_blank" rel="noreferrer" className={classes}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <Link {...rest} href={href} className={classes}>
      {icon}
      {children}
    </Link>
  );
}
