#!/usr/bin/env node
/**
 * claude-comm WAKE — make an idle agent take a turn, so the gated Stop path can deliver.
 *
 *   node bin/wake.mjs --root <project>        wake every agent that has mail waiting
 *   node bin/wake.mjs --resolve <pid>         diagnostic: which window is that session in?
 *   node bin/wake.mjs --root <p> --dry-run    resolve and rate-limit, send nothing
 *   node bin/wake.mjs --root <p> --agent <a>  that agent only - the line `send` prints as "ring now"
 *   node bin/wake.mjs --root <p> --json       the same answer as JSON (what close.mjs reads)
 *   node bin/wake.mjs --root <p> --agent <a> --until-rung   look again every minute until it can be rung (a refused ring starts this)
 *
 *   .comm/config.json  "freshRestart": ["scribe", "web"]   agents that may be restarted fresh before a ring (rule 7)
 *   .comm/config.json  "box": {"retryMs": 60000, "notifyAfterMs": 300000, "maxMs": 43200000}   how a blocked box is retried (rule 10)
 *   .comm/config.json  "notify": ["<cmd>", "<arg>"]   what tells the owner, the line appended; default notify-send (rule 10)
 *   .comm/wake/rings.jsonl                            every ring, append-only, whoever called - hooks included
 *   .comm/wake/notified.jsonl                         every time the owner was told, and what the command answered
 *
 * WHY THIS EXISTS. Measured over 26 real field deliveries: leader→expert median 1462 s,
 * expert→leader 586 s. The asymmetry is structural, because mail lands at the recipient's
 * TURN BOUNDARY — so **an agent that is alive but idle never receives its mail**, and
 * `who` showing "running" does not mean reachable. This bus is a mailbox, never an
 * interrupt, and nothing here changes that: the wake does not deliver anything. It makes
 * an idle session take a turn, and the turn's own Stop hook does the delivery that was
 * already gated.
 *
 * Eight rules, each of which is a way this could have been built wrong:
 *
 * 1. **RESOLVE, THEN SEND. NEVER `send-text --match` ON A GUESS.** `kitten @ send-text
 *    --match` **exits 0 when it matches nothing**, so a wake aimed at a session that is
 *    not there reads on screen exactly like a wake that worked — the silent no-op shape
 *    this project keeps finding. The target window is resolved first, by id, and a
 *    failure to resolve is a REFUSAL that says why.
 *
 * 2. **IDENTITY COMES FROM THE PID**, never from a window title or a cwd. A title is set
 *    by whatever is running; a cwd wanders with the Bash tool. The agent→pid map is
 *    `comm who --json` — the bus's own resolution, asked rather than reimplemented,
 *    because a second implementation of "which claude process is which agent" has already
 *    disagreed with the first twice in this project (review #5, F7 and G7).
 *
 * 3. **EVERY SOCKET, NEVER JUST `$KITTY_LISTEN_ON`.** kitty runs one process per OS
 *    window here, so that variable names a LOCAL world: from one project the panes beside
 *    you are reachable and another project's leader is not. A wake that consulted only
 *    it would resolve nothing for a cross-window target and, by rule 1's trap, say
 *    nothing about it.
 *
 * 4. **NO DAEMON, NO TIMER, NO WATCHER.** This is a short-lived process run from a hook
 *    that was already firing. The bus itself cannot do this at all — A21 forbids it
 *    `child_process`, which is exactly what stops it becoming a daemon — so the wake
 *    lives out here, beside it, and stays a program you run rather than a thing that runs.
 *
 * 5. **THE TEXT CARRIES NO SUBSTANCE.** It is a doorbell. The artifact is the file the
 *    message points at, and a wake that summarised it would put content on a path with no
 *    audit trail, which is the rule this whole project is built on.
 *
 * 6. **NEVER TYPE INTO A RUNNING TURN.** Text submitted while a session works is handed to
 *    the model INSIDE that turn, so a doorbell there is an interruption, not a bell. The
 *    session's own transcript says which it is (`turnState` — measured, not guessed), and a
 *    busy session is skipped without a ring being recorded.
 *
 * 7. **A COLD, BIG, IDLE AGENT IS RESTARTED FRESH BEFORE IT IS RUNG — IF IT OPTED IN, AND
 *    NEVER A LEADER.** Resuming a 600 k context after its 1 h cache expired re-writes all of it;
 *    a `/clear` keeps the process, its model, its effort and its window, and the agent rebuilds
 *    from its files. It counts only when the registry names a NEW transcript for the pid.
 *
 * 8. **NEVER TYPE INTO SOMEBODY'S WORDS.** Rule 6 asks whether the AGENT works; in a window a person
 *    talks in, an idle agent is exactly when they type to it. Only the screen knows: the input box must
 *    be on it, at rest and empty (`promptAtRest`, the relay's own reader), or nothing is typed and
 *    nothing recorded. A box holding only an earlier bell whose Enter was lost gets the Enter alone.
 *    `FINDINGS.md#bell-into-typing`, A98.
 *
 * 9. **ONE TYPIST AT A WINDOW, AND THE BUS'S TEXT NEVER STAYS IN A BOX.** Two rings 6 ms apart both passed the quiet
 *    check, which is a read and then a write, and a leader's box held two bells for ten hours (a field, 11-08). The whole
 *    of read-then-type is now inside `holdKeyboard`, machine-wide, because another project's bell rings the same window.
 *    `typeAndProve`: no Enter while anybody else's characters are in the box, the Enter waits until the box draws the text,
 *    the box is read again after it, and a lost Enter is pressed once more. What still will not go is ERASED by the ring that
 *    keeps looking (rule 10, a process no hook's 10 s can kill mid-way), and logged - the mail stays in the inbox. "It left the
 *    box" is claimed only of text the box was SEEN to hold. `busText` knows the bus's words however many, however cut; ONE
 *    character of anybody else's and it answers null, and nothing is touched. `FINDINGS.md#left-in-the-box`, A111, A112, A113.
 *
 * 10. **A REFUSAL THAT LASTS LEAVES THE WINDOW.** A person's draft, a dialog: rule 8 still refuses, and a refusal was
 *    silent, so an idle session with mail stayed asleep until somebody looked. Any ring about to type, or refused, starts one
 *    detached `--until-rung` per agent: a hook killed at 10 s leaves it behind. It looks again, ends as soon as the mail is
 *    taken or a turn runs (the usual case: one look, 15 s later), and past `notifyAfterMs` of refusals it tells the owner,
 *    once. `FINDINGS.md#left-in-the-box`, A114.
 */
import { readFileSync, writeFileSync, appendFileSync, renameSync, readdirSync, mkdirSync, existsSync, statSync, openSync, readSync, closeSync, readlinkSync, linkSync, unlinkSync } from "node:fs"
import { join, dirname, basename } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { spawnSync, spawn } from "node:child_process"

const ARGV = process.argv.slice(2)
const has = (f) => ARGV.includes(f)
const opt = (f, d = null) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] !== undefined ? ARGV[i + 1] : d }

// A wake is a doorbell, and a doorbell rung twice a second is a fault. This is not a
// timer — nothing sleeps — it is a written record of the last ring, consulted by the next
// hook that happens to fire.
const QUIET_MS = 120_000

const ppidOf = (pid) => {
	try {
		const st = readFileSync(`/proc/${pid}/stat`, "utf8")
		return Number(st.slice(st.lastIndexOf(")") + 2).split(" ")[1]) || 0
	} catch { return 0 }
}

/** Every kitty window this user can reach, from every socket. Rule 3. */
export function windows() {
	let socks = []
	try { socks = readdirSync("/tmp").filter((f) => /^kitty-\d+$/.test(f)).map((f) => `/tmp/${f}`) } catch {}
	const out = []
	for (const sock of socks) {
		const r = spawnSync("kitten", ["@", "--to", `unix:${sock}`, "ls"], { encoding: "utf8", timeout: 5000 })
		if (r.status !== 0 || !r.stdout) continue
		let tree = []
		try { tree = JSON.parse(r.stdout) } catch { continue }
		for (const osw of tree) for (const tab of osw.tabs || []) for (const w of tab.windows || []) {
			// `tab` and `vars` are carried for bin/close.mjs, which has to answer two
			// questions this list is the only source for: did the split land in the
			// CURRENT tab, and was this window opened by launch.mjs at all. Adding them
			// here rather than reading `ls` a second time keeps one implementation of
			// "which kitty window is that" - the rule this file's own rule 2 states.
			out.push({ sock, osWindow: osw.id, tab: tab.id, id: w.id, shellPid: w.pid,
				vars: w.user_vars || {},
				fg: (w.foreground_processes || []).map((p) => p.pid) })
		}
	}
	return out
}

/**
 * Which window is this pid running in? Two ways, both structural, neither a title.
 *
 * `window.pid` is the SHELL, not the agent — the agent is in `foreground_processes` —
 * so the direct match is against that list. The ancestor walk is the fallback for a
 * session started through wrappers, where the shell is several hops up.
 */
export function resolveWindow(pid, wins = windows()) {
	if (!pid) return { ok: false, why: "no pid to resolve" }
	const direct = wins.find((w) => w.fg.includes(pid))
	if (direct) return { ok: true, win: direct, how: "foreground process" }
	const chain = []
	let p = pid
	for (let i = 0; i < 32 && p > 1; i++) { chain.push(p); p = ppidOf(p) }
	const byAncestor = wins.find((w) => chain.includes(w.shellPid))
	if (byAncestor) return { ok: true, win: byAncestor, how: "ancestor of the window's shell" }
	return { ok: false, why: `pid ${pid} is in no kitty window on any of ${wins.length} window(s) this user can see` }
}

const quietPath = (root, agent) => join(root, ".comm", "wake", `${agent}.json`)
function lastWake(root, agent) {
	try { return JSON.parse(readFileSync(quietPath(root, agent), "utf8")) } catch { return null }
}
function noteWake(root, agent, rec) {
	try {
		mkdirSync(join(root, ".comm", "wake"), { recursive: true })
		writeFileSync(quietPath(root, agent), JSON.stringify(rec) + "\n")
	} catch {}
}

// THE RING HISTORY, append-only. The record above is ONE per agent, OVERWRITTEN by whoever rings, so on
// 2026-09-13 a doorbell at 12:50:25Z was typed and no file on this machine could say who rang it: a record
// older than the event cleared three trees, and a wake spawned by a Stop hook leaves no transcript at all -
// it is not a tool call and it runs with `stdio: "ignore"` (atlas's catch). So the history is written HERE,
// by the one program that types, and every caller is in it, hooks included: `caller` is the parent's command
// line. One generation is kept past 1 MB; a ring is rate-limited to one per QUIET_MS per agent, so that is days.
export const historyPath = (root) => join(root, ".comm", "wake", "rings.jsonl")
const HISTORY_MAX = 1 << 20
const callerOf = () => {
	try { return readFileSync(`/proc/${process.ppid}/cmdline`, "utf8").split("\0").filter(Boolean).join(" ").slice(0, 160) || null } catch { return null }
}
function noteRing(root, rec) {
	try {
		const p = historyPath(root)
		mkdirSync(dirname(p), { recursive: true })
		try { if (statSync(p).size > HISTORY_MAX) renameSync(p, join(dirname(p), "rings.1.jsonl")) } catch {}
		appendFileSync(p, JSON.stringify({ ...rec, caller: callerOf() }) + "\n")
	} catch {}
}

/**
 * The doorbell. Rule 5: it names no file, quotes no note, and summarises nothing.
 *
 * And it gives NO INSTRUCTION, which the first version got wrong. It said "run
 * `comm inbox`", and the live test showed exactly what that buys: the woken agent went
 * hunting, discovered that `comm` on PATH is **coreutils' comm**, dug around for the real
 * bus, and dismissed the message by hand. The delivery logged `via: "dismiss"` instead of
 * `via: "hook"` - so the wake had bypassed the one path that is gated, measured and
 * proved able to go red, in favour of an agent improvising.
 *
 * The whole point is that the agent does NOT fetch its own mail. It takes a turn; the
 * turn ends; the Stop hook delivers. So the text asks for nothing at all.
 *
 * ── 🔴 AND FOR ONE RELEASE IT DID, WHICH THE COMMENT ABOVE FLATLY DENIED ───────────────
 *
 * The shipped text was:
 *
 *   "…Nothing to do and nothing to fetch: acknowledge briefly and end your turn, and the
 *    bus will hand it to you as this turn closes."
 *
 * **It asked for two things and promised a third**, directly under a comment saying it
 * asked for nothing at all — and nothing tested it: `NUDGE` appeared at its definition and
 * its use, in no arm. Reported 2026-09-11 by the `atlas` field leader, who paid for both
 * halves:
 *
 * 1. 🔴 **A CONDUCT INSTRUCTION ARRIVING IN THE OWNER'S CHANNEL.** The doorbell is typed
 *    into the session's input, where the human's words appear. *"acknowledge briefly and
 *    end your turn"* is indistinguishable from the owner saying so, and **a well-disciplined
 *    agent obeys its owner.** He obeyed it twice. ⭐ The text was exploiting the very
 *    discipline that makes an agent useful.
 * 2. 🔴 **A PROMISE THE BUS CANNOT KEEP.** *"the bus will hand it to you as this turn
 *    closes"* holds only at a CLEAN turn boundary. When turns run together — the owner
 *    speaks, another doorbell lands — that boundary never arrives and the mail sits. His
 *    report waited hours, and it carried 29 offers already written to a database and five
 *    decisions waiting on him: **work already done that he did not know he had.**
 *    ⚠️ **An unkept promise is worse than silence, because it excuses the reader from
 *    checking.** That sentence is his, and it is the whole finding.
 *
 * ⇒ The text now states a FACT, names the BUS as its source so it cannot be read as the
 * owner's instruction, and **names a verb that does not consume** — because removing the
 * promise without naming a way to check would be this project's own signature defect, a
 * guard that is right and whose output carries nothing you can act on. `comm inbox` PEEKS;
 * it is `dismiss` that acknowledges, and the doorbell does not mention it. A52.
 */
export const NUDGE = "[claude-comm] doorbell. This line is from the BUS, not from your owner, and it states a " +
	"FACT rather than asking you for anything: mail is waiting for you. It is handed over at a turn " +
	"boundary, which may not be this one. If you need to know whether it is still waiting, " +
	"`comm inbox` tells you and consumes nothing."

// ── RULE 6: NEVER TYPE INTO A RUNNING TURN ─────────────────────────────────────────────────
//
// `send-text` + Enter into a session that is WORKING is not a doorbell: Claude Code queues the
// text and hands it to the model inside that turn - "sent a new message while you were
// working". Measured 2026-09-13 in the atlas field: 18 of 35 doorbells in one day, one of
// them interrupting `scribe` the instant its leader woke `web`. And it bought no delivery a skip
// would have lost: of 107 mid-turn doorbells with mail waiting, the turn's own Stop delivered
// it, or the agent took it, or - 39 times - the turn had already been blocked once, its Stop
// could not deliver (`stop_hook_active`), and a LATER ring at rest did. FINDINGS.md#wake-mid-turn
//
// The instrument is the session's own transcript, found through the registry. Not CPU, and not
// how long the file has been quiet: quiet overlaps completely (a mid-turn doorbell's p90 is 36 s
// of silence, a resting one's p10 is 38 s). What decides is the LAST DECISIVE ROW IN FILE ORDER,
// because that is what a reader holds at the instant it rings - Claude Code writes a model
// message when it ENDS, stamped with when it began. Measured against Claude Code's own verdicts
// on 1 228 typed prompts, 478 inputs it queued mid-turn and 697 queue outcomes: every queued
// input read busy; one prompt that never got a reply read busy too. Each clause in rowVerdict
// is a row shape that measurement named.

const textOf = (c) => typeof c === "string" ? c : !Array.isArray(c) ? "" : c.map((x) => x.type === "text" ? x.text
	: x.type !== "tool_result" ? "" : typeof x.content === "string" ? x.content
	: Array.isArray(x.content) ? x.content.map((y) => y.text || "").join("") : "").join("")
const hasToolResult = (c) => Array.isArray(c) && c.some((x) => x.type === "tool_result")
// AN INTERRUPTION IS A ROW THAT *IS* THE MARKER: a text row that begins with it, or a tool result whose WHOLE content it
// is - never a tool's output that merely QUOTES it. 2026-10-24, live: the leader read review/REVIEW-19.md, which quotes
// "[Request interrupted by user for tool use]", its tool result read "interrupted" - idle - in the middle of its turn,
// and a Stop hook typed the bell into that turn. On this machine 8 of 8 tool results containing the marker are such
// quotes, each followed by more of the same turn; no real interruption is written that way. FINDINGS.md#review19
const isInterruption = (c, t) => /^\s*\[Request interrupted/.test(t) && !hasToolResult(c) ||
	Array.isArray(c) && c.some((x) => x.type === "tool_result" && /^\s*\[Request interrupted by user[^\]]*\]\s*$/.test(textOf([x])))

/** "idle", "busy", or null when the row decides nothing. */
export function rowVerdict(r) {
	if (!r || r.isSidechain) return null
	// A closed turn. Every other system row - the Stop hook's summary, an away summary, a local
	// command - decides nothing.
	// ...and a scheduled task FIRES a turn (review #19 §2a: 32 s blind before its first reply was written).
	if (r.type === "system") return r.subtype === "turn_duration" ? "idle" : r.subtype === "scheduled_task_fire" ? "busy" : null
	// An API error or a usage limit ends the turn with a synthetic reply and no turn_duration.
	if (r.type === "assistant") return r.isApiErrorMessage || r.message?.model === "<synthetic>" ? "idle" : "busy"
	if (r.type !== "user") return null
	// A compaction's SUMMARY is a `user` row nobody typed, and it is written at rest as often as mid-turn: 30 of the
	// 35 on this machine (2026-10-24) were "Compacted while idle" and each read busy here, so no bell rang them for
	// hours (work 10-11 and 10-24, deneb 10-11). It decides nothing; the row before it does - the closed turn,
	// or the turn the compaction cut into. FINDINGS.md#compacted-at-rest
	if (r.isCompactSummary) return null
	const c = r.message?.content, t = textOf(c)
	if (isInterruption(c, t)) return "idle"
	// Meta rows are written at rest (a permission granted, a rename) EXCEPT these, each followed by
	// a model turn every time it was seen: a Stop hook block (257) and two usage-limit resumes (9);
	// and since the runtime's own cross-session messages, "Another Claude session sent a message" -
	// 303 of 303, 2026-10-24. Unread, it was 13 of the 23 inputs turn-corpus found absorbed by a turn
	// this reader called ringable. FINDINGS.md#compacted-at-rest
	// Review #19 §2a, measured 10-24: a skill a slash command launches ("Base directory for this skill", 79 of 79) and the
	// runtime's own idle notice (1 of 1) start a model turn too. A false busy costs a later ring; a false idle types into work.
	if (r.isMeta) return /^\s*(Stop hook feedback:|You can continue now|Your claude\.ai usage limit has reset|Another Claude session sent a message|Base directory for this skill|\[Cross-session idle notice\])/.test(t) ? "busy" : null
	// A slash command runs no model turn. A `!` shell command DOES: every one measured.
	if (!hasToolResult(c) && /^\s*(<command-name>|<command-message>|<local-command-)/.test(t)) return null
	return "busy"
}

/**
 * The state of a transcript, rows oldest first:
 *   idle    the last turn closed, or none has started
 *   ending  a reply ended and its Stop hook has not reported: a bell rung now is queued and
 *           REPLAYED as the next prompt once the turn closes (5 of 5 dequeued, 6 replays 50-82 ms
 *           after turn_duration), so it lands inside nothing
 *   busy    anything else - a Stop hook that blocked included: the model is answering it
 * `row` is null when no row decided, which tells a tail reader to look further back.
 */
export function turnState(rows) {
	let stopReported = false
	for (let i = rows.length - 1; i >= 0; i--) {
		const r = rows[i]
		if (r && r.type === "system" && r.subtype === "stop_hook_summary") stopReported = true
		const v = rowVerdict(r)
		if (!v) continue
		if (v === "busy" && r.type === "assistant" && r.message?.stop_reason === "end_turn") return { state: stopReported ? "busy" : "ending", row: r }
		return { state: v, row: r }
	}
	return { state: "idle", row: null }
}

/**
 * The session's last real API call: when it was made and the context it carried - `input_tokens` +
 * `cache_read_input_tokens` + `cache_creation_input_tokens`, what atlas read by hand. A subagent's call is
 * another cache prefix, and an error or a synthetic reply made no call: none of them count. null when none.
 * The row's timestamp is when the request BEGAN, which is when the cache was last written or read.
 */
export function lastCall(rows) {
	for (let i = rows.length - 1; i >= 0; i--) {
		const r = rows[i]
		if (!r || r.type !== "assistant" || r.isSidechain || r.isApiErrorMessage || r.message?.model === "<synthetic>") continue
		const u = r.message?.usage, at = Date.parse(r.timestamp)
		if (!u || Number.isNaN(at)) continue
		return { at, context: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) }
	}
	return null
}

function describe({ state, row }) {
	if (!row) return "no turn in the transcript yet"
	const c = row.message?.content, t = textOf(c)
	const what = row.type === "system" ? "the turn closed"
		: row.type === "assistant" ? (row.isApiErrorMessage || row.message?.model === "<synthetic>" ? "the turn ended on an error"
			: row.message?.stop_reason !== "end_turn" ? "a tool call"
			: state === "busy" ? "a Stop hook blocked and the model is answering it" : "a reply ended, its Stop hook still running")
		: isInterruption(c, t) ? "interrupted by the user"
		: hasToolResult(c) ? "a tool result"
		: row.isMeta ? "a Stop hook block or a resumed turn"
		: /^\s*<bash-/.test(t) ? "a ! shell command" : "a prompt"
	const at = Date.parse(row.timestamp)
	return `last transcript row: ${what}${Number.isNaN(at) ? "" : `, ${Math.max(0, Math.round((Date.now() - at) / 1000))}s ago`}`
}

/**
 * The state of the session a pid runs, read through the registry's `lookup` - the one answer
 * to "which transcript is this pid writing" (FINDINGS.md#clear-blind). `unknown` when it cannot
 * say, and the caller then rings AS IT ALWAYS DID and says so: skipping on a guess would leave
 * an idle agent's mail waiting, which is the failure this whole file exists to remove.
 */
export function readTurn(pid, lookup) {
	if (typeof lookup !== "function") return { state: "unknown", why: "no session registry beside wake.mjs" }
	const hit = lookup(pid)
	if (!hit.ok) return { state: "unknown", why: hit.why, unregistered: true }
	let size
	try { size = statSync(hit.transcript).size } catch (e) {
		// FINDINGS.md#no-turn-yet: a session that has taken no turn has no transcript at all.
		return e.code === "ENOENT" ? { state: "idle", why: "no transcript yet - the session has taken no turn" }
			: { state: "unknown", why: `transcript unreadable (${e.code})` }
	}
	let fd
	try {
		fd = openSync(hit.transcript, "r")
		// A tail, grown until a row decides: one tool result can outweigh any first guess.
		for (let n = 1 << 16; ; n *= 4) {
			const len = Math.min(n, size)
			const buf = Buffer.alloc(len)
			readSync(fd, buf, 0, len, size - len)
			const lines = buf.toString("utf8").split("\n")
			if (len < size) lines.shift()
			const rows = []
			for (const l of lines) { if (l) try { rows.push(JSON.parse(l)) } catch {} }
			const t = turnState(rows), call = lastCall(rows)
			// Rule 7 needs the last call too, and it can sit behind the decisive row: grow until both are held.
			if ((t.row && call) || len === size) return { state: t.state, why: describe(t), call }
		}
	} catch (e) {
		return { state: "unknown", why: `transcript unreadable (${e.code || e.message})` }
	} finally {
		if (fd !== undefined) try { closeSync(fd) } catch {}
	}
}

// ── RULE 7: A COLD, BIG, IDLE AGENT IS RESTARTED FRESH BEFORE IT IS RUNG ───────────────────────────
//
// Asked by the owner 2026-09-13 through atlas's leader - (paraphrased: waking an agent an hour later at 600k
// tokens would cost a fortune for nothing) - and built on his answer: "Build it, opt-in". Every number is measured on
// this machine's transcripts, none chosen by feel. FINDINGS.md#cache-lives-an-hour, #fresh-restart
//
// · AGE. Every call writes the 1 h cache (29 101 of 29 120). Resumed after 10-60 min: 0 of 315 cold; after 60
//   min: 53 of 55. Inside the hour a clear throws away a warm cache - atlas's `scribe` took five turns 5-10 min
//   apart that day, each cheap, and a clear on every bell would have cost ≈ 90 000 per turn for nothing.
// · CONTEXT. A fresh start is not free. Over 82 field-expert starts, the first 10 calls - the protocol re-read
//   and the brief taken; atlas's hand measure landed there, scribe ≈ 90 k, web ≈ 125 k - cost as much as a cold
//   resume of a context of median 104 k, p90 143 k, MAX 300 k (priced at the published multipliers: 1 h cache
//   write 2×, read 0.1×, output 5× input - multipliers read, not measured here). 300 000 is that max: above it a
//   clear pays on every start measured, even counting nothing the resumed session would have re-read after.
//   Below it the waste stays - the direction this may be wrong in, since a clear also drops whatever an agent
//   failed to write down.
// · WHO. Opted in BY NAME in .comm/config.json, and NEVER a leader, whatever that list says: a leader's window
//   is where the owner talks, and part of that conversation is written nowhere yet (atlas, 2026-09-13). The
//   agent at the project root is a leader for this purpose.
// · PROOF. `send-text` exits 0 doing nothing. Measured live 2026-09-13 in a throwaway project: `/clear` typed
//   exactly this way ran the command, the SessionStart hook recorded a NEW transcript for the same pid 560 ms
//   later with source "clear", and model and effort survived (claude-sonnet-5 / low, the process is kept). So a
//   clear counts only when the registry names a new transcript, and nothing is typed when it cannot be proved.
// · THE HUMAN'S LINE. Same run: `hello` half-typed, then `/clear` + Enter, was SUBMITTED as the prompt
//   "hello/clear" and the agent took a turn. The doorbell always had that exposure (#doorbell-shares-the-human-
//   s-line) and a clear adds none - the line is submitted once either way - but a ring on top would be a second
//   message into the turn it started, so an unconfirmed clear re-reads the turn before ringing.
export const FRESH_AGE_MS = 60 * 60_000
export const FRESH_MIN_CONTEXT = 300_000
const FRESH_CONFIRM_MS = 4000

/** Rule 5's text for a session the bus has just cleared. A fact, a source, no order, no promise - A52. */
export const FRESH_NUDGE = "[claude-comm] doorbell. This line is from the BUS, not from your owner, and it states a " +
	"FACT rather than asking you for anything: the bus restarted this session fresh because it had been idle past " +
	"its cache lifetime, and mail is waiting for you. It may have been handed over as this session started; " +
	"`comm inbox` tells you whether any is still waiting and consumes nothing."

/** Rule 7's decision, pure: { clear, opted, why }. `turn` is readTurn's answer, `call` included. */
export function freshDecision(agent, cfg, turn, { now = Date.now(), ageMs = FRESH_AGE_MS, minContext = FRESH_MIN_CONTEXT } = {}) {
	const list = cfg ? cfg.freshRestart : undefined
	if (list === undefined) return { clear: false, opted: false, why: "not opted in" }
	if (!Array.isArray(list) || !list.every((x) => typeof x === "string"))
		return { clear: false, opted: false, why: "freshRestart in .comm/config.json is not a list of agent names, so nobody is opted in" }
	if (!list.includes(agent)) return { clear: false, opted: false, why: "not opted in" }
	const no = (why) => ({ clear: false, opted: true, why })
	if (agent === (cfg.leader || "leader") || (cfg.agents && cfg.agents[agent] === "."))
		return no("a leader is never restarted fresh, whatever freshRestart says")
	if (!turn || turn.state !== "idle") return no(`its turn reads ${turn ? turn.state : "unread"}, and only an idle session is restarted`)
	const c = turn.call
	if (!c) return no("no API call in its transcript yet")
	// EXACT numbers: rounded, 299 999 printed as "300 k, under the 300 k" - a line naming a number it did not test.
	const min = Math.floor((now - c.at) / 60_000), n = (x) => x.toLocaleString("en-US")
	if (now - c.at <= ageMs) return no(`last call ${min} min ago, its cache is still warm`)
	if (c.context < minContext) return no(`context ${n(c.context)}, under the ${n(minContext)} a fresh start pays back`)
	return { clear: true, opted: true, why: `context ${n(c.context)}, last call ${min} min ago` }
}

/**
 * Rule 7 for EVERY agent `freshRestart` names, mail or not — what `--dry-run` prints. atlas's catch, 2026-09-13: the
 * decision was computed only for agents with mail waiting, so a leader who had just opted five experts in ran
 * `--dry-run`, read "nothing is waiting", and could not check it. A name missing from the roster is said, not skipped.
 * `agents` is `who --json`'s; `turnOf(pid)` is readTurn. A66.
 */
export function freshReport(cfg, agents, turnOf, fresh = {}) {
	const list = cfg ? cfg.freshRestart : undefined
	if (list === undefined) return []
	if (!Array.isArray(list) || !list.every((x) => typeof x === "string")) return [{ agent: null, clear: false, why: freshDecision(null, cfg, null).why }]
	return list.flatMap((agent) => {
		const a = agents && agents[agent]
		if (!a) return [{ agent, clear: false, why: "not on the roster in .comm/config.json" }]
		if (!a.pids || !a.pids.length) return [{ agent, clear: false, why: "not running" }]
		return a.pids.map((pid) => ({ agent, pid, ...freshDecision(agent, cfg, turnOf(pid), fresh) }))
	})
}

const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** Type `/clear` and PROVE it: a new transcript for this pid in the registry, or nothing is claimed. relay.mjs's too. */
export function clearFresh(pid, lookup, send, confirmMs) {
	const before = typeof lookup === "function" ? lookup(pid) : { ok: false, why: "no session registry beside wake.mjs" }
	if (!before.ok) return { cleared: false, typed: false, why: `not restarted fresh: the registry cannot name its transcript (${before.why}), so a clear could not be proved and none was typed` }
	const a = send("/clear")
	if (a.status !== 0) return { cleared: false, typed: false, why: `not restarted fresh: send-text failed (${(a.stderr || "").trim().slice(0, 80)})` }
	send("\r")
	const t0 = Date.now()
	for (;;) {
		// A miss here is SessionStart between invalidating the old entry and writing the new one: keep looking.
		const h = lookup(pid)
		if (h.ok && h.transcript !== before.transcript) return { cleared: true, typed: true, why: `restarted fresh first, confirmed: the registry names a new transcript ${Date.now() - t0} ms later` }
		if (Date.now() - t0 >= confirmMs) return { cleared: false, typed: true, why: `clear not confirmed: the registry still names the same transcript ${confirmMs} ms later` }
		sleepSync(100)
	}
}

// ── AFTER THE TURN THAT ASKED: close.mjs's wait, and relay.mjs's ───────────────────────────────────────
// Moved here from close.mjs 2026-10-25 so the two deferred actions share ONE reading of "that turn has ended" (A89, A95).
// 🔴 REVIEW #19 §1: ONCE ARMED, NOTHING DISARMED IT. A new turn begun after the arming was WAITED OUT and the window went
// after it; an Esc read as the turn's end; mail delivered by the last turn's own Stop hook left the inbox empty, so the
// one cancellation never fired - and the record said "the turn that asked for the close ended" each time. So the wait
// reads only what the transcript GAINED since the arming (its size, taken by the call that armed it), and the turn that
// asked may only finish: its tool result, its last answer, its Stop, a turn_duration. ANYTHING else CANCELS and says
// what - a prompt, an Esc, a delivered message, a doorbell, a second turn, a /clear.
/** What the rows written since the arming say: { ended } once the asking turn closed, or { cancel: why }. */
export function sinceArming(rows, verdict = rowVerdict) {
	let ended = false
	for (const r of rows) {
		if (!r || r.isSidechain) continue
		if (r.type === "system" && r.subtype === "turn_duration") { if (ended) return { cancel: "a second turn ran after the one that asked" }; ended = true; continue }
		// A background task's notice arrives the same way and is nobody typing (a field's leader, 11-08 12:06Z: told so while
		// it was alone). It resumes the turn, so the relay is still cancelled: only the reason was wrong. A115
		if (r.type === "attachment" && r.attachment?.type === "queued_command") return { cancel: /^\s*<task-notification>/.test(String(r.attachment.prompt || "")) ? "a background task ended during the last turn and its notice resumed it" : "somebody typed into the session while its last turn ran" }
		const v = verdict(r)
		if (!v) continue
		const c = r.message?.content, tool = Array.isArray(c) && c.some((x) => x.type === "tool_result")
		// the asking turn's own remainder: the arming call's tool result, the final answer
		if (!ended && v === "busy" && (r.type === "assistant" || (r.type === "user" && tool))) continue
		if (v === "idle") return { cancel: "the turn was interrupted, or ended on an error - that is not a finished report" }
		if (r.type === "user" && r.isMeta) return { cancel: "mail was delivered into the session after the action was asked (its Stop hook blocked), or a turn resumed" }
		return { cancel: ended ? "a new turn began after the one that asked" : "a new prompt reached the session before its turn ended" }
	}
	return { ended }
}

/**
 * Block until the turn that armed a deferred action has ENDED and `graceMs` passed with nothing after it. Reads
 * `transcript` forward from `offset`, a row still being written is read on the next look. Returns { ended, waitedMs },
 * or why not: { cancel } (with `moved` for a /clear), { gone } (the session exited), { abandoned } (past `maxMs`).
 */
export function awaitTurnEnd({ pid, transcript, offset = 0, lookup = null, graceMs = 2000, maxMs = 30 * 60_000, what = "action" }) {
	const rows = [], armed = Date.now()
	let pos = offset, lastLook = 0
	const pull = () => {
		let fd
		try {
			const size = statSync(transcript).size
			if (size <= pos) return
			fd = openSync(transcript, "r")
			const buf = Buffer.alloc(size - pos)
			readSync(fd, buf, 0, buf.length, pos)
			const text = buf.toString("utf8"), cut = text.lastIndexOf("\n")
			if (cut < 0) return
			for (const l of text.slice(0, cut).split("\n")) if (l) try { rows.push(JSON.parse(l)) } catch {}
			pos += Buffer.byteLength(text.slice(0, cut + 1))
		} catch {} finally { if (fd !== undefined) try { closeSync(fd) } catch {} }
	}
	const said = (why) => why.replace("the action was", `the ${what} was`)
	for (;;) {
		pull()
		const v = sinceArming(rows)
		if (v.cancel) return { cancel: said(v.cancel) }
		if (v.ended) {
			sleepSync(graceMs)
			pull()
			const again = sinceArming(rows)
			if (again.cancel) return { cancel: `${said(again.cancel)} (in the grace)` }
			return { ended: true, waitedMs: Date.now() - armed }
		}
		// a /clear moves the session to a NEW transcript: the person is working in it
		if (typeof lookup === "function" && Date.now() - lastLook > 2000) {
			lastLook = Date.now()
			const h = lookup(pid)
			if (h.ok && h.transcript !== transcript) return { cancel: `the session moved to a new transcript (a /clear) after the ${what} was asked`, moved: true }
		}
		try { process.kill(pid, 0) } catch { return { gone: true } }
		if (Date.now() - armed > maxMs) return { abandoned: true }
		sleepSync(300)
	}
}

// ── IS THE PROMPT AT REST AND EMPTY? Read off the screen, because nothing else knows ─────────────────────
// The transcript says whether a TURN runs; only the screen says whether a PERSON has typed. Measured 2026-09-13: `hello`
// half-typed, then `/clear` + Enter, was submitted as the prompt "hello/clear". Measured 2026-10-25 on Claude Code 2.1.310
// with `kitten @ get-text --ansi` (FINDINGS.md#relay): the input is a box - a rule of `─`, a line `❯` + NBSP, a rule - near
// the bottom. Empty, the line after `❯ ` is nothing, or a placeholder drawn DIM (`\e[22;2m`, "Try …"); typed text is drawn
// plain. A dialog (trust, a permission) draws no such box. Every unknown shape reads as NOT at rest: a wrong "busy" costs
// one relay, a wrong "at rest" types into somebody's words.
const SGR = /\x1b\[[0-9;:]*m/g
const plain = (l) => l.replace(SGR, "")
const isRule = (l) => /^─{10,}\s*$/.test(plain(l).trim())
// A NAMED session (`claude -n`, `/rename`) draws its name INTO the top edge, `──…── name ─`, and keeps it across a /clear:
// a field's relay refused twice on 10-26 at a box empty and at rest (FINDINGS.md#relay, 2.1.310). The lower edge was
// measured untitled, so only the top accepts a title. A96
const isTopRule = (l) => isRule(l) || /^─{10,} .*\S ─+$/.test(plain(l).trim())
/** { ok: true } when the screen shows Claude Code's input box at the bottom, empty; else { ok: false, why }. */
export function promptAtRest(screen) {
	const lines = String(screen || "").split("\n")
	while (lines.length && !plain(lines[lines.length - 1]).trim()) lines.pop()
	let top = -1
	for (let i = lines.length - 1; i > 0; i--) if (/^❯[  ]/.test(plain(lines[i])) || plain(lines[i]) === "❯") { if (isTopRule(lines[i - 1])) { top = i; break } }
	if (top < 0) return { ok: false, why: "no input box on screen (a dialog, a menu, or not Claude Code's prompt)" }
	let bottom = -1
	for (let j = top + 1; j < lines.length; j++) if (isRule(lines[j])) { bottom = j; break }
	if (bottom < 0) return { ok: false, why: "the input box has no lower edge on screen" }
	// THE AGENTS' FOOTER IS NOT A DIALOG. Sub-agents running or just returned draw, under the two status lines, a blank, `● main`
	// and one `◯ <type>  <what>` each (a field's expert, 11-06, read off its screen), `↓ 2 more` past five (a real session, 2.1.319,
	// test/box-real.mjs s7): with 3 or more the count below passed 6 and an expert with designers at work could be neither relayed
	// nor rung. Only that exact run, at the very end. A115
	let below = lines.length - 1 - bottom, k = lines.length
	while (k - 1 > bottom && /^\s*(◯\s+\S|[↑↓]\s+\d+\s+more\s*$)/.test(plain(lines[k - 1]))) k--
	if (k < lines.length && k - 2 > bottom && /^\s*●\s+main\s*$/.test(plain(lines[k - 1])) && !plain(lines[k - 2]).trim()) {
		k--
		while (k - 1 > bottom && !plain(lines[k - 1]).trim()) k--
		below = k - 1 - bottom
	}
	if (below > 6) return { ok: false, why: `the input box is not at the bottom of the screen (${below} lines below it): something is drawn under it` }
	const rest = lines[top].replace(/^(\x1b\[[0-9;:]*m)*❯[  ]?/, "")
	// `typed` + `text`, every line of the box: wake must tell its OWN unsent bell from a person's words (rule 8)
	// `rows`: how many lines the box SHOWS between its edges, blank ones too - from 3 up it may hide its first ones (HIDES_FROM)
	const rows = bottom - top
	const text = [rest, ...lines.slice(top + 1, bottom)].map((l) => plain(l).trim()).filter(Boolean).join(" ")
	for (let j = top + 1; j < bottom; j++) if (plain(lines[j]).trim()) return { ok: false, typed: true, text, rows, why: "the input holds more than one line of text" }
	// An empty box is ONE line. Blank lines that fill it are a draft's (Shift+Enter), and in a box that hides its start the draft's
	// words may be above them: the review of #hidden-head typed a bell under one and the bell's end, in view, took its Enter.
	if (rows > 1 && !plain(rest).trim()) return { ok: false, typed: true, text: "", rows, why: "the input box shows only blank lines: a draft's, whose words may be above them" }
	if (!plain(rest).trim()) return { ok: true }
	// a placeholder: the text after the mark starts DIM (SGR parameter 2), and is the only text there
	if (/^\x1b\[(?:[0-9:]*;)*2(?:;[0-9:]*)*m/.test(rest)) return { ok: true, placeholder: plain(rest).trim().slice(0, 60) }
	return { ok: false, typed: true, text, rows, why: `somebody's text is on the input line: "${plain(rest).trim().slice(0, 40)}"` }
}

/** promptAtRest on the window's screen, read now. A screen that cannot be read is NOT at rest. */
export function screenAtRest(win) {
	const s = spawnSync("kitten", ["@", "--to", `unix:${win.sock}`, "get-text", "--ansi", "--match", `id:${win.id}`], { encoding: "utf8", timeout: 5000 })
	if (s.status !== 0 || s.error) return { ok: false, why: `its screen could not be read (kitten @ get-text ${s.error ? s.error.code : `exit ${s.status}`})` }
	return promptAtRest(s.stdout)
}
// A bell typed but never submitted (a field, 10-26: its text sat in the box, `comm sent` PENDING) is recognised whole,
// wrapped or not; anything more in the box is somebody's words.
const squash = (s) => String(s).replace(/\s+/g, "")
/** Is the box's text (promptAtRest's `text`, every line joined) exactly `want`, however Claude Code wrapped it? relay.mjs's too. */
export const sameText = (text, want) => typeof text === "string" && squash(text) === squash(want)

// ── A BOX THAT SHOWS ONLY ITS LAST LINES ───────────────────────────────────────────────────────────────────
// Claude Code draws at most max(3, rows/2 - the rows around it) lines of its input (`maxVisibleLines`, 3 its floor, read in
// 2.1.323's own code 11-13) and keeps the cursor's line in view: a longer text shows its LAST lines, the first ones above the
// box, with no mark that they are there - the `❯` stands on the first line SHOWN. A field's two experts, 11-13, windows of 17
// rows: the bell, 4 lines at 103 columns, showed 3. Every reading here took them for all of it: a fresh bell read as somebody's
// words in front of it (no Enter), each Ctrl+U as somebody typing when the hidden line came down into view - a ring a minute
// for 2 h, none rung, until the owner pressed Enter (FINDINGS.md#hidden-head). A box showing under 3 lines shows all its text;
// one showing 3 or more MAY hide its start, and nothing on the screen says which.
const HIDES_FROM = 3
/** May this reading (promptAtRest's) be the last lines of a longer text? */
export const mayHide = (s) => !!s && s.typed === true && s.rows >= HIDES_FROM
/** Does the reading show all of `want` - or, in a box that may hide its start, its end, CUT_MIN characters or more? relay.mjs's too. */
export const shows = (s, want) => !!s && s.typed === true && (sameText(s.text, want) ||
	(mayHide(s) && squash(s.text).length >= CUT_MIN && squash(want).endsWith(squash(s.text))))
/** Does the reading show the START of `want` - CUT_MIN of it, or all of a shorter one? A box whose cursor was sent to the start. */
export const startOf = (s, want) => { if (!s || s.typed !== true) return false; const q = squash(s.text), t = squash(want); return !!q && t.startsWith(q) && q.length >= Math.min(CUT_MIN, t.length) }
/** Is all the reading shows a piece of `want`: its start, or - in a box that may hide its start - any slice of CUT_MIN or more? */
export const pieceOf = (s, want) => {
	if (!s || s.typed !== true) return false
	const q = squash(s.text), t = squash(want)
	return !!q && (t.startsWith(q) || (mayHide(s) && q.length >= CUT_MIN && t.includes(q)))
}

// ── THE BUS'S OWN WORDS IN A BOX ──────────────────────────────────────────────────────────────────────────
// `sameText` on ONE bell answered "somebody's words" for two: a field's leader, 11-08, 01:43:06Z, two rings 6 ms apart, both
// recorded as rung, neither Enter taken. wake then refused it at 04:02Z as "a person typing", relay.mjs at 03:00Z, and the
// box stayed so until the owner came back at 12:04Z. Measured on a real session (2.1.319): that box reads one 626-character
// text, sameText(one bell) false (6/6). A cut piece must be long enough to prove itself: nobody types 40 characters of it.
const CUT_MIN = 40
const BELLS = [NUDGE, FRESH_NUDGE].map(squash)
// exchange-bell.mjs's sentence, its three fixed parts; between them, the two paths A35 checks there
const CROSS = ["[claude-comm]cross-projectdoorbell.Afileiswaitingforyouandthefileistheartifact—thisisonlythebell:",
	"—nothinginthismessageiscomputedorcurrentexceptthatpath,soreadthefile.Replyasafilein", "(thischannelisafileexchange,notabus)."]
// A path slot holds an ABSOLUTE path (exchange-bell.mjs resolves both), or nothing: once whitespace is squashed, "stop please"
// typed where a path goes was a path to a looser pattern, and erased (the review of #hidden-head). Begun INSIDE a path - a box
// whose hidden start cut it - any run of those characters, and only when the sentence's own words follow it.
const PATHLIKE = /^(?:[/~][\p{L}\p{N}_./~@+-]*)?/u, PATH_TAIL = /^[\p{L}\p{N}_./~@+-]*/u
const crossWhole = (x) => {
	let n = 0
	for (let i = 0; i < CROSS.length; i++) {
		if (!x.startsWith(CROSS[i], n)) return 0
		n += CROSS[i].length
		if (i < CROSS.length - 1) n += PATHLIKE.exec(x.slice(n))[0].length
	}
	return n
}
/** Is ALL of `x` the start of the exchange bell's sentence, cut anywhere? */
const crossCut = (x) => {
	let rest = x
	for (let i = 0; i < CROSS.length; i++) {
		if (CROSS[i].startsWith(rest)) return true
		if (!rest.startsWith(CROSS[i])) return false
		rest = rest.slice(CROSS[i].length)
		if (i < CROSS.length - 1) rest = rest.slice(PATHLIKE.exec(rest)[0].length)
		if (!rest) return true
	}
	return !rest
}
/**
 * From where in the exchange bell's sentence could `x` begin? What of `x` that covers - to the sentence's end, or all of `x` -
 * or 0. Only the sentence's own words count toward CUT_MIN: a path is something a person types.
 */
const crossSlice = (x) => {
	// `crossed`: the reading went THROUGH a path, the sentence's words on both sides of it - proof enough with KEPT of them, in a box
	// 30-47 wide where a path fills a line (the fifth review of #hidden-head: `bell: /home/…/LETTER.md — nothing in this message`)
	const walk = (i, part, n, fixed, crossed = false) => {
		const enough = () => fixed >= CUT_MIN || (crossed && fixed >= KEPT)
		for (;;) {
			const rest = x.slice(n)
			if (!rest.startsWith(part)) {
				if (!part.startsWith(rest)) return 0
				fixed += rest.length; n = x.length; break                               // x ends inside this part
			}
			n += part.length; fixed += part.length
			// the sentence's end, its last part WHOLE: proof enough, though a box that hid the rest leaves it 37 characters
			if (++i === CROSS.length) return enough() || part === CROSS[i - 1] ? n : 0
			const p = PATHLIKE.exec(x.slice(n))[0].length
			n += p
			if (n === x.length) break                                                 // x ends inside a path
			if (p && part.length) crossed = true
			part = CROSS[i]
		}
		return enough() ? n : 0
	}
	let best = 0
	for (let i = 0; i < CROSS.length; i++) {
		for (let j = 0; j < CROSS[i].length; j++) best = Math.max(best, walk(i, CROSS[i].slice(j), 0, 0))
		const p = i < CROSS.length - 1 ? PATH_TAIL.exec(x)[0].length : 0               // begun inside the path after part i
		// A PATH'S TAIL looks like that path's: the reply folder's ends with `/in` (exchange-bell joins it so), the letter's carries a
		// `/` or a file's extension. A draft quoting the closing words after plain words, then after `and/or`, was taken for the bell's
		// end (the second and third reviews of #hidden-head): squashed, any words are a run of path characters.
		// (the letter's own tail is free: 90 of the sentence's words follow it - a cut inside `.md` or a name with no extension, the fifth review)
		const tail = x.slice(0, p), tailOk = i + 1 === CROSS.length - 1 ? /(^|\/)in$|^n$/.test(tail) : true
		if (p && p < x.length && tailOk) best = Math.max(best, walk(i + 1, CROSS[i + 1], p, 0))
	}
	return best
}
/** How much of `x`, from its start, is ONE bell begun anywhere in it: up to that bell's end, or all of `x`. 0: none. */
const hiddenHead = (x) => {
	let best = crossSlice(x)
	for (const t of BELLS) {
		if (x.length >= CUT_MIN && t.includes(x)) return x.length
		for (let k = Math.min(t.length, x.length); k >= CUT_MIN && k > best; k--) if (x.startsWith(t.slice(-k))) { best = k; break }
	}
	return best
}

/**
 * Is ALL of the box's text the bus's? { bells: whole ones, cut: pieces among them } - or null, as soon as one character is
 * anybody else's. Whitespace-blind (Claude Code wraps), and a text a person typed around a bell is null: rule 8 stands.
 * A person who pastes a WHOLE bell and nothing else gets the same answer, and a bell states a fact: said, not guarded.
 * `hidden`: the box may hide its start (`mayHide`), so what it shows may begin anywhere inside a bell - only its FIRST piece,
 * and only once the text read as it stands is not the bus's. Anything after that piece is held to the same rule as ever.
 */
export function busText(text, { hidden = false } = {}) {
	if (typeof text !== "string") return null
	const s = squash(text)
	if (!s) return null
	const seen = ownWords(s)
	if (seen || !hidden) return seen
	// A BOX THAT MAY HIDE ITS START, erased a line at a time: its LAST piece may be any start of a bell once the bus's text before
	// it is proved - the line a Ctrl+U left, `nothing.[claude` (the review of #hidden-head, 4 widths of 8 stopped there).
	const whole = ownWords(s, { looseEnd: true })
	if (whole) return { bells: whole.bells, cut: true }
	const n = hiddenHead(s)
	if (n === s.length) return { bells: 0, cut: true }
	const rest = n ? ownWords(s.slice(n), { looseEnd: true, proven: true }) : null
	if (rest) return { bells: rest.bells, cut: true }
	// A HEAD UNDER CUT_MIN, the end of a bell, when what follows it is the bus's: the 11-08 box of two bells, a line starting
	// `ing.[claude-comm] doorbell`, stopped every erase (the same review, 106 of 117 widths). Its proof is what follows it.
	for (const t of [...BELLS, CROSS[CROSS.length - 1]]) for (let k = Math.min(t.length, s.length) - 1; k >= 1; k--) {
		if (!s.startsWith(t.slice(-k))) continue
		// a bell's start right after it, the two together CUT_MIN or more: the seam of two bells, `nothing.[claude-comm] doorbell. This`
		// in a box 30 wide (the fifth review of #hidden-head)
		const after = ownWords(s.slice(k), { looseEnd: true, proven: s.length >= CUT_MIN })
		if (after) return { bells: after.bells, cut: true }
	}
	return null
}
/**
 * busText's reading of a squashed, non-empty text, from its start. `looseEnd`: the last piece may be a start of a bell of any
 * length, once something before it - here, or `proven` by the caller - is the bus's.
 */
function ownWords(s, { looseEnd = false, proven = false } = {}) {
	let bells = 0, cut = false
	while (s) {
		const b = BELLS.find((t) => s.startsWith(t)), n = b ? b.length : crossWhole(s)
		if (n) { s = s.slice(n); bells++; continue }
		if (looseEnd && (proven || bells || cut) && (BELLS.some((t) => t.startsWith(s)) || crossCut(s))) { cut = true; break }
		// a piece: the start of a bell (cut where the next text begins), or its end
		let piece = 0
		for (const t of BELLS) { let i = 0; while (i < t.length && i < s.length && t[i] === s[i]) i++; if (i >= CUT_MIN && i > piece) piece = i }
		for (const t of BELLS) for (let k = Math.min(t.length - 1, s.length); k >= CUT_MIN && k > piece; k--) if (s.startsWith(t.slice(-k))) { piece = k; break }
		if (!piece && s.length >= CUT_MIN && crossCut(s)) piece = s.length
		if (!piece) return null
		s = s.slice(piece)
		cut = true
	}
	return { bells, cut }
}

/** Does `after` end with the start of `before` - KEPT characters of it at least, or all of a shorter one - under something new?
 * KEPT, not CUT_MIN: under 52 columns one line is under 40, and a box of 3 keeps one line (the fifth review of #hidden-head). */
const KEPT = 16
const keptUnder = (before, after) => {
	for (let k = Math.min(before.length, after.length - 1); k >= Math.min(KEPT, before.length) && k > 0; k--) if (after.endsWith(before.slice(0, k))) return true
	return false
}
/**
 * Erase text the bus has established as its own. Ctrl+U clears one VISUAL line, from the end - measured on a real session
 * (2.1.319): 12/12 emptied, no turn started, 626 -> 626 -> 600 -> 400 -> 198 -> empty. Asked again after every press: what
 * remains must be the START of what was there. Anything else is somebody typing, and it stops with their words untouched.
 * { erased, presses } or { erased: false, presses, why }.
 */
export function eraseOwn(read, send, isOurs, { pressMs = 150, presses = 60, own = "" } = {}) {
	// what is left, all of it in view, may be any START of the bus's text: of a bell, or of `own`, the text the caller typed
	// - or the bus's text read from its very top, its end any start of a bell (the line a press left: `…nothing.[`)
	const startOwn = (q) => (!!own && squash(own).startsWith(q)) || BELLS.some((t) => t.startsWith(q)) || crossCut(q) || !!ownWords(q, { looseEnd: true })
	const first = read()
	if (first.ok) return { erased: true, presses: 0 }
	if (!first.typed || !isOurs(first.text, first)) return { erased: false, presses: 0, why: "the box does not hold the bus's own text" }
	let before = squash(first.text), prev = first, n = 0, idle = 0, nudged = false
	while (n < presses) {
		send("\x15")
		n++
		sleepSync(pressMs)
		const now = read()
		if (now.ok) return { erased: true, presses: n }
		if (!now.typed) return { erased: false, presses: n, why: `the box went away while it was being erased: ${now.why}` }
		const after = squash(now.text)
		// blank lines are nobody's bell: a draft's, its words perhaps above them - and "" is the start of anything
		if (!after) return { erased: false, presses: n, why: "the box shows only blank lines: a draft's, left alone" }
		// TWO PRESSES THAT TOOK NOTHING: the cursor may be at the text's start - a ring killed between its Ctrl+A and its Ctrl+E, or a
		// dialog that took the Ctrl+E (the third review of #hidden-head). Two: a first press that takes nothing was measured on its own
		// (2.1.319, `#left-in-the-box`). Ctrl+E once - and the end it brings into view was never read: the box is read AGAIN and judged
		// as from the start, before any press (the fourth review: a person's words after the bell went with the next Ctrl+U).
		if (after === before) {
			prev = now
			if (++idle === 2 && !nudged) {
				send("\x05"); nudged = true; idle = 0
				sleepSync(pressMs)
				const e = read()
				if (e.ok) return { erased: true, presses: n }
				if (!e.typed || !squash(e.text) || !isOurs(e.text, e)) return { erased: false, presses: n, why: "the box's end, brought into view, is not the bus's own text - left alone" }
				before = squash(e.text); prev = e
			}
			continue
		}
		idle = 0
		// A BOX THAT HID ITS START: the press took its last line and a hidden one came down at its top - so the box may now show fewer
		// than 3 lines (measured, a real 102x13 box: a blank cursor line, then 2 lines). What it showed before must still be there,
		// UNDER the line that came down, unchanged: a word typed meanwhile lands at the end and breaks that, whatever any reading of
		// the words says (the second review of #hidden-head: "stop please" after a path). And the line that came down is the bus's.
		// Once the box shows all it holds, the same reading as below: a press can drop the blank cursor line AND bring a hidden one
		// down (the fifth review: two bells at widths 157-200, the relay's prompt at 102 columns, stopped there for good).
		const oursNow = isOurs(now.text, now) || (!mayHide(now) && startOwn(after))
		if (!before.startsWith(after) && !(mayHide(prev) && keptUnder(before, after) && oursNow)) return { erased: false, presses: n, why: "somebody started typing while it was being erased - their words were left alone" }
		// THE BOX NOW SHOWS ALL IT HOLDS, after one that may have hidden its start: what is left is read whole before its top line
		// can go. A short head taken for a bell's end on the way (`nothing.` in front of a bell) proves itself here, or the erase
		// stops with it in the box (the fourth review of #hidden-head).
		if (mayHide(prev) && !mayHide(now) && !oursNow) return { erased: false, presses: n, why: "what is left in the box, all of it in view, is not the bus's own text - left alone" }
		before = after; prev = now
	}
	return { erased: false, presses: n, why: `still text in the box after ${n} presses` }
}

// A box drew a 313-character bell in ~60 ms and took its Enter at once (real sessions, 11-02, 11-08). 1.5 s each: a screen
// read took ~1.5 s on a loaded machine. Every wait here can run inside a hook's 10 s: a kill mid-way leaves the text, and the
// ring that keeps looking, started before the first key, finds it (rule 10).
const SHOWN_MS = 1500, TAKEN_MS = 1500
/**
 * One reading of the box against `text`: empty, whole, partial (still being drawn), theirs, or unknown (a dialog, an unreadable
 * screen) - and `tail`: whole as far as a box that hides its start can show, its end in view, its start never seen.
 */
function boxAgainst(s, text) {
	if (s.ok) return "empty"
	if (!s.typed || !squash(s.text)) return "unknown"   // blank rows: a frame between two, never a reading of the text
	if (sameText(s.text, text)) return "whole"
	if (shows(s, text)) return "tail"
	return pieceOf(s, text) ? "partial" : "theirs"
}
/** After Ctrl+A in a box that hides its start: `start` once it shows the text's first lines, `theirs` if anything else shows, `gone`
 * if the box empties, `unseen` after `ms`. */
export function startInView(read, text, ms = SHOWN_MS, nap = 40) {
	for (let n = 1, t = Date.now(); ; n++, sleepSync(nap)) {
		const s = read()
		if (s.ok) return "gone"
		const noBox = !s.typed, blank = s.typed && !squash(s.text)
		if (s.typed && !blank) {
			if (startOf(s, text)) return "start"
			if (!pieceOf(s, text)) return "theirs"
		}
		// two reads at least: one screen read can take 1.5 s on a loaded machine, and its picture may be from before the key. Blank
		// rows still shown then are a draft's, in front of the text: somebody's (the fourth review of #hidden-head)
		// and no box at all then - a dialog, a screen that cannot be read - gets no Enter (the fifth review)
		if (n >= 2 && Date.now() - t >= ms) return blank ? "theirs" : noBox ? "nobox" : "unseen"
	}
}
/** Read the box until it is `empty` or `theirs`, or `takenMs` have passed: [the last state, the last reading]. */
function untilItLeaves(read, text, takenMs, nap) {
	for (const t = Date.now(); ; sleepSync(nap)) {
		const s = read(), st = boxAgainst(s, text)
		if (st === "empty" || st === "theirs" || Date.now() - t >= takenMs) return [st, s]
	}
}
/**
 * Type `text` and press Enter, and PROVE it left the box - rule 9.
 *   · NO ENTER WHILE ANYBODY ELSE'S CHARACTERS ARE IN THE BOX: it would submit them. The review of this very function measured
 *     it: keystrokes landing before the bell went out with it. Those words and the bell are left alone, and said.
 *   · THE ENTER WAITS UNTIL THE BOX DRAWS THE TEXT: a long text and its Enter read as one are a paste (#enter-in-the-paste).
 *     Not drawn in time: pressed as before, and what follows is not claimed.
 *   · "IT LEFT" IS ONLY SAID OF TEXT THE BOX WAS SEEN TO HOLD. An empty box after a text never seen, or a screen that cannot be read,
 *     is `unproved`: that was the field's "recorded as rung, not taken" all over again.
 *   · A lost Enter is pressed once more. Still there: `stays`, or erased when `erase` is set (only a process no hook can kill).
 * { typed, taken, unproved, stays, erased, mixed, shownMs, again, presses, why }
 */
export function typeAndProve(read, send, text, { shownMs = SHOWN_MS, takenMs = TAKEN_MS, nap = 40, erase = true } = {}) {
	const a = send(text)
	if (a && a.status !== 0) return { typed: false, taken: false, why: `send-text failed: ${(a.stderr || "").trim().slice(0, 80)}` }
	// THE CURSOR SENT TO THE START GOES BACK TO THE END before this returns with text in the box. Left at the start, every later
	// Ctrl+U takes nothing, and the ring that keeps looking is the field's loop again (the third review of #hidden-head: a hook ring,
	// both Enters lost, then 60 presses a minute for 12 h). Not into a box it cannot read: a dialog gets no key.
	let atStart = false
	const back = () => { if (atStart) { send("\x05"); atStart = false } }
	const mixed = (again) => { back(); return { typed: true, taken: false, mixed: true, again, why: "somebody's words are in the box with the bell: both left alone, and no Enter pressed on them" } }
	let shown = null, head = {}
	for (const t = Date.now(); Date.now() - t < shownMs; sleepSync(nap)) {
		const st = boxAgainst(read(), text)
		if (st === "theirs") return mixed(false)
		if (st === "whole") { shown = Date.now() - t; break }
		if (st === "tail") {
			// A BOX THAT HIDES ITS START shows the text's end. Ctrl+A brings its start into view - measured on a real 102x13 box, 2.1.323:
			// the start shown, Ctrl+E back to the end, Home/End nothing, and an Enter there submits it all. What a person typed in front
			// of it, since the box was read empty, is seen there and stops the Enter (the second review of #hidden-head). Not brought
			// into view (another version): rung as seen, its start unseen, and said - a bell that never rings is the defect this fixes.
			shown = Date.now() - t
			send("\x01")
			atStart = true
			const h = startInView(read, text, shownMs, nap)
			head = { headHidden: true, headSeen: h === "start" }
			if (h === "theirs") return { ...mixed(false), shownMs: shown, ...head }
			// emptied by something else at that moment: not rung by this ring, and not claimed - the next look reads the session
			if (h === "gone") { atStart = false; return { typed: true, taken: false, shownMs: shown, ...head, why: "the text left the box when its start was asked for - not rung by this ring" } }
			// no box on screen after the Ctrl+A (a dialog, an unreadable screen): no Enter, and no key - the next look finds the cursor
			if (h === "nobox") return { typed: true, taken: false, shownMs: shown, ...head, why: "its box went away when its start was asked for (a dialog?) - no Enter pressed" }
			break
		}
	}
	send("\r")
	// still in the box: whole, its end in view - or, the cursor at its start, its START (a person's first letter is not that)
	const still = ([st, s]) => st === "whole" || st === "tail" || (atStart && startOf(s, text))
	let last = untilItLeaves(read, text, takenMs, nap), again = false
	if (still(last)) { again = true; send("\r"); last = untilItLeaves(read, text, takenMs, nap) }
	const state = last[0]
	// a piece of the text that is not its start, after an Enter: the text left, and that is somebody's (a letter typed at once) -
	// and so is the cursor: no key for it (the fourth review of #hidden-head)
	const notOurs = state === "partial" && !still(last)
	if (notOurs) atStart = false
	if (state === "theirs" || notOurs) return { ...mixed(again), shownMs: shown, ...head }
	if (state === "empty" && shown !== null) return { typed: true, taken: true, shownMs: shown, again, ...head }
	if (state === "empty" || state === "unknown") return { typed: true, taken: false, unproved: true, shownMs: shown, again, ...head,
		why: state === "empty" ? "typed and Enter pressed, but the box was never seen to hold it" : "typed and Enter pressed, and the box could not be read afterwards" }
	back()
	if (!erase) return { typed: true, taken: false, stays: true, shownMs: shown, again, ...head, why: "its Enter was not taken, twice: the text is still in the box, and the ring that keeps looking clears it" }
	// its own text, CUT_MIN of it at least: one letter a person typed after a taken Enter is the start of anything
	const e = eraseOwn(read, send, (t, s) => pieceOf(s, text) && squash(t).length >= Math.min(CUT_MIN, squash(text).length), { own: text })
	return { typed: true, taken: false, shownMs: shown, again, ...head, erased: e.erased, presses: e.presses,
		why: e.erased ? "its Enter was not taken, twice: the text was erased and the mail stays in the inbox" : `its Enter was not taken, twice, and it could not be erased: ${e.why}` }
}

// ── ONE TYPIST AT A WINDOW ────────────────────────────────────────────────────────────────────────────────
// A file per WINDOW, in the user's runtime dir: wake from this project, wake from a timer, a peer project's exchange bell and
// a relay all type into the same box. link(2) publishes it whole or not at all. A holder that is dead, or whose pid now
// names another process, or that has held longer than any typist can (a relay's /clear and first prompt are bounded by
// 45 s), holds nothing: a hook killed at its 10 s leaves a file and no typist. A dir that cannot be made does not silence the
// bell: it types unguarded, as it did before this existed.
const HOLD_MAX_MS = 120_000
const startTick = (pid) => { try { const st = readFileSync(`/proc/${pid}/stat`, "utf8"); return st.slice(st.lastIndexOf(") ") + 2).split(" ")[19] } catch { return null } }
const holderAlive = (h, maxMs) => {
	if (!h || !h.pid || Date.now() - h.at >= maxMs) return false
	const tick = startTick(h.pid)
	return tick !== null && tick === h.tick
}
/** Claim `file`, or say who has it: { ok, release } / { ok: false, holder }. */
function claimFile(file, what, maxMs) {
	const body = JSON.stringify({ pid: process.pid, tick: startTick(process.pid), at: Date.now(), what })
	const tmp = `${file}.${process.pid}.tmp`
	try { writeFileSync(tmp, body) } catch { return { ok: true, unguarded: true, release() {} } }
	try {
		for (let tries = 0; tries < 3; tries++) {
			try {
				linkSync(tmp, file)
				return { ok: true, release() { try { if (readFileSync(file, "utf8") === body) unlinkSync(file) } catch {} } }
			} catch (e) { if (e.code !== "EEXIST") return { ok: true, unguarded: true, release() {} } }
			let h = null
			try { h = JSON.parse(readFileSync(file, "utf8")) } catch {}
			if (holderAlive(h, maxMs)) return { ok: false, holder: h.what }
			try { unlinkSync(file) } catch {}
		}
		return { ok: false, holder: "another typist" }
	} finally { try { unlinkSync(tmp) } catch {} }
}
/** The window's keyboard: { ok: true, release() } or { ok: false, holder }. relay.mjs's and exchange-bell.mjs's too. */
export function holdKeyboard(win, what) {
	let dir
	// the same dir from a session and from a cron with no XDG_RUNTIME_DIR, or it is two locks
	const uid = typeof process.getuid === "function" ? process.getuid() : "x"
	const base = process.env.CLAUDE_COMM_RUNTIME || process.env.XDG_RUNTIME_DIR || (existsSync(`/run/user/${uid}`) ? `/run/user/${uid}` : tmpdir())
	try { dir = join(base, "claude-comm", "typing"); mkdirSync(dir, { recursive: true }) } catch { return { ok: true, unguarded: true, release() {} } }
	return claimFile(join(dir, `${basename(String(win.sock))}-${win.id}.json`), what, HOLD_MAX_MS)
}

// ── A REFUSAL THAT LASTS LEAVES THE WINDOW ────────────────────────────────────────────────────────────────
const BOX_DEFAULTS = { retryMs: 60_000, notifyAfterMs: 5 * 60_000, maxMs: 12 * 3600_000 }
/** How long a blocked box is retried, the project's word over these defaults. relay.mjs's too. */
export function boxRules(cfg) {
	const b = (cfg && cfg.box) || {}, n = (k) => (Number.isFinite(b[k]) && b[k] >= 0 ? b[k] : BOX_DEFAULTS[k])
	return { retryMs: Math.max(50, n("retryMs")), notifyAfterMs: n("notifyAfterMs"), maxMs: n("maxMs") }
}
/** Has this window the owner's focus right now? kitty's own field, which is false for a window whose OS window is not focused. */
export function windowHasFocus(tree, id) {
	for (const o of tree || []) for (const t of o.tabs || []) for (const w of t.windows || []) if (w.id === id) return w.is_focused === true
	return false
}
/**
 * Tell the owner, outside the window: the project's `notify` command, else notify-send. It carries the agent and the reason,
 * never what is in the box. Its exit says the command ran, not that anybody read it (kitty-remote-control's lesson): the
 * record keeps what it answered and nothing here claims more. A project under the temp dir is a test's: the default command
 * never runs for it, because nothing a test does lands in the owner's view (STATUS.md, his rule); an arm names its own command.
 */
export function notifyOwner(root, cfg, agent, what) {
	const line = `${basename(root)} / ${agent} : ${what}`
	const custom = cfg && Array.isArray(cfg.notify) && cfg.notify.length
	const argv = custom ? [...cfg.notify, line] : ["notify-send", "-u", "critical", "-a", "claude-comm", "claude-comm", line]
	let answered = "not run: a test's project"
	if (custom || ![tmpdir(), "/tmp"].some((d) => String(root).startsWith(`${d}/`))) {
		const r = spawnSync(String(argv[0]), argv.slice(1).map(String), { stdio: "ignore", timeout: 5000 })
		answered = r.error ? r.error.code : r.status
	}
	try {
		mkdirSync(join(root, ".comm", "wake"), { recursive: true })
		appendFileSync(join(root, ".comm", "wake", "notified.jsonl"), JSON.stringify({ at: new Date().toISOString(), agent, what, command: argv[0], answered }) + "\n")
	} catch {}
	return answered
}

/**
 * Does the RUNTIME keep a record of this session - <config>/sessions/<pid>.json, the file who.mjs's turnOf reads its
 * status from (#native-path)? true / false, or null when it cannot say. false only on a POSITIVE absence (ENOENT).
 * The lookup is turnOf's own; it is not imported because who.mjs is the bus and is out of bytes (A22).
 */
export function runtimeRecord(pid) {
	let env = []
	try { env = readFileSync(`/proc/${pid}/environ`, "utf8").split("\0") } catch { return null }
	const val = (k) => (env.find((e) => e.startsWith(`${k}=`)) || "").slice(k.length + 1)
	let dir = val("CLAUDE_CONFIG_DIR") || (val("HOME") && join(val("HOME"), ".claude"))
	if (!dir) return null
	// a RELATIVE config dir is the SESSION's, resolved from its cwd - not from wake's (review #19 §8)
	if (!dir.startsWith("/")) try { dir = join(readlinkSync(`/proc/${pid}/cwd`), dir) } catch { return null }
	let rec
	try { rec = JSON.parse(readFileSync(join(dir, "sessions", `${pid}.json`), "utf8")) } catch (e) { return e.code === "ENOENT" ? false : null }
	// a record left by a DEAD session under a pid reused since is no record of this one (turnOf's own test, review #19 §8)
	let tick = null
	try { const st = readFileSync(`/proc/${pid}/stat`, "utf8"); tick = st.slice(st.lastIndexOf(") ") + 2).split(" ")[19] } catch {}
	return !(rec && rec.procStart !== undefined && tick && String(rec.procStart) !== tick)
}

export function wakeAgent(root, agent, pid, { dryRun = false, wins, turn = null, cfg = null, lookup = null, sendText = null,
	allowClear = true, confirmMs = FRESH_CONFIRM_MS, fresh = {}, started = runtimeRecord, screen = screenAtRest, watcher = false, onTyping = null } = {}) {
	const prev = lastWake(root, agent)
	// THE QUIET PERIOD GUARDS A RING THAT HAS NOT WORKED YET - not every ring. A recipient that took a turn AFTER the
	// last ring and is idle again has consumed it: a second message within 120 s was swallowed and nothing ever retried
	// it (a field, 09-27: a `done` sat 6 min, rung 102 s after another ring, its leader idle with no turn to come).
	// Only the unanswered ring still suppresses - its own turn will deliver everything waiting. A84, `FINDINGS.md#quiet-answered`
	// Rule 6 FIRST (review #16 §6): a session mid-turn was told "no turn taken since" by the quiet check below - the
	// right outcome for the wrong reason, and the reason is what the sender reads. Nothing is recorded, so the next hook
	// that fires looks again instead of waiting out QUIET_MS for a ring that never happened.
	if (turn && turn.state === "busy") return { agent, pid, sent: false, busy: true, turn: "busy", why: `mid-turn, not rung (${turn.why})` }
	// 🔴 NEVER TYPE INTO A SESSION THAT HAS NOT STARTED. A field, 2026-10-11: two experts launched into folders Claude
	// Code had never opened sat at its trust dialog, whose default is "❯ No, exit"; the leader's Stop hook rang them -
	// turn `unknown`, rung as before - and the Enter answered the dialog: both sessions exited, no transcript. Measured
	// 10-24 on a real session in an untrusted folder: at that dialog it has NO registry entry (SessionStart has not run)
	// AND no runtime record. Both witnesses, or this rings as before - a hookless session still has its runtime record.
	// Nothing is lost by waiting: a session's start delivers its mail. Not recorded, so the next hook looks again. A88.
	if (turn && turn.state === "unknown" && turn.unregistered && started(pid) === false)
		return { agent, pid, sent: false, turn: "unknown", turnWhy: turn.why, why: "not started yet: no registry entry and no runtime record - a session at a startup dialog (trust, login) takes a typed Enter as its answer, and the trust dialog's default is 'No, exit'" }
	// `ending` counts as answered too: a ring typed then is queued and replayed at the turn's close (turnState, 5/5).
	// `unknown` does not - a transcript we could not read vouches for nothing.
	const answered = prev && turn && (turn.state === "idle" || turn.state === "ending") && turn.call && turn.call.at > Date.parse(prev.at)
	const quiet = prev && !answered && Date.now() - Date.parse(prev.at) < QUIET_MS
		? { agent, pid, sent: false, why: `rung ${Math.round((Date.now() - Date.parse(prev.at)) / 1000)}s ago and no turn taken since, quiet period is ${QUIET_MS / 1000}s` } : null
	// The ring that keeps looking asks the box first: the bus's own text still there is a ring that did NOT work.
	if (quiet && !watcher) return quiet
	const seen = turn ? { turn: turn.state, turnWhy: turn.why } : {}
	// Rule 7, decided on the same read rule 6 used.
	const decision = freshDecision(agent, cfg, turn, fresh)
	const said = decision.opted ? { freshWhy: decision.why } : {}
	const r = resolveWindow(pid, wins)
	// Rule 1. A refusal, never a hopeful --match.
	if (!r.ok) return { agent, pid, sent: false, why: r.why, ...seen, ...said }
	if (dryRun) return { agent, pid, sent: false, dryRun: true, window: r.win.id, socket: r.win.sock, how: r.how, wouldClear: decision.clear, ...seen, ...said }
	// 🔴 RULE 9, ONE TYPIST (header): everything from the screen read to the last key is inside this. A ring that finds it
	// taken has nothing to add - the bell states one fact, and the turn it starts delivers everything waiting. Not recorded.
	const kb = holdKeyboard(r.win, `a bell for ${agent}`)
	if (!kb.ok) return { agent, pid, sent: false, ringing: true, why: `not rung: ${kb.holder} is typing into its window right now`, ...seen, ...said }
	try {
	// THE QUIET CHECK ABOVE READ BEFORE THE HOLD, so it is asked again inside it: a ring that typed and let go between the two
	// reads has noted itself, and this one would be the second bell, into the turn the first one started.
	const inHold = lastWake(root, agent)
	if (inHold && (!prev || inHold.at !== prev.at)) return { agent, pid, sent: false, ringing: true, why: `not rung: another ring landed ${Math.max(0, Date.now() - Date.parse(inHold.at))} ms ago`, ...seen, ...said }
	// 🔴 RULE 8, NEVER TYPE INTO SOMEBODY'S WORDS (header). Read after the refusals above, so they cost no screen read.
	// Not recorded, like rule 6: the next hook looks again, and a person who submits their own prompt has the mail handed
	// over at that turn's Stop. The sender is never told WHAT is typed there - it is somebody else's unsent text.
	const read = () => screen(r.win)
	const rest = read()
	const own = !rest.ok && rest.typed === true ? busText(rest.text, { hidden: mayHide(rest) }) : null
	// The Enter alone only on bells the box shows WHOLE: one that may hide its start may hide somebody's words above them.
	// Those are erased, a line at a time, each line read as the bus's before it goes, and one clean bell follows.
	const ownUnsent = !!own && !own.cut && !mayHide(rest)
	if (quiet && !own) return quiet
	if (!rest.ok && !own) return { agent, pid, sent: false, notAtRest: true, ...seen, ...said,
		why: `not rung, its input is not at rest: ${rest.typed ? "text is on its input line (a person typing, or a draft left there) - never typed into" : rest.why}` }
	// ONE CLEAR PER RUN. A Stop hook kills this process after 10 s, and a confirmation may wait 4: a second
	// clear could be typed and never proved or rung. The agent cleared first takes a turn, and ITS Stop hook
	// runs wake again for the next one. Not rung meanwhile - ringing it now is the cold resume rule 7 avoids.
	if (decision.clear && !allowClear && !own) return { agent, pid, sent: false, deferred: true, why: `a fresh restart is due (${decision.why}) and this run already typed one - left for the next turn boundary, not rung cold`, ...seen, ...said }
	const send = sendText ? (text) => sendText(r.win, text)
		: (text) => spawnSync("kitten", ["@", "--to", `unix:${r.win.sock}`, "send-text", "--match", `id:${r.win.id}`, text], { encoding: "utf8", timeout: 5000 })
	const ring = { at: new Date().toISOString(), agent, pid, window: r.win.id, turn: turn ? turn.state : null, cleared: null }
	const done = (rang, extra, quiet = true) => {
		if (quiet) noteWake(root, agent, { at: ring.at, agent, pid, window: r.win.id })
		noteRing(root, { ...ring, rang, ...extra })
	}
	// Before the first key: a hook killed at its 10 s from here on leaves the ring that keeps looking behind it (rule 10).
	if (onTyping) onTyping()
	// Earlier bells are the WHOLE box: their Enter was lost, so the Enter alone goes - never a /clear or a second bell on them.
	// Whether it went is read, not assumed: a box that still holds them is the next look's to erase, and gets one clean bell.
	let wiped = null
	if (ownUnsent) {
		const e = send("\r")
		if (e.status !== 0) return { agent, pid, sent: false, why: `send-text failed: ${(e.stderr || "").trim().slice(0, 80)}`, ...seen, ...said }
		let after = null
		for (const t = Date.now(); ; sleepSync(40)) {
			const s = read()
			after = s.ok ? "empty" : !s.typed ? "unknown" : busText(s.text, { hidden: mayHide(s) }) ? "stays" : "theirs"
			if (after === "empty" || after === "theirs" || Date.now() - t >= TAKEN_MS) break
		}
		if (after === "theirs") {
			done(false, { text: "enter", mixed: true }, false)
			return { agent, pid, sent: false, notAtRest: true, mixed: true, why: "not rung: somebody's words are in the box with the bell - both left alone", ...seen, ...said }
		}
		if (after !== "stays") {
			done(true, { text: "enter", resubmitted: true, bells: own.bells, ...(after === "unknown" ? { unproved: true } : {}) })
			return { agent, pid, sent: true, resubmitted: true, ...(after === "unknown" ? { unproved: true } : {}), window: r.win.id, socket: r.win.sock, how: r.how, ...seen, ...said }
		}
	}
	if (own) {
		// a hook's 10 s could kill an erase half-way, and leave a piece nobody can recognise: only the ring that keeps looking erases
		if (!watcher) {
			done(false, { stays: true, bells: own.bells, cut: own.cut }, false)
			return { agent, pid, sent: false, notAtRest: true, stays: true, why: "not rung: the bus's own text is in its box and the ring that keeps looking clears it", ...seen, ...said }
		}
		wiped = eraseOwn(read, send, (t, s) => !!busText(t, { hidden: mayHide(s) }))
		if (!wiped.erased) {
			done(false, { erasedOwn: false, presses: wiped.presses, why: wiped.why }, false)
			return { agent, pid, sent: false, notAtRest: true, ...seen, ...said, why: `not rung: the bus's own text is in its box and could not be erased (${wiped.why})` }
		}
		if (decision.clear && !allowClear) { done(false, { erasedOwn: true, presses: wiped.presses }, false); return { agent, pid, sent: false, deferred: true, erasedOwn: true, why: `its box was cleared of the bus's own text; a fresh restart is due (${decision.why}) and this run already typed one - left for the next turn boundary`, ...seen, ...said } }
	}
	let text = NUDGE, clearTyped = false
	if (decision.clear) {
		const c = clearFresh(pid, lookup, send, confirmMs)
		clearTyped = c.typed
		Object.assign(ring, { cleared: c.cleared, clearWhy: c.why, context: turn.call.context, lastCallAt: new Date(turn.call.at).toISOString() })
		if (c.cleared) text = FRESH_NUDGE
		else if (c.typed) {
			const again = readTurn(pid, lookup)
			if (again.state === "busy" || again.state === "ending") {
				done(false, { after: again.state })
				return { agent, pid, sent: false, cleared: false, clearTyped, clearWhy: c.why, ...seen, ...said,
					why: `${c.why}, and the session now reads ${again.state} (${again.why}): the keystrokes started a turn, probably on a half-typed line, so no ring goes on top` }
			}
		}
		// Its own word, typed under this hold, not taken: it does not stay (rule 9). Somebody's words after it are not touched.
		if (clearTyped && !c.cleared) eraseOwn(read, send, (t) => sameText(t, "/clear"))
		// the clear took up to `confirmMs`: rule 8 is asked again before the bell, as the relay asks before its prompt
		if (clearTyped) {
			const now = screen(r.win)
			if (!now.ok) {
				done(false, { after: "not at rest" })
				return { agent, pid, sent: false, notAtRest: true, cleared: ring.cleared, clearTyped, clearWhy: ring.clearWhy, ...seen, ...said,
					why: `not rung after the clear, its input is not at rest: ${now.typed ? "text is on its input line" : now.why}` }
			}
		}
	}
	const p = typeAndProve(read, send, text, { erase: watcher })
	if (!p.typed) {
		if (clearTyped) done(false, { sendFailed: true })
		return { agent, pid, sent: false, cleared: ring.cleared, clearTyped, clearWhy: ring.clearWhy, why: p.why, ...seen, ...said }
	}
	const what = { text: text === FRESH_NUDGE ? "fresh" : "nudge", shownMs: p.shownMs, ...(p.again ? { enterAgain: true } : {}), ...(wiped ? { erasedOwn: true, presses: wiped.presses } : {}), ...(p.unproved ? { unproved: true } : {}), ...(p.headHidden ? { headHidden: true, headSeen: !!p.headSeen } : {}) }
	if (!p.taken && !p.unproved) {
		// Not quiet: nothing was rung. A bell is typed only into an empty box, so this cannot pile up.
		done(false, { ...what, ...(p.stays ? { stays: true } : {}), ...(p.erased !== undefined ? { erased: p.erased } : {}), ...(p.mixed ? { mixed: true } : {}), why: p.why }, false)
		return { agent, pid, sent: false, notAtRest: true, ...(p.stays ? { stays: true } : {}), ...(p.erased ? { erased: true } : {}), ...(p.mixed ? { mixed: true } : {}), cleared: ring.cleared, clearTyped, clearWhy: ring.clearWhy, why: `not rung: ${p.why}`, ...seen, ...said }
	}
	done(true, what)
	return { agent, pid, sent: true, window: r.win.id, socket: r.win.sock, how: r.how, cleared: ring.cleared, clearTyped, clearWhy: ring.clearWhy, ...(wiped ? { erasedOwn: true } : {}), ...(p.again ? { enterAgain: true } : {}), ...(p.unproved ? { unproved: true, unprovedWhy: p.why } : {}), ...(p.headHidden ? { headHidden: true, headSeen: !!p.headSeen } : {}), ...seen, ...said }
	} finally { kb.release() }
}

/**
 * RULE 10: one per agent, detached, started before a ring types and by any ring refused. It looks again, by all the same rules, and
 * ends when the mail was taken or the session is gone or mid-turn (its Stop delivers), or when a ring is proved. Its first look is
 * soon, because the usual case ends there. Only it erases the bus's own text: no hook's 10 s can kill it half-way. Past
 * `notifyAfterMs` of refusals it tells the owner, once, and whenever it gives up. A block leaves two rows in rings.jsonl.
 */
async function keepTrying(root, agent, lookup) {
	const bus = join(root, ".comm", "bin", "comm.mjs")
	let cfg = null
	try { cfg = JSON.parse(readFileSync(join(root, ".comm", "config.json"), "utf8")) } catch { return }
	const rules = boxRules(cfg), t0 = Date.now()
	try { mkdirSync(join(root, ".comm", "wake", "trying"), { recursive: true }) } catch {}
	const c = claimFile(join(root, ".comm", "wake", "trying", `${agent}.json`), `until-rung ${agent}`, rules.maxMs + rules.retryMs + 60_000)
	if (!c.ok) return
	let told = false, last = "refused", blockedAt = null, erasedTimes = 0, whoFailed = 0
	const end = (how) => { if (blockedAt) noteRing(root, { at: new Date().toISOString(), agent, blocked: false, ended: how, afterMs: Date.now() - blockedAt, told }); c.release() }
	const tell = (what) => { told = true; notifyOwner(root, cfg, agent, what) }
	for (let wait = Math.min(rules.retryMs, 15_000); ; wait = rules.retryMs) {
		// in slices: a project deleted meanwhile (a test's) leaves no process asleep for a minute, and no folder re-created by a note
		for (const at = Date.now() + wait; Date.now() < at; sleepSync(Math.max(1, Math.min(5000, at - Date.now())))) if (!existsSync(bus)) { c.release(); return }
		if (!existsSync(bus)) { c.release(); return }
		let state = null
		try { state = JSON.parse(spawnSync(process.execPath, [bus, "who", "--json"], { cwd: root, encoding: "utf8", timeout: 5000 }).stdout) } catch {}
		// a loaded machine's slow answer ends nothing; only a bus that keeps not answering does, and that is said
		if (!state) {
			if (++whoFailed < 5) continue
			if (!told) tell("le bus ne répond plus à la surveillance de sa sonnette")
			return end("the bus did not answer, five times")
		}
		whoFailed = 0
		const a = state.agents && state.agents[agent]
		if (!a || !a.pending) return end("the mail was taken")
		if (!a.pids.length) return end("the session is gone: its mail waits for its next start")
		const wins = windows()
		let blocked = false
		for (const pid of a.pids) {
			const r = wakeAgent(root, agent, pid, { wins, turn: readTurn(pid, lookup), cfg, lookup, watcher: true })
			if (r.sent && !r.unproved) return end("rung")
			if (r.busy) return end("it took a turn: its Stop delivers")
			if (r.notAtRest) blocked = true
			if (r.erased) erasedTimes++
			if (r.why) last = r.why
		}
		if (blocked && !blockedAt) { blockedAt = Date.now(); noteRing(root, { at: new Date(blockedAt).toISOString(), agent, blocked: true }) }
		// A SESSION THAT WILL NOT TAKE ITS ENTER is not typed into all night: twice, then a person is told. (Measured: a lone Enter has been taken every time.)
		if (erasedTimes >= 2) { tell("sa touche Entrée ne prend pas : deux cloches effacées, le courrier reste dans sa boîte"); return end("gave up: its Enter is not taken") }
		if (!told && blocked && Date.now() - blockedAt >= rules.notifyAfterMs) tell(`du courrier l'attend et sa fenêtre refuse la cloche depuis ${Math.round((Date.now() - blockedAt) / 60_000)} min : ${last}`)
		if (Date.now() - t0 >= rules.maxMs) {
			tell(`la surveillance de sa sonnette s'arrête après ${Math.round((Date.now() - t0) / 60_000)} min, le courrier attend toujours : ${last}`)
			return end(`gave up after ${Math.round((Date.now() - t0) / 60_000)} min: ${last}`)
		}
	}
}

async function main() {
	// Rule 6's instrument, imported rather than reimplemented. A registry that cannot be loaded
	// degrades to ringing as before - every result then says so - never to silence.
	let lookup = null, sessionPid = null
	try { ({ lookup, sessionPid } = await import(new URL("session-registry.mjs", import.meta.url).href)) } catch {}
	if (has("--resolve")) {
		const pid = Number(opt("--resolve", 0))
		const r = resolveWindow(pid)
		const turn = readTurn(pid, lookup)
		console.log(JSON.stringify(r.ok ? { pid, ...r.win, how: r.how, turn } : { pid, refused: r.why, turn }, null, 2))
		process.exit(r.ok ? 0 : 2)
	}
	const root = opt("--root", process.cwd())
	const bus = join(root, ".comm", "bin", "comm.mjs")
	if (!existsSync(bus)) { console.error(`wake: no bus at ${bus}`); process.exit(2) }
	if (has("--until-rung")) {
		if (!opt("--agent", null)) { console.error("wake: --until-rung needs --agent <name>"); process.exit(2) }
		await keepTrying(root, opt("--agent"), lookup)
		process.exit(0)
	}
	const q = spawnSync(process.execPath, [bus, "who", "--json"], { cwd: root, encoding: "utf8", timeout: 5000 })
	let state = null
	try { state = JSON.parse(q.stdout) } catch {}
	if (!state) { console.error("wake: the bus did not answer `who --json`"); process.exit(2) }

	const only = opt("--agent", null)
	// Rule 7 reads the roster itself: `who --json` carries no opt-in. Unreadable means nobody is opted in.
	let cfg = null
	try { cfg = JSON.parse(readFileSync(join(root, ".comm", "config.json"), "utf8")) } catch {}
	// NEVER RING YOUR OWN SESSION - and "own" is the calling PROCESS's session, found by its ancestry (rule 2), never a
	// name. This skipped `agent === state.you`, and `you` comes from `who --json` run with cwd = root: the LEADER, for
	// every caller without CLAUDE_COMM_AGENT. So an expert a person started by hand, or the ring `send` prints, never
	// rang the leader, and said "nothing is waiting for anyone else", exit 0 (review #15 §1, measured). No `claude`
	// ancestor - a plain shell, cron - is nobody's session: every agent with mail is rung. `FINDINGS.md#review15`
	const self = sessionPid ? sessionPid() : 0
	const wins = windows()
	const results = []
	let clearsLeft = 1
	// A hook kills this at 10 s, and a ring whose Enter fails can take most of that: past this, the rest is the next hook's.
	const budgetEnds = Date.now() + 6000
	for (const [agent, a] of Object.entries(state.agents)) {
		if (only && agent !== only) continue
		if (!a.pending) continue
		if (!a.pids.length) {
			// A CLOSED AGENT ITS PROJECT DECLARED: opened from the sender's hook, detached, because a hook is killed at 10 s and a
			// reopening waits its turn behind others. reopen.mjs decides everything else, and says what it did. FINDINGS.md#teams-b
			const declared = !!cfg && !!cfg.reopen && Object.prototype.hasOwnProperty.call(cfg.reopen, agent)
			if (declared && !has("--dry-run")) try { spawn(process.execPath, [fileURLToPath(new URL("reopen.mjs", import.meta.url)), agent, "--root", root], { detached: true, stdio: "ignore" }).unref() } catch {}
			results.push({ agent, sent: false, why: declared ? `not running, and declared in "reopen": reopen.mjs takes it from here, .comm/reopen/${agent}.json says what it did` : "not running — its mail waits for its next start, which is correct" })
			continue
		}
		for (const pid of a.pids) {
			if (pid === self) continue          // never ring your own session
			// Nobody else looks again if everyone is asleep. It claims per agent, so a second one ends at once.
			const keepLooking = () => { try { spawn(process.execPath, [fileURLToPath(import.meta.url), "--root", root, "--agent", agent, "--until-rung"], { detached: true, stdio: "ignore" }).unref() } catch {} }
			if (!has("--dry-run") && Date.now() > budgetEnds) { keepLooking(); results.push({ agent, pid, sent: false, why: "left for the ring that keeps looking: this run's time went on an earlier ring" }); continue }
			let looking = false
			const r = wakeAgent(root, agent, pid, { dryRun: has("--dry-run"), wins, turn: readTurn(pid, lookup), cfg, lookup, allowClear: clearsLeft > 0, onTyping: () => { looking = true; keepLooking() } })
			if (r.clearTyped) clearsLeft--
			results.push(r)
			if ((r.notAtRest || r.ringing) && !looking && !has("--dry-run")) keepLooking()
		}
	}
	// A dry run reports rule 7 for every listed agent, mail or not (freshReport, A66). A real run does not: it rings.
	const report = has("--dry-run") ? freshReport(cfg, state.agents, (pid) => readTurn(pid, lookup)) : []
	if (has("--json")) console.log(JSON.stringify({ root, results, ...(has("--dry-run") ? { fresh: report } : {}) }))
	else {
		if (!results.length) console.log("wake: nothing is waiting for anyone else")
		for (const r of results) {
			const note = r.turn === "unknown" ? ` · turn state unknown (${r.turnWhy}), rings as before`
				: r.turn === "ending" ? " · its reply had just ended" : ""
			const fresh = r.cleared === true ? ` · ${r.clearWhy}` : r.cleared === false ? ` · ⚠ ${r.clearWhy}`
				: r.wouldClear ? ` · would restart it fresh first (${r.freshWhy})` : r.freshWhy ? ` · no fresh restart: ${r.freshWhy}` : ""
			console.log(r.sent ? `  ● woke ${r.agent} (pid ${r.pid}) in window ${r.window} — ${r.how}${note}${fresh}${r.resubmitted ? " · Enter only: an earlier bell sat unsent in its box" : ""}${r.erasedOwn ? " · the bus's own text was erased from its box first" : ""}${r.enterAgain ? " · its first Enter was lost, pressed again" : ""}${r.unproved ? " · NOT PROVED, it looks again" : ""}${r.headHidden ? ` · its box showed only the bell's last lines, its start ${r.headSeen ? "brought into view and seen" : "NOT seen"} (FINDINGS.md#hidden-head)` : ""}`
				: `  ○ ${r.agent}: ${r.dryRun ? `would wake in window ${r.window} (${r.how})${note}${fresh}` : r.why}${r.notAtRest ? " · it looks again every minute, and tells the owner if this lasts" : ""}`)
		}
		if (report.length) console.log("  fresh restart, for every agent in freshRestart (dry run — nothing typed):\n" +
			report.map((f) => `    ${f.clear ? "●" : "○"} ${f.agent || "freshRestart"}${f.pid ? ` (pid ${f.pid})` : ""}: ` +
				(f.clear ? `would restart it fresh first — ${f.why}` : f.why)).join("\n"))
	}
}

// Run only when this file IS the program. The first version keyed on a flag, and importing
// it for a test therefore ran main(), which called process.exit(2) and killed the whole
// suite before it printed a line. Same guard bin/session-registry.mjs uses.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
	// --help: the usage lines of this header and nothing else run (A92) - before main(), which rings
	if (process.argv.includes("--help")) {
		console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => /^ \*\s{2,}node \S*bin\/[\w-]+\.mjs/.test(l))
			.map((l) => l.replace(/^ \*\s+/, "").replace(/^node (\.comm\/)?bin\//, "node .comm/bin/")).join("\n"))
		process.exit(0)
	}
	await main()
}
