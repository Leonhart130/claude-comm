# STATUS — claude-comm, 2026-10-25 (sessions 4–24)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*(2026-10-25 20h34 CET by `date`. **WORK IS THE MAIN FIELD.** The owner: "j'te laisse gérer tout ça ce soir"; **"tu peux
utiliser tout l'usage jusque 100%"** - never self-throttle near the cap. Tonight he made the self-relay THE priority.)*

1. **The first REAL relay in a field.** rigel's leader adds `"relay"` to its config and ends its 150 k Stop hook's message
   with `relay.mjs` (letter `…21h-…-livre.md`); its experts are its task T8. Read `.comm/relay/<agent>.json` there:
   relayed, the clear's ms, the prompt's ms, and whether the fresh session booted. Unarmed in relay.mjs (no arm reaches
   them): the turn re-read just before `/clear`, and the window re-check at the relay. The screen/keystroke race is named.
2. **Work owes nothing**: measurement 1 arrived 09h08 (`turn_ended` there). Usage's first real crossing waits on work's
   thresholds; its `statusLine` waits on the owner's word. An EXPERT's first start on a new version is still unmeasured.
3. **rigel's four memory ideas** (its 15h09 letter; my 20h06 reply disposes them): `claim --machine`, `launch --memory`,
   memory in `who` (outside who.mjs - the bus is 50 754 of 58 000 B), "closed" vs "crashed" from `.comm/close/`.
4. **Arm LESSONS §8**: the `channel:` row compares my outgoing letters' written time with the file's (>10 min warns).
5. **Letters waiting for a bell**: deneb's (`exchange/<deneb>-leader/`) and atlas's - ring with
   `node bin/exchange-bell.mjs --peer <channel> --ref <file>` when their leaders run.

**Done 10-25** (night `0779386`..`0e1dbaf`: `.3`-`.5`, `#stranded-named`, F2's zombie; evening: `2026-10-25.6`) - `relay.mjs`,
the owner's priority through rigel: measured live twice, refuses on a half-typed line; A95 + 9/9 mutants, each its own condition.

🔴 **THE OWNER'S RULE (09-27): no name of his personal projects in this PUBLIC repo** - every field project has a
codename here; the mapping is in no repo. The boot report prints the REAL directory names: **never copy a `field:` row
into a tracked file as is.** `bin/leak-check.mjs` + four git hooks + boot row `leak` enforce it (`FINDINGS.md#leak-check`).
**10-24: the pre-commit hook refused my own FINDINGS** - real field names, one of them not yet codenamed. A new field
gets its codename and its rule BEFORE its name is written (deneb, rule 15), and an expert's name is not written either.

🔴 **THE OWNER'S WINDOW RULE (09-19, 10-24): nothing a test opens lands in his view** (*"t'as besoin d'ouvrir ces 50
fenêtres ?"*). Every kitty arm runs in ONE minimized bench (`bench()`, `test/attack.mjs`; measured 0 panes in a visible
tab). A new kitty arm uses `bench()`/`benchRun()`/`besideMe()`, never a bare `kitten @ launch`.

**A0 - ✅ reviews #18 (09-28) and #19 (10-25) disposed** (`#review18`, `#review19`). **`boot --prove-red` took ~62 min ALONE
on 10-25** (each fixture gate runs `attack`, 94 s now): budget for it, and make `attack` faster (C).

**B - the registry half of #13 §1, MEASURED 09-27 by A31 going red on my own end-to-end probe**: a hand-fire from
inside a session in the project rewrites that session's registry entry. Design in `FINDINGS.md#review13` "Named, not
fixed" - gate `record()` AND `refresh()` on the witness. Touches `Stop`, the hottest path: own change, own arm,
`selftest` both ways.

**C - tests faster, still reliable (owner, 09-27): `test/mutate.mjs` is built and in use** (10-24/25: 11 batches, 45 mutants,
each reddening its own condition; one batch VOID - its baseline found a real defect, `#docs-from-code`). Next: `attack` itself faster, `--only <arm>` for iteration; the full suite stays the gate.

**D - `#bell-into-typing`**: the bell reads the AGENT's turn, never the PERSON's input line - it cut the owner's
half-typed message 09-27. He says it is not serious, keep writing. Named, not fixed.

**E - ✅ `who` prints each session's turn since 10-24** (`#who-shows-the-turn`, A91): working, IDLE n min, a dialog, the runtime's word.

**F - carried, in priority order:** #15's names (`#review15`: the prove-red registry control blames itself for a live
session's own `compact` rewrite (A31's twin of it FIXED 10-25, `#review19`; boot's control still has it); the prettier header and `readJson` outside the print) · `REVIEW-12b.md`'s seven points (`FINDINGS.md#review12b`, each already measured) ·
`boot.mjs --hook` records with NO ownership test (the `has("--hook") && payload` branch; needs a declared test seam
first - its own `--prove-red` fires are foreign by construction) ·
#13 §7b/§7c (`handoff.mjs`'s D2 guard masked by `restart.mjs`'s; `INSIDE` unarmed) · the stub files
`basename(transcript_path)` as the session, not the witnessed id · #14's names: a DETACHED replay of a live id is counted (by design, E1), `rootRecords` overwrites the witness's reason, a ledger killed at 5 s after its append · D2 mid-turn: timing now measured 4/4
(`#midturn-channel`), obedience to a POINTER is the open half - build `--kind blocked` only on atlas's field count.

**Carried:** A2 marker · the installer overwrites a `SKILL.md` it did not generate · S6 · atlas's `rings.jsonl`
(A62, A65) · #9 A3 · C7 · the restart trigger (ledger UNKNOWN) · C3. **Later, owner's
order:** adoption (orion measured 09-19) → Rust port → value, with atlas's leader.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs` · `session-registry.mjs` · `ledger.mjs` · `restart-signal.mjs` · `claim.mjs` · `wake.mjs` · `exchange-bell.mjs` · `context.mjs` · `handoff.mjs` · `restart.mjs` · `launch.mjs` · `close.mjs` · `relay.mjs` · `boot.mjs` · `install.mjs` · `test/` — no dependencies |
| repo | `origin` = `Leonhart130/claude-comm`. **The push is the leader's call**, delegated 2026-09-05, along with installing into field trees — do not ask again |
| **vega** | in real daily use — 26 real deliveries, both directions |
| gates | `attack` (deterministic, every case armed) · `ledger --prove-red`, now run INSIDE it · `selftest` (real sessions, not gated by boot) · `context` and `boot` controls. **Counts live in boot's output, never here** |
| boot | `node bin/boot.mjs` — every gating row armed; `--fast` is injected at session start, contract in `CLAUDE.md` |
| **ledger** | `node bin/ledger.mjs` — the reboot instrument, here AND in the field (`--root <tree>`); arms run inside `attack` as A34. Each start stores `pending`, the peer's covariate — **never inbox depth**: session #41 had an empty mailbox and the largest real queue of its last five boots. **Counts live in boot's output, never here** |
| **sensor** | `node bin/context.mjs` — pid → transcript through `bin/session-registry.mjs` (the `SessionStart` hook writes it, keyed on pid + start time + boot id); **refuses on a miss**. `FINDINGS.md#clear-blind` |
| reviews | #1–#12b **dispositioned** (#12b's seven points carried — `FINDINGS.md#review12b`); **#13, #14 and #15 disposed 2026-09-27** — `FINDINGS.md#review13`, `#review14`, `#review15`, released as `2026-09-27.1`, `.2`, `.5`. #5's amendment stands in `CLAUDE.md`: *a gate that CAN redden is not yet one that reddens for the property in its own title* — **#12b was its seventh instance, inside an arm the previous disposition had just written**; **#13 its eighth, in the arm #12b's disposition wrote**; #16-#18 disposed 09-27/28; **#19 disposed 10-25**: its 🔴 was in the previous session's newest fix again, and 6 of 7 of its mutants had survived that session's arms |

## ⏭️ OPEN
1. **🔴 Latency is a mailbox, not an interrupt.** Re-derive with `node test/latency.mjs <log>`; never
   transcribe the table. 26 deliveries: leader→expert median **1462 s**, expert→leader **586 s** — mail
   lands at the recipient's *turn boundary*. Since 10-24 an IDLE recipient is rung at once by the sender's
   `PostToolUse` (213 ms, measured live, A90); a BUSY one still waits for its turn end. Never call it real-time. A16.

2. **`--reply-to <id>` (threading).** Field-requested, then field-deprioritised: the substance lives in the
   file.

3. ✅ **The wake is BUILT** (`bin/wake.mjs`, A32; its text `#doorbell-text`). ⚠️ Within `QUIET_MS` of an UNANSWERED ring
   it rings nobody and nothing retries - an answered ring no longer silences the next (`#quiet-answered`, A84).

4. 🟢 **`bin/claim.mjs`, in production** (A38): advisory only; a claim in one project is invisible to another
   (`FINDINGS.md#claim-file`). Their verdict, the scope: *a claim makes sharing visible; the first answer is not to share.*

5. ✅ `who`'s states, BUILT 10-24 (A91, `#who-shows-the-turn`): working / IDLE n min / WAITING / the runtime's word, from
   the runtime's own record - the 2 h 30 a leader lost reading `running` for four sessions at their prompt is closed.
   Still true: a session that has taken no turn has no transcript (`#no-turn-yet`).

6. 🟢 **A reply names what it answers** (`Answers:` on line 1; `exchange/README.md`, `#answered-mtime`). ⚠️ The row
   dates letters by FILENAME (C3, carried).

7. 🟢 **`launch.mjs` launches an agent, `close.mjs` lets it close ITSELF** (A46, A51). ⚠️ **`--minimized` is UNARMED**
   (`kitten @ ls` reports no minimized state) - `#self-close`, `#split-raised-the-cap`.

8. **🟡 The autonomy mandate — self-launching experts, a self-rebooting leader.** Given 2026-09-04; settled
   parts in [`DESIGN-autonomy.md`](DESIGN-autonomy.md), **do not re-derive them here.** The finding that
   shapes it: the consumer's defects are **BOOT defects, not crowding defects**. 🟢 **2026-09-11 the leader
   launched, briefed and was reviewed by its own expert** — first full exercise. 🟢 **10-25: the self-relay is
   BUILT** (`bin/relay.mjs`, `#relay`, A95): after its handoff a session `/clear`s and restarts ITSELF, each step proved,
   and every relay is a reboot-arm start. The trigger stays the agent's, or its project's hook (rigel's, at 150 k).

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
