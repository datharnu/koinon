import { networks, type Network } from "bitcoinjs-lib";

/** Regtest only until a later milestone. Mainnet is out of scope. */
export type KoinonNetwork = "regtest";

export function bitcoinNetwork(network: KoinonNetwork): Network {
  if (network !== "regtest") {
    throw new Error(`unsupported network: ${network}`);
  }
  return networks.regtest;
}
