# STATUS — claude-comm, 2026-09-11 (sessions 4–17)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*(2026-09-11. **Five field letters, eight releases. Two defects were in code I had written AND documented
wrong; the bus then hit its cap, A21 forbade the only remedy A22 names, and the split broke a stated
invariant that only a measurement found.** `FINDINGS.md#doorbell-text`, `#bus-split`.)*

**0 — 🔴 REVIEW #10: SIX RED, ALL INSIDE THAT DAY'S OWN WORK.** `REVIEW-10.md` · `FINDINGS.md#split-raised-the-cap`.
**C4 first, the worst and it is mine:** I satisfied A22 by making it stop measuring what it caps — the bus
grew to **51 142 B**, past a cap declared hours earlier, and the gate went red→green. *Printing is not
gating.* 🔴 **Do NOT just add a total cap: the honest total is already over, so 48 000 must be re-argued
ONCE with evidence** — not in a session's last minutes, which is how a cap becomes a fitted number.
🔴 Still open: **C1** (`close.mjs`'s claim refusal has NEVER run — `claim list --json` returns an object) ·
**C3** (A21 has `watchFile(` not `watch(`, so `fs.watch()` passes) · **C2** (the close probe says
`gone:true` when blind) · **C5** (`selftest --prove-red` passes when `claude` cannot run).
🟢 C6/A2/A3 fixed. 🔴 **A1 is a better design than mine, unbuilt:** replace `ARM_FLOOR` with a RATCHET on
`.boot-state.json`'s `pass` — redden on a LOSS of arms, silent on a gain.

**1 — 🔴 RUN THE CONTROLS FIRST**, `CLAUDE_COMM_AGENT` set (A48), output **to a file, never piped**.
🔴 **Never trust a wrapper's exit code — `systemd-run` AND the harness's task notice both reported 0 over a
suite that returned 1** (the `tail`'s). Read the suite's LAST LINE. *(09-11: attack 56/56 ~40 s; selftest
green, run 3× — it changed delivery three times today.)*

**2 — 🟢 THE BUS IS SPLIT: `comm.mjs` 41 407 B + `who.mjs` 9 735 B** (`FINDINGS.md#bus-split`) — **but read
item 0 first: the cap is NOT cleared, it stopped being measured.** 🔴 **BUILD WHAT THE SPLIT WAS FOR:** open
item 5's third and fourth `who` states, still not built. ⚠️ Adding `session-registry.mjs` to `BUS_MODULES`
puts it under A21 too.

**3 — ⚠️ DO NOT run `attack.mjs` and `boot --prove-red` at once**: `--prove-red` runs the suite in its own
copies, both drive REAL kitty windows, and they collide into a flake that looks like a finding
(`FINDINGS.md#split-lands-in-the-active-tab`). It cost me one false red.
🟡 Older and minor: **#9 A3** the crossing arm consumes `handoffLogs` without re-checking the guard above it ·
**C7** `status` ⚠ on a fresh clone · **#8 A3** A47 passes `comm whoami`.

**4 — 🔴 TWO LIMITS NO CODE CLOSES**, both named at their site in `bin/context.mjs`. A `/clear` whose hook
never fires leaves the registry naming a DEAD transcript with both uuids agreeing
(`FINDINGS.md#clear-blind`); the cleared-note discriminator goes quiet if the session owning the inherited
uuid has ended. **Do not "fix" either with a better guess.**

**5 — 🟡 ASKED BY THE FIELD, DESIGNED, NOT BUILT.** ⇒ **`dismiss --citing "<phrase>"`**, refusing when the
phrase is not in the `ref` — a recipient-set status records a BELIEF and has already lied
(`FINDINGS.md#note-eats-the-file`). 🟢 The field settled two of its three open questions by USE: normalise
case/quotes/NBSP, and BLOCK rather than annotate.
⇒ **`comm wait --for a,b,c`** — refused inside the bus, accepted beside it, **parked behind a measurement HE
agreed to make first.** ⇒ **`who`'s FOURTH state**: CPU separates *working* from *idle* (21 s in 2 min 51 vs
1 s in 1 h 10) and `/proc` already carries it — **one sample each, so no threshold from it.**

**6 — 🟡 THE LETTER TO `work`'s LEADER IS STILL UNREAD.** The bell REFUSES cleanly (he is not running), so it
waits for his `boot.sh` §7. ⚠️ Two `zz-` claims there are held by dead pids; only he releases them.

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
| **ledger** | `node bin/ledger.mjs` — the reboot instrument. Records here AND in the field (`--root ~/Dev/electio`); its arms run inside `attack` as A34. Each start stores `pending`, the peer's covariate (files newer than the last start) — **never inbox depth**: his session #41 had an empty mailbox and the largest real queue of its last five boots |
| **sensor** | `node bin/context.mjs` — pid → transcript through `bin/session-registry.mjs` (the `SessionStart` hook writes it, keyed on pid + start time + boot id); **refuses on a miss**. `FINDINGS.md#clear-blind` |
| reviews | #1–#9 **dispositioned**; **#10 launched 2026-09-11 BY THE LEADER** and still running at close — ▶ NEXT 3. #9's worst two were defects in #8's own fixes. #5's amendment stands in `CLAUDE.md`: *a gate that CAN redden is not yet one that reddens for the property in its own title* — **09-11 found its fifth and sixth instances, one of them inside the arm written to record the fifth** |

## ⏭️ OPEN
1. **🔴 Latency is a mailbox, not an interrupt.** Re-derive with `node test/latency.mjs <log>`; never
   transcribe the table. 26 deliveries: leader→expert median **1462 s**, expert→leader **586 s** — mail
   lands at the recipient's *turn boundary*, so **an agent alive but idle never receives it** and `who`
   saying "running" does not mean reachable. Never call this bus real-time. A16; `HISTORY.md`.

2. **`--reply-to <id>` (threading).** Field-requested, then field-deprioritised: the substance lives in the
   file.

3. ✅ **The wake is BUILT** (`bin/wake.mjs`, A32); 09-11 its TEXT was rewritten — it gave a conduct order in
   the owner's own channel and promised a delivery it cannot keep (`FINDINGS.md#doorbell-text`). 🔴 Item 1's
   table predates it. ⚠️ A wake inside `QUIET_MS` rings nobody and nothing catches up — it prints
   `○ rung 104s ago`, which reads like success.

4. **🟢 Holding a machine resource — `bin/claim.mjs`, IN PRODUCTION**, 17 arms, A38, three field trees.
   **It advises; it opens nothing, kills nothing, blocks nothing.**
   🟢 **CLOSED 2026-09-10 BY THE `getajob` FIELD** — open since 09-05, made by someone not looking for it:
   two real SESSIONS, two names, one real vite server ⇒ **refused, exit 3, nothing changed**, both names in
   ONE line. Its FIRST transcript did not close it — it proved the claimant by an attached `whoami`.
   🔴 The name in the record is the CALLER'S DIRECTORY (`claim.mjs:405-425`): a `cd` changes it, only the
   pid identifies who acted. 🟢 A third property neither of us had listed: `release` REFUSES while the
   holder process still LIVES. All of it, and what it does not close, at `FINDINGS.md#claim-file`.
   ⚠️ Claims live in one project's `.comm/`, so a resource shared ACROSS projects is visible to nobody.
   ⭐ Their verdict, accepted as the scope: *a claim makes sharing visible; the first answer is not to
   share.*

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
   child's `PATH` and resolves the runtime absolutely; **09-11 it SPLITS the caller's tab, refuses a launch
   it cannot name, and `--prompt` gives the new session a first turn** — without one it sits inert while
   `who` says `running`. 🟢 **`close.mjs` (A51)**: an agent closes ITSELF, never a sibling.
   🔴 **Review #10 C1/C2: its claim refusal has never run, and its probe reports success when blind.**
   `FINDINGS.md#self-close`, `#split-raised-the-cap`.

8. **🟡 The autonomy mandate — self-launching experts, a self-rebooting leader.** Given 2026-09-04; settled
   parts in [`DESIGN-autonomy.md`](DESIGN-autonomy.md), **do not re-derive them here.** The finding that
   shapes it: the consumer's defects are **BOOT defects, not crowding defects**. 🟢 **2026-09-11 the leader
   launched, briefed and was reviewed by its own expert** — first full exercise. 🔴 **Open: a REAL restart
   arming the arm, and the trigger — ▶ NEXT 7.**

**Carried forward, still open** *(cut from ▶ NEXT 2026-09-08, not retracted)*:
- **ESLint is uncovered.** A43 stops a configured *prettier* rewriting our generated files; ESLint is the
  same shape, unarmed. `FINDINGS.md#generated-in-their-tree`.
- **The 15-minute window is untested and my own timestamps are why:** each defect is dated at its commit,
  the upper bound. Not a result.
- **The restart TTL lapsed on a human TWICE; the clock is the wrong instrument.** Try armer-gone AND not
  ancient, TTL as a backstop — `claim.mjs` already ships the (pid, start, boot) test. Not built.
- **Test debt from review #4, none of it gated:** `FINDINGS.md#test-debt`.
- **`#A20` from 2026-09-04 is still unexplained** (the 09-05 instance was fixed, `#update-signal`).
  **Run gates unfiltered.**
- **The erosion counter WAS discharged** 2026-09-08 (`from: 9`, review #8 D3). 🟢 Its design flaw — one row,
  several causes — was fixed 09-10; the stale "▶ NEXT 4" pointer here was cut 09-11, not retracted.

## ⚠️ What was NOT verified

- 🔴 **`attack` failed TWICE on 2026-09-10, case name unknown** — both piped to `tail`. ⇒ **redirect to a
  file, then read it.** *(09-11: 8 clean runs.)*
- 🔴 **NOTHING VERIFIES `close.mjs` UNDER A REAL AGENT** — every arm uses a `node` named `claude`. BEHAVIOUR
  ⇒ `selftest`, unasked. *(Review #10 ran it for real and C1/C2 are what came back.)*


- 🔴 **Whether `boot`'s registry `GONE` wording is reachable, in BOTH directions** (review #8 D4).

- **`--release` is verified by hand, not gated** (`FINDINGS.md#release-roundtrip`): the test seam does not exist.
- **Whether the pid→transcript descriptor returns after a cleared session takes a turn**
  (`FINDINGS.md#clear-blind`). MOOT for the sensor now, still unmeasured — it decides whether the sensor's
  "session CLEARED" note is permanent or transient.
- **What the entry does on `resume` or `compact`** — a payload with no `transcript_path` leaves the old
  entry standing: the safe direction, not the same as correct.
- **The ledger's defects are all from ONE session**, each dated at its commit — the upper bound.
  `FINDINGS.md#review6-disposal`.
- **The git guard has never fired outside a fixture.**
- **The crossing has happened ONCE** (2026-09-04): unverified that it survives an unattended relaunch, that
  anyone repeats it, or that the arm reaches ten.
- **`selftest`'s BEHAVIOUR half is not a gate** — 3 of 6 runs showed the agent not reading the file it was
  pointed at, and 09-11 added a 4th miss in 4 runs. This bus rings bells nobody answers and no gate sees it.
  🟢 Transport green 09-11 with and without `CLAUDE_COMM_AGENT` (`FINDINGS.md#one-suite-hardened`).
- **Anything non-Linux**: `comm who` reads `/proc`, degrading to "not running" elsewhere.
- A8's partial mutations and behaviour mid-TOOL-CALL live at `FINDINGS.md#test-debt`.

## Two conventions that erode silently

**Measurement traps** — a control not travelling the arms' code validates nothing; one that writes into, or
INHERITS, the world it measures is not a control. **Seven instances.** `FINDINGS.md#measurement-traps`.

**Acknowledgements amend the protocol** — `FINDINGS.md#ack-amendment`. First discharge 2026-09-08.
🟢 **A21 was amended this way on 2026-09-11**, on evidence: `FINDINGS.md#bus-split`.

**Conduct defects go in `LESSONS.md`** — *a lesson ends as an armed gate or it is a platitude.*

**Findings live in the code**, at the point they apply — *a rule whose cost you cannot see is a rule someone
will simplify away.*
