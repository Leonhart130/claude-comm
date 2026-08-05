#!/usr/bin/env node
/**
 * Phase 2, step 1 — RESOLVE an agent's pid to a kitty window. READ ONLY.
 *
 *   node test/kitty-resolve.mjs <pid> [pid...]
 *
 * This probe sends nothing. It exists because of the constraint the feasibility
 * probe settled: `kitten @ send-text --match` EXITS 0 WHEN IT MATCHES NOTHING,
 * so the wake is unfalsifiable at the point of use. The only defence is to
 * resolve the target first and refuse to send when it does not resolve — which
 * makes this resolver, not the send, the safety-critical half of Phase 2.
 *
 * ⚠️ The trap this probe was written to catch, and DID catch on the owner's live
 * layout: `@ ls` reports a window `pid`, and that pid is the window's SHELL, not
 * the agent. `claude` shows up in `foreground_processes`. A resolver that matched
 * `window.pid` against the pids `comm who` knows would resolve NOTHING, refuse
 * every send by design, and look exactly like "no idle agent needed waking" —
 * a silent permanent no-op, which is the failure shape this project exists to
 * deny. STRATEGY_NAIVE below is kept as a live control that this is still true.
 */
import { readFileSync, readlinkSync, readdirSync, statSync } from "node:fs"
import { execFileSync } from "node:child_process"

const KITTEN = process.env.COMM_KITTEN || "/home/leonh/.local/kitty.app/bin/kitten"

// ── socket discovery ────────────────────────────────────────────────────────
// NOT just $KITTY_LISTEN_ON: that names the kitty instance WE are in. `listen_on
// unix:/tmp/kitty-{kitty_pid}` creates one socket per kitty PROCESS, so a second
// kitty window opened from the launcher is a second instance with its own socket
// and its own windows. An agent living there is invisible to our own socket.
function discoverSockets() {
	const socks = new Set()
	const own = String(process.env.KITTY_LISTEN_ON || "").trim()
	if (own) socks.add(own)
	for (const f of readdirSync("/tmp")) {
		if (!/^kitty-\d+$/.test(f)) continue
		try { if (statSync(`/tmp/${f}`).isSocket()) socks.add(`unix:/tmp/${f}`) } catch {}
	}
	return [...socks]
}

function listWindows(sock) {
	let raw
	try {
		raw = execFileSync(KITTEN, ["@", "--to", sock, "ls"], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "pipe"] })
	} catch (e) {
		return { sock, error: (e.stderr || e.message || "").toString().trim().split("\n")[0] || "unreachable", windows: [] }
	}
	let tree
	try { tree = JSON.parse(raw) } catch { return { sock, error: "unparseable @ ls output", windows: [] } }
	const windows = []
	for (const os_win of tree) {
		for (const tab of os_win.tabs || []) {
			for (const w of tab.windows || []) {
				windows.push({
					sock,
					id: w.id,
					pid: w.pid,                       // the window's ROOT process — the shell
					title: w.title,
					cwd: w.cwd,
					fg: (w.foreground_processes || []).map((p) => ({ pid: p.pid, cmd: (p.cmdline || []).join(" ") })),
				})
			}
		}
	}
	return { sock, error: null, windows }
}

// ── /proc ancestry ──────────────────────────────────────────────────────────
// Walks pid → ppid → … The chain is what makes the match robust to HOW the agent
// was started: `claude` under a shell (ancestor match), `exec claude` replacing
// the shell (self match), or a wrapper in between (deeper ancestor). Matching
// only `foreground_processes` would be a snapshot of what holds the tty right
// now, which is a different question from "which window is this agent in".
function ancestry(pid, limit = 40) {
	const chain = []
	let cur = Number(pid)
	for (let i = 0; i < limit && cur > 0; i++) {
		chain.push(cur)
		let ppid = 0
		try {
			const stat = readFileSync(`/proc/${cur}/stat`, "utf8")
			// comm field can contain spaces AND ')', so split after the LAST ')'.
			const after = stat.slice(stat.lastIndexOf(")") + 2).split(" ")
			ppid = Number(after[1])
		} catch { break }
		if (!ppid || ppid === cur) break
		cur = ppid
	}
	return chain
}

// NEAREST ancestor wins, and the walk stops there. Filtering the whole chain for
// window pids looks equivalent and is not: every chain also passes through the
// kitty process itself and on up to init, so a wider match can only ever add
// FALSE hits. Treating those as "ambiguous, refuse" would be safe in the wrong
// direction — it turns into "this agent can never be woken", which reads on
// screen exactly like "no agent needed waking". The nearest ancestor that is a
// window's root process IS that window; there is nothing to disambiguate.
const STRATEGY_ANCESTRY = (pid, windows) => {
	const chain = ancestry(pid)
	const byPid = new Map(windows.map((w) => [w.pid, w]))
	for (const p of chain) if (byPid.has(p)) return { hits: [byPid.get(p)], chain, wider: windows.filter((w) => chain.includes(w.pid)).length }
	return { hits: [], chain, wider: 0 }
}
// Kept as a CONTROL, not as a candidate: this is the obvious implementation, and
// the probe's job is to keep proving it is wrong.
const STRATEGY_NAIVE = (pid, windows) => ({ hits: windows.filter((w) => w.pid === Number(pid)), chain: [Number(pid)] })

function procInfo(pid) {
	try {
		return {
			alive: true,
			cmd: readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean).join(" "),
			cwd: readlinkSync(`/proc/${pid}/cwd`),
		}
	} catch { return { alive: false, cmd: "", cwd: "" } }
}

// ── run ─────────────────────────────────────────────────────────────────────
const targets = process.argv.slice(2).filter((a) => /^\d+$/.test(a))
if (!targets.length) {
	console.log("usage: node test/kitty-resolve.mjs <pid> [pid...]   (pids from `comm who`)")
	process.exit(2)
}

const socks = discoverSockets()
console.log(`sockets discovered: ${socks.length ? socks.join(", ") : "(none)"}`)
if (process.env.KITTY_LISTEN_ON) console.log(`  ours: ${process.env.KITTY_LISTEN_ON}`)
if (!socks.length) {
	console.log("\n✗ no kitty socket — remote control is off, or kitty has not been restarted since it was enabled.")
	console.log("  A wake transport MUST treat this as 'cannot wake', never as 'nothing to wake'.")
	process.exit(1)
}

let windows = []
for (const s of socks) {
	const r = listWindows(s)
	if (r.error) console.log(`  ⚠ ${s}: ${r.error}`)
	windows = windows.concat(r.windows)
}
console.log(`windows visible: ${windows.length}\n`)

// The ambiguity that kills the cwd-based match, shown rather than argued.
const byCwd = {}
for (const w of windows) (byCwd[w.cwd] ||= []).push(w.id)
const collided = Object.entries(byCwd).filter(([, v]) => v.length > 1)

let resolved = 0, unresolved = 0, ambiguous = 0
const seenWindow = new Map()
for (const pid of targets) {
	const info = procInfo(pid)
	const a = STRATEGY_ANCESTRY(pid, windows)
	const n = STRATEGY_NAIVE(pid, windows)
	console.log(`pid ${pid}  ${info.alive ? `(${info.cmd || "?"} in ${info.cwd})` : "NOT ALIVE"}`)
	console.log(`  ancestry: ${a.chain.join(" → ")}`)
	if (a.hits.length === 1) {
		const w = a.hits[0]
		const fgIsAgent = w.fg.some((f) => f.pid === Number(pid))
		console.log(`  ✓ window ${w.id} on ${w.sock}  (window pid ${w.pid}${w.pid === Number(pid) ? " = the agent itself" : " = the shell, NOT the agent"})`)
		console.log(`    title: ${JSON.stringify(w.title)}`)
		console.log(`    agent is in foreground_processes: ${fgIsAgent ? "yes" : "NO — it is not holding the tty right now"}`)
		if (seenWindow.has(w.id)) console.log(`    ⚠ window ${w.id} ALREADY claimed by pid ${seenWindow.get(w.id)} — a wake would hit both`)
		seenWindow.set(w.id, pid)
		resolved++
		if (a.wider > 1) console.log(`    note: a whole-chain match would have hit ${a.wider} windows — nearest-ancestor is what makes this unambiguous`)
	} else {
		console.log(`  ✗ UNRESOLVED — no window owns this process. A wake MUST be refused, not attempted.`)
		unresolved++
	}
	console.log(`  [control] naive window.pid === agent pid: ${n.hits.length ? `resolved to ${n.hits.map((w) => w.id).join(",")}` : "resolved NOTHING"}`)
	console.log()
}

console.log("── controls ──")
// A resolver that answers "yes" to everything has not resolved anything. pid 1 is
// never in a kitty window; if it resolves, the matcher is not discriminating.
const neg = STRATEGY_ANCESTRY(1, windows)
console.log(`  negative control (pid 1, init): ${neg.hits.length === 0 ? "✓ correctly UNRESOLVED" : `🔴 resolved to window ${neg.hits.map((w) => w.id).join(",")} — the matcher is not discriminating`}`)

// pid 1 is a weak control: it is not a process of the kind we ever resolve. The
// real question is whether a LIVE process that simply is not in a kitty window
// gets refused — so orphan one and ask. `--fork` matters: a plain detached child
// keeps THIS node process as its parent, and this node is itself descended from
// our own window, so the chain would reach window 5 and the "negative" control
// would pass by resolving correctly. That is the control-does-not-travel-the-
// same-path trap, and it is why the fixture is asserted alive before it is read.
let orphan = null
try {
	execFileSync("setsid", ["--fork", "sleep", "37"], { stdio: "ignore", timeout: 5000 })
	orphan = Number(execFileSync("pgrep", ["-nf", "^sleep 37$"], { encoding: "utf8" }).trim())
} catch {}
if (!orphan || !procInfo(orphan).alive) {
	console.log(`  live negative control: ⚠ VOID — the stand-in process could not be started or died immediately.`)
	console.log(`     Draw no conclusion from it. (A fixture that cannot run reports "no problem".)`)
} else {
	const o = STRATEGY_ANCESTRY(orphan, windows)
	console.log(`  live negative control (orphaned pid ${orphan}, chain ${o.chain.join(" → ")}): ${o.hits.length === 0
		? "✓ correctly UNRESOLVED — a live process outside kitty is refused, not guessed at"
		: `🔴 resolved to window ${o.hits.map((w) => w.id).join(",")} — the matcher would wake a window for a process that is not in it`}`)
	try { process.kill(orphan, "SIGTERM") } catch {}
}
// Every chain passes through the kitty process itself. If kitty were ever also a
// window's root pid, every agent would resolve to that window.
const kittyPids = new Set(socks.map((s) => Number((s.match(/kitty-(\d+)$/) || [])[1])).filter(Boolean))
const clash = windows.filter((w) => kittyPids.has(w.pid))
console.log(`  kitty pid is not itself a window root: ${clash.length === 0 ? "✓" : `🔴 window ${clash.map((w) => w.id).join(",")} has the kitty pid — every agent would collide there`}`)
console.log(`  cwd ambiguity: ${collided.length ? `✓ demonstrated — ${collided.map(([c, v]) => `${v.length} windows share ${c}`).join("; ")}` : "not demonstrated in this layout (does not mean cwd is safe — it means the collision is not on screen right now)"}`)
const naiveAll = targets.filter((p) => STRATEGY_NAIVE(p, windows).hits.length).length
console.log(`  naive strategy: resolved ${naiveAll}/${targets.length} — ${naiveAll === 0 ? "✓ still wrong, keep the ancestry walk" : "⚠ it worked here; do NOT conclude it is safe, check whether these agents were exec'd"}`)

console.log(`\nresolved ${resolved}  unresolved ${unresolved}  ambiguous ${ambiguous}`)
process.exit(unresolved || ambiguous ? 1 : 0)
