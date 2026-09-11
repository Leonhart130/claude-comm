# STATUS — claude-comm, 2026-09-11 (sessions 4–17)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*(2026-09-11. **The `getajob` field leader sent four letters in one day and every one carried a measurement.
Five armed changes came out of them, and TWO OF THE DEFECTS WERE IN CODE I HAD WRITTEN AND DOCUMENTED
WRONG.** Read `FINDINGS.md#doorbell-text` before touching anything that writes into a session's input.)*

**1 — 🔴 RUN THE CONTROLS FIRST**, `CLAUDE_COMM_AGENT` set (A48), output **to a file, never piped**.
🔴 **Never trust a wrapper's exit code — `systemd-run` AND the harness's task notice both reported 0 over a
suite that returned 1** (the `tail`'s). Read the suite's LAST LINE. *(09-11: attack 56/56 ~40 s; selftest
green, run 3× — it changed delivery three times today.)*

**2 — 🔴 `bin/comm.mjs` IS AT ITS CAP: 47 864 B of A22's 48 000, and the nudge render is 7535 of a hard
8000.** ⇒ **the next thing added there is a SPLIT, not an addition**, and open item 5's third `who` state is
already waiting on one. 🔴 **Also open and older than today: the suite's unbounded `while (count) fire()`
loops HANG on any render exception** (render-before-drain never drains). A55's red proof hung instead of
reddening; `FINDINGS.md#note-eats-the-file`.

**3 — 🟡 WHAT REVIEWS #8 AND #9 LEFT OPEN**, all minor: **#9 A3** the crossing arm consumes `handoffLogs`
without re-checking the guard above it · **C7** `status` ⚠ on a fresh clone · **N1** the tier-0 charge moves
±34 B against a thin margin · **#8 A3** A47 passes `comm whoami`.

**4 — 🔴 TWO LIMITS NO CODE CLOSES**, both named at their site in `bin/context.mjs`. A `/clear` whose hook
never fires leaves the registry naming a DEAD transcript with both uuids agreeing
(`FINDINGS.md#clear-blind`); the cleared-note discriminator goes quiet if the session owning the inherited
uuid has ended. **Do not "fix" either with a better guess.**

**5 — 🟡 ASKED BY THE FIELD, DESIGNED, NOT BUILT.** Each has its open questions written down; none is a
promise. ⇒ **`dismiss --citing "<phrase>"`** that refuses when the phrase is not in the `ref` — a status set
by the recipient records a BELIEF, and it has already lied (`FINDINGS.md#note-eats-the-file`, with the three
open questions). ⇒ **`comm wait --for a,b,c`**, refused inside the bus (A21 forbids it the liveness it
needs) and accepted beside it — **but parked behind a measurement HE agreed to make first**: wake-per-report
costs N turns, and the number decides whether a quorum is worth building. ⇒ **`who`'s FOURTH state**: CPU
time separates *working* from *idle* (21 s in 2 min 51 vs 1 s in 1 h 10) and `/proc/<pid>/stat` already
carries it — **one sample each, so no threshold from it.**

**6 — 🟡 THE LETTER TO THE FIELD LEADER OF `work` IS STILL UNREAD.** The bell REFUSES cleanly — his leader is
not running — so it waits for his `boot.sh` §7. ⚠️ Two `zz-` claims there are still held by dead pids; only
he releases them.

**7 — 🟡 THE DECLARED RESTART IS BUILT AND SHIPPED; THE AUTOMATIC ONE IS DELIBERATELY NOT.**
🟢 `handoff.mjs` + `restart.mjs prepare` (11 arms), in the field since 09-10, refusing to arm a note behind
a failed handoff. 🔴 **No trigger:** the re-open share reaches 85 % but is 52-59 % by the second decile and
**has no knee**, so any trigger carries a threshold — **and the ledger still says UNKNOWN.** ⇒ use
`restart.mjs`; the arm fills, then decide.
🟢 No `review` session is running. **Launch a fresh one — `launch.mjs review --prompt "…"`, and it can now
put itself away.** Still: do not close a window you did not open.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs` · `session-registry.mjs` · `ledger.mjs` · `restart-signal.mjs` · `claim.mjs` · `wake.mjs` · `exchange-bell.mjs` · `context.mjs` · `handoff.mjs` · `restart.mjs` · `launch.mjs` · `close.mjs` · `boot.mjs` · `install.mjs` · `test/` — no dependencies |
| repo | `origin` = `Leonhart130/claude-comm`. **The push is the leader's call**, delegated 2026-09-05, along with installing into field trees — do not ask again |
| **electio** | in real daily use — 26 real deliveries, both directions |
| gates | `attack` (deterministic, every case armed) · `ledger --prove-red`, now run INSIDE it · `selftest` (real sessions, not gated by boot) · `context` and `boot` controls. **Counts live in boot's output, never here** |
| boot | `node bin/boot.mjs` — every gating row armed; `--fast` is injected at session start, contract in `CLAUDE.md` |
| **ledger** | `node bin/ledger.mjs` — the reboot instrument. Records here AND in the field; a field arm is `--root ~/Dev/electio`. Its own arms run inside `attack` as A34. **11 defects recorded, its first**; each start now stores `pending`, the peer's covariate (files newer than the last start), never the inbox depth I proposed — his session #41 had an empty mailbox and the largest real queue of his last five boots |
| **sensor** | `node bin/context.mjs` — pid → transcript through `bin/session-registry.mjs` (the `SessionStart` hook writes it, keyed on pid + start time + boot id); **refuses on a miss**. `FINDINGS.md#clear-blind` |
| reviews | #1–#8 **dispositioned**; **#9 RAN 2026-09-10 from `review/`, launched by a program** — `REVIEW-9.md`, 4 red, **and its worst two are defects in the previous review's own fixes**. #5's amendment stands in `CLAUDE.md`: *a gate that CAN redden is not yet one that reddens for the property in its own title* — review #9 found the third and fourth instances |

## ⏭️ OPEN
1. **🔴 Latency is a mailbox, not an interrupt.** Re-derive with `node test/latency.mjs <log>`; never
   transcribe the table. 26 deliveries: leader→expert median **1462 s**, expert→leader **586 s** — the
   asymmetry is structural, mail lands at the recipient's *turn boundary*. **An agent alive but idle never
   receives its mail** (the justification for item 3), and `who` saying "running" does not mean reachable.
   Never call this bus real-time. A16; `HISTORY.md`.

2. **`--reply-to <id>` (threading).** Field-requested, then field-deprioritised: the substance lives in the
   file.

3. ✅ **The wake is BUILT** (`bin/wake.mjs`, A32) and 09-11 its TEXT was rewritten — it gave a conduct order
   in the owner's own channel and promised a delivery it cannot keep (`FINDINGS.md#doorbell-text`). 🔴 Item
   1's latency table predates the wake and has not been re-measured. ⚠️ A wake inside `QUIET_MS` rings
   nobody and nothing catches up: it prints `○ rung 104s ago`, which reads like a success.

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

5. **🟡 `who` reports TWO states and there are FOUR.** A leader lost **2 h 30** reading `running` for four
   sessions sitting at their prompt. ✅ `context.mjs --sessions` prints `quiet <age>` — a MEASUREMENT, never
   "at prompt". 🟢 Third: a session that has taken **no turn has no transcript at all**
   (`FINDINGS.md#no-turn-yet`) — and `launch.mjs --prompt` now stops manufacturing them. 🟢 Fourth, measured
   by the field 09-11: **CPU time separates *working* from *idle*** and `/proc` already carries it; one
   sample each, so no threshold from it. 🔴 All of it belongs in `comm who` and cannot go there — A21 forbids
   the import ⇒ an A21 amendment **and a split; `comm.mjs` is now AT A22's cap, not near it.**

6. **🟢 A reply must NAME what it answers** — `Answers:` in front matter on **line 1**, anchored to the
   first byte so a quotation cannot forge one (#8 C1). Stateless, no read receipt; a failed scan says
   `CANNOT SAY`. Contract: `exchange/README.md`. `FINDINGS.md#answered-mtime`.

7. **🟢 A program launches an agent, and the agent puts its own window away.** `launch.mjs` (A46) builds the
   child's `PATH` rather than inheriting kitty's and resolves the runtime absolutely; 🟢 **09-11 it SPLITS
   the caller's tab, refuses a launch it cannot name, and `--prompt` gives the new session a first turn** —
   without one it sits inert while `who` says `running` — **and `--print`, the mode used to CHECK a launch,
   was the only one that omitted that warning** (field, within an hour of install). 🟢 **`close.mjs` (A51)**:
   an agent closes ITSELF, never a sibling, and refuses over waiting mail or a held claim.
   `FINDINGS.md#self-close`, `#hookless-launch`.

8. **🟡 The autonomy mandate — self-launching experts, a self-rebooting leader.** Given 2026-09-04; settled
   parts in [`DESIGN-autonomy.md`](DESIGN-autonomy.md), **do not re-derive them here.** The finding that
   shapes it: the consumer's defects are **BOOT defects, not crowding defects**, so the effort belongs in
   the fifteen minutes AFTER a restart. 🟢 A program launches an expert, gives it a first turn, and it can
   close itself. 🔴 **Open: a REAL restart arming the arm, and the trigger — ▶ NEXT 7.**

**Carried forward, unchanged and still open** *(moved here from ▶ NEXT on 2026-09-08 — cut from that
section, not retracted)*:
- **ESLint is uncovered.** A43 stops a configured *prettier* from rewriting our generated files; ESLint is
  the same shape and is not armed. `FINDINGS.md#generated-in-their-tree`.
- **The 15-minute window is untested and my own timestamps are why.** 0 of 25 defects fall in it, but each
  is dated at its commit — the upper bound. Not a result.
- **The restart TTL lapsed on a human TWICE; the clock is the wrong instrument.** Try armer-gone AND not
  ancient, TTL as a backstop. `claim.mjs` already ships the (pid, start, boot) test. Not built.
- **Test debt from review #4, none of it gated:** `FINDINGS.md#test-debt`.
- **`#A20` from 2026-09-04 is still unexplained.** The 09-05 instance was triaged and fixed
  (`#update-signal`); the original is not. **Run gates unfiltered.**
- **The erosion counter WAS discharged** 2026-09-08 (`from: 9`, review #8 D3). 🟢 Its design flaw — one row,
  several causes — was fixed 09-10; the stale "▶ NEXT 4" pointer here was cut 09-11, not retracted.

## ⚠️ What was NOT verified

- 🔴 **`attack` failed TWICE on 2026-09-10, both times passing immediately after with no code change, and
  the case name is STILL unknown** — both failing runs had their output piped to `tail`. Twice is a flaky
  case, not an accident. ⇒ **never pipe this suite's output away: redirect to a file, then read the file.**
  *(09-11: 6 clean runs, no flake seen.)*
- 🔴 **NOTHING VERIFIES `close.mjs` UNDER A REAL AGENT.** Every arm uses a `node` named `claude`. **Whether
  an agent runs the verb, and when, is BEHAVIOUR** ⇒ `selftest`, unasked.


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
