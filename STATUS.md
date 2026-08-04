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
| gates | `attack` 10/10 deterministic ✓ · **`selftest` is FLAKY — see open item 1** |

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
2. **🔴 Latency is a mailbox — not an interrupt.** Across 18 real deliveries:

   | direction | n | median | max |
   | --- | --- | --- | --- |
   | leader → web-app | 8 | **1422 s (23.7 min)** | 2372 s (39.5 min) |
   | web-app → leader | 12 | 639 s (10.6 min) | 2101 s (35 min) |

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
