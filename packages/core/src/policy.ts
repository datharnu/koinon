import { compileMiniscript } from "@bitcoinerlab/miniscript";
import { payments, script } from "bitcoinjs-lib";
import { bytesEqual, bytesToHex, hexToBytes } from "./bytes.js";
import { KoinonError, ErrorCode } from "./errors.js";
import { pubkeyAt, type Account } from "./keys.js";
import { bitcoinNetwork, type KoinonNetwork } from "./network.js";

const OPS = script.OPS;

export interface PolicyKeys {
  /** Script order is officer order, not lexicographic. Signatures must follow this order. */
  officers: [Account, Account, Account];
  assembly: Account;
  csvBlocks: number;
}

export interface CompiledPolicy {
  /** Miniscript expression from the spec. The compiler is the source of the script bytes. */
  expression: string;
  /** ASM as emitted by the compiler, including its decimal small-number tokens. */
  asm: string;
  script: Uint8Array;
  /**
   * Always false for this policy. The same officer keys are on both paths, and the
   * miniscript sanity checker rejects repeated keys. The script is still the compiled
   * expression. Regtest is the proof, not the sanity flag.
   */
  issane: boolean;
  sanityError: string | null;
  address: string;
  scriptPubKey: Uint8Array;
  index: number;
  /** 0 is a member receive address. 1 is the fund change address. */
  change: 0 | 1;
  csvBlocks: number;
}

export function compileFundPolicy(
  keys: PolicyKeys,
  index: number,
  network: KoinonNetwork,
  change: 0 | 1 = 0,
): CompiledPolicy {
  assertCsv(keys.csvBlocks);
  const officerPubkeys = keys.officers.map((officer) =>
    pubkeyAt(officer.xpub, change, index, network),
  ) as [Uint8Array, Uint8Array, Uint8Array];
  const assemblyPubkey = pubkeyAt(keys.assembly.xpub, change, index, network);
  const expression = policyExpression(officerPubkeys, assemblyPubkey, keys.csvBlocks);
  const compiled = compileMiniscript(expression);
  if (!compiled.asm.includes("OP_CHECKSEQUENCEVERIFY") || !compiled.asm.includes("OP_CHECKMULTISIG")) {
    throw new KoinonError(ErrorCode.VALIDATION, "compiler did not emit the expected policy opcodes");
  }
  const witnessScript = scriptFromCompilerAsm(compiled.asm);
  const payment = payments.p2wsh({
    redeem: { output: witnessScript },
    network: bitcoinNetwork(network),
  });
  if (!payment.address || !payment.output) {
    throw new KoinonError(ErrorCode.VALIDATION, "could not derive a p2wsh address");
  }
  return {
    expression,
    asm: compiled.asm,
    script: witnessScript,
    issane: compiled.issane,
    sanityError: compiled.error,
    address: payment.address,
    scriptPubKey: payment.output,
    index,
    change,
    csvBlocks: keys.csvBlocks,
  };
}

/** Public description of the policy. Not a descriptor Bitcoin Core can import. */
export function fundDescriptor(keys: PolicyKeys): string {
  const receive = keys.officers.map((officer) => `${officer.xpub}/0/*`).join(",");
  const assembly = `${keys.assembly.xpub}/0/*`;
  return `wsh(or_d(multi(2,${receive}),and_v(v:pk(${assembly}),and_v(v:multi(1,${receive}),older(${keys.csvBlocks}))))) change=/1/0`;
}

export function policyExpression(
  officers: [Uint8Array, Uint8Array, Uint8Array],
  assembly: Uint8Array,
  csvBlocks: number,
): string {
  const [o1, o2, o3] = officers.map((key) => bytesToHex(key));
  const recovery = bytesToHex(assembly);
  return `or_d(multi(2,${o1},${o2},${o3}),and_v(v:pk(${recovery}),and_v(v:multi(1,${o1},${o2},${o3}),older(${csvBlocks}))))`;
}

/**
 * The compiler prints small numbers as decimals (`2`, `10`) and data pushes as `<hex>`.
 * bitcoinjs `fromASM` does not accept that dialect, so this is the byte encoding of
 * the compiler's own tokens.
 */
export function scriptFromCompilerAsm(asm: string): Uint8Array {
  const chunks = asm.split(" ").filter((token) => token.length > 0).map((token) => {
    if (token.startsWith("<") && token.endsWith(">")) {
      return hexToBytes(token.slice(1, -1));
    }
    if (/^\d+$/.test(token)) {
      const value = Number(token);
      if (value === 0) return OPS.OP_0;
      if (value >= 1 && value <= 16) return (OPS.OP_1 - 1 + value) as number;
      return script.number.encode(value);
    }
    if (token in OPS) {
      return OPS[token as keyof typeof OPS];
    }
    throw new KoinonError(ErrorCode.VALIDATION, `unrecognised compiler token: ${token}`);
  });
  return script.compile(chunks);
}

export function assertSameScript(actual: Uint8Array, expected: Uint8Array): void {
  if (!bytesEqual(actual, expected)) {
    throw new KoinonError(ErrorCode.PSBT_MISMATCH, "witness script is not the fund policy");
  }
}

function assertCsv(blocks: number): void {
  if (!Number.isInteger(blocks) || blocks < 1 || blocks > 0xffff) {
    throw new KoinonError(ErrorCode.VALIDATION, "csv blocks must be an integer from 1 to 65535");
  }
}
