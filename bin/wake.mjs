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
 * Five rules, each of which is a way this could have been built wrong:
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
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs"
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
			out.push({ sock, osWindow: osw.id, id: w.id, shellPid: w.pid,
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
 */
const NUDGE = "[claude-comm] doorbell — mail is waiting for you. Nothing to do and nothing to fetch: " +
	"acknowledge briefly and end your turn, and the bus will hand it to you as this turn closes."

export function wakeAgent(root, agent, pid, { dryRun = false, wins } = {}) {
	const prev = lastWake(root, agent)
	if (prev && Date.now() - Date.parse(prev.at) < QUIET_MS) {
		return { agent, pid, sent: false, why: `rung ${Math.round((Date.now() - Date.parse(prev.at)) / 1000)}s ago, quiet period is ${QUIET_MS / 1000}s` }
	}
	const r = resolveWindow(pid, wins)
	// Rule 1. A refusal, never a hopeful --match.
	if (!r.ok) return { agent, pid, sent: false, why: r.why }
	if (dryRun) return { agent, pid, sent: false, dryRun: true, window: r.win.id, socket: r.win.sock, how: r.how }
	const send = (text) => spawnSync("kitten", ["@", "--to", `unix:${r.win.sock}`, "send-text", "--match", `id:${r.win.id}`, text],
		{ encoding: "utf8", timeout: 5000 })
	const a = send(NUDGE)
	if (a.status !== 0) return { agent, pid, sent: false, why: `send-text failed: ${(a.stderr || "").trim().slice(0, 80)}` }
	send("\r")
	noteWake(root, agent, { at: new Date().toISOString(), agent, pid, window: r.win.id })
	return { agent, pid, sent: true, window: r.win.id, socket: r.win.sock, how: r.how }
}

function main() {
	if (has("--resolve")) {
		const pid = Number(opt("--resolve", 0))
		const r = resolveWindow(pid)
		console.log(JSON.stringify(r.ok ? { pid, ...r.win, how: r.how } : { pid, refused: r.why }, null, 2))
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
		for (const pid of a.pids) results.push(wakeAgent(root, agent, pid, { dryRun: has("--dry-run"), wins }))
	}
	if (has("--json")) console.log(JSON.stringify({ root, results }))
	else if (!results.length) console.log("wake: nothing is waiting for anyone else")
	else for (const r of results) {
		console.log(r.sent ? `  ● woke ${r.agent} (pid ${r.pid}) in window ${r.window} — ${r.how}`
			: `  ○ ${r.agent}: ${r.dryRun ? `would wake in window ${r.window} (${r.how})` : r.why}`)
	}
}

// Run only when this file IS the program. The first version keyed on a flag, and importing
// it for a test therefore ran main(), which called process.exit(2) and killed the whole
// suite before it printed a line. Same guard bin/session-registry.mjs uses.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) main()
