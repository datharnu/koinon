# Koinon — Devpost draft

Paste the sections below. The video script is at the end. Regtest only. Team names are not in the repository yet.

## Problem

A Senegalese association, dahira, or GIE often keeps its monthly pot in one person's Wave account. If that treasurer disappears, or simply decides to, the money is gone. The members find out when they ask.

A shared treasury has to sit for months. It is not a payment that lasts a few seconds. If a server, or one officer, can move it, the association does not hold it.

## What it does

Koinon lets the association hold that pot in a 2-of-3 Bitcoin script with a delayed assembly recovery. Neither the treasurer nor the server can move a franc alone. A spend needs two officers, each signing on their own phone. After a delay, one officer plus the assembly key can recover a coin. Every member opens a link and checks, on that phone, which two keys signed. The check reads the Bitcoin transaction. It does not ask the database who signed.

The phone is a wallet. It derives BIP39 keys on `m/48'/1'/0'/2'`, builds the P2WSH script, checks the PSBT against the request the officer read, and signs. The coordinator is watch-only. It never receives a mnemonic.

Francs on screen come from a rate. In every recorded run that rate was a fixture of 60,000 EUR, and the server said so. A missing rate is a refusal. 1,000 XOF locked at 2,541 sats. Those sats are regtest. They have no value.

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

Not claimed: an audit, mainnet, Lightning, Mobile Money, a public relay that authenticates publishers, or a spend a judge can broadcast from the Vercel site. `https://koinon-ten.vercel.app` is the static homepage. `GET /v1/health` there is 404.

A server that enforces the second approval can be changed. A pot that sits on one node for the length of a payment is a pot that node holds. This fund is a script. Nobody holds it.

## Verification evidence

Recorded 17 Nov 2026 on this machine. Bitcoin Core 32.1. Docker was not installed, so `pnpm e2e` used host bitcoind and printed that.

| Command | Result |
| --- | --- |
| `pnpm test` | core 30, coordinator 10, nostr 2. Exit 0. They do not start bitcoind. |
| `pnpm typecheck` | Exit 0. |
| `pnpm build:web` | Vite 8.3.8. Signing chunk `pinpad-BoxGhd4s.js`, 730.43 kB, gzip 227.98 kB. Proof chunk `phone-z1fi-Luk.js`, 114.90 kB, gzip 39.26 kB. `/` and `/fonds/:id` do not load the signing chunk. |
| Slow 3G, headless Chromium, CPU ×4, cache off, 390×844, one run | `/` visible 3,839 ms, 109,054 bytes. `/fonds/:id` 4,249 ms, 140,460 bytes, unknown fund, screen was "Fund not found". `/app` 8,781 ms, 370,383 bytes, signing chunk's last byte at 8,586 ms. Not a handset. Not a VPS. |
| `pnpm ui-walk` | Playwright. 390×844 passed in 39.2s. 360×740 passed in 39.8s. 2 passed. Create, one-signature refusal, tampered PSBT, two-signature spend, member witness check, early recovery refusal, mine 10, `Awa · recovery`. |
| `pnpm e2e` | 10 checks passed. Exit 0. Spend tx `cccd0cc38c17c5ff889f9e58402c04f492cfca8827dd2fe3d46a618b13651bbd`. Recovery tx `5a6995f9f959071643c74e1820b68d812841621bba8e5623a30b99174c1a37bf`. |

Earlier the same day, and still in the README: one signature `NULLFAIL`; two signatures tx `9f9144009c779907d8048f34a336dea3398251b595ee2846d6a502f127aa1728`; path B after 10 blocks tx `318088820b2e9e0e1f52565c21f733d3e96f88375804bbdd6ae5632d0ad880d9`. GitHub Actions run [44156940764](https://github.com/datharnu/koinon/actions/runs/44156940764) passed before the member-proof tests. It has not run the Playwright spec.

## What's next

1. One domain for the site, `/v1`, and the relay. A passkey is bound to one domain. Vercel cannot proxy the API or the socket.
2. A real mempool.space price, shown next to the fixture.
3. N at about 4,320 blocks, after the 10-block proof is boring.
4. Someone other than the author reads the script. Then a conversation about mainnet. Not before.
5. Lightning stays out. A node that receives into a channel holds the coins. The point of this fund is that nobody holds the pot.
6. An assistant stays out. It would talk about a spend. It would not be the thing that refuses one.
7. A Mobile Money bridge, including a cash-in in front of the fund, waits until a pilot trusts the script. The bridge would not replace the two signatures.

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

## Demo video — about 2 minutes 50 seconds

Record against the local stack, or the VPS once it exists. Do not record a spend on the Vercel URL. That host has no `/v1`. Say "regtest" once, out loud, before the first spend.

| Time | Shot | Say |
| --- | --- | --- |
| 0:00–0:20 | A Wave-style balance with one name on it. Cut to three people and a pot. | A treasurer who holds the association's pot can empty it. The members find out when they ask. The pot has to last for months, and no one person should be able to move it. |
| 0:20–0:45 | `/app`. Create the fund. Type the 8-digit code. Land on the home screen: 12 members, francs, "regtest". | This phone creates the fund. Three officers. Twelve members. The keys stay on the phone. The server does not get them. |
| 0:45–1:05 | Test network. "Ibou spends alone." Blocked. Show the raw line. | One signature. Bitcoin refuses it. The screen is not the guard. The node is. |
| 1:05–1:25 | "The server swaps the recipient." Blocked. `PSBT_MISMATCH`. | The request said one address. The transaction pays another. Coumba's phone refuses before it signs. |
| 1:25–1:50 | Ibou requests 15,000 F, hall rental. Coumba approves. Ibou sends. Mine one block. The row shows Ibou + Coumba. | Two officers sign. Then it confirms. Neither of them could have done this alone. |
| 1:50–2:15 | Open the member link. The card says the link matches, the audit count, the addresses. Tap the spend. The sheet names Ibou + Coumba, the script, the sats, and the sentence about Bitcoin bytes. | A member has no key and no account. This phone checked the transaction itself. The database did not tell it who signed. |
| 2:15–2:35 | "Recover too early." Blocked, `non-BIP68-final`. Mine 10. The row says Awa · recovery. | The assembly path is real, and it is late on purpose. Too early, Bitcoin refuses. After the delay, one officer and the assembly can recover. |
| 2:35–2:50 | The README limits, then the four next steps. | This is regtest. The price was a fixture. Nobody has audited it. Zero associations use it. Next is one public domain, a real price, a longer delay, and a second pair of eyes before mainnet. Lightning would put the pot on a node. We did not build that. |

Cut anything that makes it longer than three minutes. The refusal shots matter more than the create shot.
