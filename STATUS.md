# STATUS — claude-comm, 2026-09-27 (sessions 4–22)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*(Closed 2026-09-27. Field = atlas; `work` dormant by the owner's word (`FIELDS.json`); `lyra` leader-only, never
launched; `orion`'s leader not relaunched since 09-19. **`2026-09-27.2` is in all six trees**, `--check` in sync.
🔴 **The owner was at 84 % of his WEEKLY usage limit on 09-27** (seen in the reviewer's pane) - price every model
call, every reviewer, every `selftest` against that.)*

**A - review #13 AND #14 are disposed** (`FINDINGS.md#review13`, `#review14`). #14: no red, four yellows - every one in
the ARMS or the PROSE; eleven mutants now each redden their own row, one named survivor (the torn-read retry).
**Review #15 on `.2`: ask the owner first** (usage). If he says yes, aim it at `test/mutate.mjs` itself (new, and it
now carries the mutation claims of two dispositions) and at the `.2` CHANGELOG, which is the third release note in a
row a reviewer had to correct.

**B - the registry half of #13 §1, MEASURED 09-27 by A31 going red on my own end-to-end probe**: a hand-fire from
inside a session in the project rewrites that session's registry entry. Design in `FINDINGS.md#review13` "Named, not
fixed" - gate `record()` AND `refresh()` on the witness. Touches `Stop`, the hottest path: own change, own arm,
`selftest` both ways.

**C - tests faster, still reliable (owner, 09-27). `test/mutate.mjs` IS BUILT**: baseline in the same batch (not
green ⇒ VOID), a mutant that does not match exactly once is refused, a survivor is printed as the finding. Controls
run: refuses 2/2 inert mutants; a known-red mutant reddens A77 and a comment edit SURVIVES. **11 runs 3 wide in 238 s**
(serial was ~11 min). The parallel control is still ONE run of 4/4 - repeat before going wider. Next: `attack` itself -
A59 8 s, A34 5 s, A20 4 s of 51 s; `--only <arm>` for iteration, the full suite stays the gate.

**D - `#bell-into-typing`**: the bell reads the AGENT's turn, never the PERSON's input line - it cut the owner's
half-typed message 09-27. He says it is not serious, keep writing. Named, not fixed.

**E - ✅ atlas answered 09-27: NO hand-fire, MEASURED** (114 transcripts). One field datum for D2: `net`
rang `blocked` once and acted on the pointer.

**F - carried, in priority order:** `REVIEW-12b.md`'s seven points (`FINDINGS.md#review12b`, each already measured) ·
`boot.mjs --hook` records with NO ownership test (`boot.mjs:489`; needs a declared test seam first - its own
`--prove-red` fires are foreign by construction) · two amendments demanded by acks: `stranded-untold` (atlas's
`extension` waits ON PURPOSE, their decision - `FINDINGS.md#peer-state`) and a close blind to its own doorbell ·
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
| reviews | #1–#12b **dispositioned** (#12b's seven points carried — `FINDINGS.md#review12b`); **#13 and #14 disposed 2026-09-27** — `FINDINGS.md#review13`, `#review14`, released as `2026-09-27.1` and `.2`. #5's amendment stands in `CLAUDE.md`: *a gate that CAN redden is not yet one that reddens for the property in its own title* — **#12b was its seventh instance, inside an arm the previous disposition had just written**; **#13 its eighth, in the arm #12b's disposition wrote** |

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

4. **🟢 Holding a machine resource — `bin/claim.mjs`, IN PRODUCTION**, 17 arms, A38, three field trees. It
   advises: opens nothing, kills nothing, blocks nothing. `release` refuses while the holder LIVES, and the record
   cannot tell a crash from a forgotten release. Claims live in ONE project, so a resource shared ACROSS projects is
   visible to nobody. `FINDINGS.md#claim-file`. ⭐ Their verdict, accepted as the scope: *a claim makes sharing
   visible; the first answer is not to share.*

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

7. **🟢 A program launches an agent, and the agent puts its own window away.** `launch.mjs` (A46) builds the
   child's `PATH`, resolves the runtime absolutely, splits the caller's tab (`--os-window`, `--minimized` with it),
   refuses a launch it cannot name, and `--prompt` gives the new session a first turn. `close.mjs` (A51): an agent
   closes ITSELF, never a sibling. ⚠️ **`--minimized` is UNARMED** — A50 asserts only that the window lands outside
   the caller's tab, and `kitten @ ls` does not report a minimized state, so the honest arm is the `--print` argv.
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
