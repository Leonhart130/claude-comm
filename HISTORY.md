# HISTORY — claude-comm, session by session

**This file is not read at boot.** `STATUS.md` says what is OPEN; `FINDINGS.md` says why each guard
exists; this is the record of how each was arrived at, kept because the reasoning behind a closed
decision is what stops it being reopened badly — and split out because a boot that reads it pays
~7 000 tokens for history it will not act on.

Sections are in the order they were closed.

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

⚠️ **The measurement that made the decision: 55% of the bus was comments** (25 041 bytes against 20 605 of
code). "Pay in deletions" therefore meant deleting either dense code or **the findings written at the point
they apply** — the practice that keeps those rules from being simplified away.

### ✅ RESOLVED — the narratives were split out, not deleted (owner's call, 2026-08-06)

Each site keeps a one-line *"what breaks if you remove this"* plus a `FINDINGS.md#anchor`; the long measured
narratives — dates, pids, tables, the retractions — moved to **`FINDINGS.md`**.

| | before | after |
| --- | --- | --- |
| bus | 45 646 bytes (**95%**) | **36 626 (76%)** |
| comments | 25 041 (55%) | 16 027 (44%) |
| **code** | 20 605 | **20 599** |
| lines | 842 | 708 |

**Verified that this was a comment-only change:** stripping comments from HEAD and from the new file gives
**byte-identical code** — no executable line moved. The 6-byte delta above is the comment-stripper counting
`/** */` blocks differently from `//` runs, not a code edit.

⚠️ **The split introduces exactly one new failure mode, and it is gated.** A pointer to a section someone
renamed or deleted is **worse than no pointer** — it reads as "the reasoning is recorded elsewhere" while the
reasoning is gone, which is how a rule gets simplified away with confidence. **A27** checks every anchor
resolves; proved red three ways (a bad anchor, a renamed section, `FINDINGS.md` deleted).

⚠️ **A27 was red on a correct tree first.** It required end-of-line after the closing backtick, but every
heading carries a title — so all 21 anchors reported dangling. A gate failing for a reason foreign to what it
claims to verify, caught only by running it. The shell check I had run by hand minutes earlier did not anchor
the end, which is exactly why the two disagreed.

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

## ✅ Session 9 — the boot protocol, and the three things it found on its first run

`bin/boot.mjs` replaces "read STATUS.md and hope" with a measurement. Six rows — session identity, tree,
archive, status freshness, field installs, the gate — plus the OPEN list above, in 0.2 s without the gate
and 14 s with it. `--fast` is wired to SessionStart so it applies without anyone remembering to run it.

Three decisions in it are load-bearing, and each is a scar:

1. **It never quotes STATUS.md as state.** Every row is re-derived from git, `/proc`, the installer and the
   inboxes. The status row exists only to say *how far this document has drifted from the code*.
2. **Identity is read from `/proc/<session>/environ`, never from boot's own env.** Boot is a child of the
   session, so an `export` typed inside a session WOULD be visible to it — and invisible to `comm who` and
   to electio's staging hook. Reading our own env would have made boot the one surface that confirms a
   declaration nobody else can see.
3. **The gate is never skipped because the fingerprint is unchanged.** That optimisation is the obvious one
   and it would have hidden A19, which went red with no commit since it was written. The fingerprint is used
   only to LABEL a red: *code unchanged since last green → the world moved, not the test.*

`node bin/boot.mjs --prove-red` builds a fixture, moves ONE variable per arm and asserts the matching row
reddens — 8 arms, all green, boot.mjs itself never touched. Its own first run failed honestly: the `tree`
arm sat at ⚠ before it was armed, because the fixture had no upstream and "no upstream" shares a level with
"uncommitted work". The fixture was given a bare origin — **a control must start where the real repo
starts.** `session` is excluded and labelled INFORMATIONAL rather than dressed up as a gate.

**What it found on the first run against this repo:**

- 🔴 **`FINDINGS.md` and `STATUS.md` are untracked and ignored** — see OPEN 5, the reason boot exits 1 today.
- ⚠ **`STATUS.md` said `attack` is 26/26. It is 28 checks over 27 ids.** Small, and exactly the drift class
  this file warns about: a headline number nobody re-derives.
- ✓ **electio is clean** — hooks in sync, installed bus byte-identical to the repo, 0 pending, last delivery
  22 d ago. The first independent confirmation since the 2026-08-06 reinstall.

⚠️ **Not verified:** that the SessionStart hook actually fires in a real interactive session — the command
was run by hand with `$CLAUDE_PROJECT_DIR` set and exits 0 on a red row, but Claude Code has not launched it
yet. It is verified on the next session opened in this directory, and the boot report appearing at the top
of that session IS the verification.


## ✅ Session 10 — adversarial review #3, and eleven findings answered

The brief pointed the reviewer at `bin/boot.mjs` and `bin/context.mjs` — hours old, gating nothing but
themselves — rather than at the bus. It returned **eleven findings, every one measured with its command and
output**, and both `--prove-red` harnesses passed on the shipped code while covering none of them. That is
the brief's own thesis confirmed: a control harness written by the same author in the same hour shares its
blind spots.

**The two severe ones were the shape the brief named.**

🔴 **R1 — `--fast` could render a genuinely red gate as `✓`, on the only path a session ever runs.** The FAST
branch could not reach RED for any input, and `.claude/settings.json` runs `--fast` at every SessionStart —
so it was the gate verdict on ~100% of boots. Worse, the fingerprint covered `comm.mjs`, `install.mjs` and
`attack.mjs` but **not the documents the gates read**: the reviewer renamed one anchor in `FINDINGS.md`,
left every code file untouched, and the fingerprint stayed `817a7c78e24a` while the suite went red. This is
the file's own header rule 3 — *the gate is never skipped because the code did not change* — violated by a
second, unremarked inference in the branch the author was not thinking about. Fixed twice over: a fourth
level (`UNKNOWN`, rendered `?`) so "not measured" can no longer borrow OK's tick, and a fingerprint that
covers every declared gate input. Both armed.

🔴 **R2 — a full boot silently erased the hook's `source` record**, by writing the state file wholesale over
the `--hook` branch's careful read-modify-write. That record exists for exactly one question — does `/clear`
report `source: "clear"` — which decides whether the reboot loop is buildable, and `CLAUDE.md` tells every
session to run a full boot, so the wipe happened through *documented use*. The file is gitignored, so there
was no recovery. Now merges, writes atomically via rename, and is armed.

**R3** was the sensor erring in one direction only: the growth rate divided a window's growth by the prompts
that happened to fall inside it, so a window opening mid-turn covered *k intervals plus a fragment* over a
divisor of *k*. Sweeping only the `TAIL` constant moved the reported rate 75% with the file untouched, and
the same transcript answered "3 rounds left" on a tail read and "5" on a full one. **The bias ran toward
"close sooner" — a sensor built to justify a reboot that erred toward recommending one.** Fixed by sampling
context at prompt boundaries and averaging a *fixed* window of the last two whole turns, so the read
strategy is an optimisation and never a semantic: the rate is now identical across `TAIL` from 448 KB to
8 MB, tail path or full.

**R4/R5/R9 were all the same class — a check that passes because it measured nothing.** The archive row
inferred a gate's document dependencies by matching the `join(PKG, "X.md")` *idiom*, which one refactor
defeats; it said "tracked" when `git ls-files` had returned nothing at all; and the field row printed "bus
current" when this repo's own bus could not be read. Dependencies are now **declared** in a `// gate-docs:`
marker with the inference demoted to a drift detector, and both void probes now report `UNKNOWN` or RED.

⚠️ **The drift detector's first run was itself a false red** — `test/latency.mjs` mentions `STATUS.md` in a
header comment, and the row reported an undeclared dependency that does not exist. `attack.mjs` had already
solved this for A21 ("strip comments before matching, so PROSE about a daemon cannot redden a gate about
daemons") and I did not reuse it. Worse, `grep` said the string was absent — the file contains two literal
NUL bytes, so it was treated as binary — which is precisely the trap [[prove-the-probe]] records and I
walked into it while fixing a finding about checks that measure the wrong thing.

**R6/R7/R8** were the sensor's edges: `--budget abc` printed `NaN tokens - OK` and exited 0, reachable as
`--budget $UNSET` because the shell drops the empty word and the next flag becomes the budget; a `guessed`
reading was structurally identical to a measured one, **same fields and same exit code**, so the label was
legible only to a human and this tool exists to be read by a loop; and `--hook` at a terminal hung forever
with no output. Now: a hard refusal, exit 3 with no verdict unless `--allow-guess`, and a TTY guard.

**R11** — a dangling `FRAMEWORK.md §1` pointer in the bus, the exact thing A27 exists to prevent, invisible
to it because A27 checks one filename. Gated by **A28**, proved red.

**What the reviewer got right that is worth keeping:** it verified the `arm()` helper cannot pass on a
polluted control, and it recorded what it did *not* examine — including that it could not settle whether
Claude Code enforces the hook `timeout`, which is R8's only remaining mitigation. It also restored the live
`.boot-state.json` by hand and said so, flagging it as a control it had touched.

## ✅ Session 10b — the bus reaches the work

**Installed 2026-09-04.** The owner reversed his deferral the
   same day ("you can install the utility on work"), after abandoning electio for now. the owner's live project now
   carries `.comm/` with **leader + the site expert**, 6 files, `--check` green, and the installer's portability
   claim is exercised for the first time outside the project it was written beside.

   ⚠️ **Two things the owner must decide, not me.** The hooks take effect at each agent's NEXT launch, so
   both live `work` sessions are still off the bus until relaunched. And `the expert repo's `.claude/`{settings.json,
   comm-hook.mjs}` show as **untracked in that git repo** — commit them so the wiring travels with the
   repo, or ignore them; either is defensible and it is his tree.

   ⏸️ **electio is abandoned** (owner, 2026-09-04 — it was built by another group and is not open source; he
   may continue his own version openly). Its install is left in place and harmless; the field row will keep
   reporting it until he says to remove it.

**The finding it closed:**  the owner's live project — leader plus the a site-building expert dev expert,
   his live project — has no `.comm/` at all. The only install is electio, whose last delivery was 22 days
   ago. Every autonomy feature above ships into a project that cannot receive it. **Installing there is the
   first move, and it is also the honest test of the installer's portability claim**, which has never been
   exercised on a project it was not written beside.


## ✅ Closed — items retired from STATUS on 2026-09-04

These were carried in OPEN long after they stopped being open. STATUS.md's own header says it
holds only what is OPEN; a settled item sitting there is read as live work and costs every boot.

**The reasoning archive, closed the morning of 2026-09-04.**

**🔴 The reasoning archive is not in git, and one `git clean` deletes it.** `661a1aa "Removed
   conversations"` deleted `FINDINGS.md` and `STATUS.md` from the index, and `.gitignore`'s `*.md` keeps them
   out. The repo now has a remote (`github.com:Leonhart130/claude-comm`), so **what is published is the bus
   with none of the reasoning that justifies its guards** — and this file, the only record of what is open,
   exists in exactly one working tree with no backup.

   Measured, not argued: a fresh `git clone` of this repo and `node test/attack.mjs` on it → **A27 RED, 21
   dangling pointers.** One variable moved (the ignored files), the gate byte-identical. So A27 — the gate
   whose whole purpose is "a dangling pointer is worse than none" — is green only in this working tree.

   The chat files (`REPLY-*`, `REPORT-*`, `REVIEW-*`, `BRIEF-*`) were clearly meant to go. `FINDINGS.md` and
   `STATUS.md` were collateral. **This is the owner's call and boot will keep it red until it is made:**
   re-track the two documents (`git add -f`), or state that the archive is deliberately local-only and
   change A27 so it does not claim a coverage it cannot have off this machine.


**The bus install, closed the same day.**

**✅ CLOSED 2026-09-04 — the bus is installed where the work is.** The owner's live project now carries `.comm/` with
   **leader + the site expert**; `--check` green. First install outside the project this tool was written beside.
   ⏸️ **electio is abandoned** (owner, same day); its install is left in place and harmless.
   ⚠️ Left to the owner: relaunching so the hooks bind, and whether the site expert commits its two `.claude` files.
   Narrative in `HISTORY.md`.


**selflo, uninstalled 2026-08-04.**

**selflo is UNINSTALLED** (owner's call, 2026-08-04). Backup:
   `scratchpad/selflo-comm-backup-2026-08-04.tgz`. ⚠️ Its `COORDINATION.md`, `scripts/sync-agent-files.mjs`
   and 6 `docs/START_HERE.md` **still document the bus** — an agent relaunched there before reinstall will
   follow those docs into a missing file.


**The latency narrative** (the table itself is re-derived by `node test/latency.mjs <log>`):

**🔴 Latency is a mailbox — not an interrupt.** Re-derive with `node test/latency.mjs <log>`; the table
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

## ⚠️ A trap from the same session: a trim that silently dropped an open item

Compressing the OPEN list on 2026-09-04 to get tier 0 back under its cap, I rewrote the section body in one
substitution and re-emitted three items. The list had seven. **Four were carried out to `HISTORY.md` and
`DESIGN-autonomy.md` deliberately; the autonomy mandate — the largest live item in the project — was not
carried anywhere. It simply stopped existing**, and the boot's OPEN list dutifully printed the four that
remained without any sign that a fifth had ever been there.

Caught by accident: an unrelated `assert` failed while adding a new item, because the anchor it looked for
was gone. Recovered from `git show HEAD~1`.

**The lesson is not "be careful when editing."** It is that *a list is the one structure whose loss leaves no
evidence* — a deleted paragraph shows up as a diff, a deleted list entry shows up as a shorter list that
looks complete. Every surface in this project that renders a list (`comm inbox`, `comm who`, the boot's OPEN
section) has this property, and none of them counts. Worth remembering before trusting any of them to tell
you that nothing is missing.
