# STATUS — claude-comm, 2026-09-04 (sessions 4–12)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

**1 — Fix the context sensor. It reports the context of a session that no longer exists.**

`FINDINGS.md#clear-blind` carries the measurement, the two candidate fixes, and the counter-example that
killed the cheaper one — read it, do not re-derive it. The short version: a cleared process keeps its
**launch** session's scratch directory forever, so pid→transcript returns the dead session's file and its
final number with exit 0. A self-rebooting leader is a cleared session by construction, and its pre-clear
context is large by definition — so the trigger would re-fire at once and the agent would reboot forever,
looking from outside exactly like the feature working. The `Stop` path is safe; its payload carries
`transcript_path` outright.

**Nothing that reads a context by pid may be built or shipped before this.** The favoured fix is a registry
written at `SessionStart` — boot already holds the payload and can resolve the session pid, so it can record
`pid + process start time → transcript` and refresh it on every start, clears included. The open decision is
where that file lives for a project whose SessionStart hook is not boot's.

**2 — Then wire the field to the ledger.** `bin/ledger.mjs` records only here; `~/Dev/work` and
`~/Dev/electio` run `.claude/comm-hook.mjs session-start`, which knows nothing about it. The reboots happen
there, so the arm that matters is empty. Four things the next session needs and would otherwise re-derive:

1. **The obstacle is one line of the generated stub**: it forwards with `stdio: "inherit"`, so the payload on
   stdin is consumed once, by the bus. Read it ONCE, hand the bytes to both, and never let the ledger's spawn
   delay or fail delivery.
2. **This is a delivery change** — `node test/selftest.mjs` and `--prove-red`, before and after.
3. **The agent name comes from the stub's location** (`--agent-root`), never cwd, never the payload. The stub
   already resolves it that way; reuse the value.
4. **Re-install into both field projects**, then confirm `field:*` is still green — a drifted stub is a RED row.

**3 — Only then the trigger.** Per the consumer's §2.4 it is *"you re-fetched a file you already read this
session"*, countable by a hook, not a token threshold. Its confound is theirs, priced at ~30 min; ask rather
than guess.

⚠️ **Do not build the reboot mechanism ahead of 1 and 2.** Shipping it onto a sensor that reads a dead
session, into a project with no control arm, is the same mistake twice with the instrument as an alibi.

**Settled today and NOT open — do not re-litigate, the measurements are in `DESIGN-autonomy.md`:**
`/clear` reports `source: "clear"` (the loop is constructible) · it mints a new session id and transcript ·
it does **not** return RSS, it costs ~14 MB, so the rare real-relaunch mechanism stays on the roadmap.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs`, `install.mjs`, `test/attack.mjs`, `test/selftest.mjs`, `test/latency.mjs` — no dependencies |
| repo | git initialised; **an `origin` on GitHub exists** (`Leonhart130/claude-comm`) — the "local only" line here was stale. Nothing is pushed automatically; the owner decides |
| **electio** | in real daily use — 26 real deliveries, both directions. **Ran a bus 4 commits stale until this session** |
| gates | `attack` **26/26** deterministic ✓, **every case proved able to go red** (defect restored in the bus, gate byte-identical) · `selftest` **now deterministic too** — 6/6 transport green |
| boot | `node bin/boot.mjs` — 7 measured rows, **every gating one demonstrated able to go red**; `--fast` (0.28 s) is injected at session start by `.claude/settings.json`, the contract is `CLAUDE.md` |
| **ledger** | `node bin/ledger.mjs` — the reboot instrument, **built before the mechanism**. 18 arms proved red. Recording cold starts HERE since 2026-09-04; **the field is not wired** |
| reviews | #1 (9 findings) in `REVIEW-adversarial.md` · #2 (10 findings) in `REVIEW-adversarial-2.md` · electio leader's field reviews in `REVIEW-electio-leader.md` and `REPLY-from-electio-leader.md` |

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
   Four mechanisms verified available (both hook payloads carry `transcript_path`; `SessionStart` carries
   `source`; the transcript's `usage` gives the exact context; kitty + the pid→window resolver are live).
   **Design, measurements and open unknowns: [`DESIGN-autonomy.md`](DESIGN-autonomy.md).** The headline the
   owner accepted: a reboot buys QUALITY, not tokens — and the boot read set is the lever that matters.

   **🔴 The consumer answered, and it changes the feature.** Four of five defects in its most defect-dense
   session were authored **in the first thirteen minutes, at 35–42 % of peak context** — its defects are
   BOOT defects, not crowding defects, so a reboot multiplies the state where errors are actually made. The
   design effort belongs in the fifteen minutes AFTER a restart. The only monotone degradation signal it
   could measure is re-opens (37 % → 87 % across context deciles, 51 sessions, 0 % duplicate calls), so the
   trigger should be *"you re-fetched a file you already read"*, not a token count. And the handoff must
   carry a **sha256 read manifest** rather than prose, so a rebooted session re-reads only what MOVED —
   nothing trusted, something proved. Full record in `DESIGN-autonomy.md`; my answer and the three things I
   owe it in `exchange/work-leader/2026-09-04-lifecycle-answer.md`. **Next: the ledger before the
   mechanism** — the first ten reboots must be measurable or the feature has no way to be judged.

   ✅ **The ledger is built, and it was built first** — `node bin/ledger.mjs`, 18 arms proved red,
   `DESIGN-autonomy.md#the-ledger` and `FINDINGS.md#ledger-control` / `#ledger-blame` / `#ledger-unknown`.
   It records **every session start**, not only reboots, because the comparison is reboot-start against
   cold-start and the control arm has to exist before the feature does. Boot writes a record on every start
   here and carries a `ledger` row that says whether *this* start landed — an instrument that goes silent
   must not read as a quiet world. **🔴 The field is NOT wired: `~/Dev/work` runs `comm-hook.mjs`, not boot,
   so the arm that matters is empty.** That is the ▶ NEXT.

   ⚠️ **It corrected my numbers and the corrections are settled** — population, "worst boot" (170 568, not
   220 200), and an 18-day doubling that means any threshold tracks the *current* boot cost. Kept in
   `DESIGN-autonomy.md`; the consultation itself is in `exchange/work-leader/`.

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
