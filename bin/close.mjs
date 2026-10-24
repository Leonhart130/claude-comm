#!/usr/bin/env node
/**
 * claude-comm CLOSE — an agent closes its OWN window, and REFUSES to close any other.
 *
 *   node .comm/bin/close.mjs                 close the window this session is running in
 *   node .comm/bin/close.mjs --dry-run       resolve and check everything, close nothing
 *   node .comm/bin/close.mjs --force         close over waiting mail / held claims
 *   node .comm/bin/close.mjs --now           close at once, inside this turn (the old default)
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
//
// 🔴 THREE STATES, NOT TWO — review #10 C2. This comment always said "I could not look" must never
// render as "it worked", and the code wrote `gone: true` for both: `wake.windows()` DROPS a socket
// whose `kitten @ ls` fails, so kitten off PATH, or an `ls` timed out under two control suites, read
// as "window absent" — and the `if` meant to tell them apart was dead code. Measured by the reviewer
// on an OPEN window: kitten unreachable -> `gone: true`, exit 0. A51 stayed green with a probe
// mutated never to look at all, because it only ever runs the success direction.
//
// So the probe runs its own `ls` on the ONE socket it was handed, and records what it SAW:
//   gone: true   the socket answered and the window is not in it — or the socket file is gone:
//                kitty unlinks it when the instance exits, and closing an instance's last window
//                can do that before the first look, so the window went with it
//   gone: false  the socket answered and the window is still there
//   gone: null   it never managed to look — kitten unreachable, `ls` failed or timed out, or
//                answered no JSON. Neither "it worked" nor "it did not". Exit 2.
// ⚠️ NOT COVERED: a socket path that NEVER existed reads as gone (the reviewer's row C). Only a
// caller bug produces one — close.mjs hands over the socket it has just listed the window on — so
// it is named here rather than guessed at. A59.
if (ARGV[0] === "--verify") {
	const [, sock, id, statePath] = ARGV
	let why = "", blind = 0
	const look = () => {
		if (!existsSync(sock)) return "gone"
		const r = spawnSync("kitten", ["@", "--to", `unix:${sock}`, "ls"], { encoding: "utf8", timeout: 5000 })
		if (r.error || r.status !== 0 || !r.stdout) { why = r.error ? r.error.code : `kitten @ ls exit ${r.status}`; return "blind" }
		let tree
		try { tree = JSON.parse(r.stdout) } catch { why = "kitten @ ls answered no JSON"; return "blind" }
		for (const osw of tree) for (const tab of osw.tabs || []) for (const w of tab.windows || [])
			if (String(w.id) === String(id)) return "there"
		return "gone"
	}
	const deadline = Date.now() + 8000
	let seen = null
	while (Date.now() < deadline) {
		const s = look()
		if (s === "gone") { seen = s; break }
		if (s === "there") seen = s
		else blind++
		spawnSync(process.execPath, ["-e", "setTimeout(()=>{},250)"])
	}
	const gone = seen === "gone" ? true : seen === "there" ? false : null
	// An intent record that cannot be read is written over rather than skipped: the outcome is the
	// part that matters, and a bare catch here used to lose it silently.
	let prev
	try { prev = JSON.parse(readFileSync(statePath, "utf8")) } catch { prev = { intent_unreadable: true } }
	try {
		writeFileSync(statePath, JSON.stringify({ ...prev, verified_at: new Date().toISOString(), gone,
			...(gone === null ? { could_not_look: why } : {}), blind_looks: blind }, null, 1) + "\n")
	} catch {}
	process.exit(gone === true ? 0 : gone === false ? 1 : 2)
}

// ── the deferred closer: the window goes AFTER the turn that asked, never during it ──────
// The owner, 2026-09-26: "quand tu ferme un agent je veux le voir avoir fini son report et 1-2secs après tu ferme
// sa fenêtre, ça me rassurera que tout se passe bien". Measured in atlas's tree that day: four experts closed 4.0 to
// 11.0 s after their final bell, every one finished and unforced - and each window vanished while its last answer was
// still being WRITTEN, because the close ran inside the very turn that was writing it. So the default arms this
// detached process and returns: it reads the session's own transcript with wake's reader until THAT turn has ended,
// waits GRACE_MS with the whole report on screen, and closes only if no turn began meanwhile and no mail came in that
// the agent never saw. A turn it cannot read (no registry entry) closes after the grace alone, and says so. A89.
const GRACE_MS = 2000, AFTER_TURN_MAX_MS = 30 * 60_000
const nap = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
/** null when nothing waits for `agent`, else why the close must not happen (an unreadable inbox included). */
function mailWaiting(root, agent) {
	const box = spawnSync(process.execPath, [fileURLToPath(new URL("comm.mjs", import.meta.url)), "inbox", agent], { cwd: root, encoding: "utf8", timeout: 5000 })
	// NOT KNOWING IS NOT "EMPTY". An inbox we could not read is a block of its own.
	if (box.status !== 0) return `could not read the inbox for '${agent}' (exit ${box.status}) — not the same as empty`
	if (!/\bempty\b/.test(box.stdout) && /\bpending\b/.test(box.stdout))
		return `mail is waiting: ${(box.stdout.match(/^inbox.*$/m) || [""])[0].trim()} — somebody expects this agent to act, and a window that closes on unread mail loses it until the agent is relaunched`
	return null
}
if (ARGV[0] === "--after-turn") {
	const [, me, sock, id, statePath, root, agent] = ARGV
	const wake = await import(new URL("wake.mjs", import.meta.url))
	let lookup = null
	try { ({ lookup } = await import(new URL("session-registry.mjs", import.meta.url))) } catch {}
	const note = (o) => {
		let prev
		try { prev = JSON.parse(readFileSync(statePath, "utf8")) } catch { prev = { intent_unreadable: true } }
		try { writeFileSync(statePath, JSON.stringify({ ...prev, ...o }, null, 1) + "\n") } catch {}
	}
	const armed = Date.now()
	let how = null
	for (;;) {
		const t = wake.readTurn(Number(me), lookup)
		if (t.state === "unknown") how = `its turn could not be read (${t.why}) - closed after the grace alone`
		else if (t.state === "idle") how = "the turn that asked for the close ended"
		if (how) {
			nap(GRACE_MS)
			// a turn begun in the grace - a doorbell, the person typing - is waited out like the first one
			if (t.state === "idle" && wake.readTurn(Number(me), lookup).state !== "idle") { how = null; continue }
			break
		}
		if (Date.now() - armed > AFTER_TURN_MAX_MS) {
			note({ abandoned_at: new Date().toISOString(), abandoned: `the turn did not end within ${AFTER_TURN_MAX_MS / 60_000} min - the window was left open, not closed on a working session` })
			process.exit(1)
		}
		nap(300)
	}
	const late = mailWaiting(root, agent)
	if (late) { note({ cancelled_at: new Date().toISOString(), cancelled: `${late} — it came after the close was asked, so the window stays and the agent's next turn reads it` }); process.exit(1) }
	note({ turn_ended: how, closing_at: new Date().toISOString(), waited_ms: Date.now() - armed })
	spawn(process.execPath, [fileURLToPath(import.meta.url), "--verify", sock, String(id), statePath], { detached: true, stdio: "ignore" }).unref()
	const out = spawnSync("kitten", ["@", "--to", `unix:${sock}`, "close-window", "--match", `id:${id}`], { encoding: "utf8", timeout: 5000 })
	if (out.status !== 0) note({ close_failed: `kitten @ close-window exit ${out.status}: ${(out.stderr || "").trim()}` })
	process.exit(out.status === 0 ? 0 : 4)
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
	// NOT KNOWING IS NOT "EMPTY": an inbox we could not read is a block of its own (mailWaiting, above),
	// because the alternative is closing over mail on the strength of a failed probe.
	const mail = mailWaiting(root, launchedFor)
	if (mail) blocks.push(mail)

	// 🔴 REVIEW #10 C1: THIS REFUSAL HAD NEVER RUN. `claim list --json` answers an OBJECT,
	// `{ root, claims: [...] }`, and this loop iterated it directly: `for…of` on an object throws,
	// a bare `catch {}` ate it, and `blocks` stayed empty for a claim this very session held —
	// measured by the reviewer end to end. Behind it sat a second mismatch: `pid` and `by` live in
	// `c.rec`, not on `c`. The header promised two housekeeping guards and shipped one.
	// NOT KNOWING IS NOT "NONE HELD" — the rule the inbox probe above already follows: a list that
	// fails or does not parse is a block of its own, never a silent pass. A58.
	const claimBin = fileURLToPath(new URL("claim.mjs", import.meta.url))
	const cl = spawnSync(process.execPath, [claimBin, "list", "--json"], { cwd: root, encoding: "utf8", timeout: 5000 })
	let claims = null
	if (cl.status === 0) {
		try { const j = JSON.parse(cl.stdout); if (j && Array.isArray(j.claims)) claims = j.claims } catch {}
	}
	if (claims === null)
		blocks.push(`could not read the claims (claim list exit ${cl.status}) — not the same as holding none`)
	else for (const c of claims) {
		if (c.state === "gone" || c.state === "free") continue
		const rec = c.rec || {}
		if (String(rec.pid) === String(me) || rec.by === launchedFor)
			blocks.push(`still holding ${c.resource} (${rec.purpose || "no purpose recorded"}) — release it or --force; a claim outliving its holder reads as a crash to the next agent`)
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

// ── THE TURN END THIS CLOSE TAKES AWAY, given back ───────────────────────────────────
// Reported by work's leader 2026-10-24, and measured in its tree: two experts sent `done` and
// closed themselves in the same turn, and neither rang the idle leader - no row in
// .comm/wake/rings.jsonl - while the third, which stayed open, rang it 16 s after its send. The
// doorbell is rung by the Stop hook at a turn END (install.mjs's stub), and a session whose window
// closes never reaches one: every clean finish lost its ring. So this runs what that Stop hook
// would have run, BEFORE the window goes - the same `wake --root`, with every rule of wake intact:
// never this session, never into a running turn, the quiet period. After a refusal above it does
// not run: the agent stays open and its own turn end rings. Its answer goes into the close record,
// because nothing printed after the close can be read. A87.
let rings = null
if (root) {
	const w = spawnSync(process.execPath, [fileURLToPath(new URL("wake.mjs", import.meta.url)), "--root", root, "--json",
		...(has("--dry-run") ? ["--dry-run"] : [])], { cwd: root, encoding: "utf8", timeout: 10000 })
	try { rings = JSON.parse(w.stdout).results } catch { rings = { failed: `wake exit ${w.status}${w.error ? ` (${w.error.code})` : ""}` } }
	state.rings = rings
	if (Array.isArray(rings)) for (const r of rings)
		console.log(r.sent ? `close: rang ${r.agent} (pid ${r.pid}) before closing` : `close: ${r.agent}: ${r.dryRun ? "would be rung" : r.why}`)
	else console.error(`close: ⚠ could not ring anyone before closing - ${rings.failed}; an idle recipient of this session's mail is not told`)
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
// THE DEFAULT IS AFTER THIS TURN (header of the deferred closer, above). It needs the record and the project to
// work from; without them, or with --now, the close happens here, inside the turn, as it always did.
if (statePath && root && !has("--now")) {
	writeFileSync(statePath, JSON.stringify({ ...state, deferred: true, grace_ms: GRACE_MS, verified_at: null, gone: null }, null, 1) + "\n")
	spawn(process.execPath, [fileURLToPath(import.meta.url), "--after-turn", String(me), win.sock, String(win.id), statePath, root, launchedFor],
		{ detached: true, stdio: "ignore" }).unref()
	console.log(`close: armed - window ${win.id} closes ${GRACE_MS / 1000} s after THIS turn ends, so your last answer stays on screen, whole.\n` +
		`  Write your final report now, then end your turn. The outcome lands in ${statePath}.`)
	process.exit(0)
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
