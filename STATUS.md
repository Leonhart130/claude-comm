# STATUS — claude-comm, 2026-08-06 (sessions 4–7)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

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
   `~/Dev/electio` (the leader and an off-bus adversarial reviewer), so cwd cannot identify an
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
   4. **NO DAEMON, NO TIMER, NO WATCHER — the wake stays a short-lived process.** The natural way to build
      a wake is a process that watches inboxes and lives forever. That would be the first long-lived thing
      in this project, and it is the only way this tool could ever acquire a memory leak: today `comm`
      starts, does file I/O and exits in 61 ms, so nothing lives long enough to leak. That is an
      **architectural** property, not a Node-versus-Rust one, and it is now **gated by A21** (import
      allowlist + no long-lived construct) rather than left to good intentions. The wake must therefore be
      driven from the existing per-turn hook invocation, not from a resident watcher.
   5. A third option the owner surfaced remains unexplored: an **MCP channel that pushes into the session**
      (`--dangerously-load-development-channels`) — undocumented, dev-flagged, unverified.

4. **selflo is UNINSTALLED** (owner's call, 2026-08-04). Backup:
   `scratchpad/selflo-comm-backup-2026-08-04.tgz`. ⚠️ Its `COORDINATION.md`, `scripts/sync-agent-files.mjs`
   and 6 `docs/START_HERE.md` **still document the bus** — an agent relaunched there before reinstall will
   follow those docs into a missing file.

5. **🔴 The reasoning archive is not in git, and one `git clean` deletes it.** `661a1aa "Removed
   conversations"` deleted `FINDINGS.md` and `STATUS.md` from the index, and `.gitignore`'s `*.md` keeps them
   out. The repo now has a remote (`github.com:Leonhart130/claude-comm`), so **what is published is the bus
   with none of the reasoning that justifies its guards** — and this file, the only record of what is open,
   exists in exactly one working tree with no backup.

   Measured, not argued: a fresh `git clone` of this repo and `node test/attack.mjs` on it → **A27 RED, 21
   dangling pointers.** One variable moved (the ignored files), the gate byte-identical. So A27 — the gate
   whose whole purpose is "a dangling pointer is worse than none" — is green only in this working tree.

   The chat files (`REPLY-*`, `REPORT-*`, `REVIEW-*`, `BRIEF-*`) were clearly meant to go. `FINDINGS.md` and
   `STATUS.md` were collateral. **This is the owner's call and boot will keep it red until it is made:**
   re-track the two documents (`git add -f`), or state that the archive is deliberately local-only and
   change A27 so it does not claim a coverage it cannot have off this machine.

6. **✅ CLOSED 2026-09-04 — the bus is installed where the work is.** The owner's live project now carries `.comm/` with
   **leader + the site expert**; `--check` green. First install outside the project this tool was written beside.
   ⏸️ **electio is abandoned** (owner, same day); its install is left in place and harmless.
   ⚠️ Left to the owner: relaunching so the hooks bind, and whether the site expert commits its two `.claude` files.
   Narrative in `HISTORY.md`.

7. **🔴 The autonomy mandate — self-launching experts, a self-rebooting leader.** Given 2026-09-04.
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

   ⚠️ **It also corrected my numbers:** ~20 of the 55 transcripts in its project directory are adversarial
   review instances, not leader boots. The median survived (99 809, re-derived); **"worst boot 220 200" did
   not — it is 170 568.** And its boot has doubled in 18 days, so a threshold must track the current boot
   cost rather than a constant.

   The original consultation: The owner's ruling on how a reboot should behave:
   "you handle it, ideally the two of you talk" — so the question went to the agent it would be
   applied to, in `exchange/work-leader/2026-09-04-lifecycle-consultation.md`. Six questions, of which one
   decides the feature: **does a crowded context actually degrade it, and where?** If the quality theory is
   wrong the whole thing is a cost with no benefit, and only the agent living at 500 k can say. There is no
   bus between the two projects yet, so the owner relays.

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
