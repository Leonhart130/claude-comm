# STATUS — claude-comm, 2026-09-11 (sessions 4–17)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*(2026-09-10. **Reviews #8 and #9 both ran.** #9 was launched BY A PROGRAM from `review/` — a first —
and aimed at #8's own fixes: **two were half-done, one killed its own process group.** All repaired.)*

**1 — 🔴 RUN THE CONTROLS FIRST**, with `CLAUDE_COMM_AGENT` set (A48) and the output **redirected to a file,
never piped** — a case failed twice on 09-10 and both names died in a `tail`. 🔴 **NEVER trust a wrapper's
exit code: `systemd-run` and the harness's own task notice both reported 0 over a suite that returned 1** —
the 0 belonged to the `tail` at the end of the chain. Read the suite's LAST LINE.
*(09-11: attack 55/55 ~40 s; selftest green BOTH ways — A54 now forces both suites to scrub the identity.)*

**2 — 🟡 WHAT REVIEWS #8 AND #9 LEFT OPEN**, all minor, measurements in the reports: **#9 A3** the
crossing arm consumes `handoffLogs` without re-checking the guard above it · **C7** `status` ⚠ on a fresh
clone · **N1** the tier-0 charge moves ±34 B against a 14 B margin · **#8 A3** A47 passes `comm whoami`.

**3 — 🔴 TWO LIMITS NO CODE CLOSES, both named at their site in `bin/context.mjs`.** A `/clear` whose hook
never fires leaves the registry naming a DEAD transcript with both uuids agreeing (`FINDINGS.md#clear-blind`);
and the cleared-note discriminator goes quiet if the session owning the inherited uuid has itself ended.
**Do not "fix" either with a better guess.**

**4 — 🟢 BUILT 2026-09-11: the launcher SPLITS, and an agent CLOSES ITSELF.** `launch.mjs` opens a pane in
the caller's tab (`--os-window` opts out) and now REFUSES a launch it cannot name; 🟢 **new `bin/close.mjs`**,
armed as **A50/A51**, five red proofs, each on its own clause. Release `2026-09-11.1`, installed HERE only.
🔴 **Building it refuted three sentences of its own design** — the env var that cannot exist, a guard resting
on the harness, and an arm reddening for the wrong property: `FINDINGS.md#self-close`.
🔴 **NOT verified: a REAL agent invoking it** — every arm uses a `node` named `claude`. Whether an agent runs
the verb, and when, is BEHAVIOUR ⇒ `selftest`, unasked.

**5 — 🟡 THE LETTER TO THE FIELD LEADER OF `work` IS WRITTEN AND UNREAD** (`exchange/work-leader/out/2026-09-10-
correction-...md`): my citation named a function that does not exist, and the advice added confidence, not
evidence. **The bell REFUSED — his leader is not running** — so it waits for his `boot.sh` §7. ⚠️ Two `zz-`
claims there are still held by dead pids; only he releases them, and the sentence his boot printed about
them **was false and is fixed** (#8 C6).

**6 — 🟡 THE DECLARED RESTART IS BUILT AND SHIPPED; THE AUTOMATIC ONE IS DELIBERATELY NOT.**
🟢 `bin/handoff.mjs` + `bin/restart.mjs prepare` (11 arms), in the field since 09-10. **It refuses to arm a
note behind a failed handoff** and does NOT relaunch — `launch.mjs` refuses an agent already alive (A17) and
the caller IS that agent, so the last step is left to it.
🔴 **Why no trigger:** measured here (168 sessions, 45 923 opens) the re-open share rises to **85 %**, but it
is 52-59 % by the second decile and **has no knee** — so *"no magic number"* is unsupported and any trigger
carries a threshold. **And the ledger still says UNKNOWN.** ⇒ **use `restart.mjs`; the arm fills, then
decide.** `DESIGN-autonomy.md` has the numbers and the over-collection caveat.
🟢 No `review` session is running; the OWNER closed the last one. **Launch a fresh one — and it can now put
itself away (`close.mjs`). Still: do not close a window you did not open.**

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

4. **🟢 Holding a machine resource — `bin/claim.mjs`, IN PRODUCTION**, 17 arms, A38, three field trees.
   **It advises; it opens nothing, kills nothing, blocks nothing.**
   🟢 **CLOSED 2026-09-10 BY THE `getajob` FIELD** — the measurement open since 09-05, made by someone not
   looking for it: two real SESSIONS, two names, one real vite server (three pids, none confused) ⇒
   **refused, exit 3, nothing changed**, and both names in ONE line. Its first transcript did NOT close it
   (it predated the fix and proved the claimant by an attached `whoami` — evidence about a shell).
   🔴 The name in the record is the CALLER'S DIRECTORY (`claim.mjs:405-425`): a `cd` changes it, only the
   pid identifies who acted. 🟢 A third property neither of us had listed: `release` REFUSES while the
   holder process still LIVES. All of it, and what it does not close, at `FINDINGS.md#claim-file`.
   ⚠️ Claims live in one project's `.comm/`, so a resource shared ACROSS projects is visible to nobody.
   ⭐ Their verdict, accepted as the honest scope: *a claim makes sharing visible; the first answer is not
   to share* — they isolated the ports instead, and kept the claim for what cannot be isolated.

5. **🟡 `who` reports TWO states and there are THREE — half shipped, in the wrong command.** A leader lost
   **2 h 30** reading `running` for four sessions sitting at their prompt. ✅ `context.mjs --sessions` prints
   `quiet <age>` — a MEASUREMENT, never "at prompt". 🟢 The third state was in no design doc: a session that
   has taken no turn has **no transcript at all** (`FINDINGS.md#no-turn-yet`). 🔴 It belongs in `comm who`
   and cannot go there — A21 forbids the bus that import ⇒ an A21 amendment **and** a split, `comm.mjs`
   being near A22's cap. ⚠️ `context.mjs` is not in `BUS_FILES`: undecided scope, asked 09-08, unanswered.

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

- 🔴 **`attack` failed TWICE on 2026-09-10, both times passing immediately after with no code change, and
  the case name is STILL unknown** — both failing runs had their output piped to `tail`. Twice is a flaky
  case, not an accident. ⇒ **never pipe this suite's output away: redirect to a file, then read the file.**
  The one-line habit is what destroyed the evidence, twice.


- 🔴 **Whether `boot`'s registry `GONE` wording is reachable, in BOTH directions** (review #8 D4).

- **`--release` is verified by hand, not gated** (`FINDINGS.md#release-roundtrip`): the test seam does not exist.
- **Whether the pid→transcript descriptor returns after a cleared session takes a turn**
  (`FINDINGS.md#clear-blind`). MOOT for the sensor now, still unmeasured — it decides whether the sensor's
  "session CLEARED" note is permanent or transient.
- **What the entry does on `resume` or `compact`.** Both fire `SessionStart` with a source never seen here;
  a payload with no `transcript_path` leaves the old entry standing — the safe direction, not the same as correct.
- **The ledger's 11 defects are all from ONE session, none in the 15-minute window**, and each is dated at
  its commit — the upper bound. `FINDINGS.md#review6-disposal`.
- **The git guard has never fired outside a fixture** — both field projects were clean when it shipped.
- **The crossing has happened ONCE** (2026-09-04, one hand, after two lapse warnings). Unverified: that it
  survives an unattended relaunch, that anyone repeats it, that the arm reaches ten.
- **`selftest`'s BEHAVIOUR half is not a gate** — 3 of 6 runs showed the agent not reading the file it was
  pointed at, and 09-11 added a 4th miss in 4 runs. This bus rings bells nobody answers and no gate sees it.
  🟢 Transport green 09-11 with and without `CLAUDE_COMM_AGENT` (`FINDINGS.md#one-suite-hardened`).
- **Anything non-Linux**: `comm who` reads `/proc`, and degrades to "not running" elsewhere.
- Two older standing caveats were moved to `FINDINGS.md#test-debt` when this file hit its cap: A8's partial
  mutations, and behaviour mid-TOOL-CALL. Cut from here, not retracted.

## Two conventions that erode silently

**Measurement traps** — a control not travelling the arms' code validates nothing; one that writes into the
world it measures is not a control. **Six instances.** `FINDINGS.md#measurement-traps`.

**Acknowledgements amend the protocol** — `FINDINGS.md#ack-amendment`. First discharge 2026-09-08, `from: 9`.
🟢 **Its design flaw — one row, several causes, one amendment clearing all of them — was fixed 2026-09-10.**

**Conduct defects go in `LESSONS.md`** — *a lesson ends as an armed gate or it is a platitude.*

**Findings live in the code**, at the point they apply — *a rule whose cost you cannot see is a rule someone
will simplify away.*
