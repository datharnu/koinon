# Koinon — Devpost draft

Paste the sections below. The video script is at the end. Regtest only. Team names are not in the repository yet.

## Problem

A Senegalese association, dahira, or GIE often keeps its monthly pot in one person's Wave account. If that treasurer disappears, or simply decides to, the money is gone. The members find out when they ask.

A shared treasury has to sit for months. It is not a payment that lasts a few seconds. If a server, or one officer, can move it, the association does not hold it.

## What it does

Koinon lets the association hold that pot in a 2-of-3 Bitcoin script with a delayed assembly recovery. Neither the treasurer nor the server can move a franc alone. A spend needs two officers, each signing on their own phone. After a delay, one officer plus the assembly key can recover a coin. Every member opens a link and checks, on that phone, which two keys signed. The check reads the Bitcoin transaction. It does not ask the database who signed.

The phone is a wallet. It derives BIP39 keys on `m/48'/1'/0'/2'`, builds the P2WSH script, checks the PSBT against the request the officer read, and signs. The coordinator is watch-only. It never receives a mnemonic.

Francs on screen come from a rate. In every recorded run that rate was a fixture of 60,000 EUR, and the server said so. A missing rate is a refusal. 1,000 XOF locked at 2,541 sats. Those sats are regtest. They have no value.

## Try it

The running demo is [https://102-68-84-31.sslip.io/](https://102-68-84-31.sslip.io/) and [/app](https://102-68-84-31.sslip.io/app). The page, `/v1`, and `/relay` are one origin.

To run that stack without installing Bitcoin Core:

```bash
docker compose -f infra/docker-compose.yml up -d --build
docker compose -f infra/docker-compose.yml --profile e2e run --rm e2e
```

Without `KOINON_SITE`, open http://127.0.0.1:8000. `docker compose -f infra/docker-compose.yml down -v` deletes the chain and the keys. The public host sets `KOINON_SITE`, as [DEPLOY.md](DEPLOY.md). The 17 Nov refusals were `pnpm e2e` on a Mac where Docker was not installed. Those txids are in the table below.

## How we built it

```text
Officer phone
  BIP39 / BIP48 keys, unlocked by a passkey (WebAuthn PRF) or an 8-digit code (PBKDF2)
  PSBT check and ECDSA signature stay on the phone
        |  NIP-17 gift wrap (the request, not the PSBT)
        v
Nostr relay                          Watch-only coordinator
                                     SQLite ledger, raw tx fetch, no key
                                              |
                                              v
                                        bitcoind regtest
                                     2-of-3, or one officer + assembly after N blocks

Member phone
  Recomputes the link fingerprint, the SHA-256 audit chain,
  the member and change addresses, the witness script,
  and the BIP143 signatures (@noble/hashes, @noble/curves).
  It does not run bitcoind's script flags, and it does not count blocks.
```

The script is `or_d(multi(2,O1,O2,O3),and_v(v:pk(K),and_v(v:multi(1,O1,O2,O3),older(N))))`. Regtest uses N = 10. A real fund would use about 4,320 blocks. That setting was not used.

An approval is a hash of the fields the officer can change. The phone recomputes it before it signs. "Up to" is not "exact."

## Honest security boundary

| What was observed | The limit |
| --- | --- |
| bitcoind refused one signature | Local regtest, Bitcoin Core 32.1. Not mainnet. Two officers who agree can spend. That is the rule. |
| The officer's phone refused a swapped recipient before signing (`PSBT_MISMATCH`) | A patched phone can skip the check. The script still requires two keys. |
| bitcoind refused recovery before 10 blocks (`non-BIP68-final`), then accepted it | Only for the N the fund was created with. |
| A member phone verified the witness and the audit chain locally | It does not re-run bitcoind. Confirmations on screen are the coordinator's number. A rewritten audit chain from a new genesis still matches. |
| The server holds no key | Creating a fund and adding a member are unauthenticated. The fund id is the capability. Money still needs two signatures. |

Not claimed: an audit, mainnet, Lightning, Mobile Money, or publisher authentication on the demo relay. The public demo is one origin, [102-68-84-31.sslip.io](https://102-68-84-31.sslip.io/). `/v1/health` was ok on 18 Nov 2026. The relay on that origin accepts any publisher.

A server that enforces the second approval can be changed. A pot that sits on one node for the length of a payment is a pot that node holds. This fund is a script. Nobody holds it.

## Verification evidence

Recorded 17 Nov 2026 on this machine. Bitcoin Core 32.1. Docker was not installed, so `pnpm e2e` used host bitcoind and printed that.

| Command | Result |
| --- | --- |
| `pnpm test` | core 30, coordinator 11, nostr 2. Exit 0. They do not start bitcoind. |
| `pnpm typecheck` | Exit 0. |
| `pnpm build:web` | Vite 8.3.8, the build the VPS served on 18 Nov. Signing chunk `pinpad-UlJSUC62.js`, 730.52 kB, gzip 228.01 kB. Proof chunk `phone-CaqK5Sdg.js`, 116.76 kB, gzip 39.85 kB. Homepage chunk `Home-BmW8gNjq.js`, 26.63 kB, gzip 8.92 kB. `/` and `/fonds/:id` do not load the signing chunk. On 20 Nov the live files are `pinpad-Difj8dNP.js`, `phone-qFFKknIn.js`, `Home-D2DVLkdO.js`. Gzip for that build was not recorded. |
| Slow 3G, headless Chromium, CPU ×4, cache off, 390×844, one run, 18 Nov 2026 | Local `vite preview`. `/` visible 3,882 ms, 109,610 bytes. `/fonds/:id` 4,258 ms, 142,007 bytes, unknown fund, screen was "Fund not found". `/app` 9,283 ms, 372,751 bytes, signing chunk's last byte at 8,616 ms. Not a handset. The first run, before the homepage redesign: 3,839 ms / 109,054, 4,249 ms / 140,460, 8,781 ms / 370,383. |
| Same throttle, one run, 20 Nov 2026, against the live origin | Emulation in headless Chromium on this Mac, on top of the real trip to the VPS. Not a mid-range Android, and nobody used it unaided. `/` 4,362 ms, 114,736 bytes. `/fonds/:id` 4,992 ms, 147,042 bytes, unknown fund. `/app` 10,335 ms, 396,046 bytes. Signing chunk `pinpad-Difj8dNP.js` last byte at 10,079 ms. `/` and `/fonds/:id` did not load it. |
| `pnpm ui-walk` | Local, 20 Nov 2026: 390×844 in 33.3s, 360×740 in 33.4s. Hosted the same day, `KOINON_WEB=https://102-68-84-31.sslip.io`, 390 only, Playwright reported 1.3 min. One 15,000 F hall rental through the member receipt. Spend tx `af6218e4f4d6a14e1257da36c96e4f9574f741e477abc470bc69a09d48056b11` on fund `965a6c0b-0e74-417f-817d-b8d1775dfe5a`. The proof endpoint then returned 14 confirmations; the run also mined the recovery delay, and the chain is shared. 360 was not run against the host. 17 Nov, older walkthrough: 39.2s and 39.8s. |
| `pnpm e2e` | 10 checks passed on this Mac. The tenth is the log line. CI counted nine checks inside Compose and scanned container logs separately. Exit 0. Spend tx `cccd0cc38c17c5ff889f9e58402c04f492cfca8827dd2fe3d46a618b13651bbd`. Recovery tx `5a6995f9f959071643c74e1820b68d812841621bba8e5623a30b99174c1a37bf`. |

Earlier the same day, and still in the README: one signature `NULLFAIL`; two signatures tx `9f9144009c779907d8048f34a336dea3398251b595ee2846d6a502f127aa1728`; path B after 10 blocks tx `318088820b2e9e0e1f52565c21f733d3e96f88375804bbdd6ae5632d0ad880d9`. GitHub Actions run [44156940764](https://github.com/datharnu/koinon/actions/runs/44156940764) passed before the member-proof tests. It has not run the Playwright spec.

## What's next

1. A real mempool.space price, shown next to the fixture.
2. N at about 4,320 blocks, after the 10-block proof is boring.
3. Someone other than the author reads the script. Then a conversation about mainnet. Not before.
4. Lightning stays out. A node that receives into a channel holds the coins. The point of this fund is that nobody holds the pot.
5. An assistant stays out. It would talk about a spend. It would not be the thing that refuses one.
6. A Mobile Money bridge, including a cash-in in front of the fund, waits until a pilot trusts the script. The bridge would not replace the two signatures.

## Reach

Zero associations use Koinon. That number stays zero.

The pool, not a user count: more than 2,500 solidarity funds, more than 80,000 members, 95% women, 13 regions. Minister Alioune Dione, National Solidarity Fund day in Thiès, reported by APS on 19 Feb 2025. The APS page returned 404 when fetched on 18 Nov 2026. The same dispatch is on [Leral](https://www.leral.net/Plus-de-2-500-calebasses-de-solidarite-denombrees-a-travers-le-pays_a377683.html). Members pool a fund and make interest-free loans. This is not a census of tontines or GIEs, and it is not evidence that a treasurer stole.

## Pilot targets

These are targets. Current traction is zero associations.

| Metric | Now | Target |
| --- | --- | --- |
| Associations onboarded | 0 | First conversations with dahiras, GIEs, and clubs that already collect a monthly pot |
| Median time from request to the second signature | not measured | Same day |
| Tampered or one-signature attempts blocked | the regtest refusals above | Every one the phone or bitcoind actually sees |
| Member links opened with a matching fingerprint | not measured outside this demo | The link that ends with `#`, checked on the phone |

## License and team

MIT. `LICENSE`. Copyright 2026 Koinon contributors. Put the team names and handles on Devpost. They are not in the repo.

## Demo video — 2:15

The cut, the voiceover, the French subtitles and the re-record steps are in [`docs/VIDEO.md`](VIDEO.md). `node scripts/record-demo.mjs` records the takes from the local stack. `node scripts/build-video.mjs` cuts them to `.video/koinon-demo.mp4` and refuses to finish over 3:00.

Order: the problem and who it is for, with "zero associations use Koinon" said out loud. Then the rule, one `pnpm e2e` run, the fund on two phones (regtest said before the first spend), two refusals in the refusing party's own words, the 15,000 F spend (38,113 sats on screen), the member check on a phone, the early recovery refused, and the README limits and next steps.

The voice in the file is a neural narrator, not a person. A recording of your own voice is better for the judges (`--voiceover`, see `docs/VIDEO.md`). Upload both `.srt` files with the video.
