# STATUS — claude-comm, 2026-09-04 (sessions 4–12)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

**1 — Dispose review #6: five findings OPEN, and recording them is the numerator this ledger never had.**

*Written 2026-09-04 by the session that took the review. It assumes you remember nothing, and boot injects only
this first line — so the first line is the instruction. Every claim below is checkable; check it.*

**`REVIEW-adversarial-6.md` is the full record — read it, do not re-derive.** Seven findings on that day's own
code; **five were about the ARMS, not the code**, the same ratio as review #5. Disposition so far:

- ✅ **F2 — the restart signal was INERT in this repo.** The claim lived only in the generated stub, and this
  project has no stub: its hook is `boot.mjs --hook`. A note could be armed, the row would PRINT it and file
  the start as COLD in the same sentence — and the ▶ NEXT told the next session to do exactly that. Fixed and
  verified by hand. 🔴 **NOT ARMED**, and the existing arm cannot notice because it never arms a note.
- ✅ **F1 — the prose in `#reboot-signal` is corrected.** A33 proves the note is *consumed*, not that
  consumption is *atomic*; a genuine read-then-unlink passes it green. 🔴 The arm still needs a real barrier.
- 🔴 **F3** the `DRIFT:` list names files that did not drift, including a shell command · **F4** A35 misses
  concatenation and nothing ever executes the bell · **F5** boot drops the ledger's `caveats` — R6's defect
  re-created in the commit that added the field · **F6** a tampered note is deleted, against the file's own
  Property 3 · **F7** the git guard is blind below the git root. Plus four more he raised without staging,
  including a bare `catch {}` that silently narrows the gate fingerprint.

**Then record them.** Every start is recorded automatically; **a defect is recorded by hand and nobody ever
has.** Ten reboots against ten cold starts still produce *"no difference detected"* if the numerator is 0/10
against 0/10. These findings are the first real material:
`node bin/ledger.mjs record defect --agent unnamed --ref REVIEW-adversarial-6.md --authored-at <iso with a Z>`.
⚠️ **`--authored-at`, never found_at:** a defect charged to whoever noticed it flows to the newest session, and
reboots manufacture sessions. The tool refuses an untimed defect unless you say `--authored-unknown` out loud.

⚠️ **The arm also needs a covariate the peer measured and I have not built.** A crashed restart cost 115 609
tokens, a *declared* one 116 413 — the clean one cost MORE, and he named the confound: 246 lines of report
were waiting. **The boot turn is governed by what the session finds in front of it**, so without recording
pending work at start both arms measure the luck of the queue. Cheap partial proxy: inbox depth at start,
which the hook already knows. Label it partial. `exchange/work-leader/out/2026-09-04-covariate.md`.

**The field answered the notice the day it shipped** — `exchange/field/in/`'s first file ever
(`work-leader-2026-09-04-premiere-lecture-notice.md`). Two items change plans: the notice covers MAIL and says
nothing about **resources two agents in one tree contend over** (he found three of his apps on port 4173), and
🔴 *"a notice is not read because it is there — it is read when someone says it is not"* ⇒ **`SessionStart`
should NAME it once.** Also: his `.comm/` is ignored by **his** line, not the installer's, so that control
proves his rule exists, not that install places one.

⚠️ **Launch tomorrow's reviewer in a SEPARATE WINDOW.** A `general-purpose` subagent does not inherit the
conversation, but it inherits the brief — and the brief is mine. Ask the owner.

**2 — Then the reboot trigger.** The consumer's §2.4: *"you re-fetched a file you already read this
session"*, countable by a hook, not a token threshold. Its confound is theirs, priced at ~30 min; ask rather
than guess. **Do not build it before 1** — a trigger whose effect the instrument cannot classify is a feature
with no ledger, which is this project's own definition of a hobby.

**3 — The other half of `#hookless-launch`, now with a second failure beside it.** A self-launched agent
needs a login shell (no `node` on `PATH` otherwise) **and** an answer to the trust prompt, which kills it in
any new directory while the launch still returns a window id. Both are prerequisites for self-launching
experts. `FINDINGS.md#hookless-launch` and `#wake-doorbell`.

**Standing test debt from review #4, none of it gated:** `FINDINGS.md#test-debt`.

**Every field project carries its own notice** at `.comm/README.md` — what `.comm/` is, why never to commit
it, the commands, how to update, and where to send feedback (`exchange/field/in/`, which boot watches). A
`SessionStart` guard asks whether anything under `.comm/` is *tracked*, because a notice is a promise.
`FINDINGS.md#field-notice`, including the escape bug that killed every hook while it was being added.

**Telling a peer is one command, and must be that one:** `node bin/exchange-bell.mjs --peer work-leader
--ref <file in their out/>`. Boot's `channel:` row tells only *me* when they write; three hand-rung bells
produced one quoting a number two re-arms stale. `FINDINGS.md#exchange-bell`.

**Settled 2026-09-04, do not re-litigate — measurements in `DESIGN-autonomy.md` and `FINDINGS.md`:**
`/clear` mints a new session, costs ~14 MB, returns no RSS · one kitty socket per OS window, and
`kitten @ launch --type=os-window` stays in the SAME process · pid → transcript comes from the registry, a
miss REFUSES, and a hook records only for a session inside its own project · the instruments travel beside
the bus, never by absolute path · the doorbell resolves by pid and refuses rather than hoping.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs` · `session-registry.mjs` · `ledger.mjs` · `restart-signal.mjs` · `wake.mjs` · `exchange-bell.mjs` · `context.mjs` · `boot.mjs` · `install.mjs` · `test/` — no dependencies |
| repo | an `origin` exists (`Leonhart130/claude-comm`); nothing is pushed automatically — the owner decides |
| **electio** | in real daily use — 26 real deliveries, both directions |
| gates | `attack` (deterministic, every case armed) · `ledger --prove-red`, now run INSIDE it · `selftest` (real sessions, not gated by boot) · `context` and `boot` controls. **Counts live in boot's output, never here** |
| boot | `node bin/boot.mjs` — every gating row armed; `--fast` is injected at session start, contract in `CLAUDE.md` |
| **ledger** | `node bin/ledger.mjs` — the reboot instrument, **built before the mechanism**, which now exists (`restart-signal.mjs`). Records here AND in the field; a field arm is `--root ~/Dev/electio`. Its own arms run inside `attack` as A34 |
| **sensor** | `node bin/context.mjs` — pid → transcript through `bin/session-registry.mjs` (the `SessionStart` hook writes it, keyed on pid + start time + boot id); **refuses on a miss**. `FINDINGS.md#clear-blind` |
| reviews | #1–#5 dispositioned · **#6 is OPEN — `REVIEW-adversarial-6.md`, see ▶ NEXT.** #5's amendment is in `CLAUDE.md`: *a gate that CAN redden is not yet one that reddens for the property in its own title* — **#6 hit that ratio again, 5 of 7** |

## ⏭️ OPEN
1. **🔴 Latency is a mailbox, not an interrupt.** Re-derive with `node test/latency.mjs <log>`; never
   transcribe the table. 26 real deliveries: leader→expert median **1462 s**, expert→leader **586 s** — the
   asymmetry is structural, mail lands at the recipient's *turn boundary*. **An agent alive but idle never
   receives its mail**, which is the whole justification for item 3. `who` showing "running" does not mean
   reachable. Never call this bus real-time. Gated by A16; `HISTORY.md`.

2. **`--reply-to <id>` (threading).** Field-requested, then field-deprioritised: it adds identity surface
   while the substance already lives in the file.

3. ✅ **Phase 2 — the wake is BUILT** and verified against a real agent (`bin/wake.mjs`; A32, armed both
   ways; `FINDINGS.md#wake-doorbell`). 🔴 **Still open:** item 1's latency table predates it and has not been
   re-measured. The wake does not deliver — it only makes a turn happen — so "mailbox, never an interrupt"
   is unchanged.

4. **🔴 Holding a machine resource is not an event anybody publishes.** Two agents in **one** project root
   collided over a port and killed each other's servers, 2026-09-04. **The failure is not transport, which is
   why a bigger bus would not have prevented it** — both had a hub and still could not see each other,
   because *nothing in this tool has ever had a concept of a thing an agent is holding.* Verified, not
   assumed: `bin/comm.mjs` has no notion of a port, a lock or a server; its only "claim" is a sender's
   identity. Full incident and the peer's reply: `HISTORY.md`, "The port collision".

   ⭐ **The fix is designed and deliberately NOT next: a claim file** (`FINDINGS.md#claim-file`). A second
   COLLISION outranks the current plan; a near-miss does not. 🔴 **The count is now three:** a near-miss, then
   **three of his apps on port 4173**, and two new experts holding 4174/4175 *written, never started*.

5. **🔴 A session launched outside an interactive shell has NO bus, and says nothing.** `node` lives only
   under nvm, so `kitten @ launch claude` (or cron, or a `.desktop` file) starts a session whose **every hook
   dies** while it looks normal. **A self-launched expert is launched by a program, never by a shell** — the
   shape that would have made the whole autonomy program measure nothing. `FINDINGS.md#hookless-launch`.
   ✅ Half-fixed: the hook now says so out loud, still exiting 0. 🔴 Open: it warns, it does not make such a
   session work. The fix is a login shell, and that covers only launchers this framework owns.

6. **🔴 The autonomy mandate — self-launching experts, a self-rebooting leader.** Given 2026-09-04.
   **Everything settled about it lives in [`DESIGN-autonomy.md`](DESIGN-autonomy.md)** — the four verified
   mechanisms, the RAM measurements, the consumer's reply and the review #4 dispositions. Do not re-derive
   any of it here; this entry carries only what is still OPEN.

   **The two findings that shape it:** the consumer's defects are **BOOT defects, not crowding defects** —
   four of five authored in the first thirteen minutes at 35–42 % of peak — so the design effort belongs in
   the fifteen minutes AFTER a restart. And the handoff carries a **sha256 read manifest**, never prose: a
   rebooted session re-reads only what MOVED.

   ✅ **The instrument was built first** (`node bin/ledger.mjs`), review #4 is answered in full, and the
   signal that makes its reboot arm reachable now exists (`bin/restart-signal.mjs`, `#reboot-signal`).
   🔴 **What is open is the ▶ NEXT above**: a real restart that arms it, then the trigger.

## ⚠️ What was NOT verified

- **Whether the pid→transcript descriptor returns after a cleared session takes a turn**
  (`FINDINGS.md#clear-blind`). MOOT for the sensor now, still unmeasured — it decides whether the sensor's
  "session CLEARED" note is permanent or transient.
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
- **The git guard has never fired outside a fixture.** Both field projects were clean when it shipped, and
  the one agent who read the notice did not stage a case where it should fire.
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
- **`selftest`'s BEHAVIOUR half is not a gate and never will be** — 3 of 6 runs showed the agent not reading
  the file it was pointed at. That is allowed by design, but it means this bus regularly rings a bell nobody
  answers, and no gate can tell you that happened in production.
- **Anything non-Linux**: `comm who` reads `/proc` and degrades to "not running" everywhere else.
- **The `-restored` duplicate id** in electio's log, unexplained across three reviews now.
- Two older standing caveats were moved to `FINDINGS.md#test-debt` when this file hit its cap: A8's partial
  mutations, and behaviour mid-TOOL-CALL. Cut from here, not retracted.

- **Whether Claude Code enforces `"timeout": 20` on a SessionStart hook.** `--hook` refuses a TTY, but a pipe
  that never closes still blocks and `|| true` cannot touch a hang. The harness's promise, not mine.
- **`.boot-state.json` under concurrent writers.** Writes are atomic (rename), so no reader sees a partial
  file — but two interleaved read-modify-writes can lose one update. It holds a counter, so a lost count is
  recoverable. Not measured.

## Two conventions that erode silently

**Measurement traps** (`FINDINGS.md#measurement-traps`): a control that does not travel the same code as the
arms validates nothing, and one that writes into the world it measures is not a control at all. **Four
instances now** — the fourth was this session, by hand, in a sandbox run with no runtime isolation.

**Findings live in the code**, at the point they apply — *a rule whose cost you cannot see is a rule someone
will simplify away.*
