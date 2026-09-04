# claude-comm

A message bus for a hub-and-spoke team of Claude Code agents, and the lifecycle tooling that lets them
run themselves. Everything follows from one rule: **the file is the artifact, the message is only a
doorbell** — and a reboot obeys it too, since what survives a restart is what was written down.

## Boot — read in tiers, never everything

<!-- boot-tier0: CLAUDE.md STATUS.md -->

| tier | what | when |
| --- | --- | --- |
| **0 — always** | this file · `node bin/boot.mjs --fast` (injected at session start) · **`STATUS.md`** | every boot, ~6 k tokens |
| **1 — on topic** | `README.md` (the design) · `FINDINGS.md` (**before touching any guard**) | only when the work touches them |
| **2 — on demand** | `HISTORY.md` (how each decision was reached) · `BRIEF-*` / `REVIEW-*` correspondence | when re-opening something already settled |

```bash
node bin/boot.mjs          # ~14 s · state + the adversarial gate (29 checks)
node bin/boot.mjs --fast   # ~0.3 s · state only, when you are not touching the bus
node bin/context.mjs       # how full this session is, resolved from /proc - exact, not guessed
node bin/ledger.mjs        # did a restart cost us a defect? UNKNOWN until 10 starts per arm
```

Read the boot report; if a row is `⚠` or `✗`, resolve or name it before anything else. **Never paraphrase
`STATUS.md` in place of running boot** — this project shipped a bus 4 commits stale in the field while its
status file read green.

🔴 **Tier 0 is capped in BYTES — 2.70 B/token measured on this corpus, so 28 000 B is ~10 400 tokens;
converting with `/4` is low by a third (`FINDINGS.md#tier0-calibration`) — and boot gates it.** When the `budget` row goes red the fix is to **split or cut**;
raising the cap is not a fix. The cost of a boot is paid on every session, forever — measured 2026-09-04,
a leader agent in the owner's live project pays ~100 k tokens per boot and up to 170 k. That is what
made the tiering above non-negotiable here.

## Close — `node bin/boot.mjs --close`

**The close has no criteria of its own: a session is closed when a full boot reports nothing that is not
either fixed or NAMED.** Giving it its own checklist would give it its own criteria, and they would drift
from what the boot measures. It refuses unless `STATUS.md` carries a `## ▶ NEXT` section — written by you,
never by the tool — saying what the next session must do first, in enough detail that a session with no
memory of this one can act without re-deriving anything.

A non-green row is resolved or acknowledged by name: `--ack <row>="why"`. There is no flag that waves
everything through, and **acknowledgements are counted** — a row waved past three times prints an
instruction to amend the protocol, because a guard defensible every time it is bypassed is already failing
and the rate is the signal. **That count is how both protocols improve: an amendment needs evidence, not an
opinion, and it lands as a gated change with an arm, never as prose.**

Before changing delivery: `node test/selftest.mjs` and `node test/selftest.mjs --prove-red` — minutes, real
sessions. Boot deliberately does not run them.

## The standard this repo is held to

- **No claim without a measurement.** If you cannot state what would have made a check fail, you have not
  checked anything.
- **Every gate proves it can go red** — one variable moved, the detector byte-identical:
  `bin/boot.mjs --prove-red` · `bin/context.mjs --prove-red` · `bin/ledger.mjs --prove-red` · `test/attack.mjs` ·
  `test/selftest.mjs --prove-red`.
- **Report what was NOT verified.** Its absence is a defect in the report, not a clean bill.
- **Attack the recent fix.** Three consecutive sessions found their worst defect inside the previous
  session's patch. Two defects on 2026-09-04 were found by writing the adversarial brief, not by re-reading.
- **A gate that reddens with no code change is reporting a change in the world** (`FINDINGS.md#A20`).
  Triage it as evidence before suspecting the test.
- **Ask for an adversarial reviewer.** The owner will launch a second expert in any folder on request, and
  says so explicitly. Asking is expected, not an imposition.

## Shape, and what may not be simplified away

- `bin/comm.mjs` is the bus: no dependencies, short-lived, gated to 48 KB (A22) and to an import allowlist
  (A21). `bin/boot.mjs` and `bin/context.mjs` are **not** the bus — they spawn, and are outside both gates
  by design.
- A message carries a **pointer**, never content: `--ref` is required, there is no `--body`. The same rule
  governs process control — an agent name comes from `.comm/config.json`, never from message text.
- An agent's identity comes from its hook stub's location, never the session's cwd.
- A session resolves its own transcript through the registry the `SessionStart` hook writes
  (`bin/session-registry.mjs`, keyed on pid + start time), and **a miss REFUSES**. Not newest-mtime — wrong
  by 68 % the first time it met the field. Not the process's scratch directory — it names the session the
  process was *launched* as, so after a `/clear` it answers for a dead one (`FINDINGS.md#clear-blind`).
- Every hook path exits 0 on internal error: a broken bus must never break a session.
