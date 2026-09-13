# STATUS — claude-comm, 2026-09-13 (sessions 4–18)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*(2026-09-13. **The owner handed over the whole project with two asks: let a leader pick each expert's model
and effort, and "the inbox saturates".** The first shipped the same morning. The second was never observed —
but the load test built to answer it found the one thing that does saturate, and it was delivery.)*

**0 — 🟢 REVIEW #10 IS CLOSED.** **C4:** A22 gates the WHOLE bus at one Read call of the model that reviews it:
25 000 tokens × 2.32 B/token (the lowest Opus-5 ratio measured on this repo's JS) = **58 000 B**; the bus is
51 379 B, ~21 040 tokens, 89 %. Proved red past the total AND for a third module under the old per-module cap —
the split escape. `FINDINGS.md#bus-read-in-one-call`. ⚠️ The Read tool now PAGES at 25 000 tokens instead of
refusing, counted in the READER's tokenizer (`boot.mjs`: Opus 5 79 410, Haiku 60 572) — re-measure the ratio
when the reviewing model changes. **A1:** `ARM_FLOOR` replaced by a two-way self-scan (every declared arm must
report, every reporting arm must be declared). Proved: an arm skipped → named; the first scan draft → "SELF-SCAN IS
BROKEN"; a new arm → 62 of 62, green; an abort after A1 → the 59 silent arms named.

**1 — 🟢 SHIPPED 2026-09-13 AND SETTLED — the detail is in `CHANGELOG.md` and `FINDINGS.md`, not here.** Review #10
C1/C2/C3/C5 (A58, A59, A21, selftest), each proved red · the tier is the caller's: `launch.mjs --model --effort`,
required (A57), measured end to end by the field · a notice drained 100 messages and showed 8 — now only what it
shows (A60, `#overflow-drained-unseen`); "the inbox saturates" was never observed and the load test found nothing
else · 32 exit listeners → one. 🟡 **Unexplained:** why ~31 listeners were silent until A59 made 32. ⚠️ A `Stop`
continuation still delivers nothing: the rest wait for the next real turn.

**2 — ⚠️ `bin/context.mjs` READS ONE TURN BEHIND.** Measured today: a 9.7 KB read moved it only a turn later
(+1 683, then +4 617). A before/after with it needs a turn in between. **Not yet named at its site.**

**3 — ⚠️ A DOORBELL NOBODY RECORDS RINGING.** 12:50:25Z today, `wake.mjs`'s text in this leader's input; `comm
inbox` empty, no wake record in any tree at that time, no `wake`/`kitten` tool call in any getajob or claude-comm
transcript 12:47–12:51Z. Both leaders are kitty **window 1** (instances 12670 and 14341), and a wake record
stores the window id WITHOUT its socket — a candidate path, not a proven one. Measure before touching wake.

**4 — 🔴 RUN THE CONTROLS FIRST**, `CLAUDE_COMM_AGENT` set (A48), output **to a file**; read the suite's LAST
LINE, never a wrapper's exit code. ⚠️ **Never two suites at once** — they share kitty and make reds that look
like findings; a runner in copies waits on a done-file. 🔴 **zsh:** quote globs, never `echo ===`, no bare
`$args` — three silent non-runs today.

**5 — 🟡 CARRIED:** #9 A3 · C7 · #8 A3 (minor) · `who`'s third and fourth states · `dismiss --citing` ·
`comm wait --for` · context.mjs's two `/clear` limits (do not "fix" with a guess) · the letter to `work`'s
leader still unread, two `zz-` claims there held by dead pids · the automatic restart trigger (ledger
UNKNOWN) · boot's `channel:` row says a letter "arrived 13h ago" that came in under an hour earlier: it
ages by the filename's date, deliberately (review #8 C3) — the word "arrived" is wrong, not the rule. A fresh review: `launch.mjs review --model opus --effort xhigh --prompt "…"` — the field's rule
says never Sonnet for review.
**Later, in the owner's order (2026-09-13):** agents reaching for the bus unprompted (MCP and/or skill — measure
where they failed first) → the Rust port → what the tool can earn him, worked out with getajob's leader.

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
   the import ⇒ an A21 amendment **and a split — both done 09-11; the states themselves are not built.**

6. **🟢 A reply must NAME what it answers** — `Answers:` in front matter on **line 1**, anchored to the
   first byte so a quotation cannot forge one (#8 C1). Stateless, no read receipt; a failed scan says
   `CANNOT SAY`. Contract: `exchange/README.md`. `FINDINGS.md#answered-mtime`.

7. **🟢 A program launches an agent, and the agent puts its own window away.** `launch.mjs` (A46) builds the
   child's `PATH` and resolves the runtime absolutely; **09-11 it SPLITS the caller's tab, refuses a launch
   it cannot name, and `--prompt` gives the new session a first turn** — without one it sits inert while
   `who` says `running`. 🟢 **`close.mjs` (A51)**: an agent closes ITSELF, never a sibling.
   🟢 **Review #10 C1/C2 fixed 09-13:** the claim refusal runs (A58); the probe records `null` when blind (A59).
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
INHERITS, the world it measures is not a control. **Seven instances.** `FINDINGS.md#measurement-traps`.

**Acknowledgements amend the protocol** — `FINDINGS.md#ack-amendment`. First discharge 2026-09-08.
🟢 **A21 was amended this way on 2026-09-11**, on evidence: `FINDINGS.md#bus-split`.

**Conduct defects go in `LESSONS.md`** — *a lesson ends as an armed gate or it is a platitude.*

**Findings live in the code**, at the point they apply — *a rule whose cost you cannot see is a rule someone
will simplify away.*
