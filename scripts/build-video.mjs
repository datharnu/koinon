// Cuts the takes from scripts/record-demo.mjs into one narrated video, at most 3:00.
//
//   node scripts/build-video.mjs [--engine edge|say] [--edge-voice en-US-AndrewNeural] [--voiceover path/to/dir]
//
// Default narration is a neural voice (Microsoft Edge TTS), not macOS `say`. `say` is the
// fallback (--engine say) and sounds like a system voice. To use a human voice, record one
// file per beat as <dir>/<beat id>.m4a (or .wav) and pass --voiceover <dir>.
// Writes .video/koinon-demo.mp4 with EN and FR subtitle tracks, plus .video/koinon-demo.{en,fr}.srt.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : fallback;
};
const ENGINE = arg("--engine", "edge");
const EDGE_VOICE = arg("--edge-voice", "en-US-AndrewNeural");
const EDGE_RATE = arg("--edge-rate", "-4%");
const VOICE = arg("--voice", "Samantha");
const RATE = arg("--rate", "168");
const VOICEOVER = arg("--voiceover", "");
const OUT = path.resolve(".video");
const WORK = path.join(OUT, "build");
const W = 1280;
const H = 800;
const FPS = 30;
const MAX_SECONDS = 180;
const MAX_SPEED = 4;
const BREATH = 6;

/**
 * One beat is one sentence group over one stretch of one take. `from` and `to` are marks
 * written by record-demo.mjs; `[label, seconds]` offsets a mark.
 */
const BEATS = [
  {
    id: "01-problem",
    take: "home",
    from: "hero",
    to: "problem",
    caption: "koinon homepage · local build",
    en: "In Senegal, an association's fund usually sits with one treasurer. Koinon makes sure nobody empties it alone.",
    fr: "Au Sénégal, la caisse d'une association reste souvent chez un seul trésorier. Avec Koinon, personne ne la vide seul.",
  },
  {
    id: "02-who",
    take: "home",
    from: "problem",
    to: "questions",
    caption: "Sources linked on the page",
    en: "These funds are run mostly by women. That's who we build for. Today, zero associations use Koinon.",
    fr: "Ces caisses sont surtout tenues par des femmes. C'est pour elles que nous construisons. Aujourd'hui, aucune association n'utilise Koinon.",
  },
  {
    id: "03-rule",
    take: "home",
    from: "questions",
    to: "end",
    en: "The fund is a two-of-three Bitcoin script. Two officers sign. The server holds no key.",
    fr: "La caisse est un script Bitcoin 2 sur 3. Deux responsables signent. Le serveur n'a aucune clé.",
  },
  {
    id: "04-one-command",
    take: "terminal",
    from: "start",
    to: "end",
    caption: "Real output, 18 Nov 2026 · regtest",
    en: "One command runs it all on a real Bitcoin node. Ten checks pass, in twenty-three seconds.",
    fr: "Une commande fait tout tourner sur un vrai nœud Bitcoin. Dix vérifications passent, en 23 secondes.",
  },
  {
    id: "05-fund",
    take: "app",
    from: "welcome",
    to: ["home", 3],
    caption: "Regtest · sats with no value",
    en: "Ibou and Coumba, each on their own phone. This is regtest. The sats have no value.",
    fr: "Ibou et Coumba, chacun sur son téléphone. C'est du regtest. Les sats n'ont pas de valeur.",
  },
  {
    id: "06-alone",
    take: "app",
    from: "cheat-open",
    to: "attack2-try",
    caption: "Bitcoin Core's own refusal",
    en: "Ibou tries to spend alone. Bitcoin Core refuses. The screen isn't the guard. Bitcoin is.",
    fr: "Ibou tente de dépenser seul. Bitcoin Core refuse. L'écran n'est pas le garde. Bitcoin l'est.",
  },
  {
    id: "07-swap",
    take: "app",
    from: "attack2-try",
    to: ["attack2-raw", 3],
    caption: "Refused on Coumba's phone",
    en: "The server swaps the recipient. Coumba's phone catches it, and won't sign.",
    fr: "Le serveur change le destinataire. Le téléphone de Coumba le voit, et refuse de signer.",
  },
  {
    id: "08-spend",
    take: "app",
    from: ["attack2-raw", 3],
    to: ["sent", 1],
    en: "An honest spend: fifteen thousand francs for the hall. The sats are locked when Ibou asks.",
    fr: "Une vraie dépense : 15 000 F pour la salle. Les sats sont fixés dès la demande d'Ibou.",
  },
  {
    id: "09-approve",
    take: "app",
    from: "coumba-inbox",
    to: ["paid", 2.5],
    caption: "Two signatures · one regtest block",
    en: "Coumba approves. Ibou sends. One block later, it's paid.",
    fr: "Coumba approuve. Ibou envoie. Un bloc plus tard, c'est payé.",
  },
  {
    id: "10-invite",
    take: "app",
    from: "home-after",
    to: "pause-for-member",
    en: "Ibou shares a read-only link with the members.",
    fr: "Ibou partage un lien en lecture seule avec les membres.",
  },
  {
    id: "11-member",
    take: "member",
    from: "open",
    to: "end",
    caption: "Checked on the phone, not by the server",
    en: "A member's phone checks the Bitcoin transaction itself, and names who signed. Ibou and Coumba. In French, or English.",
    fr: "Le téléphone d'un membre vérifie la transaction Bitcoin elle-même, et nomme les signataires. Ibou et Coumba. En français, ou en anglais.",
  },
  {
    id: "12-recovery",
    take: "app",
    from: "recover-try",
    to: "end",
    caption: "Regtest delay: 10 blocks",
    en: "Recover too early, and Bitcoin refuses. After the delay, the assembly gets the fund back.",
    fr: "Récupérer trop tôt ? Bitcoin refuse. Après le délai, l'assemblée récupère la caisse.",
  },
  {
    id: "13-readme",
    take: "readme",
    from: "top",
    to: "end",
    caption: "README.md",
    en: "Every claim in the README sits next to its limit. Regtest, a fixed price, no audit yet. Next: a real price, a longer delay, an outside review, then a pilot. Koinon. Nobody empties the fund alone.",
    fr: "Dans le README, chaque affirmation a sa limite. Regtest, prix fixe, pas encore d'audit. Ensuite : un prix réel, un délai plus long, une revue externe, puis un pilote. Koinon. Personne ne vide la caisse seul.",
  },
];

const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const duration = (file) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).trim());

const marks = JSON.parse(await readFile(path.join(OUT, "marks.json"), "utf8"));
function at(take, ref) {
  const [label, offset] = Array.isArray(ref) ? ref : [ref, 0];
  const hit = marks[take]?.find((m) => m.label === label);
  if (!hit) throw new Error(`No mark ${take}:${label}. Re-run scripts/record-demo.mjs.`);
  return hit.at + offset;
}

await rm(WORK, { recursive: true, force: true });
await mkdir(WORK, { recursive: true });

/* Caption pills and speed badges, drawn by the browser because this ffmpeg has no drawtext. */
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
async function pill(text, file, tone = "dark") {
  const bg = tone === "dark" ? "rgba(17,17,20,.86)" : "rgba(109,74,255,.92)";
  await page.setContent(`<html><body style="margin:0;background:transparent">
    <span id="p" style="display:inline-block;padding:9px 16px;border-radius:999px;background:${bg};color:#fff;font:600 15px/1.2 -apple-system,'Plus Jakarta Sans',Helvetica,sans-serif;letter-spacing:.01em;box-shadow:0 6px 24px rgba(0,0,0,.18)">${text}</span></body></html>`);
  await page.locator("#p").screenshot({ path: file, omitBackground: true });
}

const clips = [];
let cursor = 0;
const srt = { en: [], fr: [] };
const stamp = (s) => {
  const ms = Math.round(s * 1000);
  const hh = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const mm = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
  return `${hh}:${mm}:${ss},${String(ms % 1000).padStart(3, "0")}`;
};

for (const [index, beat] of BEATS.entries()) {
  const voice = path.join(WORK, `${beat.id}.wav`);
  const human = ["m4a", "wav", "mp3"].map((ext) => path.join(VOICEOVER, `${beat.id}.${ext}`)).find((f) => VOICEOVER && existsSync(f));
  if (human) run("ffmpeg", ["-y", "-loglevel", "error", "-i", human, "-ar", "48000", "-ac", "1", voice]);
  else if (ENGINE === "edge") {
    const mp3 = path.join(WORK, `${beat.id}.mp3`);
    let spokenOk = false;
    for (let attempt = 1; attempt <= 4 && !spokenOk; attempt += 1) {
      try {
        run("python3", ["-m", "edge_tts", "--voice", EDGE_VOICE, `--rate=${EDGE_RATE}`, "--pitch=-2Hz", "--text", beat.en, "--write-media", mp3]);
        spokenOk = true;
      } catch (error) {
        if (attempt === 4) throw error;
      }
    }
    run("ffmpeg", ["-y", "-loglevel", "error", "-i", mp3, "-ar", "48000", "-ac", "1", voice]);
  } else {
    const aiff = path.join(WORK, `${beat.id}.aiff`);
    run("say", ["-v", VOICE, "-r", RATE, "-o", aiff, beat.en]);
    run("ffmpeg", ["-y", "-loglevel", "error", "-i", aiff, "-ar", "48000", "-ac", "1", voice]);
  }
  const spoken = duration(voice);
  const lead = 0.35;

  const source = path.join(OUT, "takes", `${beat.take}.webm`);
  const start = at(beat.take, beat.from);
  const end = Math.min(at(beat.take, beat.to), duration(source) - 0.05);
  const length = end - start;
  const target = Math.max(spoken + lead + 0.8, Math.min(length, spoken + lead + BREATH));
  const speed = Math.min(MAX_SPEED, Math.max(1, length / target));
  const played = length / speed;
  const hold = Math.max(0, target - played);

  const overlays = [];
  if (beat.caption) {
    const file = path.join(WORK, `${beat.id}-caption.png`);
    await pill(beat.caption, file);
    overlays.push({ file, x: "24", y: "H-h-24" });
  }
  if (speed > 1.25) {
    const file = path.join(WORK, `${beat.id}-speed.png`);
    await pill(`sped up ×${speed.toFixed(1)}`, file, "brand");
    overlays.push({ file, x: "W-w-24", y: "H-h-24" });
  }

  const fit = beat.take === "member"
    ? `scale=-2:${H - 40}:flags=lanczos,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0xf1f1ee`
    : `scale=${W}:${H}:flags=lanczos`;
  let graph = `[0:v]trim=start=${start.toFixed(3)}:end=${end.toFixed(3)},setpts=(PTS-STARTPTS)/${speed.toFixed(4)},fps=${FPS},${fit},tpad=stop_mode=clone:stop_duration=${hold.toFixed(3)},setsar=1[v0]`;
  overlays.forEach((o, i) => {
    graph += `;[v${i}][${i + 2}:v]overlay=x=${o.x}:y=${o.y}[v${i + 1}]`;
  });
  graph += `;[1:a]adelay=${Math.round(lead * 1000)}:all=1,apad,atrim=0:${target.toFixed(3)}[a]`;
  const clip = path.join(WORK, `${beat.id}.mp4`);
  run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", source, "-i", voice,
    ...overlays.flatMap((o) => ["-i", o.file]),
    "-filter_complex", graph,
    "-map", `[v${overlays.length}]`, "-map", "[a]",
    "-t", target.toFixed(3),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
    clip,
  ]);
  const real = duration(clip);
  clips.push(clip);
  for (const lang of ["en", "fr"]) {
    srt[lang].push(`${index + 1}\n${stamp(cursor + lead)} --> ${stamp(cursor + lead + spoken)}\n${beat[lang]}\n`);
  }
  console.log(`${beat.id.padEnd(16)} voice ${spoken.toFixed(1)}s  source ${length.toFixed(1)}s  speed ×${speed.toFixed(2)}  hold ${hold.toFixed(1)}s  → ${real.toFixed(1)}s`);
  cursor += real;
}
await browser.close();

const list = path.join(WORK, "list.txt");
await writeFile(list, clips.map((c) => `file '${c}'`).join("\n"));
const joined = path.join(WORK, "joined.mp4");
run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
for (const lang of ["en", "fr"]) await writeFile(path.join(OUT, `koinon-demo.${lang}.srt`), srt[lang].join("\n"));

const final = path.join(OUT, "koinon-demo.mp4");
run("ffmpeg", [
  "-y", "-loglevel", "error",
  "-i", joined, "-i", path.join(OUT, "koinon-demo.en.srt"), "-i", path.join(OUT, "koinon-demo.fr.srt"),
  "-map", "0:v", "-map", "0:a", "-map", "1", "-map", "2",
  "-c:v", "copy", "-c:a", "copy", "-c:s", "mov_text",
  "-metadata:s:s:0", "language=eng", "-metadata:s:s:1", "language=fra",
  "-movflags", "+faststart",
  final,
]);
const total = duration(final);
console.log(`\n${final}: ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")} (${total.toFixed(1)}s)`);
if (total > MAX_SECONDS) {
  console.error(`Over the ${MAX_SECONDS}s cap. Shorten a beat or raise --rate.`);
  process.exit(1);
}
