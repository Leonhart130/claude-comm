# STATUS — claude-comm, 2026-09-07 (sessions 4–14)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

**1 — 🔴 RUN THE FULL CONTROL FIRST, AND CAP IT. It is not heavy; the machine was full.**

```sh
systemd-run --user --scope -p MemoryMax=4G -p MemoryHigh=3500M node bin/boot.mjs --prove-red
```

It **completed 2026-09-07 for the first time since 09-05** — 48 green, 1 red — because the cap makes the
kernel's choice in advance and lands it on the control instead of one of the owner's sessions.

🔴 **The line this file carried — "too heavy for the machine it runs on" — is FALSE, and the work item drawn
from it was misdirected.** Peak of the whole control, children included: **164 MiB** of a 4096 MiB cap
(`memory.peak`, a kernel high-water mark, not a sample). `FINDINGS.md#control-weight`.
**What is real is the TIME**: 12 minutes, which is why it went unrun for two days. ⚠️ `--only <substring>`
does not fix that — `--only close` ran **13 min 38 s**, longer than the unfiltered suite, before being killed.

**2 — 🔴 THE RED ARM WAS THE ARM — root cause found, fix NOT yet seen in a full run.**

It claimed the close still demands an amendment for a row gone GREEN. It does not: reproduced in a clean
clone with `ackCounts.tree=9`, the count is *held as history* and the close succeeds.

**Root cause was not an arm at all: `.gitignore` was missing from the files copied into the fixture.** In
the real repo `.boot-state.json` is ignored; in the fixture it was untracked and unignored, and every close
writes one — so `tree` was yellow for the whole close block and the erosion demand was CORRECT. Fixed by
copying `.gitignore`, plus a precondition guard (`treeWasGreen`) so a drifting fixture says so instead of
accusing the code. `FINDINGS.md#erosion-arm`.

🔴 **`node test/attack.mjs` is green, but `--prove-red` has NOT completed since these fixes** — the last two
attempts were killed by the harness's low-memory watchdog after 16 arms (machine pressure, not the control:
`attack.mjs` peaks at 124 MiB, the whole control at 165). **A full capped run is job one.**

**3 — 🔴 THE AUTONOMY MANDATE MOVED, AND HIT A WALL NOBODY HAD SEEN.**

`bin/launch.mjs` is built and shipped to both field trees: it resolves `node` (`process.execPath`, absolute
by construction) and `claude`, **builds** the child's `PATH` instead of inheriting kitty's, and REFUSES with
no window id when it cannot. **A46** runs node out of the built PATH, with kitty's own `/usr/bin:/bin` as the
positive control. Witness: `● expert running (pid 650028)`, registry entry carrying `agent: expert` from
`--env`. `FINDINGS.md#launch-refuses`.

🔴 **THE WALL: a session launched into a directory Claude Code has never seen stops at its trust prompt and
waits for a human.** `DESIGN-autonomy.md` does not mention it. ⇒ **a self-launching expert can only be born
in an ALREADY-TRUSTED directory.**

⚠️ **NOT ESTABLISHED, and the opposite was nearly recorded:** whether a program can answer that prompt.
`kitten @ send-key` returned **exit 0 having done nothing** — the silent-discard trap, now measured for
`send-key` too. The owner answered it three minutes later; the registry timestamp says so. **Gate every
kitty send on a verified effect, never on its exit code.**
⭐ An empty registry after a launch reads *exactly* like a dead hook. It was a dialog box. Only reading the
window's text told them apart.

**4 — The field's two requests are answered and SHIPPED** (`FINDINGS.md#ref-base`, `#stale-ref`, A44/A45).
A `--ref` names its base on the refusal **and** on the success — the silent case (same filename at root and
in the spoke) is refused by nothing and used to print back what the sender typed. 🔴 **I built the limiter
the requester warned me about** while fixing his report: staleness computed after the queue write compared
the file against its own timestamp and warned on every send. Caught by running it, not reading it.

**5 — 🔴 NEW, from the field 2026-09-07: `who` reports TWO states and there are THREE.**
`exchange/work-leader/in/2026-09-07-who-ne-distingue-pas-au-prompt-…md`. A session AT THE PROMPT takes no
turn, so it never gets its mail — and `who` calls it `running` like a session at work. Measured cost: four
agents at the prompt, `who` green, **nothing delivered for 2 h 30**. OPEN 1 with a name and a victim.

⭐ **His second-order point is stronger:** with the state unexposed every agent invents a proxy, and a proxy
errs in the comfortable direction — his read a false IDLE for an agent reading without writing.

🟢 **The signal EXISTS and discriminates — measured across 7 live sessions 2026-09-07:** the mtime of the
session's transcript, via the registry. `leader` 5 s (mid-turn) · `db` 2 636 s · `HartEdge` 2 954 s (at the
prompt). A session that reads and measures still writes its transcript — which is the case that fooled him.
🔴 **Not built, and one constraint decides how:** `bin/comm.mjs` is at **94 % of its A22 cap**
(45 026 B of 48 000). CLAUDE.md is explicit that the fix for that row is to split or cut, never to raise —
so this lands as a split, not as more code in `comm.mjs`. And it must expose the MEASUREMENT
(`idle 44m`), not a claim about the session's inner state: a long single tool call is quiet too.

**Carried forward, unchanged and still open:**
- **ESLint is uncovered.** A43 stops a configured *prettier* from rewriting our generated files; ESLint is
  the same shape and is not armed. `FINDINGS.md#generated-in-their-tree`.
- **`#claim-file` between two REAL agents.** The arms cover it; two live sessions still have not. The one
  that matters: two agents take a port, then **kill one brutally** — it must read HOLDER IS GONE, never a
  lock. Asked of the peer 2026-09-05 and again today; unanswered.
- **No real adversarial review has ever run from `review/`.** The routing is measured; the workflow is not.
- **The 15-minute window is untested and my own timestamps are why.** 0 of 25 defects fall in it, but each is
  dated at its commit — the upper bound. Not a result.
- **The restart TTL lapsed on a human TWICE; the clock is the wrong instrument.** Try armer-gone AND not
  ancient, TTL as a backstop. `claim.mjs` already ships the (pid, start, boot) test. Not built.
- **Standing test debt from review #4, none of it gated:** `FINDINGS.md#test-debt`.
- **`#A20` from 2026-09-04 is still unexplained.** The 09-05 instance was triaged and fixed
  (`#update-signal`); the original is not. **Run gates unfiltered.**

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

4. **🟢 Holding a machine resource is written down now** — `bin/claim.mjs`. Two agents in **one** project
   root collided over a port on 2026-09-04 and killed each other's servers. **The failure was never
   transport**: both had a hub and neither could see the other, because nothing here had a concept of a
   thing an agent is HOLDING. The expensive part was the peer reading the result as a broken test rather
   than a port conflict. `HISTORY.md`, "The port collision".

   `take` / `list` / `release`, 16 arms, `A38`, installed in both field projects, and a boot row that names
   a claim whose holder has **died**. The resource name is **free text, not port-specific** — an external
   shared thing (a rate-limit window, a staging database) is claimable today, and the field did not know
   that. **It advises; it opens nothing, kills nothing, blocks nothing.**
   🔴 **Untested between two real agents — ▶ NEXT, carried.** ⚠️ Claims live in one project's `.comm/`, so a
   resource shared ACROSS projects is visible to nobody.

5. **🔴 A session launched outside an interactive shell has NO bus, and says nothing.** `node` lives only
   under nvm, so `kitten @ launch claude` (or cron, or a `.desktop` file) starts a session whose **every hook
   dies** while it looks normal. **A self-launched expert is launched by a program, never by a shell** — the
   shape that would have made the whole autonomy program measure nothing. `FINDINGS.md#hookless-launch`.
   ✅ **BUILT 2026-09-07 — `bin/launch.mjs`, shipped to both field trees.** It resolves `node`/`claude`
   absolutely, BUILDS the child's `PATH` rather than inheriting kitty's, and REFUSES with no window id when
   it cannot. Witness obtained. A46. `FINDINGS.md#launch-refuses`.
   🔴 **Open, and new:** the trust prompt stops an unattended launch in any directory Claude has not seen —
   see ▶ NEXT 3. The published "a login shell" wording is corrected everywhere it shipped; the field
   leader's phrasing is the right one: *a shell that loads the user profile*.

6. **🔴 The autonomy mandate — self-launching experts, a self-rebooting leader.** Given 2026-09-04.
   **Everything settled lives in [`DESIGN-autonomy.md`](DESIGN-autonomy.md)** — the four verified mechanisms,
   the RAM measurements, the consumer's reply, the review #4 dispositions. Do not re-derive any of it here.

   **The two findings that shape it:** the consumer's defects are **BOOT defects, not crowding defects**
   (four of five authored in the first thirteen minutes at 35–42 % of peak), so the design effort belongs in
   the fifteen minutes AFTER a restart. And the handoff carries a **sha256 read manifest**, never prose.

   ✅ The instrument (`bin/ledger.mjs`), review #4's answer, the restart signal, and now **the launcher**
   all exist. 🔴 **What is open is ▶ NEXT 3**: the trust prompt, whether a program can answer it, then a real
   restart that arms the reboot arm, then the trigger.

## ⚠️ What was NOT verified

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
