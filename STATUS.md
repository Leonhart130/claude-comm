# STATUS — claude-comm, 2026-09-05 (sessions 4–13)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

**1 — A REVIEW IS OUT WITH THE OWNER. Read its result before starting anything.**

*Written 2026-09-05 by the session that ordered it, immediately before a declared restart. It assumes you
remember nothing; boot injects only this first line, so the first line is the instruction.*

The owner launched **adversarial review #7** in a separate window on `~/Dev/claude-comm`, against this
session's ten commits (`git log --oneline c0db349..HEAD`, 2 089 insertions, 11 files). The brief is
**`BRIEF-adversarial-7.md`** at the repo root — read it, it says what was asked and what was deliberately
NOT put in scope. The report is expected at **`REVIEW-adversarial-7.md`** (both are gitignored: correspondence,
not source). **The owner will tell you when it is ready. Do not start item 2 before disposing it.**

When it lands, dispose it the way review #6 was disposed, and expect the ratio: **#5 and #6 each put five of
seven findings in the ARMS, not the code**, and this session produced four more defects of its own, three of
them in detectors. Record every finding in the ledger — `node bin/ledger.mjs record defect --agent unnamed
--ref REVIEW-adversarial-7.md#F<n> --authored-at <iso with a Z>` — dated by **the commit that authored it**,
never by when it was found. That convention and its bias are in `FINDINGS.md#review6-disposal`.

⚠️ **Before touching the ledger, know this:** `boot.mjs --hook` RECORDS A START into the ledger of whatever
`--root` it is given. That wrote fabricated data into the real instrument twice on 2026-09-05 — once from an
arm, once from a person at a prompt. Check `node bin/ledger.mjs` before and after any hook experiment. Truth
as of this close: **6 cold + 4 reboot starts, 11 defects, one agent log (`unnamed.log`).**

**2 — `#claim-file` between two REAL agents.** `bin/claim.mjs` shipped today with eight arms and `A38` in the
gate, but no two live agents have ever contended through it: one session took both sides and the refusal was
shown only against a fabricated holder (`--pid 1`). The peer has six ports scheduled and offered to run
controls. Three of them, in his tree, and the third matters most: two agents take the same port; then **kill
one brutally** — the claim must read `HOLDER IS GONE`, never a lock. `exchange/work-leader/out/2026-09-05-claim-file-construit.md`
is what he was asked.

**3 — No real adversarial review has run from `review/` yet.** A `review` agent now exists in both field
rosters (`FINDINGS.md#second-session`); the mail routing is measured, the workflow is not. If review #7 was
launched from `~/Dev/claude-comm` it does not answer this — claude-comm has no roster of its own.

**4 — The launcher must resolve the runtime and REFUSE.** `FINDINGS.md#hookless-launch`: the published fix
said "a login shell" and that is false here — `-i` is the flag that works. Corrected. The rule to build is the
peer's: resolve `node`/`claude` absolutely before launching and refuse when resolution fails.

**5 — The window is untested and my own timestamps are why.** 0 of 11 defects fall inside the 15-minute
window, against the consumer's "four of five in thirteen minutes" — but each is dated at its commit, the
upper bound. Do not quote the disagreement as a result.

**6 — One red no code change explains, still unidentified.** `boot --prove-red` reported a row that could not
be reddened, then went green twice on the same tree. Never named, because the run was filtered through `grep`.
**Run gates unfiltered.** If it recurs it is `FINDINGS.md#A20` and it is triage-first.

**Standing test debt from review #4, none of it gated:** `FINDINGS.md#test-debt`.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs` · `session-registry.mjs` · `ledger.mjs` · `restart-signal.mjs` · `claim.mjs` · `wake.mjs` · `exchange-bell.mjs` · `context.mjs` · `boot.mjs` · `install.mjs` · `test/` — no dependencies |
| repo | an `origin` exists (`Leonhart130/claude-comm`). **The push is the leader's call** — delegated 2026-09-05, along with installing into field trees. The previous line here said the owner decides, and quoting a stale sentence about my own authority back at him cost a round-trip |
| **electio** | in real daily use — 26 real deliveries, both directions |
| gates | `attack` (deterministic, every case armed) · `ledger --prove-red`, now run INSIDE it · `selftest` (real sessions, not gated by boot) · `context` and `boot` controls. **Counts live in boot's output, never here** |
| boot | `node bin/boot.mjs` — every gating row armed; `--fast` is injected at session start, contract in `CLAUDE.md` |
| **ledger** | `node bin/ledger.mjs` — the reboot instrument. Records here AND in the field; a field arm is `--root ~/Dev/electio`. Its own arms run inside `attack` as A34. **11 defects recorded, its first**; each start now stores `pending`, the peer's covariate (files newer than the last start), never the inbox depth I proposed — his session #41 had an empty mailbox and the largest real queue of his last five boots |
| **sensor** | `node bin/context.mjs` — pid → transcript through `bin/session-registry.mjs` (the `SessionStart` hook writes it, keyed on pid + start time + boot id); **refuses on a miss**. `FINDINGS.md#clear-blind` |
| reviews | #1–#6 **all dispositioned**. #6's eleven findings are fixed and armed (`FINDINGS.md#review6-disposal`); F8–F11 were numbered on 2026-09-05 so each could carry a resolvable `--ref`. #5's amendment stands in `CLAUDE.md`: *a gate that CAN redden is not yet one that reddens for the property in its own title* — **the disposal itself produced four more defects, three of them in detectors** |

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

4. **🟢 Holding a machine resource is written down now** — `bin/claim.mjs`. Two agents in **one** project
   root collided over a port on 2026-09-04 and killed each other's servers. **The failure was never
   transport**, which is why a bigger bus would not have prevented it: both had a hub and neither could see
   the other, because nothing here had a concept of a thing an agent is HOLDING. What made it expensive is
   the peer's measurement — *each read the result as a broken test rather than a port conflict*, so both
   searched in the wrong place, separately. `HISTORY.md`, "The port collision".

   Shipped 2026-09-05: `take` / `list` / `release`, eight arms, `A38` in the gate, installed into both field
   projects, and a boot row that names a claim whose holder has **died** — a crash, not a stale lock, because
   nothing here expires. **It advises; it opens nothing, kills nothing, blocks nothing.**
   🔴 **Untested between two real agents — see ▶ NEXT 1**, and that is the whole remaining question.
5. **🔴 A session launched outside an interactive shell has NO bus, and says nothing.** `node` lives only
   under nvm, so `kitten @ launch claude` (or cron, or a `.desktop` file) starts a session whose **every hook
   dies** while it looks normal. **A self-launched expert is launched by a program, never by a shell** — the
   shape that would have made the whole autonomy program measure nothing. `FINDINGS.md#hookless-launch`.
   ✅ Half-fixed: the hook now says so out loud, still exiting 0. 🔴 Open: it warns, it does not make such a
   session work. 🔴 The published fix said "a login shell" and that is FALSE on this box — nvm is loaded from
   `.zshrc`, which `zsh -l` never reads. `-i` is the flag that works; the recorded recipe `zsh -lic` worked by
   accident of containing it. The rule to build is to resolve `node`/`claude` absolutely and REFUSE.

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
- **The ledger's 11 defects are all from ONE session and NONE fell in the 15-minute window** —
  and they are dated at their commit, the upper bound. `FINDINGS.md#review6-disposal`.
- **The git guard has never fired outside a fixture.** Both field projects were clean when it shipped, and
  the one agent who read the notice did not stage a case where it should fire.
- **The crossing has happened ONCE**, in one project, armed by one agent, relaunched by one hand
  (2026-09-04 20:44). It took two lapse warnings to land. Not verified: that it survives an unattended
  relaunch, that anyone repeats it without being reminded, or that the arm ever reaches ten.
- **Whether two consumers of one hook stdin work.** The ▶ NEXT depends on the generated stub reading the
  payload and handing it to both the bus and the ledger. It currently uses `stdio: "inherit"` and has never
  been asked to do anything else.
- **How long the wandered-cwd window stays open.** Proved within a single `-p` turn; whether an interactive
  session's Bash cwd resets between turns is unmeasured. It decides the exposure, not the existence, of the
  defect. Moot for delivery (identity no longer reads cwd); still governs `whoami`-returns-null, open item 2.
- **`selftest`'s BEHAVIOUR half is not a gate and never will be** — 3 of 6 runs showed the agent not reading
  the file it was pointed at. That is allowed by design, but it means this bus regularly rings a bell nobody
  answers, and no gate can tell you that happened in production.
- **Anything non-Linux**: `comm who` reads `/proc` and degrades to "not running" everywhere else.
- Two older standing caveats were moved to `FINDINGS.md#test-debt` when this file hit its cap: A8's partial
  mutations, and behaviour mid-TOOL-CALL. Cut from here, not retracted.

- **Whether Claude Code enforces `"timeout": 20` on a SessionStart hook.** `--hook` refuses a TTY, but a pipe
  that never closes still blocks and `|| true` cannot touch a hang. The harness's promise, not mine.
- **`.boot-state.json` under concurrent writers.** Writes are atomic (rename), so no reader sees a partial
  file — but two interleaved read-modify-writes can lose one update. It holds a counter, so a lost count is
  recoverable. Not measured.

## Two conventions that erode silently

**Measurement traps** (`FINDINGS.md#measurement-traps`): a control that does not travel the same code as the
arms validates nothing, and one that writes into the world it measures is not a control at all. **Six
instances now** — the fifth, 2026-09-05, were an ARM and then the OPERATOR: `A39` ran `boot --hook` against this repository (seven fabricated starts,
6 cold becoming 15), and staging the same row by hand added five more under an agent this repo does not have.
Anything that runs a real hook path writes wherever that path writes, and the ledger's root has no test seam.

**Acknowledgements amend the protocol** (`FINDINGS.md#ack-amendment`): the count hit three on `field:work`
and the row was rewritten on that evidence — mail to a *running* agent is the bus working; mail for one that
is *not* waits for a relaunch and nothing else says so. First time the mechanism fired on itself.

**Findings live in the code**, at the point they apply — *a rule whose cost you cannot see is a rule someone
will simplify away.*
