# STATUS — claude-comm, 2026-09-10 (sessions 4–16)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*(2026-09-10. **Reviews #8 and #9 both ran.** #9 was launched BY A PROGRAM from `review/` — a first —
and aimed at #8's own fixes: **two were half-done, one killed its own process group.** All repaired.)*

**1 — 🔴 RUN THE CONTROLS FIRST.** `test/attack.mjs` (49; A48 is new) and the long one. ⚠️ **`systemd-run`
returns exit 0 whatever happens — read the suite's LAST LINE.** ⚠️ Run it with `CLAUDE_COMM_AGENT` **set as
well**: that is what `launch.mjs` injects, it silently broke every suite here (#9 C1), and A48 guards it.

**2 — 🟡 WHAT REVIEWS #8 AND #9 LEFT OPEN**, all minor, measurements in the reports: **#9 A3** the
crossing arm consumes `handoffLogs` without re-checking the guard above it · **C7** `status` ⚠ on a fresh
clone · **N1** the tier-0 charge moves ±34 B against a 14 B margin · **#8 A3** A47 passes `comm whoami`.

**3 — 🔴 TWO LIMITS THAT NO CODE CLOSES, AND BOTH ARE NAMED IN THE CODE.** A `/clear` whose hook never
fires leaves the registry naming a DEAD transcript with both uuids agreeing — indistinguishable from a
session never cleared (`FINDINGS.md#clear-blind`). And the cleared-note discriminator goes quiet if the
session that OWNS the inherited scratch uuid has itself ended. **Do not "fix" either with a better guess.**

**4 — 🔴 THE EROSION COUNT KEYS ON A ROW; A ROW WARNS FOR SEVERAL CAUSES.** Unchanged, and now the oldest
open item here. The discharge is recorded (`from: 9`); the design flaw is not. **Evidence, a gated change,
an arm. Not prose.**

**5 — 🟡 THE LETTER TO THE FIELD LEADER IS WRITTEN AND UNREAD** (`exchange/work-leader/out/2026-09-10-
correction-...md`): my citation named a function that does not exist, and the advice added confidence, not
evidence. **The bell REFUSED — his leader is not running** — so it waits for his `boot.sh` §7. ⚠️ Two `zz-`
claims there are still held by dead pids; only he releases them, and the sentence his boot printed about
them **was false and is fixed** (#8 C6).

**6 — 🟢 `test/selftest.mjs` RAN 2026-09-10, both ways.** PASS with real sessions and real hooks (and the
BEHAVIOUR half reported the agent DID read the file it was pointed at); `--prove-red` PASSED, so a green run
means something. **The delivery gate is open for a delivery change** — the first time that has been true here.

**7 — 🟡 THE DECLARED RESTART IS BUILT; THE AUTOMATIC ONE IS DELIBERATELY NOT.**
🟢 `bin/handoff.mjs` (sha256 read manifest, 7 arms) + `bin/restart.mjs prepare` (handoff → verify → arm the
note, in that order, 4 arms). **It refuses to arm a note behind a failed handoff**, and it does NOT relaunch:
`launch.mjs` refuses an agent already alive (A17) and the caller is that agent, so the last step is named
and left to it. This session's own handoff is at `.comm/handoff/leader.md`, verified.
🔴 **Why no trigger. Measured here, 168 sessions, 45 923 opens:** the re-open share rises monotonically to
**85 %** — their signal reproduces — **but it is already 52-59 % by the second decile and the curve has no
knee**, so the design's *"no magic number"* is not supported and any trigger from it carries a threshold.
The numbers are in `DESIGN-autonomy.md`, with the caveat that the measurement over-collects. **And the
ledger still says UNKNOWN.** Automating a restart before knowing whether one costs a defect would be
automating an unmeasured decision. ⇒ **use `restart.mjs` for real restarts; the arm fills, then decide.**
⚠️ `DESIGN-autonomy.md` claimed the field records no starts — **false, 58**, corrected there.
🟢 **Both SHIPPED to the field 2026-09-10** (bus `0e8c6abc8a13`, release `2026-09-10.2`) — a delivery
change, gated by `selftest` green in both directions before AND after, and the generated README now teaches
the restart. **That is what makes the arm fillable: the restarts happen there, not here.** ⚠️ A `review` session may still be alive —
`comm who`. **Do not close a window you did not open.**

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs` · `session-registry.mjs` · `ledger.mjs` · `restart-signal.mjs` · `claim.mjs` · `wake.mjs` · `exchange-bell.mjs` · `context.mjs` · `handoff.mjs` · `restart.mjs` · `boot.mjs` · `install.mjs` · `test/` — no dependencies |
| repo | `origin` = `Leonhart130/claude-comm`. **The push is the leader's call**, delegated 2026-09-05, along with installing into field trees — do not ask again |
| **electio** | in real daily use — 26 real deliveries, both directions |
| gates | `attack` (deterministic, every case armed) · `ledger --prove-red`, now run INSIDE it · `selftest` (real sessions, not gated by boot) · `context` and `boot` controls. **Counts live in boot's output, never here** |
| boot | `node bin/boot.mjs` — every gating row armed; `--fast` is injected at session start, contract in `CLAUDE.md` |
| **ledger** | `node bin/ledger.mjs` — the reboot instrument. Records here AND in the field; a field arm is `--root ~/Dev/electio`. Its own arms run inside `attack` as A34. **11 defects recorded, its first**; each start now stores `pending`, the peer's covariate (files newer than the last start), never the inbox depth I proposed — his session #41 had an empty mailbox and the largest real queue of his last five boots |
| **sensor** | `node bin/context.mjs` — pid → transcript through `bin/session-registry.mjs` (the `SessionStart` hook writes it, keyed on pid + start time + boot id); **refuses on a miss**. `FINDINGS.md#clear-blind` |
| reviews | #1–#8 **dispositioned**; **#9 RAN 2026-09-10 from `review/`, launched by a program** — `REVIEW-9.md`, 4 red, **and its worst two are defects in the previous review's own fixes**. #5's amendment stands in `CLAUDE.md`: *a gate that CAN redden is not yet one that reddens for the property in its own title* — review #9 found the third and fourth instances |

## ⏭️ OPEN
1. **🔴 Latency is a mailbox, not an interrupt.** Re-derive with `node test/latency.mjs <log>`; never
   transcribe the table. 26 real deliveries: leader→expert median **1462 s**, expert→leader **586 s** — the
   asymmetry is structural, mail lands at the recipient's *turn boundary*. **An agent alive but idle never
   receives its mail**, which is the whole justification for item 3. `who` showing "running" does not mean
   reachable. Never call this bus real-time. Gated by A16; `HISTORY.md`.

2. **`--reply-to <id>` (threading).** Field-requested, then field-deprioritised: it adds identity surface
   while the substance already lives in the file.

3. ✅ **The wake is BUILT** (`bin/wake.mjs`, A32, `FINDINGS.md#wake-doorbell`). 🔴 Item 1's latency table
   predates it and has not been re-measured. The wake does not deliver — it makes a turn happen.

4. **🟢 Holding a machine resource — `bin/claim.mjs`, settled and IN PRODUCTION.** `take`/`list`/`release`,
   16 arms, A38, both field trees. **It advises; it opens nothing, kills nothing, blocks nothing.**
   ✅ **E458 closed 2026-09-08 by the field leader** — negative control, `kill -9`, then the second-taker
   half, with a detached `--pid` holder so no working expert was killed.
   🔴 **STILL NOT MEASURED: no two REAL agents have contended through it** — `FINDINGS.md:1090` never
   stopped saying so, and **the 09-08 rewrite of this file deleted the line that did** (review #8 D2, its
   worst finding). He had made the code argument himself and *declined* to call it measured: *« je ne l'ai
   pas couru avec deux sessions réelles, et je ne l'écris donc pas comme mesuré »*. I answered that his gap
   was smaller than he thought, citing `stateOf` — **a function that does not exist here**. The real one is
   `holderState` (`bin/claim.mjs:112`) and it does read `boot`/`pid`/`start` and never `holder`, so the
   conclusion held; **the evidence did not change, only the confidence did.** ⇒ **a correction is owed to
   him, and it is ▶ NEXT 2.** 🟢 In production unprompted: `port-4173` and — the one that matters —
   `supabase-anneau-visiteur`, a NON-port resource with a purpose and a duration.
   ⚠️ Claims live in one project's `.comm/`, so a resource shared ACROSS projects is visible to nobody.

5. **🟡 `who` reports TWO states and there are THREE — half shipped, in the wrong command.** A leader read
   `running` for four sessions sitting at their prompt and lost **2 h 30** (his E453). ✅ `bin/context.mjs
   --sessions` prints `quiet <age>` from the transcript mtime — a MEASUREMENT, never "at prompt": a single
   long tool call is quiet too. 🟢 The **third** state was in no design document: a launched session that
   has taken no turn has **no transcript at all** (`FINDINGS.md#no-turn-yet`). 🔴 It belongs in `comm who`
   and cannot go there: A21 forbids the bus that import, and a second pid→transcript implementation is the
   defect `who --json` exists to prevent ⇒ an A21 amendment **and** a split, `comm.mjs` being at 94 % of
   A22. ⚠️ `context.mjs` is **not** in `BUS_FILES` — undecided scope, asked of the field leader 09-08,
   still unanswered. Review #8 C4/C5 are in this same file.

6. **🟢 A reply must NAME what it answers** — `Answers:` in a front-matter block on **line 1**, anchored to
   the first byte so a quotation cannot forge one (review #8 C1: a pasted marker used to count, and to print
   *"it says so"*). Stateless, no read receipt. A failed scan says `CANNOT SAY`; an unreadable channel still
   prints a row (C2). Contract: `exchange/README.md`. `FINDINGS.md#answered-mtime`. 🔴 Residue: ▶ NEXT 1.

7. **🟢 A session launched by a PROGRAM is on the bus — `bin/launch.mjs`, A46.** It BUILDS the child's
   `PATH` instead of inheriting kitty's, resolves `node`/`claude` absolutely, and REFUSES with no window id
   otherwise. ⚠️ "a login shell" was WRONG here — `zsh -l` has no `node`. `FINDINGS.md#hookless-launch`,
   `#launch-refuses`. 🔴 **Installed in THIS repo 2026-09-10 with a `review` agent, and never yet run:
   ▶ NEXT 3.**

8. **🟡 The autonomy mandate — self-launching experts, a self-rebooting leader.** Given 2026-09-04.
   **Everything settled is in [`DESIGN-autonomy.md`](DESIGN-autonomy.md)** — do not re-derive it here. The
   finding that shapes it: the consumer's defects are **BOOT defects, not crowding defects**, so the design
   effort belongs in the fifteen minutes AFTER a restart. 🟢 A program launched an expert onto the bus, and
   the declared restart is built. 🔴 **Open: a REAL restart arming the arm, and the trigger — ▶ NEXT 7.**

**Carried forward, unchanged and still open** *(moved here from ▶ NEXT on 2026-09-08 — cut from that
section, not retracted)*:
- **ESLint is uncovered.** A43 stops a configured *prettier* from rewriting our generated files; ESLint is
  the same shape and is not armed. `FINDINGS.md#generated-in-their-tree`.
- **The 15-minute window is untested and my own timestamps are why.** 0 of 25 defects fall in it, but each
  is dated at its commit — the upper bound. Not a result.
- **The restart TTL lapsed on a human TWICE; the clock is the wrong instrument.** Try armer-gone AND not
  ancient, TTL as a backstop. `claim.mjs` already ships the (pid, start, boot) test. Not built.
- **Standing test debt from review #4, none of it gated:** `FINDINGS.md#test-debt`.
- **`#A20` from 2026-09-04 is still unexplained.** The 09-05 instance was triaged and fixed
  (`#update-signal`); the original is not. **Run gates unfiltered.**
- **The erosion counter WAS discharged** on 2026-09-08 — one entry in `.boot-state.json`, `from: 9` (not 8;
  two sections of this file said 8 and review #8 D3 caught all three disagreements). 🔴 **Its design flaw is
  untouched and is ▶ NEXT 4:** the count keys on a ROW, and a row warns for several causes.

## ⚠️ What was NOT verified


- 🔴 **Whether `boot`'s registry `GONE` wording is reachable — in BOTH directions.** The 09-08 trace said
  no; review #8 D4 found the enumeration incomplete (a transcript removed under a live session). ▶ NEXT 6.

- **`--release` is verified by hand, not gated** (`FINDINGS.md#release-roundtrip`): `install.mjs` writes to
  its own checkout, and a fixture would have to relocate `HERE`. That test seam does not exist.
- **Whether the pid→transcript descriptor returns after a cleared session takes a turn**
  (`FINDINGS.md#clear-blind`). MOOT for the sensor now, still unmeasured — it decides whether the sensor's
  "session CLEARED" note is permanent or transient.
- **What the entry does on `resume` or `compact`.** Both fire `SessionStart` with a source never seen here;
  a payload with no `transcript_path` leaves the old entry standing — the safe direction, not the same as correct.
- **The ledger's 11 defects are all from ONE session, none in the 15-minute window**, and each is dated at
  its commit — the upper bound. `FINDINGS.md#review6-disposal`.
- **The git guard has never fired outside a fixture.** Both field projects were clean when it shipped, and
  the one agent who read the notice did not stage a case where it should fire.
- **The crossing has happened ONCE** (2026-09-04, one hand, after two lapse warnings). Unverified: that it
  survives an unattended relaunch, that anyone repeats it, that the arm reaches ten.
- **`selftest`'s BEHAVIOUR half is not a gate** — 3 of 6 runs showed the agent not reading the file it was
  pointed at. This bus rings bells nobody answers and no gate sees it. **It has not run since 2026-09-08.**
- **Anything non-Linux**: `comm who` reads `/proc` and degrades to "not running" everywhere else.
- Two older standing caveats were moved to `FINDINGS.md#test-debt` when this file hit its cap: A8's partial
  mutations, and behaviour mid-TOOL-CALL. Cut from here, not retracted.

## Two conventions that erode silently

**Measurement traps** — a control not travelling the arms' code validates nothing; one that writes into the
world it measures is not a control. **Six instances.** `FINDINGS.md#measurement-traps`.

**Acknowledgements amend the protocol** — `FINDINGS.md#ack-amendment`. First discharge 2026-09-08, `from: 9`.
🔴 Design flaw: ▶ NEXT 4.

**Conduct defects go in `LESSONS.md`** (tier 2, priced, catalogued by form) — *a lesson ends as an armed
gate or it is a platitude.*

**Findings live in the code**, at the point they apply — *a rule whose cost you cannot see is a rule someone
will simplify away.*
