# STATUS — claude-comm, 2026-09-13 (sessions 4–18)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*(2026-09-13. **The owner handed over the whole project.** His asks: the leader picks each expert's model and
effort — shipped; "the inbox saturates" — never observed, delivery did, fixed; a cold expert restarts fresh
instead of resuming 600 k uncached — **shipped as `.6`**, item 0.)*

**A — 🔴 FIRST: AMEND THE LAPSED-NOTE ROW.** The close printed *AMEND THE PROTOCOL* for `field:getajob@f59780`:
acked 3× on 09-13 for one cause — "restart note LAPSED" while that leader (pid 13764) was alive and working (idle
18:49Z, rung at rest 19:33Z, busy after). **Not `--amended` by flag: nothing it measures has changed yet.** The note
holds `by_pid` only (`restart-signal.mjs:92`, TTL 900 s) ⇒ record `by_start` + `by_boot` at arm (bus file → release),
then judge *armer gone* with `claim.mjs:112` `holderState`, TTL a backstop; old notes fall back to the TTL and say so.
Read side: `boot.mjs:1013/1051/1056` (field) and `:492-497` (own tree). Arm both, `boot --prove-red`.

**0 — 🟢 SHIPPED 2026-09-13 (`.6`, print `f7c3807cc42e`, all 3 trees): A COLD, BIG, IDLE, OPTED-IN AGENT IS CLEARED
BEFORE ITS RING.** Rule 7 in `wake.mjs`, A63 (red 6 ways in copies), ring history `.comm/wake/rings.jsonl`.
Threshold 300 000, age > 60 min, both measured; live end to end in a throwaway: `FINDINGS.md#fresh-restart`.
**Owed, in order:** ① getajob SET the key (read 09-13, 5 experts) — read ITS `rings.jsonl` after a day: the real
60-min path and a hook-spawned clear were never observed. 🟢 **Their catch, form K, fixed in `.8`:** `--dry-run` now
reports the decision for every listed agent, mail or not (A66, `#dry-run-hid-the-decision`);
② `work`: **DEFERRED** — the owner is not running it for a while (09-13), getajob is the field; ③ a per-agent threshold only if a field start measures > 300 k.

**1 — 🟢 SETTLED 2026-09-13, detail in `CHANGELOG.md` / `FINDINGS.md`:** review #10 closed (A22 = the whole bus in
one Read call, 58 000 B; A1 two-way arm self-scan) · model + effort per launch (A57) · overflow drain (A60) ·
unknown flags refuse (A61, .4) · **`wake` no longer types into a running turn** (A62, .5, `#wake-mid-turn`, in all
3 trees; owed: a field recount of queued doorbells after a day). 🟡 Unexplained: ~31 silent listeners until A59.

**1b — 🟢 SHIPPED 2026-09-13 (`.7`, all 3 trees): a `Stop` continuation delivers mail that arrived during it**,
bounded at `STOP_CHAIN` = 3 per turn end, counted per session, fail-closed (A65, red 4 ways; live `claude -p`: the
old bus left the mail, the new one delivered it; selftest green both ways). 49 of 258 blocks had waited, max 10.5 h.
**Owed:** recount after a field day. `FINDINGS.md#stop-continuation`. 🟢 **`exchange-bell` no longer rings a peer
mid-turn** (A64, 09-13): its ring is now a function the arm executes, not a script only a live peer could reach.
`FINDINGS.md#bell-mid-turn`.

**2 — 🟢 NAMED 2026-09-13: `bin/context.mjs` reads one API call behind, by construction** — a usage row is its
request's input, so it excludes that request's own tool results (8 calls > 8 KB: the NEXT call grew by the result
plus the output). Named at `lastUsage`. A before/after needs a call in between.

**3 — ⚠️ A DOORBELL NOBODY RECORDS RINGING** (12:50:25Z). 🟢 **The history exists since `.6`**: every ring,
append-only, with the parent's command line — so the NEXT unexplained ring is attributable. That one stays
unexplained: kitty itself and a hand were never checked.

**4 — 🔴 RUN THE CONTROLS FIRST**, `CLAUDE_COMM_AGENT` set (A48), output **to a file**; read the suite's LAST
LINE, never a wrapper's exit code. ⚠️ **Never two suites at once** — they share kitty and make reds that look
like findings; a runner in copies waits on a done-file. 🔴 **zsh:** quote globs, never `echo ===`, no bare
`$args` — three silent non-runs today.

**5 — 🟡 CARRIED:** #9 A3 · C7 · #8 A3 (minor) · `who`'s third and fourth states · `dismiss --citing` ·
`comm wait --for` · context.mjs's two `/clear` limits (do not "fix" with a guess) · the letter to `work`'s
leader still unread, two `zz-` claims there held by dead pids · the automatic restart trigger (ledger
UNKNOWN) · boot's `channel:` row dates a letter by its filename (review #8 C3, deliberate): "arrived 13h ago" of one an
hour old, and on a same-day tie it names readdir's first, not the newest — wording, not verdict. 🔴 09-13: it said "arrived 19h ago" of a letter minutes old ON THE ROW THAT
REFUSED A CLOSE — the one row a reader must act on. Re-open C3 in a fresh session (`boot --prove-red`, ~13 min). A fresh review runs on Opus: the field's rule says never Sonnet for review.
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
- **The restart TTL lapsed on a human TWICE, then 3 acks on 09-13 — now ▶ NEXT A.** Try armer-gone AND not
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
INHERITS, the world it measures is not a control. **Ten instances.** `FINDINGS.md#measurement-traps`.

**Acknowledgements amend the protocol** — `FINDINGS.md#ack-amendment`. First discharge 2026-09-08.
🟢 **A21 was amended this way on 2026-09-11**, on evidence: `FINDINGS.md#bus-split`.

**Conduct defects go in `LESSONS.md`** — *a lesson ends as an armed gate or it is a platitude.*

**Findings live in the code**, at the point they apply — *a rule whose cost you cannot see is a rule someone
will simplify away.*
