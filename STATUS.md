# STATUS — claude-comm, 2026-09-04 (sessions 4–12)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

**1 — Record a defect. The arms fill on their own now; the NUMERATOR has never once been written.**

*Written 2026-09-04 by the session that made the signal cross. It assumes you remember nothing, and boot
injects only this first line — so the first line is the instruction. Every claim below is checkable; check it.*

✅ **The crossing works and is no longer open.** `bin/restart-signal.mjs`; the `~/Dev/work` leader armed a note
as his last act at 20:40:03, his owner relaunched him, and his hook claimed it at 20:44:22 — `prev_session`
carried, `signal {src: handoff, age_s: 259, ttl_s: 900}`, and his verdict moved from *"the reboot arm is
UNREACHABLE"* to *"needs 10 starts in each arm"*. All four of his starts say `source: "startup"`, which is the
whole case for the mechanism. Design, both lapse warnings it took, and the bias below:
**`FINDINGS.md#reboot-signal`** — read it, do not re-derive.

🔴 **What is open is the other half of the experiment.** Every start is recorded automatically; **a defect is
recorded by hand, and nobody has ever done it.** Ten reboots and ten cold starts still produce *"no difference
detected"* if the numerator is 0/10 against 0/10 — the instrument would answer confidently and mean nothing.
This is the same shape as the arming problem that cost two warnings today: **a workflow nobody performs is
indistinguishable from a mechanism that does not work.**

- Start with the ones already found: `node bin/ledger.mjs record defect --agent <you> --ref
  FINDINGS.md#<anchor> --authored-at <iso, with a Z>`. Two were authored in this session — the `Number(null)`
  coercion and the ENOENT false alarm, both in `#reboot-signal`.
- ⚠️ **`--authored-at`, never `found_at`.** A defect charged to whoever noticed it flows to the newest
  session, and reboots manufacture sessions — the arm would collect defects it did not author. The tool
  refuses an untimed defect unless you say `--authored-unknown` out loud.
- **Then say so in a `## ▶ NEXT` that asks the next session to keep doing it.** One session recording defects
  is an anecdote.

⚠️ **The reboot arm samples CLEAN reboots only, and this is not fixable by trying harder.** A session that
crashes never closes, so it never arms; its restart lands in `cold`. The `~/Dev/work` leader found this hours
after the mechanism shipped and measured one (a crash cost him **115 609 tokens on the next boot against
100 725**). The arm is deliberately NOT widened — the ledger names the sub-population every time the arm holds
anything. Do not "fix" this by arming early and refreshing; that trades a clean semantic for a noisy one.

**2 — Then the reboot trigger.** The consumer's §2.4: *"you re-fetched a file you already read this
session"*, countable by a hook, not a token threshold. Its confound is theirs, priced at ~30 min; ask rather
than guess. **Do not build it before 1** — a trigger whose effect the instrument cannot classify is a feature
with no ledger, which is this project's own definition of a hobby.

**3 — The other half of `#hookless-launch`, now with a second failure beside it.** A self-launched agent
needs a login shell (no `node` on `PATH` otherwise) **and** an answer to the trust prompt, which kills it in
any new directory while the launch still returns a window id. Both are prerequisites for self-launching
experts. `FINDINGS.md#hookless-launch` and `#wake-doorbell`.

**Standing test debt from review #4, none of it gated:** `FINDINGS.md#test-debt`.

**Settled 2026-09-04, do not re-litigate — measurements in `DESIGN-autonomy.md` and `FINDINGS.md`:**
`/clear` mints a new session, costs ~14 MB, returns no RSS · one kitty socket per OS window, and
`kitten @ launch --type=os-window` stays in the SAME process · pid → transcript comes from the registry, a
miss REFUSES, and a hook records only for a session inside its own project · the instruments travel beside
the bus, never by absolute path · the doorbell resolves by pid and refuses rather than hoping.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs` · `session-registry.mjs` · `ledger.mjs` · `restart-signal.mjs` · `wake.mjs` · `context.mjs` · `boot.mjs` · `install.mjs` · `test/` — no dependencies |
| repo | git initialised; **an `origin` on GitHub exists** (`Leonhart130/claude-comm`) — the "local only" line here was stale. Nothing is pushed automatically; the owner decides |
| **electio** | in real daily use — 26 real deliveries, both directions. **Ran a bus 4 commits stale until this session** |
| gates | `attack` (deterministic, every case armed) · `ledger --prove-red`, now run INSIDE it · `selftest` (real sessions, not gated by boot) · `context` and `boot` controls. **Counts live in boot's output, never here** |
| boot | `node bin/boot.mjs` — every gating row demonstrated able to go red; `--fast` is injected at session start by `.claude/settings.json`, the contract is `CLAUDE.md` |
| **ledger** | `node bin/ledger.mjs` — the reboot instrument, **built before the mechanism**, which now exists (`restart-signal.mjs`). Records here AND in the field; a field arm is `--root ~/Dev/electio`. Its own arms run inside `attack` as A34 |
| **sensor** | `node bin/context.mjs` — resolves pid → transcript through `bin/session-registry.mjs` (written by the `SessionStart` hook, keyed on pid + start time + boot id) and **refuses on a miss**. `FINDINGS.md#clear-blind` |
| reviews | #1–#5, all dispositioned (`REVIEW-adversarial-5.md`, the first the leader launched itself) · the electio leader's field reviews. **#5's lasting output is the method amendment now in `CLAUDE.md`: a gate that CAN redden is not yet one that reddens for the property in its own title** |

## ⏭️ OPEN
1. **🔴 Latency is a mailbox, not an interrupt.** Re-derive with `node test/latency.mjs <log>`; the table is
   never transcribed. From 26 real field deliveries: leader→expert median **1462 s**, expert→leader **586 s**.
   The asymmetry is structural — mail lands at the recipient's *turn boundary*. **An agent that is alive but
   idle never receives its mail**, and that one is still open: it is the whole justification for item 3.
   `who` showing "running" does not mean reachable. Never describe this bus as real-time. Gated by A16;
   history in `HISTORY.md`.

2. **`--reply-to <id>` (threading).** Requested by the field, then deprioritised by it: with two agents,
   threading adds identity surface while the substance already lives in the file.

3. ✅ **Phase 2 — the wake is BUILT and verified against a real agent** (`bin/wake.mjs`, 2026-09-04). A
   sender's Stop hook rings it; it resolves the target's kitty window **by pid** and refuses when it cannot,
   because `send-text --match` exits 0 on no match. Gated by A32, armed both ways. Design and the two things
   the first live run got wrong: `FINDINGS.md#wake-doorbell`.

   🔴 **Still open here:** item 1's latency table was measured BEFORE this existed and has not been
   re-measured with it. The claim "this bus is a mailbox, never an interrupt" is unchanged and still true —
   the wake does not deliver, it only makes a turn happen.

4. **🔴 Holding a machine resource is not an event anybody publishes.** Two agents in **one** project root
   collided over a port and killed each other's servers, 2026-09-04. **The failure is not transport, which is
   why a bigger bus would not have prevented it** — both had a hub and still could not see each other,
   because *nothing in this tool has ever had a concept of a thing an agent is holding.* Verified, not
   assumed: `bin/comm.mjs` has no notion of a port, a lock or a server; its only "claim" is a sender's
   identity. Full incident and the peer's reply: `HISTORY.md`, "The port collision".

   ⭐ **The fix is a claim file, and it respects the hub rule exactly** — `claims/<resource>` carrying pid,
   purpose and time; the file is the artifact; no transport, no daemon. Three properties: a stale claim is
   **diagnosable, not authoritative** (the pid lets a reader see the holder is dead — evidence of a crash,
   never a lock that outlives it); it **advises, it does not enforce**; and it ships with a gate proved able
   to go red on a claim left by a dead process. **Deliberately not next**, but a second COLLISION outranks
   that plan — a near-miss does not, and the peer reported one on 2026-09-04 and priced it himself as
   evidence the fix is cheap rather than needed.

5. **🔴 A session launched outside an interactive shell has NO bus, and says nothing.** `node` lives only
   under nvm, which only an interactive shell puts on `PATH`, so `kitten @ launch claude` (or a `.desktop`
   file, or cron) starts a session whose **every hook dies** — no mail at any turn boundary, no instruments —
   while it looks normal. **A self-launched expert is launched by a program, never by a shell**, so this is
   the shape that would have made the whole autonomy program measure nothing. Measurement, both halves of the
   fix and what the fix does *not* do: `FINDINGS.md#hookless-launch`.

   ✅ Half-fixed 2026-09-04 and reinstalled into both field projects: the `SessionStart` hook now says out
   loud when node is missing, still exiting 0. Selftest and `--prove-red` run before and after.
   🔴 Open: the guard warns, it does not make such a session work. The working fix is to launch through a
   login shell, and that only covers launchers this framework owns.

6. **🔴 The autonomy mandate — self-launching experts, a self-rebooting leader.** Given 2026-09-04.
   **Everything settled about it lives in [`DESIGN-autonomy.md`](DESIGN-autonomy.md)** — the four verified
   mechanisms, the RAM measurements, the consumer's reply and the review #4 dispositions. Do not re-derive
   any of it here; this entry carries only what is still OPEN.

   **The two findings that shape the feature, because a summary of them would be re-litigated otherwise:**
   the consumer's defects are **BOOT defects, not crowding defects** — four of five authored in the first
   thirteen minutes at 35–42 % of peak — so a reboot multiplies the state where errors are actually made and
   the design effort belongs in the fifteen minutes AFTER a restart. And the handoff carries a **sha256 read
   manifest**, never prose: a rebooted session re-reads only what MOVED. Nothing trusted, something proved.

   ✅ **The instrument was built first** (`node bin/ledger.mjs`), review #4 is answered in full, and the
   signal that makes its reboot arm reachable now exists (`bin/restart-signal.mjs`, `#reboot-signal`).
   🔴 **What is open is the ▶ NEXT above**: a real restart that arms it, then the trigger.

## ⚠️ What was NOT verified

- **Whether the pid→transcript descriptor returns after a cleared session takes a turn**
  (`FINDINGS.md#clear-blind`). Now MOOT for the sensor — the registry does not consult that descriptor for an
  answer — but still unmeasured, and it is what decides whether the "session CLEARED" note the sensor prints
  is permanent or transient.
- **What happens to the entry when a session is `resume`d or `compact`ed.** Both fire `SessionStart` with a
  source this repo has never seen, so whether they carry a `transcript_path` at all is unknown. A payload
  without one leaves the previous entry standing, which is the safe direction and is not the same as correct.
- **Two SessionStarts writing at the same instant.** Per-pid files remove the read-modify-write race that
  `.boot-state.json` still has, but `prune` reads the directory while another session may be writing into it.
  Every path is wrapped, so the worst case is a missed prune, not a lost entry. Not measured.
- **Anything about the registry off this machine.** It reads `/proc/<pid>/stat` and
  `/proc/sys/kernel/random/boot_id`; without both it refuses to record, which is a refusal, not support.
- **The ledger has never scored a real defect.** Sixteen arms move it on synthetic records; nothing has yet
  been recorded by a hand that was not writing a fixture. Its first real `record defect` is the test.
- **The crossing has happened ONCE**, in one project, armed by one agent, relaunched by one hand
  (2026-09-04 20:44). It took two lapse warnings to land. Not verified: that it survives an unattended
  relaunch, that anyone repeats it without being reminded, or that the arm ever reaches ten.
- **Whether two consumers of one hook stdin work.** The ▶ NEXT depends on the generated stub reading the
  payload and handing it to both the bus and the ledger. It currently uses `stdio: "inherit"` and has never
  been asked to do anything else.
- **Whether finding 1 ever actually ate mail in electio.** Unanswerable, and not for the reason this file
  gave for three sessions: the log DOES record who drained (`to_agent`, since the first commit), but it
  records the **resolved** name, and every theft class here works by making the thief resolve to the
  victim's name — clean by construction in exactly the cases it would need to catch. `id_src` separates the
  two now, on new rows only; the 37 historical rows stay unauditable. Review #1's finding 6, one level up.
- **How long the wandered-cwd window stays open.** Proved within a single `-p` turn; whether an interactive
  session's Bash cwd resets between turns is unmeasured. It decides the exposure, not the existence, of the
  defect. Moot for delivery (identity no longer reads cwd); still governs `whoami`-returns-null, open item 2.
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

## Two conventions, kept here because both erode silently

**Measurement traps** — three recorded, all of them ways a control lied (`FINDINGS.md#measurement-traps`):
a control that does not travel the same code as the arms validates nothing, and one that writes into the
world it measures is not a control at all.

**Findings live in the code**, in the comment at the point they apply, not only in a document — *a rule
whose cost you cannot see is a rule someone will simplify away.*
