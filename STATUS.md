# STATUS — claude-comm, 2026-10-31 (sessions 4–26)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*(2026-10-31 12h36 CET by `date`. The owner closed here: *"on reprendra plus tard"*. **WORK IS THE MAIN FIELD**; his
word stands: *"tu peux utiliser tout l'usage jusque 100%"*.)*

0. **Letters.** Work's 16h24 answers my letter 11 (`.2` read in a real session, conforme) and asks nothing: name it at
   the close. altair's (00h37) waits: its leader was
   gone - ring it when it runs. **polaris** (NEW 10-31: codename + leak rule 17 before its name was written): the
   owner's general agent ABOVE his projects, not a git tree; on the bus since 15h56, `.2` in its tree, its leader added
   and launched its own expert at 16h08. Its session of 13h28 started without the hooks: one restart, the owner's call.
   No usage opt-in (his config). No exchange channel: open one only when it asks.
1. **What loses a bell's Enter** (rigel 14h17 §2: the text sat in the box, `comm sent` PENDING). Rule 8 now presses
   the Enter alone at the next ring; the cause is unmeasured. And **Ctrl+Z in a shell-less window**: avoided, not
   detected - `who` could say "no input box" per session (`screenAtRest`), outside the bus's bytes.
2. **rigel's four memory ideas** (its 10-25 15h09 letter; my 20h06 reply disposes them): `claim --machine`, `launch --memory`,
   memory in `who` (outside who.mjs - the bus is at 91 %, A22), "closed" vs "crashed" from `.comm/close/`.
3. **Arm LESSONS §8**: the `channel:` row compares my outgoing letters' written time with the file's (>10 min warns).
4. **Letters waiting for a bell**: deneb's and atlas's - `node bin/exchange-bell.mjs --peer <channel> --ref <file>` when
   their leaders run.
5. **Unarmed: the generated SKILL names every tool.** A92 gates the README's reference only.
6. **`boot --prove-red` is 1-1.6 h** (66 then 98 min, 10-30) because `--only` cuts output, not work. 10-30 used a scratch harness that runs ONE
   block in its fixture (`FINDINGS.md#stranded-named`, last paragraph) - make that `--only` itself (C).
7. **`channel:` prints "arrived 20h ago" for a letter 1 min old**: its age is the NAME's date at 00:00Z (`stampOfName`),
   right for ordering, wrong as an arrival. Show the mtime there, or "dated <day>".
8. **`who` says `working` while only a background sub-agent runs** (altair 10-30 23h: turn ended, box at rest, "← 2
   agents"; the runtime's `status` stays `busy`). My bell waiter keyed on IDLE waited 40 min. Show the turn's end from
   the transcript (`wake.readTurn`) beside the runtime's word.

**Done 10-30/31**: releases `.1`-`.3`, `2026-10-31.1`, `.2` (a threshold no reading of its own feeds says so,
`#usage-statusline`) and `.3` (every `.comm/config.json` setting generated into the README, A92 (6), `#docs-from-code`), boot's NAMED-letter and per-cause demand - CHANGELOG and FINDINGS have each, mutants included.
All in the eleven trees.

🔴 **THE OWNER'S RULE (09-27): no name of his personal projects in this PUBLIC repo** - every field project has a
codename here; the mapping is in no repo. The boot report prints the REAL directory names: **never copy a `field:` row
into a tracked file as is.** `bin/leak-check.mjs` + four git hooks + boot row `leak` enforce it (`FINDINGS.md#leak-check`).
**10-24: the pre-commit hook refused my own FINDINGS** - real field names, one of them not yet codenamed. A new field
gets its codename and its rule BEFORE its name is written (deneb, rule 15), and an expert's name is not written either.

🔴 **THE OWNER'S WINDOW RULE (09-19, 10-24): nothing a test opens lands in his view** (*"t'as besoin d'ouvrir ces 50
fenêtres ?"*). Every kitty arm runs in ONE minimized bench (`bench()`, `test/attack.mjs`; measured 0 panes in a visible
tab). A new kitty arm uses `bench()`/`benchRun()`/`besideMe()`, never a bare `kitten @ launch`.

**B - the registry half of #13 §1, MEASURED 09-27 by A31 going red on my own end-to-end probe**: a hand-fire from
inside a session in the project rewrites that session's registry entry. Design in `FINDINGS.md#review13` "Named, not
fixed" - gate `record()` AND `refresh()` on the witness. Touches `Stop`, the hottest path: own change, own arm,
`selftest` both ways.

**C - tests faster, still reliable (owner, 09-27): `test/mutate.mjs` is built and in use.** Next: `attack` itself faster, `--only <arm>` for iteration; the full suite stays the gate.

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
