# API

Regtest only. Every rate and balance response says `network: "regtest"` and `regtest_sats_have_no_value: true`. Satoshis are decimal strings. XOF amounts are integer strings. The server stores no private key.

Base URL in local runs: `http://127.0.0.1:8787`.

Errors are `{ "code", "message" }`. The message does not echo the request body.

## Officer auth

`POST /v1/funds/:id/requests`, `POST /v1/requests/:id/signatures`, and `POST /v1/requests/:id/reject` require:

```
Authorization: Koinon <role> <timestamp-ms> <nonce> <128-hex-signature>
```

`role` is `O1`, `O2`, `O3`, or `K`. The signature is the account key at `m/48'/1'/0'/2'` over SHA-256 of this UTF-8 text:

```
koinon-auth.v1
<METHOD>
<pathname>
<timestamp-ms>
<nonce>
<sha256 hex of the raw body>
```

The pathname has no query string. The raw body is the exact bytes sent. The timestamp must be within five minutes. A nonce is single use. `K` can sign or reject. `K` cannot open a spend.

Creating a fund, adding a member, and broadcasting are not authenticated. The fund id is unguessable, writes are rate-limited, and a broadcast still needs two valid signatures inside the PSBT. Money cannot move on one signature.

## Routes

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| GET | `/v1/health` | no | `{ ok, network, bitcoind }` |
| GET | `/v1/rate` | no | BTC/EUR, the peg, BTC/XOF, age, `stale` |
| POST | `/v1/funds` | no | Register three officer xpubs, the assembly xpub, `csv_blocks`, `fee_cap_sats` |
| GET | `/v1/funds/:id` | no | Public config, balance in sats, display XOF |
| GET | `/v1/funds/:id/members` | no | Index, pseudonym, address |
| POST | `/v1/funds/:id/members` | no | Next receive index. Returns the address. |
| GET | `/v1/funds/:id/ledger` | no | Contributions and spends, newest first. `limit`, `offset` |
| POST | `/v1/funds/:id/requests` | officer | Lock sats from the current XOF amount. Returns the unsigned PSBT. |
| GET | `/v1/requests/:id` | no | The request, including the PSBT an officer must check |
| POST | `/v1/requests/:id/signatures` | officer | Body `{ "psbt" }`. Rejects a changed transaction. |
| POST | `/v1/requests/:id/reject` | officer | Body `{ "reason" }`. One officer can veto. |
| POST | `/v1/requests/:id/broadcast` | no | Broadcasts only an approved PSBT |
| GET | `/v1/funds/:id/audit` | no | Hash chain |
| GET | `/v1/funds/:id/audit/verify` | no | `{ ok, seq }` |

`GET /v1/rate?require_fresh=1` returns `RATE_STALE` when the cache is older than 60 seconds. The same flag works on spend creation.

## Signer check

The officer's client does not trust the coordinator's copy of the PSBT. Before it signs, it re-derives the fund scripts from the xpubs it stored and checks the unsigned transaction: one output to the recipient for the locked sats, any other output only to the fund's own change address, every input a coin of this fund on the approved path, and the fee at or under the cap. A mismatch is `PSBT_MISMATCH`. A fee above the cap is `FEE_OVER_CAP`. The check throws before a signature is added.

## Spend

`amount_xof` is a positive integer. The server converts it with the live BTC/EUR price times the peg `655.957`, rounds sats up, and stores both the sats and the rate on the request. A later price change does not move that request.

Coin selection is greedy, largest coin first. It can pay a higher fee than a perfect selector. It will not spend if the estimate is above `fee_cap_sats`.

Path `A` spends with two of O1, O2, O3. Path `B` spends with K and one officer, and only coins with at least `csv_blocks` confirmations. A request stays pending until it is approved, then broadcast, then confirmed when the indexer sees it. It can also be rejected, expired after 24 hours, or failed. A failed broadcast releases the coins. The same request is not retried.

Selected coins are reserved until reject, expiry, or a failed broadcast. A second pending request cannot take them.

## Rate

The EUR price comes from `MEMPOOL_PRICES_URL` (default `https://mempool.space/api/v1/prices`). There is no hardcoded price. If the fetch fails and a previous price is cached, the response is that price with `stale: true`. If nothing is cached, a spend returns `RATE_UNAVAILABLE`.

## What is not logged

Names, phone numbers, seeds, xpubs' private keys, PSBT contents, Nostr keys, pseudonyms, the spend purpose, and the reject reason. The audit row stores amounts, path, status, and txid. It does not store the purpose or the reason. The reason is kept on the request row so the officers can read it.
