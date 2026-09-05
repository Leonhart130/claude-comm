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

### 🔴 CORRECTED 2026-09-05: the fix was written as "a login shell" and that is FALSE here

The `~/Dev/work` leader was told to use window-launching for his own work, applied what this section said,
and measured it failing. He is right, and the reproduction on this machine is two commands:

```sh
grep -n nvm ~/.zshrc        # 114-115: NVM_DIR, then . "$NVM_DIR/nvm.sh"
ls ~/.zprofile ~/.zlogin    # neither exists
```

**nvm is loaded from `.zshrc`, which a LOGIN shell never reads** — `zsh -l` sources `.zprofile`/`.zlogin`,
and there are none. Only an INTERACTIVE shell sources `.zshrc`. Measured with one flag moved, and with a
positive control so that ABSENT means absent rather than a broken probe:

| launcher | `command -v node` |
| --- | --- |
| `zsh -c` | **ABSENT** |
| `zsh -l -c` — *what this section told people to do* | **ABSENT** |
| `zsh -i -c` | `/home/leonh/.config/nvm/versions/node/v24.18.0/bin/node` |
| `zsh -lic` — *the recipe as actually recorded* | same, **and it works because of the `i`** |
| control: `zsh -c 'command -v ls'` | `/bin/ls` — the probe can find things |

⇒ **The RECIPE was right and the EXPLANATION was wrong**, which is this project's signature defect in its
most expensive form: the recorded command carries `-lic` and works, the prose credits `-l`, and a reader who
applies the prose gets a launch that **returns a window id and looks like it succeeded** while every hook in
it is dead. He named the cost exactly: *"whoever applies your fix gets the failure the fix was meant to
remove, plus the conviction of having repaired it."*

### The fix, in two halves

1. **Launch through an INTERACTIVE shell** — `-i` is the flag that does the work; `-l` is inert on this box
   and is kept only because `-lic` is what was measured end to end.
   `kitten @ launch --type=os-window --keep-focus --cwd <dir> zsh -lic claude`. Recorded in
   `DESIGN-autonomy.md`.

   🔴 **And this is a per-workstation rule, not a framework rule** — his objection, and it is correct: it
   depends on what a particular `.zshrc` happens to load. **The rule to build instead is his: the launcher
   RESOLVES `node` and `claude` to absolute paths before launching and REFUSES when resolution fails** —
   the same shape as the doorbell, which resolves by pid and refuses rather than hoping (`#wake-doorbell`
   rule 1). A launcher that cannot find the runtime must not return a window id.
2. **Make the failure loud**, because the launcher is not always ours. The `SessionStart` hook command now
   tests for node first and, when it is absent, prints one line saying the session has no bus, no ledger and
   no registry entry. It still exits 0 — a broken bus must never break a session — so the change is a
   message, not a guard. Both directions are demonstrated with one variable moved: the same command string
   under a node-less `PATH` prints the warning and exits 0; with node present it prints the boot report and
   exits 0. The `Stop` hook stays silent, because a warning at every turn boundary is a warning nobody reads.

⚠️ **What this does NOT do:** it does not make a node-less session work. It makes one impossible to mistake
for a working one. The working fix is the launch recipe, and it only covers launchers this framework owns.

⚠️ **And what is still unmeasured, in his words rather than mine:** *"the green in case 3 is a green on the
`PATH`, not on the hooks."* Nobody has started a REAL self-launched session and then run `comm who` against
it, or watched `.boot-state.json` increment. Reaching the binary is not being on the bus. He has the
workstation and has offered to run that control.

## `#test-debt` — inherited from review #4, covered by no gate

**Standing test debt, inherited from review #4 and NOT covered by any gate:** DST boundaries and NTP steps ·
network filesystems (`O_APPEND` does not travel) · scale past ~6 400 records (`analyse()`'s span loop is
O(n²)) · what `resume` and `compact` payloads actually carry · **and the ledger has still never scored a real
defect** — every defect it has ever seen was synthetic. Its first real `record defect` is the test.

**Moved out of STATUS.md 2026-09-04 when tier 0 hit its cap — cut from the capped file, kept here, because
a caveat deleted is a caveat retracted and neither of these has been measured:**

- **A8's two guards under partial mutation.** Each alone is uncaught, both together are caught; the
  in-between cases were never enumerated.
- **Behaviour when an agent is mid-TOOL-CALL** rather than mid-turn. Still unexercised, on every delivery
  path, and the one state where a Stop hook's timing assumptions are least obviously safe.

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

**A third, 2026-09-05, and it was mine, in an arm written to fix a different row.** `A39` ran
`boot.mjs --hook --root <this repository>` three times per gate run — and `--hook` **records a session start**.
So the arm wrote fabricated starts into the ledger it is part of: the real log went from 6 cold starts to 15,
**seven of them invented by the case**, sitting in the denominator of the question this project exists to
answer. Caught by reading the boot report and noticing a count that had no business moving. The seven records
were removed and the arm now builds a throwaway copy of `bin/` and roots boot there.

**And a sixth, the same afternoon, by hand.** Staging the three session-row states meant running
`boot.mjs --hook --root <this repository>` from a shell — which recorded five more fabricated starts, under a
`db.log` for an agent this repo does not have. The ARM was isolated by then; the operator was not. Both were
found the same way: a count in the boot report moved with no reason to.

⇒ **The rule has a corollary worth writing down:** anything that *runs a real hook path* writes wherever that
path writes — an arm, or a person at a prompt. `CLAUDE_COMM_RUNTIME` was already the seam for the registry and `--field` for the field scan;
the LEDGER's root had no seam, so nothing stopped the write and nothing announced it.

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
  starting at the same instant exactly one gets the signal.
  ⚠️ **Corrected by review #6 (F1): A33 proves the note is CONSUMED, not that consumption is ATOMIC**, and the
  sentence here used to imply the second. My mutation swapped the rename for a copy that left the file in
  place — which ARM 2 already catches. A *genuine* read-then-unlink, with the unlink deferred past the parse,
  **passes A33 green**, because eight `node` startups do not overlap at the critical read; with a 150 ms
  window inserted it yields 8 winners while `rename` still yields 1. `rename` is atomic and the mutant is
  racy; the arm cannot tell them apart. Restoring the stronger claim needs claimants that synchronise before
  racing. `REVIEW-adversarial-6.md` F1.
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

**FIRST REAL USE, 2026-09-04 20:26, and it found the design fact nobody had.** The `~/Dev/work` leader read
this, agreed, and armed a note for his own restart within minutes — `--by handoff --ttl 900`, at the **start**
of his close. A close is boot, STATUS, a commit and a handoff; it does not fit in fifteen minutes. His note
would have lapsed and his first real reboot would have been filed as a cold start. He read it that way because
my own ▶ NEXT said *"write the handoff, then arm, then restart"*, which reads as a sequence when what matters
is the **gap between the last two steps**.

So the mechanism's real weakness is not "someone forgets". It is that **the natural place to write a handoff
is not the natural place to declare a restart, and they are fifteen minutes apart.** Found by him, on first
contact, and worth more than a smooth run would have been.

Two things changed on that evidence, neither of them the TTL — one data point does not move a classification
rule. **The ledger now reports notes that are armed and unclaimed**, and boot renders them in the `ledger` row
and in every `field:*` row, as a countdown rather than a count: *"◷ restart note armed for leader (1m of
15m)"*, and `⚠ LAPSED` when the promise is spent. The failure was silent by construction — an expired note
leaves a record that looks like an ordinary cold start — and I only saw it because I happened to be watching
his terminal. Armed in boot both ways (a lapsed note reddens the row; a note inside its promise must NOT), and
in the ledger with the arm that matters most: **reporting a note may not TAKE it.** A reporter that consumed
one would delete the restart it was reporting, and the row that printed it would be the thing that destroyed
it. Read twice, present twice.

**And a false alarm in that same change, caught on its first run by the project that had nothing to report:**
`readdirSync` on a project with no `.comm/restart/` at all throws ENOENT, one bare catch turned that into
*"a restart note is armed here and could not be read"*, and `field:electio` — which has never armed one — said
so. Absence is not inaccessibility. A row that cries wolf at every session start is the same defect as a
silent miss, wearing the opposite face.

**THE SIGNAL CROSSED A REAL RESTART, 2026-09-04 20:44:22 local.** The `~/Dev/work` leader armed the note as
his last act, his owner relaunched him, and his `SessionStart` hook claimed it:

```
{"event":"start","agent":"leader","session":"13ca269e-…","source":"startup",
 "prev_session":"f5d48736-…","signal":{"src":"handoff","age_s":259.4,"ttl_s":900}}

starts   cold 3 · reboot 1   [startup:4]
verdict  needs 10 starts in each arm     (was: "the reboot arm is UNREACHABLE here")
```

**All four of his starts report `source: "startup"`** — that one bracket is the whole case for the mechanism:
the payload can never tell a relaunch from a cold start, and only the note does. The verdict line moved from a
shortfall that *could not be closed* to one that more sessions will close. It took two lapse warnings to get
there, which is the finding above.

**⚠ AND THE ARM SAMPLES A SUB-POPULATION — found by him, minutes after arming that note, and it outranks the
crossing.** *A session that CRASHES never closes, so it never arms — and a crash is one of the commonest
reasons a restart happens at all.* He had measured one that same evening: his session #39 was cut off
mid-work, never archived, left his task list swollen from 20 KB to 48 KB, and **his next boot cost 115 609
tokens against 100 725 for the previous one.** A real, consequential restart that lands in `cold` — correctly
by these rules and wrongly for the question. So the reboot arm is not under-sampled; **it holds clean reboots
only, and the two kinds may not cost the same.**

He declined to propose a fix — *"I would rather you know the arm is biased than have me widen it for you"* —
and that was right: arming early and refreshing trades a clean semantic for a noisy one. **The arm is not
widened. The bias is NAMED where the verdict is read**, in the ledger's own output, every time the arm holds
anything (armed on one variable: whether any start reached it). A caveat that appeared when there was nothing
to caveat would be boilerplate inside a month.

**And what `ttl_s` actually bounds, in his words: not staleness on disk — how long a human may take.** Two
sessions with identical hygiene land in different arms because one owner answered a message faster. That is a
real cost of this design, it is not fixable by choosing a bigger number, and it is why `arm` is cheap to
re-run: the fix is to arm LAST, not to promise longer.

**What is NOT closed by this.** Nothing arms the signal automatically yet: a restart still has to say so, and
in the field that means the owner's hand (`node bin/restart-signal.mjs arm --agent <name> --prev-session
<id>`) or a future self-reboot that owns its own relaunch. The mechanism cannot detect a liar — an armer that
claims a restart it is not performing is indistinguishable from a real one — it can only make the claim
visible: `by`, `by_pid` and the age are all in the record.


## `#exchange-bell` — the one path with no tool on it grew a stale number within three uses

`exchange/` is a file exchange, not a bus, and that asymmetry had never been named: **`bin/boot.mjs` tells ME
when a peer has written, and NOTHING tells the peer when I have.** The `exchange/README.md` protocol closes
that with a human — *"write a file, then tell your owner it exists"* — and on 2026-09-04 the owner delegated
the telling to me. So the channel ran for one evening on hand-typed `kitten @ send-text`.

**It took three uses to produce a false alarm.** The third bell said *"your note expires 20:41:59 (armed
18:26:59Z + 900s)"*. The note on disk at that moment read `at: 18:30:34Z` — the peer had re-armed twice and
had 357 seconds left. The tool I had asked (`ledger --root ~/Dev/work`, run 30 s earlier) had answered
**correctly**; the sentence I typed quoted what I remembered arming.

He caught it and returned my own rule: *"a row that speaks for another tool has to read what that tool
reads."* And he named the consequence, which is worse than a wrong status line: **a stale expiry warning is an
alarm that fires when nothing is wrong.** Had he trusted the bell over the file he would have re-armed in a
panic mid-report — the rushed ordering my *previous* message existed to prevent. Two mechanisms fighting each
other, and what saved it was the project's first rule rather than anyone's care: *the file is the artifact,
the bell is only the bell.* **He read the file.**

**`bin/exchange-bell.mjs` is the fix, and the property is not "be careful".** It is that there is **nowhere to
put anything but a pointer**: the message text is fixed, and its only interpolations are the ref and the reply
directory. This is the bus's own rule (`--ref` required, no `--body`) applied to the one path that had been
exempt because a human was typing it. Everything else is `bin/wake.mjs`'s five rules, reused rather than
reimplemented — resolve by pid then send, never `--match` on a guess, every socket, no daemon, a quiet period
that is a written record and not a timer.

**Armed as A35, and arm 4 is deliberately STRUCTURAL rather than behavioural**: it parses the message template
out of the source and requires every `${…}` in it to be `ref` or `inDir`. A behavioural check ("today's text
carries no digits") passes for a year and then somebody adds `${age}`; this fails on the commit that adds it.
Proved red by adding a timestamp to the text — caught, and named in the failure line.

**Two things this does NOT do.** It does not deliver: the peer reads the file when their turn ends, and the
channel's only real answer is their file in `in/`, which boot's `channel:` row already watches. And it does
not know whether they read it.

**And the case for it was three hand-rung bells, not a theory** — which is the right order, but note the cost:
the defect reached a live peer before the tool existed, and it was caught by the peer rather than by me.


## `#field-notice` — the agents using this tool had no copy of the rules, and one of them guessed

**An agent in a field project has hooks, a bus, a ledger and a lifecycle instrument, and until 2026-09-04 it
had no explanation of any of it anywhere in its own tree.** The design lives in a *different* repository it
has no reason to open. So the first time one of them wondered what `.comm/` was, it guessed — and the guess
committed six files of live bus state to git (`#reboot-signal`, the `.gitignore` half). Its own account is the
part worth keeping: *"I wrote that `.gitignore` against the things I was thinking about. `.comm/` did not
exist in my head as a category, so it did not exist in the file."*

**That is not a discipline failure and a rule would not have prevented it.** So this is two things, and the
order matters: a **notice**, because a rule nobody was told is a rule that will be broken by someone acting
reasonably — and a **guard**, because a notice is a promise and this project does not ship promises.

**The notice** is generated by `install.mjs` into `<project>/.comm/README.md`, so the paths in it are this
machine's real paths: the update command names the actual checkout, and the feedback directory is one the
agent can write to without asking anyone where it is. It carries no timestamp and no counts, because
`--check` compares it byte for byte and a notice that drifted daily would make that comparison worthless.

**The guard** asks the only question with no false positive: **are files under `.comm/` TRACKED?** Not "is
there an ignore rule" — a rule can live in a parent `.gitignore`, in `.git/info/exclude`, or in a global
`core.excludesFile`, and checking the rule would cry wolf in all three. Tracked-or-not *is* the defect. It
runs at `SessionStart`, costs one `existsSync` in a project with no `.git`, and names the fix
(`git rm -r --cached .comm/`), which keeps every file on disk. Armed as **A36**, with both controls: a project
with no repository and a repository with the rule intact must both stay **silent**.

**The feedback path** is the same shape and needed no machinery: `<checkout>/exchange/field/in/`, created by
the installer so the notice never names a directory that does not exist. Boot's existing `channel:` row
reports an unanswered channel at every session start, so the return leg was already built — the only thing
missing was telling the field agents the path.

### 🔴 And the guard broke the bus while being added — the worst defect of the session

`install.mjs` builds the hook stub as a **template literal**, so every escape in it is resolved when the stub
is *written*, not when it runs. One `split("\n")` — single backslash — became a **real line break inside a
string literal**. The generated hook stopped parsing. **Every hook path in every project exited 1**: no
delivery, no registry, no ledger, in exactly the way this repo's first rule forbids.

**How it presented is the finding.** The suite caught it — as `✗ A5 corrupt config is inert — hook exit=1`, a
case about corrupt configuration, and then the run **hung at A8**. A whole-file syntax error cannot present as
itself; it can only arrive wearing somebody else's symptom, and two of this session's minutes went into
suspecting `git init` before the error was read.

**A0 is the answer, and its position is the point:** it runs before A1 and asks, by name, whether every
generated stub parses. Proved red by restoring the exact bug — A0 says *"unparseable: .claude/comm-hook.mjs,
app/.claude/comm-hook.mjs"* while A5 still says *"hook exit=1"*. The gate did not get better at detecting;
it got better at **saying what it detected**, which is the difference between a red run and a diagnosis.

**The general form, worth the next reviewer's attention:** any guard added to the STUB is code being written
through two layers of escaping, by an author who is looking at the outer layer. `A0` is the floor under that,
and it did not exist while five separate guards were added to that stub over three sessions.


## `#claim-file` — the design for open item 4, kept out of STATUS.md because it is a plan, not a state

Two agents in **one** project root collided over a port and killed each other's servers, 2026-09-04. The
failure is not transport, which is why a bigger bus would not have prevented it: both had a hub and still
could not see each other, because *nothing in this tool has ever had a concept of a thing an agent is
holding.* Verified rather than assumed — `bin/comm.mjs` has no notion of a port, a lock or a server; its only
"claim" is a sender's identity. The incident and the peer's reply are in `HISTORY.md`, "The port collision".

**The fix respects the hub rule exactly:** `claims/<resource>`, a file carrying pid, purpose and time. The
file is the artifact; no transport, no daemon. Three properties, each of which is a way to build it wrong:

- **A stale claim is diagnosable, not authoritative.** The pid is in the file so a reader can see the holder
  is dead — that is *evidence of a crash*, never a lock that outlives the process that took it.
- **It advises, it does not enforce.** A mutex every agent can delete is a promise the filesystem does not
  make, and pretending otherwise would put a guarantee in the design that the mechanism cannot keep.
- **It ships with a gate proved able to go red on a claim left by a dead process** — the one state where a
  naive implementation silently blocks everybody forever.

### 🟢 BUILT 2026-09-05 — `bin/claim.mjs`, and what reality found that eight arms did not

*"Deliberately not next"* stood until the peer's `REPLY-2026-09-04-covariate.md` §1 listed **three agents and
six ports as scheduled** (PostgREST 54331, GoTrue 54332, dev 5174/5175, preview 4174/4175). That is the
condition this section itself named — a third agent starting a dev server — so the line was superseded by his
table, not by impatience.

Three properties, eight arms, each moving one variable; `A38` runs them inside the gate and asserts the
installer carries the file, because the collision happens in FIELD projects and a tool that lived only here
would have been present at none of it. Both failures the design named in advance are proved red: identity as
pid alone (a recycled pid reading as a live holder) reddens only arm 4, and a dead holder that still blocks
reddens only arm 3.

🔴 **And then running it for real found a defect all six original arms were green over.** `take` recorded
`process.pid` — **the pid of a CLI that exits milliseconds later** — so every claim read as
`HELD BY A DEAD PROCESS: a crash` within one second of being taken, and the boot row said so about a resource
nobody had crashed on. Every arm had WRITTEN a fixture record with a pid the test chose; **not one had taken a
claim through the CLI and read it back.** The holder is now `--pid` when given, else the session resolved by
`bin/session-registry.mjs`'s single implementation, else the CLI's own pid with `holder: "self"` recorded and
a warning that it will read as gone. Arm 7 is the round trip, and it is the only arm the original defect
reddens — the other six stay green, which is exactly the picture that existed while it was live.

⇒ **The lesson is not "write more arms". It is that eight arms sharing one fixture idiom share one blind
spot**, and the cheapest thing that does not share it is running the tool against a real project once.

⚠️ **What is NOT verified:** no two real agents have contended through it. The demonstration used one session
taking both sides, which the tool correctly treated as one holder refreshing its own claim — the refusal was
shown only against a fabricated second holder (`--pid 1`). **Two live sessions in one tree is the measurement
that matters and it has not been made.** Nor has anything been claimed by a real dev server: `--pid` has never
carried a server's pid outside a fixture.


## `#review6-disposal` — disposing review #6, and the four defects the disposal itself produced

**2026-09-05.** All eleven findings of `REVIEW-adversarial-6.md` are fixed and armed (F8–F11 were numbered
that day, when they were recorded; they were prose bullets before). What is written here is only what the
review did **not** already say — the measurements taken during the disposal, including the ones that went
against me.

### The ledger has a numerator now, and it says the opposite of what the window expects

Eleven defects recorded, timed by **the commit that authored each**. Ten attributed, one unattributable
(`F9`, authored 09:42:38Z on 2026-09-04, before this ledger's first start — property 3's pool, exercised for
the first time by real data). All ten attributed defects land in **one session**, `f7fa6ab9`, a `clear`
start, so they fill the **reboot** arm.

⚠️ **Where those eleven `--ref` pointers lead:** `REVIEW-*.md` is gitignored (`.gitignore:30`) and so is
`.comm/`, so the records and the document they point at are both machine-local and travel together. A clone
has neither. That is consistent rather than broken, but a session reading these refs on another box will not
find the file, and should be told so here rather than discover it.

🔴 **Zero of ten fall inside the 15-minute window.** The consumer's finding — the reason the window is 15
minutes — was *"four of five defects authored in the first thirteen minutes"*. This repository's own first
batch was authored 35 minutes to 2 h 43 into its session.

⚠️ **And the measurement is biased in exactly that direction, by construction.** A commit timestamp is the
**upper bound** of the interval in which the code was written: a defect authored at minute 8 and committed at
minute 95 is recorded at minute 95. So the disagreement with the consumer is *not yet evidence* — it is one
sample, from a different kind of session (tool-building, not leading), scored by a rule that pushes every
defect later. The honest reading is that the numerator exists and the window has not been tested.

### The disposal produced four defects of its own, three of them in the detectors

Same ratio as reviews #5 and #6, in work whose whole purpose was to fix that ratio.

1. 🔴 **A29 merged the two streams and called the result stdout.** Its fixture redirected `> out 2>&1` and
   parsed that file as the hook's stdout, so **any** diagnostic on stderr broke `schemaOK`. It had passed for
   weeks only because nothing in that particular fixture ever wrote to stderr — no git repository, and a
   registry write that succeeds. It went red the moment the stub gained a correct one-line notice. Fixed by
   separating the streams, and the property it was hiding is now stated: *a hook may say what it likes on
   stderr and its stdout contract stays intact*.
2. 🔴 **The archive row's drift detector flipped on a commit that touched no document.** Two causes, both
   real. It stripped comments over the **concatenation** of `test/*.mjs`, and `/*` appears inside strings and
   regexes in those files — including in the detector's own source — so the markers do not balance and an
   unclosed one swallows the next file. Which text survived depended on readdir order and on edits elsewhere.
   And it matched a **basename anywhere**, so `A36` reading `<throwaway-fixture>/.comm/README.md` — a notice
   the suite generates itself — was reported as an undeclared dependency on this repo's `README.md`. The row
   whose job is to say which documents the gate opens named one it never opens. Stripped per file now, and a
   reference counts only when its line also names `PKG`; `R4b` holds the direction that fired.
3. 🔴 **The barrier race's detector wrapped the read and the unlink in one `try`.** Its positive control
   reported **1** winner where the truth was **8**: seven claimants had read the note successfully and only
   their *unlink* lost the race, and the catch overwrote the successful read. The failure this case exists to
   detect, committed inside the case. Measured 1-of-8 before, 8-of-8 after, same barrier, same window.
4. ⚠️ **The `DRIFT:` arm split a filename on `-`.** `comm-hook.mjs` read as `comm`, and the arm reported its
   own truncation as a failure of the code under test. Split on the separator, never on the character it is
   made of.

### `#A20` again: one red that no code change explains, and it is not resolved

`bin/boot.mjs --prove-red` reported `✗ 1 boot row(s) could NOT be reddened` on one run, then **green twice**
on the same tree — once through the identical shell pipeline, which refutes the obvious explanation that
`| head -20` had closed the pipe. **The failing row was never identified**, because the run was filtered
through `grep -E 'R6|FAIL|PASS|red|green'` and the row's own line did not match. The summary line did.

⇒ Two things are owed here and neither is done: the row is unknown, and the reason is that **I filtered a
gate's output and destroyed the only evidence that would have named it.** Run the gates unfiltered; a suite's
output is the measurement, not the noise around it. If this recurs, it is `#A20` and it is triage-first.

### What the review's own arms could not be made to do

🔴 **A33's race halves cannot separate a WINDOWLESS read-then-unlink from `rename`.** Measured, not assumed:
with `renameSync` replaced by a genuine windowless read-then-unlink in the shipped module, eight
barrier-released claimants still produced **one** winner and the pair stayed green. The barrier is real — the
same barrier through a read-then-unlink with a 150 ms window hands the note to **all eight** — but the narrow
critical section is too small for eight processes to land inside. That gap is closed by a **structural** half
(`claim()` must consume by `renameSync` before any read of that path), whose own weakness is named where it
is written: it reads source, so it is one refactor behind, and the declaration is the mechanism.

## `#self-identity` — the variable was never needed, and the boot row is why people type it

**2026-09-05.** The owner asked whether agents could set `CLAUDE_COMM_AGENT` for themselves instead of him
typing it at every launch. Two measurements answered it, and the second one made the first moot.

### 1. A process cannot declare itself through that channel — measured, not reasoned

`comm who` identifies live sessions by reading **`/proc/<pid>/environ` of other processes**. A process's own
assignment does not reach it:

| | |
| --- | --- |
| `process.env.CLAUDE_COMM_AGENT = "leader"` | `"leader"` |
| `/proc/self/environ` immediately after | **empty — the scanner sees nothing** |

⇒ *"the agent exports the variable itself"* is not a feature that was missing; it is **structurally
impossible** through the channel the scanner reads. Same fact the bus already records for its own reason:
reading our own env would report a session as declared while every real scanner sees nothing.

### 2. 🔴 And it was never needed, because identity already resolves without it

Measured on the three live sessions in `~/Dev/work`, mid-work, none of them staged for this:

| pid | `CLAUDE_COMM_AGENT` | cwd | `comm who` says |
| --- | --- | --- | --- |
| 61733 | **none** | `~/Dev/work` | `leader` ✓ |
| 303652 | **none** | `~/Dev/work/db` | `db` ✓ |
| 307719 | **none** | *(exited between measurements)* | `leader` ✓ |

**Not one declared anything.** `whoami` falls back to the directory, and **delivery never used the variable
at all** — it anchors on the hook stub's location, which is CLAUDE.md's rule for identity. The variable does
exactly two things that the directory cannot: `=none`, and naming a session whose cwd is not its agent's.

### 3. 🔴 So why does anyone type it? Because the first row of the boot report said to

`bin/boot.mjs` resolved the identity through the bus — `askBus`, the same call the field stub makes — and
then **threw that answer away**, printing `no CLAUDE_COMM_AGENT - off the bus` whenever the variable was
absent. An agent on the bus, receiving mail, recording under its own name in both instruments, was told by
the most-read line of the most-read report that it was off the bus.

This project's signature defect — *a row that names something other than what it measured* — sitting in the
first row of its own boot protocol, and the one row every session reads before anything else. **A tool that
misreports a state also teaches the habit that appears to fix it.** Three states now, and they differ:
`declared "X"` · `"X" by directory - on the bus, no CLAUDE_COMM_AGENT needed` · `not on any roster here`.
`A39` holds all three with the no-roster control, and reddens on the old wording alone.

### What was designed, costed, and REJECTED

Making `comm who` read the identity from the session registry — which the hook already writes from the stub's
location, keyed on (pid, start time, boot id) — would also fix the residual case: a session whose **cwd
wandered** after start still reports by cwd today.

**Not done, and the reason is a trade this project should not make.** It requires the bus to import
`./session-registry.mjs`, which A21's allowlist forbids for a reason — and a static import that fails when
the sibling is absent kills `bin/comm.mjs` **entirely**, including `send` and `hook stop`. That is a
DELIVERY failure bought with a REPORTING fix, against the bus's own first rule that a broken bus must never
break a session. Reached the point of being written and reverted; the fixture that caught it is `A12`, which
hand-copies the bus alone and died with `ERR_MODULE_NOT_FOUND`.

⚠️ **So the residual gap is open and named:** a session that changes directory after start is reported by
where it stands, not by what it is. Nobody has measured how often that happens.

## `#second-session` — a reviewer in the leader's folder eats the leader's mail

**2026-09-05.** The owner runs adversarial reviews as a second session **in the same directory** as the
leader, and asked for a reviewer that can talk to the leader *without disturbing it and without being taken
for it*. `#self-identity` had just established that the identity variable is unnecessary — and this is the
one case where that answer does not hold, so it is recorded separately rather than as a footnote.

**Two sessions in one folder are one agent by construction:** the hook lives at `<folder>/.claude/`, both
sessions load it, both drain the same inbox. Measured on a fixture, one variable moved — where the second
session's turn ends:

| | leader's waiting mail |
| --- | --- |
| a turn ends in the **leader's** folder | **1 → 0** — taken, and `send` had already reported ✓ delivered |
| the same turn ends in `review/`, a registered agent | **1 → 1** — untouched |
| `review` sends to the leader, no variable set | `✓ review → leader`, held for the leader |
| `whoami` from `review/` | `review` |

⇒ **The answer needs no new mechanism: give the second session its own directory in the roster.** It keeps
its own inbox, is never mistaken for the leader, writes to the leader with nothing typed at launch, and the
framework's own rule — identity is location — does the work.

🔴 **`CLAUDE_COMM_AGENT=none` is NOT that answer**, and it looks like it is. An off-bus session receives
nothing *and cannot send*: `✗ cannot tell which agent you are`. Mute in both directions, which is not
"present but quiet".

### The defect this turned up

**`comm who` has warned about a shared inbox since A17. `bin/boot.mjs`'s field row was silent about it** —
`hooks in sync - bus current - 0 pending` over a project with two live sessions on one inbox. The tool
computed the one condition that *silently loses mail*, and the row a leader reads about other people's
projects dropped it. Review #6 F5's defect, third instance. The row now carries it, asked of the bus rather
than re-derived, and it is armed with two live fixture sessions.

And `who`'s own advice named only the environment variable, which is the fix that must be retyped at every
launch. It names the directory first now, because that one survives being forgotten.

⚠️ **Not verified:** no real adversarial review has been run from its own directory yet. The routing is
measured on a fixture; the workflow around it — whether a reviewer that cannot see the leader's inbox still
has everything it needs — is not.

## `#unnamed-collision` — in a rosterless project every session is the same agent, including for the restart note

**2026-09-05, live while it was written.** The restart signal is keyed by AGENT — `.comm/restart/<agent>.json`
— and `claude-comm` has no `.comm/config.json`, so every session here resolves to `unnamed`. The adversarial
reviewer for #7 was launched in this same directory while a restart was being armed for the leader.

⇒ **The note is one-shot and will be claimed by whichever session's `SessionStart` fires next in this
directory, not by the one it was meant for.** If the reviewer clears, resumes, or a third session opens here,
that start is recorded as the reboot and the leader's real relaunch lands in `cold`. Same shape as the shared
inbox (`#second-session`): two sessions, one name, one artifact, and the loser is silent.

It is NOT a defect in `bin/restart-signal.mjs` — the file is doing exactly what it says, and its one-shot
property is the whole mechanism. It is a consequence of this repository being the only project in the
framework with **no roster of its own**, which also makes its boot row say "off the bus" truthfully.

**Not fixed, and the cheap fix is suspicious:** giving claude-comm a roster would give it an inbox, a bus and
a second identity surface, for one line of experimental hygiene. The honest mitigation is the one already
used — arm LAST, and know that a concurrent session here can take it. Whether the arm was actually claimed by
the intended session is checkable after the fact: the ledger's `prev_session` names who it succeeded.

## `#ack-amendment` — the first guard amended by its own bypass rate

**2026-09-05.** `CLAUDE.md` says an acknowledgement count of three prints an instruction to amend the
protocol, *"because a guard defensible every time it is bypassed is already failing and the rate is the
signal"*, and that an amendment needs **evidence, not an opinion, landing as a gated change with an arm**.
This is the first time that fired. The evidence is the three acknowledgements themselves:

```
ackCounts: { "field:work": 3, "tree": 2, ... }
```

All three said the same thing in different words: *their leader wrote to their `db`, `db` is running, it
drains at its next turn boundary.* The row reddened on **any** pending mail — including a message delivered
four seconds earlier to a live agent. That is not a defect on anybody's machine; it is the bus working.

**The amendment splits what the row was conflating**, using the answer the bus had already given for the
shared-inbox check in the same block — no second spawn, and no second definition of "running":

| state | before | after |
| --- | --- | --- |
| mail in flight to a **running** agent | ⚠ | ✓ `in flight to a running agent` |
| mail for an agent that is **not running** | ⚠ | ⚠ `has mail and is NOT RUNNING - it waits for a relaunch` |
| pending, and the bus could not be asked | ⚠ | ⚠ and says it could not tell the two apart |

The second row is the one worth waking someone for: **nothing else says that mail is waiting on a relaunch.**
The old row buried it by warning about both, which is how the acknowledgements started.

Armed in both directions, and the second arm carries the control that makes the first mean anything: the
same message, the same inbox, one live session in the recipient's directory → the row stays green; kill that
session → the *same* message reddens it. Without that half the amendment could be reverted with every gate
still green.

**The counter was reset to 0 for that row when the amendment landed, and that is deliberate.** A bypass rate
measures ONE guard; the amended row asks a different question, and letting it inherit the old row's debt
would demand a second amendment for a reason that no longer exists. The old value — 3 — is recorded here,
which is where it belongs, rather than in a live counter that will be read as current.

**FIRST REAL READING, 2026-09-05 12:09:55Z:** the adversarial reviewer for #7 was launched in this directory
and its own SessionStart recorded `pending: 20` — twenty files newer than the previous start, which is this
session's work sitting in front of it. Written the same afternoon, observed in the wild hours later, by a
session nobody staged. It is one point and it predicts nothing yet; what it shows is that the field the peer
asked for is actually being written by a real hook and not only by arms.

⚠️ **What this does not do:** it does not bound how long "in flight" may last. An agent that runs for hours
without ending a turn holds its mail for hours and this now says nothing. The age is printed; nothing acts
on it, and no measurement exists yet for what a normal in-flight age is.

### Moved out of STATUS.md on 2026-09-05, when tier 0 hit its cap

Still unverified, still true, and no longer worth a line in the file every boot pays for:

- **Whether finding 1 ever actually ate mail in electio.** Unanswerable, and not for the reason this file
  gave for three sessions: the log DOES record who drained (`to_agent`, since the first commit), but it
  records the **resolved** name, and every theft class here works by making the thief resolve to the
  victim's name — clean by construction in exactly the cases it would need to catch. `id_src` separates the
  two now, on new rows only; the 37 historical rows stay unauditable. Review #1's finding 6, one level up.
- **The `-restored` duplicate id** in electio's log, unexplained across three reviews now.

### Moved out of STATUS.md on 2026-09-05 (second pass), when tier 0 hit its cap again

- **Whether two consumers of one hook stdin work.** The ▶ NEXT depends on the generated stub reading the
  payload and handing it to both the bus and the ledger. It currently uses `stdio: "inherit"` and has never
  been asked to do anything else.
- **How long the wandered-cwd window stays open.** Proved within a single `-p` turn; whether an interactive
  session's Bash cwd resets between turns is unmeasured. It decides the exposure, not the existence, of the
  defect. Moot for delivery (identity no longer reads cwd); still governs `whoami`-returns-null, open item 2.
