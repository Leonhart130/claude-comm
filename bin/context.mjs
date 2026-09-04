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
 */
import { readFileSync, existsSync, readdirSync, statSync, readlinkSync, openSync, readSync, closeSync, mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { join, basename } from "node:path"
import { homedir, tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

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

/**
 * Resolve a session PID to the transcript that PID is writing - exactly, not by guess.
 *
 * A session holds an open descriptor on its own per-session scratch directory, whose
 * path carries its session UUID: /tmp/claude-<uid>/<project-slug>/<uuid>/... The
 * transcript is then <uuid>.jsonl under that session's own cwd slug. The transcript
 * itself is NOT held open (it is appended and closed), so the descriptor list is the
 * only place a running process names its own session.
 *
 * This replaced newest-mtime, which was wrong in the field the first time it was
 * pointed at reality: two live sessions shared one project root, so both were reported as
 * carrying 313 395 tokens when one of them was at 186 919 - an error of 68% on the
 * number a session would use to decide whether to close itself. Several agents sharing
 * one directory is not an edge case in this framework, it is the hub topology (A17).
 */
function transcriptOfPid(pid) {
	let uuid = null
	try {
		for (const fd of readdirSync(`/proc/${pid}/fd`)) {
			let target
			try { target = readlinkSync(`/proc/${pid}/fd/${fd}`) } catch { continue }
			const m = target.match(/^\/tmp\/claude-\d+\/[^/]+\/([0-9a-f-]{36})\//)
			if (m) { uuid = m[1]; break }
		}
	} catch { return null }
	if (!uuid) return null
	try {
		const cwd = readlinkSync(`/proc/${pid}/cwd`)
		const p = join(homedir(), ".claude", "projects", slugOf(cwd), `${uuid}.jsonl`)
		return existsSync(p) ? p : null
	} catch { return null }
}

/** The nearest ancestor that is the session itself, by argv[0] - same test boot uses. */
function ownSessionPid() {
	const ppidOf = (pid) => {
		try {
			const s = readFileSync(`/proc/${pid}/stat`, "utf8")
			return Number(s.slice(s.lastIndexOf(")") + 2).split(" ")[1]) || 0
		} catch { return 0 }
	}
	let pid = process.pid
	for (let i = 0; i < 12 && pid > 1; i++) {
		try {
			if (basename(readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0")[0] || "") === "claude") return pid
		} catch {}
		pid = ppidOf(pid)
	}
	return 0
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
	const askedPid = Number(opt("--pid", 0))
	if (askedPid) {
		const p = transcriptOfPid(askedPid)
		return p ? { path: p, how: `resolved from /proc/${askedPid}` }
			: { path: null, how: `pid ${askedPid} names no session transcript` }
	}
	const own = ownSessionPid()
	if (own) {
		const p = transcriptOfPid(own)
		if (p) return { path: p, how: `resolved from /proc/${own} (own session)` }
	}
	const dir = join(homedir(), ".claude", "projects", slugOf(process.cwd()))
	if (!existsSync(dir)) return { path: null, how: `no transcripts for ${process.cwd()}` }
	const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"))
		.map((f) => ({ f: join(dir, f), m: statSync(join(dir, f)).mtimeMs }))
		.sort((a, b) => b.m - a.m)
	if (!files.length) return { path: null, how: `no transcripts for ${process.cwd()}` }
	return { path: files[0].f, how: files.length > 1 ? `GUESSED (newest of ${files.length} sharing this dir)` : "guessed (only transcript here)" }
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
		const r = spawnSelf(["--transcript", p, "--json", ...extra])
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
		const out = join(dir, "guess.out")
		spawnSync("setsid", ["--fork", "sh", "-c",
			`${process.execPath} ${fileURLToPath(import.meta.url)} --json > ${out} 2>&1; echo "exit=$?" >> ${out}`],
			{ cwd: process.cwd(), encoding: "utf8" })
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

	console.log(`\n${failed ? `✗ ${failed} sensor propert(y/ies) NOT demonstrated` : "✓ every sensor property demonstrated by a moved variable"}\n`)
	process.exit(failed ? 1 : 0)
}

function spawnSelf(args) {
	return spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args], { encoding: "utf8" })
}

if (has("--prove-red")) proveRed()
else report()
