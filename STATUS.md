# STATUS — Claude Toolbox, 2026-11-24 (sessions 4–33)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README, the carried ones into `FINDINGS.md#carried`.

## ▶ NEXT

*(2026-11-24 close: `2026-11-23.2` - work's 93: a relay's watcher that dies says so, and one dead without a word is seen from outside (a keeper, its stderr kept, a log of every relay that did not happen, a reaper at any Stop; `#relay-death`); the arming's replace judged by PHASE (A129 36 legs, A130 25 headless, 29 mutants). Nine adversarial reviews: rounds 5-7 found my own keyboard-hold patch worse than its race - removed (`LESSONS.md` §14). The 23h20 OOM that took the desktop: my gate ran outside `borne` on a September figure; it is 1-2.4 GB, its bench OUTSIDE `agents.slice` (§13). **WORK IS THE MAIN FIELD**; usage up to 100 %. 🔴 The owner's rules: after EVERY delivery docs, settings and skills current (measured in work's tree) and a letter to work (11-02); tests never wide while he works (11-05); an adversarial review after EVERY implementation or fix; anything over 1 GB only through `borne`, arranged with work (11-13) - the gate at ≥ 5 000 MB available, announced in one line (letters 96-107).)*

000000. **FIRST: `.2` at work.** Any `.comm/relay/*.json` there with a `died` or `crashed`: read its `.err` - the cause 93 could
   not give. A `died` on a LIVE watcher (its pid still `--after-turn` in /proc) is a false reap: a defect. **Then the replace path's
   named gaps** (`#relay-death`, rounds 8-9): the watcher notes "typing the /clear" UNDER THE RECORD'S LOCK, which the arming holds
   across its read and kill - that closes the microsecond; then "checking" may be replaced again, and a watcher of ANOTHER live
   session is never replaced. §14 first: the race's width and the mechanism's length, side by side. Arm it in A130 (its harness).
00000. **RAM, work's 97:** the bench's windows through `systemd-run --slice=agents.slice` so the whole gate fits `borne` (then its
   floor back to 2 500 MB), then the sessions of `launch`/`reopen`/the relay there too (§1, measure first); a memory alert mid-turn
   (§2: `PostToolUse` reads `MemAvailable`). And §13's control: a full `boot.mjs` refuses outside `agents.slice` or under 5 000 MB.
0000v. **The voice tool (owner, 11-28): scope only, NOT built** - `DESIGN-voice.md`: its loop, its measurements first, its open
   decisions. Built on his go, once those are settled; then a review, as for any delivery.
0000b. **Then §12's control** (a boot row when the installed Claude Code is newer than the last real-box run; `test/box-real.mjs`
   taking s9, `exchange/WIP-more-edge-probe-box-real-s9.mjs` - its s1, s2, s8 red on the release before too: triage first), **then
   work's 90 in its order:** 88 (`who` counts a `claude -p --bare`: `liveAgents`, `who.mjs`, keep it in `tree`; A22 has 279 B),
   85 §2 (`wake` says what a dialog shows), 85 §3 (ask work what is left), 84 §2 (`relay --model --effort`); **then work's 82 and
   its 81 §2.2** (its (b), the alarm of two sessions, must ignore a `--bare` too: 88). (a) `comm who` glues state and mail: `working1 pending`
   (`who.mjs`, inside A22: 279 B left); check its IDLE line with mail too. (b) **Two live sessions of one identity, said at
   SessionStart**, at the head of the hook's context: the other's pid, start time, its transcript's last write, its child
   processes. Measured at work 11-21: the owner opened a second leader believing the first closed; the first lived, idle,
   its three watchers as children, and only `comm who` said "2 SESSIONS SHARE THIS INBOX". Not tied to `.2`. **Then work's
   order (81 §3)**: the leader's watcher as a bus wait (bell, letter, usage, idle expert, memory floor, a dated task from
   its tsv), `.2`, a threshold with an end date, the usage readers, PreToolUse and its `cd` guard's removal; the `echo
   ===` guard is struck. Its tools to take: the night watcher, `remettre-seuils.mjs`, three usage readers, `shells.sh`,
   `veille-memoire.sh`, `garde-borne.mjs` after A110. Its own to keep: boot, relay and close tools.
0000a. **The rename (`2026-11-21.2`): what is left is the owner's call.** Renamed: titles, file headers, help, the boot's
   first line, the installer's messages, the version notice, the skill's description. **Kept, because something reads
   them:** the folder `~/Dev/claude-comm` (work's boot reads its `exchange/`; my memory folder is keyed on it), the GitHub
   repository's name, `.comm/`, `CLAUDE_COMM_*`, the skill id (the leader-expert skill names it), the `[claude-comm]` tag
   (the eraser, and a tool of work's, recognise bells by it). Changing any of those is a migration with a transition, not
   an edit. Its review: nothing here or in the 11 fields parses a renamed text; `comm.mjs` and `who.mjs` kept their bytes
   (A22 at 99.5 %, 279 B left). Named: this repo's own boot hook in `.claude/settings.json` still says `claude-comm:`
   when node is missing. **Work's 81 ordered `0a`: item 00000.**
0000. **`2026-11-21.1` (`#withdraw`, A127): what is left.** Work's first real withdrawal: ask what it printed. The
   review's named ⑥⑦⑧ (`#withdraw`). **The bench (`#bench-geometry`):** `stack` now; it still opens at the size kitty
   remembers - a tiny one would redden A121 and the relay arms again; its layout is printed, not gated. 🔴 My probe left
   kitty remembering 205x56 (GNOME will not shrink a minimized window): the owner's next new window opens at that size
   until he closes one of his own. Its mutants: none written yet - A127's keys are the first to mutate.
000. **`#hidden-head` (`2026-11-14.1`-`.5`, A125, A126) - what is left.** (a) `.5`'s mutants,
   `exchange/WIP-hidden-head-mutants-5.json` (74), an evening the owner is not on the machine, one at a time; (b) **a stall
   remembered across runs**, per window with the screen it froze on - first measure a real frozen Claude Code (SIGSTOP) in
   a minimized window: what get-text shows, whether keys queue; (c) the capped flow WITH the cursor on a real box that
   really shrinks; (d) the limits named in `#hidden-head`; (e) the bus's typing through `send-text --stdin`. Probes:
   `exchange/WIP-hidden-head-probe-*` (start at its `-README.md`). Work's 77: its relay passed on `.5`, 0 alerts.
00. **`2026-11-09.1` (`#usage-gate`, its gaps there).** Work has `"refuse": true`, `"reopen"` out for the owner's pause:
   no real reopening yet. `test/teams-real.mjs` 8/8 before changing launch, close or reopen. Suite 511-536 s on 11-24 with A129 (~23 s) and A130 (~12 s); its 600 s ceiling is gone - a hang is now 300 s of SILENCE (`#gate-silence`), so length no longer kills it: speeding it is carried C.
01. **`2026-11-08.1`'s MUTANTS NOT RUN** - an evening he is inactive (his word 11-08). `node test/mutate.mjs
   exchange/WIP-box-mutants.json --jobs N` (45, + A119-A123; 3 h 30 in series, measure a suite's peak before 4 wide). A
   survivor is an arm to strengthen. Waiting from work: `chef-ventes`'s needs (after 11-22); its recount of 43 came, 3 of 3. Later (its 44):
   `comm remind`, the relay carrying the last reply, `--from` limited to the roster. **Nothing rings me when work writes
   to `in/`**: I asked it to ring at every letter (58).
0. 🔴 **RESUME `2026-11-05.2`: built, reviewed, NEVER RUN, on the LOCAL branch `wip/2026-11-05.2`** (next-bell, heavy,
   the CLI's caller from its session, the xvfb bench). **The procedure: `exchange/WIP-next-bell-RESUME.md`.** 🔴 Main is 26
   commits past the branch (11 bin files, +2004 lines): its `git restore --source=` would take them back - MERGE.
0a. **After `.2`, the inventory's order** (`exchange/TOOLS-INVENTORY.md`): ③ the leader's watcher ④ usage readers (with
   leader-expert's `usage-sessions.py` if rigel agrees) ⑤ a threshold with an end date ⑥ the zsh `=` guard; then the
   PreToolUse hook the stub lacks (heavy's guard; the bus refusing to type into an agent's window). work's cd guard goes
   only after A110 is green on its tree. Its 32: a chief who leads a team without daily pairs - wait for its report.
0b. **Letters** for altair, deneb and atlas wait for their leaders: `node bin/exchange-bell.mjs --peer <channel> --ref <file>`.
1b. 🔴 **`selftest`'s real sessions load the machine's plugins** - the owner's Telegram server started at each run and took
   the bot (11-04). `test/box-real.mjs` runs with `--strict-mcp-config --mcp-config '{"mcpServers":{}}'` and every plugin
   off in `--settings`: the same flags for selftest, then arm it.
2. **Ctrl+Z in a shell-less window**: avoided, not detected. The native path (`#native-path`) would type nothing.
3. **A31 blames a live session's own `/clear`** (11-02): `#review15`'s twin for boot's control. Named in `#pairs`.
4. **`who`**: "IDLE, relay armed" (work's (c)); `working` while only a sub-agent runs (show `wake.readTurn`'s turn end).
   Both in `who.mjs`: the bus is at 93 % of A22.
5. **`channel:` prints "arrived 22h ago" for a letter 1 min old**: the NAME's date (`stampOfName`) - show the mtime.
6. **rigel's four memory ideas** (10-25): `claim --machine`, `launch --memory`, memory in `who`, "closed" vs "crashed".
   **Arm LESSONS §8** (a letter's written time ahead of its file's) **and §11** (a review round starts only on the
   previous one's green suite). The generated SKILL names every tool: unarmed. `boot --prove-red` is 1-1.6 h: make
   `#stranded-named`'s one-block harness be `--only` itself.
7. **A stopped batch leaves `/tmp/comm-attack-*`** (tmpfs; 449 folders deleted by the owner 11-09): say so when stopping
   one. Sweeping shared `/tmp` is his.

**Carried, each still open:** `FINDINGS.md#carried` - B (the registry half of #13 §1), C (tests faster), F (each
review's named points), the older carried list. Read it before claiming any is done. 🔴 **A33 red TWICE on unchanged bytes**, green on the next run (the 11-24 03h5x close 128/129, its rerun 129/129).
Likely variable, unconfirmed (boot cuts its detail at 150 chars): its control `naive.won > 1` needs a race to HAPPEN.
Triage before the next close: print its detail, run its block alone. **Done:** every release in `CHANGELOG.md`.

🔴 **THE OWNER'S RULE (09-27): no name of his personal projects in this PUBLIC repo** - every field has a codename here,
the mapping in no repo. The boot report prints REAL directory names: **never copy a `field:` row into a tracked file.** A
new field gets its codename and rule BEFORE its name is written; an expert's name is not written either. Enforced:
`bin/leak-check.mjs`, four git hooks, boot row `leak` (`FINDINGS.md#leak-check`).

🔴 **THE OWNER'S WINDOW RULE (09-19, 10-24): nothing a test opens lands in his view.** Every kitty arm runs in ONE
minimized bench: `bench()`/`benchRun()`/`besideMe()` in `test/attack.mjs`, never a bare `kitten @ launch`.

**The push is the leader's call** (2026-09-05), with installing into field trees - do not ask again.

## ⏭️ OPEN
1. **🔴 Latency is a mailbox, not an interrupt.** Re-derive with `node test/latency.mjs <log>`; never transcribe the
   table. Mail lands at the recipient's *turn boundary*; since 10-24 an IDLE recipient is rung at once by the sender's
   `PostToolUse` (213 ms, A90), a BUSY one waits for its turn end. Never call it real-time. A16.

8. **🟡 The autonomy mandate — self-launching experts, a self-rebooting leader.** Settled parts in
   [`DESIGN-autonomy.md`](DESIGN-autonomy.md), do not re-derive them. The consumer's defects are BOOT defects, not
   crowding defects. Built: launch, self-close (A46, A51), the self-relay (`#relay`, A95). The trigger stays the agent's,
   or its project's hook.

## ⚠️ What was NOT verified

🔴 **[`FINDINGS.md#not-verified`](FINDINGS.md#not-verified)** - moved for tier 0's byte cap, nothing retracted. Read it
before claiming anything about `close.mjs` under a real agent, the registry's `GONE` wording, `--release`,
`clear`-blindness, the git guard, the crossing, `selftest`'s behaviour half, `launch --minimized`, or anything non-Linux.

## Two conventions that erode silently

**Measurement traps** — a control not travelling the arms' code validates nothing; one that writes into, or INHERITS,
the world it measures is not a control (`FINDINGS.md#measurement-traps`). **Acknowledgements amend the protocol**
(`FINDINGS.md#ack-amendment`, `#bus-split`). **Conduct defects go in `LESSONS.md`**, and end as an armed gate.
**Findings live in the code**, at the point they apply.
