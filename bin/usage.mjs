#!/usr/bin/env node
/**
 * claude-comm USAGE — the account's usage, read live by Claude Code itself, told to an agent at its threshold.
 *
 *   node .comm/bin/usage.mjs              the last reading on this machine: session and week, their age and reset
 *   node .comm/bin/usage.mjs --json       the same, as the JSON the hooks read
 *
 * WHY (`FINDINGS.md#usage-statusline`, asked by work 2026-10-24). Its experts stop at a threshold of the WEEK or of the
 * 5-hour SESSION, and the value came from a page a leader read by hand about once an hour - so it could be an hour old,
 * and at 05h01 on 10-25, with the browser closed, there was no reading at all. Measured before designing: Claude Code
 * hands every session's `statusLine` command `rate_limits.five_hour` / `.seven_day` (`used_percentage`, `resets_at`),
 * live. Usage is the ACCOUNT's, so one file for the whole machine, written by whichever session refreshed last.
 *
 * THREE PARTS, each a function the generated stub calls (`.claude/comm-hook.mjs`):
 *   · `statusline(stdin)` - the statusLine's call: the reading written ON CHANGE (115 refreshes in 10 min measured),
 *     its `at` refreshed at most once a minute so the age stays true; returns the line the status bar shows.
 *   · `check(...)` - after each Bash call: an agent whose project set a threshold (`.comm/config.json` `usage`) is told
 *     ONCE per window when the reading reaches it, with its age, and its leader gets a bus message pointing at
 *     `.comm/usage/<agent>.md`. The bell stays a pointer: the value is in the file, and in the note.
 *   · the CLI above, for a person.
 * Every path returns quietly on any error: usage is advice, and a hook must never break a session.
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs"
import { join, resolve, relative } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

// The registry's formula (session-registry.mjs `registryDir`), so the test seam is the same: CLAUDE_COMM_RUNTIME.
export function usagePath() {
	const base = process.env.CLAUDE_COMM_RUNTIME || process.env.XDG_RUNTIME_DIR
	return base ? join(base, "claude-comm", "usage.json") : `/tmp/claude-comm-${typeof process.getuid === "function" ? process.getuid() : "nouid"}/usage.json`
}
const WINDOWS = [["session", "five_hour"], ["week", "seven_day"]]
const pct = (n) => `${Math.round(n)} %`
const ago = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 90 ? `${s} s` : s < 5400 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h` }
const when = (epochS) => { const t = new Date(epochS * 1000); const hm = t.toTimeString().slice(0, 5)
	// the LOCAL date: toISOString() pairs a local time with the UTC date (FINDINGS.md#A26, comm.mjs `clock`)
	return t.toDateString() === new Date().toDateString() ? hm : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")} ${hm}` }

export function read() {
	try { const r = JSON.parse(readFileSync(usagePath(), "utf8")); return r && r.v === 1 && Number.isFinite(r.at) ? r : null } catch { return null }
}

export function statusline(raw, now = Date.now()) {
	let rl = null, sid = null
	try { const j = JSON.parse(raw); rl = j && j.rate_limits; sid = j && j.session_id } catch { return "" }
	if (!rl || typeof rl !== "object") return ""
	const win = (x) => x && Number.isFinite(x.used_percentage) ? { pct: x.used_percentage, resets_at: Number(x.resets_at) || null } : null
	const r = { v: 1, at: now, five_hour: win(rl.five_hour), seven_day: win(rl.seven_day), session: typeof sid === "string" ? sid : null }
	if (!r.five_hour && !r.seven_day) return ""
	const prev = read()
	const same = prev && WINDOWS.every(([, w]) => JSON.stringify(prev[w]) === JSON.stringify(r[w]))
	if (!same || now - prev.at >= 60_000) {
		try {
			const p = usagePath(), tmp = `${p}.${process.pid}.tmp`
			mkdirSync(resolve(p, ".."), { recursive: true })
			writeFileSync(tmp, JSON.stringify(r) + "\n")
			renameSync(tmp, p)
		} catch { /* the bar still shows the value; only the other sessions miss it */ }
	}
	return [r.five_hour && `5h ${pct(r.five_hour.pct)}`, r.seven_day && `7d ${pct(r.seven_day.pct)}`].filter(Boolean).join(" · ")
}

export function check({ projectRoot, agentRoot, bus, now = Date.now() }) {
	let cfg
	try { cfg = JSON.parse(readFileSync(join(projectRoot, ".comm", "config.json"), "utf8")) } catch { return "" }
	const u = cfg && cfg.usage
	if (!u || typeof u !== "object") return ""
	const me = Object.keys(cfg.agents || {}).find((a) => resolve(projectRoot, cfg.agents[a] || ".") === resolve(agentRoot))
	if (!me) return ""
	const r = read()
	if (!r) return ""
	const own = (u.agents && typeof u.agents === "object" && u.agents[me]) || {}
	const dir = join(projectRoot, ".comm", "usage")
	const hits = []
	for (const [key, w] of WINDOWS) {
		const T = Number.isFinite(own[key]) ? own[key] : u[key], x = r[w]
		if (!Number.isFinite(T) || !x || !(x.pct >= T)) continue
		// ONCE per window, by an exclusive create: two Bash calls ending together must not both tell.
		try { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, `.told-${me}-${w}-${x.resets_at}`), "", { flag: "wx" }) } catch { continue }
		hits.push({ key, w, T, x })
	}
	if (!hits.length) return ""
	const age = ago(now - r.at)
	const lines = hits.map((h) => `${h.key === "week" ? "the week (7-day window)" : "the session (5-hour window)"} is at ${pct(h.x.pct)} - ` +
		`the threshold set for '${me}' is ${pct(h.T)}${h.x.resets_at ? `; it resets at ${when(h.x.resets_at)}` : ""}`)
	const rec = join(dir, `${me}.md`)
	try {
		writeFileSync(rec, `# usage: '${me}' reached its threshold\n\n${lines.map((l) => `- ${l}`).join("\n")}\n- the reading is ${age} old ` +
			`(${new Date(r.at).toTimeString().slice(0, 8)}), written by a session's statusLine; told at ${new Date(now).toTimeString().slice(0, 8)}\n` +
			`- the thresholds are this project's: \`.comm/config.json\` "usage"\n`)
	} catch {}
	let toldLeader = false
	if (me !== cfg.leader && bus && existsSync(rec)) {
		const note = `usage: ${hits.map((h) => `${h.key} ${pct(h.x.pct)} >= ${pct(h.T)}`).join(", ")} for '${me}' (read ${age} before)`
		const s = spawnSync(process.execPath, [bus, "send", cfg.leader, "--ref", relative(agentRoot, rec), "--kind", "fyi", "--note", note],
			{ cwd: agentRoot, encoding: "utf8", timeout: 10_000 })
		toldLeader = s.status === 0
	}
	return `[claude-comm] usage: ${lines.join("; and ")}. The reading is ${age} old. ` +
		(me === cfg.leader ? "You are the leader: nobody else was told." : toldLeader ? `Your leader '${cfg.leader}' has been told.` : `Telling your leader '${cfg.leader}' FAILED - tell them.`) +
		` Act on your project's rule for this threshold (.comm/config.json "usage"; the record: ${relative(agentRoot, rec)}).`
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
	if (process.argv.includes("--help")) {
		console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => /^ \*\s{2,}node \S*bin\/[\w-]+\.mjs/.test(l))
			.map((l) => l.replace(/^ \*\s+/, "").replace(/^node (\.comm\/)?bin\//, "node .comm/bin/")).join("\n"))
		process.exit(0)
	}
	const r = read()
	if (process.argv.includes("--json")) { console.log(JSON.stringify(r)); process.exit(r ? 0 : 1) }
	if (!r) {
		console.log(`no usage reading on this machine (${usagePath()}): a session's statusLine writes it - a project opts in with\n` +
			`"usage": {"statusLine": true} in .comm/config.json, then re-runs install.mjs`)
		process.exit(1)
	}
	const age = ago(Date.now() - r.at)
	for (const [key, w] of WINDOWS) if (r[w]) console.log(`${key.padEnd(8)} ${pct(r[w].pct).padStart(5)}${r[w].resets_at ? `   resets ${when(r[w].resets_at)}` : ""}`)
	console.log(`read ${age} ago by a session's statusLine`)
}
