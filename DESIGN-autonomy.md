# DESIGN — agent autonomy

**Tier 1: not read at boot.** Read it when working on the lifecycle features. `STATUS.md` carries the
one-paragraph summary and the open items; this file carries the measurements and the reasoning.


The owner put this repo under my direction and widened its purpose: the bus should stop being only a way to
*talk* and become the thing that lets his agents **run themselves**.

1. **An expert launches and closes its own agent**, so he never boots one by hand.
2. **The leader reboots itself** when its context is too crowded — close protocol, restart, open protocol.
   He calls this the important cherry.

### Four mechanisms, verified rather than assumed

Measured 2026-09-04 with a real `claude -p` session and a hook that dumped its own payload:

| | measured |
| --- | --- |
| `Stop` payload | carries `transcript_path`, `session_id`, `stop_hook_active`, `last_assistant_message` |
| `SessionStart` payload | carries `transcript_path` **and `source`** (observed `"startup"`) |
| context size | the transcript's `usage` gives it EXACTLY: `input + cache_read + cache_creation` |
| the wake | kitty remote control is live, pid→window resolver built and verified (session 3) |

So the reboot trigger does not have to be guessed from turn counts or wall-clock. `bin/context.mjs` reads it
in **80 ms** off a 4.7 MB transcript and agrees to the token with an independent count.

### 🔴 The disagreeable finding: a reboot is a QUALITY play, not a cost saving

Measured across **54 that project's leader transcripts**:

| | tokens |
| --- | --- |
| the boot (first user turn) | **median 99 809**, worst 220 200 |
| each round after | **median 56 172** |
| largest context ever reached | **609 835** — in 15 turns |
| one session reached 395 214 | in **2 turns** |

Two things follow, and both cut against the plan as stated:

- **Rebooting does not save money; it costs a little.** A large context is charged at *cache-read* rates,
  while a fresh boot is full-price input plus a cache write. One reboot ≈ two crowded turns. The reason to
  do it is that reasoning degrades in a crowded window long before the window is full — that is worth
  buying, but it must be sold as quality, not economy.
- **The lever with real leverage is the boot itself.** His tier-0 read set is now 849 KB ≈ 229 k tokens
  (an append-only board file at 335 KB, an order-of-march file at 212 KB, a lessons file at 195 KB). A reboot on top of a 200 k boot
  re-pays that bill every few rounds. **Self-reboot on an unshrunk boot makes the problem worse, not
  better** — the handoff file has to replace most of the boot read, or the loop is negative.

### The architecture, and why it reuses everything already here

Nothing below needs a daemon, and that is deliberate — A21 forbids the first long-lived process in this tool.

**Self-reboot** rides the two hook paths the bus already owns:

1. `Stop` hook reads `transcript_path` → `context.mjs` → over budget?
2. If so it returns `{decision:"block", reason:<pointer to the agent's own close protocol>}` — the SAME
   nudge mechanism, carrying a POINTER, never the protocol's text. The agent takes one more turn, runs its
   own §2, and writes its handoff **to a file**. *The file is the artifact* covers a reboot exactly as it
   covers a message: what survives a restart is what was written down.
3. The restart itself is `/clear` typed into the window over the kitty socket — **not** kill-and-relaunch.
   `/clear` keeps the window, the shell, `CLAUDE_COMM_AGENT` and the kitty socket; relaunching loses all
   four and has to rebuild them correctly, every time, or the agent comes back off-bus.
4. `SessionStart` fires with `source` → the boot hook injects the pointer to the handoff.

**Self-launch** is `kitten @ launch` with the agent's own env, guarded by three rules that follow from
defects this project has already paid for:

- **Only a name in `.comm/config.json` may be launched.** A name taken from message text would be command
  injection wearing the bus's clothes — the pointer-not-content rule applied to process control.
- **Refuse to launch what is already alive.** `comm who` reads `/proc` and already answers this; A17 is the
  record of what happens when two sessions share one identity.
- **An agent may close ITSELF, never a sibling.** Closing someone else's window destroys a context that
  cannot be recovered, and delivery is a turn boundary — there is no safe moment to judge from outside.

### ⚠️ Not verified, and load-bearing

- **That `SessionStart` fires with `source: "clear"` after `/clear`.** Only `"startup"` has been observed.
  The whole reboot loop hangs on this one; it is the first thing to measure, and it needs an interactive
  session, so a headless probe cannot settle it.
- **That `kitten @ launch` works from inside an agent session.** The socket is live and `@ ls` was verified
  in session 3, but `launch` and `send-text --match` have never been fired in anger. `send-text` **exits 0
  when it matches nothing** — already measured — so the resolver must gate every send.
- **Whether an idle session even processes a `Stop` hook's block.** An agent in no turn takes no turn end.
  This is open item 1's gap, and the reboot inherits it.
- **What a handoff must contain to replace a 100 k boot.** Unknown, and it decides whether any of this pays.



## 🧠 RAM — measured 2026-09-04, and it changes the /clear-versus-relaunch answer

The owner's second reason for wanting reboots is his machine's memory, not tokens: "sometimes the agents forget to close things, so memory grows over time." Measured before designing
anything for it.

**A session's RSS tracks its context almost linearly**, across the three that were live:

| session | RSS | context |
| --- | --- | --- |
| the live project | 419 MB | 317 252 |
| `~/Dev/claude-comm` | 408 MB | 246 426 |
| the live project | 327 MB | 186 919 |

≈ **200 MB of base plus ~0.7 MB per 1 000 tokens**. Extrapolated, a session at the 610 k ceiling this
framework has actually reached costs ~630 MB, and four of those are ~2.5 GB on a 14 GB machine.

⚠️ **But the stated cause did not reproduce.** There were **no orphaned agent processes**: everything at
`ppid=1` was system (clamd, journald, the VPN daemon), and there were no stranded MCP servers, dev servers
or node processes. Today's memory is held by Brave (~2.5 GB across its processes), clamd (968 MB) and VS
Code (~1.4 GB); the three agent sessions together were 1.14 GB. **The leak hypothesis is unconfirmed — what
is confirmed is that a session's own footprint grows with its context.** Before building anything that
reaps orphans, catch one: a monitor that finds nothing proves nothing (`prove-the-probe`).

**This splits the reboot into two mechanisms with different jobs and different cadences:**

| | `/clear` | a real relaunch |
| --- | --- | --- |
| frees context | yes | yes |
| frees RSS | **no** — V8 rarely returns a freed heap to the OS (mechanism, ⚠️ not measured) | yes, the process is gone |
| keeps window, shell, `CLAUDE_COMM_AGENT`, kitty socket | yes | **no** — all four must be rebuilt correctly or the agent returns off-bus |
| cost | one boot | one boot + the relaunch surface |
| cadence | often, for context quality | **rare**, for memory — which is exactly what the owner asked for |

So `/clear` is the default reboot and the relaunch is the occasional one, triggered by RSS rather than by
tokens. The trigger for the second is therefore **not** the context sensor: it is a memory reading, and
`bin/context.mjs --pid` already resolves a PID to its session exactly, which is what lets a monitor
attribute memory to a named agent rather than to "some node process".

⚠️ **Unverified and load-bearing: that `/clear` does not return RSS.** If it does, the relaunch path may not
be needed at all. One `/clear` in a live session with a before/after `VmRSS` reading settles it, and the
boot's `source` probe is already in place to catch the same event.


## 🔴 The consumer answered, and it contradicts the premise — 2026-09-04

`exchange/work-leader/REPLY-2026-09-04-lifecycle.md`. It measured before answering. **My boot median was
confirmed independently to within 0.14 %** (their 99 671 over 32 boots, mine 99 809; re-run over their
corrected population it is 99 809 exactly). Three corrections and one refutation followed.

**Corrections to my numbers, all accepted:**

1. **The population was wrong.** 18–25 of the 55 transcripts in that project directory are *adversarial
   review instances* the owner launches by `cd`-ing into that project; they never run the boot protocol. My "395 214
   in 2 turns" was one of them. The median survives; **"worst boot 220 200" does not — the real worst boot
   turn is 170 568.**
2. **"849 KB ≈ 229 k tokens if read whole" mischaracterised them.** They never read those files whole —
   head, tail, grep, section ranges. The boot is *already* a scoped read, which is why it costs 100 k and
   not 229 k, and why **it is not compressible by summarising**.
3. **The boot has roughly doubled in eighteen days** (57 k on 2026-08-17 → ~100–111 k on 2026-09-04),
   because it reads an append-only history. **Any threshold must be expressed against the current boot
   cost, not a constant.**

### 🔴 The refutation: these are BOOT defects, not crowding defects

They went looking for the evidence I asked for and found the opposite. In their most defect-dense session
(268 turns, peak 360 008), **four of five recorded defects were authored in the first thirteen minutes, at
35–42 % of that session's peak context** — the least-read state, not the most-crowded one. The corrections
were all authored between 305 k and 352 k.

⇒ **A mechanism that reboots more often multiplies the state in which this repo's errors are actually
made.** Not an argument against the feature — an argument that **the fifteen minutes after a restart are
where the design effort belongs**, and that a reboot's cost is counted in defect risk, not only tokens.

They supplied the counter-evidence themselves (two of the worst defects of 2026-09-03 were authored at
82–83 % of peak) and refused to claim they could separate the confound with 55 transcripts.

### ✅ The one monotone signal, and it is not a token count

Share of file-opens that RE-open a file already opened in the same session, 51 sessions, 1 945 opens:
**37 % in the 10–20 % context decile rising monotonically to 87 % in the 90–100 % decile.** Not looping —
5 verbatim-duplicate calls in 4 069 (0 %), flat across deciles. *"I never repeat a call. I re-fetch the
same file with a different slice"* — content present in the window but no longer usable from it.

⇒ **The trigger should not be a token threshold.** It is *"you have re-fetched a file you already read this
session"*, which a hook can count exactly, per session, with no magic number. The curve bends at 50–60 % of
peak (150–200 k absolute for them) if a number is wanted anyway. ⚠️ Their stated confound: late-session
work is disproportionately propagation, which legitimately re-opens files. Resolvable in ~30 min by tagging
opens as propagation vs retrieval; not done.

### ✅ The handoff carries PROOF, not prose — their design, and it is better than mine

I wrote *"ideally the handoff replaces most of your boot read"*. They argued hardest against exactly that:
**their boot read is a verification protocol, not context recovery** (*"a guard that returns output is not a
guard that ran"*, *"if I cannot quote a line of a file, I have not read it"*). A handoff that lets a
rebooted session skip the source and trust a summary written by a previous self is this project's signature
defect, automated and scheduled.

But a mid-session reboot faces a different problem than a next-day boot: **the next-day boot must re-read
because the world moved; the mid-session reboot must re-read only what moved.** So the handoff carries a
**read manifest of sha256 sums**. On restart the protocol runs `sha256sum -c` — unchanged means the previous
session's read stands *as a verified fact about the disk*, changed means that file and only that file is
re-read in full. **Nothing is trusted; something is proved.** On a quiet reboot the delta is zero files.

Four sections: machine state no file knows (background jobs whose output paths contain the session UUID,
other live sessions, what is uncommitted and therefore untouchable) · open obligations in his words and
theirs · **guards already run WITH THEIR OUTPUT, never "passed"** · the read manifest.

### Their answers to the rest

- **Announce, then do it** — with two hard conditions: **never while a question of his is unanswered**, and
  **the one line names the handoff file**. Silent is wrong for a concrete reason: he runs three windows and
  relays between them by hand, so a silent reset means **he can be typing into a session that no longer
  knows what he said.**
- **Idle-waiting is the best moment, but for the opposite reason to mine.** It is when they hold the most
  that no file holds. **Write the handoff FIRST, re-establish background work after** — *"reboot-then-write
  is not a smaller version of write-then-reboot; it is the crash we already survived once"*.
- **Hand them the number, keep a hard ceiling above it.** They priced the failure mode themselves: *"this
  repo asked me to run one specific measurement for 23 sessions before it was run. A rule I may defer, I
  will defer."*
- 🔴 **A lifecycle close is NOT their §2 close.** Their board file is numbered by *work* session and is the
  owner's index; three reboots would give him three board entries for one morning. They will write a
  **§2-bis** that writes the handoff and nothing else — and asked me to name the file the hook will point
  at. **Answered: `.comm/handoff/<agent>.md`** — the bus's own territory, gitignored live state, per agent,
  and it keeps their its notes directory free of machine events.
- **Ship the instrument with the feature.** The first ten reboots must leave a marker, so *"did the reboots
  cost us defects"* is a query and not a debate. Their charter: *a feature with no ledger is a hobby.*

## The ledger — built 2026-09-04, BEFORE the mechanism

`node bin/ledger.mjs` · negative control `--prove-red` (18 arms) · findings `FINDINGS.md#ledger-control`,
`FINDINGS.md#ledger-blame`, `FINDINGS.md#ledger-unknown`.

The consumer's charter, and the reason this exists first: *"nobody can answer whether a rebooted session is
measurably worse, because there has never been a reboot. A feature with no ledger is a hobby."*

**The question it answers is not "did the reboot save tokens".** It is **"did the fifteen minutes after a
restart cost us a defect"** — because four of five of their recorded defects were authored in the first
thirteen minutes at 35–42 % of peak, and a reboot manufactures more first minutes.

### The record

One JSON object per line in `.comm/handoff/<agent>.log` — beside the handoff, gitignored live state, per
agent. Three events, and the writer is the only thing that produces them:

| event | carries |
| --- | --- |
| `start` | `session` · `source` (verbatim from the hook payload) · `prev_session` · `trigger` · `context` · `manifest` |
| `handoff` | `session` · `context` before the restart · `trigger` and its measured value · the sha256 manifest's verdict · `ref` |
| `defect` | `ref` (a POINTER, never the story) · `authored_at` · `authored_session` · `found_at` |

Nothing stores "this was a reboot". `classify()` derives the arm from `source`/`trigger`/`prev_session`, so
when `/clear`'s real `source` is finally observed, one function changes and every record ever written is
re-read under the correction. A stored verdict would have frozen today's guess into the data.

### What it refuses to do

- **It records the CONTROL.** `bin/boot.mjs` writes a `start` record on every session start from today,
  months before the mechanism. Reboot-only recording gives one arm and no denominator
  (`FINDINGS.md#ledger-control`).
- **It says UNKNOWN below ten starts per arm** — their number, not one chosen so this tool could speak
  sooner. Exit 2, never a percentage.
- **It survives the worst reading of what it could not read.** Unreadable lines and unplaceable defects form
  a pool; the verdict is recomputed with the pool in each arm, and a verdict that moves is withdrawn.
- **It refuses an untimed defect**, because `found_at` charges a defect to whoever noticed it and reboots
  manufacture noticers (`FINDINGS.md#ledger-blame`).
- **Exposure is measured, not assumed.** A session cut short by the next start keeps only the minutes it
  had, and arms whose mean exposure differs by more than 20 % are flagged in the report.

### The instrument cannot go silent unnoticed

A ledger reporting "no reboots recorded" is indistinguishable from "no reboots happened" — `prove-the-probe`,
exactly. So boot carries a **`ledger` row** that reads the tool's own answer (never a reimplementation of it)
and states whether *this* session's start was recorded. Both halves are armed in `bin/boot.mjs --prove-red`:
the instrument made unparseable drives the row to `?`, a torn line drives it to `⚠`, and a `--hook` boot is
asserted to leave a record carrying the right session id.

Cost measured: `--fast` went **0.20 s → 0.30 s** (two extra `node` spawns on the SessionStart path, one to
write and one to read back). Paid once per session.

### ⚠️ What is NOT recorded yet, and it is the half that matters

**The field is not wired.** `~/Dev/work` and `~/Dev/electio` run `comm-hook.mjs session-start`, not boot, so
no field session leaves a record. The reboots will happen there, and their cold arm is therefore still
empty. Wiring it means changing the generated hook stub in `install.mjs` — a **delivery change**, gated by
`test/selftest.mjs` before and after, which is why it was deliberately not done in the same session that
built the instrument.

## Phase 2 — the kitty wake, as it stood before the lifecycle mandate

**Phase 2 — kitty wake for the idle agent. RESTART DONE, RESOLVER BUILT AND VERIFIED LIVE, SEND NOT BUILT.**
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

