# STATUS — claude-comm, 2026-09-08 (sessions 4–15)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

**1 — 🔴 RUN THE FULL CONTROL UNFILTERED, ON TODAY'S BYTES. Nothing here is a green control yet.**

```sh
systemd-run --user --scope -p MemoryMax=4G -p MemoryHigh=3500M node bin/boot.mjs --prove-red
node test/attack.mjs        # A47 is new; 47/47 was the count BEFORE it
```

2026-09-08's full run was **49/49 green in 12 min 55 s** — and that was **before** the channel row, the
sensor and A47 changed. Since then only `--only channel` and the sensor's own control have run, and the
runner says it itself: *a filtered run is NOT a green control.* The cap is not optional: the control peaks
at 165 MiB but takes 13 minutes, and it went unrun for two days because a full machine killed it —
`FINDINGS.md#control-weight`. ✅ **`#erosion-arm` is CLOSED**: its fix was seen green in the 09-08 full run,
which is what it was waiting for.

**2 — 🔴 THEN INSTALL INTO BOTH FIELD TREES.** `~/Dev/work` runs six live sessions on this bus and is
waiting on `--sessions` (its leader asked for it twice). Nothing shipped today has left this repo.

**3 — 🔴 `--sessions` IS IN THE WRONG COMMAND, AND THE PRICE IS NAMED.** The field asked for it in
`comm who`. `A21` forbids the bus any import outside `node:` builtins, so `comm.mjs` cannot reach
`session-registry.mjs`, and a second pid→transcript implementation is the defect `who --json` exists to
prevent. ⇒ **it costs an A21 amendment (extend the daemon check to the transitive closure, do not punch a
hole in it) AND a real split, since `comm.mjs` is at 94 % of A22 (45 026 / 48 000) and the rule is split or
cut, never raise.** Decide it as a gated change with an arm, or leave it out and say so.

**4 — 🔴 THE TRUST PROMPT STILL STOPS AN UNATTENDED LAUNCH**, and whether a program can answer it is
**NOT ESTABLISHED**: `kitten @ send-key` returned **exit 0 having done nothing**. Gate every kitty send on a
verified effect, never on its exit code. ⭐ An empty registry after a launch reads exactly like a dead hook;
only reading the window's text told them apart. `DESIGN-autonomy.md` does not mention the wall.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs` · `session-registry.mjs` · `ledger.mjs` · `restart-signal.mjs` · `claim.mjs` · `wake.mjs` · `exchange-bell.mjs` · `context.mjs` · `boot.mjs` · `install.mjs` · `test/` — no dependencies |
| repo | an `origin` exists (`Leonhart130/claude-comm`). **The push is the leader's call** — delegated 2026-09-05, along with installing into field trees. The previous line here said the owner decides, and quoting a stale sentence about my own authority back at him cost a round-trip |
| **electio** | in real daily use — 26 real deliveries, both directions |
| gates | `attack` (deterministic, every case armed) · `ledger --prove-red`, now run INSIDE it · `selftest` (real sessions, not gated by boot) · `context` and `boot` controls. **Counts live in boot's output, never here** |
| boot | `node bin/boot.mjs` — every gating row armed; `--fast` is injected at session start, contract in `CLAUDE.md` |
| **ledger** | `node bin/ledger.mjs` — the reboot instrument. Records here AND in the field; a field arm is `--root ~/Dev/electio`. Its own arms run inside `attack` as A34. **11 defects recorded, its first**; each start now stores `pending`, the peer's covariate (files newer than the last start), never the inbox depth I proposed — his session #41 had an empty mailbox and the largest real queue of his last five boots |
| **sensor** | `node bin/context.mjs` — pid → transcript through `bin/session-registry.mjs` (the `SessionStart` hook writes it, keyed on pid + start time + boot id); **refuses on a miss**. `FINDINGS.md#clear-blind` |
| reviews | #1–#6 **all dispositioned**. #6's eleven findings are fixed and armed (`FINDINGS.md#review6-disposal`); F8–F11 were numbered on 2026-09-05 so each could carry a resolvable `--ref`. #5's amendment stands in `CLAUDE.md`: *a gate that CAN redden is not yet one that reddens for the property in its own title* — **the disposal itself produced four more defects, three of them in detectors** |

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

4. **🟢 Holding a machine resource — `bin/claim.mjs`, and the field measurement is IN.** Two agents in one
   root collided over a port on 2026-09-04 and killed each other's servers; nothing here had a concept of a
   thing an agent is HOLDING. `take` / `list` / `release`, 16 arms, `A38`, both field trees, and a boot row
   that names a claim whose holder has **died**. The resource name is free text, not port-specific.
   **It advises; it opens nothing, kills nothing, blocks nothing.**

   ✅ **E458 CLOSED 2026-09-08 by the field leader**, negative control first, then `kill -9`, then the
   second-taker half — with a detached `--pid` holder so no working expert had to be killed. His declared
   gap (*"two `--pid` holders, not two real sessions"*) is **smaller than he thought and the code says so**:
   `stateOf` reads `rec.boot`, `rec.pid`, `rec.start` and **never `holder`**, so provenance cannot change the
   branch. Our two reads compose to all three branches — his `kill -9`, ours on his crashed *session*-written
   record after the 07:10 reboot. 🟢 **First real production claim: `port-4174`, `HartEdge-admin`, 2026-09-08.**
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

6. **🟢 A reply must NAME what it answers.** `channel:*` declared a letter answered on mtime ordering alone
   and named a letter it had never read — seventeen hours, on this repo's own correspondence.
   `Answers: <file>`, stateless, no read receipt. And the fix's own hole, found by attacking it: **a scan
   that failed is not an empty scan** — an unreadable `in/` now says `CANNOT SAY`, never `answered`.
   `FINDINGS.md#answered-mtime`.

7. **🟢 A session launched outside an interactive shell has NO bus, and says nothing.** `node` lives only
   under nvm, so `kitten @ launch claude` (or cron, or a `.desktop` file) starts a session whose **every hook
   dies** while it looks normal. **A self-launched expert is launched by a program, never by a shell** — the
   shape that would have made the whole autonomy program measure nothing. `FINDINGS.md#hookless-launch`.
   ✅ **BUILT 2026-09-07 — `bin/launch.mjs`, shipped to both field trees.** It resolves `node`/`claude`
   absolutely, BUILDS the child's `PATH` rather than inheriting kitty's, and REFUSES with no window id when
   it cannot. Witness obtained. A46. `FINDINGS.md#launch-refuses`.
   🔴 **Open, and new:** the trust prompt stops an unattended launch in any directory Claude has not seen —
   see ▶ NEXT 4. The published "a login shell" wording is corrected everywhere it shipped; the field
   leader's phrasing is the right one: *a shell that loads the user profile*.

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

**Measurement traps** (`FINDINGS.md#measurement-traps`): a control that does not travel the same code as the
arms validates nothing, and one that writes into the world it measures is not a control at all. **Six
instances now** — the fifth, 2026-09-05, were an ARM and then the OPERATOR: `A39` ran `boot --hook` against this repository (seven fabricated starts,
6 cold becoming 15), and staging the same row by hand added five more under an agent this repo does not have.
Anything that runs a real hook path writes wherever that path writes, and the ledger's root has no test seam.

**Acknowledgements amend the protocol** (`FINDINGS.md#ack-amendment`): the count hit three on `field:work`
and the row was rewritten on that evidence — mail to a *running* agent is the bus working; mail for one that
is *not* waits for a relaunch and nothing else says so. First time the mechanism fired on itself.

**Findings live in the code**, at the point they apply — *a rule whose cost you cannot see is a rule someone
will simplify away.*
