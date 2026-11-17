import * as ecc from "@bitcoinerlab/secp256k1";
import { BIP32Factory, type BIP32API } from "bip32";
import { ECPairFactory, type ECPairAPI } from "ecpair";

export const ECPair: ECPairAPI = ECPairFactory(ecc);
export const bip32: BIP32API = BIP32Factory(ecc);
