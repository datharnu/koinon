import { useEffect, useRef, useState } from "react";
import { useT } from "../lib/prefs";
import { Spinner } from "./button";
import { IconBackspace } from "./icons";

export const CODE_LENGTH = 8;

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

/**
 * Numeric code entry. Eight digits because the keystore refuses shorter secrets.
 * Typing on a keyboard works too.
 */
export function PinPad({
  onComplete,
  error,
  busy,
  resetKey,
}: {
  onComplete: (code: string) => void;
  error?: string | null;
  busy?: boolean;
  /** Change it to clear the dots, after a wrong code or a step change. */
  resetKey?: unknown;
}) {
  const t = useT();
  const [code, setCode] = useState("");
  const complete = useRef(onComplete);
  complete.current = onComplete;

  useEffect(() => setCode(""), [resetKey]);

  useEffect(() => {
    if (code.length !== CODE_LENGTH) return;
    const timer = window.setTimeout(() => complete.current(code), 120);
    return () => window.clearTimeout(timer);
  }, [code]);

  const shownError = code.length === 0 ? error : null;

  const press = (key: string) => {
    if (busy) return;
    if (key === "back") setCode(code.slice(0, -1));
    else if (code.length < CODE_LENGTH) setCode(code + key);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") press("back");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex h-8 flex-col items-center justify-center">
        {busy ? (
          <span className="flex items-center gap-2 text-[14px] font-medium text-ink-2">
            <Spinner size={16} />
            {t("Déchiffrement des clés…", "Decrypting the keys…")}
          </span>
        ) : (
          <div key={String(resetKey)} className={`flex gap-2.5 ${shownError ? "shake" : ""}`} role="img" aria-label={t(`${code.length} chiffres sur ${CODE_LENGTH}`, `${code.length} of ${CODE_LENGTH} digits`)}>
            {Array.from({ length: CODE_LENGTH }, (_, index) => (
              <span key={index} className={`size-3.5 rounded-full transition-all duration-150 ${index < code.length ? "scale-110 bg-ink" : shownError ? "bg-bad/30" : "bg-card-2"}`} />
            ))}
          </div>
        )}
      </div>
      <p role={shownError ? "alert" : undefined} className={`-mt-3 h-5 text-[13.5px] font-medium ${shownError ? "text-bad" : "text-transparent"}`}>
        {shownError ?? "."}
      </p>
      <div className="grid w-full max-w-[290px] grid-cols-3 gap-x-5 gap-y-3">
        {KEYS.map((key, index) =>
          key === "" ? (
            <span key={index} />
          ) : (
            <button
              key={key}
              type="button"
              disabled={busy}
              onClick={() => press(key)}
              aria-label={key === "back" ? t("Effacer", "Delete") : key}
              className="press grid h-[62px] place-items-center rounded-full text-[26px] font-semibold text-ink transition-colors hover:bg-card active:bg-card-2 disabled:opacity-40"
            >
              {key === "back" ? <IconBackspace size={24} /> : key}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
