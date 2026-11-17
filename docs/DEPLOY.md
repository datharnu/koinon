# Deploy the regtest demo on a VPS

Regtest only. The faucet and the miner are on, so anyone with the link can create a fund and play. Sats have no value.

Any small Linux VPS with Docker works (1 vCPU, 2 GB RAM, 10 GB disk). Point a DNS `A` record at it first.

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
