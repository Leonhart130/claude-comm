#!/usr/bin/env node
/**
 * claude-comm TEAM — what "teams" in .comm/config.json means: for one agent, for who may act on whom, and on one page.
 *
 *   node .comm/bin/team.mjs                      what is yours: who you lead, who you work for, who you write to with no pair
 *   node .comm/bin/team.mjs --agent-root <dir>   the same for the agent whose stub is there (what the start message prints)
 *   node .comm/bin/team.mjs --board              by chief: each member's state, its open requests, its `done` and `blocked` since your last look; pointers only
 *
 *   .comm/config.json  "teams": {"<chief>": ["<expert>", ...]}   a chief and its experts, the chiefs, the experts of one team write with no pair
 *   .comm/config.json  "caps": {"working": 5, "availableMb": 2500, "windows": 12}   launch.mjs refuses past any of them, and the refusal gives the numbers
 *
 * A start line is nothing when the agent is in no team and leads none, or the project declares none: it writes nothing and rings nobody.
 * Only --board writes, one file, its reader's last look (.comm/board/<reader>).
 * Out of comm.mjs because the bus is capped at one Read call (A22) and only a start message, launch.mjs, close.mjs and the board need these. FINDINGS.md#teams, #teams-b
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join, dirname, resolve, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { teams, headsOf, teamFaults, leads, askersOf, ASKED } from "./comm.mjs"
import { turnOf } from "./who.mjs"
import { sessionPid, processState, startTimeOf, bootId } from "./session-registry.mjs"

const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k)
const nap = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
export { leads, teams, askersOf, teamFaults }

// THE TIER's two rules, here because launch.mjs cannot be imported (it runs) and a "reopen" entry is judged against the same ones. A57.
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"]   // `claude --help`, 2026-09-13
export const MODEL_RE = /^(opus|sonnet|haiku|fable|claude-[a-z0-9][a-z0-9.-]*)(\[1m\])?$/

/** The sentences for agent `a`: empty when none applies. */
export function roleOf(cfg, a) {
	const t = teams(cfg)
	if (!t) return ""
	if (a === cfg.leader) return `This project has teams: ${Object.keys(t).map((h) => `${h} (${t[h].join(", ")})`).join("; ")}. A chief writes to its experts and to the other chiefs without you: carry an order to its chief, and read their reports.`
	const hs = headsOf(cfg, a), lead = own(t, a), bits = []
	if (lead) bits.push(`You LEAD a team: ${t[a].join(", ")}. Write to them, and to the other chiefs (${Object.keys(t).filter((h) => h !== a).join(", ") || "none"}), with no pair; you may open a pair for one of your experts, launch your experts and close their windows (close.mjs --agent <x>).`)
	if (hs.length) bits.push(`You work for ${hs.map((h) => `'${h}'`).join(" and ")}: write directly to them and to your team (${[...new Set(hs.flatMap((h) => t[h]))].filter((x) => x !== a).join(", ") || "nobody else"}).`)
	// Work's review of its skills, letter 51: `@asker` follows requests, and a chief that gave work some other way has none open, so an expert of several chiefs names the one it answers. And it does not reach another chief at all.
	if (lead) bits.push("To another chief, name it: `send <chief>`.")
	if (hs.length > 1) bits.push("You have several chiefs: name the one whose task you answer, `send <chief> --kind done`. A question is `--kind blocked`: a `done` closes the request.")
	else if (lead || hs.length) bits.push("Report with `send @asker --kind done`: it reaches the one who waits on your work, else your chief, else the leader; if several wait it says so, and you name one. A question is `--kind blocked`: a `done` closes the request.")
	return bits.join(" ")
}

// ── WHO IS ASKING: one answer for launch.mjs, close.mjs --agent and the board ──────────────────────────────────
// The session's own process, never this shell: a Bash that moved keeps its session, and `who` already names every session
// by what /proc says of IT (its folder, its CLAUDE_COMM_AGENT), one implementation of "which process is which agent".
// A session a session started is told apart by a `claude` ABOVE it: env and folder are inherited, so nothing else separates
// them (review #8 C4), and a hand-started leader is not its window's process, so close.mjs's strict test cannot be asked of it.
// A guard against mistakes, as launch.mjs's "launch" entry is: an agent can edit config.json. FINDINGS.md#teams-b
const ppidOf = (pid) => {
	try { const st = readFileSync(`/proc/${pid}/stat`, "utf8"); return Number(st.slice(st.lastIndexOf(")") + 2).split(" ")[1]) || 0 } catch { return 0 }
}
const sessionAbove = (pid) => { const p = ppidOf(pid); return p > 1 ? sessionPid(p) : 0 }
const COMM = join(dirname(fileURLToPath(import.meta.url)), "comm.mjs")
/** `comm who --json`, or null: not knowing is not "nobody is running". */
export function liveState(root) {
	const r = spawnSync(process.execPath, [COMM, "who", "--json"], { cwd: root, encoding: "utf8", timeout: 5000 })
	try { return r.status === 0 ? JSON.parse(r.stdout) : null } catch { return null }
}
/** { session: false } in a plain shell; else its pid, the agent it is (or null), and the session above it (or 0). */
export function callerOf(state) {
	const pid = sessionPid()
	if (!pid) return { session: false }
	if (!state) return { session: true, pid, unknown: "`comm who` did not answer" }
	const agent = Object.keys(state.agents).find((a) => state.agents[a].pids.includes(pid)) || null
	return { session: true, pid, agent, nested: sessionAbove(pid) }
}
/** May this caller launch or close `agent`? The leader, or a chief of it. { ok, by } or { ok: false, why }, and `why` says what to do. */
export function judge(cfg, c, agent) {
	if (c.unknown) return { ok: false, why: `who is asking could not be read: ${c.unknown}. Not knowing is not permission.` }
	if (c.nested) return { ok: false, why: `this session (pid ${c.pid}) was started by another session (pid ${c.nested}), and a sub-session acts for nobody. Run it from the session above.` }
	if (!c.agent) return { ok: false, why: `this session (pid ${c.pid}) is no agent of this project: its folder is not on the roster, or it declares itself off the bus. Run it from the leader or a chief.` }
	if (c.agent === cfg.leader || leads(cfg, c.agent, agent)) return { ok: true, by: c.agent }
	return { ok: false, why: `'${c.agent}' is neither the leader nor a chief of '${agent}': only ${[cfg.leader, ...headsOf(cfg, agent)].map((a) => `'${a}'`).join(" or ")} may. Ask them: node ${relative(process.cwd(), COMM)} send @asker --kind blocked --ref <a file saying why>` }
}
/** A launch with a first turn is a request, as a nudge is: the agent's `done` to this caller closes it (comm.mjs, `send`). */
export function openRequest(root, cfg, agent, asker) {
	if (!teams(cfg) || !(asker === cfg.leader || leads(cfg, asker, agent))) return false
	try { mkdirSync(ASKED(root, agent), { recursive: true }); writeFileSync(join(ASKED(root, agent), asker), new Date().toISOString()); return true } catch { return false }
}

// ── WHAT A SESSION IS DOING ────────────────────────────────────────────────────────────────────────────────────
const envOf = (pid) => { try { return readFileSync(`/proc/${pid}/environ`, "utf8").split("\0") } catch { return [] } }
export const turnNow = (pid) => turnOf(pid, envOf(pid))

// ── THE CAPS: refused with the numbers, in the file that opens windows ────────────────────────────────────────
const CAP_KEYS = ["working", "availableMb", "windows"]
export function capFaults(cfg) {
	const c = cfg && cfg.caps
	if (c === undefined) return []
	if (!c || typeof c !== "object" || Array.isArray(c)) return ['"caps" is not an object']
	const out = Object.keys(c).filter((k) => !CAP_KEYS.includes(k)).map((k) => `"caps" has ${JSON.stringify(k)}: only ${CAP_KEYS.join(", ")} are read, and a misspelt one would launch without it`)
	for (const k of CAP_KEYS) if (own(c, k) && !(Number.isFinite(c[k]) && c[k] > 0)) out.push(`"caps" "${k}" must be a number above 0, it is ${JSON.stringify(c[k])}`)
	return out
}
/** MemAvailable, the machine's: every window of every project is already in it. Null when it cannot be read. */
export function availableMb() {
	try { const m = readFileSync("/proc/meminfo", "utf8").match(/^MemAvailable:\s+(\d+) kB/m); return m ? Math.floor(Number(m[1]) / 1024) : null } catch { return null }
}
/**
 * { over: [what is past its cap], line: the numbers } for one more session in this project. `working`: the runtime says busy
 * (a session with only sub-agents at work says it too: they are work), or it has no record yet, which is a session starting
 * and about to work. `windows`: every live session on the roster, the leader's included, none that a session started.
 */
export function capsCheck(cfg, state) {
	const c = cfg.caps || {}, over = [], line = []
	const live = Object.entries(state.agents).flatMap(([a, s]) => s.pids.map((pid) => ({ a, pid }))).filter((s) => !sessionAbove(s.pid))
	if (own(c, "working")) {
		const w = live.filter((s) => { const t = turnNow(s.pid); return t.state === "busy" || /keeps no record/.test(t.why || "") })
		line.push(`working ${w.length}/${c.working}`)
		if (w.length >= c.working) over.push(`${w.length} sessions are working (${w.map((s) => s.a).join(", ")}) and the cap is ${c.working}`)
	}
	if (own(c, "windows")) {
		line.push(`windows ${live.length}/${c.windows}`)
		if (live.length >= c.windows) over.push(`${live.length} windows are live in this project (${live.map((s) => s.a).join(", ")}) and the cap is ${c.windows}`)
	}
	if (own(c, "availableMb")) {
		const mb = availableMb()
		line.push(`available ${mb === null ? "?" : mb} MB (floor ${c.availableMb})`)
		if (mb === null) over.push(`/proc/meminfo could not be read, and the floor is ${c.availableMb} MB: not knowing is not room`)
		else if (mb < c.availableMb) over.push(`${mb} MB are available on this machine and the floor is ${c.availableMb} MB`)
	}
	return { over, line: line.join(", ") }
}

// ── ONE LAUNCH AT A TIME: caps read and window opened under one lock, or a burst of reopenings all read the same room ──
/**
 * Taken, or { ok: false, holder }. A holder whose process is gone is no holder; a parent holding it lends it to its child (reopen -> launch).
 * 🔴 TAKING OVER A DEAD HOLDER IS ITS OWN LOCK. Each taker read "stale" and unlinked what was there, so one removed the lock another had just
 * won: a reviewer's six takers after a kill held it two at once, 9 rounds of 25. Now one taker at a time re-reads under `<path>.steal`; nothing can
 * replace a stale file meanwhile (creation needs it gone, and its holder is dead). And a release removes only its own.
 */
export function takeLock(path, { waitMs = 30_000 } = {}) {
	const me = { pid: process.pid, start: startTimeOf(process.pid), boot: bootId() }
	const read = () => { try { return JSON.parse(readFileSync(path, "utf8")) } catch { return null } }
	const isStale = (h) => { if (h) return processState(h) === "gone"; try { return Date.now() - statSync(path).mtimeMs > 5000 } catch { return false } }
	let holder = null
	for (const t0 = Date.now(); ; nap(50)) {
		try {
			mkdirSync(dirname(path), { recursive: true })
			writeFileSync(path, JSON.stringify(me), { flag: "wx" })
			const release = () => { const h = read(); if (h && h.pid === me.pid && h.start === me.start) try { unlinkSync(path) } catch {} }
			process.on("exit", release)
			return { ok: true, release }
		} catch (e) { if (e.code !== "EEXIST") return { ok: false, why: e.code || e.message } }
		holder = read()
		if (holder && holder.pid === process.ppid) return { ok: true, lent: true, release: () => {} }
		// a holder killed: gone by (pid, start, boot). A file with no JSON is a writer between its two calls, or one that died there: old, it is gone too.
		if (isStale(holder)) {
			const steal = `${path}.steal`
			let stolen = false
			try {
				writeFileSync(steal, String(process.pid), { flag: "wx" })
				try { if (isStale(read())) { unlinkSync(path); stolen = true } } catch {}
				try { unlinkSync(steal) } catch {}
			} catch (e) { if (e.code === "EEXIST") try { if (Date.now() - statSync(steal).mtimeMs > 5000) unlinkSync(steal) } catch {} }
			if (stolen) continue
		}
		// past the takeover too: a folder that cannot take the steal file (read-only, full) spun here for ever, and launch.mjs hung instead of refusing
		if (Date.now() - t0 >= waitMs) return { ok: false, holder }
	}
}

// ── "reopen" ───────────────────────────────────────────────────────────────────────────────────────────────────
const REOPEN_TIMES = ["startMs", "settleMs", "retryMs", "tellMs", "lockMs"]
/** A typo in the timing changes a delay, not who opens: its default holds, so it is said and refuses nobody. */
function timingFaults(cfg) {
	const tm = cfg && cfg.reopenTiming
	if (tm === undefined) return []
	if (!tm || typeof tm !== "object" || Array.isArray(tm)) return ['"reopenTiming" is not an object']
	return Object.entries(tm).filter(([k, v]) => !REOPEN_TIMES.includes(k) || !(Number.isFinite(v) && v >= 0)).map(([k]) => `"reopenTiming" "${k}": only ${REOPEN_TIMES.join(", ")} are read, each a number of ms`)
}
/** Why this declaration cannot open `agent`, or nothing. A misspelt one found at night is a Monday lost, so it is also said at every start. */
export function reopenFaults(cfg, only = null) {
	const r = cfg && cfg.reopen
	if (r === undefined) return []
	if (!r || typeof r !== "object" || Array.isArray(r)) return ['"reopen" is not an object']
	const out = []
	// 🔴 NO BOUND, NO REOPENING: 8 closed chiefs with mail in one hook opened 8 windows (a reviewer's fixture), the very night letter 49 promised against.
	// `working` alone does not bound it: a chief that has read its mail and gone idle does not count as working, and holds its memory all the same.
	const c = cfg.caps
	if (!c || typeof c !== "object" || !(own(c, "windows") || own(c, "availableMb"))) out.push(`"reopen" needs "caps" with "windows" or "availableMb": without a bound, one night's mail could fill the machine`)
	// `only`: a typo in one entry costs that agent, not the Monday of the others
	for (const [a, d] of Object.entries(r).filter(([k]) => only === null || k === only)) {
		const at = `"reopen" "${a}"`
		if (!own(cfg.agents, a)) { out.push(`${at}: not on the roster`); continue }
		if (!d || typeof d !== "object" || Array.isArray(d)) { out.push(`${at} is not {"model", "effort", "say"}`); continue }
		const extra = Object.keys(d).filter((k) => !["model", "effort", "say"].includes(k))
		if (extra.length) out.push(`${at} has ${extra.map((k) => JSON.stringify(k)).join(", ")}: only "model", "effort" and "say" are read`)
		if (typeof d.model !== "string" || !MODEL_RE.test(d.model)) out.push(`${at} "model" is not a model name: ${JSON.stringify(d.model)}`)
		if (!EFFORTS.includes(d.effort)) out.push(`${at} "effort" is not ${EFFORTS.join(" | ")}: ${JSON.stringify(d.effort)}`)
		if (typeof d.say !== "string" || !d.say.trim() || d.say.startsWith("-") || /[\0-\x1f]/.test(d.say)) out.push(`${at} "say" must be one line of text not beginning with "-" (claude would read it as a flag)`)
	}
	return out
}
/** Every message waiting for `agent` that asks something, oldest first: an `fyi` asks nothing, and a boot is the price of a reopening. Null when the box cannot be read. */
export function asksFor(root, agent) {
	const dir = join(root, ".comm", "inbox", agent)
	let names
	try { names = readdirSync(dir) } catch (e) { return e.code === "ENOENT" ? [] : null }
	const out = []
	for (const f of names.filter((n) => n.endsWith(".json"))) {
		try { const m = JSON.parse(readFileSync(join(dir, f), "utf8")); if (m.kind !== "fyi" && m.ts) out.push(m) } catch {}
	}
	return out.sort((a, b) => (a.ts < b.ts ? -1 : 1))
}
/** What is wrong with this project's "caps" and "reopen", for the start message, the installer and boot. */
export const configFaults = (cfg) => [...capFaults(cfg), ...reopenFaults(cfg), ...timingFaults(cfg)]

// ── THE BOARD ──────────────────────────────────────────────────────────────────────────────────────────────────
const when = (iso) => { const d = new Date(iso); if (isNaN(d)) return String(iso); const p = (n) => String(n).padStart(2, "0"); return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` }
function stateWord(state, a) {
	const pids = (state && state.agents[a] && state.agents[a].pids) || []
	if (!state) return "state ?"
	if (!pids.length) return "not running"
	if (pids.length > 1) return `${pids.length} sessions`
	const t = turnNow(pids[0])
	return t.state === "busy" ? "working" : t.state === "idle" ? `IDLE${t.at ? ` ${Math.max(0, Math.round((Date.now() - t.at) / 60000))} min` : ""}`
		: t.waiting ? "WAITING on a dialog" : t.status ? `${t.status} (its runtime's word)` : "turn ?"
}
/** Every `done` and `blocked` newer than `since`, from the log (written at delivery) and the inboxes (not delivered yet). Form E: a failed read is said, never an empty board. */
function reports(root, since) {
	const out = [], faults = []
	try {
		for (const l of readFileSync(join(root, ".comm", "log.jsonl"), "utf8").split("\n")) { if (l) try { out.push(JSON.parse(l)) } catch {} }
	} catch (e) { if (e.code !== "ENOENT") faults.push(`.comm/log.jsonl could not be read (${e.code})`) }
	const ibx = join(root, ".comm", "inbox")
	try {
		for (const a of readdirSync(ibx)) for (const f of readdirSync(join(ibx, a)).filter((n) => n.endsWith(".json"))) {
			try { out.push(JSON.parse(readFileSync(join(ibx, a, f), "utf8"))) } catch {}
		}
	} catch (e) { if (e.code !== "ENOENT") faults.push(`.comm/inbox could not be read (${e.code})`) }
	const seen = new Set()
	return { faults, rows: out.filter((m) => (m.kind === "done" || m.kind === "blocked") && m.ts > since && !seen.has(m.id) && seen.add(m.id)).sort((a, b) => (a.ts < b.ts ? -1 : 1)) }
}
export function board(root, cfg, reader, { now = Date.now() } = {}) {
	const t = teams(cfg), mark = join(root, ".comm", "board", String(reader).replace(/[^\w.-]/g, "_"))
	let since = null
	try { since = readFileSync(mark, "utf8").trim() || null } catch {}
	const from = since || new Date(now - 24 * 3600_000).toISOString()
	const state = liveState(root), { rows, faults } = reports(root, from)
	const readAll = !faults.length
	const lines = [`board for '${reader}' - ${since ? `since your last look, ${when(since)}` : "your first look: the last 24 h"}`]
	if (!state) lines.push("⚠ `comm who` did not answer: the states below cannot be read")
	for (const f of faults) lines.push(`⚠ ${f}: reports may be missing below`)
	if (cfg.teams && !t) lines.push(`⚠ "teams" is IGNORED, so a star: ${teamFaults(cfg)[0]}`)
	const member = (a, indent) => {
		lines.push(`${indent}${a} · ${stateWord(state, a)}`)
		for (const asker of askersOf(root, cfg, a)) {
			let at = ""
			try { at = when(readFileSync(join(ASKED(root, a), asker), "utf8").trim()) } catch {}
			lines.push(`${indent}   asked by ${asker}${at ? ` since ${at}` : ""}`)
		}
		for (const m of rows.filter((r) => r.from === a)) lines.push(`${indent}   ${m.kind} ${when(m.ts)} → ${m.to}: ${m.refPath || m.ref}`)
	}
	const chiefs = t ? Object.keys(t) : []
	const mine = t && own(t, reader) ? [reader] : chiefs
	for (const h of mine) { member(h, ""); for (const a of t[h]) member(a, "  ") }
	if (!(t && own(t, reader))) {
		const placed = new Set([cfg.leader, ...chiefs, ...chiefs.flatMap((h) => t[h])])
		const rest = Object.keys(cfg.agents).filter((a) => !placed.has(a))
		if (rest.length) { if (t) lines.push("(no chief)"); for (const a of rest) member(a, t ? "  " : "") }
	}
	// A LOOK THAT COULD NOT READ EVERYTHING IS NO LOOK: moved anyway, a report in a log unreadable for one read showed in neither look (a reviewer's fixture)
	if (!readAll) { lines.push("⚠ your last look was not moved: the next look reads from the same point"); return lines.join("\n") }
	let wrote = true
	try { mkdirSync(dirname(mark), { recursive: true }); writeFileSync(mark, new Date(now).toISOString()) } catch { wrote = false }
	if (!wrote) lines.push(`⚠ your last look could not be written (${mark}): the next look shows these again`)
	return lines.join("\n")
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	// HERE, not at the top: launch.mjs, close.mjs, reopen.mjs and the installer import this file, and `install.mjs --help` would print ours and leave
	if (process.argv.includes("--help")) {
		console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => /^ \*\s{2,}node \S*bin\/[\w-]+\.mjs/.test(l))
			.map((l) => l.replace(/^ \*\s+/, "").replace(/^node (\.comm\/)?bin\//, "node .comm/bin/")).join("\n"))
		process.exit(0)
	}
	const i = process.argv.indexOf("--agent-root"), at = resolve(i > 0 && process.argv[i + 1] ? process.argv[i + 1] : process.cwd())
	let root = at
	while (!existsSync(join(root, ".comm", "config.json"))) { const up = dirname(root); if (up === root) process.exit(0); root = up }
	let cfg
	try { cfg = JSON.parse(readFileSync(join(root, ".comm", "config.json"), "utf8")) } catch { process.exit(0) }
	// identity is the bus's to say (comm.mjs whoami), the one place it is resolved
	const whoami = () => { const w = spawnSync(process.execPath, [COMM, "whoami", "--agent-root", at], { cwd: at, encoding: "utf8", timeout: 5000 }); return w.status === 0 ? String(w.stdout).trim() : "" }
	if (process.argv.includes("--board")) {
		// the session's own name when there is one: this shell may have moved. No session is a person, whatever folder: at the root it would read as the leader, and take the leader's look
		const c = callerOf(liveState(root))
		console.log(board(root, cfg, !c.session ? "a person at a shell" : c.nested ? "a sub-session" : c.agent || "a session off the roster"))
		process.exit(0)
	}
	const f = teamFaults(cfg)
	if (f.length) console.log(`"teams" is IGNORED, so this project is a star: ${f.join("; ")}`)
	const line = roleOf(cfg, whoami())
	if (line) console.log(line)
	const bad = configFaults(cfg)
	if (bad.length) console.log(`⚠ .comm/config.json: ${bad.join("; ")}`)
}
