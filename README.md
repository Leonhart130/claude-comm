# claude-comm — a message bus for a hub-and-spoke team of Claude Code agents

**The problem it removes:** the owner is the message bus. A correction found mid-round waits for the
round to end; an expert that finishes or blocks is invisible until you look at that split.

**The one rule everything follows from:** *the file is the artifact, the message is only a doorbell.*

---

## Why a message may only ever carry a POINTER

This was measured, not assumed.

A message carrying raw **content** — *"the protocol is active, reply X"* — is **refused by the receiving
agent as a prompt injection.** It is right to refuse: it cannot tell a leader from an attacker.

The same message as a **pointer** — *"a correction landed in `docs/REVIEW.md`, re-read it"* — is acted on,
because the agent then reads its own trusted file with its own tools.

So `comm send` **requires `--ref`** and there is no `--body`. The substance stays in the versioned file;
the bus only rings the bell. This also keeps authorship clean: a round stays a claim about what *that
expert* verified, not something text injected into their session blurred.

## Transport

| | mechanism | delivers when |
| --- | --- | --- |
| **running agent** | `Stop` hook returns `{decision:"block", reason:<nudge>}` | end of its current **turn** |
| **stopped / crashed agent** | `SessionStart` hook drains the same inbox | next time you launch it |

`stop_hook_active` guards the block-loop. **Every hook path exits 0 on any internal error** — a broken bus
must never break a session.

⭐ **An agent's identity comes from its hook stub's location, never from the session's cwd.** The stub is
installed one per agent at `<agentRoot>/.claude/comm-hook.mjs` and passes that path to the bus. This was a
measured defect, and the worst one found so far: the Stop payload's `cwd` follows the **Bash tool's**
working directory, so a leader running `cd web-app && git log` — the most ordinary thing a reviewing leader
does — ended that turn identified as the *expert*, and its hook drained the expert's inbox. The brief was
announced into the leader's context, moved to `delivered/`, and logged as a normal delivery. The expert
never saw it, `comm sent` said `✓ delivered`, and nothing afterwards could tell it from a real delivery.
Gated by **A13**.

⚠️ **Known limit, stated plainly:** delivery is at a **turn boundary**, not an interrupt. An agent deep in a
20-minute turn gets the nudge when that turn ends. This takes you from *"waits for the round"* to *"waits for
the turn"* — most of the win, no terminal configuration. A true mid-turn interrupt needs a terminal
transport (kitty `send-text` over a socket); that is deliberately not built here.

## Install

```bash
cd /path/to/your-project
node /path/to/claude-comm/bin/comm.mjs init      # auto-discovers git repos as agents
node /path/to/claude-comm/install.mjs .          # writes hooks into every agent
node /path/to/claude-comm/install.mjs . --check  # gate: fails on drift, writes nothing
```

Hooks land in each repo's `.claude/settings.json` (existing keys and unrelated hooks preserved;
`settings.local.json` is never touched). `.comm/` is added to `.gitignore` — it is live state.

⚠️ Hooks are read at session start, so **an already-running agent picks them up on its next launch.**

## Use

```bash
comm who                                     # roster · who is actually running · pending counts
comm send <agent> --ref <file> [--note ...]  # ring the bell
comm inbox [<agent>]                         # what is waiting
comm log                                     # delivery audit trail
```

`--kind` is `nudge` (a correction/brief landed) · `done` (round finished) · `blocked` (needs a ruling) ·
`fyi`. It defaults to `nudge` from the leader and `done` from an expert.

`comm who` reads `/proc` rather than a registry: **a registry says what was launched, `/proc` says what is
alive**, and those differ exactly when it matters. `send` tells you which one you got, so a message to a
dead expert is never mistaken for a delivered one.

## Topology is enforced, not documented

Every message must have the leader at one end. A peer-to-peer send is **refused with an error**, not
silently rerouted — a silent reroute would let two experts coordinate off-board, which is the divergence a
hub exists to prevent.

```
$ comm send selflo-carrier --from selflo-seller --ref docs/REVIEW.md
Error: hub-enforced: 'selflo-seller' may not message 'selflo-carrier' directly.
```

## Refs resolve for the READER, not the writer

A ref is written relative to the **subject** repo — whichever end is not the leader — because that is what
both sides mean by `docs/REVIEW.md`. It is then re-expressed for whoever receives it:

| | sender writes | recipient is shown |
| --- | --- | --- |
| leader → `web-app` | `docs/REVIEW.md` | `docs/REVIEW.md` |
| `web-app` → leader | `docs/REVIEW.md` | `web-app/docs/REVIEW.md` |

⭐ **This was a measured defect, not a nicety.** An expert sent `docs/REVIEW.md` to a leader whose cwd is the
project root — where a `docs/` directory also exists. The leader would have opened a real, wrong file and
never known. *A pointer that silently resolves to the wrong file is worse than one that errors.*

## The gates

```bash
node test/selftest.mjs              # stands up a scratch project, installs real hooks, runs real sessions
node test/selftest.mjs --prove-red  # removes ONLY the hook — the signal must vanish
node test/attack.mjs                # 15 adversarial checks; aborts on regression
node test/latency.mjs <log.jsonl>   # re-derive the delivery-latency table from a log
```

**Every one of the 15 has been demonstrated to go RED** by restoring the defect it guards in the bus with
the gate left byte-identical. That is not decoration: A10 spent a session asserting
`after === 0 || after === before`, which is true for every reachable value — *a gate that cannot fail is
worse than no gate, because the method rests on it.*

`attack.mjs` exists because what a nudge injects is attacker-influenced text landing in another agent's
context. **Every one of its cases found a real defect on first run:**

| | what it found |
| --- | --- |
| note cap | a 50 000-char `--note` injected **12 614 tokens** — most of a leader's entire orientation budget, from one message |
| note flattening | a note could forge `[SYSTEM]`-style framing *inside* the nudge; newlines and control chars are now stripped |
| batch cap | 40 pending messages rendered at once, unbounded |
| quarantine | a corrupt message file was silently skipped and stayed in the inbox forever, invisible to every command |
| sender identity | `--from` was free text — any expert could sign as any agent. It is now derived from cwd |
| ref confinement | `--ref ../../../../etc/shadow` was accepted |
| render-before-drain | mail was deleted *before* the nudge was built, so a render failure lost it while the audit log claimed delivery |
| cwd identity | a leader that `cd`s into an expert's repo drained that expert's inbox — four diagnostics reported success |
| valueless flags | `dismiss --force leader` cleared the operator's **own** inbox, by following the tool's own advice |
| audit surfaces | `comm log` and `comm sent` rendered a forged ref raw — the two commands the *leader* reads |

⚠️ **The cautionary one is A8.** Its first version asserted *"the hostile string must not appear"* and
reported HIGH forever — but that property is **wrong**: the recipient legitimately needs to see what a
sender wrote. The real property is structural — *can the note escape its quoted line?* Measuring the wrong
thing produced a confident, plausible, wrong result. A7 likewise failed as an **over-correction**: the first
fix refused `../COORDINATION.md`, which is legitimate. *A safety check that refuses real usage is a defect
too — it is how a check gets disabled wholesale a week later.*

## Known limits, stated rather than discovered

- **Turn-boundary delivery, not interrupt** (above).
- **`comm who` is Linux-only** — it reads `/proc`. Elsewhere it degrades to "not running" for everyone,
  which is safe but useless; `send` still queues correctly.
- **Identity is not a security boundary.** Every agent runs as the same Unix user, so cwd-derived identity
  prevents *accidents and confusion*, not a determined local attacker. There is nothing to defend against
  here that the user could not already do directly.

`selftest.mjs` stands up a scratch project, installs the real hooks, and runs real `claude -p` sessions. It
asks **two** questions and gates only one of them:

| | question | determinism | role |
| --- | --- | --- | --- |
| **transport** | did the hook fire at the turn boundary, drain the right mail, and log it `via=hook`? | deterministic | **the gate** |
| **behaviour** | did the agent then read the file it was pointed at? | not deterministic | reported, never gated |

⭐ **Gating the second one is what made this test flaky (~1 run in 6 red for nothing), and the split is not a
workaround — it follows from the design.** Pointer-not-content exists so the agent stays free to read the
file or not; *a gate demanding obedience measures precisely what this bus refuses to guarantee.* Measured
after the rewrite: **6 runs, transport green 6/6, behaviour 3 read / 3 did not** — every one of those three
would have been a red run before. A gate that reddens at random trains you to re-run it until it agrees
with you, which is worse than no gate, and it makes a green run weak evidence too.

`--prove-red` strips **only** the hook, leaving the message and the file identical — one variable moved. The
mail must then survive undelivered. **A self-test that stays green with its own mechanism removed is testing
nothing.**

## Porting to another project

The bus assumes only: one project root, agents in subdirectories, one of them the leader. Nothing is
hardcoded — the hook stub locates the bus by walking up from its own file, so a project can be moved or
cloned without breaking. `comm init` auto-discovers any subdirectory containing `.git`; edit
`.comm/config.json` to trim or rename the roster, then re-run the installer.
