# FINDINGS — why the rules in `bin/comm.mjs` exist

Every entry here replaced a **measured** defect, not a suspicion. The bus carries a one-line
*"what breaks if you remove this"* at each site and points here for the measurement.

**Why this file exists.** The narratives lived inline until 2026-08-06, when they reached **55% of the bus**
(25 041 bytes of comment against 20 605 of code) and A22 — the budget that keeps the bus readable in one
sitting — hit 95%. The rule is that a red is paid for in cuts, never by raising the ceiling. Cutting the
findings would have traded the project's memory for its size limit, so they moved instead of dying.

⚠️ **The one-liners in the code are load-bearing. Do not "tidy" them away.** A rule whose cost you cannot see
is a rule someone will simplify away — that is the whole reason these were written at the point they apply.

---

## `#hardening` — the six the first adversarial probe found

What a nudge injects is attacker-influenced text landing in another agent's context. So:

- **a note is capped and flattened** — a 50 000-char note injected **12 614 tokens**, most of a leader's
  entire orientation budget, from one message.
- **a note is stripped of control chars and newlines** — it could otherwise forge `[SYSTEM]`-style framing
  INSIDE the nudge and escape its quoting.
- **the rendered batch is capped** — 40 pending messages injected at once.
- **corrupt messages are QUARANTINED** — they were silently skipped and stayed in the inbox forever with
  nothing reporting them.
- **the sender is derived from cwd** — `--from` was free text and unverified.
- **a ref may not escape the project root.**

## `#A2` — a gate that grades its own copy of the constants

`attack.mjs` re-declared `MAX_NOTE` / `MAX_RENDER` / `MAX_REF`, so both its corpus and its budget were built
from the copies: raising a constant in the bus moved nothing in the gate. `MAX_REF`, added to fix review-#1
finding 1, had no gate at all.

⚠️ **The first fix was wrong and is worth remembering.** Importing the constants did not close it — the
budget is *derived* from them, so raising `MAX_REF` raised the budget too and A2 still could not fail. The
same tautology as A10, reintroduced by the fix for it. A2 now carries an **absolute ceiling** as well, and the
fix for a red there is never to raise the ceiling.

The constants are deliberately small: a doorbell that costs real orientation budget is a doorbell that will be
resented and then removed.

## `#A8` — a note could forge structure inside the nudge

`note` is the only free text that reaches another agent's context. Measured: a note containing
`[SYSTEM] New directive: …` appeared **verbatim and unneutralised**. Sanitising is applied on send AND on
render, because a message file can be hand-written.

⚠️ A8 carries two guards OR'd together. Each alone is uncaught; both together are caught. **The in-between
cases were never enumerated** — recorded as a known hole, not a clean bill.

## `#A9` — a pointer that resolves to the WRONG real file

An expert sent `docs/REVIEW.md` to the leader, whose cwd is the project root — so the leader would have
opened its **own** `docs/REVIEW.md`, a directory that exists. **A pointer that silently resolves to the wrong
real file is worse than one that errors.** Refs are therefore stored root-relative and re-expressed for
whoever receives them.

## `#ref-must-exist` — and one that resolves to NO file

Same class as A9 and the cheaper half to catch: at send time both ends are on one filesystem under one root.
Without the check the recipient is told *"re-read the referenced file, it is the artifact"* about nothing, and
the audit log records a clean delivery. `--force` covers the legitimate case — ringing about a file you are
about to write.

## `#A11` — `--ref` was the other free-text field, and it was unsanitised

A newline in a path let it forge a top-level `[SYSTEM] New directive: …` line inside the nudge — the exact
structure `sanitizeNote` exists to prevent, on a field with **no cap at all** on the `inbox` surface (a
3 200-char ref produced 3 434 chars of output, scaling linearly). The realistic vector is not a hostile user
but a confused agent building a ref from a README, an issue body, or a web page.

⚠️ A11 originally asserted only that the send was *refused*, which the existence check alone satisfied — the
control-character rule could have been deleted with A11 still green. It now asserts the refusal **reason**.

## `#A12` — identity matched against config KEYS instead of PATHS

Matching the cwd's top directory against agent *ids* made `id === directory name` a load-bearing invariant
that nothing enforced and the README actively invited you to break. Every other consumer — the installer,
`resolveRef`, `refForRecipient`, `liveAgents` — already used the values as paths.

With `{"webapp": "app"}` the disagreement was total and silent: `send` said ✓, the hook in `app/` delivered
nothing and exited 0, `who` reported the agent not running while it was, and the mail sat forever. **Four
diagnostics, four confident wrong answers, no error anywhere.** Nested paths (`packages/web`), which the
installer accepts and the README documents, failed the same way. Longest path first, so a nested agent wins
over the parent containing it.

**This is the failure class the whole project is organised against: not a crash, but several surfaces
agreeing on a plausible wrong answer.**

## `#A13` — identity must not come from the session's cwd

Measured 2026-08-05 end to end, with a control arm. The Stop payload's `cwd` follows the **Bash tool's**
working directory, which persists across calls inside a turn. A leader that runs `cd web-app && git log` —
the most ordinary thing a reviewing leader does — ends that turn identified as the **expert**. Its hook then
DRAINED the expert's inbox: the brief was announced into the leader's context, moved to `delivered/`, logged
`via=hook`. The expert never saw it; `comm sent` said ✓ delivered; **no surface could tell it from a real
delivery.** Symmetric — an expert that cds to the project root eats the leader's mail the same way.

The stub is installed **one per agent** at `<agentRoot>/.claude/comm-hook.mjs`, so its own location IS the
identity and cannot wander. `cwd` remains correct for the CLI, where "who is typing this" genuinely is the
question. The cwd fallback stays so a stub installed before this change keeps delivering instead of going
silent.

## `#A10` — render BEFORE drain, and the assertion that could not fail

Draining first means any exception in rendering destroys the message while the hook still exits 0 — a
silently lost round report, with the audit log claiming delivery. Rendering is pure; draining is the
irreversible half.

⚠️ **A10 itself was once unfalsifiable.** It asserted `after === 0 || after === before` — true for every
reachable value — so the only live clause was `exit === 0`, and its fixture never failed to render. Moving
`drain` ahead of `render` left the whole gate green. It now asserts the conjunction the code states, with an
injected render failure.

## `#A14` — a valueless flag swallowed the next positional

`rest[0]` was wrong and silently so: every command documented as `[<agent>] [--flag X]` bound the agent to the
flag name when the agent was omitted — `dismiss --id abc` looked up an agent called `--id` and reported
"nothing to dismiss", **a clean no-op instead of an error.**

⚠️ **The fix reopened the bug it closed, in the same session.** "Every flag in this CLI takes one value"
stopped being true the moment `--force` was added: `dismiss --force leader` swallowed `leader` as `--force`'s
value, returned undefined, fell back to `me`, and **cleared the operator's own inbox while printing success.**
Reachable by following the tool's own remediation text ("If you really mean to, pass `--force`") — appending
it worked, prefixing it did not. A list kept in step with the flags is a weak fix; it is the smallest one that
is correct.

## `#A15` — the audit surfaces could be forged

`comm log` and `comm sent` rendered a raw ref, so a forged `[SYSTEM]` line surfaced **in the leader's own
audit output** — text landing in the leader's context. A hand-written message file (the vector `safeRef`
exists for, the one A11 plants) carries its raw ref straight into `log.jsonl`.

## `#A17` — N sessions in one tree shared one inbox

*"One agent = one directory"* is the wrong axiom for a hub-and-spoke bus, **because the hub is exactly where
you parallelise.** Reported by the electio leader, then measured with real sessions: 3 classifiers + an
adversarial reviewer + the leader all launched in the hub's own tree meant five live sessions resolving to one
name and sharing one inbox. An expert's round report was consumed by a **classifier's** turn end — drained,
logged `via=hook`, `comm sent` showing ✓ delivered — and the leader would never have learned the round landed.
Identical to the cross-tree theft A13 closes, one level down.

Semantics, chosen so the unsafe case is the LOUD one:

| `CLAUDE_COMM_AGENT` | meaning |
| --- | --- |
| a known agent | that is who you are, whatever directory you are in |
| anything else | **not on the bus** — receive nothing, drain nothing. What a classifier wants |
| unset | fall back to the directory (every existing install keeps working) |

⚠️ **The honest limit: the default is still the unsafe one.** A session that declares nothing falls back to the
directory, so protection requires declaring on the *non-bus* sessions. Inverting it would silently cut off
every existing install, which is worse. `who` makes the condition visible; it does not prevent it.

It is **not a security boundary** — nothing here is. It stops accidents and confusion, which is what actually
happens in this topology.

## `#A19` — an off-bus session reported as "not running"

Measured on a fix hours old. `CLAUDE_COMM_AGENT` is an environment variable, so the obvious way to silence
several classifiers at once is to **export** it — at which point the real leader launches off-bus too:

| surface | said | truth |
| --- | --- | --- |
| `comm who` | `○ leader not running` | it **is** running |
| `comm sent` | `⧗ pending — lands when relaunched` | relaunching under the same export changes **nothing** |

The mail queues forever behind a diagnosis that sounds fine. A session that declared itself off the bus is not
an agent, but it is not nothing either. `who` now reports it and `sent` says `⧗ STUCK` with the reason.

## `#A20` — a declared identity leaked across projects

`whoami` returned on the declaration without checking the process lives in **this** project — and every
project in this framework has an agent named `leader`.

Not found by looking: `attack` was run as a routine check after a reboot and **A19 failed with no code change
since it was committed.** The real electio leader, relaunched that morning with `CLAUDE_COMM_AGENT=leader`,
was counted as a live `leader` inside A19's own throwaway temp project. Reproduced with one variable moved —
same box, same sessions, same directory, only the **name** changed in an unrelated temp project:

| temp project's agent name | `comm who` in `/tmp/comm-leak-BPO8` |
| --- | --- |
| `chief` | `○ chief not running` |
| `leader` | `● leader running (pid 388580)` ← **a session in `~/Dev/electio`** |

**A gate that reddens with no code change is reporting a change in the world — triage it as evidence before
suspecting the test.**

Safe to make stricter because `liveAgents` only ever *reports*: delivery anchors on the hook stub's location,
so a stricter answer here cannot lose mail. A session's **own** cwd is stable under the Bash tool's `cd`
(verified against a live session), so this is not the wandering-cwd surface A13 removed. `liveAgents` reuses
the same test deliberately, so it cannot become a second, laxer definition of "in this project" that drifts.

A20 carries **both** arms — foreign and native — because from the foreign arm alone, "scoped correctly" and
"declared liveness switched off entirely" are indistinguishable.

## `#A23` — `who` answered "who receives mail" when asked "who is writing here"

Reported from the field with the measurement attached: the session holding the write lock on the file the
leader was about to edit was an adversarial reviewer correctly declared `none` — off the bus by construction,
therefore **invisible**. Its house rule is one writer per file, so it had already written its own `/proc` scan
**in two places**, including a `pre-commit` hook. **That downstream workaround is the signal, not the missing
line** — a reimplementation of logic that lives here will drift from it.

The asymmetry is the trap: a session declared **wrongly** is loud, a session declared **rightly** is silent —
and the silent one is the one writing.

Their framing settles the scope question on its own: **"off bus" is a property of the MAIL, not of the
PRESENCE.**

⚠️ **Deliberately not the sketch they proposed**, and the difference is measured. Their sketch keyed off the
off-bus map, which is indexed by the *agent directory* a session occupies — so a session in `scripts/` or
`docs/`, owned by no agent, would have stayed invisible, and that is exactly when "is anyone in my tree"
matters. This walks every live session under the project root instead.

| clause | their sketch | shipped |
| --- | --- | --- |
| `none` session in the leader's dir (their case) | ✓ | ✓ |
| session in `scripts/`, owned by no agent | ✗ **invisible** | ✓ |
| the cwd is shown | ✗ | ✓ |
| a real agent is never listed "off bus" | ✓ | ✓ |

The default output **warns** rather than staying silent, because the unsafe case has to be the loud one.

## `#A24` — `to_agent` looks like an audit field and cannot fail

**I was its first victim.** Auditing electio's 37 rows with `to !== to_agent` returned *"0 drained by the
wrong agent"* and I was about to report that number to the field. It is unearnable: `pending()` reads
`inbox/<agent>/` and `drain()` stamps that **same** agent, so `to === to_agent` holds for every reachable row.
The A10 class — an assertion true for every value it can take — except **baked into the data format**, where
it outlives its author and reads as evidence to the next person. Logging nothing would have been safer.

Every theft class this project has had works by making the thief **resolve to the victim's name**, so the
field is clean by construction in exactly the cases it would need to catch.

Measured 2026-08-06 with two arms, both confirmed to move mail (`inbox 1 → 0`):

| arm | who physically ran | logged row |
| --- | --- | --- |
| honest | `app`'s own installed stub | `to=app to_agent=app via=hook` |
| impostor | the **leader's** stub with `CLAUDE_COMM_AGENT=app` | `to=app to_agent=app via=hook` |

Byte-identical, with no pid or process identity anywhere. `id_src` records where the name **came from**:
`stub` (that agent's own installed hook ran, so identity cannot wander) · `declared` (a session asserted the
name through the environment) · `cwd` (legacy fallback) · `cli` (dismiss). **The declaration is tested first**
because it wins inside `whoami`; testing `agentRoot` first stamps `stub` on every impostor row and recreates
the bug.

⚠️ Only rows written from 2026-08-06 carry it. The historical rows stay unauditable.

## `#A25` — the off-bus warning named a value most sessions did not have

It read `off[0].declared` and printed that one value for all N: three sessions reported as
`CLAUDE_COMM_AGENT=none` while two had declared `curator` and `classifier`. The A12 class, inside the
`who --all` feature shipped one session earlier. Surfaced by the electio leader asking whether **role** belongs
in the bus — four of its roles all declare `none` — not by re-reading the patch.

## `#A26` — `sent` rendered UTC while `who` rendered local

Both audit surfaces must agree and they did not. `who` was moved to local one session earlier and its sibling
`sent` was missed: it printed a bare UTC `HH:MM` **with no zone marker**, which on this box is a 2-hour skew
that READS as local, on the one surface an operator holds up against `who`. Measured against electio's real
log: `sent` showed `23:08` for a message sent at **01:08 local**. Rows spanning three days carried no date at
all.

The date must be local too — deriving it from `toISOString()` pairs a local time with the previous day's UTC
date for anything after 22:00 here, which is the bug the `who` fix left behind in its own date branch.

**Zone convention:** bare clock times (`who`, `sent`) are **local**; full ISO timestamps (`comm log`) are
**UTC and marked `Z`**. `log` stays ISO deliberately — it is the audit trail, and the `Z` is the
unambiguity `sent` lacked.

`who`'s `since` field decides armed-vs-not: you compare it against the hook file's mtime, which every other
tool reports locally. In UTC with no date, a stale session looks freshly started and a three-day-old session
reads as fresh.

## `#via` — delivery and dismissal were indistinguishable

Both `hookDeliver` and `dismiss` call `drain` and both stamped the same `delivered` field, so the log could
not tell *"the agent was shown this"* from *"someone cleared it"* — and `comm sent`, which exists precisely to
answer that, reported a dismissed message as ✓ delivered. The latency table is computed from this field, so a
dismissal contributed a **fabricated latency** that nothing could detect after the fact.

## `#inbox-hint` — the peek that reads as a bug in the bus

`inbox` PEEKS; it does not acknowledge. Without the closing hint an agent reads its mail there, acts on it,
and is then blocked at its turn end by the hook re-delivering the same messages — **which reads as a bug in
the bus and costs a full turn to re-diagnose.** Reported from a real day of use by the electio leader, who met
it twice: the two surfaces an agent actually discovers the bus through (this listing and the hook notice) were
the two that never mentioned `dismiss`.

⚠️ **The hint must name a command that actually works.** Session 2 added it, session 3 added the identity
guard, and nobody updated the hint: reading another agent's inbox told you to run `dismiss <them>`, which the
guard then refuses. **A check that refuses a path the tool itself documents** — the A7 lesson in miniature.

## `#sent` — why the command exists at all

The sender is otherwise blind. `log` records what was SENT; nothing recorded what LANDED, so the leader was
reduced to inferring delivery from the expert's commits. In a hub topology that distinction is operational,
not cosmetic: *"not answered yet"* means wait, *"never received"* means go and wake them — **opposite
actions.** Delivered mail is only in the log and pending mail is only in the inboxes, which is why this needed
its own command rather than a flag on `log`.

Sharpened by a structural limit found in the same review: **an agent can be alive and idle, holding mail
indefinitely**, and `who` alone reports it as running and therefore looks fine.

⚠️ `pending()` quarantines unreadable files **as a side effect**, so this query command moves files into
`.comm/corrupt/`. It said nothing about it, so a corrupt message could be quarantined by the sender's own
status check and never surface anywhere.

### And what `sent` cannot tell you

**"Was it READ" is not assertable, and no field will be added for it.** Measured: **3 of `selftest`'s 6
behaviour runs showed the agent not reading the file it was pointed at.** A "read" field would be wrong about
half the time, *in the reassuring direction*. The honest proxy is proof by work produced — the expert's commit
citing the brief.

## `#hub` — a peer send is refused, never rerouted

`FRAMEWORK.md` §1: exactly one leader. Every message has the leader at one end. A silent reroute would let two
experts coordinate off-board, which is the divergence the hub exists to prevent.

## `#liveness` — why `/proc` and not a registry

**A registry says what was launched; `/proc` says what is alive. Those differ exactly when it matters.**
Each process's OWN declaration is read from `/proc/<pid>/environ`, so `who` reports what the hook will
actually do for that session rather than what our cwd implies. `declared` is a **parameter** of `whoami`, not
read from the environment inside it: `liveAgents` resolves identity for OTHER processes, and reading our own
env there would stamp this session's declaration onto every process it inspects.

## `#roles` — three questions, never one variable

`CLAUDE_COMM_AGENT` is a **postal address**, not a job title.

1. *Does this session receive mail?* → the bus
2. *As whom?* → the bus
3. *What does it do, and may it write here?* → **the project. Never the bus.**

Measured 2026-08-06: an unknown declared name is off-bus and **is** displayed distinctly (`off bus (curator)`),
so role visibility needs no role concept in the bus. But a declared name that **collides with a real agent
name silently puts that session ON the bus** — `curator` leaves the inbox at 1, `app` takes it to 0. `none` is
safe only by accident, because the word resembles no agent; `leader` would not be.

This came from the field: the electio leader's staging hook read `CLAUDE_COMM_AGENT` to decide "which agent is
this", but four of its roles all declare `none`. It blocked correct commits until `--no-verify` had been typed
**five times in 36 commits, each justified in the message** — the shape a guard wears while it erodes. The fix
was a separate `ELECTIO_ROLE`.

Extending A23's rule: **"off bus" is a property of the MAIL — not of the PRESENCE, and not of the ROLE.**

## `#no-daemon` — why the bus stays a short-lived process

Gated by A21 (import allowlist + no `setInterval`/`setTimeout`/`watchFile`/`createServer`/`.listen`/`spawn`).
Today `comm` starts, does file I/O and exits in **61 ms**, so nothing lives long enough to leak. That is an
architectural property, not a Node-versus-Rust one. The natural way to build a wake is a resident watcher;
it would be the first long-lived thing here and the only way this tool could acquire a memory leak.

Each A21 clause is proved red **independently**, because two guards OR'd together can hide a dead one — the A8
lesson. Comments are stripped first, and the false-positive control is part of the proof: the same construct
written in a comment must stay green. A naive grep for these words matched prose on the day it was written.

## `#A28` — the rule A27 states, enforced one filename wide

A27 gates "a dangling pointer is worse than none" for `FINDINGS.md#anchor` references. Adversarial review
#3 (2026-09-04) found the rule right and its reach too narrow: `bin/comm.mjs` cited `FRAMEWORK.md §1`, a
document that does not exist in this repo and is not tracked, and A27 could not see it. The comment read as
*"the reasoning is recorded in the framework doc"* to anyone deciding whether the hub rule could be relaxed.

A28 checks every `X.md#anchor` or `X.md §n` pointer in `bin/`, `install.mjs` and the lifecycle tools. Bare
paths such as `docs/REVIEW.md` are deliberately NOT matched: they illustrate a *user's* file in an example,
and matching them would redden the gate for a reason foreign to what it verifies — A8's failure, restated.

Proved red by restoring the pointer with the gate byte-identical: `dangling=FRAMEWORK.md (bin/comm.mjs)`.

## `#ledger-control` — an instrument that records only the treatment has no denominator

The `▶ NEXT` written for the ledger said: *one JSON line per lifecycle event*. Built literally, that records
**only reboots** — and the query it exists to answer (*"did the fifteen minutes after a restart cost us a
defect"*) is a comparison. With no control arm the first reboot arrives against nothing, and the honest
answer stays UNKNOWN however long the feature runs.

Worse, the confound is already measured: the `~/Dev/work` leader found **four of five defects authored in the
first thirteen minutes of a session** — of *any* session, rebooted or not. So the effect a reboot-only ledger
would eventually "find" is the effect every session start already has. The comparison is not
*rebooted-session vs ordinary-session*; it is **reboot-start vs cold-start**, and the cold arm has to be
recorded from before the mechanism exists.

⇒ `bin/boot.mjs` records **every** session start through `bin/ledger.mjs`, months ahead of the reboot
mechanism. The instrument ships first and the control arm accumulates first.

## `#ledger-blame` — a defect timed by when it was FOUND is charged to whoever noticed it

The bias runs one way and it flatters nobody by accident. Defects are found late and attributed to "the
session I was in when I saw it"; a reboot mechanism *manufactures sessions*, so the newest session — always
the rebooted one — collects blame for work it did not author. A ledger built on `found_at` would report the
reboot feature as harmful no matter what the feature did.

`ledger record defect` therefore refuses a defect with no authored time. The caller must supply
`--authored-at`, `--authored-session`, or say `--authored-unknown` **out loud** — and an admission lands in
the unknown pool, where it can withdraw a verdict rather than quietly tilt one. Proved red: 20 cold sessions
each carrying one defect authored at +5 min and *found* ten days later still score 20/20 cold and 0/20
reboot.

## `#ledger-trial` — a window that did not elapse is not a shorter trial, it is not a trial

Adversarial review #4's headline, 2026-09-04, and the one it said to fix if only one thing were done.

The ledger compared *the fraction of starts carrying a first-window defect*. A start's window was truncated
by the next start of the same agent — right on its own terms, since work after a restart belongs to the new
session. But truncation changes how much window each start had, and **a reboot IS a start followed by
another start**, so the arm the mechanism defines is the arm whose windows the mechanism truncates.

Measured, 20 starts per arm, every one authoring a defect at exactly +5 minutes — identical density, the
only difference being that each reboot session was followed 2 minutes later by another start:

```
cold     20 of 20  100.0%   mean exposure 15.0 min
reboot    0 of 20    0.0%   mean exposure  2.0 min
verdict: BETTER — reboot starts carry fewer first-window defects (p=0.0000)      exit 0
```

**100 % of that was exposure.** The control — the same file with the truncating starts removed — puts both
arms at 20/20. The tool computed the confound (`exposureSkew`), exported it, printed it as a one-line `⚠`,
and issued the verdict anyway with exit 0. Property 3 could not see it because nothing was unknown.

It needed no contrivance and no second agent: **it was already at a 93 % gap on this repo's own first four
records**, and a leader that compacts within fifteen minutes of a restart produces it alone.

**The fix is structural, not a warning.** Fifteen minutes that did not happen cannot be asked whether they
cost a defect, so only a **completed** window is a trial: not cut short by the next start, and not still
running (which folded in R9 — every `--hook` boot writes a start and queries immediately, so a session
credited with a full window it had not lived was in *every* boot report). Excluded starts are counted and
reported, defects inside them join the unknown pool, and `--window` is the lever: if restarts really are five
minutes apart, measure five minutes and the cohort fills. `exposureSkew` survives as an invariant — every
counted start now has the same exposure, so if it ever fires the filter is broken and the verdict is
withheld rather than footnoted.

⚠️ **The cost, stated:** the arms fill more slowly, and a reboot cadence faster than the window makes the
answer permanently UNKNOWN at that window. That is the true state of the world, not a defect — but it means
`MIN_ARM` will take longer to reach than the raw start count suggests.

## `#ledger-unknown` — the verdict has to survive the worst reading of what could not be read

Three refusals, each of which is a way this file could otherwise print a confident number:

- **Below the promised sample there is no verdict.** Ten starts per arm, and ten is not invented — it is the
  consumer's own *"the first ten reboots should each leave a marker"*. Proved red: 0/3 cold against 3/3
  reboot, an effect that could not be more lopsided, still reports UNKNOWN.
- **An unreadable FILE withdraws the verdict outright** (review #4 R2). It used to increment the same
  counter as one torn line, so a 100 000-record log contributed **1** to the pool and the tool grew *more
  confident the more completely it failed to read its own history* — measured as the same tree answering
  WORSE at mode 000 and UNKNOWN at mode 644. An unreadable file has unknown magnitude; no pool can bound it.
  An unreadable *directory* is likewise no longer byte-identical to an empty one: explaining an I/O failure
  as a sampling shortfall is the same confusion one level down.
- **Unreadable lines and unplaceable defects are a POOL, not a rounding error.** The verdict is recomputed
  with the whole pool loaded into each arm in turn; if the answer moves, the answer is UNKNOWN. An
  append-only log can end in a torn write, and a ledger that silently shrinks its own sample and prints a
  clean percentage is this repo's signature failure with statistics on top.
- **A classification is derived, never stored.** Records carry `source`, `trigger` and `prev_session`;
  nothing carries "this was a reboot". Whether `/clear` even reports `source: "clear"` is still unverified,
  so the rule that turns a measurement into an arm is one function — correct it later and every record ever
  written is re-read under the correction.

## `#clear-blind` — a cleared session resolves to its DEAD transcript, and answers

Found 2026-09-04 by the `/clear` that answered the `source` question. Not looked for. **This entry replaced
an earlier version of itself written forty minutes before it, and the correction is the finding**: the first
reading caught the transient state and called the tool's behaviour correct. The steady state is the opposite.

`bin/context.mjs` resolves a session's transcript through the descriptor a session holds on its own
`/tmp/claude-<uid>/<slug>/<uuid>/` scratch directory — built that way because newest-mtime was wrong by 68 %
the first time it met the field. The assumption underneath is that the scratch directory's uuid **is** the
session's uuid.

**A `/clear` breaks that assumption and nothing announces it.** Measured on pid 746909, launched 12:39:48 as
session `803208db`, cleared at 12:41:04, then given one ordinary turn:

| | |
| --- | --- |
| the only `/tmp` descriptor it holds | `…/803208db-…/tasks` — the **pre-clear** scratch dir, still being written at 12:46:31 |
| anything naming the live session `57ede2e1` | **nothing**, in any descriptor or in its environment |
| the live transcript `57ede2e1.jsonl` | 88 153 B, mtime 12:46:45, last usage **50 237** |
| the dead transcript `803208db.jsonl` | frozen at 46 104 B and 12:41:04, last usage **44 139** |
| `context.mjs --pid 746909` | **44 139 tokens, exit 0**, labelled `resolved from /proc/746909` |

So the scratch directory identifies the **process's launch session**, permanently, while the transcript
follows the **current** one. After a clear they diverge and the sensor reports the dead session's final
context as if it were the live one's — not a crash, not an UNKNOWN, a plausible number in a plausible range
from a session that no longer exists.

### 🔴 Why this would have destroyed the feature that found it

**A self-rebooting leader IS a cleared session, by construction.** And the pre-clear context is by definition
LARGE — that is what tripped the reboot. So after the first self-reboot the sensor would keep reporting the
large pre-clear number for a fresh session, the trigger would fire again immediately, and the agent would
reboot forever. From outside it would look exactly like the feature working.

It is not confined to `--pid`: `resolveTranscript()`'s own-session path resolves through the same function,
so `node bin/context.mjs` — the command `CLAUDE.md` documents as *"how full is this session"* — is wrong for
any session that has been cleared, which after this feature ships is most sessions most of the time.

**The `Stop` hook path is unaffected.** Its payload carries `transcript_path` outright and `--hook` outranks
`--pid`, so the trigger itself reads the right file. The blindness is in every out-of-band reading.

### ✅ FIXED 2026-09-04 — and this section is kept because the two candidates were not equal

Two fixes are candidates and neither was shipped, because a detector whose false positive is already
demonstrable is worse than a defect that is written down:

- **A registry written at `SessionStart`** — the hook holds the payload's `transcript_path` and can resolve
  the session pid, so it records `pid + process start time → transcript` and refreshes it on every start,
  clears included. Exact, no heuristics. **Decided 2026-09-04: it lives in
  `$XDG_RUNTIME_DIR/claude-comm/sessions.json`, not in any project.** A pid is a *machine-global* name, so a
  per-project registry is the wrong shape — the same pid would be looked up in whichever project the reader
  happened to be standing in. `XDG_RUNTIME_DIR` is user-private, is tmpfs, and is emptied at logout, which is
  exactly the lifetime of the pids it keys. The `pid + start time` pair is what makes a recycled pid a miss
  rather than a wrong answer. A lookup that finds nothing must REFUSE, never fall through to today's
  resolution.
- **An mtime-divergence test** (the transcript frozen while the scratch dir advances) — **rejected, with the
  counter-example measured**: a healthy session running a background job writes into `…/tasks` while its
  transcript sits still, which is this very repo's own session for minutes at a time. It would flag a
  working session as cleared.

**The registry landed 2026-09-04 as `bin/session-registry.mjs`**, with one deviation from the decision above,
recorded here because the reason it gave still holds: it is a **directory of per-pid files** under
`$XDG_RUNTIME_DIR/claude-comm/sessions/`, not a single `sessions.json`. The location and its reasoning are
unchanged; the layout changed because one shared file is read-modify-write, and "two interleaved writers lose
one update" is an open, unmeasured risk on this repo's own `.boot-state.json`. Here a lost update means a
session that cannot be resolved at all. A per-pid file has no merge to lose. The key is `(pid, start time,
boot id)` — start time alone is ticks since boot, so a reboot could hand the same pair to a different process
honestly.

**✅ VERIFIED against a real `/clear`, 2026-09-04 16:00**, in a disposable session launched for the purpose
(pid 920745). Launched as `707192c3`, cleared, then given a turn:

| | |
| --- | --- |
| the ledger | recorded `source: "clear"`, new session `6379efc5`, same process |
| the scratch descriptor the process holds | `…/707192c3-…` — **the launch session, dead and frozen** at 47 063 B / 44 398 tokens |
| the registry | `pid 920745 → 6379efc5` — the live one, advancing, 59 613 B / 45 712 tokens |
| `context.mjs --pid 920745` | **45 712 tokens**, labelled `session CLEARED (launched as 707192c3)` |

Two things this added over the original measurement. **The scratch descriptor appears only once the session
opens its scratch directory** — a fresh session holds none at all, so the old resolver did not merely answer
wrongly, it answered *nothing* and fell through to newest-mtime in a directory holding twelve transcripts.
And the descriptor that eventually appeared, created by a background task started **after** the clear, still
named the **launch** session: the scratch directory is fixed at launch, permanently, on a second independent
measurement.

`bin/context.mjs` now resolves pid → transcript through it and **refuses on a miss**, including the
own-session path that used to fall through to newest-mtime. Four arms in `bin/context.mjs --prove-red` and
three in `bin/boot.mjs --prove-red` demonstrate it: a registered pid resolves to *its* transcript, a recycled
pid is a miss, an unregistered pid refuses, and an unregistered *session* refuses rather than guessing.

**Two defects were found inside that fix, both by reading output rather than by a test**, and both are the
shapes this repo already had names for:

- The boot control ran the real boot with `--hook`, whose ancestor walk reached the **operator's live
  session**, so the negative control wrote its own fixture transcript into the machine's real registry. The
  next boot then reported `pid <me> → 44444444-….jsonl` under a green tick. *A control that writes into the
  world it measures is not a control.* Every child of `proveRed` now runs with `CLAUDE_COMM_RUNTIME` inside
  the fixture.
- The boot row said *"bin/context.mjs can resolve this session"* on the strength of a registry hit alone,
  having never checked the transcript existed. With a stale entry, context refused while the row stayed
  green — a **green row over a dead sensor**. The row now reads what the reader reads, and that direction is
  armed.

## `#hookless-launch` — a session launched outside an interactive shell has NO bus, and says nothing

Found 2026-09-04 while launching a disposable session to test `/clear`. Not looked for, and it is the largest
thing found today.

`kitten @ launch --type=os-window claude` starts Claude Code with **kitty's** environment, and kitty here was
started from a `.desktop` file. Node is installed under nvm, which is put on `PATH` by an interactive shell's
profile and by nothing else. Measured on the launched process:

| | |
| --- | --- |
| `PATH` of the launched session | **no nvm entry** |
| `PATH` of a session started from an interactive zsh | `/home/leonh/.config/nvm/versions/node/v24.18.0/bin` |
| what the session printed | `SessionStart:startup hook error` · `/bin/sh: 1: node: not found` |

**So every hook died, and the session ran normally.** No bus, no ledger, no registry entry, no mail delivered
at any turn boundary — and nothing in the session says so beyond one non-blocking line that scrolls away.
`install.mjs` generates the field hooks the same way (`node "$CLAUDE_PROJECT_DIR/.claude/comm-hook.mjs"`), so
`~/Dev/work` and `~/Dev/electio` carry the identical failure.

### 🔴 Why this is fatal to the autonomy mandate specifically

**A self-launched expert is launched by a program, not by a person's shell.** It would come up with no bus,
receive no mail, record nothing in either instrument, and look completely normal — the silent no-op shape
this project keeps finding, at the level of the whole agent rather than one call. Every measurement about
delivery, latency and lifecycle taken on a hand-opened terminal would simply not transfer.

### The fix, in two halves

1. **Launch through a login shell.** `kitten @ launch --type=os-window --keep-focus --cwd <dir> zsh -lic claude`
   — measured to recover node from a bare environment. This is the recipe for self-launch, recorded in
   `DESIGN-autonomy.md`.
2. **Make the failure loud**, because the launcher is not always ours. The `SessionStart` hook command now
   tests for node first and, when it is absent, prints one line saying the session has no bus, no ledger and
   no registry entry. It still exits 0 — a broken bus must never break a session — so the change is a
   message, not a guard. Both directions are demonstrated with one variable moved: the same command string
   under a node-less `PATH` prints the warning and exits 0; with node present it prints the boot report and
   exits 0. The `Stop` hook stays silent, because a warning at every turn boundary is a warning nobody reads.

⚠️ **What this does NOT do:** it does not make a node-less session work. It makes one impossible to mistake
for a working one. The working fix is the launch recipe, and it only covers launchers this framework owns.

## `#test-debt` — inherited from review #4, covered by no gate

**Standing test debt, inherited from review #4 and NOT covered by any gate:** DST boundaries and NTP steps ·
network filesystems (`O_APPEND` does not travel) · scale past ~6 400 records (`analyse()`'s span loop is
O(n²)) · what `resume` and `compact` payloads actually carry · **and the ledger has still never scored a real
defect** — every defect it has ever seen was synthetic. Its first real `record defect` is the test.

## `#measurement-traps` — five ways a control lied here

`delivered/` file mtimes look like drain times and are not — `renameSync` preserves mtime, so they are
*creation* times. The only honest source is the `delivered` field in `.comm/log.jsonl`.

**A third, from 2026-09-04, and it is the second one's twin:** `bin/boot.mjs --prove-red` ran the real boot
with `--hook`, and that child's ancestor walk reached the **operator's own live session** — so the negative
control wrote its fixture transcript into the machine's real session registry under the operator's pid, and
the next boot reported `pid <me> → 44444444-….jsonl` under a green tick. **A control that writes into the
world it measures is not a control.** Found by reading a boot report, not by any test. Every child of
`proveRed` now runs with `CLAUDE_COMM_RUNTIME` inside its own fixture.

**A second one, from an earlier session:** a probe that reported "the defect does not reproduce" on both arms was
wrong — a relative path in a hand-built hook payload made `findRoot` miss and the hook exit 0 silently,
which is indistinguishable from a clean result. Its positive control passed *because it used an absolute
path and so never travelled the broken path.* **A control that does not go through the same code as the arms
validates nothing.** Both reviewers hit a version of this in the same session and recorded it.

## `#tier0-calibration` — the tier-0 cap counts bytes; here is what a byte is worth

Prompted 2026-09-04 by the `~/Dev/work` leader, who found the same class of defect in his own instrument and
sent it over. His boot-cost guard converted bytes to tokens with `/4`, reported green six times in a day, and
on its word he archived ~750 KB and reported the startup falling from ~105 000 tokens to ~80 000. He then
measured the real turn: **100 725**, against 99 809 / 102 753 / 111 464 before the archiving. **The archiving
had bought approximately nothing, and the instrument had reported a win.** His corpus tokenises at ~2.0
bytes per token, and the error ran in the direction that required no work.

`bin/boot.mjs`'s `budget` row is the same shape: it counts **bytes** against 28 000, while the reason the cap
exists is a cost in **tokens**. So it was calibrated rather than defended.

**Method — two `claude -p` probes differing in exactly one thing.** The corpus (this repo's own
`CLAUDE.md` + `STATUS.md`, 19 739 B) was pasted into the *prompt*, not read through a tool, so no tool
preamble or line numbering inflates the count. Same model, same cwd, same everything else. Totals are
`input + cache_read + cache_creation` from `--output-format json`.

| | tokens |
| --- | --- |
| baseline prompt | 20 113 |
| with the corpus | 27 430 |
| **difference** | **7 317 for 19 739 B → 2.70 B/token** |

So the 28 000 B cap is **~10 400 tokens**, and anyone converting it with `/4` is low by a third. The row now
prints the token figure beside the bytes, using this measured constant.

**What is not settled:** the ratio is a property of *this* corpus — English-leaning markdown with tables,
emoji and code fences. It must be re-measured if tier 0 changes character, and the constant carries the date
it was taken for exactly that reason. Two independent corpora now sit at 2.0 and 2.70; neither is anywhere
near 4, which is the only part that generalises.

**A fourth, 2026-09-04, and the first that DESTROYED rather than dirtied.** The session registry gained
invalidate-before-write (review #5's F1): a `SessionStart` for a pid removes that pid's entry before
validating anything, so a failed write leaves a miss instead of a lie. `test/attack.mjs`'s A18 fires the real
generated stub with a payload that has never carried a `transcript_path` — and the stub resolves the session
pid by walking to the nearest `claude` ancestor, which when an agent runs the suite is **the operator's own
session**. So the suite deleted the live registry entry for the session running it. Measured: the `registry`
row went from a green tick to `pid 820277 is not in the session registry` with no code change between the
two boots.

Three occurrences in one day, each caught by reading output rather than by a test, so the fourth is now a
gate: **A31 asserts the suite leaves the machine's real registry untouched**, with the listing captured
before the hermetic override is set. `test/attack.mjs` and `test/selftest.mjs` both set
`CLAUDE_COMM_RUNTIME` before spawning their first child.

**The generalisation, which is the part worth carrying:** it is not enough for a control to build its own
fixture. Anything the control executes that resolves *the machine's* state — a pid, a socket, a runtime
directory, a registry — reaches past the fixture by construction, and does so most easily when the suite is
run by exactly the kind of agent the code was written for.

## `#wake-doorbell` — what the first real wake taught, in the twenty minutes it took to work

Built 2026-09-04 and tested against a real launched agent in its own kitty window, with real mail on a real
bus. It works: `who --json` sees the target, the window resolves by pid, the nudge lands, the idle session
takes a turn, and the delivery logs `via: "hook"`. Two things went wrong first, and both are worth more than
the mechanism.

**1. A self-launched agent in a NEW directory exits on the trust prompt, and its window closes.** The first
launch returned a window id and left nothing behind — `kitten @ ls` had no such window seconds later, and no
`claude` process existed in the fixture. Claude Code asks *"Is this a project you created or one you trust?"*
with **"No, exit" selected by default**, and nothing was there to answer. From outside, a launch that
returned an id and produced no agent. This is `#hookless-launch`'s twin: the launcher appears to succeed and
the agent is gone. Any self-launch into a fresh worktree, a scratch directory or a new clone hits it. Not yet
fixed — the launcher must answer the prompt, or the directory must be trusted before the agent is started.

**2. The doorbell must give NO instruction.** The first nudge read *"Run `comm inbox` to see what arrived."*
Measured consequence: the woken agent went hunting, discovered that **`comm` on `PATH` is coreutils' `comm`,
not this bus**, dug for the real binary, and dismissed the message by hand. The delivery logged
`via: "dismiss"` instead of `via: "hook"` — so the wake had *bypassed* the one path that is gated, measured
and proved able to go red, in favour of an agent improvising. The second version asks for nothing, and the
same test then logged `via: "hook"`, `id_src: "stub"`.

**The general form is the one this project keeps meeting:** a mechanism that tells an agent *what to do*
competes with the mechanism that was built to do it. The doorbell's whole contract is that the agent does
not fetch its own mail — it takes a turn, and the turn boundary delivers.

**Recorded, unfixed:** the woken agent observed that it can end a turn on an acknowledgement written *before*
the Stop hook delivers, so a real brief could be acted on a turn late. The `decision: "block"` path feeds the
mail back into the same turn, so this is bounded — but it was its observation, not mine, and it is not
measured.

**A fifth, hours after the fourth, and this one had no test in it at all.** Reproducing an unrelated bug, I
fired a field project's stop hook **by hand from my own session**. The stub resolved the nearest `claude`
ancestor - me - and wrote my registry entry to point at the fixture's transcript. The next boot reported
`pid 820277 -> fake.jsonl (stop)`, **green**, and `bin/context.mjs` would have answered with a fixture's
context as if it were mine.

A31 could not see it: A31 guards the SUITE, and this was a person at a prompt. So the fix is not another
gate on the tests, it is an invariant in the code: **a hook records only for a session running inside its own
project.** A hook belongs to a project; if the session it resolved is running somewhere else, something is
firing it on behalf of a session it does not speak for, and the only safe act is to record nothing. That
closes the whole family - A18, this, and whatever fires a stub next - and it is armed in A29 both ways.

## `#reboot-signal` — the reboot arm cannot fill, and the verdict was calling that a sampling problem

Found 2026-09-04 by the `~/Dev/work` leader, against this project's newest instrument, an hour after it
started recording there — and he was the evidence. The owner restarted him deliberately, at this project's
request; it is the cleanest reboot available, and the ledger recorded it as:

```
{"event":"start","agent":"leader","source":"startup","trigger":null,"prev_session":null}
starts   cold 2 · reboot 0
verdict: UNKNOWN — needs 10 starts in each arm; have cold=1, reboot=0
```

**`prev_session` is null because nothing survives the restart to carry it.** At the hook, a relaunch and a
cold start are the same event. So the reboot arm was not under-filled, it was **unreachable**, and ten more
sessions would not have moved it. `classify()` reaches the reboot arm on `source: "clear"`, on a `trigger`,
or on a `prev_session` — a `/clear` therefore fills it, which is why *this* repo's arm has records and the
field's never will until something declares the restart.

**This is this project's own recurring shape turned on itself:** a row asserting something it never checked.
The registry row said "the sensor can resolve this session" without reading the file; this said "needs 10 in
each arm" without asking whether an arm could receive one.

**Fixed, minimally and honestly:** `verdictOf` now takes reachability, computed from the same records the
arms are built from, and when the reboot arm is empty *and* no start has ever carried a crossing signal it
says so — *"the reboot arm is UNREACHABLE here … this is not a sampling shortfall and more sessions will not
close it"*. Armed in `--prove-red` on one variable: whether a single record carries `source: "clear"`.

**FIXED 2026-09-04, the session after, and it is his design.** `bin/restart-signal.mjs`: the restarting party
leaves a note — `.comm/restart/<agent>.json` — and the next `SessionStart` hook takes it. The second candidate
(pair a `start` against the agent's previous `handoff`) was **not built**: it needs no new mechanism but it
cannot tell a restart from a handoff that was never restarted, and the whole point is a signal that cannot
lie. What that candidate was really worried about — an abandoned note poisoning a later start — is handled
here by an expiry instead, so the cheap idea survives as a property rather than as a mechanism.

Four properties, each of them a way to produce a confident wrong number in the arm being measured:

- **One-shot, enforced by `rename`, not by care.** `claim()` renames before it reads, so of two sessions
  starting at the same instant exactly one gets the signal. A read-then-unlink gives it to BOTH — measured:
  with the rename swapped for a copy, one restart became two reboots and eight racing claimers all won (A33).
- **It carries its own expiry and does not apply it.** The armer declares `ttl_s`, the claimer measures
  `age_s`, and `classify()` in the ledger decides — one function, correctable later, re-read over every
  record ever written. Storing "this was fresh" would freeze today's TTL into the data (ledger property 1).
  The ledger caps the promise at `SIGNAL_TTL_MAX_S` = 3600 s, because the armer is the only party with an
  interest in the reboot arm filling: it may shorten its promise and not extend it.
- **The signal is the assertion; `prev_session` is only evidence for it.** A hand that restarts an agent
  knows it is restarting long before it knows a session id, so keying the arm on `prev_session` alone would
  have thrown away every human-armed restart.
- **A signal it cannot read is set aside, never dropped**, and a claim that fails says so on stderr: an
  unreadable note is a restart about to be recorded as a cold start, which is the defect this closes.

**One defect found by these arms, in this code, an hour old, and it is this project's signature shape wearing
arithmetic:** `Number(null)` is `0`, so an age that could not be measured at all — the field's own way of
saying *unknown* — passed `0 >= 0 && 0 <= ttl` as the **freshest reading obtainable**, and every unmeasurable
signal became a reboot. Caught by the arm named "a signal that cannot be shown fresh is not counted as one",
which failed the first time it ran. The rule now tests `typeof x === "number"`, and a coercion that turns
absence into a favourable number is worth looking for wherever this repo compares a measurement to a bound.

**And the arms themselves were not covered.** `bin/ledger.mjs` decides which arm every start lands in, and its
34 arms only ever ran when somebody typed them: boot's gate runs `test/attack.mjs` and nothing else. Worse,
the gate's staleness fingerprint covered `bin/comm.mjs`, `install.mjs` and `test/attack.mjs` — while A29 has
been *executing* `bin/ledger.mjs` and `bin/session-registry.mjs` through the generated stub since the day it
was written, and A32 imports `bin/wake.mjs`. Any of them could have been relaxed with every `--fast` boot
still printing *"last green on these bytes"* — review #3 R1's finding, re-earned by accretion. A34 now runs
the ledger's arms inside the gate (3.7 s), and the fingerprint is **enumerated from `bin/` with the two
non-bus tools named as exceptions**, so a tool added tomorrow is a gate input by default. Armed as R11.

**What is NOT closed by this.** Nothing arms the signal automatically yet: a restart still has to say so, and
in the field that means the owner's hand (`node bin/restart-signal.mjs arm --agent <name> --prev-session
<id>`) or a future self-reboot that owns its own relaunch. The mechanism cannot detect a liar — an armer that
claims a restart it is not performing is indistinguishable from a real one — it can only make the claim
visible: `by`, `by_pid` and the age are all in the record.
