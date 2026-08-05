# STATUS — claude-comm, 2026-08-05 (sessions 4–5)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs`, `install.mjs`, `test/attack.mjs`, `test/selftest.mjs`, `test/latency.mjs` — no dependencies |
| repo | git initialised, local only, no remote |
| **electio** | in real daily use — 26 real deliveries, both directions. **Ran a bus 4 commits stale until this session** |
| gates | `attack` **17/17** deterministic ✓, **every case proved able to go red** (defect restored in the bus, gate byte-identical) · `selftest` **now deterministic too** — 6/6 transport green |
| reviews | #1 (9 findings) in `REVIEW-adversarial.md` · #2 (10 findings) in `REVIEW-adversarial-2.md` · electio leader's field reviews in `REVIEW-electio-leader.md` and `REPLY-from-electio-leader.md` |

## ✅ Closed in session 4 — adversarial review #2

All 10 findings reproduced before being fixed, plus open item 1 (the flaky `selftest`) closed, and **every fix is pinned by a gate that was demonstrated
to go red.** The two 🔴 are the ones that matter.

| # | defect | fix |
| --- | --- | --- |
| 1 🔴 | **A leader that `cd`s into the expert's repo drained the expert's inbox.** The Stop payload's `cwd` follows the *Bash tool's* directory, so `cd web-app && git log` ended the turn identified as the expert. Mail announced into the wrong context, moved to `delivered/`, logged `via=hook`. Sender told `✓ delivered`. Symmetric, and present in electio's bus | identity now comes from the hook stub's own location (one per agent), never from the session cwd. Gated by **A13** |
| 2 🔴 | **A10 could not go red.** It asserted `after === 0 \|\| after === before` — true for every reachable value — so the only live clause was `exit === 0`, and its fixture never failed to render. Moving `drain` ahead of `render` left the whole gate green | asserts the conjunction the code states (no nudge ⇒ mail kept), with an injected render failure. Proved red |
| 3 🟠 | `comm log` and `comm sent` rendered a raw ref — a forged `[SYSTEM]` line in the **leader's** own audit surfaces | `safeRef` on both. Gated by **A15** |
| 4 🟠 | `dismiss --force leader` cleared the **operator's own** inbox and reported success — `--force` takes no value, and `firstPositional` swallowed the next token. Reachable by following the tool's own error text | valueless-flag set. Gated by **A14** |
| 5 🟠 | A11's "refused at send" was satisfied by the *existence* check, so the control-character rule it guards could be deleted with A11 still green | asserts the refusal **reason**, not the exit code. Proved red |
| 6 🟠 | A2 built both its corpus and its budget from its **own** copies of the constants — raising `MAX_REF` in the bus moved nothing | constants imported from the bus, **plus an absolute ceiling** — see the retraction below |
| 7 🟡 | `install --check` exited 0 while an agent was entirely uninstalled; "across 3 agents" counted the roster, not the installs | a roster entry with no directory now fails the check |
| 8 🟡 | the `inbox` peek hint told you to run a `dismiss` the identity guard refuses | hint matches the guard (`dismiss <agent> --force`) |
| 9 🟡 | `comm sent` quarantined corrupt files as a side effect and said nothing | reports the count, as `who` already did |
| 10 🟡 | the installer said hooks "take effect in the NEXT session" — true of `settings.json`, **false of the bus**, the only file an upgrade changes | says both, explicitly |
| 11 🔴 | **`selftest` reddened ~1 run in 6 with nothing wrong** — ARM A asserted a sentinel reached a real agent's *output*, measuring the transport AND the model's choice to obey | split: **transport** (hook fired, right mail drained, logged `via=hook`) is deterministic and is the gate; **behaviour** (did the agent read?) is reported, never gated |

⚠️ **A retraction on finding 6, because it was my fix that was wrong.** Importing the constants did *not*
close it: the budget is derived from them, so raising `MAX_REF` raised the budget too and A2 still could
not fail — **the same tautology as finding 2, reintroduced by the fix for finding 6.** Caught only because
the mutation was actually run. A2 now carries an absolute ceiling as well, and the fix for a red there is
never to raise the ceiling.

⚠️ **What the electio leader got right and what it got wrong.** It reported the symptom of finding 1 and
diagnosed it as an unscoped imperative in the nudge. The imperative concern is real and secondary; its
proposed fix would have left the mail theft in place. Its *observation* is what made the finding.

## ✅ Closed in session 5 — the electio leader's §3

🔴 **N sessions in ONE tree shared ONE inbox, and the fix for the cross-tree theft made it structural.**
The leader reported it and explicitly declined to diagnose it ("my diagnoses are worth less than my
observations") — it left the test arm to me. Measured with real sessions: an expert's `done` addressed to
the leader was consumed by a **classifier's** turn end, drained, logged `via=hook`, `comm sent` showing
✓ delivered. The leader would never have learned the round landed.

**This was live on the owner's machine while it was being fixed** — `comm who` against the real project:

```
● leader   running (pid 335746,341714,341833,341956,342041)  ⚠ 5 SESSIONS SHARE THIS INBOX
```

Fix: a session may **declare** its identity (`CLAUDE_COMM_AGENT`), and the declaration wins over the
directory. An unknown name means *not on the bus* — receive nothing, drain nothing — so the unsafe case is
the loud one. Unset keeps the directory fallback, so every existing install is unchanged. `comm who` now
reports when several live sessions resolve to one agent. Gated by **A17**.

⚠️ **The honest limit: the default is still the unsafe one.** A session that declares nothing falls back to
the directory, so protection requires the operator to declare on the *non-bus* sessions. Inverting it would
silently cut off every existing install, which is worse. `who` makes the condition visible; it does not
prevent it.

⭐ **The leader's question was better than a fix would have been:** *is "one agent = one directory" the right
axiom for a bus whose hub is exactly where you parallelise?* No — and the answer is that the name must be
declarable, not derived. That is a design change it surfaced by asking rather than by proposing.

## ⏭️ OPEN

1. **🔴 Latency is a mailbox — not an interrupt.** Re-derive with `node test/latency.mjs <log>`; the table
   is no longer transcribed. From electio's 26 real deliveries:

   | direction | n | median | max |
   | --- | --- | --- | --- |
   | leader → web-app | 12 | **1462 s (24.4 min)** | 3324 s (55.4 min) |
   | web-app → leader | 14 | 586 s (9.8 min) | 986 s (16.4 min) |

   The asymmetry is structural: mail lands at the recipient's *turn boundary*, and the expert's turns are
   long. **An agent that is alive but idle never receives its mail** — the electio leader hit this twice,
   session alive and pid visible, because it was in no turn at all. `who` showing "running" does not mean
   reachable. Do not describe the bus as real-time in any doc.

   ⚠️ **A second mechanism contributed to this tail, and it is now FIXED — which means the historical
   numbers above are worse than what the bus does today.** Review #2 found that a turn ending with cwd in a
   non-agent directory made `whoami` return null, so the hook exited 0 and the agent's own mail was silently
   not delivered. Measured on the pre-fix bus, leader's own mail, one variable moved:

   | turn ends in | old bus | new bus |
   | --- | --- | --- |
   | `.` (root) | delivered | delivered |
   | `docs/`, `scripts/` | **silently not delivered** | delivered |
   | `web-app/` (another agent's dir) | **stolen — drained into the wrong inbox** | delivered |

   So an unknown share of the tail was a turn that simply ended in the wrong directory, not an idle agent.
   The log cannot say which rows. Going forward only idleness remains, and **that one is still open** — it
   is the whole justification for item 3. Gated by **A16**.

   ⚠️ **All 26 rows predate the `via` field, so delivery, dismissal, and a drain by the wrong agent are
   indistinguishable across the whole history.** The script says so on every run rather than printing a
   clean table. New rows are not exposed to this.
2. **`--reply-to <id>` (threading).** Requested by the electio leader in review #1 — and **deprioritised by
   it in its follow-up**: with two agents, threading adds identity surface while the substance already lives
   in the file. It ranks the wake mechanism (item 3) above this.
3. **Phase 2, deferred by the owner:** kitty socket for a true mid-turn interrupt. Item 1 is its
   justification. **Feasibility now MEASURED** (kitty 0.47.4, headless throwaway instance, owner's terminal
   untouched — `scratchpad/kitty-probe.sh`):

   | | result |
   | --- | --- |
   | `kitten @ ls` exposes window titles | ✓ — splits are addressable by title |
   | `send-text --match title:<exists>` | ✓ — text arrives in the target window |
   | `send-text --match <matches nothing>` | 🔴 **exit 0, silent, discarded** |

   The last row was the open warning and it is confirmed, with a control proving the match — not a dead
   window — is what swallowed it. **So the kitty transport ships with exactly the silent-discard property
   this bus spent two reviews removing:** the sender is told it worked and the nudge never existed.

   ⇒ **Design constraint, not a caution: Phase 2 must resolve the match through `kitten @ ls` and refuse to
   send when it does not resolve.** `send-text`'s own exit code may never be treated as delivery evidence.

   ⚠️ **Cost the owner must weigh first:** remote control is currently OFF (`allow_remote_control` and
   `listen_on` both unset, `KITTY_LISTEN_ON` empty). Turning it on needs a kitty.conf change **and a full
   restart, which kills every running agent session.** Third option surfaced by the owner: an **MCP channel
   that pushes into the session** (`--dangerously-load-development-channels`) — undocumented, dev-flagged,
   **unverified**.
4. **selflo is UNINSTALLED** (owner's call, 2026-08-04). Backup:
   `scratchpad/selflo-comm-backup-2026-08-04.tgz`. ⚠️ Its `COORDINATION.md`, `scripts/sync-agent-files.mjs`
   and 6 `docs/START_HERE.md` **still document the bus** — an agent relaunched there before reinstall will
   follow those docs into a missing file.

## ⚠️ What was NOT verified

- **Whether finding 1 ever actually ate mail in electio.** Structurally unanswerable: the log records *that*
  a message was drained, never *which agent's hook* drained it, and every historical row lacks `via`. The
  mechanism is proven; the history cannot be audited. This is review #1's finding 6 recurring one level up.
- **How long the wandered-cwd window stays open.** Proved within a single `-p` turn. Whether an interactive
  session's Bash cwd resets between turns, or after `/clear`, is unmeasured — it decides the exposure, not
  the existence, of the defect. Now moot for delivery (identity no longer reads cwd) but it still governs
  the `whoami`-returns-null case in open item 2.
- **`SessionStart` under cwd drift.** It shares `hookDeliver`, so it shares the fix by construction, but
  every case run here fires `Stop`.
- **Behaviour when an agent is mid-tool-call** rather than mid-turn. Still unexercised.
- **`selftest`'s BEHAVIOUR half is not a gate and never will be** — 3 of 6 runs showed the agent not reading
  the file it was pointed at. That is allowed by design, but it means this bus regularly rings a bell nobody
  answers, and no gate can tell you that happened in production.
- **Anything non-Linux**: `comm who` reads `/proc` and degrades to "not running" everywhere else.
- **A8's two guards under partial mutation.** Each alone is uncaught, both together are caught; the
  in-between cases were not enumerated.
- **The `-restored` duplicate id** in electio's log, unexplained across three reviews now.

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
