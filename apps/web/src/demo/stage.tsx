import { createContext, useContext } from "react";
import type { OfficerRole } from "../lib/flows";

export interface Focus {
  role: OfficerRole;
  requestId: string;
  /** Bumps on every hand-off, so the same request can be opened twice. */
  nonce: number;
}

interface Stage {
  /** Both phones are on screen at once. */
  together: boolean;
  /** Give the device to another officer, with this request open on their phone. */
  handTo: (role: OfficerRole, requestId: string) => void;
  focus: Focus | null;
}

export const StageContext = createContext<Stage | null>(null);

/** The second-phone page has no stage. Callers must handle null. */
export function useStage(): Stage | null {
  return useContext(StageContext);
}
