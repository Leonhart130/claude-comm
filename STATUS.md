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
| gates | `attack` **12/12** deterministic ✓ (A11, A12 added from the review) · **`selftest` is FLAKY — open item 1** |
| review | adversarial review 2026-08-05 in `REVIEW-adversarial.md` — **9 findings, all 9 confirmed by reproduction, all 9 fixed** |

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

1. **🔴 `selftest` is flaky: ~1 run in 6 goes red with nothing wrong.** Measured, not suspected —
   6 runs at committed `f439bd4` failed once, 5 runs at the current tree failed once. It is
   **pre-existing**, not caused by the session-2 changes; that is why the comparison was run in a
   worktree rather than argued.

   The cause is structural: ARM A asserts a *sentinel token appears in a real headless agent's output*,
   which measures two things at once — that the transport injected the nudge, and that the model chose
   to obey it. Only the first is deterministic. **A gate that reddens at random trains you to re-run it
   until green, which is worse than having no gate**, and it also means a green `selftest` is weak
   evidence. Fix: split the assertion — check the injected nudge text deterministically (hook output),
   and treat model compliance as a separate, explicitly probabilistic check.
2. **🔴 Latency is a mailbox — not an interrupt.** Across **22 real deliveries** (25 log lines, 24 unique
   ids after dropping one duplicate, minus the 2 sub-second headless proofs). Median = mean of the two
   middle values; re-derivable from `~/Dev/electio/.comm/log.jsonl`:

   | direction | n | median | max |
   | --- | --- | --- | --- |
   | leader → web-app | 10 | **1462 s (24.4 min)** | 2372 s (39.5 min) |
   | web-app → leader | 12 | 586 s (9.8 min) | 959 s (16.0 min) |

   ⚠️ **The previous version of this table was wrong**, caught by the adversarial review and confirmed by
   re-derivation. It said n=8 / n=12 and "18 real deliveries" while the table summed to 20; the n=12
   silently included the 2 headless proofs the prose claimed to exclude; and the old `web-app → leader` max
   of 2101 s was the duplicate id `…-restored` counted twice, its second drain inflating the tail. The
   medians moved because the log kept growing after the first measurement. **A table a reader cannot
   re-derive from its stated source is the thing this repo exists to prevent** — it is now recomputed by
   script, not transcribed.

   The asymmetry is structural: mail lands at the recipient's *turn boundary*, and the expert's
   implementation turns are long, so nudges **to** the expert wait roughly twice as long. Operational
   consequence: a mid-round correction ("the dataset changed under you") can arrive ~24 min late, after the
   expert has already built on the stale assumption. The 17:45 nudge is exactly that shape.

   ⚠️ **The electio leader sharpened this, and its version is worse than the measurement.** Latency is not
   bounded by turn length — it is *time until the recipient next does anything*:

   > **An agent that is alive but idle never receives its mail.**

   It hit this twice: the expert held 2 then 3 messages for long minutes, session alive and `pid` visible
   in `who`, because it was in no turn at all. So `who` showing "running" does **not** mean reachable.
   The bus removes the owner as a *content relay* but not as a *wake mechanism*. Do not describe the bus
   as real-time in any doc.
3. **`--reply-to <id>` (threading), requested by the leader.** Its day is *brief → round → verdict*, six
   times over; `REVIEW.md` knows these are threads, the bus does not. Would make `log` readable as a
   conversation. Not built — the one request from its list still outstanding.
4. **Phase 2, deferred by the owner:** kitty socket for a true mid-turn interrupt
   (`allow_remote_control socket-only` + `listen_on`, needs a restart). Item 2 is its justification, and
   the leader independently arrived at the same conclusion. ⚠️ Before relying on it, verify `kitten @ ls`
   resolves splits by title on a scratch split — a `--match` that matches nothing sends the nudge into the
   void and looks exactly like an agent ignoring it. A third option surfaced by the owner: an **MCP channel
   that pushes into the session** (`--dangerously-load-development-channels`, per the cc2cc write-up).
   In-protocol rather than terminal-level, but undocumented, dev-flagged, and **unverified on 2.1.221** —
   it is not in `--help` and the parser test was blocked by the permission classifier.
5. **selflo is now UNINSTALLED** (owner's call, 2026-08-04 — focus is electio). Removed: `.comm/`, 7 hook
   shims, the comm hooks from 7 `settings.json`, and the `.gitignore` entry. Backup:
   `scratchpad/selflo-comm-backup-2026-08-04.tgz`. ⚠️ Its `COORDINATION.md`, `scripts/sync-agent-files.mjs`
   and 6 `docs/START_HERE.md` **still document the bus** — deliberately left, since reinstalling is one
   command, but an agent relaunched there before reinstall will follow those docs into a missing file.

## ✅ Done in session 3, from the adversarial review

Every finding was **reproduced before being fixed** — none was taken on the reviewer's word — and the two
🔴 silent-failure ones are now permanent gates (A11, A12) so they cannot come back quietly.

| # | defect | fix |
| --- | --- | --- |
| 1 🔴 | `--ref` carried the exact injection A8 exists to stop — a newline in a path forged a top-level `[SYSTEM]` line in the recipient's context, uncapped on the `inbox` surface | refused at send, flattened at render (`safeRef`), capped at `MAX_REF`; gated by **A11** |
| 2 🔴 | `install.mjs` replaced an unparseable `settings.json` with only its own hooks — permissions, env, unrelated hooks gone, exit 0. Had already run against 7 agents | absent ≠ unparseable; a file we cannot read is one we must not overwrite. Skips that agent, reports it, exits 1 |
| 3 🔴 | an agent id ≠ its directory name was permanently unreachable while `send`, `who`, `sent` and the hook all reported normal — and the README invites the rename that triggers it | `whoami` resolves cwd against config **values**, longest path first; fixes nesting too; gated by **A12** |
| 4 🟠 | a ref was never checked for existence — the recipient was told "re-read the artifact" about nothing | `existsSync` at send, `--force` for a file you are about to write |
| 5 🟠 | A2 graded its own homework: threshold 3000 against 2-char notes, while the documented maxima render ~3784 | corpus driven to `MAX_NOTE`/`MAX_REF`, budget derived from the constants. Also added lower bounds to A2/A3 — with an empty inbox both passed on **zero bytes** |
| 6 🟠 | the log could not tell a delivery from a dismissal, and `dismiss` had no identity check while `send` did — an expert could clear the leader's `blocked` report and the sender was told it landed | `via: hook\|dismiss` in `drain`; dismissing another agent's inbox needs `--force`; `comm sent` shows `✗ DISMISSED` |
| 7 🟡 | session start rendered UTC without a date | local time, dated when not today |
| 8 🟡 | `.gitignore` was only edited if it already existed, so fresh projects never ignored `.comm/` | created when absent |
| 9 🟡 | STATUS's own latency table did not re-derive from its source | recomputed by script — see open item 2 |

⚠️ **Finding 7 was overstated and I say so rather than quietly banking it:** `since` was computed and
**never rendered anywhere**, so `comm who` printed no time at all. The concern was sound (that field decides
armed-vs-not, and STATUS had to reach for `ps` to answer it), so it is now correct *and* displayed.

⚠️ **A consequence of fixing 6 that is worth stating:** no historical log row carries a `via` field, so for
every delivery before this change, delivery and dismissal remain indistinguishable. The table in open item 2
is exposed to that, unquantified. New rows are not.

## ✅ Done in session 2, from the electio leader's field review

Its full text is in `REVIEW-electio-leader.md` — 24 messages over ~20 hours, zero lost, and it names its
own author's usage errors before the tool's.

- **`inbox` now says it is a PEEK.** Its top request, and the cheapest. Reading mail with `inbox` does not
  acknowledge it, so the leader read messages, acted, and was then blocked at its turn end by the hook
  re-delivering the same mail — twice, each time costing a turn to re-diagnose as "not a bug". The two
  surfaces an agent actually discovers the bus through (this listing and the hook notice) were the two
  that never mentioned `dismiss`.
- **The hook notice says "already acknowledged" — deliberately NOT "run dismiss".** Its request was to
  mention `dismiss` on both surfaces; on this one that would be wrong. By the time the notice is read the
  mail is already drained, so a dismiss hint sends the agent to a command that prints "nothing to dismiss".
- **`comm sent` added** — sender-side delivery visibility, its second request. It had been inferring
  whether briefs landed by watching the expert's commits. Distinguishes ✓ delivered from ⧗ pending, and
  calls out the dangerous case explicitly: *running but has not ended a turn since* (item 2).
- **Fixed a real bug the gates pass straight over**, found by running the new command rather than reading
  it: every command documented as `[<agent>] [--flag X]` bound the agent to the *flag name* when the agent
  was omitted. `comm dismiss --id abc` looked up an agent literally called `--id` and reported "nothing to
  dismiss" — a clean no-op instead of an error. `rest[0]` → `firstPositional()` at all four call sites.
- **Design ruling, on its recommendation: `--ref` stays mandatory and `--body` is refused.** Its second
  reason is better than the security one and is now the standing justification: a round written by the
  expert must stay an assertion about what *it* verified. Injectable text erases the line between measured
  and suggested, which is the whole value of the project.

## ⚠️ What was NOT verified

- **`comm sent`'s third branch** — *"running but has not ended a turn since"*. The other two were proved on a
  scratch bus (`⧗ pending`, agent not running) and against electio's real log (`✓ delivered`); this one needs
  a live agent holding mail, and the only real one is in the owner's working project, where sending a probe
  message would inject a nudge into a session doing actual work. Not done without asking.
- **Behaviour when an agent is mid-tool-call** rather than mid-turn. Still unexercised, and the long tail in
  item 2 may partly be this — or may be the idle case the leader identified. The log cannot distinguish them.
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
