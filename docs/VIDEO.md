# Demo video

2:15, 1280×800, recorded from the running product on 18 Nov 2026. Nothing in it is a mockup: the homepage, the app, the member view and the README are screen recordings, and the terminal shot replays the real `pnpm e2e` output from that day as text. The cap is 3:00.

| What | Where |
| --- | --- |
| Video | `.video/koinon-demo.mp4` (gitignored). EN and FR soft subtitle tracks. |
| Subtitles for upload | `.video/koinon-demo.en.srt`, `.video/koinon-demo.fr.srt` |
| Recorder | `scripts/record-demo.mjs` drives the local stack with Playwright and writes `.video/takes/*.webm` and `.video/marks.json` |
| Editor | `scripts/build-video.mjs` holds the narration, cuts each beat to its line, and writes the MP4 |

**Voice.** A neural narrator, `en-US-AndrewNeural` at −4% (Microsoft Edge TTS), one short line per beat. macOS `say` is only the fallback (`--engine say`); it is the voice the earlier cuts used, and it sounds like a system voice. This one is still synthetic. A recording of your own voice is better for the judges; see [Replace the voice](#replace-the-voice). Segments where the screen waits are sped up, and the frame says "sped up ×N" while that happens. When a line is longer than its footage, the last frame holds.

## Shot list

| Time | Screen | Say (EN) | Proves |
| --- | --- | --- | --- |
| 0:00 | Homepage hero, "Nobody empties the fund alone." | In Senegal, an association's fund usually sits with one treasurer. Koinon makes sure nobody empties it alone. | Problem, primary user |
| 0:08 | Homepage, the three problem figures with their sources | These funds are run mostly by women. That's who we build for. Today, zero associations use Koinon. | Local impact, with its limit |
| 0:16 | Homepage, the three member questions | The fund is a two-of-three Bitcoin script. Two officers sign. The server holds no key. | Solution |
| 0:24 | Terminal: real `pnpm e2e` output, excerpt, 10 `[x]` checks, 23.35 s | One command runs it all on a real Bitcoin node. Ten checks pass, in twenty-three seconds. | Working MVP, one-command setup |
| 0:36 | `/app`: create the fund with the 8-digit code, two phones, 60,000 F | Ibou and Coumba, each on their own phone. This is regtest. The sats have no value. | UX, regtest said out loud |
| 0:49 | "Ibou spends alone": Blocked, raw `NULLFAIL` line | Ibou tries to spend alone. Bitcoin Core refuses. The screen isn't the guard. Bitcoin is. | Security by design |
| 0:56 | "The server swaps the recipient": Blocked on Coumba's phone | The server swaps the recipient. Coumba's phone catches it, and won't sign. | Security by design |
| 1:02 | Spend 15,000 F, review shows 38,113 sats, Sign and send | An honest spend: fifteen thousand francs for the hall. The sats are locked when Ibou asks. | Exact money |
| 1:11 | Coumba approves, Ibou sends, Mine a block, Paid | Coumba approves. Ibou sends. One block later, it's paid. | 2-of-3 end to end |
| 1:22 | Invite sheet with the member link | Ibou shares a read-only link with the members. | Member reach |
| 1:29 | Member view at 390×844: Verified 19/19, Ibou + Coumba, proof sheet, then FR | A member's phone checks the Bitcoin transaction itself, and names who signed. Ibou and Coumba. In French, or English. | Mobile, verification, bilingual |
| 1:43 | "Recover too early": Blocked, raw `non-BIP68-final`, Mine 10 blocks, As designed | Recover too early, and Bitcoin refuses. After the delay, the assembly gets the fund back. | Recovery path |
| 1:54 | README: first screen, architecture diagram, "What this does not claim", "13. Next" | Every claim in the README sits next to its limit. Regtest, a fixed price, no audit yet. Next: a real price, a longer delay, an outside review, then a pilot. Koinon. Nobody empties the fund alone. | Docs, limits, next steps |

The French subtitles are in `scripts/build-video.mjs`, one `fr` line per beat, and in `.video/koinon-demo.fr.srt`.

## Against the judging criteria

| Criterion | Where in the cut |
| --- | --- |
| Usefulness and local impact | 0:00–0:24: Senegalese associations, the sourced figures on screen, "zero associations use Koinon" |
| Security by design | 0:49 and 0:56: two refusals with the refusing party's own words; 1:43: the early recovery refused |
| UX/UI quality | 0:36–1:22 on two phones; 1:29 member view on a phone-sized screen, FR and EN |
| Working MVP | 0:24 `pnpm e2e` against a real regtest node; every app shot is a live run |
| Clear pitch and docs | Problem, solution, impact and next steps in that order; 1:54 README with claims and limits |

## What the video does not claim

- No mainnet, no real money. "This is regtest. The sats have no value." is said at 0:36 and is on screen.
- The 60,000 EUR price is a fixture. The README shot says so.
- 2,500 calebasses, 80,000 members and 95% women describe the addressable group. They are not Koinon users.
- The terminal shot is an excerpt of one real run. The full output is `.video/e2e.txt`.

## Re-record

Pre-flight:

1. bitcoind regtest on 18443, the relay on 8080, the price fixture on 8090.
2. Coordinator on 8787 with `KOINON_DEMO=1 KOINON_DEMO_WALLET=faucet MEMPOOL_PRICES_URL=http://127.0.0.1:8090/`.
3. `pnpm --filter @koinon/web dev --host 127.0.0.1 --port 5173 --strictPort`. `curl http://127.0.0.1:5173/v1/health` returns ok.
4. `pnpm e2e > .video/e2e.txt 2>&1` for a fresh terminal shot.
5. `gh auth status` works. The README shot renders the working-copy README through the GitHub markdown API. After you push, `--readme github` records the live repo page instead.

Then:

```sh
node scripts/record-demo.mjs            # all takes, about 3 minutes
node scripts/record-demo.mjs --only readme   # one take; marks for the others are kept
node scripts/build-video.mjs            # under 30 seconds
```

`build-video.mjs` exits non-zero if the cut is over 3:00.

## Replace the voice

Record one file per beat, named by beat id: `01-problem.m4a` … `13-readme.m4a`. The ids and lines are the `BEATS` list in `scripts/build-video.mjs`. Then:

```sh
node scripts/build-video.mjs --voiceover path/to/folder
```

Each clip is cut or held to fit your recording, and the subtitles follow your timing. Each beat gets up to 6 s of footage beyond its line (`BREATH`). A slower voice can push the cut past 3:00; the script will say so.

## Editing notes

- Keep the two refusals and the early recovery. If time is short, cut beat 10 (invite) before any refusal.
- Do not add a stock opening or an AI-made phone. Every frame should be the product or its docs.
- If you upload to YouTube, add both `.srt` files; soft tracks inside the MP4 are hidden by default in most players.
