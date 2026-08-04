# STATUS — claude-comm, 2026-08-04 (session 2)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs`, `install.mjs`, `test/selftest.mjs`, `test/attack.mjs` — no dependencies |
| repo | **git initialised, local only, no remote** — `f94d96b` on `main` |
| **electio** | installed and **in real daily use** — 20 delivered messages, both directions |
| **selflo** | installed across all 7 agents; protocol in `COORDINATION.md` + 6 `START_HERE.md` |
| gates | re-measured session 2: `selftest` exit 0 · `--prove-red` ✓ · `attack` 10/10 exit 0 |

## ✅ Closed since session 1

- **A live two-agent exchange has now run — many times.** `.comm/log.jsonl` in electio holds 20 delivered
  messages, bidirectional (`leader → web-app` nudge, `web-app → leader` done/blocked), carrying real round
  work (manche 5–6, gate 13, proof of red). Only the two 0-second deliveries at 01:14 and 01:25 are the old
  headless `claude -p` proofs; everything since is two interactive sessions.
- **Both electio sessions are armed.** Hooks written 03:11; leader (pid 12362) started 18:48, web-app
  (pid 30711) started 19:20 — both after. Verified by start time, not assumed.
- **The stale queued message is gone.** The leader's inbox is empty; it drained on its own.
- **`claude-comm` is versioned.** Was open item 6.

## ⏭️ OPEN

1. **🔴 Latency is now measured, and it is a mailbox — not an interrupt.** Across 18 real deliveries:

   | direction | n | median | max |
   | --- | --- | --- | --- |
   | leader → web-app | 8 | **1422 s (23.7 min)** | 2372 s (39.5 min) |
   | web-app → leader | 12 | 639 s (10.6 min) | 2101 s (35 min) |

   The asymmetry is structural: mail lands at the recipient's *turn boundary*, and the expert's
   implementation turns are long, so nudges **to** the expert wait roughly twice as long. Operational
   consequence: a mid-round correction ("the dataset changed under you") can arrive ~24 min late, after the
   expert has already built on the stale assumption. The 17:45 nudge is exactly that shape. Decide whether
   to accept this or take Phase 2 — do not describe the bus as real-time in any doc.
2. **Phase 2, deferred by the owner:** kitty socket for a true mid-turn interrupt
   (`allow_remote_control socket-only` + `listen_on`, needs a restart). Item 1 is its justification.
   ⚠️ Before relying on it, verify `kitten @ ls` resolves splits by title on a scratch split — a `--match`
   that matches nothing sends the nudge into the void and looks exactly like an agent ignoring it.
3. **selflo still has the same 3 uncommitted files** (re-checked): `.gitignore`, `COORDINATION.md`,
   `scripts/sync-agent-files.mjs`. Deliberately left for review rather than committed unasked.

## ⚠️ What was NOT verified

- **Behaviour when an agent is mid-tool-call** rather than mid-turn. Still unexercised, and the long tail in
  item 1 may partly be this rather than turn length — the log cannot distinguish them.
- **Whether the latency ever caused real damage.** The 17:45 nudge arrived 744 s late and the round
  survived; that is one sample, not a safety margin.
- **Anything non-Linux**: `comm who` reads `/proc` and degrades to "not running" everywhere else.
- **selflo's bus has no traffic checked this session** — only electio's log was read. selflo may be
  installed-but-unused.

## A measurement trap, recorded

`delivered/` file mtimes look like drain times and are not — `renameSync` (`bin/comm.mjs:238`) preserves
mtime, so they are *creation* times. Reading latency off them yields a confident "instant delivery" that is
entirely wrong. The only honest source is the `delivered` field in `.comm/log.jsonl` (written at
`bin/comm.mjs:243`).

## Where the mistakes are recorded

Session 1's findings came from probes that returned **confident wrong results**, not from reading code.
They are written into the code and gate comments at the point they apply (`test/attack.mjs` header for A8;
`resolveRef`/`refForRecipient` in `bin/comm.mjs`; the render-before-drain comment in `hookDeliver`; the
prompt-conflict note in `selftest.mjs`). *A rule whose cost you cannot see is a rule someone will simplify
away.*
