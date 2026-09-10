#!/usr/bin/env node
/**
 * claude-comm CONTEXT — how full is this session, measured rather than felt.
 *
 *   node bin/context.mjs                        the session running in this directory
 *   node bin/context.mjs --transcript <path>    a named transcript
 *   node bin/context.mjs --hook                 read a hook payload on stdin
 *   node bin/context.mjs --json | --prove-red
 *
 * This is the sensor an agent needs before it can decide anything about its own
 * lifecycle. Four things it refuses to do, each of which produces a confident wrong
 * number - this project's signature failure:
 *
 * 1. IT DOES NOT MEASURE THE FILE. A transcript is an append-only log of everything
 *    ever written; the context is what the model still carries. A 4.7 MB transcript
 *    was carrying 376 k tokens and a 2.1 MB one was carrying 471 k - the ordering
 *    reverses. Size is not occupancy.
 *
 * 2. IT DOES NOT ESTIMATE FROM CHARACTERS. Claude Code writes the real accounting into
 *    every assistant entry: input + cache_read + cache_creation IS the context that
 *    turn was charged for. A chars/token ratio would be a guess sitting where a
 *    measurement was available.
 *
 * 3. MISSING DATA IS REPORTED AS UNKNOWN, NEVER AS ZERO. A transcript with no usage
 *    entry means "not measured", and rendering that as 0 would read as "plenty of
 *    room" - the comfortable wrong answer, arriving exactly when the sensor is broken.
 *
 * 4. THE BUDGET IS NOT INVENTED. `BUDGET` below is a stated assumption with its
 *    evidence attached, not a fact the tool discovered. Override it with --budget.
 *
 * 5. IT DOES NOT INFER A SESSION FROM THE PROCESS'S SCRATCH DIRECTORY. That directory
 *    names the session the process was LAUNCHED as, permanently, so after a `/clear`
 *    this tool answered with a DEAD session's final context - a plausible number, in a
 *    plausible range, exit 0 (`FINDINGS.md#clear-blind`). pid -> transcript now comes
 *    from the registry the SessionStart hook writes (`bin/session-registry.mjs`), and a
 *    miss REFUSES rather than falling back to the answer that was wrong.
 */
import { readFileSync, existsSync, readdirSync, statSync, readlinkSync, openSync, readSync, closeSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, unlinkSync, utimesSync, chmodSync } from "node:fs"
import { join, basename } from "node:path"
import { homedir, tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { spawnSync, spawn } from "node:child_process"
import { lookup as registryLookup, record as registryRecord, registryDir, startTimeOf, sessionPid, entries as registryEntries } from "./session-registry.mjs"

const ARGV = process.argv.slice(2)
const has = (f) => ARGV.includes(f)
const opt = (f, d) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d }

// The context window this session actually has is in no file this tool can read. This
// is the documented ceiling for Opus with the 1M beta, and the largest context ever
// observed across 54 sessions of this framework is 609 835 - so the assumption has
// never been tested near its top. It is a CEILING, not a measurement. --budget wins.
const BUDGET = (() => {
	const raw = opt("--budget", null)
	if (raw === null) return 1_000_000
	const n = Number(raw)
	// Review #3 R6: `Number("abc")` is NaN, every comparison against NaN is false, so the
	// state fell through to "ok" and the tool printed "NaN tokens - OK" with exit 0. And
	// it is reachable the way the flag will actually be used: `--budget $UNSET` makes the
	// shell drop the word, so the NEXT flag becomes the budget. A broken sensor produced
	// the reassuring answer, inverting this file's own rule 3.
	if (!Number.isFinite(n) || n <= 0) {
		console.error(`context: --budget must be a positive number, got ${JSON.stringify(raw)}`)
		process.exit(2)
	}
	return n
})()
// Where the useful work stops rather than where the wall is. Under this, keep working;
// over it, a close is the cheaper option than one more round in a crowded context.
const HIGH = 0.60, LOW = 0.35
const TAIL = 512 * 1024

const usageOf = (entry) => {
	const u = entry && entry.message && entry.message.usage
	if (!u) return null
	const t = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)
	return t > 0 ? t : null
}

/**
 * Read the LAST usage in the file without loading the file.
 *
 * A Stop hook runs this at every turn boundary, so reading 5 MB each time is waste -
 * but a single JSONL line can be larger than the tail window (one big tool result
 * does it), and a tail that finds no usage must NOT be reported as "no usage". It
 * falls back to the whole file, and says which path it took.
 */
function lastUsage(path) {
	const size = statSync(path).size
	// `marks[i]` is the context as it stood immediately BEFORE the i-th prompt in the
	// scanned window, so the span from marks[0] to marks[k] is exactly k whole turns.
	//
	// Review #3 R3: the previous version divided (last usage - first usage in window) by
	// the number of prompts in the window. The window opens mid-turn, so the numerator
	// covered k intervals PLUS a fragment while the divisor was k - biased upward, and
	// unboundedly as k -> 1. Sweeping only the TAIL constant on one real transcript moved
	// the reported rate 75% (80k -> 140k/turn) with the file untouched, and the same file
	// answered "3 rounds left" on a tail read and "5" on a full one. The bias ran toward
	// "close sooner", i.e. the sensor built to justify a reboot erred toward recommending
	// one - the exact "cannot be wrong in the direction that matters" test, failed.
	const scan = (text) => {
		let last = null, first = null, turns = 0
		const marks = []
		for (const line of text.split("\n")) {
			if (!line.startsWith("{")) continue
			let d
			try { d = JSON.parse(line) } catch { continue }
			if (d.type === "user" && typeof (d.message && d.message.content) === "string") {
				turns++
				if (last !== null) marks.push(last)
			}
			const u = usageOf(d)
			if (u) { if (first === null) first = u; last = u }
		}
		if (last !== null) marks.push(last)
		return { first, last, turns, marks }
	}
	let why = "full"
	if (size > TAIL) {
		const fd = openSync(path, "r")
		const buf = Buffer.alloc(TAIL)
		readSync(fd, buf, 0, TAIL, size - TAIL)
		closeSync(fd)
		// Drop the first (necessarily partial) line before parsing. The window ends at
		// EOF, so only its head can be a fragment.
		const text = buf.toString("utf8")
		const r = scan(text.slice(text.indexOf("\n") + 1))
		const rt = rate(r, "recent")
		if (r.last && rt.perTurn !== null) return { tokens: r.last, via: "tail", ...rt }
		// Two ways the window can fail, and both must escalate rather than answer.
		// A window with NO usage would otherwise report "not measured" on a measured
		// session; a window with exactly ONE has the number but no trend, and a trend
		// is the half a session actually acts on. One 300 KB tool result fills 512 KB
		// on its own, and this framework routinely reads files that big.
		why = r.last ? "full (tail held fewer than two whole turns)" : "full (tail held no usage)"
	}
	const r = scan(readFileSync(path, "utf8"))
	return { tokens: r.last, via: why, ...rate(r, "session") }
}

/**
 * Growth per turn, over whatever was actually scanned - and it says which.
 *
 * The first version reported turns only on a FULL read, and every real transcript here
 * is past the tail threshold, so the one actionable number ("how many rounds before I
 * should close") was null on every real input and present only in the fixtures. A
 * figure that exists only where it is not needed is worse than no figure: the tool
 * looked complete. Growth is now measured across the scanned window - which for a tail
 * read is the RECENT rate, and that predicts the next rounds better than a lifetime
 * average does anyway, since a boot's 100 k skews the mean for the whole session.
 */
function rate(r, scope) {
	// THREE boundaries, i.e. two whole intervals, minimum. Two boundaries give an
	// unbiased measurement of exactly one turn - honest, but a sample of one, and this
	// number decides whether a session closes itself. The failure direction is "close too
	// early", so the threshold is set where a single unusual turn cannot carry the verdict.
	if (r.marks.length < 3) return { perTurn: null, scope, turns: r.turns }
	// A FIXED sample - the last three boundaries, i.e. the two most recent whole turns -
	// so how much was read never changes what the number MEANS. Sizing the sample by the
	// window instead made the same transcript answer "2 rounds left" on a full read and
	// "5" on a tail read: the full read averaged in the boot, which is ~100 k and unlike
	// any later turn. The read strategy is an optimisation; it must not be a semantic.
	const m = r.marks.slice(-3)
	const growth = m[m.length - 1] - m[0]
	if (growth <= 0) return { perTurn: null, scope, turns: m.length - 1 }
	return { perTurn: Math.round(growth / (m.length - 1)), scope, turns: m.length - 1 }
}

const slugOf = (dir) => dir.replace(/[/.]/g, "-")
// Where Claude Code keeps transcripts. Overridable ONLY so the negative control can
// build its own two-session directory: the R7 arm previously depended on whatever
// transcripts happened to exist for the caller's cwd, so it passed on the author's
// machine and failed on a fresh clone - a control that is not hermetic is a control
// that tests the machine. Read-only, and never consulted when a path is given outright.
const PROJECTS = () => process.env.CLAUDE_COMM_PROJECTS || join(homedir(), ".claude", "projects")

/**
 * The uuid in the scratch directory a process holds open. EVIDENCE, NEVER AUTHORITY.
 *
 * This used to BE the resolution, and it was built that way for a good reason -
 * newest-mtime was wrong by 68% the first time it met the field, because several agents
 * share one project directory here and that is the hub topology (A17), not an edge case.
 *
 * It is wrong for a different reason, found 2026-09-04: `/tmp/claude-<uid>/<slug>/<uuid>/`
 * names the session the process was LAUNCHED as and never changes, while a `/clear` mints
 * a new session and a new transcript. The two then disagree forever, and the tool answered
 * from the dead one.
 *
 * Kept because that disagreement is exactly how a cleared session announces itself, and
 * saying so out loud is worth more than the four lines it costs.
 */
/** argv[0]'s basename - the same test boot and sessionPid() use to recognise a session. */
function argv0Of(pid) {
	try { return basename(readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0")[0] || "") } catch { return "" }
}

/**
 * IS THIS PID A SESSION, OR A DESCENDANT OF ONE? `argv0 === "claude"` cannot tell them
 * apart, and review #8 C4 measured the consequence: **a `claude -p` child is named
 * `claude`**, inherits its parent's open descriptors, and was therefore labelled
 * "session CLEARED (launched as <the PARENT's uuid>)" - a wrong claim about somebody
 * else's session, printed with the confidence of a measurement. `test/selftest.mjs`
 * spawns exactly this shape from this repo.
 *
 * A top-level session has no `claude` above it: it is started by a terminal, by a
 * .desktop entry, or by `bin/launch.mjs` (whose parent is kitty). A descendant always
 * does. The walk stops at pid 1 and on any unreadable /proc entry - a pid that vanishes
 * mid-walk answers "cannot say it is a session", which is the safe direction here
 * because the only thing this gates is an extra claim.
 */
function isTopLevelSession(pid) {
	if (argv0Of(pid) !== "claude") return false
	let cur = pid
	for (let hops = 0; hops < 40; hops++) {
		let ppid = 0
		try {
			const m = /^PPid:\s*(\d+)/m.exec(readFileSync(`/proc/${cur}/status`, "utf8"))
			ppid = m ? Number(m[1]) : 0
		} catch { return false }
		if (!ppid || ppid === 1) return true
		if (argv0Of(ppid) === "claude") return false
		cur = ppid
	}
	return false
}

/** The arm's own reading of the ancestry, so the fixture is verified rather than assumed. */
function hasClaudeAncestorForArm(pid) {
	let cur = pid
	for (let hops = 0; hops < 40; hops++) {
		let ppid = 0
		try {
			const m = /^PPid:\s*(\d+)/m.exec(readFileSync(`/proc/${cur}/status`, "utf8"))
			ppid = m ? Number(m[1]) : 0
		} catch { return false }
		if (!ppid || ppid === 1) return false
		if (argv0Of(ppid) === "claude") return true
		cur = ppid
	}
	return false
}

function scratchUuidOfPid(pid) {
	try {
		for (const fd of readdirSync(`/proc/${pid}/fd`)) {
			let target
			try { target = readlinkSync(`/proc/${pid}/fd/${fd}`) } catch { continue }
			const m = target.match(/^\/tmp\/claude-\d+\/[^/]+\/([0-9a-f-]{36})\//)
			if (m) return m[1]
		}
	} catch {}
	return null
}

/**
 * How long ago the SessionStart hook filed this entry, rendered short. Used only to date
 * a session that has produced no transcript: the age of the ENTRY is the age of the
 * silence, and it is the one number that makes "no turn yet" actionable rather than
 * merely true.
 */
function ageOfEntry(r) {
	const t = Date.parse((r && r.at) || "")
	if (!Number.isFinite(t)) return null
	const s = Math.max(0, Math.round((Date.now() - t) / 1000))
	return s < 90 ? `${s}s` : s < 5400 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`
}

/**
 * Resolve a session pid to the transcript it is writing NOW - from the registry the
 * SessionStart hook writes, and from nothing else.
 *
 * A MISS REFUSES. It must never fall through to the scratch directory: that answer is
 * plausible, in range, and wrong for every cleared session - which, once a leader can
 * reboot itself, is most sessions most of the time. A refusal is the only outcome a loop
 * can tell apart from a good reading.
 */
function transcriptOfPid(pid) {
	const r = registryLookup(pid)
	if (!r.ok) return { path: null, why: r.hint ? `${r.why} (${r.hint})` : r.why }
	if (!existsSync(r.transcript)) {
		// NOT "gone", which asserts a loss. Measured 2026-09-08 09:29 on four live field
		// sessions: a session that has been LAUNCHED but has taken no turn has no transcript
		// at all - the file is created by the first turn, never by the launch. Those four sat
		// in that state for eight minutes while this word told their leader the sensor was
		// broken. That is the comfortable-direction error the field named in
		// exchange/work-leader/in/2026-09-07-who-...md, fired on our own instrument.
		//
		// The two worlds - never written, and removed - are NOT separable from file state,
		// and the proxy that looked like it would separate them does not: CPU seconds per
		// second of life, measured the same morning, ran 2.79-3.01 % across the four
		// no-turn sessions against 4.73 % for one mid-turn and 5.41 % for this one. The
		// ranges overlap, so a threshold would decide by luck. The message therefore states
		// only what is true in BOTH worlds and names the ambiguity instead of resolving it.
		const since = ageOfEntry(r)
		return { path: null, state: "no-transcript", why: `the registry names ${basename(r.transcript)} for pid ${pid} and no such file exists - ` +
			`this session has produced no transcript${since ? ` since it registered ${since} ago` : ""} ` +
			`(a session that has taken no turn yet looks exactly like one whose file was removed)` }
	}
	// ONLY for a pid that is itself a session - see isTopLevelSession(). A child inherits
	// its parent's open descriptors, so any descendant holds that session's scratch
	// directory and was labelled "cleared" on the strength of its PARENT's uuid. Evidence
	// that is wrong is not weaker evidence, it is a wrong claim.
	const launched = isTopLevelSession(pid) ? scratchUuidOfPid(pid) : null
	const live = basename(r.transcript).replace(/\.jsonl$/, "")
	// WHAT THIS NOTE MEANS, because it read as an alarm and it is the opposite (review #8 C5).
	// The scratch directory keeps the uuid the process was LAUNCHED as; the registry entry is
	// rewritten by the SessionStart hook on every /clear. So the two disagreeing is the
	// evidence that the clear re-recorded correctly and this transcript is the CURRENT one.
	// It was worded "session CLEARED", which sends the reader to distrust a good reading.
	//
	// 🔴 AND THE DANGEROUS CASE IS THE SILENT ONE, which is why it is named here rather than
	// left to be rediscovered: when a clear's hook never fires at all, the entry still names
	// the DEAD transcript and the two uuids AGREE - byte-identical to a session that was
	// never cleared. This tool prints a plausible in-range number off a dead file and says
	// nothing. That half is not detectable from file state (FINDINGS.md#clear-blind); what
	// closes it is the hook running, not a better guess here.
	const note = launched && launched !== live
		? ` - re-registered after a /clear (launched as ${launched.slice(0, 8)}), so this is the CURRENT transcript`
		: ""
	return { path: r.transcript, why: null, note }
}

/**
 * Which transcript are we measuring? In order of authority, and it always says which:
 * an explicit path, a hook payload, this session's own PID, another PID, and only then
 * the newest file in the directory - which stays available because a monitor may run
 * where /proc says nothing, and stays LABELLED because it can name a sibling.
 */
function resolveTranscript() {
	const explicit = opt("--transcript", null)
	if (explicit) return { path: explicit, how: "given" }
	if (has("--hook")) {
		// R8: readFileSync(0) waits for EOF. At a terminal that is a silent hang with no
		// output and no message - and this flag is a documented usage line, so a person
		// typing it is the expected caller, not a misuse.
		if (process.stdin.isTTY) {
			console.error("context: --hook reads a hook payload on stdin; there is none at a terminal")
			process.exit(2)
		}
		let raw = ""
		try { raw = readFileSync(0, "utf8") } catch {}
		try {
			const p = JSON.parse(raw).transcript_path
			if (p) return { path: p, how: "hook payload" }
		} catch {}
		return { path: null, how: "hook payload carried no transcript_path" }
	}
	// F2 (review #5). `Number(opt("--pid", 0))` makes NaN and 0 both falsy, so an
	// unparseable pid fell through to the OWN-SESSION path and answered - a different
	// session's transcript, exit 0, `guessed:false`. Reached the way it will actually
	// happen: `--pid $PID` with PID unset makes the shell drop the word, so the next flag
	// becomes the value. This exact class is already refused for `--budget` here and
	// gated in bin/ledger.mjs; --pid was the third tool of three and the one the reboot
	// decision reads. A flag that was WRITTEN must be honoured or refused, never ignored.
	// G1 (review #5, second pass). That first fix used `opt()`, which returns its DEFAULT
	// when the next argv slot is falsy - so `--pid` last on the line and `--pid ""` (the
	// QUOTED spelling, the one shellcheck asks for) both produced null, skipped the guard
	// and fell through exactly as before. Three of five shapes closed, and the two left
	// open were the two that read most like real usage. A flag's PRESENCE is what obliges
	// an answer, so presence is now tested independently of whether its value is truthy.
	const pidIdx = ARGV.indexOf("--pid")
	if (pidIdx >= 0) {
		const v = ARGV[pidIdx + 1]
		if (v === undefined || !/^[1-9]\d*$/.test(v)) {
			console.error(`context: --pid must be a positive integer, got ${v === undefined ? "no value at all" : JSON.stringify(v)}`)
			process.exit(2)
		}
	}
	const askedPid = pidIdx >= 0 ? Number(ARGV[pidIdx + 1]) : 0
	if (askedPid) {
		const r = transcriptOfPid(askedPid)
		return r.path ? { path: r.path, how: `registry: pid ${askedPid}${r.note}` }
			: { path: null, how: r.why }
	}
	const own = sessionPid()
	if (own) {
		const r = transcriptOfPid(own)
		if (r.path) return { path: r.path, how: `registry: pid ${own} (own session)${r.note}` }
		// REFUSE. The newest transcript in this directory is below, and reaching it from
		// here is precisely the fall-through `FINDINGS.md#clear-blind` forbids: this
		// process IS a session, we simply cannot say which one, and the guess would be
		// right often enough to be trusted and wrong exactly when a reboot is at stake.
		return { path: null, how: `${r.why}; pass --transcript <path> if you know which file is live` }
	}
	const dir = join(PROJECTS(), slugOf(process.cwd()))
	if (!existsSync(dir)) return { path: null, how: `no transcripts for ${process.cwd()}` }
	const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"))
		.map((f) => ({ f: join(dir, f), m: statSync(join(dir, f)).mtimeMs }))
		.sort((a, b) => b.m - a.m)
	if (!files.length) return { path: null, how: `no transcripts for ${process.cwd()}` }
	// F3 (review #5). The second branch used to read "guessed (only transcript here)" in
	// lowercase, and the machine-readable guard below is `/^GUESSED/` - anchored and case
	// sensitive - so a one-transcript directory produced a full verdict at exit 0 with
	// `guessed:false`. R7's fixture writes two transcripts, so the arm built the branch
	// that was fixed and never entered the one that was not. A freshly created project
	// directory holds exactly one transcript, and a self-launched expert is precisely the
	// caller with no `claude` ancestor that reaches this path.
	return { path: files[0].f, how: files.length > 1
		? `GUESSED (newest of ${files.length} sharing this dir)`
		: "GUESSED (the only transcript here, and nothing tied it to this process)" }
}

/**
 * THE THIRD STATE, and why this is a measurement rather than a verdict.
 *
 * The field asked for `who` to tell "at prompt" from "in turn" (exchange/work-leader/in/
 * 2026-09-07-who-ne-distingue-pas-...md): a leader read "running" for four sessions that
 * were reading nobody's mail and lost 2 h 30. The signal that discriminates is the mtime
 * of the session's own transcript, resolved through the registry - a session at its prompt
 * writes nothing, one taking a turn writes every turn.
 *
 * What is printed is `quiet 44m`, NOT "at prompt". A single long tool call is quiet too,
 * and a session reading without writing is the exact case that fooled the field's own
 * proxy. The number is a fact; "nobody is reading" is an inference, and it belongs to the
 * reader, who knows what he asked for.
 *
 * THREE states, not two - the third measured 2026-09-08 09:29 and absent from every
 * design document until then:
 *   quiet <age>     the transcript exists; that is how long since it was last written
 *   no transcript   registered, and no turn has produced a file yet (see transcriptOfPid)
 *   (not listed)    the registry's own lookup drops a dead or recycled pid, which is its
 *                   job - this command does not re-implement that test. FINDINGS.md#liveness
 *
 * It lives HERE and not in `comm who` for a reason that is a constraint, not a taste:
 * A21 allows the bus no import outside node: builtins, so `comm.mjs` cannot reach the
 * registry, and a second pid->transcript implementation is the defect `who --json` already
 * exists to prevent. Moving it into the bus costs an A21 amendment AND a real split under
 * A22's budget. Named in STATUS.md, not smuggled in here.
 */
function sessions() {
	const live = registryEntries()
	const rows = live.map((e) => {
		const r = transcriptOfPid(e.pid)
		if (r.path) {
			let age = null
			try { age = Math.max(0, Math.round((Date.now() - statSync(r.path).mtimeMs) / 1000)) } catch {}
			return { pid: e.pid, agent: e.agent || null, source: e.source || null, state: "quiet",
				quiet_s: age, transcript: basename(r.path), note: (r.note || "").trim() || null }
		}
		return { pid: e.pid, agent: e.agent || null, source: e.source || null, state: "no-transcript",
			quiet_s: null, registered: e.at || null, why: r.why }
	})
	if (has("--json")) { console.log(JSON.stringify({ registry: registryDir(), sessions: rows })); return }
	console.log(`session registry: ${registryDir()}`)
	if (!rows.length) {
		console.log("  (no live session recorded - the SessionStart hook writes it, so this is empty")
		console.log("   either because nothing is running or because the hook is not installed)")
		return
	}
	for (const r of rows) {
		const what = r.state === "quiet"
			? (r.quiet_s === null ? "quiet ?" : `quiet ${r.quiet_s < 90 ? `${r.quiet_s}s` : r.quiet_s < 5400 ? `${Math.round(r.quiet_s / 60)}m` : `${(r.quiet_s / 3600).toFixed(1)}h`}`)
			: "no transcript yet - no turn since it registered"
		console.log(`  ${String(r.agent || "?").padEnd(18)} pid ${String(r.pid).padEnd(8)} ${what}${r.note ? `  ${r.note}` : ""}`)
	}
	console.log("\n  'quiet' is the age of the transcript's last write. It is a MEASUREMENT, not a claim")
	console.log("  about the session: one long tool call is quiet too. What it rules out is the opposite -")
	console.log("  a session that wrote 3s ago is not sitting at its prompt.")
}

function report() {
	const { path, how } = resolveTranscript()
	if (!path || !existsSync(path)) {
		const out = { tokens: null, state: "unknown", why: how }
		if (has("--json")) console.log(JSON.stringify(out))
		else console.log(`context: UNKNOWN - ${how}`)
		process.exit(2)
	}
	const { tokens, via, turns, perTurn, scope } = lastUsage(path)
	if (tokens === null) {
		const out = { tokens: null, state: "unknown", why: "no usage entry in transcript", path }
		if (has("--json")) console.log(JSON.stringify(out))
		else console.log(`context: UNKNOWN - the transcript carries no usage entry (${basename(path)})`)
		process.exit(2)
	}
	// R7: a guessed reading used to be structurally identical to a measured one - same
	// fields, same exit code - so the label was legible only to a human, and this tool
	// exists to be read by a loop. This directory held four transcripts spanning 2.7x, and
	// newest-mtime was already wrong by 68% the first time it met the field. A guess now
	// refuses to produce a verdict unless the caller has knowingly opted in.
	const guessed = /^GUESSED/.test(how)
	if (guessed && !has("--allow-guess")) {
		const out = { tokens, guessed: true, state: "guessed", why: how, path,
			hint: "pass --pid <session pid>, --transcript <path>, or --allow-guess to accept the risk" }
		if (has("--json")) console.log(JSON.stringify(out))
		else console.log(`context: ${tokens.toLocaleString("en-US")} tokens but the SESSION IS AMBIGUOUS - ${how}\n  ${out.hint}`)
		process.exit(3)
	}
	const pct = tokens / BUDGET
	const state = pct >= HIGH ? "close" : pct >= LOW ? "watch" : "ok"
	const left = perTurn ? Math.max(0, Math.floor((BUDGET * HIGH - tokens) / perTurn)) : null
	const out = { tokens, budget: BUDGET, pct: Number((pct * 100).toFixed(1)), state, guessed, turns, perTurn, scope, roundsLeft: left, via, how, path }
	if (has("--json")) console.log(JSON.stringify(out))
	else {
		console.log(
			`context: ${tokens.toLocaleString("en-US")} / ${BUDGET.toLocaleString("en-US")} tokens ` +
			`(${out.pct}%) - ${state.toUpperCase()}` +
			(perTurn ? `\n  ${scope} rate: ~${perTurn.toLocaleString("en-US")}/turn over ${turns} turn(s) -> ~${left} rounds before close` : "") +
			`\n  source: ${how} - read ${via}`)
	}
	process.exit(state === "close" ? 1 : 0)
}

// -- negative control -------------------------------------------------------
/**
 * A sensor that cannot be shown to move is a dial painted on the dashboard. Each arm
 * builds a transcript that differs from its control in ONE way, and asserts the
 * reported number or state changes accordingly.
 */
function proveRed() {
	const dir = mkdtempSync(join(tmpdir(), "comm-ctx-prove-"))
	process.on("exit", () => { try { rmSync(dir, { recursive: true, force: true }) } catch {} })
	// The registry arms must build their own registry, never touch the machine's. Set
	// before any child is spawned, because every child inherits it - the same reason
	// CLAUDE_COMM_PROJECTS exists. A control that writes into the real world is not a
	// control, and this one would write into the sensor every live session depends on.
	process.env.CLAUDE_COMM_RUNTIME = join(dir, "runtime")
	let n = 0, failed = 0
	const check = (name, pass, detail) => {
		console.log(`  ${pass ? "✓" : "✗"} ${name.padEnd(46)} ${detail}`)
		if (!pass) failed++
	}
	const write = (lines) => {
		const p = join(dir, `t${++n}.jsonl`)
		writeFileSync(p, lines.map((l) => JSON.stringify(l)).join("\n") + "\n")
		return p
	}
	const asst = (tok, pad = 0) => ({
		type: "assistant",
		message: { usage: { input_tokens: 2, cache_read_input_tokens: tok - 2, output_tokens: 10 }, pad: "x".repeat(pad) },
	})
	const user = () => ({ type: "user", message: { content: "hello" } })
	const read = (p, extra = []) => {
		const r = spawnSelf([...(p ? ["--transcript", p] : []), "--json", ...extra])
		try { return { ...JSON.parse(r.stdout), exit: r.status } } catch { return { state: "parse-failed", exit: r.status, raw: r.stdout } }
	}

	console.log("\ncontext sensor - negative control\n")

	const small = read(write([user(), asst(100_000)]))
	const big = read(write([user(), asst(700_000)]))
	check("the reading follows the usage, not the file", small.tokens === 100_000 && big.tokens === 700_000,
		`${small.tokens} then ${big.tokens}`)
	check("state crosses ok -> close on that alone", small.state === "ok" && big.state === "close",
		`${small.state} -> ${big.state}`)

	// One variable: a megabyte of padding on the SAME usage. If the tool were measuring
	// the file, this would move. It must not.
	const fat = read(write([user(), asst(100_000, 1_000_000)]))
	check("a 1 MB transcript with a small context stays small", fat.tokens === 100_000,
		`${fat.tokens} tokens from a ${(statSync(join(dir, `t${n}.jsonl`)).size / 1e6).toFixed(1)} MB file`)

	// The tail window must not be able to answer "no usage": the last usage sits before
	// a padded line far bigger than TAIL.
	const buried = read(write([user(), asst(222_222), { type: "user", message: { content: "x".repeat(2_000_000) } }]))
	check("a usage buried behind a >512 KB line is still found", buried.tokens === 222_222,
		`${buried.tokens} via ${buried.via}`)

	// Absence must not render as a comfortable zero.
	const empty = read(write([user(), { type: "assistant", message: { content: "no usage here" } }]))
	check("no usage entry reports UNKNOWN, never 0", empty.state === "unknown" && empty.tokens === null,
		`state=${empty.state} tokens=${JSON.stringify(empty.tokens)}`)

	// The budget is an input, not a constant of nature: the same file must change state
	// when the ceiling moves, or the percentage is theatre.
	const tight = read(join(dir, "t1.jsonl") && write([user(), asst(100_000)]), ["--budget", "150000"])
	check("the state follows --budget on an identical file", tight.state === "close",
		`100k of 150k -> ${tight.state}`)

	// The growth rate must follow the usage delta, and nothing else.
	// Three prompts, because a rate now needs two whole intervals (R3) - a single interval
	// is unbiased but a sample of one, and this number decides whether a session closes.
	const flat = read(write([user(), asst(200_000), user(), asst(200_000), user(), asst(200_000)]))
	const rising = read(write([user(), asst(200_000), user(), asst(300_000), user(), asst(400_000)]))
	check("growth per turn follows the usage delta", flat.perTurn === null && rising.perTurn > 0,
		`flat=${JSON.stringify(flat.perTurn)} rising=${rising.perTurn}`)

	// REGRESSION GUARD. The first version computed the rate only on a full read, and
	// every real transcript is past the tail threshold - so the one actionable number
	// was null on every real input and present only in fixtures like the ones above.
	// This arm is the one that would have caught it: it must exceed TAIL.
	const bigPath = write([user(), asst(200_000, 300_000), user(), asst(300_000, 300_000), user(), asst(400_000, 300_000)])
	const bigRead = read(bigPath)
	check("a >512 KB file still yields a rate", bigRead.perTurn > 0,
		`${(statSync(bigPath).size / 1024).toFixed(0)} KB, via ${bigRead.via}, perTurn=${bigRead.perTurn}`)

	// ---- properties review #3 showed the harness could not see ----------------

	// R3. The rate must depend on the recent turns and NOTHING else - not on how much
	// history precedes them, which is what decides tail-versus-full. Same three closing
	// turns, one file short enough to read whole and one padded past the tail threshold.
	const recent = [user(), asst(100_000), user(), asst(140_000), user(), asst(180_000)]
	const short = read(write(recent))
	const long = read(write([user(), asst(50_000, 700_000), ...recent]))
	check("R3 the same recent turns give the same rate", short.perTurn === long.perTurn && short.perTurn === 40_000,
		`short(${short.via})=${short.perTurn} long(${long.via})=${long.perTurn}`)
	check("R3 and the same rounds-left", short.roundsLeft === long.roundsLeft,
		`${short.roundsLeft} vs ${long.roundsLeft}`)

	// R6. A budget that cannot be parsed must not produce the most comfortable answer.
	const bad = read(join(dir, "t1.jsonl"), ["--budget", "abc"])
	const eaten = read(join(dir, "t1.jsonl"), ["--budget", "--json"])
	check("R6 an unparseable budget is refused, not defaulted", bad.exit === 2 && eaten.exit === 2,
		`--budget abc -> exit ${bad.exit}; --budget <empty, eats next flag> -> exit ${eaten.exit}`)

	// R7. A guessed reading must be visible to a MACHINE. Reached only by a caller with no
	// claude ancestor, so the arm detaches with setsid --fork, exactly as the reviewer did.
	{
		// Hermetic: the arm builds the ambiguity it tests - two transcripts for one
		// directory - instead of hoping the caller's machine has some.
		const out = join(dir, "guess.out")
		const work = join(dir, "amb"); mkdirSync(work, { recursive: true })
		const proj = join(dir, "projects", work.replace(/[/.]/g, "-"))
		mkdirSync(proj, { recursive: true })
		for (const n of ["one", "two"]) {
			writeFileSync(join(proj, `${n}.jsonl`), JSON.stringify(asst(120_000)) + "\n")
		}
		spawnSync("setsid", ["--fork", "sh", "-c",
			`cd ${work} && CLAUDE_COMM_PROJECTS=${join(dir, "projects")} ${process.execPath} ${fileURLToPath(import.meta.url)} --json > ${out} 2>&1; echo "exit=$?" >> ${out}`],
			{ encoding: "utf8" })
		let txt = ""
		for (let i = 0; i < 40 && !/exit=/.test(txt); i++) {
			try { txt = readFileSync(out, "utf8") } catch {}
			if (!/exit=/.test(txt)) spawnSync("sleep", ["0.1"])
		}
		const code = (txt.match(/exit=(\d+)/) || [])[1]
		const guessed = /"guessed":true/.test(txt)
		check("R7 an ambiguous session refuses a verdict", code === "3" && guessed,
			`detached call -> exit ${code}, guessed=${guessed}`)
	}

	// F3 (review #5). R7's fixture writes TWO transcripts, so it only ever built the
	// labelled branch. With ONE the label was lowercase, `/^GUESSED/` did not match, and
	// the tool produced a full verdict at exit 0 with `guessed:false` - R7's own defect
	// surviving in the branch R7 could not reach. A freshly created project directory
	// holds exactly one transcript, and a self-launched expert is exactly the caller with
	// no `claude` ancestor that lands here.
	{
		const out = join(dir, "single.out")
		const work = join(dir, "single"); mkdirSync(work, { recursive: true })
		const proj = join(dir, "projects3", work.replace(/[/.]/g, "-"))
		mkdirSync(proj, { recursive: true })
		writeFileSync(join(proj, "only.jsonl"), JSON.stringify(asst(400_000)) + "\n")
		spawnSync("setsid", ["--fork", "sh", "-c",
			`cd ${work} && CLAUDE_COMM_PROJECTS=${join(dir, "projects3")} ${process.execPath} ${fileURLToPath(import.meta.url)} --json > ${out} 2>&1; echo "exit=$?" >> ${out}`],
			{ encoding: "utf8" })
		let txt = ""
		for (let i = 0; i < 40 && !/exit=/.test(txt); i++) {
			try { txt = readFileSync(out, "utf8") } catch {}
			if (!/exit=/.test(txt)) spawnSync("sleep", ["0.1"])
		}
		const code = (txt.match(/exit=(\d+)/) || [])[1]
		check("F3 a SINGLE-transcript guess is refused too",
			code === "3" && /"guessed":true/.test(txt),
			`one transcript, no claude ancestor -> exit ${code}, guessed=${/"guessed":true/.test(txt)}`)
	}

	// ---- C4/C5: a DESCENDANT of a session is not the session ------------------
	//
	// Review #8 C4 measured a `claude -p` child - named `claude`, holding its parent's
	// inherited scratch descriptor - being labelled "session CLEARED (launched as <the
	// PARENT's uuid>)". A wrong claim about somebody else's session, printed with the
	// confidence of a measurement. `test/selftest.mjs` spawns exactly this shape.
	//
	// ONE VARIABLE: whether the process has a `claude` ancestor. Everything else is held
	// identical - the same executable named `claude`, the same inherited-looking scratch
	// descriptor, the same registry entry naming a DIFFERENT uuid.
	//
	// 🔴 THE POSITIVE CONTROL CANNOT BE BUILT AS A CHILD OF THIS SUITE, because the suite
	// itself runs under a `claude` session and every descendant inherits that ancestry.
	// It is built with `setsid --fork`, which reparents the process out of this tree. If
	// the machine will not do that - no setsid, or a subreaper named `claude`, which is
	// not a thing - this arm reports SKIPPED-AS-FAILURE rather than passing on a fixture
	// it did not manage to arm. A control that quietly measures nothing is the failure
	// mode this file exists to prevent.
	{
		const uuidA = "aaaaaaaa-1111-2222-3333-444444444444"   // what the process was LAUNCHED as
		const uuidB = "bbbbbbbb-1111-2222-3333-444444444444"   // what the registry names NOW
		const scratchRoot = join("/tmp", "claude-999999", "zz-context-arm")
		const scratchA = join(scratchRoot, uuidA, "tasks")
		mkdirSync(scratchA, { recursive: true })
		const held = join(scratchA, "held")
		writeFileSync(held, "")
		// ITS OWN DIRECTORY. The file must be NAMED `claude` for argv0 to matter, and an arm
		// two screens down creates join(dir, "claude") as a symlink to /bin/sh - its
		// symlinkSync is wrapped in a silent catch, so whichever arm runs second inherits the
		// other one's file and measures nothing it thinks it is measuring. Found by running
		// the suite, not by reading it.
		const armDir = join(dir, "c4-descendant"); mkdirSync(armDir, { recursive: true })
		const fakeClaude = join(armDir, "claude")
		writeFileSync(fakeClaude, readFileSync(process.execPath))
		chmodSync(fakeClaude, 0o755)
		const transcriptB = join(dir, `${uuidB}.jsonl`)
		writeFileSync(transcriptB, readFileSync(write([user(), asst(222_000)])))

		const script = `require("fs").openSync(process.argv[1],"r");setTimeout(()=>{},30000)`
		const pidOfMarker = (marker) => {
			for (const e of readdirSync("/proc")) {
				if (!/^\d+$/.test(e)) continue
				try {
					if (readFileSync(`/proc/${e}/cmdline`, "utf8").includes(marker)) return Number(e)
				} catch {}
			}
			return 0
		}
		const marker = `zz-ctx-${process.pid}-${Date.now()}`
		// TOP-LEVEL: reparented away from this suite by setsid --fork.
		spawnSync("setsid", ["--fork", fakeClaude, "-e", script, held, marker], { stdio: "ignore" })
		const topPid = pidOfMarker(marker)
		// DESCENDANT: identical in every way except that this suite is its parent.
		const marker2 = `${marker}-child`
		const child = spawn(fakeClaude, ["-e", script, held, marker2], { stdio: "ignore" })
		const kidPid = child.pid

		const ancestryOk = topPid > 0 && kidPid > 0 && !hasClaudeAncestorForArm(topPid) && hasClaudeAncestorForArm(kidPid)
		let topHow = "", kidHow = ""
		if (ancestryOk) {
			registryRecord({ pid: topPid, transcript: transcriptB, agent: "control", source: "clear" })
			registryRecord({ pid: kidPid, transcript: transcriptB, agent: "control", source: "clear" })
			topHow = String(read(null, ["--pid", String(topPid)]).how || "")
			kidHow = String(read(null, ["--pid", String(kidPid)]).how || "")
			for (const p of [topPid, kidPid]) { try { process.kill(p) } catch {} }
			for (const p of [topPid, kidPid]) { try { unlinkSync(join(registryDir(), `${p}.json`)) } catch {} }
		} else { try { process.kill(kidPid) } catch {}; try { process.kill(topPid) } catch {} }
		try { rmSync(join("/tmp", "claude-999999"), { recursive: true, force: true }) } catch {}

		check("a DESCENDANT of a session is not labelled cleared",
			ancestryOk && /re-registered after a \/clear/.test(topHow) && !/re-registered/.test(kidHow),
			ancestryOk
				? `top-level pid ${topPid} -> "${topHow.slice(-52)}" (POSITIVE CONTROL: the note must fire ` +
				  `here or this arm proves nothing); its identical CHILD -> "${kidHow.slice(-52)}"`
				: `SKIPPED-AS-FAILURE: could not build the fixture (top=${topPid} kid=${kidPid}) - ` +
				  `setsid --fork did not reparent, so nothing was measured`)
	}

	// ---- the registry: pid -> the transcript that pid is writing NOW ----------
	// FINDINGS.md#clear-blind. The scratch directory names the session a process was
	// LAUNCHED as, so after a /clear this tool answered from a DEAD session with exit 0 -
	// and a self-rebooting leader is a cleared session by construction, so the trigger
	// would have re-fired forever and looked like the feature working. These four arms
	// are the ones that would have caught it.
	{
		const live = write([user(), asst(321_000)])
		const me = process.pid
		const entry = join(registryDir(), `${me}.json`)

		// The registry is the AUTHORITY. This process has no claude scratch directory at
		// all, so nothing but the registry can resolve it - and it must.
		const wrote = registryRecord({ pid: me, transcript: live, agent: "control", source: "startup" })
		const hit = read(null, ["--pid", String(me)])
		check("a registered pid resolves to ITS transcript", wrote.ok && hit.tokens === 321_000,
			`write ok=${wrote.ok} -> ${hit.tokens} tokens via ${hit.how}`)

		// ONE VARIABLE: the same pid, the same file, a start time that no longer matches.
		// That is a recycled pid, and it is the exact shape of the failure this replaced -
		// a confident answer about a process that is not the one recorded. It must MISS.
		const good = readFileSync(entry, "utf8")
		writeFileSync(entry, JSON.stringify({ ...JSON.parse(good), start: (startTimeOf(me) || 0) + 1 }) + "\n")
		const recycled = read(null, ["--pid", String(me)])
		writeFileSync(entry, good)
		check("a RECYCLED pid is a miss, not an answer", recycled.exit === 2 && recycled.tokens === null,
			`start moved by one tick -> exit ${recycled.exit}, tokens=${JSON.stringify(recycled.tokens)}`)

		// An unregistered pid must refuse rather than fall back to the resolution this
		// replaced. There is no --allow-guess for this: the old answer was plausible and
		// in range, which is worse than no answer, because a loop cannot tell it apart.
		unlinkSync(entry)
		const missing = read(null, ["--pid", String(me)])
		check("an unregistered pid REFUSES", missing.exit === 2 && missing.tokens === null,
			`exit ${missing.exit} - ${String(missing.why).slice(0, 60)}`)

		// F1 (review #5), the best catch the brief named. A `/clear` leaves pid, boot id and
		// start tick ALL matching, because it is the same process - so an entry whose
		// refresh did not happen was indistinguishable from a fresh one and the sensor
		// answered with the DEAD transcript at exit 0. The fix is that `record()` removes
		// the old entry BEFORE it validates anything, so every failure leaves a miss rather
		// than a lie. One variable: whether the new start managed to record.
		{
			registryRecord({ pid: me, transcript: live, agent: "control", source: "startup" })
			const fresh = read(null, ["--pid", String(me)])
			// the new session starts; its hook fires but carries no transcript_path
			const failed = registryRecord({ pid: me, transcript: "", agent: "control", source: "clear" })
			const after = read(null, ["--pid", String(me)])
			check("a start that CANNOT record invalidates the old entry",
				fresh.tokens === 321_000 && !failed.ok && failed.invalidated === true &&
				after.exit === 2 && after.tokens === null,
				`before=${fresh.tokens} -> a start that could not record -> exit ${after.exit}, ` +
				`tokens=${JSON.stringify(after.tokens)} (a stale answer would be ${fresh.tokens})`)
		}

		// F2 (review #5). An unparseable or shell-eaten --pid used to fall through to the
		// own-session path and answer - a DIFFERENT session's number, exit 0, guessed:false.
		{
			registryRecord({ pid: me, transcript: live, agent: "control", source: "startup" })
			// G1: the first version of this arm was a VOID PROBE. It asserted a refusal and
			// measured a registry MISS - the hermetic registry held no entry for the child's
			// own session, so the fall-through it exists to forbid answered nothing anyway.
			// The fall-through has to be ARMED for the assertion to mean anything. `fallback`
			// is the positive control that proves it is: if that ever stops being a number,
			// this arm has gone void again and every refusal below proves nothing.
			registryRecord({ pid: sessionPid(), transcript: live, agent: "control", source: "startup" })
			const fallback = read(null, [])
			const eaten = read(null, ["--pid"])           // --pid last on the line
			const empty = read(null, ["--pid", ""])       // --pid "$UNSET", quoted
			const junk = read(null, ["--pid", "12x"])
			const zero = read(null, ["--pid", "0"])
			// exit 2 AND no verdict at all. An argument this tool could not honour is a
			// usage error, not missing data, so it takes `--budget`'s idiom: a message on
			// stderr and nothing on stdout. What must never happen is a NUMBER - which is
			// what the own-session fall-through produced, for a different session.
			const noVerdict = (r) => r.exit === 2 && r.tokens == null && !/"state":"(ok|watch|close)"/.test(r.raw || "")
			check("F2/G1 a --pid that was eaten or unparseable REFUSES",
				fallback.tokens === 321_000 && [eaten, empty, junk, zero].every(noVerdict),
				`positive control (the own-session fall-through IS armed) = ${fallback.tokens}; ` +
				`--pid <last> -> ${eaten.exit}, --pid "" -> ${empty.exit}, --pid 12x -> ${junk.exit}, ` +
				`--pid 0 -> ${zero.exit} (all must be exit 2 with no verdict)`)
		}

		// THE THIRD STATE (2026-09-08), and the arm is aimed at the WORD, because the word
		// was the defect. A registered session whose transcript does not exist was reported
		// as "that file is gone" - an assertion of LOSS. Measured that morning on four live
		// field sessions: a session that has been launched and has taken no turn has no
		// transcript at all, and those four sat in that state for eight minutes. The word
		// told their leader his sensor was broken while the truth was that his experts had
		// not started. Nothing in the code was wrong; the CLAIM was.
		//
		// ONE VARIABLE: whether the named file exists. The entry, the pid and the start tick
		// are byte-identical across the two reads - the second read is the same registry
		// entry with the file created underneath it.
		//
		// THE POSITIVE CONTROL IS THAT SECOND READ. If `present` ever stops measuring a
		// number and a "quiet" row, this arm has gone void: it would then be asserting a
		// refusal on a path no real session travels, which is exactly the shape review #6
		// found five times. An arm that can only go red is not yet an arm that goes red for
		// the property in its own title.
		{
			const ghost = join(dir, "never-written.jsonl")   // named by the entry, never created
			registryRecord({ pid: me, transcript: ghost, agent: "control", source: "startup" })
			const absent = read(null, ["--pid", String(me)])
			const absentRows = (() => { try { return JSON.parse(spawnSelf(["--sessions", "--json"]).stdout) } catch { return {} } })()
			writeFileSync(ghost, JSON.stringify(asst(50_000)) + "\n")
			const present = read(null, ["--pid", String(me)])
			const presentRows = (() => { try { return JSON.parse(spawnSelf(["--sessions", "--json"]).stdout) } catch { return {} } })()
			const rowOf = (o) => ((o && o.sessions) || []).find((r) => r.pid === me) || {}
			const saysGone = /\bgone\b/.test(String(absent.why))
			check("a session with NO transcript is 'not yet', never 'gone'",
				absent.exit === 2 && absent.tokens === null && !saysGone &&
				/no such file exists/.test(String(absent.why)) &&
				rowOf(absentRows).state === "no-transcript" &&
				present.tokens === 50_000 && rowOf(presentRows).state === "quiet",
				`file absent -> exit ${absent.exit}, --sessions state=${rowOf(absentRows).state}, ` +
				`the word "gone"=${saysGone} (must be false); the SAME entry with the file created -> ` +
				`${present.tokens} tokens, state=${rowOf(presentRows).state} (POSITIVE CONTROL: anything but ` +
				`"quiet" here means the arm measured a path no session travels)`)
			registryRecord({ pid: me, transcript: live, agent: "control", source: "startup" })
		}

		// `--sessions` must report the AGE of the last write, not merely that a file is
		// there. One variable: the transcript's mtime, moved back an hour under an entry
		// that is otherwise untouched. The control is the first read - a file written just
		// now must read as seconds, or the second read proves nothing about the arithmetic.
		{
			const t = join(dir, "aged.jsonl")
			writeFileSync(t, JSON.stringify(asst(10_000)) + "\n")
			registryRecord({ pid: me, transcript: t, agent: "control", source: "startup" })
			const rowNow = (() => { try { return (JSON.parse(spawnSelf(["--sessions", "--json"]).stdout).sessions || []).find((r) => r.pid === me) || {} } catch { return {} } })()
			const hour = new Date(Date.now() - 3600_000)
			utimesSync(t, hour, hour)
			const rowOld = (() => { try { return (JSON.parse(spawnSelf(["--sessions", "--json"]).stdout).sessions || []).find((r) => r.pid === me) || {} } catch { return {} } })()
			check("--sessions measures the SILENCE, not just presence",
				rowNow.state === "quiet" && rowNow.quiet_s !== null && rowNow.quiet_s < 60 &&
				rowOld.state === "quiet" && rowOld.quiet_s >= 3500,
				`written now -> quiet ${rowNow.quiet_s}s (control: must be seconds); mtime moved back 1 h -> ` +
				`quiet ${rowOld.quiet_s}s (must be ~3600 - a row that cannot move is not a measurement)`)
			registryRecord({ pid: me, transcript: live, agent: "control", source: "startup" })
		}

		// REGRESSION GUARD, and the one that matters most. A real session - a process with
		// a `claude` ancestor - that is not in the registry used to fall through to the
		// newest transcript in its directory. Here the directory is deliberately ambiguous,
		// so the fall-through would answer (exit 3, "guessed"). It must refuse instead:
		// exit 2, no number at all. The arm builds a fake `claude` parent because the
		// property is about having an ancestor, not about who is running the test.
		{
			const out = join(dir, "unregistered.out")
			const work = join(dir, "unreg"); mkdirSync(work, { recursive: true })
			const proj = join(dir, "projects2", work.replace(/[/.]/g, "-"))
			mkdirSync(proj, { recursive: true })
			for (const nm of ["one", "two"]) writeFileSync(join(proj, `${nm}.jsonl`), JSON.stringify(asst(120_000)) + "\n")
			const fake = join(dir, "claude")
			try { symlinkSync("/bin/sh", fake) } catch {}
			// Two commands, so the shell cannot exec-optimise itself away and lose the
			// argv[0] this arm depends on.
			spawnSync(fake, ["-c",
				`cd ${work} && CLAUDE_COMM_PROJECTS=${join(dir, "projects2")} ${process.execPath} ${fileURLToPath(import.meta.url)} --json > ${out} 2>&1; echo "exit=$?" >> ${out}`],
				{ encoding: "utf8" })
			let txt = ""
			try { txt = readFileSync(out, "utf8") } catch {}
			const code = (txt.match(/exit=(\d+)/) || [])[1]
			check("an unregistered SESSION refuses, never guesses", code === "2" && !/"tokens":\s*\d/.test(txt),
				`claude-parented, 2 transcripts in reach -> exit ${code} (a guess would be 3)`)
		}
	}

	console.log(`\n${failed ? `✗ ${failed} sensor propert(y/ies) NOT demonstrated` : "✓ every sensor property demonstrated by a moved variable"}\n`)
	process.exit(failed ? 1 : 0)
}

function spawnSelf(args) {
	return spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args], { encoding: "utf8" })
}

if (has("--prove-red")) proveRed()
else if (has("--sessions")) sessions()
else report()
