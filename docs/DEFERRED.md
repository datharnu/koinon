# Deferred

Things deliberately not built yet. A later green run does not delete a failure recorded here.

## Failure kept

On the first regtest run, a 2-of-3 spend was rejected with `Signature must be zero for failed CHECK(MULTI)SIG operation`. The witness put the earlier officer's signature on top. CHECKMULTISIG pops the later signature first. Fixed in `packages/core/src/witness.ts`. The one-signature refusal was already correct on that run. The corrected run is in `docs/POLICY.md`.

## Out of scope

- Any user interface.
- Lightning, mainnet, Banxaas, Mobile Money, AI features, Wolof, member phone numbers, push notifications.
- Collusion protection beyond 2-of-3. Two officers who agree can spend.

## Coordinator, ran 17 Nov 2026

`pnpm --filter @koinon/coordinator test`: 2 passed. SQLite prints an experimental warning. That test injects BTC/EUR `60000` and a fake chain. It is not a live price.

`pnpm kill-test`: still refuses 1 signature and early path B, and accepts 2-of-3 and path B after 10 blocks. Txids are in `docs/POLICY.md`.

`pnpm coordinator-spend` against Bitcoin Core 32.1.0:

- Fund, member, and a 0.05 BTC contribution scanned. Balance `5000000` sats. Contribution tx `1a96963355643e639f81aa82940de26358442b87a99cd2a2c0b8ea814bb26219`.
- Live `https://mempool.space/api/v1/prices` timed out. The server returned `RATE_UNAVAILABLE` and did not invent a price.
- The rest of that run used a test double of 60000 EUR, labeled as such. It is not a market price.
- With that double, 1000 XOF locked at 2541 sats. A swapped recipient was `PSBT_MISMATCH`. A second signature from the same officer was `ALREADY_SIGNED`. An expired request was `REQUEST_EXPIRED`.
- O1 and O2 then approved a new request. bitcoind accepted tx `057ec038f9356186151ab9fc7498e1541c9ec00c7e76a879d90ed3f8eb980bda`. After one block the ledger had the contribution and the spend. Audit verified, then failed at seq 1 after one stored row was changed.

Not proven on bitcoind through the coordinator: path B, a real mempool price, two processes, or a restarted server.

## Signer check, ran 17 Nov 2026

`pnpm --filter @koinon/core test` — 20 passed. The new cases refuse a swapped recipient (and add no signature), a different amount, change to an outside address, a fee above the cap (`FEE_OVER_CAP`), and an input from a different set of keys.

`pnpm tamper-test` does not start bitcoind. The guard is the officer's function, which never asks the coordinator.

```
ALLOW honest: fee 1000 change 9000 signed true
REFUSE tampered recipient: PSBT_MISMATCH
signed after refusal: false
```

The check derives scripts from the xpubs. It does not accept a change address from the server.

## Nostr, ran 17 Nov 2026

`pnpm nostr-test` on a loopback relay (`ws://127.0.0.1`, random port). `pnpm --filter @koinon/nostr test` — 2 passed. This is not the compose relay, and it does not authenticate publishers.

- A spend request was gift-wrapped. The relay's stored content did not contain the request type or the purpose.
- A swapped PSBT was `PSBT_MISMATCH`. No approval was built. The honest PSBT produced an approval with no PSBT field, and the requester received it.
- A rejection was delivered the same way. Its reason was not in the relay content.
- An unknown type was ignored. An expired request did not fetch a PSBT. A message pointing at another coordinator was ignored.
- Captured console output did not contain the sender secret, the purpose, or the PSBT.

Not proven: a public relay, `nostr-rs-relay`, or two machines.

## CLI, ran 17 Nov 2026

`pnpm --filter @koinon/core exec vitest run test/keystore.test.ts` — 2 passed. `pnpm cli-demo` on Bitcoin Core 32.1, regtest, with the loopback relay and an in-process coordinator. The rate was a test double of 60000 EUR, printed as such. The live price was not fetched.

- `init-fund` wrote four encrypted key files. A BIP39 word from the decrypted treasurer key was absent from the file and from the transcript. The transcript had no `nsec`, `xprv`, or pin.
- Two members, two contributions of 5000 XOF (12705 sats each), then one confirmation.
- A 1000 XOF request locked 2541 sats. Tamper was `PSBT_MISMATCH` and that officer did not sign. One signature was refused by bitcoind (NULLFAIL). Two approvals broadcast tx `fc17f0a8d9d38c6d2b21364acc18062999f9b798cd2fdf2287ba050c7a50435c`.
- A second request was rejected by the third officer. The reason was not printed.
- Recovery before 10 confirmations was `non-BIP68-final`. After `mine 10`, bitcoind accepted tx `6c1ccaa39387ef08ccdfcdd1547fd4c877594e430b23db9d21d3d4d298ab68f7`.
- `audit verify` reported the chain intact.

Not proven: two machines, a restarted coordinator reading the same database, or a pin typed at a prompt. The demo passes `--pin`.

## Seed and e2e, ran 17 Nov 2026

`pnpm test` — core 22, coordinator 2, nostr 2. `pnpm typecheck` passed. `pnpm e2e` on Bitcoin Core 32.1, regtest. Docker is not installed, so compose was not started. The script said so and ran the same checklist on the host node. The rate was a fixture at 60000 EUR, fetched over HTTP by the coordinator, printed as not a market price.

- Seed created Dahira Démo, 12 members, and 12 contributions of 5000 XOF (12705 sats). One confirmation.
- A 1000 XOF request locked 2541 sats at 60000 EUR. Tamper was `PSBT_MISMATCH`. One signature was refused by bitcoind (NULLFAIL). Two approvals broadcast tx `ccc8f9dd877540679e3db141754cb374a65c71416e12e8c25863fd0a0acc2865`. The ledger showed the spend.
- The request and the approval arrived as gift wraps. The stored ciphertext did not contain the purpose or the message type.
- A second request was backdated in the database, because the product expiry is 24 hours. The officer refused before signing (`REFUS expired`). Broadcast returned `REQUEST_EXPIRED`.
- Recovery before 10 confirmations was `non-BIP68-final`. After `mine 10`, bitcoind accepted tx `7f50d10e467ee5ccb5342c6de9cbb863c9a817d410cb7a39ee448ef150037cc1`.
- Audit verified, then one row was altered and verify failed at seq 1.
- The coordinator log and the command output had no pseudonym, `xprv`, `tprv`, seed word, `nsec1`, pin, or PSBT base64.

Not proven on this machine: `docker compose up` (Docker is not installed here).

## GitHub Actions, 17 Nov 2026

[Run 44156940764](https://github.com/datharnu/koinon/actions/runs/44156940764) on commit `793ace8`: `unit` passed (core 22, coordinator 2, nostr 2, typecheck). `e2e` ran `docker compose up --build` and all nine checklist items passed inside compose. The container log scan over every compose service passed.

The previous run failed only at the log scan: the e2e container runs as root and wrote `.e2e/word` with mode 0600, so the runner user could not read it. `scripts/e2e.ts` now hands the file to the owner of the mounted folder, still 0600.

## Docs, written 17 Nov 2026

`README.md`, `docs/THREAT_MODEL.md`, and `docs/UI_CONTRACT.md` are written. They describe the runs above. They do not add a run of compose, of GitHub Actions, or of a live mempool price.

## Web app, 17 Nov 2026

`apps/web` (Vite, React, Tailwind, TanStack Query) is a homepage plus `/app`, a demo with the Treasurer's and the Secretary's phones side by side, and `/fonds/:id`, a read-only member view. It was walked in Chrome against a native regtest stack (bitcoind 32.1 from Homebrew, the price fixture, the relay, the coordinator with `KOINON_DEMO=1`): fund creation with 12 dues, a request opened and gift-wrapped to the Secretary, the Treasurer's single-signature transaction refused by bitcoind (`Signature must be zero for failed CHECK(MULTI)SIG`), a tampered PSBT refused locally (`PSBT_MISMATCH`), the second signature, broadcast, confirmation, a rejection with a reason, and recovery refused at `non-BIP68-final` then accepted after 10 blocks.

- The demo keeps all four keys in one browser, encrypted with one secret. A real fund keeps one key per phone.
- `POST /v1/demo/faucet` and `POST /v1/demo/mine` exist only with `KOINON_DEMO=1`. The faucet pays only member addresses.
- Node answers show as toasts and inline results. Nothing is kept after a reload; the chain and the ledger stay.
- Unlock: a passkey's WebAuthn PRF output (32 bytes) is the secret the keystore encrypts with. Browsers or authenticators without PRF fall back to an 8-digit code, because the keystore refuses secrets under 8 characters. An 8-digit code is weak against someone who copies the browser storage; PBKDF2 310k slows that, it does not stop it. The code path was walked by automation; the passkey path was created and unlocked by hand in Chrome on macOS. Safari, Android and Windows Hello were not tried.
- The "Try to cheat" sheet opens its own 10 000 F request when the Treasurer has none pending, so a pending request stays on the Secretary's phone after the attack.
- After a recovery is accepted, the indexer reads bitcoind's mempool so the spend can show as 0 confirmations (francs taken from the due's receipt, not a new rate). The demo still mines one block so the cheat-sheet story ends confirmed. Contributions still appear only after a mined block.
- The in-browser bundle that signs (bitcoinjs, miniscript, secp256k1) is 708 kB, 228 kB gzipped, and loads only on `/app` and `/fonds`.
- `@koinon/core` hashes with `@noble/hashes` instead of `node:crypto` so the same code signs in the browser.

## Not started

- A run of `docker compose up` on a developer machine (CI runs it).
- A public deployment. `docs/DEPLOY.md` describes one.
- A service worker or offline mode. The app needs the coordinator and the relay.
- Wolof strings. The app is French and English.

## Decisions

- Signing stack is `bitcoinjs-lib` 7.0.5. Custom finalizer goes through `Psbt.finalizeInput`. `@bitcoinerlab/miniscript` 2.0.1 compiles the script. Its satisfier will not run because the expression repeats keys, so witnesses are built in `packages/core/src/witness.ts` and proved on regtest.
- Coin type is testnet (`1'`) on regtest, path `m/48'/1'/0'/2'/0/index`. Change outputs use chain 1, index 0.
- `pnpm test` does not start bitcoind. `pnpm kill-test`, `pnpm coordinator-spend`, `pnpm cli-demo`, and `pnpm e2e` do. `pnpm nostr-test` starts only the loopback relay. The GitHub workflow is written and has not been run.
- Compose publishes the coordinator and the relay on 127.0.0.1. bitcoind RPC stays on the internal network. A host command that mines or spends uses `docker compose --profile tools run --rm cli`. The relay in compose is `packages/nostr/src/local-relay.ts`. It does not authenticate publishers.
- The compose price is a separate fixture process. The coordinator fetches it. There is no hardcoded price in the coordinator. If the fixture is down, a spend is `RATE_UNAVAILABLE`.
- Officer keys are encrypted with PBKDF2-SHA256 (310,000 rounds) and AES-256-GCM. The server never receives the file or the pin. A file that claims fewer rounds is refused.
- Nostr keys are separate from the Bitcoin keys. The message includes `path` because the signer has to know which sequence it is approving. The fee cap stays on the officer's machine. A message cannot raise it, and a message cannot point the officer at a different coordinator.
- The database is `node:sqlite`. It is experimental. There is no phone column.
- Fund creation, member add, and broadcast are unauthenticated and rate-limited. A broadcast still needs two signatures in the PSBT. Request, signature, and reject require an officer signature over the raw body.
- One officer can veto. The reason is stored on the request and is not written to the audit log.
- Coins are reserved when a request is created and released on reject, expiry, or a failed broadcast. A failed broadcast is not retried.
- Coin selection is greedy largest-first. It can overpay the fee. It does not find an optimal set.
- The rate cache is 60 seconds, in memory, per process. No hardcoded price.
- The e2e expiry does not wait 24 hours. It writes `expires_at` in the database. The officer then refuses, and the server refuses the broadcast. There is no HTTP route that expires a request on demand.
