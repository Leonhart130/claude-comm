# STATUS — claude-comm, 2026-08-06 (sessions 4–7)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs`, `install.mjs`, `test/attack.mjs`, `test/selftest.mjs`, `test/latency.mjs` — no dependencies |
| repo | git initialised, local only, no remote |
| **electio** | in real daily use — 26 real deliveries, both directions. **Ran a bus 4 commits stale until this session** |
| gates | `attack` **26/26** deterministic ✓, **every case proved able to go red** (defect restored in the bus, gate byte-identical) · `selftest` **now deterministic too** — 6/6 transport green |
| reviews | #1 (9 findings) in `REVIEW-adversarial.md` · #2 (10 findings) in `REVIEW-adversarial-2.md` · electio leader's field reviews in `REVIEW-electio-leader.md` and `REPLY-from-electio-leader.md` |

## ✅ Closed in session 4 — adversarial review #2

All 10 findings reproduced before being fixed, plus open item 1 (the flaky `selftest`) closed, and **every fix is pinned by a gate that was demonstrated
to go red.** The two 🔴 are the ones that matter.

| # | defect | fix |
| --- | --- | --- |
| 1 🔴 | **A leader that `cd`s into the expert's repo drained the expert's inbox.** The Stop payload's `cwd` follows the *Bash tool's* directory, so `cd web-app && git log` ended the turn identified as the expert. Mail announced into the wrong context, moved to `delivered/`, logged `via=hook`. Sender told `✓ delivered`. Symmetric, and present in electio's bus | identity now comes from the hook stub's own location (one per agent), never from the session cwd. Gated by **A13** |
| 2 🔴 | **A10 could not go red.** It asserted `after === 0 \|\| after === before` — true for every reachable value — so the only live clause was `exit === 0`, and its fixture never failed to render. Moving `drain` ahead of `render` left the whole gate green | asserts the conjunction the code states (no nudge ⇒ mail kept), with an injected render failure. Proved red |
| 3 🟠 | `comm log` and `comm sent` rendered a raw ref — a forged `[SYSTEM]` line in the **leader's** own audit surfaces | `safeRef` on both. Gated by **A15** |
| 4 🟠 | `dismiss --force leader` cleared the **operator's own** inbox and reported success — `--force` takes no value, and `firstPositional` swallowed the next token. Reachable by following the tool's own error text | valueless-flag set. Gated by **A14** |
| 5 🟠 | A11's "refused at send" was satisfied by the *existence* check, so the control-character rule it guards could be deleted with A11 still green | asserts the refusal **reason**, not the exit code. Proved red |
| 6 🟠 | A2 built both its corpus and its budget from its **own** copies of the constants — raising `MAX_REF` in the bus moved nothing | constants imported from the bus, **plus an absolute ceiling** — see the retraction below |
| 7 🟡 | `install --check` exited 0 while an agent was entirely uninstalled; "across 3 agents" counted the roster, not the installs | a roster entry with no directory now fails the check |
| 8 🟡 | the `inbox` peek hint told you to run a `dismiss` the identity guard refuses | hint matches the guard (`dismiss <agent> --force`) |
| 9 🟡 | `comm sent` quarantined corrupt files as a side effect and said nothing | reports the count, as `who` already did |
| 10 🟡 | the installer said hooks "take effect in the NEXT session" — true of `settings.json`, **false of the bus**, the only file an upgrade changes | says both, explicitly |
| 11 🔴 | **`selftest` reddened ~1 run in 6 with nothing wrong** — ARM A asserted a sentinel reached a real agent's *output*, measuring the transport AND the model's choice to obey | split: **transport** (hook fired, right mail drained, logged `via=hook`) is deterministic and is the gate; **behaviour** (did the agent read?) is reported, never gated |

⚠️ **A retraction on finding 6, because it was my fix that was wrong.** Importing the constants did *not*
close it: the budget is derived from them, so raising `MAX_REF` raised the budget too and A2 still could
not fail — **the same tautology as finding 2, reintroduced by the fix for finding 6.** Caught only because
the mutation was actually run. A2 now carries an absolute ceiling as well, and the fix for a red there is
never to raise the ceiling.

⚠️ **What the electio leader got right and what it got wrong.** It reported the symptom of finding 1 and
diagnosed it as an unscoped imperative in the nudge. The imperative concern is real and secondary; its
proposed fix would have left the mail theft in place. Its *observation* is what made the finding.

## ✅ Closed in session 5 — the electio leader's §3

🔴 **N sessions in ONE tree shared ONE inbox, and the fix for the cross-tree theft made it structural.**
The leader reported it and explicitly declined to diagnose it ("my diagnoses are worth less than my
observations") — it left the test arm to me. Measured with real sessions: an expert's `done` addressed to
the leader was consumed by a **classifier's** turn end, drained, logged `via=hook`, `comm sent` showing
✓ delivered. The leader would never have learned the round landed.

**This was live on the owner's machine while it was being fixed** — `comm who` against the real project:

```
● leader   running (pid 335746,341714,341833,341956,342041)  ⚠ 5 SESSIONS SHARE THIS INBOX
```

Fix: a session may **declare** its identity (`CLAUDE_COMM_AGENT`), and the declaration wins over the
directory. An unknown name means *not on the bus* — receive nothing, drain nothing — so the unsafe case is
the loud one. Unset keeps the directory fallback, so every existing install is unchanged. `comm who` now
reports when several live sessions resolve to one agent. Gated by **A17**.

⚠️ **The honest limit: the default is still the unsafe one.** A session that declares nothing falls back to
the directory, so protection requires the operator to declare on the *non-bus* sessions. Inverting it would
silently cut off every existing install, which is worse. `who` makes the condition visible; it does not
prevent it.

⚠️ **And I attacked my own fix hours after writing it, which is where the yield was.**
`CLAUDE_COMM_AGENT` is an environment variable, and the obvious way to silence three classifiers at once is
to **export** it — at which point the real leader launches off-bus too. Measured with a live control:

| surface | said | truth |
| --- | --- | --- |
| `comm who` | `○ leader  not running` | it **is** running |
| `comm sent` | `⧗ pending — lands when relaunched` | relaunching under the same export changes **nothing** |

That is the A12 failure class — four diagnostics agreeing on a confident wrong answer — reintroduced by the
fix for A17, by me, the same day. `who` now reports off-bus sessions and `sent` says `⧗ STUCK` with the
reason. Gated by **A19**.

✅ **Confirmed in the field the next morning, unprompted.** After the reboot the owner relaunched all three
electio sessions with the declaration set — `leader`, `web-app`, and `none` on an adversarial reviewer
sharing the leader's directory. `comm who` reports one pid per agent and the shared-inbox warning is gone,
on the exact layout that produced it. Read from `/proc/<pid>/environ`, not from anyone's report.

⚠️ **One honest limit of that display, unchanged:** the off-bus warning is printed only when the agent has
*no* live session (`!l && off`). Here the reviewer is off-bus in the leader's directory while the leader
runs, so `who` says nothing about it. That is correct — an off-bus session drains nothing — but it means
`who` confirms "the leader is on the bus", never "nothing else is sitting in its tree".

⭐ **The leader's question was better than a fix would have been:** *is "one agent = one directory" the right
axiom for a bus whose hub is exactly where you parallelise?* No — and the answer is that the name must be
declarable, not derived. That is a design change it surfaced by asking rather than by proposing.

### SessionStart — the debt, paid

Twice I wrote that `SessionStart` was covered "by construction" because it shares `hookDeliver`. That is
reasoning, and this session already showed what reasoning is worth here. Exercised properly, including one
real launch:

| | result |
| --- | --- |
| output schema (`hookSpecificOutput` / `additionalContext`) | ✓ correct |
| **a real session actually receives it** | ✓ the agent quoted the injected notice back verbatim |
| mail drained at launch | ✓ |
| declared identity honoured on this path | ✓ `none` does not drain, the real agent does |
| wording | 🟡 **wrong** — announced mail as arriving *"while you were working"* to a session that had just launched and never worked |

No defect on the path that mattered, which is worth stating as plainly as a defect would be. The wording is
fixed and the whole path is now gated by **A18**. It deserved the attention: it is the only path that serves
a stopped agent, it fires when the inbox is fullest, and a rejected schema there would drain mail and show
it to no one.

## ✅ Closed in session 6 — a gate went red on its own

🔴 **A declared identity was matched globally, so it leaked across projects.** `whoami` returned on the
declaration without ever checking the process lives in *this* project — and **every project in this
framework has an agent named `leader`.**

I did not go looking for this. `attack` was run as a routine check after the reboot and **A19 failed with
no code change since it was committed.** The cause: the real electio leader, relaunched that morning with
`CLAUDE_COMM_AGENT=leader`, was counted as a live `leader` inside A19's own throwaway temp project, which
made `who` take the "agent is running" branch and skip the off-bus warning A19 exists to assert.

Reproduced with one variable moved — same box, same live sessions, same directory, only the agent's **name**
changed in an unrelated temp project:

| `.comm/config.json` agent name | `comm who` in `/tmp/comm-leak-BPO8` |
| --- | --- |
| `chief` | `○ chief  not running` |
| `leader` | `● leader  running (pid 388580)` ← **a session in `~/Dev/electio`** |

Everything built on `liveAgents` inherited it: `send` and `sent` would report a recipient as reachable with
nothing listening, and `who` would print a live pid for a project whose leader was not running at all.
That is the A12 failure class again — a confident wrong answer, agreed on by several surfaces.

Fix: the declaration still wins over the directory, but only within its own project — `findRoot(process cwd)`
must resolve to this root. Safe to make stricter because `liveAgents` only ever *reports*; delivery anchors
on the hook stub's location, so a stricter answer here cannot lose mail. A session's own cwd is stable under
the Bash tool's `cd` (verified against a live session), so this is not the wandering-cwd surface finding 1
removed.

**Gated by A20, proved red with the defect restored in the bus and the gate byte-identical** — and it fails
on the arm that matters: `foreign reported running=true (want false)` while `native` stays `true`. A20 carries
both arms deliberately: from the foreign arm alone, "scoped correctly" and "declared liveness switched off
entirely" are indistinguishable.

⚠️ **This is the third consecutive session in which the highest-value finding was in the previous session's
fix** — A17 (declared identity, session 5) created it, exactly as [[attack-the-recent-fix]] predicts. It was
caught by a contradiction from outside, never by re-reading the patch.

⚠️ **electio is now running a bus one commit stale** (its `.comm/bin/comm.mjs` was byte-identical to the
repo before this fix). No live impact there today — it is the only installed project, so no name collides —
but the moment a second project is installed, or selflo is restored, it collides on `leader`.

## ✅ `who` can now answer "who HOLDS this directory" — the electio leader's report #4

🟠 **`who` answered "who receives mail" and was asked "who is writing here".** The leader measured it twice:
the session holding the write lock on the file it was about to edit was an adversarial reviewer correctly
declared `none` — off the bus by construction, therefore **invisible**. Its house rule is one writer per
file, so it had already written its own `/proc` scan **in two places** (opening ritual, and a new
`pre-commit` hook). That workaround is the signal, not the missing line.

⚠️ **I had written this exact gap into STATUS myself that morning** — "`who` confirms *the leader is on the
bus*, never *nothing else is sitting in its tree*" — called it an honest limit and moved on. The observation
was right and **my severity judgement was wrong.** Recorded because the pattern is now three for three:
their observations outrank my diagnoses.

Their framing is the one in the code: **"off bus" is a property of the MAIL, not of the PRESENCE.** It also
settles the scope question on its own — `who` already reads `/proc` and already reports presence.

Shipped: `who --all` lists live sessions in the tree that receive no mail, with their cwd; and the default
output **warns** rather than staying silent, because the unsafe case has to be the loud one. Installed into
electio (bus byte-identical to the repo, `log.jsonl` unchanged at 33 lines, no temp files left).

⚠️ **Deliberately NOT the reported sketch, and the difference is measured.** Their sketch keyed off the
off-bus map, which is indexed by the *agent directory* a session occupies — so a session in `scripts/` or
`docs/`, owned by no agent, would have stayed invisible, and that is exactly when "is anyone in my tree"
matters. **Gated by A23** (six clauses), **proved red with their sketch restored as the mutation**:

| clause | their sketch | shipped |
| --- | --- | --- |
| `none` session in the leader's dir (their case) | ✓ | ✓ |
| session in `scripts/`, owned by no agent | ✗ **invisible** | ✓ |
| the cwd is shown | ✗ | ✓ |
| a real agent is never listed "off bus" | ✓ | ✓ |

Two further mutations redden their own clause, and the **false-positive control is inside the gate**: with no
off-bus session running, the warning must be *absent* — otherwise A23 would be satisfied by a line printed
unconditionally.

💰 **It cost 5% of the readability budget (A22: 85% → 90%).** The budget was written hours earlier and its
rule holds: the next feature this size is paid for in deletions elsewhere, never by raising the ceiling.

### The installer now writes atomically

An upgrade lands on a project whose agents are **live** — that is the normal case here, not an edge one —
and `.comm/bin/comm.mjs` is executed by a `Stop` hook at every turn boundary. `writeFileSync` truncates
first, leaving a window where the hook loads a partial file and that turn's delivery is silently missed.
Now write-to-temp + `rename(2)`, same directory. Exercised ~6× per `attack` run.

⚠️ **Not gated, deliberately.** The property holds by construction (`rename` is atomic within a filesystem);
a gate would have to race a hook against a write, and a flaky gate is worse than none — the `selftest` lesson.
Stated here instead of pretended.

## ✅ Session 7 — the field closed my open question, and my own audit field fooled me

**Their report #5 answered the control I asked for.** My reply #4 ended: *"`who --all` has never been
exercised on your tree with a real off-bus session alive. The first `none` you launch is the real control,
and if the line does not appear, I want to know."* It appeared — 3 live `none` sessions, counted correctly,
loud without `--all`. **I then ran the half they had not**: their three stand-ins were still alive, so
`comm who --all` on their real tree listed all three with correct pids and cwd, cross-checked against an
independent `/proc` sweep. 3/3. Their `log.jsonl` unchanged at 37 lines.

Also confirmed by measurement, not by reading their report: **electio's bus is byte-identical to HEAD**
(`79f545e3…`). Their `COORDINATION.md` had claimed all day that it was stale from session 1; they caught
that themselves and corrected it.

⚠️ **I guessed one of their caveats was over-cautious and the log corrected me.** They wrote "no mail
circulated during this configuration". I assumed their earlier rounds 9–11 already covered it. The log says
the last delivery was 2026-08-05T20:48 and their `none` sessions started 2026-08-06T00:07 — **their caveat
is exact.** Different configuration, different pids. Their self-assessment beat my inference; that is now
four for four.

### 🔴 `to_agent` looks like an audit field and cannot fail — and I was its first victim

Auditing their 37 rows with `to !== to_agent` returned **"0 drained by the wrong agent"**, and I was about
to send that number to the field as evidence. It is unearnable. `pending()` reads `inbox/<agent>/` and
`drain()` stamps that **same** agent, so `to === to_agent` holds for every reachable row.

**The A10 class — an assertion true for every value it can take — except this time baked into the DATA
FORMAT**, where it outlives any one reader and reads like evidence to the next person. Logging nothing would
have been safer than logging this.

Measured with two live arms, both confirmed to actually move mail (`inbox 1 → 0`):

| arm | who physically ran | logged row |
| --- | --- | --- |
| honest | `app`'s own installed stub | `to=app to_agent=app via=hook` |
| impostor | the **leader's** stub with `CLAUDE_COMM_AGENT=app` | `to=app to_agent=app via=hook` |

**Byte-identical**, and no pid or process identity anywhere in the row.

⚠️ **The probe was VOID on its first run and said the opposite.** The send was refused (a ref resolves
relative to the *recipient's* directory, A9), nothing drained, and the two arms compared *equal* — because
both were `undefined`. It printed `indistinguishable: true`, the answer I was expecting. Only the
`both arms actually drained` assertion caught it. [[prove-the-probe]] again: **a fixture that cannot run
reports "no problem"**, and it does so in the direction of your hypothesis.

Fix: `id_src` on every drained row — `stub` (that agent's own installed hook ran, so identity cannot wander),
`declared` (a session asserted the name through the environment), `cwd` (legacy fallback), `cli` (dismiss).
The declaration is tested **first**, because it wins inside `whoami`.

**Gated by A24, proved red twice with the gate byte-identical**, and in both mutations the fixture control
stayed green — so it reddened on its assertion, not on a broken fixture:

| mutation | result |
| --- | --- |
| `id_src` deleted from the row | `honest=undefined, impostor=undefined` → red |
| test `agentRoot` **before** the declaration | `honest=stub, impostor=stub` → red — the impostor stamped **honest**, worse than no field |

A24 carries a third clause that pins *why*: the naive `to !== to_agent` comparison must **still find nothing**.
Without it, deleting `id_src` leaves the tautology intact and the gate passes on the very format it rejects.

⚠️ **Only rows written from today carry `id_src`.** The 37 historical rows are unauditable and stay that way.
💰 A22: 43 041 → **44 246 bytes (90% → 92%)** of 48 000. Two features in two sessions have spent 7% of the
budget; the next one is paid for in deletions.

## ✅ Session 8 — their question about ROLE found two defects in my own surfaces

Their report #6 asked one design question — **does "role" belong in the bus?** — and answering it properly
cost them nothing and me two findings. Both were in code I had written in the two previous sessions.

**The answer: no, and keep the separate variable.** Measured before replying, because my first instinct was
to tell them they never needed `ELECTIO_ROLE` — and that instinct was dangerous:

| measured | result |
| --- | --- |
| does the bus already distinguish distinct off-bus names? | **yes** — `off bus (curator)`, `off bus (classifier)` shown separately, no role concept required |
| does a role-named session drain anything? | **no** — `app` inbox 1 → 1 after a `curator` turn ended |
| what if a role name collides with an agent name? | 🔴 **`app` inbox 1 → 0** — it silently goes ON the bus and eats that agent's mail |

So the visibility they built `ELECTIO_ROLE` for was already available — **but recommending they use
`CLAUDE_COMM_AGENT` for roles would have handed them a namespace where a typo becomes mail theft.** `none` is
safe only by accident. Their separate variable is the correct design, not a workaround. Written into the
README as **three questions, never one variable** (receives mail? / as whom? / what does it do — the last one
never the bus's business). Their formulation, extending their own item 39: *"off bus" is a property of the
MAIL — not of the PRESENCE, and not of the ROLE.*

⚠️ **Their `--no-verify` five times in 36 commits, each justified in the message, is the same erosion as my
UTC-in-two-places.** Worth recording as a shape: a guard that is *defensible each time it is bypassed* is
already failing.

### 🔴 A25 — the off-bus warning named a value most sessions did not have

`⚠ 3 session(s) here declared OFF-BUS (CLAUDE_COMM_AGENT=none)` — read off `off[0].declared` and presented
for all N, while two of the three had declared `curator` and `classifier`. **The A12 class, inside the
`who --all` feature shipped the session before**, and it would have hit them precisely because they run four
roles. Fixed to name distinct values and keep the single value when they agree. **Gated by A25, proved red
twice**; the original defect reddens arm 1 while arm 2 stays green, so the arms are independent.

### 🔴 A26 — `comm sent` rendered UTC while `who` rendered local

They had never run `comm sent` and asked what it asserts. Running it against their real log showed `23:08`
for a message sent at **01:08 local** — a bare UTC `HH:MM`, no zone marker, on the one surface an operator
holds up against `who`. No dates either, so rows spanning three days looked alike.

⚠️ **I had already found and fixed this exact defect in `who` the session before, and left the sibling
surface in the same file.** The comment I wrote there even asserts *"which every other tool reports
locally"* — which `sent` made false. One helper now serves both. **Gated by A26**, machine-independent by
construction (a known UTC instant under `Asia/Tokyo` and under `UTC`, in January to dodge DST), **proved red
twice** — once for the zone, once for deriving the date from `toISOString()`, which pairs a local time with
the previous day's UTC date after 22:00 here.

### On `comm sent` and "was it READ" — answered: not assertable

They asked for it and pre-empted the answer themselves. The number they did not have: **3 of `selftest`'s 6
behaviour runs showed the agent not reading the file it was pointed at.** A "read" field would be wrong about
half the time, *in the reassuring direction*. Their existing proxy — the expert's commit citing the brief —
is proof by work produced, and is the right one. Not building it.

**Field state:** their log 37 → 43 rows, the pending nudge delivered (01:08 → 01:28, 20 min). Their exact
binary passed the full gate 23/23 in a fresh tree.

### ✅ electio reinstalled — 2026-08-06 04:50, with every session closed

The owner closed all electio sessions, which made this the safest possible moment: no hook could fire
mid-write, and **both inboxes were empty, so no mail was ever at risk.** Verified before and after:

| | before | after |
| --- | --- | --- |
| bus md5 | `79f545e3…` | `92a5742c…` = repo HEAD |
| `log.jsonl` | 43 lines | **43 lines** |
| inboxes (leader / web-app) | 0 / 0 | **0 / 0** |
| `delivered/` · `corrupt/` | 42 · 0 | **42 · 0** |
| hook stubs + `settings.json` (4 files) | — | **md5 unchanged, untouched** |

`install.mjs` wrote **1 file** (5 already current); `--check` reports `✓ 6 file(s) in sync across 2 agents`,
exit 0. Confirmed on their real data afterwards: `sent` now renders local time with dates
(`01:08`, `2026-08-05 02:05`), `who` is clean and silent with nothing running.

⚠️ **Deliberately NOT smoke-tested by sending a message.** A test nudge would sit in an inbox and land in a
real agent's context when they relaunch. The delivery path is covered by the 26-case gate against a
byte-identical binary; injecting into a live project to reassure myself is not a trade I will make.

⚠️ **A zone convention, now that two surfaces were inconsistent:** bare clock times (`who`, `sent`) are
**local**; full ISO timestamps (`comm log`) are **UTC and marked `Z`**. `log` was deliberately left in ISO —
it is the audit trail, and the `Z` makes it unambiguous, which is exactly what `sent` lacked.

### 🕰️ Kitty needs no restart — verified, not assumed

`allow_remote_control socket-only` and `listen_on unix:/tmp/kitty-{kitty_pid}` are live in the **running**
instance: socket `/tmp/kitty-617118` exists, `KITTY_LISTEN_ON` is set inside the window, and `kitten @ ls`
answers with real JSON. The restart that armed this already happened. **Nothing about Phase 2 requires
another one** — and a restart would still kill every live agent session, so it stays off the table
mid-round.

💰 **A22 is at 95%** (45 646 / 48 000) — ~2 350 bytes left. Three sessions of features have spent 10% of the
readability budget. The next feature of this size must be paid for in deletions; that is the rule and it is
about to be tested.

⚠️ **And the measurement that makes that decision harder than it looks: 55% of the bus is comments**
(25 041 bytes of comment against 20 605 of code, 842 lines against 492). So "pay in deletions" means
deleting either dense code or **the findings written at the point they apply** — and that practice is the
reason those rules have not been simplified away. Cutting the narratives to fit the budget would trade the
project's memory for its size limit. **This is a values decision, not a technical one; it is the owner's,
and it should be made calmly now rather than under pressure when a gate goes red.** Options as I see them:
(a) hold, and let the next feature force it; (b) keep the one-line *"what breaks if you remove this"* at each
site and move the long measured narratives — dates, pids, tables — into a `FINDINGS.md` keyed by gate id;
(c) raise the ceiling, which the rule forbids in its own terms.

## 🛡️ "Performant, compact and secure by default" — what that is worth, measured

The owner asked (2026-08-05) whether the project should be **ported to Rust**, out of a concern about memory
leaks and security as features accrete. Measured rather than argued, and the recommendation was **not to
port**:

| claim | measurement |
| --- | --- |
| npm supply chain | **no `package.json`, no `node_modules`, zero dependencies** — one 40 KB file on `node:fs`/`path`/`crypto`/`url`. There is nothing to compromise |
| speed | hook path **61 ms**, of which **49 ms is Node starting** — a port saves ~50 ms per turn boundary, against measured delivery latencies of **586 s median / 1462 s** in the slow direction. It would optimise ~0.008% of the number that is actually felt |
| memory leaks | **structurally impossible**: no `spawn`, no timer, no watcher, no server anywhere in the bus. A process that exits in 61 ms has nothing that lives long enough to leak |
| would Rust have caught the ~24 findings? | **two.** A `SafeRef` newtype would make rendering an unsanitized ref unrepresentable (#3), and a real arg parser prevents `--force` swallowing a positional (#4 — available in Node too). The other ~22 are semantic: identity derived from the wrong thing, gates that could not go red, a probe whose fixture could not run, a name matched globally. No type system catches a tautological assertion |
| cost | Node is guaranteed present (Claude Code runs on it) and install is *copy one file*; a binary needs cargo on every machine or committed artefacts into a gitignored `.comm/`. And the 20+ case gate is the actual asset — reimplementing it is where the properties get quietly lost |

**The three properties are protectable by gates, and a port protects none of them.** Rust cannot tell you the
bus grew past what one person will read, that a nudge started carrying content, or that someone added a
daemon. So:

- **A21 — the bus stays a short-lived process.** Import allowlist (`node:fs|path|crypto|url`) plus no
  `setInterval`/`setTimeout`/`watchFile`/`createServer`/`.listen`/`spawn`. **Each clause proved red
  independently** (foreign import; unreachable `setInterval`), because two guards OR'd together can hide a
  dead one — the A8 lesson. Comments are stripped first, and the **false-positive control is part of the
  proof**: the same construct written in a comment must stay green, and does. A naive grep for these words
  already matched prose once on the day this was written.
- **A22 — the bus stays readable in one sitting.** 40 654 bytes of a 48 000 budget (85%). Proved red by
  growth past the ceiling. The property is not disk space: **every defect this project has found came from
  reading or from measuring**, and a file too large to read end-to-end retires the first half of that method.
  In the framework's own idiom — **the fix for a red is to split or cut, never to raise the budget.**

⚠️ **Latency is deliberately NOT gated, and that is not an oversight.** A timing threshold reddens for
reasons foreign to what it claims to verify on a loaded machine — the exact failure that made `selftest`
flaky 1 run in 6. It is measured and reported, like `selftest`'s behaviour half.

⚠️ **Still open on "secure by default": the threat model is one line in the README** ("identity is not a
security boundary; every agent runs as the same Unix user"). It is true and it is not enough. The real
surface is **agent-to-agent prompt injection** — a nudge lands in another agent's context — which is why the
first rule is *nudge, not content*. A8 and A15 gate parts of it; nothing yet states plainly what the bus
does and does not defend against as features are added.

## ⏭️ OPEN

1. **🔴 Latency is a mailbox — not an interrupt.** Re-derive with `node test/latency.mjs <log>`; the table
   is no longer transcribed. From electio's 26 real deliveries:

   | direction | n | median | max |
   | --- | --- | --- | --- |
   | leader → web-app | 12 | **1462 s (24.4 min)** | 3324 s (55.4 min) |
   | web-app → leader | 14 | 586 s (9.8 min) | 986 s (16.4 min) |

   The asymmetry is structural: mail lands at the recipient's *turn boundary*, and the expert's turns are
   long. **An agent that is alive but idle never receives its mail** — the electio leader hit this twice,
   session alive and pid visible, because it was in no turn at all. `who` showing "running" does not mean
   reachable. Do not describe the bus as real-time in any doc.

   ⚠️ **A second mechanism contributed to this tail, and it is now FIXED — which means the historical
   numbers above are worse than what the bus does today.** Review #2 found that a turn ending with cwd in a
   non-agent directory made `whoami` return null, so the hook exited 0 and the agent's own mail was silently
   not delivered. Measured on the pre-fix bus, leader's own mail, one variable moved:

   | turn ends in | old bus | new bus |
   | --- | --- | --- |
   | `.` (root) | delivered | delivered |
   | `docs/`, `scripts/` | **silently not delivered** | delivered |
   | `web-app/` (another agent's dir) | **stolen — drained into the wrong inbox** | delivered |

   So an unknown share of the tail was a turn that simply ended in the wrong directory, not an idle agent.
   The log cannot say which rows. Going forward only idleness remains, and **that one is still open** — it
   is the whole justification for item 3. Gated by **A16**.

   ⚠️ **All 26 rows predate the `via` field, so delivery, dismissal, and a drain by the wrong agent are
   indistinguishable across the whole history.** The script says so on every run rather than printing a
   clean table. New rows are not exposed to this.
2. **`--reply-to <id>` (threading).** Requested by the electio leader in review #1 — and **deprioritised by
   it in its follow-up**: with two agents, threading adds identity surface while the substance already lives
   in the file. It ranks the wake mechanism (item 3) above this.
3. **Phase 2 — kitty wake for the idle agent. RESTART DONE, RESOLVER BUILT AND VERIFIED LIVE, SEND NOT BUILT.**
   Item 1 is its justification: an agent alive but in no turn never receives its mail, and that is the last
   delivery gap.

   **2026-08-05, after the owner's reboot — measured against the four real sessions on his screen**
   (`node test/kitty-resolve.mjs <pid>...`, read-only, sends nothing):

   | | result |
   | --- | --- |
   | remote control survived the restart | ✓ socket `/tmp/kitty-384996`, `KITTY_LISTEN_ON` set in every window |
   | every live agent resolved to exactly one window | ✓ 4/4, distinct windows, via nearest-ancestor `/proc` walk |
   | a live process outside kitty is refused | ✓ orphaned stand-in → chain `408083 → 5084 → 1`, unresolved |
   | pid 1, and kitty's own pid as a window root | ✓ both correctly refused / absent |

   🔴 **The obvious implementation would have been a permanent silent no-op.** `@ ls` reports a window
   `pid`, and it is the window's **shell** — the agent is in `foreground_processes`. Matching `window.pid`
   against the pids `comm who` knows resolved **0 of 4** on the real layout. Under constraint 2 (refuse
   when the match does not resolve) that is a wake that never fires and reads on screen exactly like *"no
   idle agent needed waking"* — this project's signature failure shape, and it is kept as a live control in
   the probe rather than as a comment.

   ⚠️ A whole-chain match is *not* equivalent to nearest-ancestor: every chain passes through kitty itself
   and up to init, so a wider match adds only false hits. Refusing those as "ambiguous" would be safe in
   the wrong direction — the same silent no-op. The nearest ancestor that is a window's root **is** the
   window; there is nothing to disambiguate.

   **Constraint 1 is now confirmed by observation rather than argument.** Two of the five windows share
   `/home/leonh/Dev/electio` (the leader and an off-bus adversarial reviewer), so cwd cannot identify an
   agent — and the window **title changed between two `@ ls` calls seconds apart**, because the spinner
   glyph is part of it (`⠐ Consult with leader expert` → `⠂ …`). Titles are not merely fragile; they are
   not stable across two consecutive reads.

   **Done 2026-08-05:** `~/.config/kitty/kitty.conf` now sets `allow_remote_control socket-only` and
   `listen_on unix:/tmp/kitty-{kitty_pid}` (backup in scratchpad). `socket-only` because the windows run
   coding agents — it means the socket is the only control path, not in-band escape codes from inside a
   window. ⚠️ *That refusal is kitty's documented behaviour; I verified the socket path works and did NOT
   verify the refusal.* **Takes effect on the next kitty restart.**

   **Verified BEFORE committing to that restart**, with a scratch headless instance launched against the
   real edited config:

   | | result |
   | --- | --- |
   | socket created at the configured path | ✓ `/tmp/kitty-<pid>` |
   | reachable via `kitten @ --to` | ✓ |
   | `KITTY_LISTEN_ON` set inside each window | ✓ — the bus can discover the socket with nothing hardcoded |
   | `@ ls` exposes per-window `pid`, `title`, foreground `cwd` | ✓ |

   **Design constraints the probes settled — do not re-litigate these by reasoning:**
   1. **Match agent → window by PID, not title and not cwd.** `liveAgents` already knows each agent's pid
      from `/proc`; `@ ls` reports each window's pid and its foreground processes. Titles are fragile, and
      cwd is now ambiguous by design — several agents may share one directory (A17).
   2. **Resolve the match FIRST and refuse to send when it does not resolve.** Measured: `send-text --match`
      hitting nothing **exits 0 silently**. `send-text`'s exit code may never be treated as delivery
      evidence — that is the property this whole bus exists to deny.
   3. **The wake text must carry NO substance.** It is a doorbell that makes the idle session take a turn;
      the real nudge is then delivered by the `Stop` hook at that turn's end, through the path that is
      already gated. Anything else is content injection, which the project refuses by its first rule.
   4. **NO DAEMON, NO TIMER, NO WATCHER — the wake stays a short-lived process.** The natural way to build
      a wake is a process that watches inboxes and lives forever. That would be the first long-lived thing
      in this project, and it is the only way this tool could ever acquire a memory leak: today `comm`
      starts, does file I/O and exits in 61 ms, so nothing lives long enough to leak. That is an
      **architectural** property, not a Node-versus-Rust one, and it is now **gated by A21** (import
      allowlist + no long-lived construct) rather than left to good intentions. The wake must therefore be
      driven from the existing per-turn hook invocation, not from a resident watcher.
   5. A third option the owner surfaced remains unexplored: an **MCP channel that pushes into the session**
      (`--dangerously-load-development-channels`) — undocumented, dev-flagged, unverified.

4. **selflo is UNINSTALLED** (owner's call, 2026-08-04). Backup:
   `scratchpad/selflo-comm-backup-2026-08-04.tgz`. ⚠️ Its `COORDINATION.md`, `scripts/sync-agent-files.mjs`
   and 6 `docs/START_HERE.md` **still document the bus** — an agent relaunched there before reinstall will
   follow those docs into a missing file.

## ⚠️ What was NOT verified

- **Whether finding 1 ever actually ate mail in electio.** Still unanswerable — but the reason stated here
  for three sessions was **wrong, and the wrong reason was the more dangerous half.** It said the log "never
  records which agent's hook drained it". It does: `to_agent`, since the initial commit. What it records is
  the **resolved name**, and every theft class this project has had works by making the thief resolve to the
  *victim's* name — so the field is clean by construction in exactly the cases it would need to catch. I
  proved that the hard way on 2026-08-06 (see session 7). `id_src` now separates the two, but it is only on
  rows written from today; the 37 historical rows stay unauditable. Review #1's finding 6, one level up.
- **How long the wandered-cwd window stays open.** Proved within a single `-p` turn. Whether an interactive
  session's Bash cwd resets between turns, or after `/clear`, is unmeasured — it decides the exposure, not
  the existence, of the defect. Now moot for delivery (identity no longer reads cwd) but it still governs
  the `whoami`-returns-null case in open item 2.
- **Behaviour when an agent is mid-tool-call** rather than mid-turn. Still unexercised.
- **`selftest`'s BEHAVIOUR half is not a gate and never will be** — 3 of 6 runs showed the agent not reading
  the file it was pointed at. That is allowed by design, but it means this bus regularly rings a bell nobody
  answers, and no gate can tell you that happened in production.
- **Anything non-Linux**: `comm who` reads `/proc` and degrades to "not running" everywhere else.
- **A8's two guards under partial mutation.** Each alone is uncaught, both together are caught; the
  in-between cases were not enumerated.
- **The `-restored` duplicate id** in electio's log, unexplained across three reviews now.

## A measurement trap, recorded

`delivered/` file mtimes look like drain times and are not — `renameSync` preserves mtime, so they are
*creation* times. The only honest source is the `delivered` field in `.comm/log.jsonl`.

**A second one, from this session:** a probe that reported "the defect does not reproduce" on both arms was
wrong — a relative path in a hand-built hook payload made `findRoot` miss and the hook exit 0 silently,
which is indistinguishable from a clean result. Its positive control passed *because it used an absolute
path and so never travelled the broken path.* **A control that does not go through the same code as the arms
validates nothing.** Both reviewers hit a version of this in the same session and recorded it.

## Where the mistakes are recorded

Findings are written into the code and gate comments at the point they apply (`test/attack.mjs` header for
A8; the A10 rewrite note; `hookDeliver`'s identity comment; `firstPositional`; `resolveRef`/`refForRecipient`
in `bin/comm.mjs`). *A rule whose cost you cannot see is a rule someone will simplify away.*
