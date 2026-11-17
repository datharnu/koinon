# UI contract

No UI is in this repository. Do not add one beside this file. The CLI in [apps/cli](../apps/cli) is the driver until a client exists. This page is what that client is allowed to assume. HTTP shapes and status codes are in [API.md](API.md).

The client paints a state. It does not decide a spend. A button is disabled because the last response said so, not because the button contains the rule.

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

A phone-sized layout is required when a UI is built, because the second signature happens on the officer's own device. No layout is specified here, and none is implemented.

## Ledger

Who: a member, with no key.

Data: `GET /v1/funds/:id` for `balance_sats`, `balance_xof`, `chain_tip`, and `rate`. `GET /v1/funds/:id/ledger` for each row: `kind` (`contribution` or `spend`), `sats`, `xof_at_receipt`, `confirmations`, `txid`, `fee_sats`, `index`, `indexes`. A recovery spend (`request_id` null) uses `indexes` to name whose due left, e.g. "Awa · recovery".

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

Who: any member.

Data: `GET /v1/funds/:id/audit/verify` returns `{ ok, seq }`. `ok: true` is "Audit intact." `ok: false` names `seq` and is `REFUSE`, not a soft warning.

Actions: verify. The client does not offer a repair button. A broken chain stays broken on screen.

Empty does not apply once a fund exists. Fund creation writes the first row. Loading: the GET. Error: `NOT_FOUND`.

## What the client must not do

- Invent a BTC price, or hide that a fixture was used.
- Treat `PENDING` as spent.
- Sign after `PSBT_MISMATCH`.
- Put a pseudonym, a purpose, a seed, or a PSBT in a URL or a log line.
- Send the pin or a key file to the coordinator.
- Show a mainnet address, or drop the regtest warning, while `network` is `regtest`.
