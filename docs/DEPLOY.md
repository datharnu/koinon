# Deploy the regtest demo on a VPS

Regtest only. The faucet and the miner are on, so anyone with the link can create a fund and play. Sats have no value.

The public demo is sized for an Ubuntu VPS with 2 vCPU and 4 GB RAM. It is already [102-68-84-31.sslip.io](https://102-68-84-31.sslip.io/). A static host can serve the files, and it cannot proxy `/v1` or the WebSocket at `/relay`, so the demo does not use one. A passkey is bound to one domain, so `/app` and `/fonds/:id` have to be that same origin as the API. `infra/Caddyfile` is that origin. `restart: unless-stopped` is set on bitcoind, the price fixture, the relay, the coordinator, and the web container so one crash does not end the demo. Bootstrap, the e2e job, and the CLI stay `restart: "no"`.

```sh
git clone https://github.com/datharnu/koinon && cd koinon
export KOINON_SITE=koinon.example.com      # Caddy fetches a certificate for this name
export KOINON_WEB_BIND=0.0.0.0:80
export KOINON_WEB_TLS_BIND=0.0.0.0:443
docker compose -f infra/docker-compose.yml up -d --build
```

Open `https://koinon.example.com`. `/v1` and `/relay` are on the same origin, through Caddy.

The coordinator (8787) and the relay (8080) stay published on 127.0.0.1 only. bitcoind RPC is not published.

Reset everything, chain included:

```sh
docker compose -f infra/docker-compose.yml down -v
```

Without `KOINON_SITE`, the web service serves plain HTTP on `127.0.0.1:8000`, which is what CI checks.
