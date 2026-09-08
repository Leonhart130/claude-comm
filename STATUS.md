# STATUS — claude-comm, 2026-09-08 (sessions 4–15)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

**1 — 🔴 ASK FOR THE ADVERSARIAL REVIEW: IT IS WRITTEN AND NOT RUN.** `BRIEF-adversarial-8.md`, eight
targets against `aeb39a9..3afe19f`. The owner offered a second expert explicitly and said asking is
expected. **Do that before building anything new on yesterday's code.** Three of the eight are defects
found and NOT fixed — items 2, 3, 4 below, so they survive even if the review never happens.

*(Nothing is owed from yesterday: the full capped control ran **53/53 exit 0**, `attack` **48/48**, both
field trees installed, `3afe19f` pushed and closed.)*

**2 — 🔴 `boot.mjs`'S REGISTRY ROW STILL SAYS "GONE", AND ITS ARM GUARDS A STATE NOTHING REACHES.**
The same false accusation fixed in `context.mjs` (`FINDINGS.md#no-turn-yet`). Traced, not guessed: the 120 s
grace covers the `--hook` path, and the manual path needs a turn, which creates the transcript. ⇒ **fix the
wording AND re-title `registry: an AGED entry whose transcript is GONE`, which reddens for something no
session can be in.** Deferred only because a string change costs a 13-minute re-run; do it with the next
change to that file. ⚠️ **If the trace is wrong, the row is lying in production — check it first.**

**3 — 🔴 `CONVENTION_SINCE` IS AN MTIME BOUNDARY AND MTIMES ARE NOT FACTS.** `bin/boot.mjs`, the `channel:`
block. A `git checkout`, an `rsync` or a restore moves every letter across it, and everything on the old
side is judged by the rule declared broken on 2026-09-08. **What does this row say on a fresh clone?**
Measure that before trusting it.

**4 — 🔴 THE EROSION COUNT KEYS ON A ROW; A ROW WARNS FOR SEVERAL CAUSES.** `field:work` reached **8** while
its 2026-09-05 amendment sat undischarged, then today's warning came from an entirely different cause (two
dead `zz-` claims). The discharge is now recorded — **the first one this repo has ever written** — but the
design flaw is untouched: an amendment fixes one cause and clears the debt of all of them.
**Amend the protocol properly: evidence, a gated change, an arm. Not prose.**

**5 — 🟡 `--sessions` IS IN THE WRONG COMMAND AND THE PRICE IS NAMED.** The field asked for it in
`comm who`. `A21` forbids the bus any import outside `node:` builtins, so `comm.mjs` cannot reach
`session-registry.mjs`, and a second pid→transcript implementation is the defect `who --json` exists to
prevent. ⇒ **an A21 amendment (extend the daemon check to the transitive closure — do not punch a hole in
it) AND a real split, `comm.mjs` being at 94 % of A22.** ⚠️ Also undecided: whether `context.mjs` joins
`BUS_FILES` at all — **asked of the field leader in the 09-08 letter; read his reply before deciding.**

**6 — 🔴 THE TRUST PROMPT STILL STOPS AN UNATTENDED LAUNCH**, and whether a program can answer it is
**NOT ESTABLISHED**: `kitten @ send-key` returned **exit 0 having done nothing**. Gate every kitty send on a
verified effect, never on its exit code. ⭐ An empty registry after a launch reads exactly like a dead hook;
only reading the window's text told them apart. `DESIGN-autonomy.md` does not mention the wall.

⚠️ **Two things to check on arrival, before reading any of the above:** whether the field leader answered
(`channel:work-leader`), and whether he released the two `zz-` claims — until he does, `field:work` warns
every boot and the count starts climbing again.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs` · `session-registry.mjs` · `ledger.mjs` · `restart-signal.mjs` · `claim.mjs` · `wake.mjs` · `exchange-bell.mjs` · `context.mjs` · `boot.mjs` · `install.mjs` · `test/` — no dependencies |
| repo | `origin` = `Leonhart130/claude-comm`. **The push is the leader's call**, delegated 2026-09-05, along with installing into field trees — do not ask again |
| **electio** | in real daily use — 26 real deliveries, both directions |
| gates | `attack` (deterministic, every case armed) · `ledger --prove-red`, now run INSIDE it · `selftest` (real sessions, not gated by boot) · `context` and `boot` controls. **Counts live in boot's output, never here** |
| boot | `node bin/boot.mjs` — every gating row armed; `--fast` is injected at session start, contract in `CLAUDE.md` |
| **ledger** | `node bin/ledger.mjs` — the reboot instrument. Records here AND in the field; a field arm is `--root ~/Dev/electio`. Its own arms run inside `attack` as A34. **11 defects recorded, its first**; each start now stores `pending`, the peer's covariate (files newer than the last start), never the inbox depth I proposed — his session #41 had an empty mailbox and the largest real queue of his last five boots |
| **sensor** | `node bin/context.mjs` — pid → transcript through `bin/session-registry.mjs` (the `SessionStart` hook writes it, keyed on pid + start time + boot id); **refuses on a miss**. `FINDINGS.md#clear-blind` |
| reviews | #1–#7 **all dispositioned**; **#8's brief is written and NOT RUN** — `BRIEF-adversarial-8.md`. #5's amendment stands in `CLAUDE.md`: *a gate that CAN redden is not yet one that reddens for the property in its own title* |

## ⏭️ OPEN
1. **🔴 Latency is a mailbox, not an interrupt.** Re-derive with `node test/latency.mjs <log>`; never
   transcribe the table. 26 real deliveries: leader→expert median **1462 s**, expert→leader **586 s** — the
   asymmetry is structural, mail lands at the recipient's *turn boundary*. **An agent alive but idle never
   receives its mail**, which is the whole justification for item 3. `who` showing "running" does not mean
   reachable. Never call this bus real-time. Gated by A16; `HISTORY.md`.

2. **`--reply-to <id>` (threading).** Field-requested, then field-deprioritised: it adds identity surface
   while the substance already lives in the file.

3. ✅ **The wake is BUILT** (`bin/wake.mjs`, A32, `FINDINGS.md#wake-doorbell`). 🔴 Item 1's latency table
   predates it and has not been re-measured. The wake does not deliver — it makes a turn happen.

4. **🟢 Holding a machine resource — `bin/claim.mjs`, settled and IN PRODUCTION.** `take`/`list`/`release`,
   16 arms, A38, both field trees. **It advises; it opens nothing, kills nothing, blocks nothing.**
   ✅ **E458 closed 2026-09-08 by the field leader** — negative control, `kill -9`, then the second-taker
   half, with a detached `--pid` holder so no working expert was killed. His declared gap is smaller than
   he thought and the code says so: `stateOf` reads `boot`/`pid`/`start` and **never `holder`**. Our two
   reads cover all three branches. 🟢 In production unprompted: `port-4173` and — the one that matters —
   `supabase-anneau-visiteur`, a NON-port resource with a purpose and a duration.
   ⚠️ Claims live in one project's `.comm/`, so a resource shared ACROSS projects is visible to nobody.

5. **🟡 `who` reports TWO states and there are THREE — half shipped, in the wrong command.**
   A leader read `running` for four sessions at their prompt and lost **2 h 30** (his E453).
   ✅ **`node bin/context.mjs --sessions`** prints `quiet <age>` from the transcript's mtime via the registry.
   It prints a MEASUREMENT, never `at prompt`: a single long tool call is quiet too — measured, same morning,
   `HartEdge-admin quiet 136s` while holding `port-4174` for a 40-minute Playwright run.
   🟢 **The third state is new and was in no design document**: a launched session that has taken no turn has
   **no transcript at all** — four field sessions, 8 minutes, 2026-09-08 09:29. Calling that "gone" accused
   the sensor of being broken. `FINDINGS.md#no-turn-yet`.
   🔴 **Open: it belongs in `comm who` and cannot go there yet — ▶ NEXT 3 names the price.**
   ⚠️ **And it is NOT shipped:** `BUS_FILES` carries the bus and what the hooks run, never `context.mjs`.
   The field leader runs it from this checkout. **Whether it joins the installed set is an undecided
   question of scope, not an oversight** — asked of him in the 09-08 letter.

6. **🟢 A reply must NAME what it answers** — `Answers: <file>`, stateless, no read receipt. The row used
   to declare a letter answered on mtime ordering and name one it had never read (17 h, on this repo's own
   mail). Three arms. A scan that FAILED now says `CANNOT SAY`; the marker counts in the header only.
   `FINDINGS.md#answered-mtime`. 🔴 **Its open residue is ▶ NEXT 3.**

7. **🟢 A session launched by a PROGRAM is on the bus — `bin/launch.mjs`, A46, both field trees.** It
   resolves `node`/`claude` absolutely, BUILDS the child's `PATH` instead of inheriting kitty's, and
   REFUSES with no window id when it cannot. `FINDINGS.md#hookless-launch`, `#launch-refuses`.
   ⚠️ The published "a login shell" wording was WRONG on this machine and the field measured it: `zsh -l`
   has no `node`, only `zsh -i`. Corrected everywhere — *a shell that loads the user profile*.
   🔴 **Its open residue is ▶ NEXT 6.**

8. **🔴 The autonomy mandate — self-launching experts, a self-rebooting leader.** Given 2026-09-04.
   **Everything settled lives in [`DESIGN-autonomy.md`](DESIGN-autonomy.md)** — the four verified mechanisms,
   the RAM measurements, the consumer's reply, the review #4 dispositions. Do not re-derive any of it here.

   **The two findings that shape it:** the consumer's defects are **BOOT defects, not crowding defects**
   (four of five authored in the first thirteen minutes at 35–42 % of peak), so the design effort belongs in
   the fifteen minutes AFTER a restart. And the handoff carries a **sha256 read manifest**, never prose.

   ✅ The instrument (`bin/ledger.mjs`), review #4's answer, the restart signal, and now **the launcher**
   all exist. 🔴 **What is open is ▶ NEXT 4**: the trust prompt, whether a program can answer it, then a real
   restart that arms the reboot arm, then the trigger.

**Carried forward, unchanged and still open** *(moved here from ▶ NEXT on 2026-09-08 — cut from that
section, not retracted)*:
- **ESLint is uncovered.** A43 stops a configured *prettier* from rewriting our generated files; ESLint is
  the same shape and is not armed. `FINDINGS.md#generated-in-their-tree`.
- **No real adversarial review has ever run from `review/`.** The routing is measured; the workflow is not.
- **The 15-minute window is untested and my own timestamps are why.** 0 of 25 defects fall in it, but each
  is dated at its commit — the upper bound. Not a result.
- **The restart TTL lapsed on a human TWICE; the clock is the wrong instrument.** Try armer-gone AND not
  ancient, TTL as a backstop. `claim.mjs` already ships the (pid, start, boot) test. Not built.
- **Standing test debt from review #4, none of it gated:** `FINDINGS.md#test-debt`.
- **`#A20` from 2026-09-04 is still unexplained.** The 09-05 instance was triaged and fixed
  (`#update-signal`); the original is not. **Run gates unfiltered.**
- 🔴 **The erosion counter has NEVER been discharged.** `.boot-state.json` carries `field:work: 8` and
  `amendments: null` — `STATUS.md` said that row "was rewritten on the evidence", but in prose, never via
  `--close --amended`. So the instrument still demands an amendment it already received, and a row waved
  past eight times is one nobody reads. **Amend it properly or explain why it should keep counting.**

## ⚠️ What was NOT verified

- 🔴 **`bin/boot.mjs`'s registry row still says "that file is GONE" — the same false accusation fixed in
  `context.mjs` on 2026-09-08 (`FINDINGS.md#no-turn-yet`) — and its arm stages a state that cannot occur.**
  Traced rather than guessed: in the `--hook` path the entry is written microseconds before it is read, so
  the 120 s grace always covers it; in the manual path the session must have taken a turn to run boot at
  all, which creates the transcript. ⇒ **the wording is unreachable, and the arm ("an AGED entry whose
  transcript is GONE") therefore reddens for a state no session reaches.** Not fixed today because changing
  it costs a 13-minute re-run of the control for a string. **Fix it with the next code change to that file,
  and re-title the arm.**

- **`--release` is verified by hand, not gated** (`FINDINGS.md#release-roundtrip`): `install.mjs` writes to
  its own checkout, and a fixture would have to relocate `HERE`. That test seam does not exist.
- **Whether the pid→transcript descriptor returns after a cleared session takes a turn**
  (`FINDINGS.md#clear-blind`). MOOT for the sensor now, still unmeasured — it decides whether the sensor's
  "session CLEARED" note is permanent or transient.
- **What happens to the entry when a session is `resume`d or `compact`ed.** Both fire `SessionStart` with a
  source this repo has never seen, so whether they carry a `transcript_path` at all is unknown. A payload
  without one leaves the previous entry standing, which is the safe direction and is not the same as correct.
- **The ledger's 11 defects are all from ONE session and NONE fell in the 15-minute window** —
  and they are dated at their commit, the upper bound. `FINDINGS.md#review6-disposal`.
- **The git guard has never fired outside a fixture.** Both field projects were clean when it shipped, and
  the one agent who read the notice did not stage a case where it should fire.
- **The crossing has happened ONCE**, one project, one agent, one hand (2026-09-04 20:44), after two lapse
  warnings. Unverified: that it survives an unattended relaunch, that anyone repeats it, that the arm reaches ten.
- **`selftest`'s BEHAVIOUR half is not a gate and never will be** — 3 of 6 runs showed the agent not reading
  the file it was pointed at. This bus regularly rings a bell nobody answers, and no gate sees it.
- **Anything non-Linux**: `comm who` reads `/proc` and degrades to "not running" everywhere else.
- Two older standing caveats were moved to `FINDINGS.md#test-debt` when this file hit its cap: A8's partial
  mutations, and behaviour mid-TOOL-CALL. Cut from here, not retracted.

## Two conventions that erode silently

**Measurement traps** — a control that does not travel the same code as the arms validates nothing, and one
that writes into the world it measures is not a control at all. **Six instances.** `FINDINGS.md#measurement-traps`.
⚠️ Anything running a real hook path writes wherever that path writes, and the ledger's root has no test seam.

**Acknowledgements amend the protocol** — `FINDINGS.md#ack-amendment`. 🟢 **The first discharge in this
repo's history was written 2026-09-08** (`field:work`, from 8). 🔴 **Its design flaw is ▶ NEXT 4.**

**Findings live in the code**, at the point they apply — *a rule whose cost you cannot see is a rule someone
will simplify away.*
