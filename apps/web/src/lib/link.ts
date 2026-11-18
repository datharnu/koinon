import { constitutionHash } from "@koinon/core/proof";

/** The fragment is the fingerprint of the four xpubs and the delay. Labels are not in it. */
export function memberLink(
  config: {
    fundId: string;
    csvBlocks: number;
    officers: Record<"O1" | "O2" | "O3", { xpub: string }>;
    assembly: { xpub: string };
  },
  origin = window.location.origin,
): string {
  const hash = constitutionHash({
    officers: [config.officers.O1.xpub, config.officers.O2.xpub, config.officers.O3.xpub],
    assembly: config.assembly.xpub,
    csvBlocks: config.csvBlocks,
  });
  return `${origin}/fonds/${config.fundId}#${hash}`;
}
