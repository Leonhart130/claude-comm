# STATUS — claude-comm, 2026-10-25 (sessions 4–24)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*(2026-10-25 ~01:30, end of a session that started 10-24 after 26 days off. `2026-10-25.2` is in all ten trees. **WORK IS
THE MAIN FIELD** - the owner: atlas inactive and not relaunched for days, "c'est Work qui prend le relais". Standing
green light: "je te laisse gérer … T'as mon feu vert pour tout." Review #19 ran and is DISPOSED (`FINDINGS.md#review19`).)*

1. **Read work's channel first** - two real-session measurements are owed there: an expert's close SEEN whole then gone
   ~2 s later, and a `send` to a resting agent waking it unasked. Measured for real tonight on this repo's own reviewer:
   its `send` rang the leader 213 ms later (`post-tool`), its after-turn close went 2.3 s after its turn ended.
2. **Work's ideas 1-2 - usage readings for experts, `comm stop <agent>`** - both want a MID-TURN channel; the
   `PostToolUse` hook installed 10-24 is one (`additionalContext`). Read `FINDINGS.md#midturn-channel` FIRST. Not built.
3. 🔴 **The bus is at 57 936 of 58 000 B (A22).** The next change to `comm.mjs`/`who.mjs` moves narrative to FINDINGS first.
4. **Review #19 §5 - `leak-check` refuses almost any binary (rule 5)**: the fix changes what rules mean in a binary -
   the owner's call; ask him with the measured rate (18 of 20 random 100 KB files).
5. **Named, unarmed**: the `briefs` row's unreadable-root branch, and its reply-older-than-brief branch (only the
   presence arms ran in `--prove-red`); A31 still blames the suite for a live session's own registry rewrite (F below).
6. **Letters waiting for a bell**: deneb's (its own new channel) and atlas's - both leaders not running.

🔴 **THE OWNER'S RULE (09-27): no name of his personal projects in this PUBLIC repo** - every field project has a
codename here; the mapping is in no repo. The boot report prints the REAL directory names: **never copy a `field:` row
into a tracked file as is.** `bin/leak-check.mjs` + four git hooks + boot row `leak` enforce it (`FINDINGS.md#leak-check`).
**10-24: the pre-commit hook refused my own FINDINGS** - real field names, one of them not yet codenamed. A new field
gets its codename and its rule BEFORE its name is written (deneb, rule 15), and an expert's name is not written either.

🔴 **THE OWNER'S WINDOW RULE (09-19, 10-24): nothing a test opens lands in his view** (*"t'as besoin d'ouvrir ces 50
fenêtres ?"*). Every kitty arm runs in ONE minimized bench (`bench()`, `test/attack.mjs`; measured 0 panes in a visible
tab). A new kitty arm uses `bench()`/`benchRun()`/`besideMe()`, never a bare `kitten @ launch`.

**A0 - ✅ review #18 disposed 09-28** (`#review18`). **`boot --prove-red` took ~49 min 4 wide under load** (the memory
said ~12): budget for it.

**B - the registry half of #13 §1, MEASURED 09-27 by A31 going red on my own end-to-end probe**: a hand-fire from
inside a session in the project rewrites that session's registry entry. Design in `FINDINGS.md#review13` "Named, not
fixed" - gate `record()` AND `refresh()` on the witness. Touches `Stop`, the hottest path: own change, own arm,
`selftest` both ways.

**C - tests faster, still reliable (owner, 09-27): `test/mutate.mjs` is built and in use** (10-24: 4 batches, 13 mutants,
3-4 wide, ~95 s each, baselines green). Next: `attack` itself faster, `--only <arm>` for iteration; the full suite stays the gate.

**D - `#bell-into-typing`**: the bell reads the AGENT's turn, never the PERSON's input line - it cut the owner's
half-typed message 09-27. He says it is not serious, keep writing. Named, not fixed.

**E - ✅ `who` prints each session's turn since 10-24** (`#who-shows-the-turn`, A91): working, IDLE n min, a dialog, the runtime's word.

**F - carried, in priority order:** #15's names (`#review15`: the prove-red registry control blames itself for a live
session's own `compact` rewrite - and A31 for a `/clear`, 10-24, ▶ NEXT 4; the prettier header and `readJson` outside the print) · `REVIEW-12b.md`'s seven points (`FINDINGS.md#review12b`, each already measured) ·
`boot.mjs --hook` records with NO ownership test (`boot.mjs:489`; needs a declared test seam first - its own
`--prove-red` fires are foreign by construction) · two amendments demanded by acks: `stranded-untold` (atlas's
`extension` waits ON PURPOSE, their decision - `FINDINGS.md#peer-state`) ·
#13 §7b/§7c (`handoff.mjs`'s D2 guard masked by `restart.mjs`'s; `INSIDE` unarmed) · the stub files
`basename(transcript_path)` as the session, not the witnessed id · #14's names: a DETACHED replay of a live id is counted (by design, E1), `rootRecords` overwrites the witness's reason, a ledger killed at 5 s after its append · D2 mid-turn: timing now measured 4/4
(`#midturn-channel`), obedience to a POINTER is the open half - build `--kind blocked` only on atlas's field count.

**Carried:** A2 marker · the installer overwrites a `SKILL.md` it did not generate · S6 · atlas's `rings.jsonl`
(A62, A65) · #9 A3 · C7 · `who`'s 3rd/4th states · the restart trigger (ledger UNKNOWN) · C3. **Later, owner's
order:** adoption (orion measured 09-19) → Rust port → value, with atlas's leader.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs` · `session-registry.mjs` · `ledger.mjs` · `restart-signal.mjs` · `claim.mjs` · `wake.mjs` · `exchange-bell.mjs` · `context.mjs` · `handoff.mjs` · `restart.mjs` · `launch.mjs` · `close.mjs` · `boot.mjs` · `install.mjs` · `test/` — no dependencies |
| repo | `origin` = `Leonhart130/claude-comm`. **The push is the leader's call**, delegated 2026-09-05, along with installing into field trees — do not ask again |
| **vega** | in real daily use — 26 real deliveries, both directions |
| gates | `attack` (deterministic, every case armed) · `ledger --prove-red`, now run INSIDE it · `selftest` (real sessions, not gated by boot) · `context` and `boot` controls. **Counts live in boot's output, never here** |
| boot | `node bin/boot.mjs` — every gating row armed; `--fast` is injected at session start, contract in `CLAUDE.md` |
| **ledger** | `node bin/ledger.mjs` — the reboot instrument, here AND in the field (`--root <tree>`); arms run inside `attack` as A34. Each start stores `pending`, the peer's covariate — **never inbox depth**: session #41 had an empty mailbox and the largest real queue of its last five boots. **Counts live in boot's output, never here** |
| **sensor** | `node bin/context.mjs` — pid → transcript through `bin/session-registry.mjs` (the `SessionStart` hook writes it, keyed on pid + start time + boot id); **refuses on a miss**. `FINDINGS.md#clear-blind` |
| reviews | #1–#12b **dispositioned** (#12b's seven points carried — `FINDINGS.md#review12b`); **#13, #14 and #15 disposed 2026-09-27** — `FINDINGS.md#review13`, `#review14`, `#review15`, released as `2026-09-27.1`, `.2`, `.5`. #5's amendment stands in `CLAUDE.md`: *a gate that CAN redden is not yet one that reddens for the property in its own title* — **#12b was its seventh instance, inside an arm the previous disposition had just written**; **#13 its eighth, in the arm #12b's disposition wrote** |

## ⏭️ OPEN
1. **🔴 Latency is a mailbox, not an interrupt.** Re-derive with `node test/latency.mjs <log>`; never
   transcribe the table. 26 deliveries: leader→expert median **1462 s**, expert→leader **586 s** — mail
   lands at the recipient's *turn boundary*, so **an agent alive but idle never receives it** and `who`
   saying "running" does not mean reachable. Never call this bus real-time. A16; `HISTORY.md`.

2. **`--reply-to <id>` (threading).** Field-requested, then field-deprioritised: the substance lives in the
   file.

3. ✅ **The wake is BUILT** (`bin/wake.mjs`, A32; its text `#doorbell-text`). ⚠️ Within `QUIET_MS` of an UNANSWERED ring
   it rings nobody and nothing retries - an answered ring no longer silences the next (`#quiet-answered`, A84).

4. 🟢 **`bin/claim.mjs`, in production** (A38): advisory only; a claim in one project is invisible to another
   (`FINDINGS.md#claim-file`). Their verdict, the scope: *a claim makes sharing visible; the first answer is not to share.*

5. **🟡 `who` reports TWO states and there are FOUR.** A leader lost **2 h 30** reading `running` for four
   sessions sitting at their prompt. ✅ `context.mjs --sessions` prints `quiet <age>` — a MEASUREMENT, never
   "at prompt". 🟢 Third: a session that has taken **no turn has no transcript at all**
   (`FINDINGS.md#no-turn-yet`) — and `launch.mjs --prompt` now stops manufacturing them. 🟢 Fourth, measured
   by the field 09-11: **CPU time separates *working* from *idle*** and `/proc` already carries it; one
   sample each, so no threshold from it. 🔴 All of it belongs in `comm who` and cannot go there — A21 forbids
   the import ⇒ an A21 amendment **and a split — both done 09-11; the states are BUILT 10-24 in `who` (A91): working / IDLE n min / WAITING / the runtime's word.**

6. 🟢 **A reply names what it answers** (`Answers:` on line 1; `exchange/README.md`, `#answered-mtime`). ⚠️ The row
   dates letters by FILENAME (C3, carried).

7. 🟢 **`launch.mjs` launches an agent, `close.mjs` lets it close ITSELF** (A46, A51). ⚠️ **`--minimized` is UNARMED**
   (`kitten @ ls` reports no minimized state) - `#self-close`, `#split-raised-the-cap`.

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

🔴 **Moved 2026-09-20 to [`FINDINGS.md#not-verified`](FINDINGS.md#not-verified)** — tier 0 is capped in BYTES and
this register is long, stable and re-read every boot. **It did not shrink and nothing was retracted.** Read it
before claiming anything about `close.mjs` under a real agent, the registry's `GONE` wording, `--release`,
`clear`-blindness, the git guard, the crossing, `selftest`'s behaviour half, or anything non-Linux.

## Two conventions that erode silently

**Measurement traps** — a control not travelling the arms' code validates nothing; one that writes into, or
INHERITS, the world it measures is not a control. **Ten instances.** `FINDINGS.md#measurement-traps`.

**Acknowledgements amend the protocol** — `FINDINGS.md#ack-amendment`. First discharge 2026-09-08.
🟢 **A21 was amended this way on 2026-09-11**, on evidence: `FINDINGS.md#bus-split`.

**Conduct defects go in `LESSONS.md`** — *a lesson ends as an armed gate or it is a platitude.*

**Findings live in the code**, at the point they apply — *a rule whose cost you cannot see is a rule someone
will simplify away.*
