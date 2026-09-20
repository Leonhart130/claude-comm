# STATUS — claude-comm, 2026-09-20 (sessions 4–21)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*(Closed 2026-09-20. Field = getajob; `work` dormant by the owner's word (`FIELDS.json`); **`lucia` installed 09-20 at
his request** - leader-only roster, never launched. `moneyMaker`'s leader not relaunched since 09-19.)*

**A - FIRST: the half of `review/REVIEW-12b.md` this session did NOT dispose.** Its RED is fixed, armed and shipped:
`2026-09-20.1` (print `202409de44fc`), `--check`-green in **all six** trees. 🔴 **`FINDINGS.md#review12b` lists the
seven carried items with their section numbers - §2 the `dormant-awake` date being the one that pays ▶ NEXT E's churn.
Every one is ALREADY MEASURED in the report: take the measurement, never re-derive it.**

**B - `boot.mjs --hook` still records with NO ownership test at all** (`boot.mjs:489`; the stub now has one).
**Measured why it cannot simply adopt `witnessStart`:** boot's own `--prove-red` fires `--hook --root <fixture>` from
a chain whose `claude` ancestor is the operator's session, so those fires are FOREIGN by construction and its own
arms would redden. It needs a declared test seam first. Prose in `CLAUDE.md` + `review/CLAUDE.md` is the only guard.

**C - the phantom audit, one query, not built:** a recorded start whose `session` matches no transcript under
`~/.claude/projects/` is a candidate phantom. Baseline across five trees: **4 unmatched, all ≥ a week before the fix**
(a rotated transcript explains them as well). **Any unmatched start dated after 2026-09-19 is a real candidate.**

**D - moneyMaker: the adoption measurement is STARTED, on its own transcript** (`7c449631`, 09-19, pre-review build).
Measured by parsing TOOL CALLS, never grep - the skills' own text names every command, so a grep counts the
documentation, and the reviewer fell into that trap once inside the tool-call parse. **Introduction received 1×;
`Skill`: `leader-expert` + `claude-in-chrome`, NOT `claude-comm`; `comm.mjs inbox` twice, unprompted.** So the answer
forming for the owner is sharper than "skill yes": *it never loaded the skill and still used the bus - the
introduction produced those two calls.* Continue from `./-home-leonh-Dev-moneyMaker*/` (prefix `./`: dirs start `-`)
once it has experts: does it reach for `send`/`launch.mjs`, does its note put the pointer first?

**D2 - the MID-TURN channel exists, measured with its control** (`FINDINGS.md#midturn-channel`), asked for by
getajob's leader with a price: a brief marked "AVANT tout le reste" was read an hour late and five real dispatches
waited. A `PostToolUse` hook's `hookSpecificOutput.additionalContext` **reaches the model at the tool result** -
stderr never does. 🔴 **The transport is NOT the open half: whether an agent ACTS on it is unmeasured, and
`selftest`'s behaviour half has the agent ignoring what it is pointed at in 5 of 8 runs.** Build `--kind blocked`
behind that only with the peer's field count, not my bench. Their parade (`comm inbox <agent>` before each big step)
stands on its own and they were told to write it into their specs regardless.

**E - two AMENDMENTS demanded at the 2026-09-20 close** (3 acks each, same cause):
`field:getajob@stranded-untold:extension` and `channel:getajob-leader@unanswered:2026-09-19-recu-...-volontairement.md`.
Both are the PEER's own state: mail their leader stopped on purpose, and a thread their own letter closed ("rien
n'attend de réponse"). The 09-18 amendment already moved peer operations to shown-not-gated; `stranded-untold` was
kept gating because the BUS mis-told the sender. Design it with an arm (what does the row measure now?) or delete the
cause - evidence, never an opinion, and it lands as a gated change. `FINDINGS.md#peer-state`.

**✅ CLOSED 2026-09-20 - T1's root half, on this session:** this leader's start added **exactly ONE** line to
`.comm/handoff/leader.log` where the previous session wrote **two** 43 ms apart. 7 of its 8 sessions are twins; the
ledger collapses them and says so. Both halves of T1 now seen live.

**Carried:** A2 (a marker written when the bus RAN, not when it SHOWED - §3(c) is a second reach to it) · the
installer overwrites a `SKILL.md` it did not generate · every other stderr line of the stub reaches no model · S6 ·
getajob's `rings.jsonl` read (A62, A65) · #9 A3 · C7 · `who`'s 3rd/4th states · the restart trigger (ledger UNKNOWN) ·
C3. **Later, owner's order:** adoption (measure D) → Rust port → value, with getajob's leader.

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
| reviews | #1–#9 **dispositioned**; **#10 dispositioned 2026-09-13** except C4 and A1 — ▶ NEXT 0. #9's worst two were defects in #8's own fixes. #5's amendment stands in `CLAUDE.md`: *a gate that CAN redden is not yet one that reddens for the property in its own title* — **09-11 found its fifth and sixth instances, one of them inside the arm written to record the fifth** |

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

4. **🟢 Holding a machine resource — `bin/claim.mjs`, IN PRODUCTION**, 17 arms, A38, three field trees. It advises:
   it opens nothing, kills nothing, blocks nothing. Closed 2026-09-10 by the getajob field with two real sessions on
   one vite server. `release` refuses while the holder LIVES; the record cannot tell a crash from a forgotten
   release. Claims live in one project, so a resource shared ACROSS projects is visible to nobody.
   `FINDINGS.md#claim-file`. ⭐ Their verdict, accepted as the scope: *a claim makes sharing visible; the first
   answer is not to share.*

5. **🟡 `who` reports TWO states and there are FOUR.** A leader lost **2 h 30** reading `running` for four
   sessions sitting at their prompt. ✅ `context.mjs --sessions` prints `quiet <age>` — a MEASUREMENT, never
   "at prompt". 🟢 Third: a session that has taken **no turn has no transcript at all**
   (`FINDINGS.md#no-turn-yet`) — and `launch.mjs --prompt` now stops manufacturing them. 🟢 Fourth, measured
   by the field 09-11: **CPU time separates *working* from *idle*** and `/proc` already carries it; one
   sample each, so no threshold from it. 🔴 All of it belongs in `comm who` and cannot go there — A21 forbids
   the import ⇒ an A21 amendment **and a split — both done 09-11; the states themselves are not built.**

6. **🟢 A reply must NAME what it answers** — `Answers:` in front matter on **line 1**, anchored to the first byte
   so a quotation cannot forge one. Stateless; a failed scan says `CANNOT SAY`. Contract: `exchange/README.md`.
   `FINDINGS.md#answered-mtime`. ⚠️ The row dates letters by FILENAME (C3, carried).

7. **🟢 A program launches an agent, and the agent puts its own window away.** `launch.mjs` (A46) builds the child's
   `PATH`, resolves the runtime absolutely, SPLITS the caller's tab (`--os-window`, and `--minimized` with it),
   refuses a launch it cannot name, and `--prompt` gives the new session a first turn. `close.mjs` (A51): an agent
   closes ITSELF, never a sibling. `FINDINGS.md#self-close`, `#split-raised-the-cap`.

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
- **The restart TTL lapsed on a human TWICE, then 3 acks on 09-13 — now ▶ NEXT A.** Try armer-gone AND not
  ancient, TTL as a backstop — `claim.mjs` already ships the (pid, start, boot) test. Not built.
- **Test debt from review #4, none of it gated:** `FINDINGS.md#test-debt`.
- **`#A20` from 2026-09-04 is still unexplained** (the 09-05 instance was fixed, `#update-signal`).
  **Run gates unfiltered.**
- **The erosion counter WAS discharged** 2026-09-08 (`from: 9`, review #8 D3). 🟢 Its design flaw — one row,
  several causes — was fixed 09-10; the stale "▶ NEXT 4" pointer here was cut 09-11, not retracted.

## ⚠️ What was NOT verified

- **A launched session's tier over its whole life** — the field measured it ~15 s after start, twice.
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
INHERITS, the world it measures is not a control. **Ten instances.** `FINDINGS.md#measurement-traps`.

**Acknowledgements amend the protocol** — `FINDINGS.md#ack-amendment`. First discharge 2026-09-08.
🟢 **A21 was amended this way on 2026-09-11**, on evidence: `FINDINGS.md#bus-split`.

**Conduct defects go in `LESSONS.md`** — *a lesson ends as an armed gate or it is a platitude.*

**Findings live in the code**, at the point they apply — *a rule whose cost you cannot see is a rule someone
will simplify away.*
