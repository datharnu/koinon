# Build prompt: Koinon (backend, wallet core, Nostr, tests, docs). NO UI.

Paste everything below the line into the coding agent. Run it from an empty folder
`/Users/mac/Desktop/Hackathons/Koinon` (this file can stay there).

---

You are building **Koinon**, an entry for the **Dakar Bitcoin Hack by BTrust 2026**.
Deadline: **20 Nov 2026, 20:00 UTC**. Plan to submit by 18:00 UTC. Work in small, verified steps.

## What Koinon is (one sentence)

A shared Bitcoin fund for a Senegalese association (a dahira, a GIE, a sports club) where the treasurer
alone cannot move the money: two of three officers must sign from their own devices, spend requests travel as
encrypted Nostr messages, and every member can see every contribution and spend in CFA francs.

## Scope of THIS task

Build everything **except the user interface**: wallet core library, coordinator server, Nostr approval
transport, local Bitcoin network, seed data, CLI that drives every flow, tests, CI, and docs.

- Do **not** create web pages, components, CSS, or a frontend app. No `apps/web`.
- Design every function and endpoint so a UI can be added later without changing the core. Document them in
  `docs/API.md` and `docs/UI_CONTRACT.md` (what each future screen needs: data, actions, error codes,
  loading and empty states the API can return).
- The CLI is the demo driver until the UI exists. Every judge-visible behaviour must be runnable from the CLI.

## The rules that must never break (invariants)

1. **No spend without 2 of 3 officer signatures.** Enforced by Bitcoin script, not by our code. Proof: a
   transaction carrying one officer signature is rejected by `bitcoind` itself.
2. **An officer never signs a transaction that differs from the request they read.** Before signing, the
   officer's client decodes the PSBT and checks: exactly the requested recipient and amount, change goes back
   to a fund address, fee under a cap, inputs belong to the fund. Any mismatch: refuse to sign with a clear
   error code. The coordinator server is treated as untrusted for this check.
3. **Recovery cannot happen early.** Spending path B (any 1 officer + the assembly key) is valid only after
   `N` blocks (relative timelock, `OP_CHECKSEQUENCEVERIFY`). Before that, `bitcoind` rejects it
   (`non-BIP68-final`). `N` is configurable: ~4320 blocks (about 30 days) for real, 10 on regtest for demo.
4. **The server never holds a private key.** Keys live only in the officer's client (encrypted at rest).
   The server is watch-only.
5. **No personal data in logs.** No names, phone numbers, xprv/seed, PSBT contents, or Nostr secret keys in
   any log line. A test greps the logs to prove it.
6. **The CFA amount is locked at request creation.** The sats amount and the BTC/XOF rate are frozen in the
   request; officers approve that exact sats amount, not a re-quoted one.

If any invariant cannot be met, stop and report instead of weakening it.

## Spending policy

Witness script (P2WSH), per derivation index:

- Path A: `2-of-3` multisig of officer keys O1, O2, O3.
- Path B: `1-of-3` officer key AND assembly key K, after `N` blocks (CSV).

Equivalent miniscript intent: `or_d(multi(2,O1,O2,O3), and_v(v:pk(K), and_v(v:multi(1,O1,O2,O3), older(N))))`.

Do not trust this expression blindly. Either compile it with a maintained miniscript library or hand-write
the script, then **prove it** on regtest: path A with 2 sigs accepted, path A with 1 sig rejected, path B
before `N` rejected `non-BIP68-final`, path B after `N` accepted. Record the exact script in `docs/POLICY.md`.

Keys: each holder has a BIP39 seed. Use a BIP48-style account path for multisig (testnet coin type),
export xpubs, and derive child keys per address index. Each member gets their own receive index so
contributions can be attributed **by index**, never by name or phone. The index-to-pseudonym map lives only
in the fund config, not in logs.

## Architecture

TypeScript monorepo (npm or pnpm workspaces). Node 22+. Strict TypeScript. Zod for every external input.

```
packages/core         pure, browser-safe: keys, policy/script, addresses, PSBT build/verify/sign/combine,
                      finalize (both paths, custom finalizer for the CSV path), CFA conversion,
                      request model, key encryption at rest (WebCrypto: PBKDF2-SHA256 >= 310k + AES-256-GCM)
packages/nostr        spend-request transport: NIP-17 private direct messages (NIP-44 encryption,
                      gift wrap), publish/subscribe, request + approval + rejection message schemas
apps/coordinator      Fastify server, watch-only: fund config (public data), chain indexer
                      (contributions per index, spends, balance), request registry and status,
                      PSBT combine and broadcast, BTC/XOF rate cache, hash-chained audit log, SQLite
apps/cli              `koinon` CLI that uses core + nostr + coordinator API to run every flow
infra/                docker compose: bitcoind regtest, a local Nostr relay, coordinator, bootstrap
scripts/              seed, e2e, log-scan
```

Library choices (verify current versions and that the APIs below exist before using them):
- Bitcoin: `bitcoinjs-lib` v6+ with `tiny-secp256k1` (or `@bitcoinerlab/secp256k1`), `bip32`, `bip39`,
  `ecpair`. Use `Psbt.finalizeInput(index, customFinalizer)` for the CSV path. Alternative: `@scure/btc-signer`
  if it handles the custom script more cleanly. Pick one and say why.
- Nostr: `nostr-tools` (nip17, nip44, nip19).
- Server: `fastify`, `zod`, `better-sqlite3` or `node:sqlite`, `@fastify/rate-limit`, `@fastify/helmet`.
- Tests: `vitest`.
- Images: `bitcoin/bitcoin` (a current 28.x or 29.x tag) and a Nostr relay image (e.g. `scsibug/nostr-rs-relay`
  or `strfry`). Check that the tags exist before pinning them.

Rate: BTC/EUR from `https://mempool.space/api/v1/prices`, XOF = EUR x 655.957 (fixed peg). Cache 60 s. If the
fetch fails, use the last cached rate and mark it `stale: true` with its age. Never invent a rate. Regtest
sats have no value; say so in every rate response (`network: "regtest"`).

## Data model (minimum)

- `Fund`: id, name, network, policy params (`N`, fee cap), officer xpubs + labels (role only, e.g.
  "Trésorier"), assembly xpub, descriptor(s), created_at.
- `Member`: fund_id, index, pseudonym (display only), created_at. No phone number field. If a later UI wants
  contact data, it stays on the client.
- `Contribution`: derived from chain: txid, vout, index, sats, xof_at_receipt, confirmations, seen_at.
- `SpendRequest`: id (uuid), fund_id, requester officer, recipient address, purpose (<= 140 chars, validated),
  amount_xof, amount_sats, rate_btc_xof, rate_fetched_at, psbt (base64, stored server-side, never logged),
  path (A|B), status (`draft|pending|approved|broadcast|confirmed|rejected|expired|failed`), approvals
  [{officer, signed_at}], expires_at (default 24 h), created_at.
- `AuditEntry`: seq, prev_hash, hash, at, actor (role or "system"), action, request_id, detail (no PII).
  The chain must verify; tampering with any row breaks verification.

## Coordinator API (document all in docs/API.md)

JSON only, versioned under `/v1`. Every error has `{ code, message }` with stable codes
(e.g. `INSUFFICIENT_FUNDS`, `REQUEST_EXPIRED`, `ALREADY_SIGNED`, `PSBT_MISMATCH`, `SIG_INVALID`,
`TIMELOCK_NOT_MET`, `RATE_STALE`, `NOT_FOUND`, `VALIDATION`).

- `GET  /v1/health`
- `GET  /v1/funds/:id` (public config, balance in sats and XOF, rate, stale flag)
- `GET  /v1/funds/:id/members` and `POST /v1/funds/:id/members` (assigns next index, returns address)
- `GET  /v1/funds/:id/ledger` (contributions + spends, newest first, paginated, XOF and sats)
- `POST /v1/funds/:id/requests` (creates request + unsigned PSBT, locks rate)
- `GET  /v1/requests/:id`
- `POST /v1/requests/:id/signatures` (partial PSBT from an officer; server verifies the signature is valid
  for that officer's key and that the unsigned tx is unchanged, then combines)
- `POST /v1/requests/:id/broadcast` (finalize + send; returns bitcoind's exact error on refusal)
- `POST /v1/requests/:id/reject`
- `GET  /v1/funds/:id/audit` and `GET /v1/funds/:id/audit/verify`
- `GET  /v1/rate`

Auth for officer actions: an officer proves identity by signing a challenge with their Nostr key (or with
their fund key) per request (NIP-98-style HTTP auth is acceptable). Member reads are public by fund id.
Rate-limit writes. Body size limit. No request bodies in logs.

## Nostr flow

1. Requester creates the request via the API, then sends each other officer a NIP-17 DM with
   `{ type: "koinon.spend_request.v1", request_id, fund_id, amount_xof, amount_sats, recipient, purpose,
   expires_at, coordinator_url }` (no PSBT in the message; the client fetches it and verifies invariant 2).
2. Approver's client fetches the PSBT, verifies, signs locally, posts the partial PSBT, and replies with
   `koinon.spend_approval.v1` or `koinon.spend_rejection.v1` (with reason).
3. Messages are validated with Zod. Unknown types ignored. Expired requests ignored.
4. Works with the local relay in compose and with public relays by config.

## CLI (the demo driver)

`koinon` commands, each printing clear French-first output with English in `--lang en`:

- `init-fund` (creates officer/assembly seeds into encrypted local key files for the demo, registers fund)
- `member add <pseudonym>`
- `contribute <pseudonym> <xof>` (regtest: pays from the bootstrap wallet to that member's index)
- `status` (balance, ledger)
- `request <xof> <address> "<purpose>" --as O1`
- `approve <request_id> --as O2` (fetch, verify, sign, post, Nostr reply)
- `reject <request_id> --as O2 --reason "..."`
- `broadcast <request_id>`
- `attack single-sig <request_id>` (builds and sends a tx with only one signature; prints bitcoind's refusal)
- `attack tamper <request_id>` (swaps recipient in the PSBT; shows the approver refusing `PSBT_MISMATCH`)
- `recover <address> --as O3` (path B; shows `non-BIP68-final` before N, success after)
- `mine <n>` (regtest only)
- `audit verify`

## One-command setup and seed

`docker compose up --build` starts bitcoind (regtest), the relay, the coordinator, and a one-shot bootstrap
that mines spendable coins, creates the demo fund ("Dahira Démo", 3 officers + assembly key, N = 10), adds 12
members, and posts contributions so the ledger is not empty. `npm run seed` does the same against a running
stack. `docker compose down -v` resets everything.

Ports: only the coordinator is published. bitcoind RPC and the relay stay on the internal network
(the relay may be published only if needed for the CLI; say so).

## Tests (must all pass in CI)

Unit (`packages/core`):
- address derivation is deterministic (fixed test seeds); script matches docs/POLICY.md
- PSBT verify refuses: wrong recipient, wrong amount, foreign change, fee over cap, foreign input
- CFA conversion rounding (round sats up so the recipient is never short), peg constant
- key encryption round-trip; wrong PIN fails; ciphertext has no plaintext

E2E (`scripts/e2e.sh` against the compose stack), printing a checklist:
- [ ] fund created, 12 members, contributions visible in ledger
- [ ] request created, rate locked, sats fixed
- [ ] single-signature tx **rejected by bitcoind** (print the error)
- [ ] tampered PSBT **refused by approver** (`PSBT_MISMATCH`)
- [ ] 2-of-3 tx accepted and confirmed; ledger updated
- [ ] expired request cannot be signed or broadcast
- [ ] recovery path before N **rejected** (`non-BIP68-final`); after mining N, accepted
- [ ] Nostr request delivered and approval received via the relay
- [ ] audit chain verifies; tampering one row makes verify fail
- [ ] log scan: no pseudonyms, xprv, seed words, nsec, or PSBT base64 in any container log

CI: GitHub Actions runs unit tests and the e2e against compose on every push.

## Build order (stop at each kill test and report)

1. **Kill test, before anything else:** core policy + regtest. Show a 1-signature spend rejected by
   bitcoind and a 2-signature spend accepted. If this fails, stop and report.
2. Recovery path B with CSV and custom finalizer, proven both ways. If it does not work within ~4 hours,
   ship path A only, keep B in docs as next iteration, and tell me.
3. Coordinator: fund, members, indexer, ledger, requests, signatures, broadcast, audit log.
4. PSBT verification on the signer side (invariant 2) + the tamper attack.
5. Nostr NIP-17 request/approval.
6. CLI covering every command above.
7. Compose, bootstrap, seed, e2e, log scan, CI.
8. Docs.

## Docs to write

- `README.md`: problem (associations, treasurer-alone Wave accounts, disputes), primary user (officers and
  members of a dahira/GIE), how their day changes, reach estimate labelled as hypotheses, setup in one
  command, the CLI demo script step by step, architecture diagram (mermaid), constraints (regtest only, no
  Lightning, no mainnet, UI pending), metrics to track in a pilot (funds onboarded, spends per month,
  median approval time, rejected/tampered requests caught), next iteration. Honest prior-art line: multisig
  and timelocked recovery already exist in Liana, Nunchuk and Sparrow; Koinon is the association workflow,
  CFA ledger, and Nostr approvals for cheap phones.
- `docs/THREAT_MODEL.md`: dishonest treasurer, malicious or compromised coordinator, lost officer key,
  lost device, relay spam or replay, rate manipulation, log leakage, collusion of two officers (out of scope:
  stated plainly). For each: attack, mitigation, residual risk.
- `docs/POLICY.md`, `docs/API.md`, `docs/UI_CONTRACT.md`.
- `.env.example` with every variable explained. No secrets committed.

## Out of scope (do not build)

UI and UX of any kind, Lightning, mainnet, Banxaas or Mobile Money integration, AI features, Wolof, member
phone numbers, push notifications, collusion protection beyond 2-of-3.

## How to report back

After each build-order step: what works (with the command and its output), what does not, any decision you
made and why in one line, and anything you had to verify or could not verify. Keep a running
`docs/DEFERRED.md` list. Never mark a test as passing that you did not run.
