# STATUS — claude-comm, 2026-11-08 (sessions 4–29)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*(2026-11-08, `2026-11-08.1` delivered. **WORK IS THE MAIN FIELD**; usage up to 100 %. 🔴 The owner's rule, 11-02: after
EVERY delivery, docs AND settings AND skills current (measured in work's tree), and a letter to work. 🔴 **Owner 11-05: the
tests use his RAM and fill his desktop with kitty windows - run them when he says, never wide while he works.**)*

00. 🔴 **WAITING, on the owner's word (11-08 ~16h): stay idle, build nothing, until work or he says go.** They are designing the 4-level structure together. Work's letter 45 (15h32) says yes to my 44 and "A first, the project is paused until A"; he says work will write the specifics. So each could wait for the other: my letter 46 says so and asks for one sentence. **A go means: build A of 44's table (`teams`, `@demandeur`, the start message, pairs by a chief); 45 has the three decisions** (other team: by chiefs or a pair a chief opens, no `"open"`; a shared expert is closed only by its last asker unless `--force`; level 4 now). In a worktree: fields install from this tree. Measure A's bytes first, the bus is at 93 % of A22. Tell work in `out/` when delivered; it measures bells to leader against bells to chiefs, 24 h. Then B, C.
01. **`2026-11-08.1`'s MUTANTS NOT RUN: an evening when he is inactive, his word 11-08, never while he works.** `exchange/WIP-box-mutants.json` (45, each applied once when written, untracked): `node test/mutate.mjs exchange/WIP-box-mutants.json --jobs N`. 3 h 30 in series at ~4.5 min a suite; 2.7 GB free when last read, so measure a suite's peak before 4 wide. A survivor is an arm to strengthen: nothing shipped depends on it. The fix stands on `test/box-real.mjs` (8/8, the code before 0/6) and an adversarial read: `#left-in-the-box`. Waiting from work: its recount of letter 43, `chef-ventes`'s needs. Later, in 44: `comm remind`, the relay carrying the last reply, `--from` limited to the roster (tell work first, its timer signs `minuteur`). **Nothing rings me when work writes to `in/`**: 45 sat 29 min; 46 proposes `SendMessage`, untried from its side.
0. 🔴 **RESUME `2026-11-05.2`: built, reviewed, NEVER RUN - on the LOCAL branch `wip/2026-11-05.2`** (`3323160`, not
   pushed; main holds the last green bytes). Back as uncommitted changes: `git restore --source=wip/2026-11-05.2 -- bin
   install.mjs test FINDINGS.md`, then `git add -N bin/next-bell.mjs bin/heavy.mjs` (mutate copies the TRACKED tree). In
   it, from THE TOOLBOX (owner 11-05: *"je veux que ce soit toi qui gères tous les outils"*; `exchange/TOOLS-INVENTORY.md`,
   untracked: 162 tools in 11 fields): ① `bin/next-bell.mjs`, `"nextBell"` hold|advise (A108) ② `bin/heavy.mjs`, the
   machine lock, runner only (A109; work's 32 agreed - `"available": 1500`, `"wait": 60` - rigel not yet) ③ the CLI's
   caller from its session (A110: a bus defect work guarded for two weeks) ④ the suite's bench on a
   private Xvfb display, opt-in `CLAUDE_COMM_BENCH=xvfb`. An adversarial review (Opus, read only) found 12 confirmed + 9
   plausible: fixed in that code, unmeasured; the BRANCH's FINDINGS sections next-bell, heavy and cli-identity say which (main's has none yet: no anchor here, A27). **Order:** (0) add item 1's dirty-source refusal to the installer (not in the branch), with its arm; (1) ONE
   attack run under `CLAUDE_COMM_BENCH=xvfb`, alone - every kitty arm holds, then make it the default; (2) fix the red;
   (3) mutants `exchange/WIP-next-bell-mutants-nb.json` (47), 4 wide, xvfb; (4) RESULTS108/109/110 in FINDINGS; (5) `node
   install.mjs --release 2026-11-05.2` + its body `exchange/WIP-next-bell-changelog-2.md`; (6) full boot, commit on main,
   push, delete the branch; (7) install 12, measure work's docs; (8) letters: work 35 (`exchange/WIP-next-bell-letter-35.md`),
   rigel and deneb drafts beside it, capella's to write (its realisateur waited 50 min at 19h5x, the tool's first real
   catch). selftest: blocked by 1b (it would take capella's Telegram bot) - solve 1b first, or name it skipped.
0a. **After `.2`, the inventory's order:** ③ the leader's watcher ④ usage readers, with leader-expert's `usage-sessions.py`
   if rigel agrees (work's 30, (b): the templates stay the method's, the skill points at mine and keeps no copy) ⑤ a
   threshold with an end date ⑥ the zsh `=` guard; then the PreToolUse hook the stub lacks: heavy's guard (one list per
   tool, work's 32) and the bus refusing to type into an agent's window (work: yes, for all). work's cd guard goes only
   after A110 is green and measured on its tree. work's request (32): a chief who leads a team without daily pairs - wait
   for its day's report.
0b. **Letters.** work: 26-34 today, all answered; it will report its first sub-agent since `11-04.1`, its first expert past 140 k, its first pair, its first relay on the declaration.
   altair's, deneb's and atlas's wait for a bell (`node bin/exchange-bell.mjs --peer <channel> --ref <file>`) when their
   leaders run.
1. 🔴 **A field installed from my WORKING TREE mid-change - twice now**: capella's `--add-agent` 11-04; work's 11-05 at
   20h07 and 20h37 (its two new chiefs): untested next-bell / heavy / identity code, versions from BEFORE the review, ran
   in work's tree about an hour. Found by boot's `field:work` DRIFT at the close; restored from clean main at 21h1x (79
   files, 19 agents, `2026-11-05.1`), the two orphan files removed, work told (34). **Fix in `.2`, armed:** the installer
   refuses a source whose shipped files are uncommitted (`--allow-dirty` for my own arms). capella: a leader and a
   Telegram secretary, a git repo since 11-05.
1b. 🔴 **`selftest`'s real sessions load the machine's plugins** - the owner's Telegram server started at each run and took
   the bot (the field's log, 19:59Z 11-04: mine). `test/box-real.mjs` starts its session with `--strict-mcp-config --mcp-config '{"mcpServers":{}}'` and every plugin off in `--settings`: no Telegram child, read once per run. Same flags for selftest, then arm it.
2. **Ctrl+Z in a shell-less window**: avoided, not detected. **The native path** (`#native-path`) would type nothing at all: measure it next on this subject.
3. **A31 blames a live session's own `/clear`** (a field expert's relay at 21:34:41Z, mid-suite, 11-02): `#review15`'s
   twin for boot's control. Named in `#pairs`, not fixed.
4. **`who`: "IDLE, relay armed"** (work's (c)) and **`working` while only a sub-agent runs** (altair 10-30: the runtime's
   `busy`; show `wake.readTurn`'s turn end beside it). Both in `who.mjs`: the bus is at 93 % of A22.
5. **`channel:` prints "arrived 22h ago" for a letter 1 min old**: the NAME's date at 00:00Z (`stampOfName`) - show the mtime.
6. **rigel's four memory ideas** (10-25 15h09; my 20h06 reply): `claim --machine`, `launch --memory`, memory in `who`,
   "closed" vs "crashed" from `.comm/close/`. **Arm LESSONS §8** (letters' written time vs the file's). **The generated
   SKILL names every tool**: unarmed, A92 gates the README only. **`boot --prove-red` is 1-1.6 h**: make the one-block
   harness of 10-30 (`#stranded-named`) be `--only` itself (C).
7. **`/tmp/comm-attack-*`**: 61 folders from a suite I started by mistake and stopped (11-02, LESSONS §9); the
   classifier refused my sweep of shared `/tmp` - the owner's to delete, or leave.

**Done**: 11-04 `.1` (A105), `.2` (A106); 11-05 `.1` (`#relay-guard`, A107, mutants 15/15); **11-08 `.1`** (`#left-in-the-box`, A111-A115; the `.2` branch keeps A108-A110, expect a merge in `attack.mjs`). Each in the 12 trees.

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

**F - carried, each named in FINDINGS:** #15's (`#review15`), REVIEW-12b's seven points (`#review12b`), `boot.mjs --hook`
records with no ownership test, #13 §7b/§7c (`#review13`), the stub filing `basename(transcript_path)` as the session, #14's
(`#review14`), D2's obedience to a pointer (`#midturn-channel`: build `--kind blocked` only on atlas's field count) · A27 reads STATUS and README, undeclared in
`gate-docs` (11-05: a STATUS pointer reddened a gate that said CODE UNCHANGED).

**Carried:** A2 marker · the installer overwrites a `SKILL.md` it did not generate · S6 · atlas's `rings.jsonl`
(A62, A65) · #9 A3 · C7 · the restart trigger (ledger UNKNOWN) · C3. **Later, owner's
order:** adoption (orion measured 09-19) → Rust port → value, with atlas's leader.

## Where it stands

| | state |
| --- | --- |
| repo | `origin` = `Leonhart130/claude-comm`. **The push is the leader's call**, delegated 2026-09-05, along with installing into field trees — do not ask again |

## ⏭️ OPEN
1. **🔴 Latency is a mailbox, not an interrupt.** Re-derive with `node test/latency.mjs <log>`; never
   transcribe the table. 26 deliveries: leader→expert median **1462 s**, expert→leader **586 s** — mail
   lands at the recipient's *turn boundary*. Since 10-24 an IDLE recipient is rung at once by the sender's
   `PostToolUse` (213 ms, measured live, A90); a BUSY one still waits for its turn end. Never call it real-time. A16.

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
