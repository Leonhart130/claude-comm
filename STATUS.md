# STATUS — claude-comm, 2026-08-05 (sessions 4–6)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs`, `install.mjs`, `test/attack.mjs`, `test/selftest.mjs`, `test/latency.mjs` — no dependencies |
| repo | git initialised, local only, no remote |
| **electio** | in real daily use — 26 real deliveries, both directions. **Ran a bus 4 commits stale until this session** |
| gates | `attack` **20/20** deterministic ✓, **every case proved able to go red** (defect restored in the bus, gate byte-identical) · `selftest` **now deterministic too** — 6/6 transport green |
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

⚠️ **And I attacked my own fix hours after writing it, which is where the yield was.**
`CLAUDE_COMM_AGENT` is an environment variable, and the obvious way to silence three classifiers at once is
to **export** it — at which point the real leader launches off-bus too. Measured with a live control:

| surface | said | truth |
| --- | --- | --- |
| `comm who` | `○ leader  not running` | it **is** running |
| `comm sent` | `⧗ pending — lands when relaunched` | relaunching under the same export changes **nothing** |

That is the A12 failure class — four diagnostics agreeing on a confident wrong answer — reintroduced by the
fix for A17, by me, the same day. `who` now reports off-bus sessions and `sent` says `⧗ STUCK` with the
reason. Gated by **A19**.

✅ **Confirmed in the field the next morning, unprompted.** After the reboot the owner relaunched all three
electio sessions with the declaration set — `leader`, `web-app`, and `none` on an adversarial reviewer
sharing the leader's directory. `comm who` reports one pid per agent and the shared-inbox warning is gone,
on the exact layout that produced it. Read from `/proc/<pid>/environ`, not from anyone's report.

⚠️ **One honest limit of that display, unchanged:** the off-bus warning is printed only when the agent has
*no* live session (`!l && off`). Here the reviewer is off-bus in the leader's directory while the leader
runs, so `who` says nothing about it. That is correct — an off-bus session drains nothing — but it means
`who` confirms "the leader is on the bus", never "nothing else is sitting in its tree".

⭐ **The leader's question was better than a fix would have been:** *is "one agent = one directory" the right
axiom for a bus whose hub is exactly where you parallelise?* No — and the answer is that the name must be
declarable, not derived. That is a design change it surfaced by asking rather than by proposing.

### SessionStart — the debt, paid

Twice I wrote that `SessionStart` was covered "by construction" because it shares `hookDeliver`. That is
reasoning, and this session already showed what reasoning is worth here. Exercised properly, including one
real launch:

| | result |
| --- | --- |
| output schema (`hookSpecificOutput` / `additionalContext`) | ✓ correct |
| **a real session actually receives it** | ✓ the agent quoted the injected notice back verbatim |
| mail drained at launch | ✓ |
| declared identity honoured on this path | ✓ `none` does not drain, the real agent does |
| wording | 🟡 **wrong** — announced mail as arriving *"while you were working"* to a session that had just launched and never worked |

No defect on the path that mattered, which is worth stating as plainly as a defect would be. The wording is
fixed and the whole path is now gated by **A18**. It deserved the attention: it is the only path that serves
a stopped agent, it fires when the inbox is fullest, and a rejected schema there would drain mail and show
it to no one.

## ✅ Closed in session 6 — a gate went red on its own

🔴 **A declared identity was matched globally, so it leaked across projects.** `whoami` returned on the
declaration without ever checking the process lives in *this* project — and **every project in this
framework has an agent named `leader`.**

I did not go looking for this. `attack` was run as a routine check after the reboot and **A19 failed with
no code change since it was committed.** The cause: the real electio leader, relaunched that morning with
`CLAUDE_COMM_AGENT=leader`, was counted as a live `leader` inside A19's own throwaway temp project, which
made `who` take the "agent is running" branch and skip the off-bus warning A19 exists to assert.

Reproduced with one variable moved — same box, same live sessions, same directory, only the agent's **name**
changed in an unrelated temp project:

| `.comm/config.json` agent name | `comm who` in `/tmp/comm-leak-BPO8` |
| --- | --- |
| `chief` | `○ chief  not running` |
| `leader` | `● leader  running (pid 388580)` ← **a session in `~/Dev/electio`** |

Everything built on `liveAgents` inherited it: `send` and `sent` would report a recipient as reachable with
nothing listening, and `who` would print a live pid for a project whose leader was not running at all.
That is the A12 failure class again — a confident wrong answer, agreed on by several surfaces.

Fix: the declaration still wins over the directory, but only within its own project — `findRoot(process cwd)`
must resolve to this root. Safe to make stricter because `liveAgents` only ever *reports*; delivery anchors
on the hook stub's location, so a stricter answer here cannot lose mail. A session's own cwd is stable under
the Bash tool's `cd` (verified against a live session), so this is not the wandering-cwd surface finding 1
removed.

**Gated by A20, proved red with the defect restored in the bus and the gate byte-identical** — and it fails
on the arm that matters: `foreign reported running=true (want false)` while `native` stays `true`. A20 carries
both arms deliberately: from the foreign arm alone, "scoped correctly" and "declared liveness switched off
entirely" are indistinguishable.

⚠️ **This is the third consecutive session in which the highest-value finding was in the previous session's
fix** — A17 (declared identity, session 5) created it, exactly as [[attack-the-recent-fix]] predicts. It was
caught by a contradiction from outside, never by re-reading the patch.

⚠️ **electio is now running a bus one commit stale** (its `.comm/bin/comm.mjs` was byte-identical to the
repo before this fix). No live impact there today — it is the only installed project, so no name collides —
but the moment a second project is installed, or selflo is restored, it collides on `leader`.

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
3. **Phase 2 — kitty wake for the idle agent. RESTART DONE, RESOLVER BUILT AND VERIFIED LIVE, SEND NOT BUILT.**
   Item 1 is its justification: an agent alive but in no turn never receives its mail, and that is the last
   delivery gap.

   **2026-08-05, after the owner's reboot — measured against the four real sessions on his screen**
   (`node test/kitty-resolve.mjs <pid>...`, read-only, sends nothing):

   | | result |
   | --- | --- |
   | remote control survived the restart | ✓ socket `/tmp/kitty-384996`, `KITTY_LISTEN_ON` set in every window |
   | every live agent resolved to exactly one window | ✓ 4/4, distinct windows, via nearest-ancestor `/proc` walk |
   | a live process outside kitty is refused | ✓ orphaned stand-in → chain `408083 → 5084 → 1`, unresolved |
   | pid 1, and kitty's own pid as a window root | ✓ both correctly refused / absent |

   🔴 **The obvious implementation would have been a permanent silent no-op.** `@ ls` reports a window
   `pid`, and it is the window's **shell** — the agent is in `foreground_processes`. Matching `window.pid`
   against the pids `comm who` knows resolved **0 of 4** on the real layout. Under constraint 2 (refuse
   when the match does not resolve) that is a wake that never fires and reads on screen exactly like *"no
   idle agent needed waking"* — this project's signature failure shape, and it is kept as a live control in
   the probe rather than as a comment.

   ⚠️ A whole-chain match is *not* equivalent to nearest-ancestor: every chain passes through kitty itself
   and up to init, so a wider match adds only false hits. Refusing those as "ambiguous" would be safe in
   the wrong direction — the same silent no-op. The nearest ancestor that is a window's root **is** the
   window; there is nothing to disambiguate.

   **Constraint 1 is now confirmed by observation rather than argument.** Two of the five windows share
   `/home/leonh/Dev/electio` (the leader and an off-bus adversarial reviewer), so cwd cannot identify an
   agent — and the window **title changed between two `@ ls` calls seconds apart**, because the spinner
   glyph is part of it (`⠐ Consult with leader expert` → `⠂ …`). Titles are not merely fragile; they are
   not stable across two consecutive reads.

   **Done 2026-08-05:** `~/.config/kitty/kitty.conf` now sets `allow_remote_control socket-only` and
   `listen_on unix:/tmp/kitty-{kitty_pid}` (backup in scratchpad). `socket-only` because the windows run
   coding agents — it means the socket is the only control path, not in-band escape codes from inside a
   window. ⚠️ *That refusal is kitty's documented behaviour; I verified the socket path works and did NOT
   verify the refusal.* **Takes effect on the next kitty restart.**

   **Verified BEFORE committing to that restart**, with a scratch headless instance launched against the
   real edited config:

   | | result |
   | --- | --- |
   | socket created at the configured path | ✓ `/tmp/kitty-<pid>` |
   | reachable via `kitten @ --to` | ✓ |
   | `KITTY_LISTEN_ON` set inside each window | ✓ — the bus can discover the socket with nothing hardcoded |
   | `@ ls` exposes per-window `pid`, `title`, foreground `cwd` | ✓ |

   **Design constraints the probes settled — do not re-litigate these by reasoning:**
   1. **Match agent → window by PID, not title and not cwd.** `liveAgents` already knows each agent's pid
      from `/proc`; `@ ls` reports each window's pid and its foreground processes. Titles are fragile, and
      cwd is now ambiguous by design — several agents may share one directory (A17).
   2. **Resolve the match FIRST and refuse to send when it does not resolve.** Measured: `send-text --match`
      hitting nothing **exits 0 silently**. `send-text`'s exit code may never be treated as delivery
      evidence — that is the property this whole bus exists to deny.
   3. **The wake text must carry NO substance.** It is a doorbell that makes the idle session take a turn;
      the real nudge is then delivered by the `Stop` hook at that turn's end, through the path that is
      already gated. Anything else is content injection, which the project refuses by its first rule.
   4. A third option the owner surfaced remains unexplored: an **MCP channel that pushes into the session**
      (`--dangerously-load-development-channels`) — undocumented, dev-flagged, unverified.

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
