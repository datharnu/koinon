import { useEffect, useState } from "react";
import { cosignLink, type CosignPayload } from "../lib/cosign";
import { readUnlock } from "../lib/passkey";
import { PEOPLE } from "../lib/people";
import { usePrefs } from "../lib/prefs";
import { readSealed } from "../lib/vault";
import { Button } from "../ui/button";
import { IconCopy } from "../ui/icons";
import { Sheet } from "../ui/sheet";
import { Skeleton } from "../ui/states";
import { useToast } from "../ui/toast";
import { useDemo } from "./context";

/**
 * Optional. The judge path stays the two phones on one screen.
 * The QR holds Coumba's ciphertext. The 8-digit code is typed on the other phone.
 */
export function SecondPhoneSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = usePrefs();
  const demo = useDemo();
  const toast = useToast();
  const unlock = readUnlock();
  const passkey = unlock?.method === "passkey";
  const sealed = passkey ? null : readSealed("O2");
  const payload: CosignPayload | null = sealed ? { v: 1, config: demo.config, key: sealed } : null;
  const link = payload ? cosignLink(payload) : "";

  const copy = () => {
    void navigator.clipboard?.writeText(link).then(
      () => toast({ tone: "good", title: t("Lien copié", "Link copied") }),
      () => toast({ tone: "bad", title: t("Copie impossible", "Could not copy"), detail: link }),
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Signer sur un second téléphone", "Sign on a second phone")}
      footer={
        passkey || !payload ? (
          <Button variant="secondary" size="lg" block onClick={onClose}>
            {t("Fermer", "Close")}
          </Button>
        ) : (
          <Button size="lg" block icon={<IconCopy size={18} />} onClick={copy}>
            {t("Copier le lien", "Copy the link")}
          </Button>
        )
      }
    >
      {passkey ? (
        <p className="break-words pb-2 text-[14.5px] leading-snug text-ink-2">
          {t(
            "Cette démo est verrouillée par une passkey. Le secret PRF ne quitte pas cet appareil, donc Coumba ne peut pas être ouverte ailleurs. La signature à deux téléphones côte à côte reste disponible ici.",
            "This demo is locked with a passkey. The PRF secret does not leave this device, so Coumba cannot be opened elsewhere. The two phones side by side on this screen still work.",
          )}
        </p>
      ) : !payload ? (
        <p className="break-words pb-2 text-[14.5px] leading-snug text-ink-2">
          {t("La clé chiffrée de Coumba n'est pas sur cet appareil.", "Coumba's encrypted key is not on this device.")}
        </p>
      ) : (
        <div className="flex flex-col items-center gap-4 pb-2">
          <p className="w-full break-words text-[14px] leading-snug text-ink-2">
            {t(
              `Ouvrez ce lien sur l'autre téléphone, sur ce même site, et tapez le code à 8 chiffres. Le QR contient la clé chiffrée de ${PEOPLE.O2.first}, pas le code. Quelqu'un qui photographie le QR a encore besoin du code. Ne faites pas ça pour une vraie caisse.`,
              `Open this link on the other phone, on this same site, and type the 8-digit code. The QR holds ${PEOPLE.O2.first}'s encrypted key, not the code. Someone who photographs the QR still needs the code. Do not do this for a real fund.`,
            )}
          </p>
          <Qr text={link} />
          <p className="w-full break-all font-mono text-[11px] leading-relaxed text-ink-3">{link.replace(/^https?:\/\//, "")}</p>
        </div>
      )}
    </Sheet>
  );
}

function Qr({ text }: { text: string }) {
  const { t } = usePrefs();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let gone = false;
    setUrl(null);
    setFailed(false);
    void import("qrcode")
      .then((qr) => qr.toDataURL(text, { errorCorrectionLevel: "L", margin: 1, width: 280 }))
      .then((data) => {
        if (!gone) setUrl(data);
      })
      .catch(() => {
        if (!gone) setFailed(true);
      });
    return () => {
      gone = true;
    };
  }, [text]);
  if (failed) {
    return <p className="w-full break-words text-[13.5px] text-ink-2">{t("Le QR est trop grand. Copiez le lien.", "The QR is too large. Copy the link.")}</p>;
  }
  if (!url) return <Skeleton className="size-[min(280px,70vw)] rounded-2xl" />;
  return <img src={url} alt="" width={280} height={280} className="size-[min(280px,70vw)] rounded-2xl bg-white p-2" />;
}
