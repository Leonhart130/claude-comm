# DESIGN — restart a cold, big, idle agent fresh before ringing it

**Status: BUILT 2026-09-13 — rule 7 in `bin/wake.mjs`, gated by A63, with the ring history (`.comm/wake/rings.jsonl`).
What the build measured, settled and left open: `FINDINGS.md#fresh-restart`.** The owner's answer was "Build it,
opt-in". Written by the session that measured it, for a session that remembers none of it; the sections below are
the plan as it stood before the build, kept for how the decision was reached. Read `FINDINGS.md#cache-lives-an-hour` and
`#wake-mid-turn` first; this file does not repeat their tables.

## Where the ask came from

The owner, relayed by getajob's leader (`exchange/getajob-leader/in/2026-09-13-reveiller-un-agent-froid-a-600k-coute-cher-demande.md`;
`exchange/` is gitignored, so it lives on this machine only): *"si tu bosses tu rappelles 1 h après un agent qui a
600k, ça va nous ruiner pour rien"*. Getajob's measured fresh-start cost, after a hand `/clear`, a protocol re-read
and a brief: `cv` ≈ 667 717 → ≈ 90 234, `web` ≈ 585 561 → ≈ 125 052. The proposal below was sent to them in
`exchange/getajob-leader/out/2026-09-13-le-reveil-attend-le-repos-tes-crochets-et-le-cache-vit-une-heure.md`.

## Settled — do not re-derive

- **`wake` decides, at ring time — not the agent at its turn end.** `/clear` keeps the PROCESS: the model and the
  effort `launch.mjs` gave it, its window and its pid all survive. An agent that closed itself would lose the tier
  unless relaunched with it, and its mail would wait "not running" until someone did.
- **Opt-in per agent in `.comm/config.json`, default off.** A `/clear` loses everything an agent has not written
  down. Getajob declared its five experts safe (`db`, `web`, `extension`, `cv`, `review` — not its leader): their
  state lives in `LECONS.md`, `SPEC.md`, `RAPPORT.md`.
- **Never on a turn that is not `idle`** — `readTurn` in `bin/wake.mjs` (A62). Not `ending`, not `unknown`.
- **Never on every bell.** `cv` took five turns 5–10 min apart on 2026-09-13; a warm cache made each cheap, and
  clearing each would have cost ≈ 90 000 per turn for nothing. The waste is only in the resume after a long pause.

## What getajob verified after the GO (letter `…la-liste-des-agents-qui-peuvent-repartir-a-neuf.md`)

- **`cv`, `web`, `review`, `db`, `extension` — yes**, each checked in its `CLAUDE.md`: it opens by reading `LECONS.md`
  whole, `SPEC.md` from the end, `RAPPORT.md`'s last turn. `cv` and `web`, cleared by hand at 14:4xZ, resumed their
  brief without losing anything (turns 21 and 45, checked by their leader).
- 🔴 **Its `leader` — NO.** It is the window where the owner talks to it; part of that conversation is not yet
  written anywhere, and it is the line he types in. **A leader is never a candidate** — whatever the config says;
  the arm must hold that even against an opt-in that names the leader.
- An expert waiting for its leader's answer is at rest with a CLOSED turn and a written report: safe to clear. No
  counter-case known there.
- On getajob the owner never types in expert windows (the hand `/clear` of 2026-09-13 aside). No measurement for
  the other trees.
- **Their threshold hint, two points only:** on a cold cache a fresh start pays as soon as the context exceeds the
  restart cost — `cv` ≈ 90 234, `web` ≈ 125 052 — against cold resumes of ≈ 667 717 and ≈ 585 561.
- **They will not write anything in `config.json` until the key exists** — name it in the release note.

## The condition — all of it

1. the agent is opted in;
2. `readTurn` says `idle`;
3. **its last API call is older than 60 min** — the cache is written with a 1 h TTL, and measured: 0 of 315 resumes
   after 10–60 min were cold, 53 of 55 after 60 min were. Read it from the last assistant row's `timestamp`;
4. **its context is over a per-agent threshold.** Context = the last assistant row's `usage`: `input_tokens` +
   `cache_read_input_tokens` + `cache_creation_input_tokens` (what getajob read). `bin/context.mjs` exports nothing —
   it is a CLI — so this is a few lines in `wake.mjs` beside `readTurn`. **The threshold is NOT measured yet:** measure
   each agent's fresh-start cost first (the first turns after every `/clear` in the corpus), then set it as a
   multiple of that, written in the arm with its evidence.

## The mechanism

- Resolve the window exactly as a ring does (rules 1–3), type `/clear`, press Enter.
- 🔴 **Prove the effect.** `kitten @ send-text` exits 0 doing nothing (memory: *kitty remote control*). The
  `SessionStart` stub records the registry on EVERY start with the payload's transcript (`install.mjs`, the
  `m.record({ pid: sp, transcript: tp, agent, source: p.source })` call), so a `/clear` that happened shows as a NEW
  transcript for the same pid in `lookup(pid)`. Wait for it, bounded: the Stop hook spawns `wake` with a 10 s timeout
  (`comm-hook.mjs`, `spawnSync(... { timeout: 10000 })`), so budget a few seconds. No change → claim nothing, ring
  as before, and say `clear not confirmed`.
- Then ring `NUDGE` as today. The `SessionStart` hook drains the inbox into the fresh session (`comm.mjs` header), so
  the first turn the bell starts already carries the mail.
- **Build the ring history first or with it** (`STATUS.md` item 3): `wake` appends one line per ring — at, root,
  agent, pid, turn state, cleared or not — so a hook-spawned ring stops being invisible.

## Unverified today — measure before relying on it

- that `SessionStart` fires on a `/clear` typed through `send-text`, with the new `transcript_path` (a throwaway
  `launch.mjs --prompt` agent in a copy, never a field session);
- that `send-text "/clear"` + Enter runs the slash command rather than sending the text as a prompt;
- that the model and effort survive `/clear` (compare `message.model` before and after; check how `--effort` is
  passed by `launch.mjs`);
- that `install.mjs` never rewrites `config.json` and nothing else rejects a new top-level key (`loadConfig` is a
  bare `JSON.parse`; `who.mjs` iterates `cfg.agents` only);
- a half-typed owner line: `/clear` appended to it is not a command — inert, but the ring then lands on garbage
  (`FINDINGS.md#doorbell-shares-the-human-s-line`);
- the overage case, where the TTL is documented to drop to 5 min — never observed on this box.

## Arms to write

- the decision table (opted, turn, last-call age, context) → clear or not, with two POSITIVE CONTROLS that must fail
  it: "clear on every bell" and "never clear";
- the effect proof: a fake `lookup` whose transcript never changes → `clear not confirmed` and a normal ring; one
  that changes → cleared;
- an agent not opted in is never cleared, whatever its size;
- proved red in copies, the suite byte-identical — as A62 was.

## What the build settled (2026-09-13)

- **The key:** `"freshRestart": ["db", "web", "extension", "cv", "review"]` at the top of `.comm/config.json`. Anything
  but a list of names opts nobody in, and says so. A leader — `cfg.leader`, or the agent at `"."` — never, even named.
- **Threshold 300 000**, the costliest of 82 measured fresh starts; **age > 60 min**, not ≥.
- **Unverified list above, closed by measurement:** `SessionStart` fires on a typed `/clear` with a new transcript
  (560 ms); the slash command runs; model and effort survive; `install.mjs` rewrites `config.json` only on
  `--add-agent`, as parse → add → stringify, and no reader rejects an unknown top-level key (read, and checked live
  on the throwaway). **The half-typed line: submitted as a prompt** — an unconfirmed clear therefore re-reads the
  turn before ringing.
- **One clear per run**, because the Stop hook kills `wake` at 10 s; the next agent's clear waits for the cleared
  agent's own turn end.
- After a confirmed clear the ring is `FRESH_NUDGE`: same four properties as the doorbell (A52), and it says the bus
  restarted the session, so a cleared agent does not mistake its empty conversation for a crash.

## After it ships

Tell getajob (their list is the five above). Then `work`: it carries most of the measured waste (4.3 M of 6.4 M),
but its channel holds a letter of ours unread since 2026-09-08 — offer it there once getajob has run it for a day.
