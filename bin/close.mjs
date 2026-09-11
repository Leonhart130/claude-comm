#!/usr/bin/env node
/**
 * claude-comm CLOSE — an agent closes its OWN window, and REFUSES to close any other.
 *
 *   node .comm/bin/close.mjs                 close the window this session is running in
 *   node .comm/bin/close.mjs --dry-run       resolve and check everything, close nothing
 *   node .comm/bin/close.mjs --force         close over waiting mail / held claims
 *
 * WHY THIS EXISTS. The owner, 2026-09-10: *"c'est super d'ouvrir une fenetre et lancer un
 * agent, mais ce serait aussi super de pouvoir fermer celle-ci lorsqu'il a fini, sinon dans
 * un environnement intense et autonome, on risque d'avoir beaucoup de fenetres."*
 * `bin/launch.mjs` only ever opens, by its own rule — *an agent may close ITSELF, never a
 * sibling* — so the closing verb is a separate program and the CHILD is the one that runs it.
 *
 * ── THE TRAP THIS FILE IS SHAPED BY (review #8 C4) ─────────────────────────────────────
 *
 * A session spawns children. A `claude -p` it spawns inherits its environment, sits in the
 * same process tree, and is a descendant of the same window's shell. **So neither an
 * environment variable nor an ancestor walk can tell the two apart** — both answer "window
 * 1" for the child exactly as for the parent, and a closer built on either would let a
 * throwaway subprocess close the real session's window. DESIGN-autonomy.md proposed
 * exactly that cross-check; building it is what showed it does not separate them.
 *
 * Two things do, and this file requires BOTH:
 *
 * 1. **DEPTH: the session must BE the window's own process.** `launch.mjs` runs `claude`
 *    as the window's process directly (`kitten @ launch … claudeBin`), so for every window
 *    this tool may legitimately act on, `sessionPid() === window.pid` holds EXACTLY.
 *    Measured 2026-09-11: a window launched this way reports `pid 55606` and
 *    `foreground_processes [55606]` — the same number. **A `claude -p` the session spawns
 *    is never that number**, whatever else it inherits.
 *    ⚠️ "or its direct child" was tried and REJECTED between two runs of the arm: a
 *    `claude -p` spawned by the session IS a direct child of the window's process, so the
 *    looser rule readmitted the exact shape the file exists to refuse. The strict form
 *    costs nothing, because a hand-started session (whose parent is the window's shell) has
 *    no launch mark and is refused a line later anyway.
 *    ⚠️ This replaced a weaker first version that required only presence in
 *    `foreground_processes`. That test passed for a nested child too: `spawnSync` keeps the
 *    caller's process group, so kitty lists the grandchild in the foreground list as
 *    readily as the session. It appeared to work only because Claude Code's Bash tool puts
 *    its shell in a NEW process group — i.e. **the guard was resting on a property of the
 *    harness, not of this code**, and would have gone silently wrong for anyone spawning
 *    `claude -p` directly. Found by trying to prove the arm red for the property in its own
 *    title, which is the amendment in CLAUDE.md doing its job.
 *    🔴 `resolveWindow`'s ancestor fallback IS the trap and is rejected by name below: it is
 *    there for `wake.mjs`, which needs to reach a session through wrappers, and it is
 *    precisely wrong here.
 *
 * 2. **The window must carry `CLAUDE_COMM_LAUNCHED`**, the kitty user variable
 *    `bin/launch.mjs` sets on a window it opened. A user variable belongs to the WINDOW and
 *    is inherited by nothing, unlike the environment variable the design asked for. Its
 *    absence means this window was opened by a person, and **closing a window we did not
 *    open is the one thing this tool must never do.**
 *
 * ── WHAT THIS FILE CANNOT DO, SAID RATHER THAN HIDDEN ──────────────────────────────────
 *
 * **It cannot verify its own effect.** Closing the window destroys the pty this process is
 * printing to; a program cannot report on the disappearance of its own terminal, and a
 * "closed ✓" printed just before the close would be a claim, not a measurement. So the
 * check is handed to a DETACHED probe that outlives the window and writes the outcome to
 * `.comm/close/<agent>.json`. The intent is written BEFORE the close, the outcome after —
 * so a close that was attempted and did not happen leaves a record saying so, instead of
 * leaving nothing at all. `--dry-run` is what the arms use to gate the decision; the file
 * is what gates the effect.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { spawnSync, spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const ARGV = process.argv.slice(2)
const has = (f) => ARGV.includes(f)
const die = (msg, code = 2) => { console.error(`close: ${msg}`); process.exit(code) }

// ── the detached probe: the only part that can see the window go ─────────────────────
// Runs as its own process group so kitty's close does not take it with the window.
if (ARGV[0] === "--verify") {
	const [, sock, id, statePath] = ARGV
	const wake = await import(new URL("wake.mjs", import.meta.url))
	const deadline = Date.now() + 8000
	let gone = false
	while (Date.now() < deadline) {
		const wins = wake.windows()
		// A socket that has itself vanished means the whole kitty instance went with the
		// window — that is gone, not unknown. Distinguishing them matters: "I could not
		// look" must never render as "it worked", which is the failure mode the getajob
		// field named in its own probe on 2026-09-10.
		const reachable = wins.some((w) => w.sock === sock)
		if (!wins.some((w) => w.sock === sock && String(w.id) === String(id))) { gone = true; break }
		if (!reachable) { gone = true; break }
		spawnSync(process.execPath, ["-e", "setTimeout(()=>{},250)"])
	}
	try {
		const prev = JSON.parse(readFileSync(statePath, "utf8"))
		writeFileSync(statePath, JSON.stringify({ ...prev, verified_at: new Date().toISOString(), gone }, null, 1) + "\n")
	} catch {}
	process.exit(gone ? 0 : 1)
}

// ── who am I, and which window is mine ───────────────────────────────────────────────
const { sessionPid } = await import(new URL("session-registry.mjs", import.meta.url))
const wake = await import(new URL("wake.mjs", import.meta.url))

const me = sessionPid()
if (!me) die(`this is not running inside a claude session (no 'claude' ancestor of pid ${process.pid}).\n` +
	`  There is nothing here that could be "its own" window, so there is nothing to close.`)

const wins = wake.windows()
const r = wake.resolveWindow(me, wins)
if (!r.ok) die(`session ${me} is in no kitty window this user can see (${wins.length} checked).\n  ${r.why}`)
// 🔴 THE GUARD THIS FILE IS FOR. See the header: the ancestor fallback answers the SAME
// window for a `claude -p` a session spawned, so accepting it would hand a subprocess the
// power to close the real session's window.
if (r.how !== "foreground process")
	die(`REFUSING: session ${me} was resolved to window ${r.win.id} only as "${r.how}", not as that\n` +
	    `  window's foreground process. That is what a subprocess of the real session looks like —\n` +
	    `  a 'claude -p' would resolve here to its PARENT's window. An agent closes ITSELF, never\n` +
	    `  the session that spawned it.`)

// 🔴 DEPTH — the guard that does the real work. See header note 1: presence in the
// foreground list is NOT enough, because a child spawned with spawnSync keeps its caller's
// process group and kitty lists it too. The session must be the window's own process, or
// the direct child of it.
const ppidOf = (pid) => {
	try { const st = readFileSync(`/proc/${pid}/stat`, "utf8")
		return Number(st.slice(st.lastIndexOf(")") + 2).split(" ")[1]) || 0 } catch { return 0 }
}
if (me !== r.win.shellPid)
	die(`REFUSING: session ${me} is running INSIDE window ${r.win.id} but is not the window's own\n` +
	    `  process, which is ${r.win.shellPid} (parent of ${me}: ${ppidOf(me)}). A session opened by\n` +
	    `  bin/launch.mjs IS the window's process; anything else running in there is something that\n` +
	    `  session started. An agent closes ITSELF, never the session that spawned it.`)

const win = r.win
const launchedFor = win.vars && win.vars.CLAUDE_COMM_LAUNCHED
if (!launchedFor)
	die(`REFUSING: window ${win.id} carries no CLAUDE_COMM_LAUNCHED mark, so bin/launch.mjs did not\n` +
	    `  open it — a person did. Closing a window we did not open is the one thing this must never\n` +
	    `  do. If this session really was launched by the program, the mark failed and the launch\n` +
	    `  said so at the time.`)
if (process.env.CLAUDE_COMM_AGENT && process.env.CLAUDE_COMM_AGENT !== launchedFor)
	die(`REFUSING: this window is marked for '${launchedFor}' and this session calls itself\n` +
	    `  '${process.env.CLAUDE_COMM_AGENT}'. Two answers about one identity is the state where\n` +
	    `  guessing is worst, so neither is chosen.`)

// ── the housekeeping refusals: mail, and claims ──────────────────────────────────────
// These are the ones --force may override. The identity refusals above are not, and there
// is no flag for them: a bypass for "am I allowed to close this at all" is a bypass for
// the whole file.
let root = process.cwd()
while (!existsSync(join(root, ".comm", "config.json"))) {
	const up = dirname(root)
	if (up === root) { root = null; break }
	root = up
}
const blocks = []
if (root) {
	const commBin = fileURLToPath(new URL("comm.mjs", import.meta.url))
	const box = spawnSync(process.execPath, [commBin, "inbox", launchedFor], { cwd: root, encoding: "utf8", timeout: 5000 })
	// NOT KNOWING IS NOT "EMPTY". An inbox we could not read is reported as a block of its
	// own, because the alternative is closing over mail on the strength of a failed probe.
	if (box.status !== 0) blocks.push(`could not read the inbox for '${launchedFor}' (exit ${box.status}) — not the same as empty`)
	else if (!/\bempty\b/.test(box.stdout) && /\bpending\b/.test(box.stdout))
		blocks.push(`mail is waiting: ${(box.stdout.match(/^inbox.*$/m) || [""])[0].trim()} — somebody expects this agent to act, and a window that closes on unread mail loses it until the agent is relaunched`)

	const claimBin = fileURLToPath(new URL("claim.mjs", import.meta.url))
	const cl = spawnSync(process.execPath, [claimBin, "list", "--json"], { cwd: root, encoding: "utf8", timeout: 5000 })
	if (cl.status === 0) {
		try {
			for (const c of JSON.parse(cl.stdout) || []) {
				if (c.state === "gone") continue
				if (String(c.pid) === String(me) || c.by === launchedFor)
					blocks.push(`still holding ${c.resource} (${c.purpose || "no purpose recorded"}) — release it or --force; a claim outliving its holder reads as a crash to the next agent`)
			}
		} catch {}
	}
}

const state = { agent: launchedFor, window: win.id, sock: win.sock, tab: win.tab, session: me,
	at: new Date().toISOString(), blocks, forced: has("--force") }

if (blocks.length && !has("--force")) {
	console.error(`close: REFUSING to close window ${win.id} — ${blocks.length} thing(s) unfinished:`)
	for (const b of blocks) console.error(`  · ${b}`)
	console.error(`  --force closes anyway and records that it was forced.`)
	process.exit(3)
}

if (has("--dry-run")) {
	console.log(JSON.stringify({ ...state, would_close: true }, null, 1))
	process.exit(0)
}

// ── the close, and the probe that outlives it ────────────────────────────────────────
let statePath = null
if (root) {
	try {
		mkdirSync(join(root, ".comm", "close"), { recursive: true })
		statePath = join(root, ".comm", "close", `${launchedFor}.json`)
		writeFileSync(statePath, JSON.stringify({ ...state, verified_at: null, gone: null }, null, 1) + "\n")
	} catch { statePath = null }
}
if (statePath) {
	const self = fileURLToPath(import.meta.url)
	const probe = spawn(process.execPath, [self, "--verify", win.sock, String(win.id), statePath],
		{ detached: true, stdio: "ignore" })
	probe.unref()
}
const out = spawnSync("kitten", ["@", "--to", `unix:${win.sock}`, "close-window", "--match", `id:${win.id}`],
	{ encoding: "utf8", timeout: 5000 })
// If we are still alive to print this, the close did not take. Measured 2026-09-11:
// `close-window --match` on a missing id exits 1 and says so — unlike `send-text --match`,
// which exits 0 having done nothing. That is recorded because this project's standing
// assumption, taken from send-text, was that kitty's --match verbs all lie. This one does
// not. The record in .comm/close/ is still what gates the effect.
if (out.status !== 0)
	die(`kitten @ close-window failed (exit ${out.status}): ${(out.stderr || "").trim()}\n` +
	    `  The window is still here and this session is still in it.`, 4)
console.log(`close: asked kitty to close window ${win.id}. If you can read this, it has not happened yet` +
	(statePath ? `; the outcome is being written to ${statePath} by a detached probe.` : "."))
