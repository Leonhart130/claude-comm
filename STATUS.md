# STATUS — claude-comm, 2026-09-04 (sessions 4–12)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*Written 2026-09-04 by the session that lived it, immediately before a real reboot. It assumes you remember
nothing. Every claim below is checkable from the tree; check rather than trust.*

**1 — Fix `bin/context.mjs`. It reports the context of a session that no longer exists.**

`FINDINGS.md#clear-blind` carries the measurement and the reasoning — read it, do not re-derive it. Short
version: a `/clear`ed process keeps its **launch** session's scratch directory forever, so pid→transcript
returns the dead session's file and its final number with **exit 0**. A self-rebooting leader is a cleared
session by construction, and its pre-clear context is large by definition — so the trigger would re-fire at
once and the agent would reboot forever, looking from outside exactly like the feature working. The `Stop`
hook path is safe: its payload carries `transcript_path` outright.

**The fix is decided, only the code is missing.** A registry written at `SessionStart`: boot already holds
the payload and already resolves the session pid in row 1, so it records `pid + process start time →
transcript` and refreshes it at every start, clears included. It lives in
`$XDG_RUNTIME_DIR/claude-comm/sessions.json` — a pid is a *machine-global* name, so a per-project registry
would look the same pid up in whichever project the reader happened to be standing in. The start-time pair
makes a recycled pid a **miss**, and a miss must **refuse**, never fall back to today's resolution.

🔴 **Review #4 left a warning attached to exactly this work:** the cheapest implementation is to widen the
ledger's `start` record, which puts `bySession` and the newest-start span on the reboot trigger's path. Both
were verdict-accuracy defects (R5, R9) and are now fixed — **keep them fixed**, and re-read
`FINDINGS.md#ledger-trial` before reusing either.

**2 — Then wire the field to the ledger.** `bin/ledger.mjs` records only here; `~/Dev/work` and
`~/Dev/electio` run `.claude/comm-hook.mjs session-start`, which knows nothing about it. The reboots happen
there, so the arm that matters is empty. Four things you would otherwise re-derive:

1. **The obstacle is one line of the generated stub**: it forwards with `stdio: "inherit"`, so the payload on
   stdin is consumed once, by the bus. Read it ONCE, hand the bytes to both, and never let the ledger's spawn
   delay or fail delivery.
2. **This is a delivery change** — `node test/selftest.mjs` and `--prove-red`, before and after.
3. **The agent name comes from the stub's location** (`--agent-root`), never cwd, never the payload.
4. **Re-install into both field projects**, then confirm `field:*` is still green — a drifted stub is RED.

**3 — Only then the trigger.** The consumer's §2.4: *"you re-fetched a file you already read this session"*,
countable by a hook, not a token threshold. Its confound is theirs, priced at ~30 min; ask rather than guess.

⚠️ **Do not build the reboot mechanism ahead of 1 and 2.** Shipping it onto a sensor that reads a dead
session, into a project with no control arm, is the same mistake twice with the instrument as an alibi.

**One question is with the owner, unanswered.** Does `kitten @ launch --type=os-window` open into the *same*
kitty process — same socket, agent reachable — while relaunching the `kitty` binary would create a second,
unreachable one? He has authorised an expert opening its own window and closing it when done; the
measurement pops a window on his screen, so it was offered and not taken. Ask again before building
self-launch. Socket topology: `DESIGN-autonomy.md`, the "Two sockets, not one" section.

**Standing test debt, inherited from review #4 and NOT covered by any gate:** DST boundaries and NTP steps ·
network filesystems (`O_APPEND` does not travel) · scale past ~6 400 records (`analyse()`'s span loop is
O(n²)) · what `resume` and `compact` payloads actually carry · **and the ledger has still never scored a real
defect** — every defect it has ever seen was synthetic. Its first real `record defect` is the test.

**Settled 2026-09-04, NOT open — do not re-litigate, the measurements are in `DESIGN-autonomy.md`:**
`/clear` reports `source: "clear"` (the loop is constructible) · it mints a new session id and transcript ·
it does **not** return RSS, it costs ~14 MB, so the rare real-relaunch mechanism stays on the roadmap ·
one kitty socket per OS window, so `KITTY_LISTEN_ON` is a local world, not the machine.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs`, `install.mjs`, `test/attack.mjs`, `test/selftest.mjs`, `test/latency.mjs` — no dependencies |
| repo | git initialised; **an `origin` on GitHub exists** (`Leonhart130/claude-comm`) — the "local only" line here was stale. Nothing is pushed automatically; the owner decides |
| **electio** | in real daily use — 26 real deliveries, both directions. **Ran a bus 4 commits stale until this session** |
| gates | `attack` **29/29** deterministic, every case proved able to go red · `selftest` 6/6 transport, deterministic · `ledger` **28** arms · `context` and `boot` controls green. Numbers here go stale — run boot |
| boot | `node bin/boot.mjs` — **11 measured rows**, every gating one demonstrated able to go red; `--fast` (0.28 s) is injected at session start by `.claude/settings.json`, the contract is `CLAUDE.md` |
| **ledger** | `node bin/ledger.mjs` — the reboot instrument, **built before the mechanism**. Recording starts HERE since 2026-09-04; **the field is not wired**, which is why the arm that matters is empty |
| reviews | #1, #2, #3 and **#4 (nine findings, three severe, all nine fixed — `REVIEW-adversarial-4.md`, dispositions in `DESIGN-autonomy.md`)** · the electio leader's field reviews |

## ⏭️ OPEN
1. **🔴 Latency is a mailbox, not an interrupt.** Re-derive with `node test/latency.mjs <log>`; the table is
   never transcribed. From 26 real field deliveries: leader→expert median **1462 s**, expert→leader **586 s**.
   The asymmetry is structural — mail lands at the recipient's *turn boundary*. **An agent that is alive but
   idle never receives its mail**, and that one is still open: it is the whole justification for item 3.
   `who` showing "running" does not mean reachable. Never describe this bus as real-time. Gated by A16;
   history in `HISTORY.md`.

2. **`--reply-to <id>` (threading).** Requested by the field, then deprioritised by it: with two agents,
   threading adds identity surface while the substance already lives in the file.

3. **Phase 2 — a wake for the idle agent. Resolver built and verified live; SEND NOT BUILT.** Item 1 is its
   justification. Four constraints are settled and must not be re-litigated: resolve the target through
   `kitten @ ls` and refuse to send when it does not resolve (`send-text --match` **exits 0 on no match**);
   the wake text carries **no substance**, it only makes an idle session take a turn so the gated Stop path
   can deliver; **no daemon, no timer, no watcher** (A21); and identity comes from the pid→window walk, never
   from a title or a cwd. Design and measurements: `DESIGN-autonomy.md`.

4. **🔴 Holding a machine resource is not an event anybody publishes.** Reported from the field
   2026-09-04, and it lands on this bus's design rather than on the reporter's. Two agents inside **one**
   project root collided over a port: an adversarial reviewer took the project's default preview port,
   re-ran a browser suite against it, and twice killed processes listening there — one of which may have
   belonged to the app developer working in the same repo, who discovered his own runner could photograph
   another session's server and moved his port. Everything else the reviewer did was clean.

   **The failure is not transport, which is why a bigger bus would not have prevented it.** Both agents had
   a hub available and still could not see each other, because *nothing in this tool has ever had a concept
   of a thing an agent is holding.* Verified rather than assumed: `bin/comm.mjs` contains no notion of a
   port, a lock or a server — its only "claim" is a sender's identity.

   ⭐ **The fix is a claim file, and it respects the hub rule exactly** — `claims/<resource>` carrying pid,
   purpose and time; the file is the artifact; no transport, no daemon. Three properties: a stale claim is
   **diagnosable, not authoritative** (the pid is there so a reader can see the holder is dead — evidence of
   a crash, never a lock that outlives it); it **advises, it does not enforce** (a mutex every agent can
   delete is a promise the filesystem does not make); and it ships with a gate proved able to go red on a
   claim left by a dead process. **Deliberately not next** — the ledger is — but a second occurrence
   outranks that plan.

5. **🔴 The autonomy mandate — self-launching experts, a self-rebooting leader.** Given 2026-09-04.
   **Everything settled about it lives in [`DESIGN-autonomy.md`](DESIGN-autonomy.md)** — the four verified
   mechanisms, the RAM measurements, the consumer's reply and the review #4 dispositions. Do not re-derive
   any of it here; this entry carries only what is still OPEN.

   **The two findings that shape the feature, because a summary of them would be re-litigated otherwise:**
   the consumer's defects are **BOOT defects, not crowding defects** — four of five authored in the first
   thirteen minutes at 35–42 % of peak — so a reboot multiplies the state where errors are actually made and
   the design effort belongs in the fifteen minutes AFTER a restart. And the handoff carries a **sha256 read
   manifest**, never prose: a rebooted session re-reads only what MOVED. Nothing trusted, something proved.

   ✅ **The instrument was built first** (`node bin/ledger.mjs`) and review #4 has been answered in full.
   🔴 **What is open is the ▶ NEXT above**: the sensor, then the field, then the trigger.

## ⚠️ What was NOT verified

- **Whether the pid→transcript descriptor returns after a cleared session takes a turn**
  (`FINDINGS.md#clear-blind`). It decides whether the blindness is permanent or a window, and it is one
  message in that window away from being answered.
- **The ledger has never scored a real defect.** Sixteen arms move it on synthetic records; nothing has yet
  been recorded by a hand that was not writing a fixture. Its first real `record defect` is the test.
- **Whether two consumers of one hook stdin work.** The ▶ NEXT depends on the generated stub reading the
  payload and handing it to both the bus and the ledger. It currently uses `stdio: "inherit"` and has never
  been asked to do anything else.
- **Whether finding 1 ever actually ate mail in electio.** Still unanswerable — but the reason stated here
  for three sessions was **wrong, and the wrong reason was the more dangerous half.** It said the log "never
  records which agent's hook drained it". It does: `to_agent`, since the initial commit. What it records is
  the **resolved name**, and every theft class this project has had works by making the thief resolve to the
  *victim's* name — so the field is clean by construction in exactly the cases it would need to catch. I
  proved that the hard way on 2026-08-06 (see session 7). `id_src` now separates the two, but it is only on
  rows written from today; the 37 historical rows stay unauditable. Review #1's finding 6, one level up.
- **How long the wandered-cwd window stays open.** Proved within a single `-p` turn. Whether an interactive
  session's Bash cwd resets between turns, or after `/clear`, is unmeasured — it decides the exposure, not
  the existence, of the defect. Now moot for delivery (identity no longer reads cwd) but it still governs
  the `whoami`-returns-null case in open item 2.
- **Behaviour when an agent is mid-tool-call** rather than mid-turn. Still unexercised.
- **`selftest`'s BEHAVIOUR half is not a gate and never will be** — 3 of 6 runs showed the agent not reading
  the file it was pointed at. That is allowed by design, but it means this bus regularly rings a bell nobody
  answers, and no gate can tell you that happened in production.
- **Anything non-Linux**: `comm who` reads `/proc` and degrades to "not running" everywhere else.
- **A8's two guards under partial mutation.** Each alone is uncaught, both together are caught; the
  in-between cases were not enumerated.
- **The `-restored` duplicate id** in electio's log, unexplained across three reviews now.

- **Whether Claude Code enforces `"timeout": 20` on a SessionStart hook.** `--hook` now refuses a TTY, but a
  pipe that never closes still blocks, and `|| true` rewrites an exit code without touching a hang. The
  timeout is the harness's promise and neither I nor review #3 could close it from here.
- **`.boot-state.json` under concurrent writers.** Writes are atomic (rename) since session 10, so no reader
  sees a partial file — but two interleaved read-modify-writes can still lose one update. The record it
  holds is a counter, so a lost count is recoverable where a lost file was not. Not measured.

## A measurement trap, recorded

`delivered/` file mtimes look like drain times and are not — `renameSync` preserves mtime, so they are
*creation* times. The only honest source is the `delivered` field in `.comm/log.jsonl`.

**A second one, from this session:** a probe that reported "the defect does not reproduce" on both arms was
wrong — a relative path in a hand-built hook payload made `findRoot` miss and the hook exit 0 silently,
which is indistinguishable from a clean result. Its positive control passed *because it used an absolute
path and so never travelled the broken path.* **A control that does not go through the same code as the arms
validates nothing.** Both reviewers hit a version of this in the same session and recorded it.

## Where the mistakes are recorded

Findings are written into the code and gate comments at the point they apply (`test/attack.mjs` header for
A8; the A10 rewrite note; `hookDeliver`'s identity comment; `firstPositional`; `resolveRef`/`refForRecipient`
in `bin/comm.mjs`). *A rule whose cost you cannot see is a rule someone will simplify away.*
