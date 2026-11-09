#!/usr/bin/env node
/**
 * claude-comm USAGE — the account's usage, read live by Claude Code itself, told to an agent at its threshold.
 *
 *   node .comm/bin/usage.mjs              the last reading on this machine: session and week, their age and reset
 *   node .comm/bin/usage.mjs --json       the same, as the JSON the hooks read
 *
 *   .comm/config.json  "usage": {"week": 93, "session": 85}           a threshold, in % of the 7-day and the 5-hour window
 *   .comm/config.json  "usage": {"agents": {"leader": {"week": 98}}}  one agent's own, over the project's
 *   .comm/config.json  "usage": {"statusLine": true}                  the bar that WRITES the reading: without it, no session of
 *                                                                     this project feeds its thresholds (re-run install.mjs)
 *   .comm/config.json  "usage": {"refuse": true}                      launch.mjs refuses an agent at its threshold, or with no reading under 30 min old; no flag passes it, change the threshold. reopen.mjs always does
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
 *     ONCE per window when the reading reaches it, with its age and WHOSE session wrote it, and its leader gets a bus
 *     message pointing at `.comm/usage/<agent>.md`. The bell stays a pointer: the value is in the file, and in the note.
 *     And ONCE A DAY, an agent with a threshold whose own session writes no reading is told so (below, `feeds`).
 *   · the CLI above, for a person.
 * Every path returns quietly on any error: usage is advice, and a hook must never break a session.
 *
 * A THRESHOLD WITH NO READING OF ITS OWN IS SILENT (work, 10-31 01h15; `FINDINGS.md#usage-statusline`). Work set thresholds
 * without `"statusLine": true`, so none of its sessions wrote a reading: its checks read the last one ANY project's session
 * wrote - another project's, frozen at that session's last turn, 20 points below the account's page - and stayed quiet,
 * the error on the reassuring side. The config is read live, so a threshold needs no install to start counting: a warning
 * at install alone could never be seen. So the reading records its project, every note names it, and an agent whose own
 * session has no statusLine of the bus is told once a day.
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs"
import { join, resolve, relative, basename } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

// The registry's formula (session-registry.mjs `registryDir`), so the test seam is the same: CLAUDE_COMM_RUNTIME.
export function usagePath() {
	// the same file from a session and from a cron with no XDG_RUNTIME_DIR, as wake.mjs's lock: a timer's reopening read "no reading" beside one 49 s old (review, 11-09)
	const uid = typeof process.getuid === "function" ? process.getuid() : "nouid"
	const base = process.env.CLAUDE_COMM_RUNTIME || process.env.XDG_RUNTIME_DIR || (existsSync(`/run/user/${uid}`) ? `/run/user/${uid}` : null)
	return base ? join(base, "claude-comm", "usage.json") : `/tmp/claude-comm-${uid}/usage.json`
}
const WINDOWS = [["session", "five_hour"], ["week", "seven_day"]]
const pct = (n) => `${Math.round(n)} %`
const ago = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 90 ? `${s} s` : s < 5400 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h` }
// the LOCAL date: toISOString() pairs a local time with the UTC date (FINDINGS.md#A26, comm.mjs `clock`)
const ymd = (t) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
const when = (epochS) => { const t = new Date(epochS * 1000); const hm = t.toTimeString().slice(0, 5)
	return t.toDateString() === new Date().toDateString() ? hm : `${ymd(t)} ${hm}` }

// The bus's own statusLine, as install.mjs writes it (`STATUS_COMMAND`). ONE test, imported by the installer: the warning it
// prints at install and the one told here at run time must never disagree about what feeds a reading.
export const oursStatus = (sl) => /\.claude\/comm-hook\.mjs"? statusline\b/.test(String((sl && sl.command) || ""))
// The thresholds that apply to agent `me`: its own entry over the project's, window by window. ONE definition, imported by
// the installer too.
export function thresholdsFor(u, me) {
	if (!u || typeof u !== "object") return {}
	const own = (u.agents && typeof u.agents === "object" && u.agents[me]) || {}, out = {}
	for (const [key] of WINDOWS) { const T = Number.isFinite(own[key]) ? own[key] : u[key]; if (Number.isFinite(T)) out[key] = T }
	return out
}
// Does THIS agent's session write a reading? Only the bus's statusLine writes one, and the installer puts it in the agent's
// `.claude/settings.json` only. `settings.local.json` outranks that file in Claude Code, so a statusLine of a person's own
// there hides ours. A file that cannot be read has no statusLine of the bus in it: said, never assumed fed (LESSONS form E).
export function feeds(agentRoot) {
	const sl = (f) => { try { return JSON.parse(readFileSync(join(agentRoot, ".claude", f), "utf8")).statusLine } catch { return undefined } }
	const local = sl("settings.local.json")
	return local ? oursStatus(local) : oursStatus(sl("settings.json"))
}
// Whose session wrote reading `r`, said from the project `root` that reads it.
const whose = (r, root) => !r.project ? "whose project was not recorded (a bus older than 2026-10-31.2)"
	: resolve(r.project) === resolve(root) ? "of this project" : `of ANOTHER project, ${r.project}`
const sess = (r) => typeof r.session === "string" ? ` (session ${r.session.slice(0, 8)})` : ""

export function read() {
	try { const r = JSON.parse(readFileSync(usagePath(), "utf8")); return r && r.v === 1 && Number.isFinite(r.at) ? r : null } catch { return null }
}

/**
 * MAY THIS AGENT BE OPENED NOW? A window is a boot, and here a threshold stops being advice: reopen.mjs always, launch.mjs where the project says "refuse": true.
 * THE SAME CALCULATION AS check(): its own threshold over the project's, reached at >=.
 * NOT KNOWING REFUSES: no reading, one over 30 min old, one from before its window's reset, one without the week. A frozen reading has lied by 20 points, on the comfortable side (work, 10-31).
 * The 5-hour window alone may be absent, and then compares nothing: measured so on this account, 11-09, with sessions running. A week absent was never measured.
 * 30 min is a choice, not a measurement: work and I kept it, 11-09. Its price: at night with nothing running the agent waits for a person, and the first launch by hand after 30 idle minutes is refused until a session has answered.
 * `key` is what a refusal is told once per: a window of usage and the threshold reached (another agent's own threshold is news), or a local day of not knowing.
 */
const MAX_AGE_MS = 30 * 60_000
export function gate(cfg, agent, now = Date.now(), r = read()) {
	const Ts = thresholdsFor(cfg && cfg.usage, agent)
	if (!Object.keys(Ts).length) return { ok: true, line: "" }
	const unknown = (why) => ({ ok: false, why, key: `unknown-${ymd(new Date(now))}`,
		next: `Not knowing is not room. Only a session's statusLine writes a reading: if none is running, start one by hand in this project (claude), let it answer once, then try again. To look: node .comm/bin/usage.mjs` })
	if (!r) return unknown("there is no usage reading on this machine")
	const age = now - r.at
	if (age < -60_000) return unknown(`the usage reading is dated ${ago(-age)} ahead of this clock`)
	if (age > MAX_AGE_MS) return unknown(`the usage reading is ${ago(age)} old, and one over ${MAX_AGE_MS / 60_000} min says nothing`)
	const seen = [], late = [], absent = []
	for (const [key, w] of WINDOWS) {
		const T = Ts[key], x = r[w]
		if (!Number.isFinite(T)) continue
		if (!x || !Number.isFinite(x.pct)) { absent.push(key); continue }
		if (x.resets_at && x.resets_at * 1000 <= now) { late.push(`${key}: ${when(x.resets_at)}`); continue }
		if (x.pct >= T) return { ok: false, key: `${w}-${x.resets_at}-${T}`,
			why: `the ${key === "week" ? "week" : "5-hour session"} is at ${pct(x.pct)} and the threshold for '${agent}' is ${pct(T)}`,
			next: `${x.resets_at ? `It resets at ${when(x.resets_at)}. ` : ""}No flag passes this: a person changes the threshold in .comm/config.json "usage".` }
		seen.push(`${key} ${pct(x.pct)} (threshold ${pct(T)})`)
	}
	if (late.length) return unknown(`the usage reading is from before its reset (${late.join(", ")})`)
	if (!seen.length || absent.includes("week")) return unknown(`the usage reading does not hold ${absent.join(" or ")}, and '${agent}' has a threshold there`)
	return { ok: true, line: `${seen.join(", ")}, read ${ago(age)} ago` }
}

// `project` is the stub's own root, passed by it - never the session's cwd (an identity comes from the stub's location).
export function statusline(raw, now = Date.now(), { project = null } = {}) {
	let rl = null, sid = null
	try { const j = JSON.parse(raw); rl = j && j.rate_limits; sid = j && j.session_id } catch { return "" }
	if (!rl || typeof rl !== "object") return ""
	const win = (x) => x && Number.isFinite(x.used_percentage) ? { pct: x.used_percentage, resets_at: Number(x.resets_at) || null } : null
	const r = { v: 1, at: now, five_hour: win(rl.five_hour), seven_day: win(rl.seven_day), session: typeof sid === "string" ? sid : null,
		project: typeof project === "string" ? project : null }
	if (!r.five_hour && !r.seven_day) return ""
	const prev = read()
	// A change of writer alone is NOT a change: the file names the session that wrote these values, at the age it says,
	// which stays true while another one reports the same; making it a change would double the writes of two projects.
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
	const Ts = thresholdsFor(u, me)
	if (!Object.keys(Ts).length) return ""
	const r = read()
	const dir = join(projectRoot, ".comm", "usage")
	// NO READING OF ITS OWN: once a LOCAL day per agent, by the same exclusive create as below. Not sent to the leader:
	// it is a fact about this agent's session, and a leader with a threshold of its own is told in its own session.
	let unfed = ""
	if (!feeds(agentRoot)) try {
		mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, `.told-${me}-unfed-${ymd(new Date(now))}`), "", { flag: "wx" })
		unfed = `[claude-comm] usage: '${me}' has a threshold, and its session writes NO usage reading: no statusLine of the bus in ` +
			`${relative(agentRoot, join(agentRoot, ".claude", "settings.json"))} (or a person's own in settings.local.json hides it). ` +
			(r ? `The reading it checks was written ${ago(now - r.at)} ago by a session ${whose(r, projectRoot)}${sess(r)}, and is only as fresh as that session's last turn`
				: "There is no reading on this machine at all") +
			` - so a threshold can stay silent while the account is past it. To feed it: "statusLine": true in .comm/config.json "usage", ` +
			`then re-run install.mjs (it never replaces a person's own statusLine; that change is the owner's to make). Told once a day.`
	} catch { /* told already today */ }
	if (!r) return unfed
	const hits = []
	for (const [key, w] of WINDOWS) {
		const T = Ts[key], x = r[w]
		if (!Number.isFinite(T) || !x || !(x.pct >= T)) continue
		// ONCE per window, by an exclusive create: two Bash calls ending together must not both tell.
		try { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, `.told-${me}-${w}-${x.resets_at}`), "", { flag: "wx" }) } catch { continue }
		hits.push({ key, w, T, x })
	}
	if (!hits.length) return unfed
	const age = ago(now - r.at), from = whose(r, projectRoot)
	const lines = hits.map((h) => `${h.key === "week" ? "the week (7-day window)" : "the session (5-hour window)"} is at ${pct(h.x.pct)} - ` +
		`the threshold set for '${me}' is ${pct(h.T)}${h.x.resets_at ? `; it resets at ${when(h.x.resets_at)}` : ""}`)
	const rec = join(dir, `${me}.md`)
	try {
		writeFileSync(rec, `# usage: '${me}' reached its threshold\n\n${lines.map((l) => `- ${l}`).join("\n")}\n- the reading is ${age} old ` +
			`(${new Date(r.at).toTimeString().slice(0, 8)}), written by the statusLine of a session ${from}${sess(r)}; told at ${new Date(now).toTimeString().slice(0, 8)}\n` +
			`- the thresholds are this project's: \`.comm/config.json\` "usage"\n`)
	} catch {}
	let toldLeader = false
	if (me !== cfg.leader && bus && existsSync(rec)) {
		const by = !r.project ? "" : resolve(r.project) === resolve(projectRoot) ? ", by this project" : `, by ${basename(r.project)}`
		const note = `usage: ${hits.map((h) => `${h.key} ${pct(h.x.pct)} >= ${pct(h.T)}`).join(", ")} for '${me}' (read ${age} before${by})`
		const s = spawnSync(process.execPath, [bus, "send", cfg.leader, "--ref", relative(agentRoot, rec), "--kind", "fyi", "--note", note],
			{ cwd: agentRoot, encoding: "utf8", timeout: 10_000 })
		toldLeader = s.status === 0
	}
	return (unfed ? `${unfed}\n` : "") + `[claude-comm] usage: ${lines.join("; and ")}. The reading is ${age} old, from a session ${from}. ` +
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
	console.log(`read ${age} ago by the statusLine of a session ${r.project ? `in ${r.project}` : "whose project was not recorded (a bus older than 2026-10-31.2)"}${sess(r)}`)
}
