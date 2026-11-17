# Spending policy

Regtest only. Not audited. Two officers together can spend. That is the rule, not a hole.

## What the script allows

Witness script, P2WSH, one script per receive index.

- Path A: 2 of the 3 officer keys. No timelock.
- Path B: the assembly key and any 1 officer key, after `N` blocks (`OP_CHECKSEQUENCEVERIFY`).

`N` is 10 on regtest for the demo and about 4320 blocks (30 days) when a fund is configured for real use. The value is a parameter of the fund, not a constant in the script builder.

Miniscript expression, officer order not sorted:

```
or_d(multi(2,O1,O2,O3),and_v(v:pk(K),and_v(v:multi(1,O1,O2,O3),older(N))))
```

`@bitcoinerlab/miniscript` 2.0.1 compiles that expression. The script bytes are that compiler's tokens, not a second implementation. The compiler's sanity check returns `issane: false` with `repeated public keys`, because O1, O2 and O3 appear on both paths. The repeated keys are the policy: the same officers can either reach 2-of-3, or pair with the assembly key after the timelock. The satisfier refuses an unsane expression, so the witness is built here and checked by bitcoind.

Compiled shape:

```
OP_2 <O1> <O2> <O3> OP_3 OP_CHECKMULTISIG
OP_IFDUP OP_NOTIF
  <K> OP_CHECKSIGVERIFY
  OP_1 <O1> <O2> <O3> OP_3 OP_CHECKMULTISIGVERIFY
  <N> OP_CHECKSEQUENCEVERIFY
OP_ENDIF
```

For `N` from 1 to 16 the compiler emits that small-number opcode (`OP_10` when `N` is 10). Above 16 it emits a minimally encoded script number. Opcode `0xb2` is `OP_CHECKSEQUENCEVERIFY`. `bitcoinjs-lib` prints that same byte as `OP_NOP3`.

Keys are BIP48 native segwit, testnet coin type, even on regtest:

```
m/48'/1'/0'/2'/0/<index>
```

Index 0 is the fund's own receive address in the kill test. Later, each member gets a distinct index. The index is the only on-chain attribution.

Path A sets `nSequence` to `0xfffffffe` (RBF, BIP68 disabled on that input). Path B sets `nSequence` to `N` before anyone signs. Transaction version is 2.

## Witness

Stack order is bottom first. The last item is the witness script.

Path A, keys in script order, using the first two signatures present:

```
<dummy> <earlier sig> <later sig> <witness script>
```

CHECKMULTISIG pops the later signature first. A first build put the earlier signature on top. bitcoind rejected that 2-of-3 with the same NULLFAIL error as a one-signature spend. The comment in `packages/core/src/witness.ts` marks that fix.

One-signature attack, used only by the explicit attack mode:

```
<dummy> <empty> <the one signature> <witness script>
```

Path B:

```
<inner dummy> <officer sig> <assembly sig> <outer dummy> <empty> <empty> <witness script>
```

The two empty signatures dissatisfy the 2-of-3 under BIP146. The branch then checks the assembly key, one officer key, and the timelock.

## Proof

Run on 17 Nov 2026 against Bitcoin Core 32.1.0 (`/Satoshi:32.1.0/`), started by `pnpm kill-test` on regtest port 18445. Docker is not installed on this machine, so this was not a container. The consensus checks are bitcoind's.

Command: `pnpm kill-test`

Unit tests, which do not start bitcoind: `pnpm test` — 7 passed. That count is the suite at the time of this script proof. A later `pnpm test` on 17 Nov 2026 is core 22, coordinator 2, nostr 2, recorded in `docs/DEFERRED.md`.

Observed:

| Case | Result |
| --- | --- |
| 1 officer signature | `testmempoolaccept` `allowed=false`, reason `mempool-script-verify-flag-failed (Signature must be zero for failed CHECK(MULTI)SIG operation)`. `sendrawtransaction` returned `-26` with the same reason. |
| 2 officer signatures | Accepted. txid `9f9144009c779907d8048f34a336dea3398251b595ee2846d6a502f127aa1728`, 1 confirmation. |
| Path B before 10 blocks | `testmempoolaccept` `allowed=false`, reason `non-BIP68-final`. `sendrawtransaction` returned `-26 non-BIP68-final`. |
| Path B after mining 10 blocks | Accepted. txid `318088820b2e9e0e1f52565c21f733d3e96f88375804bbdd6ae5632d0ad880d9`, 1 confirmation. |

Demo script at index 0 for the fixed test entropy (bytes `0x11`, `0x22`, `0x33`, `0x44`). This hex is a vector for those keys, not a constant of every fund:

```
5221037085d7e1eba07138c7430405483a285c21fac7fbff731032fdf319e2bf28791221029a5d45eceffc51730a8627ce2ec0e1da49af100fc39a4ddd4db63a0c31dd7dc321021e9592791c807cd5a456f80ab95851e0f4064b5f36436403b593dd86b101863f53ae73642102569265f9573f6332c383b79c59bb043d53330ebbc63e19723eb62a357e4c4218ad5121037085d7e1eba07138c7430405483a285c21fac7fbff731032fdf319e2bf28791221029a5d45eceffc51730a8627ce2ec0e1da49af100fc39a4ddd4db63a0c31dd7dc321021e9592791c807cd5a456f80ab95851e0f4064b5f36436403b593dd86b101863f53af5ab268
```

Address for that vector: `bcrt1q4frjwer40fap5hun55scs0pwlxj8yxgj9juza0tczeek0h58slvqx7vgak`.

The same command was run again after the coordinator refactor, still on Bitcoin Core 32.1.0. The script hex and address above did not change. Fresh chain, so the txids differ: 2-of-3 `1910ce9daa7d35210379760053888bd89b53bb59b4f2e35d4147f53740e5bfa3`, path B `d53077a2da939595455aa2040cf60d3c80c87953cb0b49a73fabd65ce8399446`. Both had 1 confirmation. The 1-signature and early path B refusals were the same reasons.

## Not claimed

- This file's proof is the script, not the server. The coordinator's own regtest spend is recorded in `docs/DEFERRED.md`. Keys in the kill test lived in that process.
- Mainnet, a third-party audit, and a fee policy beyond "the output is 10 000 sats under a 1 BTC regtest input".
- The miniscript sanity flag. It is false on purpose and is not the safety proof.
- Docker, CI, or a second machine. One local `bitcoind` 32.1 run.
