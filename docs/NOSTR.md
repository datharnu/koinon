# Nostr

Officers send spend requests as NIP-17 gift wraps (NIP-44, kind 1059). The Bitcoin key and the Nostr key are different. The server never holds either private key.

The message the officer reads:

```
koinon.spend_request.v1
```

Fields: `request_id`, `fund_id`, `amount_xof`, `amount_sats`, `recipient`, `purpose`, `expires_at`, `coordinator_url`, `path`. There is no PSBT. `path` is included because the signer has to check path A against path B. The fee cap stays in the officer's local fund config. A message cannot raise it.

The approver fetches the PSBT only when `coordinator_url` is the coordinator they already configured. They then run the signer check. A mismatch returns `PSBT_MISMATCH` and no approval message is built. An approval is `koinon.spend_approval.v1` with the request id, fund id, and officer role. A rejection is `koinon.spend_rejection.v1` plus a reason. Neither carries a PSBT.

Unknown message types are ignored. An expired request is ignored and the PSBT is not fetched.

`packages/nostr/src/local-relay.ts` is the NIP-01 relay the demo and compose both run. It does not authenticate publishers. It is not `nostr-rs-relay`. A public relay is config, and it has not been used.
