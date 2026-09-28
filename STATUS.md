# STATUS — claude-comm, 2026-09-28 (sessions 4–23)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*(2026-09-28, evening. Field = atlas, whose leader the owner relaunches "maybe tomorrow"; `work` dormant (`FIELDS.json`);
`lyra` leader-only, never launched; `orion` not relaunched since 09-19; `cobalt` leader-only; **`rigel` installed 09-28**
(an empty dir, leader-only - the owner kickstarted it himself that evening: 6 agents by 21:45). `2026-09-27.9` is in all
eight trees. A reviewer is Opus xhigh, priced 09-28 on #16/#17: ~120 calls, ~24 M cache reads, ~145 k out, 35-40 min.)*

1. **Review #19** - target: #18's disposition (`#review18`: the NUL runs, the X bit, the mark keyed on the scanner,
   `GIT_NO_REPLACE_OBJECTS`, the arms) AND the email rewrite of the recreated repo. Report `review/REVIEW-19.md`, its bell
   to `leader`; dispose it as #18 was. **If this section says nothing more, check `who` and the report before relaunching.**
2. **atlas's leader has TWO letters waiting** in its channel's `out/` (the bell refuses while it is stopped): the
   `leak-check` guide (09-27) and what to do so its public method skill carries neither the owner's personal address nor
   the five lines that tell the domain (09-28, at the owner's request). Ring both when it runs:
   `node bin/exchange-bell.mjs --peer <atlas's channel> --ref <file>`.
3. **The owner deleted the public repo and it was rebuilt a SECOND time, 09-28**: every commit's address is GitHub's
   masked one (his choice, set in THIS repo's `.git/config` only - his global address stays, so never advise GitHub's
   "block command line pushes"); 210 commits, every tree identical to before; 20 cited hashes remapped, checked by mapping
   them back; wiki disabled; MIT per the API; 0 hits over all 1 330 objects with 14 rules - the address is rule 14. From
   a fresh clone; old hashes answer "No commit found".

🔴 **THE OWNER'S RULE (09-27): no name of his personal projects in this PUBLIC repo** - every field project has a
codename here; the mapping is in no repo. The boot report prints the REAL directory names: **never copy a `field:` row
into a tracked file as is.** `bin/leak-check.mjs` + four git hooks + boot row `leak` enforce it (`FINDINGS.md#leak-check`).

**A0 - ✅ review #18 disposed 09-28** (`#review18`): online, clean; but ONE NUL hid a file from every mode (this repo's
`test/latency.mjs` has two) - now read as printable runs; hooks must be executable; the mark trusts only its own
scanner; replace refs are not followed; the arms assert their REASONS. Mutation: A85 6/6, prove-red `leak` 3/3. The 🔴
was NOT in the previous patch (v1's NUL skip) - three of five 🟡 were. **`boot --prove-red` took ~49 min 4 wide under
load** (the memory said ~12): budget for it.


🔴 **The bus is at 57 816 of 58 000 B (A22).** The next change to `comm.mjs`/`who.mjs` moves narrative to FINDINGS FIRST.

**B - the registry half of #13 §1, MEASURED 09-27 by A31 going red on my own end-to-end probe**: a hand-fire from
inside a session in the project rewrites that session's registry entry. Design in `FINDINGS.md#review13` "Named, not
fixed" - gate `record()` AND `refresh()` on the witness. Touches `Stop`, the hottest path: own change, own arm,
`selftest` both ways.

**C - tests faster, still reliable (owner, 09-27). `test/mutate.mjs` IS BUILT**: baseline in the same batch (not
green ⇒ VOID), a mutant that does not match exactly once is refused, a survivor is printed as the finding. Controls
run: refuses 2/2 inert mutants; a known-red mutant reddens A77 and a comment edit SURVIVES. **11 runs 3 wide in 238 s**
(serial was ~11 min). Parallel controls: 4/4 green 4 wide UNDER LOAD (atlas working), 6/6 green 6 wide on an idle machine (78 s for all six). Next: `attack` itself -
A59 8 s, A34 5 s, A20 4 s of 51 s; `--only <arm>` for iteration, the full suite stays the gate.

**D - `#bell-into-typing`**: the bell reads the AGENT's turn, never the PERSON's input line - it cut the owner's
half-typed message 09-27. He says it is not serious, keep writing. Named, not fixed.

**E - `who` still prints only `running`** (open item 5): `turnOf()` now lives in `who.mjs` and `send` uses it - `who`
could print the same verdict, after the byte cut above.

**F - carried, in priority order:** #15's names (`#review15`: the prove-red registry control blames itself for a live
session's own `compact` rewrite; the prettier header and `readJson` outside the print) · `REVIEW-12b.md`'s seven points (`FINDINGS.md#review12b`, each already measured) ·
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
   the import ⇒ an A21 amendment **and a split — both done 09-11; the states themselves are not built.**

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
