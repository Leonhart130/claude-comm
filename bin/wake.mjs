#!/usr/bin/env node
/**
 * claude-comm WAKE — make an idle agent take a turn, so the gated Stop path can deliver.
 *
 *   node bin/wake.mjs --root <project>        wake every agent that has mail waiting
 *   node bin/wake.mjs --resolve <pid>         diagnostic: which window is that session in?
 *   node bin/wake.mjs --root <p> --dry-run    resolve and rate-limit, send nothing
 *
 * WHY THIS EXISTS. Measured over 26 real field deliveries: leader→expert median 1462 s,
 * expert→leader 586 s. The asymmetry is structural, because mail lands at the recipient's
 * TURN BOUNDARY — so **an agent that is alive but idle never receives its mail**, and
 * `who` showing "running" does not mean reachable. This bus is a mailbox, never an
 * interrupt, and nothing here changes that: the wake does not deliver anything. It makes
 * an idle session take a turn, and the turn's own Stop hook does the delivery that was
 * already gated.
 *
 * Six rules, each of which is a way this could have been built wrong:
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
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync, openSync, readSync, closeSync } from "node:fs"
import { join } from "node:path"
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
 * its use, in no arm. Reported 2026-09-11 by the `getajob` field leader, who paid for both
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
// working". Measured 2026-09-13 in the getajob field: 18 of 35 doorbells in one day, one of
// them interrupting `cv` the instant its leader woke `web`. And it bought no delivery a skip
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

/** "idle", "busy", or null when the row decides nothing. */
export function rowVerdict(r) {
	if (!r || r.isSidechain) return null
	// A closed turn. Every other system row - the Stop hook's summary, an away summary, a local
	// command - decides nothing.
	if (r.type === "system") return r.subtype === "turn_duration" ? "idle" : null
	// An API error or a usage limit ends the turn with a synthetic reply and no turn_duration.
	if (r.type === "assistant") return r.isApiErrorMessage || r.message?.model === "<synthetic>" ? "idle" : "busy"
	if (r.type !== "user") return null
	const c = r.message?.content, t = textOf(c)
	if (/\[Request interrupted by user/.test(t) && (hasToolResult(c) || /^\s*\[Request interrupted/.test(t))) return "idle"
	// Meta rows are written at rest (a permission granted, a rename) EXCEPT these, each followed by
	// a model turn every time it was seen: a Stop hook block (257) and two usage-limit resumes (9).
	if (r.isMeta) return /^\s*(Stop hook feedback:|You can continue now|Your claude\.ai usage limit has reset)/.test(t) ? "busy" : null
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

function describe({ state, row }) {
	if (!row) return "no turn in the transcript yet"
	const c = row.message?.content, t = textOf(c)
	const what = row.type === "system" ? "the turn closed"
		: row.type === "assistant" ? (row.isApiErrorMessage || row.message?.model === "<synthetic>" ? "the turn ended on an error"
			: row.message?.stop_reason !== "end_turn" ? "a tool call"
			: state === "busy" ? "a Stop hook blocked and the model is answering it" : "a reply ended, its Stop hook still running")
		: /\[Request interrupted/.test(t) ? "interrupted by the user"
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
	if (!hit.ok) return { state: "unknown", why: hit.why }
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
			const t = turnState(rows)
			if (t.row || len === size) return { state: t.state, why: describe(t) }
		}
	} catch (e) {
		return { state: "unknown", why: `transcript unreadable (${e.code || e.message})` }
	} finally {
		if (fd !== undefined) try { closeSync(fd) } catch {}
	}
}

export function wakeAgent(root, agent, pid, { dryRun = false, wins, turn = null } = {}) {
	const prev = lastWake(root, agent)
	if (prev && Date.now() - Date.parse(prev.at) < QUIET_MS) {
		return { agent, pid, sent: false, why: `rung ${Math.round((Date.now() - Date.parse(prev.at)) / 1000)}s ago, quiet period is ${QUIET_MS / 1000}s` }
	}
	// Rule 6, before anything is resolved. And nothing is recorded, so the next hook that fires
	// looks again instead of waiting out QUIET_MS for a ring that never happened.
	if (turn && turn.state === "busy") return { agent, pid, sent: false, busy: true, turn: "busy", why: `mid-turn, not rung (${turn.why})` }
	const seen = turn ? { turn: turn.state, turnWhy: turn.why } : {}
	const r = resolveWindow(pid, wins)
	// Rule 1. A refusal, never a hopeful --match.
	if (!r.ok) return { agent, pid, sent: false, why: r.why, ...seen }
	if (dryRun) return { agent, pid, sent: false, dryRun: true, window: r.win.id, socket: r.win.sock, how: r.how, ...seen }
	const send = (text) => spawnSync("kitten", ["@", "--to", `unix:${r.win.sock}`, "send-text", "--match", `id:${r.win.id}`, text],
		{ encoding: "utf8", timeout: 5000 })
	const a = send(NUDGE)
	if (a.status !== 0) return { agent, pid, sent: false, why: `send-text failed: ${(a.stderr || "").trim().slice(0, 80)}` }
	send("\r")
	noteWake(root, agent, { at: new Date().toISOString(), agent, pid, window: r.win.id })
	return { agent, pid, sent: true, window: r.win.id, socket: r.win.sock, how: r.how, ...seen }
}

async function main() {
	// Rule 6's instrument, imported rather than reimplemented. A registry that cannot be loaded
	// degrades to ringing as before - every result then says so - never to silence.
	let lookup = null
	try { ({ lookup } = await import(new URL("session-registry.mjs", import.meta.url).href)) } catch {}
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
	const wins = windows()
	const results = []
	for (const [agent, a] of Object.entries(state.agents)) {
		if (only && agent !== only) continue
		if (agent === state.you) continue          // never ring your own doorbell
		if (!a.pending) continue
		if (!a.pids.length) { results.push({ agent, sent: false, why: "not running — its mail waits for its next start, which is correct" }); continue }
		for (const pid of a.pids) results.push(wakeAgent(root, agent, pid, { dryRun: has("--dry-run"), wins, turn: readTurn(pid, lookup) }))
	}
	if (has("--json")) console.log(JSON.stringify({ root, results }))
	else if (!results.length) console.log("wake: nothing is waiting for anyone else")
	else for (const r of results) {
		const note = r.turn === "unknown" ? ` · turn state unknown (${r.turnWhy}), rings as before`
			: r.turn === "ending" ? " · its reply had just ended" : ""
		console.log(r.sent ? `  ● woke ${r.agent} (pid ${r.pid}) in window ${r.window} — ${r.how}${note}`
			: `  ○ ${r.agent}: ${r.dryRun ? `would wake in window ${r.window} (${r.how})${note}` : r.why}`)
	}
}

// Run only when this file IS the program. The first version keyed on a flag, and importing
// it for a test therefore ran main(), which called process.exit(2) and killed the whole
// suite before it printed a line. Same guard bin/session-registry.mjs uses.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) await main()
