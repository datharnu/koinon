# UI contract

The client is `apps/web`. The CLI in [apps/cli](../apps/cli) is the same rule without a screen. HTTP shapes and status codes are in [API.md](API.md).

The client paints a state. It does not decide a spend. A button is disabled because the last response said so, not because the button contains the rule. The member's phone checks the Bitcoin transaction itself. A green row that only repeats the database is not a proof.

## States

| State | When the client may show it | What it must not say |
| --- | --- | --- |
| `PENDING` | A request exists and is `pending`, or a transaction is broadcast and not yet in the ledger as confirmed. | "Sent" or "paid." |
| `ALLOW` | bitcoind accepted the transaction and the ledger shows it, or the signer check returned a signature and the server stored it. Name which of the two. | That a signature alone spent the coins. |
| `REFUSE` | The API or bitcoind returned a code below. Show the code. | A generic "try again" with the code hidden. |
| `UNKNOWN` | The client timed out, or the price is missing, or the indexer has not seen a transaction the user just broadcast. | A success state. Offer a refresh of `GET /v1/funds/:id` and the ledger. |

Regtest responses include `network: "regtest"` and `regtest_sats_have_no_value: true`. The client shows both on every balance and every rate. Sats are decimal strings. XOF amounts are integers. The client does not parse a float out of a satoshi string.

## Errors

The body is `{ "code", "message" }`. The message does not repeat the request. Show `code`. The message is secondary.

| Code | HTTP | Meaning for the screen |
| --- | --- | --- |
| `VALIDATION` | 400 | The input is unusable, or the auth header is malformed, or a nonce was reused. |
| `SIG_INVALID` | 400 | The officer signature on the request does not match the xpub. |
| `NOT_FOUND` | 404 | Unknown fund or request. |
| `PSBT_MISMATCH` | 422 | Recipient, amount, change, inputs, or path do not match the request. Do not offer a sign button after this. |
| `FEE_OVER_CAP` | 409 | The fee is above the cap stored on the officer's fund config. |
| `INSUFFICIENT_FUNDS` | 409 | The free coins do not cover the locked sats and the fee. |
| `ALREADY_SIGNED` | 409 | This officer already signed this request. |
| `REQUEST_EXPIRED` | 409 | Older than 24 hours, or already marked expired. Do not sign. |
| `TIMELOCK_NOT_MET` | 409 | Path B coin is younger than N. |
| `RATE_STALE` | 409 | Only when the client asked for `require_fresh=1` and the cache is older than 60 seconds. |
| `RATE_UNAVAILABLE` | 503 | No price. Do not create a request. Do not substitute a number. |

Loading is the request in flight. The previous ledger stays on screen, marked as the previous one, until the new response arrives. An error replaces the action, not the last confirmed ledger.

Empty is a real response with nothing in it: no members, no ledger rows, no pending request. Copy for that is "No entries." The French CLI already says `Aucune écriture.` An empty fund is not an error.

Long text is truncated on the row and kept in full behind it. Limits the API already enforces: fund name 80, pseudonym 40, purpose 140, reject reason 140. A bech32 address is shown in full on a detail view and may be cut in the middle on a row. A list of members pages with the ledger's `limit` and `offset`. The default ledger page is 50.

The screens that exist are `/`, `/app`, `/fonds/:id`, and `/cosign`. `/app` at 1180px and wider shows two phones. Below that, one phone with a switch. Playwright ran `e2e/walkthrough.spec.ts` locally on 20 Nov 2026 against the Vite dev server and the host coordinator: 390×844 passed in 33.3s, 360×740 passed in 33.4s (17 Nov, older walkthrough: 39.2s and 39.8s). GitHub Actions has not run that spec yet. The workflow file includes it. Long names truncate on a row and stay whole in the proof sheet.

## Ledger

Who: a member, with no key.

Data: `GET /v1/funds/:id` for `balance_sats`, `balance_xof`, `ledger_xof`, `chain_tip`, and `rate`. The headline is `ledger_xof` (the sum of the franc rows: dues at receipt, less each approved spend amount); `balance_xof` (the sats at the current rate) shows beside the sats only when it differs. `GET /v1/funds/:id/ledger` for each row: `kind` (`contribution` or `spend`), `sats`, `xof_at_receipt`, `confirmations`, `txid`, `fee_sats`, `index`, `indexes`. A recovery spend (`request_id` null) uses `indexes` to name whose due left, e.g. "Awa · recovery".

Actions: refresh. The client does not send coins. A contribution appears only after the indexer sees it, which is after a mined block in this demo. Until then the state is `UNKNOWN`, not a new row.

Empty: `entries` is `[]`. Loading: the two GETs in flight. Error: `NOT_FOUND` if the fund id is wrong. If `balance_xof` is null, show the sats and "rate unavailable." Do not compute XOF on the client.

## Request

Who: O1, O2, or O3. K cannot open a spend.

Data the officer typed: CFA amount, recipient address, purpose. Data the server returns and the officer must then read back: `amount_sats`, `rate_btc_eur`, `rate_btc_xof`, `expires_at`, `id`. The gift wrap to the other two officers carries those fields and `path`. It does not carry the PSBT.

Actions: create `POST /v1/funds/:id/requests` with officer auth. Then the client gift-wraps the message. The screen shows the locked sats before it talks about "sent to the others."

Empty: no form yet. Loading: the POST in flight, button unavailable. Error: `RATE_UNAVAILABLE`, `INSUFFICIENT_FUNDS`, `FEE_OVER_CAP`, `VALIDATION`, `SIG_INVALID`. A refused create leaves no request id on screen.

## Approval

Who: the other officers, on their own device.

Data: the gift wrap, unwrapped locally. Show recipient, CFA amount, locked sats, purpose, expiry, and path. Fetch the PSBT only if `coordinator_url` matches the coordinator already configured on the device. Run the signer check. The server's PSBT is not displayed as the thing to trust. The fields from the message are.

Actions: sign, or reject with a reason. Sign posts the PSBT only after the check returns. Reject posts the reason and gift-wraps it. The screen does not echo the reason into a log line. It may show the reason to the officers on the request, because the server stores it for them.

Empty: no message. That is normal. Loading: unwrap, then the check. Error: `PSBT_MISMATCH` and `FEE_OVER_CAP` are refusals with no signature. `REQUEST_EXPIRED` means do not sign. An unknown message type is ignored, not shown as an error pile. A message for another coordinator is ignored the same way.

The approval gift wrap contains the request id, the fund id, and the role. It does not contain a PSBT. The screen must not add one.

## Broadcast

Who: anyone who can call the coordinator. The endpoint is unauthenticated. The PSBT already has two signatures, or bitcoind will not accept it.

Data: `POST /v1/requests/:id/broadcast` returns `txid` and `status: "broadcast"`.

Actions: one. Afterwards the state is `PENDING` until the ledger shows the spend with confirmations. A transport failure is `UNKNOWN`. Refresh. Do not send a second broadcast of a request the server already marked failed. A failed broadcast releases the coins. The officers create a new request.

Error: `REQUEST_EXPIRED`, `VALIDATION` if it is not fully signed, and the bitcoind message when the node rejects the transaction.

## Recovery

Who: one officer, on a device that also has the assembly key. This is not the daily spend.

Data: the client builds path B locally, the way `koinon recover` does. It does not ask the coordinator for a path B PSBT while the coin is young. The coordinator would refuse with `TIMELOCK_NOT_MET` and the officer would never see bitcoind's own refusal.

Actions: broadcast the raw transaction. Before N confirmations the result is `REFUSE` and the text includes `non-BIP68-final`. After N, the result is a txid, then `PENDING` until it confirms. Show N from the fund config. Regtest demos use 10. Do not label 10 as "30 days."

Empty: no mature or immature coin. Say that, not "failed." Loading: the node call. Error: a txid that appears without a refusal, before N, is a bug in the client. Stop and show the txid.

## Audit

Who: any member, on their own phone.

Data: `GET /v1/funds/:id/audit` returns the rows. The phone recomputes each SHA-256. It does not call `/audit/verify` for the badge. The screen says `Verified on this phone: n/n`, or the sequence where the chain broke. `n/n` is a chain check, not a statement that the host is honest. A chain rewritten from the first row still matches.

The member link ends with `#` and the SHA-256 of the four xpubs and `csv_blocks`. Labels are not in that hash. The phone shows one of four states: the keys match the fragment, the fragment is missing, the fragment is not 64 hex characters, or the keys differ. A mismatch does not show the server's names as verified. It shows the roles `O1`, `O2`, `O3`, and `K`.

Addresses: the phone re-derives each listed member's P2WSH address and the change address at index 0 from the four xpubs. It does not derive every possible index.

Actions: none. There is no repair button. A broken chain stays broken on screen.

Empty does not apply once a fund exists. Fund creation writes the first row. Loading: the GET and the local check. Error: `NOT_FOUND`, or the rows never arrived. That is "not checked", not "intact".

## Witness

Who: any member, by tapping a ledger row.

Data: `GET /v1/funds/:id/proof/:txid` for the transaction, and again for each parent the fund recorded. The phone checks the witness script against the 2-of-3 plus CSV script it derived, then BIP143 sighashes and ECDSA with `@noble/curves`. It names the two keys that signed. A payment in has no officer signature. The screen says so.

Checked on the phone: the link fingerprint, the audit chain, address derivation, the witness script, and the signatures. Not checked on the phone: bitcoind's script flags, the miniscript compiler, and the block count. Confirmations are the coordinator's number, including `0` for the mempool and "not reported" when the node did not answer. Regtest.

The verdict for a spend that passed is: checked on this phone from Bitcoin bytes, not from the server's database. Any other result shows the reason. Loading is a skeleton. A missing transaction is an error with retry. An empty output list says there is no readable output. Long txids wrap. The sheet is a bottom sheet under 640px.

## Second phone

`/app` stays two phones on one screen. Settings has an optional "Sign on a second phone". A passkey secret does not leave the device, so that path explains itself and offers no QR. An 8-digit code puts officer 2's ciphertext in the URL fragment of `/cosign`. The code is typed on the other phone. The QR is not a real-fund feature. The second phone must open the same origin.

## What the client must not do

- Invent a BTC price, or hide that a fixture was used.
- Treat `PENDING` as spent.
- Sign after `PSBT_MISMATCH`.
- Put a pseudonym, a purpose, a seed, or a PSBT in a URL or a log line.
- Send the pin or a key file to the coordinator.
- Show a mainnet address, or drop the regtest warning, while `network` is `regtest`.
