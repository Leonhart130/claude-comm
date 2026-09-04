# STATUS — claude-comm, 2026-08-06 (sessions 4–7)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

**Build the ledger before the reboot mechanism. Do not build the mechanism first.**

The ruling is the other project's leader, and it is right: *"nobody can answer whether a rebooted session is
measurably worse, because there has never been a reboot. If you ship it, ship the instrument with it — the
first ten reboots must be a query, not a debate. A feature with no ledger is a hobby."*

Concretely, in this order:

1. **Define the reboot record.** One JSON line per lifecycle event in `.comm/handoff/<agent>.log` (beside
   the handoff, same gitignored live-state territory): timestamp · agent · trigger that fired and its
   measured value · context before · context after · which files the sha256 manifest said had moved · and a
   field for what the session got wrong afterwards, filled in later by whoever finds it.
2. **Write the query first, then the writer.** `node bin/ledger.mjs` must answer *"did sessions after a
   reboot produce more retracted findings than sessions that were not rebooted"* — and must say **UNKNOWN**
   rather than a number until there are enough records. Build it against synthetic records so its shape is
   settled before any real one exists; a ledger designed after the fact is designed to confirm.
3. **Prove it can go red** (`--prove-red`), like every other gate here: one variable moved, and it must
   report a degradation that is there and refuse to report one that is not.
4. **Only then** wire the trigger. Per the consumer's §2.4 the trigger is *"you re-fetched a file you
   already read this session"*, countable exactly by a hook — not a token threshold. Its confound
   (propagation vs retrieval) is theirs to resolve and they priced it at ~30 minutes; ask before guessing.

⚠️ **The thing that makes this hard is not the code.** Their finding is that four of five recorded defects
were authored in the *first thirteen minutes* of a session, at 35–42 % of peak context. A reboot manufactures
more first minutes. So the ledger's real question is not "did the reboot save tokens" — it is **"did the
fifteen minutes after a restart cost us a defect"**, and the record must be shaped to answer that one.

Still mine to measure, unchanged: whether `/clear` reports `source: "clear"` and whether it returns RSS. The
boot records the first automatically; nothing to do but wait for a real clear.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs`, `install.mjs`, `test/attack.mjs`, `test/selftest.mjs`, `test/latency.mjs` — no dependencies |
| repo | git initialised, local only, no remote |
| **electio** | in real daily use — 26 real deliveries, both directions. **Ran a bus 4 commits stale until this session** |
| gates | `attack` **26/26** deterministic ✓, **every case proved able to go red** (defect restored in the bus, gate byte-identical) · `selftest` **now deterministic too** — 6/6 transport green |
| boot | `node bin/boot.mjs` — 6 measured rows, **every gating one demonstrated able to go red**; `--fast` (0.2 s) is injected at session start by `.claude/settings.json`, the contract is `CLAUDE.md` |
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

## ⚠️ What was NOT verified

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
