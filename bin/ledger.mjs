#!/usr/bin/env node
/**
 * claude-comm LEDGER — did the reboots cost us anything? A query, not a debate.
 *
 *   node bin/ledger.mjs                     the question, over every agent's log
 *   node bin/ledger.mjs --agent leader      one agent
 *   node bin/ledger.mjs --window 15         minutes after a start that count as "first minutes"
 *   node bin/ledger.mjs --json | --prove-red
 *   node bin/ledger.mjs record <event> ...  the writer (see RECORDS below)
 *
 * The `~/Dev/work` leader's charter, and the reason this file exists before the reboot
 * mechanism does: *"nobody can answer whether a rebooted session is measurably worse,
 * because there has never been a reboot. A feature with no ledger is a hobby."*
 *
 * THE QUESTION IS NOT "did the reboot save tokens". It measured its own defects and
 * found four of five authored in the FIRST THIRTEEN MINUTES of a session, at 35–42 % of
 * that session's peak context — the least-read state, not the most-crowded one. A reboot
 * manufactures more first minutes. So the question this file answers is:
 *
 *     DID THE FIFTEEN MINUTES AFTER A RESTART COST US A DEFECT?
 *
 * and it is answerable only against a control, which is why this ledger records EVERY
 * session start and not only the reboots. Cold starts accumulate from the day this ships;
 * without them the first reboot would arrive with no denominator and the query would be
 * UNKNOWN forever. (`DESIGN-autonomy.md#the-ledger` carries the reasoning.)
 *
 * ── RECORDS ────────────────────────────────────────────────────────────────────────
 * One JSON object per line, appended, in `.comm/handoff/<agent>.log` — beside the
 * handoff, in the same gitignored live-state territory. `v` is the schema version.
 *
 *   start    {v,at,event,agent,session,source,prev_session,trigger,context,manifest}
 *   handoff  {v,at,event,agent,session,context,trigger,manifest,ref}
 *   defect   {v,at,event,agent,ref,authored_at,authored_session,found_at}
 *
 * FOUR PROPERTIES THIS FILE REFUSES TO GIVE UP, each of which is a way to produce a
 * confident wrong number — this project's signature failure:
 *
 * 1. IT STORES MEASUREMENTS AND DERIVES CLASSIFICATIONS. A record carries `source`,
 *    `trigger` and `prev_session`; nothing carries "this was a reboot". Whether
 *    `/clear` even reports `source: "clear"` is UNVERIFIED (DESIGN-autonomy.md), so the
 *    rule that turns a source into an arm is one function here — correct it later and
 *    every record ever written is re-interpreted. A stored verdict would have frozen
 *    today's guess into the data.
 *
 * 2. IT SAYS UNKNOWN RATHER THAN A NUMBER. Two arms of 1 produce a percentage that
 *    reads exactly like a finding. No verdict is issued below MIN_ARM starts per arm,
 *    and MIN_ARM is not invented: it is the consumer's own "the first ten reboots".
 *
 * 3. IT SURVIVES THE WORST READING OF WHAT IT COULD NOT READ. Unattributable defects
 *    and unparseable lines are not dropped and not assumed harmless: the verdict is
 *    recomputed with all of them loaded into each arm in turn, and if that changes the
 *    answer the answer is UNKNOWN. A ledger that silently skips half its lines and
 *    prints a clean number is the failure this whole repo is built against.
 *
 * 4. IT CANNOT BE WRONG IN THE COMFORTABLE DIRECTION. The bias that would flatter the
 *    feature is misattribution by TIME: a defect recorded with only `found_at` would be
 *    charged to whichever session was running when someone noticed it, and reboots
 *    manufacture sessions — so the newest arm would collect defects it did not author.
 *    `record defect` therefore REFUSES a defect with no authored time unless the caller
 *    says `--authored-unknown` out loud, and that admission lands in property 3's pool.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { join, dirname, resolve, basename } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const ARGV = process.argv.slice(2)
const has = (f) => ARGV.includes(f)
const nowISO = () => new Date().toISOString()
const die = (msg) => { console.error(`ledger: ${msg}`); process.exit(2) }
/**
 * A flag that is PRESENT but whose value was eaten is an error, never the default.
 * `--window --json` used to leave WINDOW_MIN standing and print a rate against a window
 * nobody asked for - the comfortable answer arriving exactly when the caller mistyped.
 * Same defect class as context.mjs R6 (`--budget $UNSET` -> "NaN tokens - OK", exit 0).
 */
const opt = (f, d) => {
	const i = ARGV.indexOf(f)
	if (i < 0) return d
	const v = ARGV[i + 1]
	if (v === undefined || v.startsWith("--")) die(`${f} needs a value; the next argument is ${v === undefined ? "the end of the line" : JSON.stringify(v)}`)
	return v
}

const SCHEMA = 1
// The window the consumer's measurement points at: "four of five defects authored in the
// first thirteen minutes". 15 is that number with slack, and it is an ASSUMPTION with its
// evidence attached, not a constant of nature. --window moves it, and every report prints
// the value it used, because a rate without its window is not a number.
const WINDOW_MIN = 15
// A verdict needs this many starts in BOTH arms. Their charter: "the first ten reboots
// should each leave a marker". Ten is therefore the sample the feature was promised to
// survive, not a threshold this file picked to be able to speak sooner.
const MIN_ARM = 10
// A convention, and named as one. It decides only whether a DIFFERENCE is reported; the
// counts are printed either way and are the durable part of the record.
const ALPHA = 0.05


/**
 * Where the logs live. `--root` wins (that is how a hook in a field project calls this,
 * since bin/ lives in the claude-comm checkout and the log belongs to the project); then
 * an upward search for a `.comm/`, the same convention the bus uses; then this checkout.
 */
function ledgerDir() {
	const explicit = opt("--root", null)
	if (explicit) return join(resolve(explicit), ".comm", "handoff")
	let dir = process.cwd()
	for (;;) {
		if (existsSync(join(dir, ".comm"))) return join(dir, ".comm", "handoff")
		const up = dirname(dir)
		if (up === dir) break
		dir = up
	}
	return join(dirname(dirname(fileURLToPath(import.meta.url))), ".comm", "handoff")
}

// An agent name becomes a FILENAME. It arrives here from a flag rather than from message
// text (the bus's pointer-not-content rule already forbids the latter for process
// control), but a name is still the one field that leaves the JSON and touches the
// filesystem, so it is contained structurally rather than trusted.
const AGENT_OK = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const safeAgent = (a) => AGENT_OK.test(a) && !a.includes("..")

// ── the writer ─────────────────────────────────────────────────────────────────────

function parseTrigger(raw) {
	// name=value or name=value/threshold — e.g. refetch=7/5
	if (!raw) return null
	const m = /^([A-Za-z][A-Za-z0-9_-]*)=(-?[0-9.]+)(?:\/(-?[0-9.]+))?$/.exec(raw)
	if (!m) die(`--trigger must look like name=value or name=value/threshold, got ${JSON.stringify(raw)}`)
	return { name: m[1], value: Number(m[2]), threshold: m[3] === undefined ? null : Number(m[3]) }
}

function isoOrDie(raw, flag) {
	const t = Date.parse(raw)
	// A timestamp that does not parse must not become a null that reads like "not
	// applicable" three months from now. Refuse it at the door, where the caller can see it.
	if (!Number.isFinite(t)) die(`${flag} must be an ISO timestamp, got ${JSON.stringify(raw)}`)
	return new Date(t).toISOString()
}

function writeRecord() {
	const event = ARGV[1]
	if (!["start", "handoff", "defect"].includes(event || "")) {
		die(`record needs an event: start | handoff | defect (got ${JSON.stringify(event || "")})`)
	}
	const agent = opt("--agent", process.env.CLAUDE_COMM_AGENT || null)
	if (!agent) die("record needs --agent (or CLAUDE_COMM_AGENT); a ledger with no subject is not a ledger")
	if (!safeAgent(agent)) die(`--agent must match ${AGENT_OK} — it becomes a filename`)

	const numOrNull = (f) => { const v = opt(f, null); if (v === null) return null; const n = Number(v); if (!Number.isFinite(n)) die(`${f} must be a number, got ${JSON.stringify(v)}`); return n }
	const rec = { v: SCHEMA, at: nowISO(), event, agent }

	if (event === "start" || event === "handoff") {
		rec.session = opt("--session", null)
		rec.context = numOrNull("--context")
		rec.trigger = parseTrigger(opt("--trigger", null))
		const checked = numOrNull("--manifest-checked")
		const moved = opt("--manifest-moved", null)
		rec.manifest = checked === null && moved === null ? null
			: { checked, moved: moved === null ? null : moved.split(",").filter(Boolean) }
		if (event === "start") {
			// Stored verbatim, never interpreted here. `source` is whatever the hook payload
			// said; property 1 is what keeps that honest.
			rec.source = opt("--source", null)
			rec.prev_session = opt("--prev-session", null)
		} else {
			rec.ref = opt("--ref", null)
		}
	} else {
		// A defect carries a POINTER to where it is written down, never the story — the
		// same rule the bus enforces on every message (`--ref` required, no `--body`).
		const ref = opt("--ref", null)
		if (!ref) die("record defect needs --ref: a pointer to where the defect is recorded (there is no --body)")
		rec.ref = ref
		const at = opt("--authored-at", null), sess = opt("--authored-session", null)
		if (!at && !sess && !has("--authored-unknown")) {
			die("record defect needs --authored-at <iso>, --authored-session <id>, or an explicit --authored-unknown.\n" +
				"  A defect timed by when it was FOUND is charged to whichever session noticed it, and\n" +
				"  reboots manufacture sessions — the bias runs toward blaming the newest one.")
		}
		rec.authored_at = at ? isoOrDie(at, "--authored-at") : null
		rec.authored_session = sess
		rec.found_at = opt("--found-at", null) ? isoOrDie(opt("--found-at"), "--found-at") : rec.at
	}

	const dir = ledgerDir()
	mkdirSync(dir, { recursive: true })
	// One line, and JSON.stringify is what makes a newline inside any field unable to
	// forge a second record. Proved rather than assumed — see the prove-red arm.
	appendFileSync(join(dir, `${agent}.log`), JSON.stringify(rec) + "\n")
	if (!has("--quiet")) console.log(`ledger: ${event} recorded for ${agent} in ${join(dir, `${agent}.log`)}`)
}

// ── the query ──────────────────────────────────────────────────────────────────────

function readRecords(dir, agentFilter) {
	const out = { records: [], unreadable: 0, mislabelled: 0, files: [], dir }
	let names = []
	try { names = readdirSync(dir).filter((f) => f.endsWith(".log")).sort() } catch { return out }
	for (const f of names) {
		const agent = basename(f, ".log")
		if (agentFilter && agent !== agentFilter) continue
		out.files.push(f)
		let text = ""
		try { text = readFileSync(join(dir, f), "utf8") } catch { out.unreadable++; continue }
		for (const line of text.split("\n")) {
			if (!line.trim()) continue
			let d
			// A line that will not parse is COUNTED, never skipped. An append-only log can
			// end in a torn write; what it must never do is quietly shrink its own sample.
			try { d = JSON.parse(line) } catch { out.unreadable++; continue }
			if (!d || typeof d !== "object" || !d.event) { out.unreadable++; continue }
			// A12, one level up: identity comes from the LOCATION, never from the claim
			// inside. A row in `leader.log` saying `"agent":"HartEdge"` would otherwise be
			// scored against HartEdge - the exact shape of every theft class this project
			// has had. The filename wins and the disagreement is counted, because a
			// mismatch is either tampering or a writer bug and both need to be visible.
			if (d.agent && d.agent !== agent) out.mislabelled++
			d.agent = agent
			out.records.push(d)
		}
	}
	return out
}

/**
 * The one place a measurement becomes an arm. Correct THIS when `/clear`'s `source` is
 * finally observed, and every record ever written is re-read under the new rule.
 *
 *   reboot — a lifecycle restart: the mechanism fired, or the session was cleared
 *   cold   — a fresh session nobody restarted
 *   other  — a resume or a compaction: neither a fresh start nor a restart. Counted,
 *            reported, and kept OUT of the comparison rather than dropped, because
 *            silently folding it into either arm would move the answer.
 */
function classify(r) {
	if (r.trigger || r.prev_session) return "reboot"
	const s = (r.source || "").toLowerCase()
	if (s === "clear") return "reboot"
	if (s === "startup") return "cold"
	if (s === "resume" || s === "compact") return "other"
	return "other"
}

const lfactCache = [0]
function lfact(n) { for (let i = lfactCache.length; i <= n; i++) lfactCache[i] = lfactCache[i - 1] + Math.log(i); return lfactCache[n] }

/** Fisher's exact test, two-sided, on the 2x2 [a b / c d]. Exact because n is small. */
function fisher(a, b, c, d) {
	const r1 = a + b, r2 = c + d, c1 = a + c, c2 = b + d, n = r1 + r2
	if (!r1 || !r2 || !c1 || !c2) return 1
	const K = lfact(r1) + lfact(r2) + lfact(c1) + lfact(c2) - lfact(n)
	const lp = (x) => K - lfact(x) - lfact(r1 - x) - lfact(c1 - x) - lfact(r2 - c1 + x)
	const obs = lp(a)
	let p = 0
	for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x++) {
		const l = lp(x)
		if (l <= obs + 1e-9) p += Math.exp(l)
	}
	return Math.min(1, p)
}

/** cold = [with-defect, without], reboot = [with-defect, without]. */
function verdictOf(cold, reboot) {
	const [a, b] = cold, [c, d] = reboot
	if (a + b < MIN_ARM || c + d < MIN_ARM) {
		return { verdict: "UNKNOWN", why: `needs ${MIN_ARM} starts in each arm; have cold=${a + b}, reboot=${c + d}`, p: null }
	}
	const p = fisher(a, b, c, d)
	const rc = a / (a + b), rr = c / (c + d)
	if (p < ALPHA && rr > rc) return { verdict: "WORSE", why: `reboot starts carry more first-window defects (p=${p.toFixed(4)})`, p }
	if (p < ALPHA && rr < rc) return { verdict: "BETTER", why: `reboot starts carry fewer first-window defects (p=${p.toFixed(4)})`, p }
	return { verdict: "NO DIFFERENCE DETECTED", why: `not distinguishable from chance at this sample (p=${p.toFixed(4)}) — which is not evidence of no difference`, p }
}

function analyse(read, windowMin) {
	const W = windowMin * 60_000
	const starts = read.records.filter((r) => r.event === "start")
		.map((r) => ({ ...r, t: Date.parse(r.at), kind: classify(r) }))
		.filter((r) => Number.isFinite(r.t))
		.sort((x, y) => x.t - y.t)
	// A session's span ends where the same agent's next session begins. Without this a
	// reboot five minutes in would leave the previous session credited with a fifteen
	// minute window it never had, and exposure is half of any rate.
	for (const s of starts) {
		const next = starts.find((o) => o.agent === s.agent && o.t > s.t)
		s.spanEnd = next ? next.t : Infinity
		s.winEnd = Math.min(s.t + W, s.spanEnd)
		s.exposureMin = (s.winEnd - s.t) / 60_000
		s.inWindow = 0
		s.total = 0
	}
	const bySession = new Map()
	for (const s of starts) if (s.session && !bySession.has(s.session)) bySession.set(s.session, s)

	const defects = read.records.filter((r) => r.event === "defect")
	let unattributable = 0, sessionOnly = 0
	for (const dfc of defects) {
		let owner = null
		if (dfc.authored_session && bySession.has(dfc.authored_session)) owner = bySession.get(dfc.authored_session)
		else if (dfc.authored_at) {
			const t = Date.parse(dfc.authored_at)
			if (Number.isFinite(t)) {
				const cands = starts.filter((s) => s.agent === dfc.agent && s.t <= t && t < s.spanEnd)
				owner = cands[cands.length - 1] || null
			}
		}
		if (!owner) { unattributable++; continue }
		owner.total++
		const t = Date.parse(dfc.authored_at || "")
		// Inside the window means inside it at BOTH ends. A defect attributed by session id
		// whose stamp predates that session's start is a clock or a record that disagrees
		// with itself, and counting it would credit the window with work done before it.
		if (Number.isFinite(t) && t >= owner.t && t < owner.winEnd) owner.inWindow++
		// A defect belonging to a known session but to no known MINUTE cannot be placed
		// inside or outside the window. It joins the unknown pool rather than defaulting to
		// "outside" - the reading that would flatter the feature.
		else if (!Number.isFinite(t)) sessionOnly++
	}

	const arm = (k) => starts.filter((s) => s.kind === k)
	const cold = arm("cold"), reboot = arm("reboot"), other = arm("other")
	const tally = (list) => [list.filter((s) => s.inWindow > 0).length, list.filter((s) => s.inWindow === 0).length]
	const anyDefect = (list) => list.filter((s) => s.total > 0).length
	const cTally = tally(cold), rTally = tally(reboot)

	const base = verdictOf(cTally, rTally)
	// Property 3. Everything unreadable or unplaceable could be a first-window defect.
	// Load the whole pool into each arm in turn; if the answer moves, there is no answer.
	const U = unattributable + read.unreadable + sessionOnly
	let sensitivity = null
	if (base.verdict !== "UNKNOWN" && U > 0) {
		const push = ([w, wo], n) => { const add = Math.min(n, wo); return [w + add, wo - add] }
		const worstReboot = verdictOf(cTally, push(rTally, U))
		const worstCold = verdictOf(push(cTally, U), rTally)
		if (worstReboot.verdict !== base.verdict || worstCold.verdict !== base.verdict) {
			sensitivity = { pool: U, ifAllReboot: worstReboot.verdict, ifAllCold: worstCold.verdict }
		}
	}
	const final = sensitivity
		? { verdict: "UNKNOWN", why: `${U} record(s) could not be placed; the verdict flips depending on where they land (reboot→${sensitivity.ifAllReboot}, cold→${sensitivity.ifAllCold})`, p: base.p }
		: base

	const mean = (l) => l.length ? l.reduce((s, x) => s + x.exposureMin, 0) / l.length : null
	const expCold = mean(cold), expReboot = mean(reboot)
	// Unequal exposure is a confound that would otherwise be invisible: an arm whose
	// windows were cut short had less time in which to author anything.
	const exposureSkew = expCold !== null && expReboot !== null && Math.max(expCold, expReboot) > 0
		&& Math.abs(expCold - expReboot) / Math.max(expCold, expReboot) > 0.2

	return {
		dir: read.dir, files: read.files, window: windowMin, minArm: MIN_ARM,
		records: read.records.length, unreadable: read.unreadable, mislabelled: read.mislabelled,
		starts: { cold: cold.length, reboot: reboot.length, other: other.length },
		sources: starts.reduce((m, s) => (m[s.source || "(none)"] = (m[s.source || "(none)"] || 0) + 1, m), {}),
		defects: { total: defects.length, attributed: defects.length - unattributable, unattributable, sessionOnly },
		cold: { withDefect: cTally[0], without: cTally[1], anyTime: anyDefect(cold), meanExposureMin: expCold },
		reboot: { withDefect: rTally[0], without: rTally[1], anyTime: anyDefect(reboot), meanExposureMin: expReboot },
		exposureSkew, sensitivity, ...final,
	}
}

function render(a) {
	const pct = (w, wo) => (w + wo) ? `${((w / (w + wo)) * 100).toFixed(1)}%` : "—"
	const lines = [
		``,
		`ledger — ${a.dir}`,
		`  ${a.records} record(s) across ${a.files.length} agent log(s)` +
			(a.unreadable ? `  ⚠ ${a.unreadable} UNREADABLE line(s)` : ``) +
			(a.mislabelled ? `  ⚠ ${a.mislabelled} line(s) NAMING ANOTHER AGENT (scored to the file they are in)` : ``),
		`  starts        cold ${a.starts.cold} · reboot ${a.starts.reboot} · other ${a.starts.other}` +
			`   [${Object.entries(a.sources).map(([k, v]) => `${k}:${v}`).join(" ")}]`,
		`  defects       ${a.defects.attributed} attributed · ${a.defects.unattributable} unattributable` +
			(a.defects.sessionOnly ? ` · ${a.defects.sessionOnly} without a minute` : ``),
		`  window        ${a.window} min after a start`,
		``,
		`  a defect authored in the first ${a.window} minutes`,
		`    cold      ${String(a.cold.withDefect).padStart(3)} of ${a.cold.withDefect + a.cold.without} starts  ${pct(a.cold.withDefect, a.cold.without)}` +
			(a.cold.meanExposureMin === null ? `` : `   mean exposure ${a.cold.meanExposureMin.toFixed(1)} min`),
		`    reboot    ${String(a.reboot.withDefect).padStart(3)} of ${a.reboot.withDefect + a.reboot.without} starts  ${pct(a.reboot.withDefect, a.reboot.without)}` +
			(a.reboot.meanExposureMin === null ? `` : `   mean exposure ${a.reboot.meanExposureMin.toFixed(1)} min`),
	]
	lines.push(`    (anywhere in the session: cold ${a.cold.anyTime}, reboot ${a.reboot.anyTime})`)
	if (a.exposureSkew) lines.push(`    ⚠ the arms had unequal exposure — compare the rates knowing that`)
	lines.push(``, `  verdict: ${a.verdict}`, `           ${a.why}`, ``)
	console.log(lines.join("\n"))
}

function query() {
	const w = Number(opt("--window", WINDOW_MIN))
	if (!Number.isFinite(w) || w <= 0) die(`--window must be a positive number of minutes, got ${JSON.stringify(opt("--window", null))}`)
	const agent = opt("--agent", null)
	if (agent && !safeAgent(agent)) die(`--agent must match ${AGENT_OK}`)
	const a = analyse(readRecords(ledgerDir(), agent), w)
	if (has("--json")) console.log(JSON.stringify(a))
	else render(a)
	process.exit(a.verdict === "WORSE" ? 1 : a.verdict === "UNKNOWN" ? 2 : 0)
}

// ── negative control ───────────────────────────────────────────────────────────────
/**
 * A ledger that cannot be shown to swing is a number waiting to be believed. Every arm
 * moves ONE variable against a control built in the same directory by the same code.
 */
function proveRed() {
	const dir = mkdtempSync(join(tmpdir(), "comm-ledger-prove-"))
	process.on("exit", () => { try { rmSync(dir, { recursive: true, force: true }) } catch {} })
	let failed = 0, n = 0
	const check = (name, pass, detail) => {
		console.log(`  ${pass ? "✓" : "✗"} ${name.padEnd(52)} ${detail}`)
		if (!pass) failed++
	}
	const self = fileURLToPath(import.meta.url)
	const run = (root, args = []) => {
		const r = spawnSync(process.execPath, [self, "--root", root, "--json", ...args], { encoding: "utf8" })
		try { return { ...JSON.parse(r.stdout), exit: r.status } } catch { return { verdict: "parse-failed", exit: r.status, raw: r.stdout + r.stderr } }
	}
	const T0 = Date.parse("2026-01-01T00:00:00.000Z")
	const iso = (ms) => new Date(T0 + ms).toISOString()
	const MIN = 60_000, DAY = 86_400_000

	/** A world: `starts` sessions per arm, `defects` of them carrying a defect at `atMin`. */
	const world = (opts) => {
		const root = join(dir, `w${++n}`)
		mkdirSync(join(root, ".comm", "handoff"), { recursive: true })
		const lines = []
		let i = 0
		const add = (kind, count, defects, atMin) => {
			for (let k = 0; k < count; k++) {
				const t = (++i) * DAY
				const session = `${kind}-${k}`
				lines.push({ v: 1, at: iso(t), event: "start", agent: "leader", session,
					source: kind === "cold" ? "startup" : "clear", prev_session: null, trigger: null, context: 100_000, manifest: null })
				if (k < defects) {
					lines.push({ v: 1, at: iso(t + 10 * DAY), event: "defect", agent: "leader", ref: "FINDINGS.md#A1",
						authored_at: iso(t + atMin * MIN), authored_session: null, found_at: iso(t + 10 * DAY) })
				}
			}
		}
		add("cold", opts.coldStarts, opts.coldDefects, opts.coldAtMin === undefined ? 5 : opts.coldAtMin)
		add("reboot", opts.rebootStarts, opts.rebootDefects, opts.rebootAtMin === undefined ? 5 : opts.rebootAtMin)
		let text = lines.map((l) => JSON.stringify(l)).join("\n") + "\n"
		if (opts.extra) text += opts.extra
		writeFileSync(join(root, ".comm", "handoff", "leader.log"), text)
		return root
	}

	console.log("\nledger - negative control\n")

	// 1. A degradation that IS there must be reported.
	const bad = run(world({ coldStarts: 20, coldDefects: 1, rebootStarts: 20, rebootDefects: 16 }))
	check("a real degradation is reported as WORSE", bad.verdict === "WORSE" && bad.exit === 1,
		`cold 1/20 vs reboot 16/20 -> ${bad.verdict} (p=${bad.p && bad.p.toExponential(2)}, exit ${bad.exit})`)

	// 2. One variable moved back: the same sample with the same rates in both arms.
	const same = run(world({ coldStarts: 20, coldDefects: 8, rebootStarts: 20, rebootDefects: 8 }))
	check("no degradation is NOT reported as one", same.verdict === "NO DIFFERENCE DETECTED" && same.exit === 0,
		`cold 8/20 vs reboot 8/20 -> ${same.verdict}`)

	// 3. THE ARM THAT MATTERS MOST. The same lopsided world, below the promised sample.
	//    A ledger willing to speak here would have made every early reboot "evidence".
	const tiny = run(world({ coldStarts: 3, coldDefects: 0, rebootStarts: 3, rebootDefects: 3 }))
	check("a huge effect under MIN_ARM still says UNKNOWN", tiny.verdict === "UNKNOWN" && tiny.exit === 2,
		`cold 0/3 vs reboot 3/3 -> ${tiny.verdict}`)

	// 4. The window is a measurement, not a decoration: the same defects, later.
	const late = run(world({ coldStarts: 20, coldDefects: 1, rebootStarts: 20, rebootDefects: 16, rebootAtMin: 120 }))
	check("a defect outside the window leaves the window rate", late.reboot.withDefect === 0,
		`16 defects at +120 min -> ${late.reboot.withDefect} in-window (${late.verdict})`)
	const wide = run(world({ coldStarts: 20, coldDefects: 1, rebootStarts: 20, rebootDefects: 16, rebootAtMin: 120 }), ["--window", "180"])
	check("and --window brings exactly those back", wide.reboot.withDefect === 16 && wide.verdict === "WORSE",
		`same file at --window 180 -> ${wide.reboot.withDefect} in-window, ${wide.verdict}`)

	// 5. Property 3: an unreadable line must be able to withdraw a verdict it could flip.
	const torn = run(world({ coldStarts: 20, coldDefects: 1, rebootStarts: 20, rebootDefects: 16, extra: "{not json\n" }))
	check("one unreadable line cannot flip WORSE, and does not", torn.verdict === "WORSE" && torn.unreadable === 1,
		`unreadable=${torn.unreadable} -> ${torn.verdict}`)
	const tornEdge = run(world({ coldStarts: 20, coldDefects: 5, rebootStarts: 20, rebootDefects: 12, extra: "{not json\n".repeat(8) }))
	check("enough unreadable lines withdraw it", tornEdge.verdict === "UNKNOWN" && tornEdge.sensitivity,
		`8 unreadable on 5/20 vs 12/20 -> ${tornEdge.verdict}`)

	// 6. Absence must not render as a comfortable zero: an empty ledger has no answer.
	const empty = (() => { const r = join(dir, "empty"); mkdirSync(join(r, ".comm", "handoff"), { recursive: true }); return run(r) })()
	check("an empty ledger is UNKNOWN, never 0%", empty.verdict === "UNKNOWN" && empty.records === 0,
		`${empty.records} records -> ${empty.verdict}`)

	// 7. A defect must be charged to the session that AUTHORED it, not the one that found
	//    it. The found_at here sits ten days later, inside a much later session.
	const attrib = run(world({ coldStarts: 20, coldDefects: 20, rebootStarts: 20, rebootDefects: 0 }))
	check("a defect is charged by authored_at, not found_at", attrib.cold.withDefect === 20 && attrib.reboot.withDefect === 0,
		`cold ${attrib.cold.withDefect}/20, reboot ${attrib.reboot.withDefect}/20 with every found_at +10 days`)

	// 8. Exposure: a session cut short by the next start keeps only the minutes it had.
	{
		const root = join(dir, "exposure")
		mkdirSync(join(root, ".comm", "handoff"), { recursive: true })
		writeFileSync(join(root, ".comm", "handoff", "leader.log"),
			[{ v: 1, at: iso(0), event: "start", agent: "leader", session: "a", source: "startup" },
			 { v: 1, at: iso(5 * MIN), event: "start", agent: "leader", session: "b", source: "clear" }]
				.map((l) => JSON.stringify(l)).join("\n") + "\n")
		const r = run(root)
		check("a start truncates the previous session's window", r.cold.meanExposureMin === 5,
			`cold exposure ${r.cold.meanExposureMin} min (15 requested, rebooted at +5)`)
	}

	// 8a. The p-value is hand-rolled (log-factorials, "sum the tables at most as probable").
	//     A wrong tail sum would not look wrong - it would look like a p-value, and a
	//     p-value decides whether the reboot feature is allowed to exist. So it is checked
	//     against a SECOND implementation that shares no code and no floating point in the
	//     part that matters: exact BigInt binomials, with the "at most as probable" test
	//     done by comparing integers rather than logs.
	{
		const C = (n, k) => {
			if (k < 0 || k > n) return 0n
			let r = 1n
			for (let i = 0n; i < BigInt(k); i++) r = (r * BigInt(n - Number(i))) / (i + 1n)
			return r
		}
		const exact = (a, b, c, d) => {
			const r1 = a + b, r2 = c + d, c1 = a + c, n = r1 + r2
			const w = (x) => C(r1, x) * C(r2, c1 - x)
			const obs = w(a)
			let num = 0n
			for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x++) if (w(x) <= obs) num += w(x)
			return Number(num) / Number(C(n, c1))
		}
		// And the reference itself is anchored to a published value, so the two
		// implementations cannot be wrong the same way: Fisher's tea-tasting table
		// [3 1 / 1 3] is 0.4857142857 in every textbook and in R's fisher.test.
		const tea = exact(3, 1, 1, 3)
		let worst = 0, cases = 0
		for (const [cd, rd] of [[1, 16], [8, 8], [3, 11], [0, 5], [10, 2], [19, 4], [2, 3]]) {
			const r = run(world({ coldStarts: 20, coldDefects: cd, rebootStarts: 20, rebootDefects: rd }))
			const ref = exact(cd, 20 - cd, rd, 20 - rd)
			if (typeof r.p === "number") { worst = Math.max(worst, Math.abs(r.p - ref) / Math.max(ref, 1e-300)); cases++ }
		}
		check("the p-value agrees with an exact-integer Fisher",
			cases === 7 && worst < 1e-9 && Math.abs(tea - 0.4857142857) < 1e-9,
			`${cases}/7 tables compared, worst relative error ${worst.toExponential(2)}; ` +
			`reference on the tea-tasting table = ${tea.toFixed(10)} (want 0.4857142857)`)
	}

	// 8b. A defect attributed BY SESSION ID whose stamp predates that session's start is a
	//     record disagreeing with itself. It stays attributed and stays out of the window.
	{
		const root = join(dir, "backdated")
		mkdirSync(join(root, ".comm", "handoff"), { recursive: true })
		writeFileSync(join(root, ".comm", "handoff", "leader.log"),
			[{ v: 1, at: iso(60 * MIN), event: "start", agent: "leader", session: "a", source: "startup" },
			 { v: 1, at: iso(DAY), event: "defect", agent: "leader", ref: "FINDINGS.md#A1",
			   authored_at: iso(55 * MIN), authored_session: "a", found_at: iso(DAY) }]
				.map((l) => JSON.stringify(l)).join("\n") + "\n")
		const r = run(root)
		check("a defect stamped before its session is not in-window",
			r.cold.withDefect === 0 && r.cold.anyTime === 1 && r.defects.unattributable === 0,
			`in-window=${r.cold.withDefect}, in-session=${r.cold.anyTime}, unattributable=${r.defects.unattributable}`)
	}

	// 9. A flag present with no value must refuse, not fall back to the default. The
	//    fixture is lopsided, so a silent default at --window 15 would print WORSE and
	//    read like a finding; the caller asked a question this tool never answered.
	{
		const root = world({ coldStarts: 20, coldDefects: 1, rebootStarts: 20, rebootDefects: 16 })
		const eaten = spawnSync(process.execPath, [self, "--root", root, "--window", "--json"], { encoding: "utf8" })
		check("a flag whose value was eaten is refused, not defaulted", eaten.status === 2 && !/verdict/.test(eaten.stdout),
			`--window --json -> exit ${eaten.status}, printed a verdict=${/verdict/.test(eaten.stdout)}`)
	}

	// 10. A record that names a DIFFERENT agent than the file holding it is scored to the
	//     file and the disagreement is surfaced. Every theft class this project has had
	//     worked by making the thief resolve to the victim's name.
	{
		const root = world({ coldStarts: 20, coldDefects: 20, rebootStarts: 20, rebootDefects: 0 })
		const f = join(root, ".comm", "handoff", "leader.log")
		writeFileSync(f, readFileSync(f, "utf8").replace(/"agent":"leader"/g, '"agent":"HartEdge"'))
		const r = run(root)
		check("a row naming another agent is scored where it LIVES", r.mislabelled > 0 && r.cold.withDefect === 20,
			`mislabelled=${r.mislabelled}, cold ${r.cold.withDefect}/20 still scored in leader.log`)
	}

	// ---- the writer, and the one field that reaches the filesystem -------------------
	const rec = (root, args) => spawnSync(process.execPath, [self, "record", ...args, "--root", root, "--quiet"], { encoding: "utf8" })
	{
		const root = join(dir, "writer")
		mkdirSync(join(root, ".comm"), { recursive: true })

		// 11. A newline in a pointer must not forge a second record.
		const forged = `x","event":"start","agent":"leader\n{"v":1,"at":"${iso(0)}","event":"start","agent":"leader","session":"ghost","source":"startup"}`
		rec(root, ["start", "--agent", "leader", "--session", "s1", "--source", "startup"])
		// Authored just after that start, so this one DOES attribute — arm 13 then reads a
		// pool of exactly one, and that one is the admission below rather than this.
		rec(root, ["defect", "--agent", "leader", "--ref", forged, "--authored-at", new Date(Date.now() + 1000).toISOString()])
		const after = readRecords(join(root, ".comm", "handoff"), null)
		check("a newline in --ref cannot forge a record", after.records.length === 2 && after.unreadable === 0,
			`2 writes -> ${after.records.length} records, ${after.unreadable} unreadable`)

		// 12. A defect with no authored time is refused unless the caller admits it.
		const silent = rec(root, ["defect", "--agent", "leader", "--ref", "FINDINGS.md#A1"])
		const admitted = rec(root, ["defect", "--agent", "leader", "--ref", "FINDINGS.md#A1", "--authored-unknown"])
		check("an untimed defect is refused, admitted only out loud", silent.status === 2 && admitted.status === 0,
			`no flag -> exit ${silent.status}; --authored-unknown -> exit ${admitted.status}`)

		// 13. And once admitted it lands in the unknown pool rather than in an arm.
		const q = run(root)
		check("an admitted-unknown defect is unattributable, not scored",
			q.defects.unattributable === 1 && q.defects.attributed === 1,
			`unattributable=${q.defects.unattributable}, attributed=${q.defects.attributed}`)

		// 14. The agent name becomes a filename, so it is contained structurally.
		const esc = rec(root, ["start", "--agent", "../../../../tmp/pwned", "--source", "startup"])
		check("an agent name cannot traverse out of the log directory", esc.status === 2 && !existsSync("/tmp/pwned.log"),
			`exit ${esc.status}, /tmp/pwned.log exists=${existsSync("/tmp/pwned.log")}`)
	}

	console.log(`\n${failed ? `✗ ${failed} ledger propert(y/ies) NOT demonstrated` : "✓ every ledger property demonstrated by a moved variable"}\n`)
	process.exit(failed ? 1 : 0)
}

if (has("--prove-red")) proveRed()
else if (ARGV[0] === "record") writeRecord()
else query()
