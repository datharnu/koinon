<div align="center">

<img src="apps/web/public/favicon.svg" width="72" height="72" alt="Koinon logo" />

# Koinon

**The treasurer of a shared fund cannot move the money alone.**

[Site](https://102-68-84-31.sslip.io) · [Watch the film (2:15)](docs/media/koinon-demo.mp4) · [Demo](https://102-68-84-31.sslip.io/app) · [Run it](#getting-started) · [What works today](#status) · [The proof](#evidence) · [Policy](docs/POLICY.md)

<a href="https://102-68-84-31.sslip.io/app"><img alt="Network: Bitcoin regtest" src="docs/badges/network.svg" /></a>
<img alt="Bitcoin: Core 32.1" src="docs/badges/bitcoin.svg" />
<img alt="Script: 2-of-3 + CSV" src="docs/badges/script.svg" />
<img alt="Messages: Nostr NIP-17" src="docs/badges/nostr.svg" />
<img alt="Mainnet: after audit" src="docs/badges/mainnet.svg" />
<a href="LICENSE"><img alt="License: MIT" src="docs/badges/license.svg" /></a>

<p align="center">
  <a href="docs/media/koinon-demo.mp4"><img src="docs/media/film-poster.jpg" width="820" alt="Watch the Koinon film, 2 minutes 15. Recorded 18 Nov 2026 from the local app: two phones, a 60,000 F fund, the refusals, the member check, and the README limits. Regtest. The voice is a neural draft, not a person." /></a>
</p>

The public demo is Docker Compose on a Nigeria VPS. Caddy serves the homepage, `/app`, `/v1`, and `/relay` on one HTTPS origin. The spend rule runs on regtest, Bitcoin Core 32.1. It did not run on mainnet. The film was recorded 18 Nov 2026 from the local app, not from the VPS. It is not a mainnet payment.

</div>

<a id="summary"></a>

## The 60-second summary

Two of three officers must sign, from their own devices, before a satoshi leaves the fund. The rule is a Bitcoin script. A one-signature transaction is refused by bitcoind, not by a screen. Spend requests travel as encrypted Nostr messages. Members read contributions and spends in CFA francs. The server holds no private key.

On 17 Nov 2026, 1,000 XOF locked at 2,541 sats. The euro price in that run was a fixture of 60,000, not a market price. One signature was rejected. Two signatures were accepted.

| What was measured | Result | Where |
| --- | --- | --- |
| 1 officer signature | bitcoind refused it, `NULLFAIL` | `pnpm kill-test`, regtest |
| 2 officer signatures | accepted, 1 confirmation | tx `9f9144009c779907d8048f34a336dea3398251b595ee2846d6a502f127aa1728` |
| Path B before 10 blocks | bitcoind refused it, `non-BIP68-final` | same command |
| Path B after 10 blocks | accepted, 1 confirmation | tx `318088820b2e9e0e1f52565c21f733d3e96f88375804bbdd6ae5632d0ad880d9` |
| 1,000 XOF at the fixture | 2,541 sats, then a confirmed spend | `pnpm e2e`, later run the same day, tx `cccd0cc38c17c5ff889f9e58402c04f492cfca8827dd2fe3d46a618b13651bbd` |

> **The script is the guard.** The coordinator can build a transaction. It cannot make bitcoind accept one signature, and an officer's own check refuses a transaction that no longer matches the request.

| What has been observed | Where the boundary is |
| --- | --- |
| bitcoind rejected 1 signature and accepted 2 | Local regtest, Bitcoin Core 32.1, not mainnet |
| bitcoind rejected path B, then accepted it after 10 blocks | `N` is 10 on regtest. A real fund would set about 4,320 blocks. That setting was not used |
| A swapped recipient was refused before any signature | The officer's function. The coordinator is not trusted for this check |
| 12 members, a confirmed spend, an expired request, and a broken audit row | `pnpm e2e` on this Mac, without Docker. The public host is that compose file. `/v1/health` was ok on 18 Nov 2026. This checklist was not re-run there |
| Gift-wrapped request and approval | Loopback relay for this check. It does not authenticate publishers. The VPS serves the same relay at `/relay`, and it accepts any publisher |
| A member phone can recompute the audit chain and a spend's signatures from the raw transaction | `@noble/hashes` and `@noble/curves` in the browser. It does not run bitcoind's script flags, and it does not count blocks |

The phone is a Bitcoin wallet. It derives BIP39 keys on `m/48'/1'/0'/2'`, builds the P2WSH 2-of-3 plus CSV script, checks the PSBT, and signs. The coordinator never receives the mnemonic. There is no Lightning wallet here. A Lightning node that receives for the fund would hold the pot. This fund is meant to sit for months in a script nobody holds.

| Devpost criterion | What to look at | Limit |
| --- | --- | --- |
| Usefulness and local impact | A dahira, a GIE, or a club whose treasurer can empty the Wave account today. The member link shows the pot in francs. [Section 3](#who) cites more than 2,500 solidarity funds. | Zero associations are using it. The 2,500 is the minister's figure (APS, 19 Feb 2025), not a census and not a user count. The rows below are targets, not traction. |
| Security by design | bitcoind refuses one signature. The officer's phone refuses a swapped recipient. The member's phone checks the witness. | Regtest. No audit. Two officers who agree can spend. |
| UX and UI on a slow phone | `/` and `/fonds/:id` do not load the signing code. The measured times are in [Evidence](#evidence). | One headless Chromium on this Mac, not a handset and not the VPS. |
| Working MVP | [Live demo](https://102-68-84-31.sslip.io/app), `pnpm e2e`, or Compose from [docs/DEPLOY.md](docs/DEPLOY.md). | Regtest faucet. Not mainnet. |
| Clear pitch and docs | This page, [docs/POLICY.md](docs/POLICY.md), [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md). | Team names are not in the repo. The license is MIT. |

The rubric is on [the Devpost page](https://dakar-bitcoin-hack-2026.devpost.com/). This table is a map to that page. It is not a score. The paste-ready write-up and the demo shot list are in [docs/SUBMISSION.md](docs/SUBMISSION.md).

| Pilot metric | Now | Target, not a result |
| --- | --- | --- |
| Associations onboarded | 0 | First conversations with dahiras, GIEs, and clubs that already collect a monthly pot |
| Median time from request to the second signature | not measured | Same day |
| Tampered or one-signature attempts blocked | the regtest refusals in the table above | Every one the phone or bitcoind actually sees |
| Member links opened with a matching fingerprint | not measured outside this demo | The link that ends with `#`, checked on the phone |

**Everything here runs on regtest. Those sats have no value.** A live price from mempool.space was requested once and timed out. The server returned `RATE_UNAVAILABLE` and did not invent a price.

The film is [Watch the film (2:15)](docs/media/koinon-demo.mp4). It was recorded 18 Nov 2026 from this app. The voice is a neural draft, not a person. The shot list is [docs/VIDEO.md](docs/VIDEO.md).

<a id="looks"></a>

## What the demo looks like

The homepage says "Nobody empties the fund alone." Main button: "Try the demo."

- One expense, start to finish: Ibou asks for 15,000 F for the hall rental. The request reads "1 of 2 approvals. No money has moved." He tries to pay with only his signature and Bitcoin Core refuses. "Switch to Coumba to approve" hands her the same request; she sees recipient, amount, and locked rate, then Approve. "Mine a block to confirm (test network)" sits beside the pending payment. After it: "Paid. The transaction is in a block." and "Open the member receipt".
- A swapped payee stops before signing: `PSBT_MISMATCH`, "the transaction does not pay the requested recipient."
- Invite link for WhatsApp. No account and no key. The sheet says "Checked on this phone from Bitcoin bytes, not from the server's database," and names Ibou + Coumba only when the link fingerprint matches.
- French and English switch in the header. Playwright passed at 390×844 (33.3s) and 360×740 (33.4s) on 20 Nov 2026, headless Chromium on this Mac, not a handset.
- Signing code loads only on `/app`. The 18 Nov preview run transferred 372,751 bytes there, 109,610 on `/`, and 142,007 on `/fonds/:id`. The 20 Nov run against the live site is in [Evidence](#evidence).

Live: HostAfrica, Nigeria, one HTTPS origin, `/v1/health` ok on 18 Nov 2026 and again on 20 Nov 2026.

<a id="demo"></a>

## Demo

**One URL for judges, Devpost, and this README** — same origin for the pitch and the working app:

| Page | Link |
| --- | --- |
| Homepage | [https://102-68-84-31.sslip.io/](https://102-68-84-31.sslip.io/) |
| Two-phone demo | [https://102-68-84-31.sslip.io/app](https://102-68-84-31.sslip.io/app) |

Caddy serves the built `apps/web` static files and proxies `/v1` and `/relay` to the coordinator stack in Docker on that VPS. Passkeys are bound to this hostname, and the Nostr websocket is on the same origin. A static-only host has no `/v1` and no relay, so the interactive demo lives only here.

Health check: [`GET /v1/health`](https://102-68-84-31.sslip.io/v1/health) returned `{"ok":true,"network":"regtest","bitcoind":true,"demo":true}` on 18 Nov 2026, and the same JSON on 20 Nov 2026 after the web image was rebuilt from `a4e1306`.

The 17 Nov script refusals further down were recorded on this Mac. The hosted column in the table is the live site.

**The walkthrough, hosted and local, side by side.** One 15,000 F hall rental carries every step.

| Step | What you do | What you should see | Local, 20 Nov 2026 | Hosted |
| --- | --- | --- | --- | --- |
| 1 signature | Ibou: Spend, Review, Sign and send, View the request, then "Send with only Ibou's signature" | "1 of 2 approvals. No money has moved." then Blocked; See the raw answer shows `NULLFAIL` / `Signature must be zero`; "This request is unchanged" | Passed | Passed. The refusal is not a transaction. |
| Changed payee | Test network, "The server swaps the recipient" | `PSBT_MISMATCH`, naming the same 15,000 F hall rental, unchanged | Passed | Passed. No transaction. |
| 2 signatures | "Switch to Coumba to approve", Approve, Send the transaction, "Mine a block to confirm (test network)" | "2 of 2 approvals.", then "Sent. Waiting for a block, not confirmed yet.", then "Paid. The transaction is in a block." | Passed | Passed. Spend tx `af6218e4f4d6a14e1257da36c96e4f9574f741e477abc470bc69a09d48056b11`. |
| Member receipt | "Open the member receipt" | The proof opens by itself: "Checked on this phone from Bitcoin bytes", Ibou + Coumba, P2WSH 2-of-3 + CSV; "Keys match this link" | Passed | Passed. [The receipt](https://102-68-84-31.sslip.io/fonds/965a6c0b-0e74-417f-817d-b8d1775dfe5a?tx=af6218e4f4d6a14e1257da36c96e4f9574f741e477abc470bc69a09d48056b11#100aff4158ce241ee1fbb0b4453b055a2199eed85d2078b6e050d967bf603bf8). |

Local is `pnpm ui-walk` (Playwright, headless Chromium on this Mac, native regtest, Vite dev server): 390×844 passed in 33.3s and 360×740 in 33.4s. Hosted is the same spec, `KOINON_WEB=https://102-68-84-31.sslip.io`, project 390 only, on 20 Nov 2026: Playwright reported 1.3 min, 1 passed. 360 was not run against the host. The fund is `965a6c0b-0e74-417f-817d-b8d1775dfe5a`. Right after that run, `GET /v1/funds/965a6c0b-0e74-417f-817d-b8d1775dfe5a/proof/af6218e4f4d6a14e1257da36c96e4f9574f741e477abc470bc69a09d48056b11` returned `kind: spend`, `confirmations: 14`, `network: regtest`. The same run also mined the recovery delay, and the chain is shared, so 14 is not one block. Regtest sats have no value. The one-signature try and the swapped payee produced no txid.

**Run the stack without installing Bitcoin Core.** Docker Compose. GitHub Actions runs these commands ([run 44156940764](https://github.com/datharnu/koinon/actions/runs/44156940764)). Without `KOINON_SITE`, open http://127.0.0.1:8000. The public host sets `KOINON_SITE`, as [docs/DEPLOY.md](docs/DEPLOY.md).

```bash
docker compose -f infra/docker-compose.yml up -d --build
docker compose -f infra/docker-compose.yml --profile e2e run --rm e2e
```

`docker compose -f infra/docker-compose.yml down -v` deletes the chain and the keys.

**The 17 Nov script proof, on this Mac.** Bitcoin Core 32.1 on the path, Node 22, pnpm 11.1.2. Docker was not installed for this run.

```bash
pnpm install
pnpm e2e
```

You should see a checklist of `[x]` lines: 12 members, 2,541 sats locked, `PSBT_MISMATCH`, bitcoind's one-signature refusal, a confirmed spend, `REQUEST_EXPIRED`, `non-BIP68-final`, then a recovery after 10 blocks, then an audit that fails after one row is changed. The first lines say the rate is a fixture, not a market price.

If Docker is missing, the script prints that and uses the host node. That is the 17 Nov run.

**No bitcoind.** This does not move money. It does refuse a swapped recipient, and it adds no signature:

```bash
pnpm tamper-test
```

```text
ALLOW honest: fee 1000 change 9000 signed true
REFUSE tampered recipient: PSBT_MISMATCH
signed after refusal: false
```

<a id="contents"></a>

## Contents

1. [The problem](#problem)
2. [The rule](#rule)
3. [Who it is for](#who)
4. [How it works](#how)
5. [What this does not claim](#claims)
6. [Evidence](#evidence)
7. [Decisions](#decisions)
8. [Stack](#stack)
9. [CLI](#cli)
10. [Getting started](#getting-started)
11. [Repo map](#repo)
12. [What works today](#status)
13. [Next](#next)

<a id="problem"></a>

## 1. The problem

A dahira, a GIE, or a sports club in Senegal keeps a shared pot. The treasurer often holds the Wave account. One person can empty it. The argument afterwards is about a balance nobody else can reconstruct.

Multisig already exists. [Liana](https://github.com/wizardsardine/liana), [Nunchuk](https://nunchuk.io/), and [Sparrow](https://sparrowwallet.com/) already do shared keys and timelocks, and they do that job better than this repo as wallets. Koinon is the association workflow around that rule: a CFA ledger, a request an officer can read on their own device, and a recovery path the assembly cannot use early.

No association is using this. The runs below are regtest.

<a id="rule"></a>

## 2. The rule

> **Two officers, or nobody spends.** One officer plus the assembly key spends only after N blocks. The server never holds a key.

- **The script refuses a lone treasurer.** Path A is 2 of 3. The proof is bitcoind's rejection, in [docs/POLICY.md](docs/POLICY.md).
- **The officer refuses a changed payment.** Recipient, amount, change back to the fund, fee cap, and fund inputs are checked before a signature exists. Code: `PSBT_MISMATCH` or `FEE_OVER_CAP`.
- **Recovery waits.** Path B is one officer plus the assembly key, after `OP_CHECKSEQUENCEVERIFY`. Early, bitcoind says `non-BIP68-final`.
- **The CFA figure is frozen when the request is created.** Sats are rounded up so the recipient is not short. A later price does not move that request. If there is no price, the spend is refused.
- **The request is a private message.** NIP-17 gift wrap. The message has no PSBT. The fee cap stays on the officer's machine.

<a id="who"></a>

## 3. Who it is for

| Who | What changes | Where this repo shows it |
| --- | --- | --- |
| Treasurer (O1) | Cannot broadcast alone. Opens a request for an exact CFA amount. | `pnpm e2e`, one signature refused |
| Second officer (O2 or O3) | Signs on their own device, or refuses. One officer can veto. | `attack tamper`, `approve`, `reject` |
| Member | Sees each contribution and spend in XOF. Holds no key. | `status` after `mine` |
| Assembly key (K) | Spends only with one officer, and only after N blocks. Cannot open a normal spend. | `recover` before and after `mine 10` |

Hypothesis, not a measurement: one group has a treasurer who can empty the pot today. Ten such groups would be ten treasurers who cannot. This repository has onboarded zero groups. No city-wide count is used here.

Metrics a pilot would track, and that this repo has not measured: funds onboarded, spends per month, median time from request to the second signature, and requests refused for a mismatch. The measured stand-in is the regtest checklist, not a pilot.

### The problem, sourced

These numbers are why a shared pot is a real object in Senegal. None of them is a count of theft, a count of dahiras, or a Koinon user. The homepage draws three of them, with the same limits: 57.4% of women, more than 2,500 funds, and 24.1% of UEMOA volume. The 42.5% case count and the GIE registrations are in this table only. Read on 18 Nov 2026.

| Figure | What it counts | What it does not count | Source |
| --- | --- | --- | --- |
| 425 of 1,000 cases (42.5%) answered yes | Senegal, Global Findex 2025 microdata, survey year 2024. Question fin17c: saved in the past 12 months using an informal savings group or club, or a person outside the family. | A population estimate. The file says the case counts are not summary statistics of the population. The question is wider than a tontine. | [World Bank microdata, fin17c](https://microdata.worldbank.org/catalog/7971/variable/F1/V64?name=fin17c) |
| Women 57.4%, adults 43.5%, men 28.3%. 2014: 28.6% | EFA Études' weighting of that Findex file, published 23 Oct 2026. Senegal, adults 15 and over. | The unweighted 42.5%. A gap under 3 points is not significant in a survey of about 1,000. The page does not publish the years between 2014 and 2024, and says one jump is not a trend. | [EFA, La tontine en chiffres](https://efa.africa/etude-tontine-en-chiffres) |
| Senegal 24.1% of UEMOA e-money transaction volume in 2024 (22.7% in 2023). Value share 30.2% (29.9% in 2023). Volume up 24.79% | BCEAO, annual report on digital financial services in the UEMOA for 2024, file dated March 2026. §59 is volume, §60 is value, §34 is the growth. The same report's union total is 11 billion transactions and 160,415 billion CFA francs. The other 2024 shares in §59: Côte d'Ivoire 21.4%, Benin 21.4%, Burkina Faso 18.2%, Mali 10.7%, Togo 3.2%, Guinea-Bissau 0.7%, Niger 0.6%. | Money held by associations. An e-money account still has one holder. Another BCEAO document gives a different union value; it is not blended here. | [BCEAO PDF](https://www.bceao.int/sites/default/files/2026-03/Rapport%20annuel%20sur%20les%20services%20financiers%20num%C3%A9riques%20dans%20l%27UEMOA%20-%202024.pdf) |
| More than 2,500 solidarity funds, more than 80,000 members, 95% women, 13 regions | Minister Alioune Dione, National Solidarity Fund day in Thiès, reported by APS on 19 Feb 2025. Members pool a fund and make interest-free loans. | A census of tontines or GIEs. Not evidence that a treasurer stole. The APS page returned 404 when fetched on 18 Nov 2026; the same dispatch is on Leral. | [Leral, carrying APS, 19 Feb 2025](https://www.leral.net/Plus-de-2-500-calebasses-de-solidarite-denombrees-a-travers-le-pays_a377683.html) |
| 6,869 / 6,674 / 6,857 GIE registrations in 2022 / 2023 / 2024 | APIX national RCCM table, row "Immatriculation GIE". Registrations that year. | The stock of GIEs. The same page's APIX-office row is a different count: 1,314 / 1,208 / 1,071. A 2025 column is on the page (6,594 national, 949 at the office). The page does not say that year is complete, so it is left off the chart. | [APIX, création d'entreprise](https://investinsenegal.sn/services/creation-dentreprise/) |

### What this is not

A shared Wave or Orange Money account. A server that can approve a spend. Lightning, a hold invoice, or a node that receives the pot. An assistant, or a Wolof interface. Mainnet, or an audit. A defence against two officers who agree to sign. The longer table is [What this does not claim](#claims).

<a id="how"></a>

## 4. How it works

| Part | What it does | Code |
| --- | --- | --- |
| Policy | Builds the witness script and the PSBT. Does not trust the server. | [packages/core](packages/core) |
| Coordinator | Watch-only. Members, ledger, requests, audit. No private key. | [apps/coordinator](apps/coordinator) |
| Nostr | Gift-wraps the request and the approval. | [packages/nostr](packages/nostr) |
| CLI | The demo. French by default, `--lang en`. | [apps/cli](apps/cli) |
| Regtest | bitcoind. The thing that accepts or refuses. | [scripts/regtest.ts](scripts/regtest.ts) |

<p align="center">
  <a href="docs/diagrams/koinon-architecture.excalidraw"><img src="docs/diagrams/koinon-architecture.svg" alt="The big picture. The treasurer signs on the phone; the key stays there. The secretary rebuilds the transaction and refuses a changed payee with PSBT_MISMATCH before signing. The request is a NIP-17 gift wrap with no PSBT, carried by a relay that accepts any publisher. A watch-only coordinator on 102-68-84-31.sslip.io has no private key. The screen shows CFA francs from a 60,000 EUR fixture. It broadcasts to bitcoind, Bitcoin Core 32.1, local regtest: P2WSH, 2 of 3, plus CSV. On 17 Nov 2026, pnpm kill-test: two signatures accepted, one signature NULLFAIL, path B non-BIP68-final before 10 blocks, then one officer and the assembly accepted after the delay. N is 10. About 4,320 was not used. The member's phone checks the raw transaction. It does not run bitcoind's script flags and does not count blocks. Two officers who agree can spend. Sats have no value." width="100%" /></a>
  <br/><sub>The big picture. Source: <a href="docs/diagrams/koinon-architecture.excalidraw"><code>docs/diagrams/koinon-architecture.excalidraw</code></a> (open it at excalidraw.com). The same path, as a sequence, is below. Regtest. Sats have no value. About 4,320 blocks was not used.</sub>
</p>

```mermaid
flowchart TB
  keys["Officer phone: BIP39, BIP48, WebAuthn or an 8-digit code"]
  keys --> wrap["NIP-17 gift wrap"]
  wrap --> relay["Nostr relay"]
  keys --> sign["PSBT check and signature, on the phone"]
  sign --> coord["Watch-only coordinator"]
  coord --> node["bitcoind: 2-of-3 and a delayed assembly path"]
  member["Member phone"] --> coord
  member --> local["Audit chain, script, and BIP143, on the phone"]
```

The member does not sign. The relay carries the request, not the authority to spend. The coordinator can hand the phone a raw transaction. It cannot make a bad signature verify. bitcoind accepts the transaction or it does not. The CLI follows the same path without the screen.

```mermaid
sequenceDiagram
  participant O1
  participant Coord as Coordinator
  participant O2
  participant Node as bitcoind
  O1->>Coord: Create request, CFA amount
  Coord-->>O1: Locked sats, unsigned PSBT
  O1->>O1: Check the PSBT
  O1->>Coord: First signature
  O1->>O2: Gift wrap, no PSBT
  O2->>O2: Check recipient, amount, change, fee
  O2->>Coord: Second signature
  Coord->>Node: sendrawtransaction
  Node-->>Coord: txid, or a refusal
```

> [!IMPORTANT]
> A displayed balance is not a spend. Status stays pending until two signatures exist, broadcast until bitcoind accepts the transaction, and confirmed only after the indexer sees it in a block.

<a id="claims"></a>

## 5. What this does not claim

| Claim | Because | Limit |
| --- | --- | --- |
| One officer cannot spend | bitcoind rejected the one-signature witness | Two officers who agree can spend. That is the rule. |
| An officer does not sign a swapped payment | `verifySpend` throws before `signVerifiedSpend` adds a signature | The officer must run that check. A patched client can ignore it. The script still requires two keys. |
| Recovery cannot happen early | bitcoind returned `non-BIP68-final` | Only for the `N` the fund was created with. Regtest uses 10. |
| The server has no key | Keys are encrypted on the officer's machine. The process has no key file. | Fund creation and member add are unauthenticated. The fund id is the capability. Money still needs two signatures. |
| Logs omit the person | The Mac e2e scan found no pseudonym, seed word, `xprv`, `nsec1`, pin, or PSBT. CI run 44156940764 passed the same scan | Run 44310515954 reported a seed hit. The word was `act` inside `transaction`. The scan now requires two adjacent words. One word alone is not a hit. |
| The CFA amount is the one they approved | Sats and the rate are stored on the request | The euro input was a fixture of 60,000, or a test double of the same number. Not a live market price. |
| A 5,000 F due is not eaten by the fee | At the 60,000 EUR fixture, 5,000 F is 12,705 sats. A P2WPKH→P2WSH landing is ~122 vbytes. At 2 sat/vB that is 244 sats, 96 F, paid by the member's wallet, not subtracted from the due. At 5 sat/vB, 240 F. | This is an association treasury, not a 500 F weekly tontine. A spend of one 2-of-3 input with change, at 2 sat/vB, is 600 sats (236 F) from `estimateVbytes(1, 2)` in `packages/core/src/coinselect.ts`. |

Not claimed: mainnet, an audit, Lightning, Mobile Money, collusion protection, or publisher authentication on the demo relay. The VPS serves that relay at `/relay`. It accepts any publisher. A static file host has no `/v1` and no relay socket. Docker Compose is the public demo: Caddy on the HostAfrica VPS, one origin. `/v1/health` was ok on 18 Nov 2026. The same file ran in GitHub Actions ([run 44156940764](https://github.com/datharnu/koinon/actions/runs/44156940764)): nine checks inside Compose, and the container log scan as its own step. Both passed. A later run, [44310515954](https://github.com/datharnu/koinon/actions/runs/44310515954) on 18 Nov 2026, failed that scan because one seed word matched inside an ordinary word. The scan now requires two adjacent words. The failure is kept in [docs/DEFERRED.md](docs/DEFERRED.md). The bitcoind refusals in Evidence are `pnpm kill-test` and `pnpm e2e` on this Mac, where Docker was not installed.

Review: none. No third party has read this. The severities in [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) are the author's.

The price feed is mempool.space when `MEMPOOL_PRICES_URL` is left at the default. This machine did not get an answer. The demo points that URL at a fixture. A missing price is a refusal, not a guessed rate.

<a id="evidence"></a>

## 6. Evidence

Recorded 17 Nov 2026 on this machine. Bitcoin Core 32.1. Long output is in [docs/DEFERRED.md](docs/DEFERRED.md) and [docs/POLICY.md](docs/POLICY.md). Regtest txids are not on a public explorer.

| Command | What it showed |
| --- | --- |
| `pnpm kill-test` | 1 signature refused. 2 signatures accepted, tx `9f9144009c779907d8048f34a336dea3398251b595ee2846d6a502f127aa1728`. Path B refused, then accepted after 10 blocks, tx `318088820b2e9e0e1f52565c21f733d3e96f88375804bbdd6ae5632d0ad880d9`. |
| `pnpm tamper-test` | Swapped recipient, `PSBT_MISMATCH`, no signature added. No bitcoind. |
| `pnpm coordinator-spend` | Live price timed out, `RATE_UNAVAILABLE`. A labeled test double then spent. tx `057ec038f9356186151ab9fc7498e1541c9ec00c7e76a879d90ed3f8eb980bda`. |
| `pnpm nostr-test` | Gift wrap delivered. Ciphertext had no purpose. Tamper produced no approval. |
| `pnpm cli-demo` | The officer path, a veto, and recovery. Recovery tx `6c1ccaa39387ef08ccdfcdd1547fd4c877594e430b23db9d21d3d4d298ab68f7`. |
| `pnpm e2e` | Re-run the same day, host bitcoind, Docker not installed. 10 checks passed. The tenth is the log line on this Mac. CI's nine checks are that list without the log line. CI scans container logs as a separate step. 1,000 XOF locked at 2,541 sats. Spend tx `cccd0cc38c17c5ff889f9e58402c04f492cfca8827dd2fe3d46a618b13651bbd`. Recovery tx `5a6995f9f959071643c74e1820b68d812841621bba8e5623a30b99174c1a37bf`. An earlier run the same day: spend `ccc8f9dd877540679e3db141754cb374a65c71416e12e8c25863fd0a0acc2865`, recovery `7f50d10e467ee5ccb5342c6de9cbb863c9a817d410cb7a39ee448ef150037cc1`. |
| `pnpm test` | Current: core 30, coordinator 11, nostr 2. They do not start bitcoind. Earlier the same day: core 22, coordinator 2, nostr 2. At the script proof: 7. |
| `pnpm ui-walk` | Playwright, one worker, against `http://localhost:5173` and the host coordinator. 20 Nov 2026, one 15,000 F hall rental from the one-signature refusal to the member receipt: 390×844 passed in 33.3s, 360×740 in 33.4s. The first run that day failed in the test itself (two Close buttons on the proof sheet), not the app. On 17 Nov the older walkthrough passed in 39.2s and 39.8s. The fund was created with an 8-digit code. |

`pnpm test` earlier the same day, at the script proof, was 7. That count is kept in [docs/POLICY.md](docs/POLICY.md). The later count does not erase it.

GitHub Actions: [run 44156940764](https://github.com/datharnu/koinon/actions/runs/44156940764). Unit tests and the compose e2e passed: nine checks inside Compose, then the container log scan. The live site is the web build, not that run. That run does not include the member-proof tests added after it. [Run 44310515954](https://github.com/datharnu/koinon/actions/runs/44310515954), 18 Nov 2026, failed the log scan on a one-word substring. The scan now requires two adjacent words.

`pnpm build:web` on this machine, Vite 8.3.8, then one cold load in headless Chromium. Cache off. Latency 400 ms. Download and upload 400 × 1024 / 8 bytes per second. CPU throttle 4. Viewport 390×844. The server was `vite preview` on `127.0.0.1:4173`. This is not a phone and not a VPS. Time is until the route's own text was on screen. Transfer is `transferSize`, which includes headers.

| Route | Visible | Transfer | What loaded |
| --- | --- | --- | --- |
| `/` | 3,882 ms | 109,610 bytes | Entry, home, avatar, CSS. No signing code. |
| `/fonds/:id` | 4,258 ms | 142,007 bytes | Those, plus the proof chunk. No signing code. The fund id was unknown, so the screen was "Fund not found". |
| `/app` | 9,283 ms | 372,751 bytes | Those, plus the proof and signing chunks. The signing chunk's last byte was at 8,616 ms. No coordinator was running behind `vite preview`. |

Measured 18 Nov 2026 on the build the VPS served that day: `index-DNZNbqZM.js`, `Home-BmW8gNjq.js`, `phone-CaqK5Sdg.js`, `pinpad-UlJSUC62.js`. The first run, before the homepage redesign, was `/` 3,839 ms and 109,054 bytes, `/fonds/:id` 4,249 ms and 140,460 bytes, `/app` 8,781 ms and 370,383 bytes.

The same script, one run, 20 Nov 2026, with `KOINON_PREVIEW=https://102-68-84-31.sslip.io`. Headless Chromium on this Mac. Cache off. The browser added 400 ms of latency and a cap of 400 × 1024 / 8 bytes per second, each way, on top of the real trip to the VPS. CPU throttle 4. Viewport 390×844. This is emulation, not a mid-range Android, and nobody used the site unaided.

| Route | Visible | Transfer | What loaded |
| --- | --- | --- | --- |
| `/` | 4,362 ms | 114,736 bytes | `index-Ckxcu5ob.js`, `Home-D2DVLkdO.js`, avatar, CSS. No signing code. |
| `/fonds/:id` | 4,992 ms | 147,042 bytes | Those, plus `phone-qFFKknIn.js` and `MemberView-DDTSf4YS.js`. No signing code. Unknown fund id. |
| `/app` | 10,335 ms | 396,046 bytes | Those, plus `Demo-Dvbt6al3.js` and `pinpad-Difj8dNP.js`. The signing chunk's last byte was at 10,079 ms (244,021 bytes transferred). |

Vite's own size lines for that build: signing chunk `pinpad-UlJSUC62.js` 730.52 kB raw, 228.01 kB gzip. Proof chunk `phone-CaqK5Sdg.js` 116.76 kB raw, 39.85 kB gzip. Homepage chunk `Home-BmW8gNjq.js` 26.63 kB raw, 8.92 kB gzip. An earlier build was 708 kB raw, 228 kB gzip for the signing code, and that file loaded on `/fonds` as well. It no longer does. Fonts and the homepage hero image were not in the transfer at the moment the text appeared. The script is `scripts/measure-web.mjs`. One run each. A few milliseconds of noise is expected if this is run again.

<a id="decisions"></a>

## 7. Decisions

<details>
<summary><strong>The first 2-of-3 was rejected, and the fix stayed visible.</strong></summary>

CHECKMULTISIG pops the later signature first. The first witness stacked the earlier signature on top, so bitcoind returned the same NULLFAIL as a one-signature spend. The one-signature refusal on that run was already correct. The order was fixed in `packages/core/src/witness.ts` on 17 Nov 2026. The comment records the old order. [docs/DEFERRED.md](docs/DEFERRED.md) still starts with that failure.

</details>

<details>
<summary><strong>The miniscript compiler is used. Its satisfier is not.</strong></summary>

The expression repeats the officer keys, so the compiler reports the script unsane and the satisfier will not build a witness. The script bytes still come from the compiler. The witness is built in this repo and checked by bitcoind. A second script implementation was the alternative, and it was not taken.

</details>

<details>
<summary><strong>No price is hardcoded.</strong></summary>

`pnpm coordinator-spend` asked mempool.space. The request timed out. The server returned `RATE_UNAVAILABLE`. The rest of that run, and `pnpm e2e`, used 60,000 EUR only after printing that the number was a fixture or a test double. A fallback constant inside the coordinator was the alternative, and it was not added.

</details>

<details>
<summary><strong>The coordinator does not tell the officer where change goes.</strong></summary>

The signer re-derives the fund scripts from the xpubs stored on the device. A change output to any other address is `PSBT_MISMATCH`. Trusting a change address in the server response was the shorter path, and it was not taken.

</details>

<a id="stack"></a>

## 8. Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Script and PSBT | `bitcoinjs-lib` 7.0.5, `@bitcoinerlab/miniscript` 2.0.1 | The compiler produces the script. bitcoind is the acceptance test. |
| Keys | BIP48, testnet coin type `1'`, even on regtest | `m/48'/1'/0'/2'/change/index`. One receive index per member. |
| Node | 22, from `.nvmrc` | `node:sqlite` is the database. It is experimental. |
| Coordinator | Fastify 5 | Watch-only HTTP. Writes are rate-limited in memory, per process. |
| Messages | `nostr-tools` 2.26.1, NIP-17 | The request is not a PSBT on the relay. |
| Chain | Bitcoin Core 32.1, regtest | The refusal has to come from the node. |
| Web | Vite 8, React 19, Tailwind 4 | The wallet UI. Keys, the P2WSH script, the PSBT check, and the signature stay in the browser. The member view checks the raw transaction with `@noble/curves`. |
| Public host | Docker Compose, Caddy | One origin on the HostAfrica VPS: homepage, `/app`, `/v1`, `/relay`. Regtest. The script proof in Evidence did not use this stack. |
| Package manager | pnpm 11.1.2 | Workspaces. There is no npm script runner beyond what pnpm exposes. |

<a id="cli"></a>

## 9. CLI

French by default. `--lang en` switches the sentences. The pin is `--pin` or `KOINON_PIN`, at least 8 characters. It is not sent to the coordinator. The CLI does not print a seed, an `nsec`, or a PSBT.

```bash
pnpm koinon init-fund --name "Dahira Démo" --csv 10 --fee-cap 100000
pnpm koinon member add membre-01
pnpm koinon contribute membre-01 5000
pnpm koinon mine 1
pnpm koinon status
pnpm koinon request 1000 bcrt1q... fournitures --as O1
pnpm koinon attack tamper <request-id> --as O2
pnpm koinon attack single-sig <request-id> --as O1
pnpm koinon approve <request-id> --as O1
pnpm koinon approve <request-id> --as O2
pnpm koinon broadcast <request-id>
pnpm koinon mine 1
pnpm koinon recover bcrt1q... --as O3
pnpm koinon audit verify
```

`attack single-sig` exits 0 when bitcoind refuses. It exits 1 if bitcoind accepts. `recover` before N prints the refusal and exits 0. That refusal is the result.

Roles are labels, not names: O1 treasurer, O2 secretary, O3 president, K assembly. Full HTTP detail is [docs/API.md](docs/API.md). The screen is `apps/web`, live at [102-68-84-31.sslip.io](https://102-68-84-31.sslip.io). The contract it follows is [docs/UI_CONTRACT.md](docs/UI_CONTRACT.md).

<a id="getting-started"></a>

## 10. Getting started

Compose is the path that does not need Bitcoin Core installed on the host. It is what CI runs, and what the public demo runs. `pnpm test` and `pnpm tamper-test` need neither Compose nor bitcoind. The 17 Nov refusals were `pnpm e2e` on this Mac, with bitcoind on the path.

| Tool | Version | Check |
| --- | --- | --- |
| Node | 22, `.nvmrc` says `22` | `node -v` |
| pnpm | 11.1.2 | `pnpm -v` |
| Bitcoin Core | 32.1, the version this proof used | `bitcoind -version` |
| Docker | Compose, for the public demo and for CI. The 17 Nov checklist on this Mac did not use it | `docker compose version` |

```bash
pnpm install
pnpm test
pnpm tamper-test
```

`pnpm test` prints the vitest counts and does not start bitcoind. `pnpm tamper-test` prints the three lines in the demo section.

Compose, the commands CI runs. Without `KOINON_SITE`, the web service is plain HTTP on `127.0.0.1:8000`.

```bash
docker compose -f infra/docker-compose.yml up -d --build
docker compose -f infra/docker-compose.yml --profile e2e run --rm e2e
```

To reset, which deletes the chain and the keys:

```bash
docker compose -f infra/docker-compose.yml down -v
```

Compose publishes the coordinator on `127.0.0.1:8787` and the relay on `127.0.0.1:8080`. It does not publish Bitcoin RPC. A CLI command that mines or spends against that stack is:

```bash
docker compose -f infra/docker-compose.yml --profile tools run --rm cli status
```

The public host is the same file with `KOINON_SITE`, `KOINON_WEB_BIND`, and `KOINON_WEB_TLS_BIND` set, as [docs/DEPLOY.md](docs/DEPLOY.md). It is [102-68-84-31.sslip.io](https://102-68-84-31.sslip.io).

With bitcoind installed as `bitcoind` on the path, the 17 Nov proof:

```bash
pnpm e2e
```

The first line, when Docker is absent, is `NOTE: docker compose is not installed.` The checklist follows. That is the host path on this Mac. Regtest sats have no value. The rate line says the figure is a fixture.

| Variable | Required | Example | What it does |
| --- | --- | --- | --- |
| `PORT` | no | `8787` | Coordinator port. |
| `HOST` | no | `127.0.0.1` | Bind address. Compose sets `0.0.0.0` inside the container. |
| `KOINON_DB` | no | `data/koinon.sqlite` | SQLite file. `:memory:` is tests. |
| `BITCOIN_RPC_URL` | for spends | `http://127.0.0.1:18445` | Host node. Not published by compose. |
| `BITCOIN_RPC_USER` | for spends | `koinon` | Local regtest user. Not a mainnet secret. |
| `BITCOIN_RPC_PASSWORD` | for spends | `koinon` | Local regtest password. Not a mainnet secret. |
| `BITCOIN_RPC_WALLET` | for the CLI | `bootstrap` | Wallet name for mine and contribute. |
| `MEMPOOL_PRICES_URL` | no | mempool.space prices | EUR source. No hardcoded fallback. |
| `KOINON_HOME` | for the CLI | `.koinon` | Encrypted keys and public config. |
| `KOINON_PIN` | for the CLI | 8 characters or more | Decrypts keys. Never sent to the coordinator. |
| `KOINON_COORDINATOR` | for the CLI | `http://127.0.0.1:8787` | Watch-only API. |
| `KOINON_RELAY` | for requests | `ws://127.0.0.1:8080` | Gift-wrap relay. |
| `LOG_LEVEL` | no | `info` | Coordinator logs. Bodies are redacted. |

`FIXTURE_EUR` and `KOINON_RATE_SOURCE` belong to the demo price process. The coordinator does not read them. The full list is [.env.example](.env.example). None of these are browser-public variables. The frontend talks to `/v1` and `/relay` on the same origin. A static host has neither, which is why the demo is the compose stack.

| Command | Covers |
| --- | --- |
| `pnpm test` | Policy, CFA rounding, signer refusals, key encryption, coordinator API, Nostr. No bitcoind. |
| `pnpm typecheck` | core, coordinator, nostr, CLI, web. |
| `pnpm kill-test` | 1 signature, 2 signatures, path B early, path B late. Starts bitcoind. |
| `pnpm tamper-test` | Swapped recipient, no signature. |
| `pnpm coordinator-spend` | HTTP spend against bitcoind. Live price if it answers. |
| `pnpm nostr-test` | Gift wrap on a loopback relay. |
| `pnpm cli-demo` | CLI path, including veto and recovery. |
| `pnpm e2e` | 12 members and the judge checklist. |
| `pnpm seed` | Fund, 12 members, contributions. Needs a coordinator that is already up. |

> [!NOTE]
> `ExperimentalWarning: SQLite is an experimental feature` is expected. It is Node's warning for `node:sqlite`.

> [!WARNING]
> `RATE_UNAVAILABLE` means the price URL did not answer and nothing was cached. Do not put a constant in the coordinator to get past it. Point `MEMPOOL_PRICES_URL` at a fixture, or wait for the network, and say which one you used.

> [!TIP]
> A one-signature refusal that contains `Signature must be zero` is the guard working. `attack single-sig` exits 0 on that line.

> [!TIP]
> If port 18445 is already taken, stop the other regtest. `pnpm e2e` and `pnpm kill-test` both use it and both wipe `.regtest`.

<a id="repo"></a>

## 11. Repo map

| Path | Responsibility |
| --- | --- |
| [packages/core](packages/core) | Script, keys, PSBT, CFA, signer check, key encryption. |
| [packages/nostr](packages/nostr) | Message schemas, gift wrap, the demo relay. |
| [apps/coordinator](apps/coordinator) | HTTP, chain scan, ledger, audit. |
| [apps/cli](apps/cli) | Demo commands. |
| [apps/web](apps/web) | Homepage and two-phone demo. Caddy serves this build on the VPS. |
| [scripts](scripts) | Regtest, kill test, seed, e2e, log scan. |
| [infra](infra) | Compose file and Caddy. The public host, and the GitHub Actions e2e job. |
| [docs](docs) | Policy, API, threat model, UI contract, the run log. |

<a id="status"></a>

## 12. What works today

<details open>
<summary><strong>Observed</strong></summary>

| What | Evidence |
| --- | --- |
| 1 signature refused, 2 accepted | `pnpm kill-test`, 17 Nov 2026, Bitcoin Core 32.1 |
| Path B refused, then accepted after 10 blocks | same command, both txids in the table above |
| Signer refuses a swapped recipient, a wrong amount, foreign change, a fee over the cap, a foreign input | `pnpm test` in core, and `pnpm tamper-test` |
| Coordinator spend and audit tamper | `pnpm coordinator-spend` and `pnpm e2e` |
| Veto by an officer | `pnpm cli-demo` |
| Gift wrap hides the purpose | `pnpm nostr-test` and `pnpm e2e` |
| Keys encrypted, absent from the file and the transcript | `pnpm cli-demo` |
| 12 members and the full checklist | `pnpm e2e` |
| Public demo on one origin | [102-68-84-31.sslip.io](https://102-68-84-31.sslip.io/), `/app`, `/v1/health` ok, 18 Nov 2026. Compose on HostAfrica VPS, Nigeria. |

</details>

<details>
<summary><strong>Built, not observed</strong></summary>

- A restarted coordinator reading the same database.
- Two officers on two separate machines, or a relay other than the demo relay.
- A pin typed at a prompt. The demo passes `--pin`.
- A live mempool price. The one attempt timed out.
- Path B broadcast through the coordinator's HTTP API. The coordinator refuses an immature coin before it builds the PSBT. Recovery in the CLI talks to bitcoind directly, and that path was observed.

</details>

<details>
<summary><strong>Deliberately absent</strong></summary>

- Lightning, mainnet, Banxaas, Mobile Money, AI, Wolof, phone numbers, push notifications.
- Collusion protection beyond 2 of 3.
- A hardcoded bitcoin price.
- Publisher authentication on the demo relay.

</details>

<details>
<summary><strong>Open</strong></summary>

- Coin selection is greedy, largest first. It can overpay the fee. It will not cross the fee cap.
- The rate limit is in memory, per process, and resets on restart.
- `node:sqlite` is experimental.
- Creating a fund and adding a member are unauthenticated. The fund id is unguessable. The money still needs two signatures.
- The demo relay accepts any publisher.
- The license is MIT, in [LICENSE](LICENSE). Copyright 2026 Koinon contributors. Names are not in this repo until they are supplied.
- The Devpost criteria are mapped in the summary. The page is [dakar-bitcoin-hack-2026.devpost.com](https://dakar-bitcoin-hack-2026.devpost.com/).

</details>

<a id="next"></a>

## 13. Next

1. A real price response from mempool.space, shown next to the fixture so the two are not confused.
2. `N` at about 4,320 blocks on a network where that wait means something. Not before the 10-block proof is boring.
3. A third-party reading of the script. Then, and only then, a conversation about mainnet.
4. Lightning stays out. A node that receives into a channel holds the coins on that node. The rule in this repo is a script that can hold an association's pot for months, where neither the treasurer nor the server can move it alone.
5. An assistant stays out. It would talk about a spend. It would not be the thing that refuses one.
6. A Mobile Money bridge, including the kind of cash-in Banxaas does, stays out until the script is the thing a pilot trusts. The bridge would sit in front of the fund. It would not replace the two signatures.

<div align="center">

Koinon. The treasurer cannot move the money alone.

[Back to the top](#summary)

</div>
