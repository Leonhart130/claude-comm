#!/usr/bin/env node
/**
 * claude-comm WAKE — make an idle agent take a turn, so the gated Stop path can deliver.
 *
 *   node bin/wake.mjs --root <project>        wake every agent that has mail waiting
 *   node bin/wake.mjs --resolve <pid>         diagnostic: which window is that session in?
 *   node bin/wake.mjs --root <p> --dry-run    resolve and rate-limit, send nothing
 *   node bin/wake.mjs --root <p> --agent <a>  that agent only - the line `send` prints as "ring now"
 *   node bin/wake.mjs --root <p> --json       the same answer as JSON (what close.mjs reads)
 *
 *   .comm/config.json  "freshRestart": ["scribe", "web"]   agents that may be restarted fresh before a ring (rule 7)
 *   .comm/wake/rings.jsonl                            every ring, append-only, whoever called - hooks included
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
 */
import { readFileSync, writeFileSync, appendFileSync, renameSync, readdirSync, mkdirSync, existsSync, statSync, openSync, readSync, closeSync, readlinkSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

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
		if (r.type === "attachment" && r.attachment?.type === "queued_command") return { cancel: "somebody typed into the session while its last turn ran" }
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
	if (lines.length - 1 - bottom > 6) return { ok: false, why: `the input box is not at the bottom of the screen (${lines.length - 1 - bottom} lines below it): something is drawn under it` }
	const rest = lines[top].replace(/^(\x1b\[[0-9;:]*m)*❯[  ]?/, "")
	// `typed` + `text`, every line of the box: wake must tell its OWN unsent bell from a person's words (rule 8)
	const text = [rest, ...lines.slice(top + 1, bottom)].map((l) => plain(l).trim()).filter(Boolean).join(" ")
	for (let j = top + 1; j < bottom; j++) if (plain(lines[j]).trim()) return { ok: false, typed: true, text, why: "the input holds more than one line of text" }
	if (!plain(rest).trim()) return { ok: true }
	// a placeholder: the text after the mark starts DIM (SGR parameter 2), and is the only text there
	if (/^\x1b\[(?:[0-9:]*;)*2(?:;[0-9:]*)*m/.test(rest)) return { ok: true, placeholder: plain(rest).trim().slice(0, 60) }
	return { ok: false, typed: true, text, why: `somebody's text is on the input line: "${plain(rest).trim().slice(0, 40)}"` }
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
const isOwnBell = (text) => typeof text === "string" && (squash(text) === squash(NUDGE) || squash(text) === squash(FRESH_NUDGE))

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
	allowClear = true, confirmMs = FRESH_CONFIRM_MS, fresh = {}, started = runtimeRecord, screen = screenAtRest } = {}) {
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
	if (prev && !answered && Date.now() - Date.parse(prev.at) < QUIET_MS) {
		return { agent, pid, sent: false, why: `rung ${Math.round((Date.now() - Date.parse(prev.at)) / 1000)}s ago and no turn taken since, quiet period is ${QUIET_MS / 1000}s` }
	}
	const seen = turn ? { turn: turn.state, turnWhy: turn.why } : {}
	// Rule 7, decided on the same read rule 6 used.
	const decision = freshDecision(agent, cfg, turn, fresh)
	const said = decision.opted ? { freshWhy: decision.why } : {}
	const r = resolveWindow(pid, wins)
	// Rule 1. A refusal, never a hopeful --match.
	if (!r.ok) return { agent, pid, sent: false, why: r.why, ...seen, ...said }
	if (dryRun) return { agent, pid, sent: false, dryRun: true, window: r.win.id, socket: r.win.sock, how: r.how, wouldClear: decision.clear, ...seen, ...said }
	// 🔴 RULE 8, NEVER TYPE INTO SOMEBODY'S WORDS (header). Read after the refusals above, so they cost no screen read.
	// Not recorded, like rule 6: the next hook looks again, and a person who submits their own prompt has the mail handed
	// over at that turn's Stop. The sender is never told WHAT is typed there - it is somebody else's unsent text.
	const rest = screen(r.win)
	const ownUnsent = !rest.ok && rest.typed === true && isOwnBell(rest.text)
	if (!rest.ok && !ownUnsent) return { agent, pid, sent: false, notAtRest: true, ...seen, ...said,
		why: `not rung, its input is not at rest: ${rest.typed ? "text is on its input line (a person typing, or a draft left there) - never typed into" : rest.why}` }
	// ONE CLEAR PER RUN. A Stop hook kills this process after 10 s, and a confirmation may wait 4: a second
	// clear could be typed and never proved or rung. The agent cleared first takes a turn, and ITS Stop hook
	// runs wake again for the next one. Not rung meanwhile - ringing it now is the cold resume rule 7 avoids.
	if (decision.clear && !allowClear && !ownUnsent) return { agent, pid, sent: false, deferred: true, why: `a fresh restart is due (${decision.why}) and this run already typed one - left for the next turn boundary, not rung cold`, ...seen, ...said }
	const send = sendText ? (text) => sendText(r.win, text)
		: (text) => spawnSync("kitten", ["@", "--to", `unix:${r.win.sock}`, "send-text", "--match", `id:${r.win.id}`, text], { encoding: "utf8", timeout: 5000 })
	const ring = { at: new Date().toISOString(), agent, pid, window: r.win.id, turn: turn ? turn.state : null, cleared: null }
	const done = (rang, extra) => {
		noteWake(root, agent, { at: ring.at, agent, pid, window: r.win.id })
		noteRing(root, { ...ring, rang, ...extra })
	}
	// An earlier bell is the WHOLE box: its Enter was lost, so the Enter alone goes - never a /clear or a second bell on it.
	if (ownUnsent) {
		const e = send("\r")
		if (e.status !== 0) return { agent, pid, sent: false, why: `send-text failed: ${(e.stderr || "").trim().slice(0, 80)}`, ...seen, ...said }
		done(true, { text: "enter", resubmitted: true })
		return { agent, pid, sent: true, resubmitted: true, window: r.win.id, socket: r.win.sock, how: r.how, ...seen, ...said }
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
	const a = send(text)
	if (a.status !== 0) {
		if (clearTyped) done(false, { sendFailed: true })
		return { agent, pid, sent: false, cleared: ring.cleared, clearTyped, clearWhy: ring.clearWhy, why: `send-text failed: ${(a.stderr || "").trim().slice(0, 80)}`, ...seen, ...said }
	}
	send("\r")
	done(true, { text: text === FRESH_NUDGE ? "fresh" : "nudge" })
	return { agent, pid, sent: true, window: r.win.id, socket: r.win.sock, how: r.how, cleared: ring.cleared, clearTyped, clearWhy: ring.clearWhy, ...seen, ...said }
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
	for (const [agent, a] of Object.entries(state.agents)) {
		if (only && agent !== only) continue
		if (!a.pending) continue
		if (!a.pids.length) { results.push({ agent, sent: false, why: "not running — its mail waits for its next start, which is correct" }); continue }
		for (const pid of a.pids) {
			if (pid === self) continue          // never ring your own session
			const r = wakeAgent(root, agent, pid, { dryRun: has("--dry-run"), wins, turn: readTurn(pid, lookup), cfg, lookup, allowClear: clearsLeft > 0 })
			if (r.clearTyped) clearsLeft--
			results.push(r)
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
			console.log(r.sent ? `  ● woke ${r.agent} (pid ${r.pid}) in window ${r.window} — ${r.how}${note}${fresh}${r.resubmitted ? " · Enter only: an earlier bell sat unsent in its box" : ""}`
				: `  ○ ${r.agent}: ${r.dryRun ? `would wake in window ${r.window} (${r.how})${note}${fresh}` : r.why}`)
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
