# STATUS — claude-comm, 2026-08-04 (session 1)

Built and installed in one session. **Design and gates are in `README.md`; this file is only what is
OPEN.** Keep it short — when it grows, fold the settled parts into the README.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs`, `install.mjs`, `test/selftest.mjs`, `test/attack.mjs` — no dependencies |
| **electio** | installed (leader + web-app). ⭐ **The electio leader adopted it itself** — commit `c1ab13e` *"comm bus live"*, and it committed the protocol docs + hook files |
| **selflo** | installed across all 7 agents; protocol in `COORDINATION.md` + all 6 generated `START_HERE.md` |
| gates | `selftest` ✓ + `--prove-red` ✓ · `attack` 10/10 ✓ |

## ⏭️ OPEN

1. **🔴 No live two-agent exchange has ever run.** Every delivery proof used headless `claude -p`. The
   mechanism is proven end-to-end, but a real leader↔expert round over the bus is **unexercised**. This is
   the first thing to test.
2. **Hooks load at session start.** Any agent running since before install has no hooks. Restart to arm.
3. **One stale message queued for the electio leader** (`web-app` → `leader`, "Round 1 delivered… 4
   questions"). It predates the bus going live and **the leader has already approved Round 1** through the
   owner. Likely redundant → `node .comm/bin/comm.mjs dismiss leader` if so. Left queued deliberately:
   dismissing is the owner's call, and `dismiss` is recoverable (moves to `delivered/`, never deletes).
4. **Turn-boundary latency is unmeasured against real round lengths.** It is *"waits for the turn"*, not
   *"waits for the round"*. Whether that is fast enough is empirical — only real use answers it.
5. **selflo has 3 uncommitted files from this work**: `.gitignore`, `COORDINATION.md`,
   `scripts/sync-agent-files.mjs`. Deliberately left for review rather than committed unasked.
6. **`claude-comm` itself is not a git repo.** No commits, no remote. Init if it is worth versioning.
7. **Phase 2, deferred by the owner:** kitty socket for a true mid-turn interrupt
   (`allow_remote_control socket-only` + `listen_on`, needs a restart). ⚠️ Before relying on it, verify
   `kitten @ ls` resolves splits by title on a scratch split — a `--match` that matches nothing sends the
   nudge into the void and looks exactly like an agent ignoring it.

## ⚠️ What was NOT verified

- Any exchange between two **real interactive** sessions (see OPEN 1).
- Behaviour when an agent is mid-tool-call rather than mid-turn.
- Anything non-Linux: `comm who` reads `/proc` and degrades to "not running" everywhere else.
- Whether experts actually *use* it unprompted. The electio leader did adopt it; the experts' side is
  documented but unobserved.

## Where the mistakes are recorded

Four of this session's findings came from probes that returned **confident wrong results**, not from
reading code — including three of my own. They are written into the code and gate comments at the point
they apply (`test/attack.mjs` header for A8; `resolveRef`/`refForRecipient` in `bin/comm.mjs`; the
render-before-drain comment in `hookDeliver`; the prompt-conflict note in `selftest.mjs`). *A rule whose
cost you cannot see is a rule someone will simplify away.*
