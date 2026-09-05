#!/usr/bin/env node
/**
 * claude-comm BOOT — the orientation a session opening this repo runs first.
 *
 *   node bin/boot.mjs              state + the adversarial gate      (~13 s)
 *   node bin/boot.mjs --fast       state only, no gate               (~0.3 s)
 *   node bin/boot.mjs --json       the same rows, machine-readable
 *   node bin/boot.mjs --prove-red  negative control: every row shown able to redden
 *
 * Three rules, each of them already paid for once:
 *
 * 1. IT MEASURES; IT DOES NOT QUOTE CLAIMS. `STATUS.md` says what was true the day it
 *    was written. git, /proc and the installer say what is true now. Where they
 *    disagree this report says so instead of repeating the document — a status file
 *    read as state is how "electio ran a bus 4 commits stale" survived four sessions.
 *
 * 2. IDENTITY COMES FROM /proc, NEVER FROM THIS PROCESS'S OWN ENV. An `export` inside a
 *    running session DOES reach its children — so boot would happily see it — but it
 *    never reaches /proc/<session>/environ, which is what `comm who` and electio's
 *    staging hook actually scan. Reading our own env would report a session as
 *    correctly declared while every real scanner sees nothing. Measured 2026-08-06.
 *
 * 3. THE GATE IS NEVER SKIPPED BECAUSE THE CODE DID NOT CHANGE. On 2026-08-06 A19 went
 *    red with no commit since it was written: a live `leader` session in another
 *    project had leaked into the gate's own temp roster. FINDINGS.md#A20 — "a gate
 *    that reddens with no code change is reporting a change in the world; triage it as
 *    evidence before suspecting the test." The fingerprint below LABELS a red. It must
 *    never be used to suppress a run, which is the optimisation that would have hidden
 *    that finding.
 *
 * This is NOT the bus. It spawns git, the installer and the gate, so it sits outside
 * A21's import allowlist by design — and stays a short-lived process for exactly the
 * reason the bus does: nothing here lives long enough to leak.
 */
import { readFileSync, writeFileSync, renameSync, existsSync, readdirSync, statSync, utimesSync, mkdtempSync, mkdirSync, cpSync, rmSync, symlinkSync, readlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname, resolve, basename } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { execFileSync, spawnSync, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { record as registryRecord, lookup as registryLookup, registryDir, sessionPid } from "./session-registry.mjs"

const ARGV = process.argv.slice(2)
const has = (f) => ARGV.includes(f)
const opt = (f, d) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d }

const SELF = dirname(dirname(fileURLToPath(import.meta.url)))
const ROOT = resolve(opt("--root", SELF))
// Field installs are found beside this repo rather than from a hardcoded list: the
// framework's shape is "one project per directory", and a list would go stale in the
// one direction that matters — a project installed and then forgotten.
const FIELD = resolve(opt("--field", dirname(ROOT)))
const CLOSE = has("--close")
// A close runs the gate: it is the moment the tree is handed to the next session, and
// "not measured" is not a state to hand anyone.
const FAST = has("--fast") && !CLOSE
const JSONOUT = has("--json")
// --ack <row>=<reason>, repeatable. A close may not pass over a row silently; it may
// only pass over one it NAMES. The reason is recorded, and so is the count.
const ACKS = new Map()
for (let i = 0; i < ARGV.length; i++) {
	if (ARGV[i] !== "--ack" || !ARGV[i + 1]) continue
	const eq = ARGV[i + 1].indexOf("=")
	if (eq > 0) ACKS.set(ARGV[i + 1].slice(0, eq), ARGV[i + 1].slice(eq + 1))
}
// --amended <row>="what changed about what it measures", repeatable. THE DISCHARGE FOR THE
// AMEND INSTRUCTION, and until review #7 F10 there was none: the erosion count was monotone
// with no reset path anywhere in this file, so the loudest line of the close demanded an
// amendment that following could not clear. The only way to clear it was a hand-edit of a
// gitignored file - an unaudited edit to the evidence `CLAUDE.md` names as the authority for
// changing this protocol. So the reset is a flag, it is recorded with its reason and the
// head it landed at, and the history stays in the file.
const AMENDED = new Map()
for (let i = 0; i < ARGV.length; i++) {
	if (ARGV[i] !== "--amended" || !ARGV[i + 1]) continue
	const eq = ARGV[i + 1].indexOf("=")
	if (eq > 0) AMENDED.set(ARGV[i + 1].slice(0, eq), ARGV[i + 1].slice(eq + 1))
}

// Four levels, because three forced "not measured" to borrow OK's tick - and OK is a
// verdict about now while UNKNOWN is the absence of one. Review #3 R1/R5: --fast could
// render a genuinely red gate as ✓, and the archive row said "tracked" when git had
// been asked nothing. Ordered so UNKNOWN outranks OK without outranking a real warning,
// and exit stays 1 only for RED.
const OK = 0, UNKNOWN = 1, WARN = 2, RED = 3
const MARK = ["✓", "?", "⚠", "✗"]
let worst = OK
const rows = []
const row = (label, level, text) => { rows.push({ label, level, text }); if (level > worst) worst = level }

const age = (ms) => {
	const s = Math.max(0, Math.round(ms / 1000))
	if (s < 90) return `${s}s`
	if (s < 5400) return `${Math.round(s / 60)}m`
	if (s < 172800) return `${Math.round(s / 3600)}h`
	return `${Math.round(s / 86400)}d`
}
const sha = (p) => { try { return createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 12) } catch { return null } }
const git = (...a) => {
	try { return execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() }
	catch { return null }
}


/**
 * Atomic state write, in install.mjs's idiom and for its reason: two writers touch this
 * file - the --hook branch and the gate branch - and both do read-modify-write. A
 * truncating write leaves a window in which a concurrent reader sees a partial file.
 * Review #3 flagged the race as reasoned-about but unmeasured; rename(2) removes the
 * question rather than leaving it open.
 *
 * 🔴 WHAT rename(2) DOES NOT FIX, and review #7 F2 measured it in this repository while the
 * review was being written. The pair is read-modify-write, and the gate branch read `prev`
 * at the top of the row and wrote it back AFTER the suite - twenty-six seconds later. A
 * `--close` landing in that window said `✓ CLOSED`, wrote `ackCounts` and `lastClose`, and
 * the ordinary boot then put back the snapshot it had read before the close existed. The
 * close happened, said so, and left no trace - and `ackCounts` is the evidence `CLAUDE.md`
 * makes load-bearing for amending the protocol, while `lastClose` is what the next close
 * compares STATUS.md's mtime against. Two Claude sessions in one tree is not a corner case:
 * it is the configuration `bin/claim.mjs` was shipped for, and the reviewer watched
 * `ackCounts.field:work` go 3 -> 4 -> 5 underneath them.
 *
 * So every writer goes through `updateState`, which re-reads the bytes ON DISK immediately
 * before the write and merges into those, never into a snapshot from earlier in the run.
 * The remaining window is between that read and the rename - microseconds, not the length
 * of a gate - and it is still not atomic. Losing a count in that window is recoverable;
 * losing a close was not.
 */
function updateState(mutate) {
	try {
		const sp = join(ROOT, ".boot-state.json")
		let disk = {}
		try { disk = JSON.parse(readFileSync(sp, "utf8")) || {} } catch {}
		const next = mutate(disk)
		if (!next) return false
		const tmp = `${sp}.tmp-${process.pid}`
		writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n")
		renameSync(tmp, sp)
		return true
	} catch { return false }
	// IT REPORTS. The first version of this function swallowed its failures the way
	// `writeState` did, and for the hook and the report-size record that is right - a broken
	// instrument may not break a session. For the CLOSE it is not: the close's whole output
	// is a promise that the next boot inherits a recorded state, and a `✓ CLOSED` printed
	// over a write that did not land is the silent-instrument-reading-as-a-quiet-world shape
	// this repository keeps finding in its own rows. Found by re-reading the fix for review
	// #7 F2 rather than by any arm, which is why an arm now exists below.
}

let statusText = ""
let sessionAgent = ""   // who this session is, for the ledger; resolved in row 1
let thisPid = 0         // the pid of this session, for the registry; resolved in row 1
let gateDocs = []   // documents the gate suite declares it reads; feeds the fingerprint (R1)
let nextText = ""   // what the previous close said this session must do first

if (has("--prove-red")) proveRed()

/**
 * When run FROM the SessionStart hook, boot is handed the payload that no other
 * vantage point can see. One field in it decides whether the self-reboot loop is
 * buildable at all: `source`, which is `"startup"` on a launch and is EXPECTED to be
 * `"clear"` after `/clear` - expected, never observed, and unobservable from a
 * headless probe. So rather than ask anyone to go and test it, every hook firing
 * records what it saw. The answer arrives the first time someone clears in this repo.
 *
 * Everything here is wrapped: a hook that throws is a hook that breaks a session.
 */
let payload = null
if (has("--hook")) {
	// 🔴 `--hook` WRITES TWO INSTRUMENTS, and `--root` governs only one of them (review #7
	// F13). It records a start into the ledger of whatever `--root` it is given — which
	// STATUS.md and the brief both warned about, twice, after it wrote fabricated data into
	// the real ledger twice in one day — and it ALSO writes
	// `$CLAUDE_COMM_RUNTIME/claude-comm/sessions/<pid>.json` for the CALLING process, which
	// `--root` does not touch at all. That second write always lands on the live machine and
	// always on the live session, and `bin/context.mjs` is keyed on it: a probe rooted at a
	// throwaway checkout replaced this session's registry entry with a scratchpad transcript
	// path while review #7 was being written.
	//
	// So a `--hook` aimed at another tree must ALSO have been aimed away from the machine's
	// registry. That is one env var, the arms already set it, and a person at a prompt gets a
	// refusal instead of a silently corrupted instrument. Refusing is safe here: the real
	// SessionStart hook passes no `--root` (see .claude/settings.json), so this branch is
	// unreachable from it.
	if (resolve(ROOT) !== resolve(SELF) && !process.env.CLAUDE_COMM_RUNTIME) {
		const msg = "boot: --hook --root <other tree> writes TWO instruments and --root governs one.\n" +
			`  · the ledger under ${ROOT} - a start recorded there is real data in that experiment\n` +
			"  · the machine-global session registry for THIS pid, which --root does not touch\n" +
			"  Set CLAUDE_COMM_RUNTIME to a throwaway directory first, or drop --root.\n"
		process.stdout.write(msg)
		process.stderr.write(msg)
		process.exit(2)
	}
	// R8: readFileSync(0) waits for EOF, so this hangs silently at a terminal. The
	// SessionStart hook closes the pipe, but `|| true` in settings.json only rewrites an
	// exit code - it does nothing about a hang, and the 20 s timeout is the harness's
	// promise, not this repo's.
	if (process.stdin.isTTY) {
		console.error("boot: --hook reads a hook payload on stdin; there is none at a terminal")
		process.exit(2)
	}
	try { payload = JSON.parse(readFileSync(0, "utf8")) } catch { payload = null }
	if (payload && payload.source) {
		updateState((st) => {
			st.sources = st.sources || {}
			st.sources[payload.source] = (st.sources[payload.source] || 0) + 1
			st.lastSource = payload.source
			st.lastSourceAt = new Date().toISOString()
			return st
		})
	}
}

// -- 1. session identity, read the way every other scanner reads it ----------
{
	// The walk itself lives in bin/session-registry.mjs, imported by boot, by
	// bin/context.mjs and by the generated field hook stub. It used to be written out
	// here and again there; three copies of "which pid is this session" is three
	// chances for them to disagree about the answer every instrument is keyed on.
	const session = sessionPid()
	let env = null
	if (session) {
		try {
			env = new Map()
			for (const kv of readFileSync(`/proc/${session}/environ`, "utf8").split("\0")) {
				const i = kv.indexOf("=")
				if (i > 0) env.set(kv.slice(0, i), kv.slice(i + 1))
			}
		} catch { env = null }
	}
	thisPid = session
	const declared = env ? (env.get("CLAUDE_COMM_AGENT") || "").trim() : ""
	// The ledger needs a subject and this is the only place that resolves one. An off-bus
	// session is still a session that can author a defect in its first fifteen minutes, so
	// it is recorded under a name that says exactly what it is rather than dropped.
	// F7 (review #5). This was `declared || "unnamed"` - the env var alone - while the
	// field stub asks the BUS, which also matches a directory against the roster. Two rules
	// for one name, writing the same two instruments: measured, a session declaring nothing
	// in ~/Dev/work/HartEdge is `HartEdge` to the stub and would be `unnamed` here. Latent
	// only because this repo carries no roster; live the moment a self-rebooting leader
	// runs boot somewhere that does. The bus is the single place identity is resolved, so
	// this asks it, exactly as the stub does, and keeps the env var as the first authority
	// because `whoami` gives it precedence too.
	// G7 (review #5): `declared ||` short-circuited PAST the bus. `whoami` gives the env var
	// precedence only after two tests - the name must be in the roster, and the caller's
	// root must be the target's - and returns nothing otherwise. So a name the bus REFUSES
	// was being written into both instruments as fact. The bus is asked first now; a
	// declared name still wins, but it wins through the checks instead of around them.
	sessionAgent = askBus(session) || "unnamed"
	const kitty = (env && env.get("KITTY_LISTEN_ON") || "").match(/kitty-(\d+)/)
	const where = session ? `/proc/${session}` : "no claude ancestor"
	const src = payload && payload.source ? ` - started: ${payload.source}` : ""
	// THE ROW REPORTS WHAT THE BUS RESOLVED, not whether an environment variable was typed.
	//
	// Found 2026-09-05, from the owner asking whether agents could set `CLAUDE_COMM_AGENT`
	// themselves. Measured first, and the measurement made the question moot: NOT ONE live
	// session in `~/Dev/work` declares it, and `comm who` names all of them correctly - by
	// directory, which is what `whoami` falls back to and what delivery has always anchored
	// on. The variable was never needed for the ordinary case.
	//
	// 🔴 But this row said it was. Three lines above, `askBus` resolves the identity the way
	// the field stub does - and this line THREW THAT ANSWER AWAY and printed
	// "no CLAUDE_COMM_AGENT - off the bus" whenever the variable was absent. So a `db` agent
	// that is on the bus, receiving mail and recording as `db` in both instruments, was told
	// by the most-read line of the most-read report that it was off the bus. That is this
	// project's signature defect - a row naming something other than what it measured - sat
	// in the first row of its own boot protocol, and it is the reason a person types the
	// variable at every launch: the tool told them to.
	//
	// Three states, and they are genuinely different: DECLARED (someone overrode it), by
	// DIRECTORY (the ordinary case, and it is on the bus), and off the bus (no roster match
	// at all - which is what this repo itself is, having no `.comm/` of its own).
	const onBus = sessionAgent && sessionAgent !== "unnamed"
	// 🔴 FOUR STATES, NOT THREE — and the fix for the defect above moved it rather than
	// removed it (review #7 F4). `declared` is the raw environment variable; `sessionAgent`
	// is what the BUS resolved three lines up, and this branch discarded it again — the same
	// sentence the comment above says was fixed, now in the present case instead of the
	// absent one. Measured, one variable, same fixture: `=none` and `=bogus` are REFUSED by
	// `whoami` (not in the roster) and record as `unnamed` in the ledger, while `=leader` is
	// honoured — and all three printed the identical `declared "X"` with no mention of the
	// bus at all. A session that typed a typo is off the bus and was told its declaration
	// took.
	//
	// `none` is not a typo: `comm who` prints it as the documented way to take a session OFF
	// the bus deliberately, so it is the one refusal that is not a fault.
	const refused = declared && !onBus
	const deliberate = declared === "none"
	const how = declared
		? (onBus && sessionAgent === declared ? `declared "${declared}" - honoured by the bus`
			: onBus ? `declared "${declared}" but the bus resolved "${sessionAgent}" - the record follows the bus`
			: deliberate ? `declared "none" - deliberately OFF the bus (the documented recipe); it receives nothing and records as unnamed`
			: `declared "${declared}" - REFUSED by the bus: no such agent on this roster, so this session is OFF the bus and records as unnamed`)
		: onBus ? `"${sessionAgent}" by directory - on the bus, no CLAUDE_COMM_AGENT needed`
		: "not on any roster here - off the bus"
	row("session", refused && !deliberate ? WARN : OK, `${how} (${where})` +
		`${kitty ? ` - kitty win ${kitty[1]}` : ""}${src}`)
}

// -- 1b. the ledger: every session start, recorded where a reboot can be compared to it -
/**
 * `bin/ledger.mjs` answers "did the fifteen minutes after a restart cost us a defect".
 * It cannot answer anything without a CONTROL, and the control is every ordinary start -
 * so the recording begins now, months before the reboot mechanism exists. A ledger that
 * only starts recording when the feature ships has one arm and no denominator.
 *
 * Two properties this block is built for, both of them failure modes this repo has paid
 * for already:
 *
 *   · A HOOK MUST NOT BREAK A SESSION. Every path here is wrapped and the row never
 *     rises above WARN. The instrument is not worth one broken boot.
 *   · A SILENT INSTRUMENT MUST NOT READ AS A QUIET WORLD. If the append fails, the
 *     ledger later reports "no reboots recorded", which is indistinguishable from
 *     "no reboots happened" - `prove-the-probe`, exactly. So the write is VERIFIED by
 *     re-reading through the same tool, and a start that did not land is a WARN.
 */
{
	const LEDGER = join(ROOT, "bin", "ledger.mjs")
	const node = (args) => {
		try { return spawnSync(process.execPath, [LEDGER, ...args, "--root", ROOT], { encoding: "utf8", timeout: 5000 }) }
		catch { return null }
	}
	let wrote = null
	// Review #7 F9: what the muted stderr was trying to say, on its way to the row instead.
	let signalTrouble = null
	// R3(a), review #4: this used to require `payload.source` before recording, so a payload
	// that was empty, unparseable, or simply carried no `source` recorded NOTHING and left
	// `wrote` null - and the WARN branch was guarded by `wrote && !wrote.ok`, so the row
	// rendered a plain ✓ with the words "this start recorded" merely absent. Measured: three
	// payloads through the real --hook path gave identical ticks, 1 record and 0 records.
	// A suffix is not a mark. On a --hook run, failing to record is now a WARN, and the
	// reason travels with it.
	if (has("--hook") && !payload) {
		wrote = { ok: false, sid: null, why: "the hook payload was empty or unparseable" }
	} else if (has("--hook") && !(payload.source && sessionAgent)) {
		wrote = { ok: false, sid: null, why: !payload.source ? "the hook payload carried no `source`" : "no agent could be resolved for this session" }
	} else if (has("--hook") && payload && payload.source && sessionAgent) {
		// The session id comes from the transcript path, not from a payload field: `Stop`
		// is documented to carry `session_id` and SessionStart was only ever OBSERVED to
		// carry `transcript_path` and `source`. Deriving it from the path uses what was
		// measured instead of what would be convenient.
		const tp = typeof payload.transcript_path === "string" ? payload.transcript_path : ""
		const sid = tp ? basename(tp).replace(/\.jsonl$/, "") : null
		// THE RESTART SIGNAL, CLAIMED HERE TOO. Review #6 F2: the claim lived only in the
		// generated hook stub, and THIS repo has no stub - its SessionStart hook is
		// `boot.mjs --hook`, so boot is the only recorder here. The signal was therefore
		// inert in the project that owns it: a note could be armed, the row would PRINT it,
		// and the same row would file the start as cold in the same sentence. STATUS.md's
		// own ▶ NEXT told the next session to arm one and restart, which could not have
		// worked. Reporting half shipped where the acting half did not exist.
		let sig = []
		try {
			const rs = join(ROOT, "bin", "restart-signal.mjs")
			if (existsSync(rs)) {
				const m = await import(pathToFileURL(rs).href)
				const c = m.claim({ root: ROOT, agent: sessionAgent })
				// 🔴 THE ONLY TWO LINES THIS FILE WROTE TO STDERR WERE THE TWO IT MUTED. Both live
				// under `--hook`, and `--hook` is invoked by this repo's own SessionStart as
				// `... --hook 2>/dev/null || true` (review #7 F9). So: a note consumed - renamed,
				// gone - then not read, the start filed in the WRONG ARM of the experiment the
				// ledger exists to answer, the row green, and the one sentence that would have
				// said so discarded by configuration. The ledger row already knows how to carry a
				// reason; it carries this one now, and stderr keeps its copy for a direct run.
				if (!c.ok) {
					signalTrouble = `⚠ A RESTART SIGNAL FOR ${sessionAgent} COULD NOT BE CLAIMED (${c.why}) - this start is recorded as COLD and the note may be consumed`
					process.stderr.write(`claude-comm: a restart signal for ${sessionAgent} could not be claimed (${c.why}); this start is being recorded as COLD.\n`)
				}
				else if (c.signal) {
					if (c.signal.prev_session) sig.push("--prev-session", String(c.signal.prev_session))
					sig.push("--signal-src", String(c.signal.by || "unknown"))
					if (Number.isFinite(c.age_s)) sig.push("--signal-age", String(c.age_s))
					if (Number.isFinite(c.signal.ttl_s)) sig.push("--signal-ttl", String(c.signal.ttl_s))
				}
			}
		} catch (e) {
			signalTrouble = `⚠ THE RESTART SIGNAL COULD NOT BE LOADED (${(e && e.message) || e}) - this start is recorded as COLD`
			process.stderr.write(`claude-comm: the restart signal could not be loaded (${(e && e.message) || e}); this start is being recorded as COLD.\n`)
		}
		// --pending-auto: the covariate, counted by the ledger itself (one implementation,
		// not one here and one in the stub). See install.mjs's copy of this call.
		const r = node(["record", "start", "--agent", sessionAgent, "--source", payload.source,
			...(sid ? ["--session", sid] : []), "--quiet", "--pending-auto", ...sig])
		wrote = { ok: !!r && r.status === 0, sid, why: r ? (r.stderr || "").trim().split("\n")[0] : "spawn failed" }
	}
	const q = node(["--json"])
	let a = null
	try { a = JSON.parse((q && q.stdout) || "") } catch {}
	if (!a) row("ledger", UNKNOWN, "bin/ledger.mjs did not answer - the reboot instrument is NOT reporting")
	else {
		// R3(b): this block's contract said the write "is VERIFIED by re-reading through the
		// same tool", and it was not - `wrote.ok` was the child's exit code and the query
		// was a separate call nobody compared it against. With the handoff directory
		// writable but not readable, boot printed "0 cold + 0 reboot start(s)" and "this
		// start recorded" in ONE SENTENCE, green. The re-read now actually happens: the
		// ledger reports the last start it can see, and it must be the one just written.
		const seen = a.lastStart && wrote && wrote.sid
			? (a.lastStart.session === wrote.sid ? "confirmed" : `the ledger's newest start is ${a.lastStart.session}, not the one just written`)
			: (a.lastStart ? "confirmed" : "the ledger reports no start at all")
		const bits = [`${a.starts.cold} cold + ${a.starts.reboot} reboot start(s)`,
			`${a.trials.cold}+${a.trials.reboot} completed trial(s)`,
			`${a.defects.total} defect(s)`, `verdict ${a.verdict}`]
		// R6: `mislabelled` and `exposureSkew` were computed, exported, rendered by the
		// ledger's own report - and dropped by the one rendering anybody reads at session
		// start. A counter written because "a mismatch is either tampering or a writer bug
		// and both need to be visible" was visible only in the tool nobody runs daily.
		if (signalTrouble) bits.push(signalTrouble)
		if (a.unreadable) bits.push(`⚠ ${a.unreadable} unreadable line(s)`)
		if (a.unreadableFiles && a.unreadableFiles.length) bits.push(`⚠ ${a.unreadableFiles.length} UNREADABLE LOG FILE(S)`)
		if (a.dirUnreadable) bits.push(`⚠ the ledger directory could not be read`)
		if (a.mislabelled) bits.push(`⚠ ${a.mislabelled} line(s) naming another agent`)
		if (a.exposureSkew) bits.push(`⚠ the arms' exposure is skewed`)
		// R6 AGAIN, review #6 F5: `caveats` was added to the ledger, printed under every
		// verdict by the ledger's own report - and dropped HERE, in the same commit, hours
		// after the comment above was written about `mislabelled`. A verdict quoted without
		// its caveat is the sub-population error the caveat exists to prevent: this arm
		// holds DECLARED restarts only, and a reader who never sees that will read UNKNOWN
		// or BETTER as a statement about restarts in general.
		//
		// It carries the ledger's POINTER, never a re-worded copy of the ledger's sentence -
		// a second wording here would drift from the one the tool prints, which is how the
		// two renderings disagreed in the first place. A caveat with no pointer falls back
		// to its own opening words, so an unpointed caveat cannot vanish silently.
		//
		// It does NOT redden the row. A caveat is a qualification of the verdict, not a
		// fault, and a row that warns at every boot for a permanent condition is the
		// warning-nobody-reads this file argues against 480 lines below.
		for (const c of a.caveats || []) {
			const ptr = [...String(c).matchAll(/((?:FINDINGS|README|STATUS)\.md#[A-Za-z0-9-]+)/g)].map((m) => m[1])
			bits.push(ptr.length ? `◈ verdict caveat: ${ptr.join(" ")}` : `◈ verdict caveat: ${String(c).slice(0, 60)}…`)
		}
		// A note is a restart somebody DECLARED and has not yet performed, and it is the
		// only state here that expires. Surfaced at boot because the mechanism's first real
		// use showed nothing anywhere would say so: the ~/Dev/work leader armed one at the
		// start of its close with a 15-minute promise, and a close does not fit in fifteen
		// minutes. It was visible only because I happened to be watching his screen.
		for (const n of (a.armed && a.armed.notes) || []) {
			const age = n.age_s === null ? "age unmeasurable" : `${Math.round(n.age_s / 60)}m old`
			bits.push(n.fresh
				? `◷ a restart note is armed for ${n.agent} (${age}, ${n.ttl_s === null ? "no promise" : `${Math.round(n.ttl_s / 60)}m promise`})`
				: `⚠ the restart note for ${n.agent} has LAPSED (${age}) - the next start scores COLD; re-arm it as the LAST act before the restart`)
		}
		if (a.armed && a.armed.unreadable) bits.push(`⚠ ${a.armed.unreadable} restart note(s) the ledger could not read`)
		const lapsed = ((a.armed && a.armed.notes) || []).some((n) => !n.fresh) || (a.armed && a.armed.unreadable)
		const bad = a.unreadable || (a.unreadableFiles && a.unreadableFiles.length) || a.dirUnreadable
			|| a.mislabelled || a.exposureSkew || lapsed || signalTrouble
		if (wrote && !wrote.ok) row("ledger", WARN, `THIS START WAS NOT RECORDED (${wrote.why || "no reason given"}) - ${bits.join(" - ")}`)
		else if (wrote && seen !== "confirmed") row("ledger", WARN, `THE WRITE WAS NOT SEEN BY THE RE-READ (${seen}) - ${bits.join(" - ")}`)
		else row("ledger", bad ? WARN : OK, bits.join(" - ") + (wrote ? " - this start recorded and re-read" : ""))
	}
}

/**
 * The agent name as the BUS resolves it - never a second implementation of the rule.
 * Silent on every failure: a name is a nicety here, and the ledger records `unnamed`
 * rather than nothing when it cannot get one.
 */
function askBus(sessionPidForCwd) {
	try {
		let cwd = ROOT
		try { cwd = readlinkSync(`/proc/${sessionPidForCwd}/cwd`) } catch {}
		const r = spawnSync(process.execPath, [join(ROOT, "bin", "comm.mjs"), "whoami", "--agent-root", cwd],
			{ cwd, encoding: "utf8", timeout: 5000 })
		return r.status === 0 && String(r.stdout).trim() ? String(r.stdout).trim() : null
	} catch { return null }
}

// -- 1c. the session registry: which transcript is THIS pid writing NOW? -----
/**
 * `bin/context.mjs` used to answer that from the scratch directory a process holds
 * open, and that names the session the process was LAUNCHED as - forever. After a
 * `/clear` it reports a DEAD session's final context with exit 0
 * (`FINDINGS.md#clear-blind`), which would have made a self-rebooting leader reboot
 * forever while looking like a working feature.
 *
 * The SessionStart hook is the only vantage point on this machine that is HANDED the
 * live session's transcript, so it is the only thing entitled to write this down.
 * Recording it is therefore a hook-path job, and every other caller only reads.
 *
 * Two rules this row inherits from the ledger row directly above it, both paid for:
 *
 *   · A HOOK MUST NOT BREAK A SESSION - `record` returns reasons, never throws.
 *   · THE WRITE IS VERIFIED BY RE-READING IT (R3(b)). A write whose success is the
 *     child's own opinion of itself is not a measurement; this one is read back through
 *     `lookup`, the same function `bin/context.mjs` will use, and must come back with
 *     the same transcript.
 */
{
	// F4 (review #5). At `SessionStart` the payload's `transcript_path` is a PROMISE, not
	// a file: Claude Code creates it afterwards. Measured on two real cold starts, the gap
	// was 9.1 s and 18.6 s - so the row this project reads at every session start was ⚠ on
	// every cold start, for a state that is not a defect. That is the "train people to
	// ignore the row" failure this same file warns about two branches down, and it spends
	// the --close ack budget that is meant to BE the drift signal. The existence check is
	// right on the read path and wrong on the write path; `at` is the field that tells them
	// apart, and until now nothing had ever asked it a question. 120 s is ~6x the largest
	// gap measured; past it, a missing transcript is a real fault again.
	const PROMISE_GRACE_MS = 120_000
	const justPromised = (e) => {
		const t = Date.parse(e && e.at || "")
		return Number.isFinite(t) && Date.now() - t < PROMISE_GRACE_MS
	}
	let wrote = null
	if (has("--hook")) {
		const tp = payload && typeof payload.transcript_path === "string" ? payload.transcript_path : ""
		wrote = registryRecord({ pid: thisPid, transcript: tp, agent: sessionAgent, source: payload && payload.source })
	}
	const back = registryLookup(thisPid)
	const where = registryDir()
	if (has("--hook")) {
		if (!wrote.ok) {
			row("registry", WARN, `THIS SESSION WAS NOT RECORDED (${wrote.why}) - bin/context.mjs will REFUSE for it`)
		} else if (!back.ok || back.transcript !== wrote.transcript) {
			// The re-read is the whole point: a write nobody read back is a claim.
			row("registry", WARN, `THE WRITE WAS NOT SEEN BY THE RE-READ (${back.ok ? `it names ${basename(back.transcript)}` : back.why})`)
		} else if (!existsSync(back.transcript) && !justPromised(back)) {
			row("registry", WARN, `recorded ${basename(back.transcript)} for pid ${thisPid}, and that file does not exist`)
		} else if (!existsSync(back.transcript)) {
			row("registry", OK, `pid ${thisPid} -> ${basename(back.transcript)} (${back.source || "no source"}) - written and re-read - ${where}`)
		} else {
			row("registry", OK, `pid ${thisPid} -> ${basename(back.transcript)} (${back.source || "no source"}) - written and re-read - ${where}`)
		}
	} else if (!thisPid) {
		// Not a session at all: a script, a cron shell, a fixture run. There is nothing
		// to register, and inventing a warning here would train people to ignore the row.
		row("registry", OK, "no claude ancestor - not a session, nothing to register")
	} else if (back.ok && !existsSync(back.transcript) && !justPromised(back)) {
		// The row used to say "bin/context.mjs can resolve this session" on the strength of
		// a lookup alone - a claim about ANOTHER tool that this one had not checked. When
		// a stale entry named a file that did not exist, context refused and the row stayed
		// green: a green row over a dead sensor, which is the one shape this project keeps
		// paying for. If the row is going to speak for the reader, it reads what the reader
		// reads.
		row("registry", WARN, `pid ${thisPid} -> ${basename(back.transcript)}, and that file is GONE - bin/context.mjs will REFUSE`)
	} else if (back.ok) {
		row("registry", OK, `pid ${thisPid} -> ${basename(back.transcript)} (${back.source || "no source"}) - bin/context.mjs can resolve this session`)
	} else {
		// Truthful and self-healing: the next SessionStart in this process records it.
		// Until then `bin/context.mjs` refuses for this session, which is the point.
		row("registry", WARN, `${back.why} - bin/context.mjs will REFUSE for this session (--transcript still answers)`)
	}
}

// -- 2. the tree: what git says, not what a document says --------------------
{
	const head = git("log", "-1", "--format=%h %ct %s")
	if (!head) row("tree", WARN, "not a git repository")
	else {
		const [h, ct, ...rest] = head.split(" ")
		const dirty = (git("status", "--porcelain") || "").split("\n").filter(Boolean).length
		const aheadRaw = git("rev-list", "--count", "@{u}..HEAD")
		const ahead = aheadRaw === null ? -1 : Number(aheadRaw)
		const bits = [`${h} ${age(Date.now() - Number(ct) * 1000)} ago`, dirty ? `${dirty} uncommitted` : "clean"]
		if (ahead > 0) bits.push(`${ahead} unpushed`)
		else if (ahead < 0) bits.push("no upstream")
		row("tree", dirty || ahead !== 0 ? WARN : OK, `${bits.join(" - ")} - "${rest.join(" ").slice(0, 44)}"`)
	}
}

// -- 3. the archive the gates and this protocol READ - is it in git? ---------
/**
 * A gate that reads a file git does not carry is green in one working tree and red
 * everywhere else - measured: a fresh clone failed A27 with 21 dangling pointers.
 *
 * Which documents the gates read is DECLARED by the gate suite, in a marker inside
 * `test/attack.mjs`. It used to be inferred by regexing the gate source for
 * `join(PKG, "X.md")`, and review #3 R4 broke that in one line: a gate written with the
 * filename in a const is invisible to the regex, so boot downgraded RED to WARN and
 * exited 0 while a clone crashed the whole suite. "Structural beats guesswork" was the
 * right instinct, but matching an IDIOM is a style dependency, not a structural one -
 * it is always one refactor behind.
 *
 * The inference is kept, demoted to a DRIFT DETECTOR: any core document named anywhere
 * in the gate source but absent from the declaration is reported, because the dangerous
 * direction is a dependency that exists and is undeclared.
 */
{
	const lsFiles = git("ls-files")
	const tracked = new Set((lsFiles || "").split("\n").filter(Boolean))
	let gateSrc = "", gateProse = ""
	const gateStripped = []
	try {
		for (const f of readdirSync(join(ROOT, "test"))) {
			if (!f.endsWith(".mjs")) continue
			const t = readFileSync(join(ROOT, "test", f), "utf8")
			gateProse += t
			// STRIPPED PER FILE, never over the concatenation. Found 2026-09-05, by this row
			// going yellow on a commit that touched no document: `/* … */` is matched
			// non-greedily, and these files carry `/*` inside STRINGS and REGEXES (this very
			// detector's own `/\/\*[\s\S]*?\*\//g` is one), so the markers do not balance.
			// Concatenating first let an unclosed `/*` in one file swallow the beginning of
			// the next, and which text survived depended on readdir order and on edits
			// elsewhere. The row therefore flipped for a reason foreign to what it measures -
			// which is how a row gets ignored, and this file says so in four other places.
			gateStripped.push(t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""))
		}
	} catch {}
	// Strip comments before looking for a dependency, in A21's idiom and for its reason:
	// PROSE about a document must not redden a check about reading one. Measured on the
	// first run of this detector - `test/latency.mjs` says "STATUS.md's latency table is
	// this project's flagship" in a header comment, and the row went yellow claiming an
	// undeclared gate dependency that does not exist. A check that fires for a reason
	// foreign to what it claims is how a row gets ignored.
	gateSrc = gateStripped.join("\n")
	const decl = gateProse.match(/\/\/\s*gate-docs:([^\n]*)/)
	const needed = new Set(decl ? decl[1].trim().split(/[\s,]+/).filter(Boolean) : [])
	gateDocs = [...needed]
	// CLAUDE.md is in here because the boot contract is subject to its own rule: the
	// file that tells a session to run this tool is worth nothing if git does not
	// carry it. `*.md` in .gitignore already swallowed FINDINGS.md once.
	// Not "what is read at boot" - "what this repo cannot afford to lose". HISTORY.md is
	// tier 2 and deliberately unread at boot, but losing it loses how every closed
	// decision was reached, which is the same failure the *.md ignore rule already caused.
	const READ_FIRST = ["CLAUDE.md", "README.md", "STATUS.md", "FINDINGS.md", "HISTORY.md", "DESIGN-autonomy.md"]
	const bad = [], undeclared = []
	for (const f of new Set([...READ_FIRST, ...needed])) {
		const gated = needed.has(f)
		// NAMED IN A LINE THAT ALSO NAMES THE PACKAGE ROOT. A bare basename match reported
		// `A36` reading `join(rootG, ".comm", "README.md")` - a notice this suite GENERATES
		// into a throwaway fixture - as an undeclared dependency on THIS repo's README.md.
		// The row then named a document the gate never opens, in the row whose job is to say
		// which documents the gate opens. A real dependency resolves against PKG, and the
		// R4 arm's own staged one (`readFileSync(join(PKG, "STATUS.md"))`) still trips it.
		//
		// This narrows the drift detector, and the trade is named: a gate that reads a core
		// document through a path built on an earlier line stays invisible here. That was
		// already true of this detector (review #3 R4 - "matching an idiom is a style
		// dependency, always one refactor behind"), the DECLARATION is the mechanism, and
		// this remains only the drift alarm beside it. A false positive in an alarm read at
		// every session start costs more than this particular false negative.
		if (!gated && gateStripped.some((t) => t.split("\n").some((l) => l.includes(f) && /\bPKG\b/.test(l))))
			undeclared.push(f)
		if (!existsSync(join(ROOT, f))) bad.push({ f, gated, why: "missing" })
		else if (lsFiles !== null && !tracked.has(f)) bad.push({ f, gated, why: "untracked" })
	}
	// R5: git returning nothing is not git saying "all tracked". The row's whole purpose
	// is "does git carry these", so when git could not be asked it must say so rather
	// than assert the reassuring half of the answer it never obtained.
	if (!decl) row("archive", WARN, "test/attack.mjs carries no `// gate-docs:` marker - gate dependencies undeclared")
	else if (undeclared.length) row("archive", WARN, `the gate suite names ${undeclared.join(", ")} but does not declare reading it`)
	else if (lsFiles === null) row("archive", UNKNOWN, "git could not be read - tracking NOT checked")
	else if (!bad.length) row("archive", OK, `${READ_FIRST.length} core documents present and tracked, ${needed.size} declared as gate inputs`)
	else {
		const gatedBad = bad.filter((b) => b.gated)
		row("archive", gatedBad.length || bad.some((b) => b.why === "missing") ? RED : WARN,
			bad.map((b) => `${b.f} ${b.why}${b.gated ? " (a GATE reads it)" : ""}` +
				(b.why === "missing" ? "" : " - lives in this working tree only")).join(" - ") +
			(gatedBad.length ? " - green here, red on any clone" : ""))
	}
}

// -- 3b. the orientation budget: what every boot pays, forever ---------------
/**
 * The cost of a boot is paid on EVERY session for the life of the project, so it is
 * the one number that compounds. Measured 2026-09-04 on the owner's live project
 * leader: a median boot of 99 809 tokens, worst 220 200, against rounds of 56 172 -
 * the read set, not the conversation, is what fills a window. This repo's own tier 0
 * was 24 k tokens before that measurement and is ~6 k after.
 *
 * The list is read from a marker in CLAUDE.md rather than hardcoded here, so the file
 * that TELLS a session what to read is the same file that counts against the cap. A
 * hardcoded copy would drift from the prose the moment someone adds a tier-0 file, and
 * drift in this direction is invisible - the boot just gets quietly more expensive.
 *
 * The cap is set with ~30% headroom over the size on the day it was written, in A22's
 * idiom: when it reddens the fix is to SPLIT OR CUT, never to raise the ceiling.
 */
{
	const TIER0_BUDGET = 28_000
	let names = []
	try {
		const m = readFileSync(join(ROOT, "CLAUDE.md"), "utf8").match(/<!--\s*boot-tier0:([^>]*?)-->/)
		if (m) names = m[1].trim().split(/\s+/).filter(Boolean)
	} catch {}
	if (!names.length) {
		// A missing marker must not read as "budget fine": that is the void-probe shape
		// this project keeps finding - a check that passes because it measured nothing.
		row("budget", WARN, "CLAUDE.md carries no boot-tier0 marker - the boot read set is ungoverned")
	} else {
		let total = 0, missing = []
		for (const n of names) {
			try { total += statSync(join(ROOT, n)).size } catch { missing.push(n) }
		}
		// R10: the --fast report is injected into every session, so it IS tier 0 - and
		// CLAUDE.md's table listed it while the marker did not, which is exactly the drift
		// the marker was introduced to prevent. It cannot be measured before it is
		// rendered, so the previous run's size is used and labelled.
		let reported = 0
		try { reported = JSON.parse(readFileSync(join(ROOT, ".boot-state.json"), "utf8")).reportBytes || 0 } catch {}
		total += reported
		const pct = Math.round((total / TIER0_BUDGET) * 100)
		// MEASURED, not assumed. This row counts BYTES while the reason the cap exists is
		// a cost in TOKENS, and a ratio nobody checked is how the ~/Dev/work leader spent a
		// day reporting a 25 k-token saving that was worth approximately nothing: he used
		// bytes/4, his corpus tokenises at ~2.0, and the error ran in the comfortable
		// direction. Measured here 2026-09-04 by two `claude -p` probes differing in one
		// thing - 19 739 B of this repo's own tier 0 pasted into the prompt, not read
		// through a tool, so no preamble inflates it: 7 317 tokens, 2.70 B/token.
		// Re-measure if this corpus changes character. FINDINGS.md#tier0-calibration
		const BYTES_PER_TOKEN = 2.70
		row("budget", missing.length ? RED : total > TIER0_BUDGET ? RED : total > TIER0_BUDGET * 0.85 ? WARN : OK,
			missing.length
				? `tier 0 names ${missing.join(", ")}, which do not exist`
				: `tier 0 is ${total} B of ${TIER0_BUDGET} (${pct}%, ~${Math.round(total / BYTES_PER_TOKEN)} tokens) across ${names.join(" + ")}` +
				  (reported ? ` + ${reported} B of injected report` : " (report size not yet recorded)") +
				  (total > TIER0_BUDGET ? " - split it or cut it; raising the cap is not a fix" : ""))
	}
}

// -- 4. does STATUS.md still describe the code, or does it predate it? -------
{
	const p = join(ROOT, "STATUS.md")
	if (!existsSync(p)) row("status", WARN, "STATUS.md absent - nothing states what is OPEN")
	else {
		statusText = readFileSync(p, "utf8")
		const txt = statusText
		const m = statusText.match(/^#\s*STATUS.*?(\d{4}-\d{2}-\d{2})/m)
		const stamp = m ? m[1] : "undated"
		const doc = statSync(p).mtimeMs
		let newest = 0, newestFile = ""
		// Deliberately NOT bin/boot.mjs: this file is not the bus, and letting it count
		// here would redden the row every time the boot itself is edited - a warning
		// that fires for a reason foreign to what it claims to measure is how a row
		// gets ignored.
		for (const rel of ["bin/comm.mjs", "install.mjs", "test/attack.mjs", "test/selftest.mjs"]) {
			const fp = join(ROOT, rel)
			if (!existsSync(fp)) continue
			const mt = statSync(fp).mtimeMs
			if (mt > newest) { newest = mt; newestFile = rel }
		}
		const stale = newest > doc
		const nx = txt.match(/^##\s*▶\s*NEXT\b[^\n]*\n([\s\S]*?)(?=^## |\Z)/m)
		nextText = nx ? nx[1].trim() : ""
		row("status", stale ? WARN : OK,
			`headed ${stamp}` +
			(stale ? ` - but ${newestFile} is newer by ${age(newest - doc)}: read it as a claim` : " - newer than the code it describes"))
	}
}

// -- 5. the field: drift, bus staleness, and mail that never landed ----------
{
	let projects = []
	try {
		projects = readdirSync(FIELD, { withFileTypes: true })
			.filter((d) => d.isDirectory() && existsSync(join(FIELD, d.name, ".comm", "config.json")))
			.map((d) => join(FIELD, d.name))
			.filter((p) => resolve(p) !== ROOT)
	} catch {}
	if (!projects.length) row("field", WARN, `no installed project under ${FIELD}`)
	// Every file the field hooks actually EXECUTE, not just the bus. `comm.mjs` was the
	// only one compared until the two instruments started travelling beside it
	// (2026-09-04); a copy that can go stale and is compared by nothing is a drift class
	// with no detector, which is the shape this row exists to remove.
	//
	// ENUMERATED from what is actually installed, never listed here. The first version of
	// this widening was a literal list — and `install.mjs` has its own list of what it
	// copies, so two lists had to agree and nothing checked that they did. That is the
	// identical defect A27/A28 carried for three reviews, re-created hours after being
	// removed, by the person who had just removed it. Reading the directory also catches
	// what a list never could: a module left behind by an older install that the repo no
	// longer ships, still sitting on the path a hook executes.
	const repoHash = (f) => sha(join(ROOT, "bin", f))
	for (const p of projects) {
		const name = basename(p)
		const chk = spawnSync("node", [join(ROOT, "install.mjs"), p, "--check"], { encoding: "utf8" })
		const drift = chk.status !== 0
		// NAME WHAT DRIFTED. This row printed "HOOK DRIFT" for any non-zero exit, and on
		// 2026-09-04 it said exactly that when what had actually changed was the field
		// project's `.gitignore` - its owner had just put the repo under git and dropped the
		// `.comm/` rule, so live delivery state became committable. The row sent a reader to
		// look at hooks that were byte-perfect. A row that names something other than what it
		// measured is this project's signature defect, and here it was in the row whose whole
		// job is to report on somebody else's machine. The installer already prints the list;
		// only this file was throwing it away.
		// READ THE INSTALLER'S DECLARED LIST, NEVER ITS PROSE. Review #6 F3: this took "any
		// line indented four spaces, on either stream" to be a drifted filename - and the
		// git-tracking warning added in the same commit prints its file list, its "… and N
		// more" line AND its fix command at exactly that indent. Measured: nine names for one
		// drifted file, five bus files listed as DRIFT beside "bus current (5 files)" in the
		// same sentence, and `git rm -r --cached .comm/ && echo '.comm/' >> .gitignore`
		// rendered as a filename. The wording this replaced said only "HOOK DRIFT", which was
		// vague; this was CONFIDENTLY WRONG, in the row whose whole job is to report on
		// somebody else's machine. Matching an idiom is a style dependency (review #3 R4,
		// same lesson, same file); the installer now says what drifted on a marked line.
		//
		// NO FALLBACK to the old scrape. A reader that guesses when the structured answer is
		// absent is the guess, preserved: an installer too old to emit the marker leaves this
		// empty, and the branch below already has honest wording for a refusal it has not
		// read. Silence about a list is recoverable; a wrong list is not.
		let drifted = []
		const declared = /^claude-comm-drift: (.*)$/m.exec(chk.stdout || "")
		if (declared) {
			try {
				const v = JSON.parse(declared[1])
				if (Array.isArray(v)) drifted = v.filter((x) => typeof x === "string")
			} catch { /* an unparseable declaration is no declaration; the row says "refused" */ }
		}
		// Checked independently of the installer's own count: the installed bus is the
		// file the hooks actually execute, and it going stale is a defect this project
		// has already shipped twice without noticing.
		// R9: a null repoBus used to DISABLE the comparison, so the row printed the
		// reassuring "bus current" having compared nothing - a void probe standing behind
		// a working one, since the installer happens to fail on the same condition.
		let installed = []
		try { installed = readdirSync(join(p, ".comm", "bin")).filter((f) => f.endsWith(".mjs")).sort() } catch {}
		const uncomparable = installed.filter((f) => repoHash(f) === null)
		const staleFiles = installed.filter((f) => repoHash(f) !== null && sha(join(p, ".comm", "bin", f)) !== repoHash(f))
		// An empty directory must not read as "everything matches": the bus is the file
		// every hook executes, so its absence is the loudest possible staleness.
		const busStale = !installed.length ? true : uncomparable.length ? null : staleFiles.length > 0
		let pending = 0, oldest = 0
		// PER DIRECTORY, because "how much mail" and "whose mail" are different questions and
		// the row answered the second one from a different source than the first (review #7 F3).
		const perDir = new Map()
		const ibx = join(p, ".comm", "inbox")
		try {
			for (const a of readdirSync(ibx)) {
				let files = []
				try { files = readdirSync(join(ibx, a)) } catch { continue }
				for (const f of files) {
					if (!f.endsWith(".json")) continue
					pending++
					perDir.set(a, (perDir.get(a) || 0) + 1)
					const mt = statSync(join(ibx, a, f)).mtimeMs
					if (!oldest || mt < oldest) oldest = mt
				}
			}
		} catch {}
		let last = null
		try {
			const lines = readFileSync(join(p, ".comm", "log.jsonl"), "utf8").trim().split("\n")
			last = JSON.parse(lines[lines.length - 1]).delivered || null
		} catch {}
		// THE FIELD IS WHERE THE RESTARTS ARE. A note armed here and left to lapse costs the
		// experiment its scarcest event, and I learned that by watching a peer's terminal
		// rather than by reading my own boot. Cheap first, always: a readdir, and the ledger
		// is spawned only when there is actually something to ask about - the same shape the
		// hook stub uses for the doorbell, so the common boot pays one directory listing.
		let notes = [], noteDirBad = false
		let noteFiles = []
		try { noteFiles = readdirSync(join(p, ".comm", "restart")).filter((f) => f.endsWith(".json")) }
		catch (e) {
			// ABSENCE IS NOT INACCESSIBILITY, and the first version of this block conflated
			// them in one bare catch: a project that has simply never armed a note (no
			// directory at all) rendered as "a restart note is armed here and could not be
			// read". A false alarm in a row that is read at every session start is worse than
			// no row - it is the same defect as a silent miss, wearing the opposite face.
			// Caught on the first run, by the project that had nothing to report.
			if (e && e.code !== "ENOENT") noteDirBad = true
		}
		// WHAT FAILED IS PART OF THE REPORT. Review #6 F11: a failure of this spawn set
		// `noteDirBad`, and the row then said "this project's restart notes could not be read
		// at all" - naming the directory when what had actually failed was asking the ledger.
		// The two send an operator to different places: one is a permission or a corrupt file
		// in `.comm/restart/`, the other is a missing or broken `bin/ledger.mjs` in THIS repo,
		// and only the second is a defect on the machine reading the row.
		let ledgerUnreachable = false
		if (noteFiles.length) {
			try {
				const led = spawnSync("node", [join(ROOT, "bin", "ledger.mjs"), "--root", p, "--json"],
					{ encoding: "utf8", timeout: 5000 })
				notes = JSON.parse(led.stdout).armed.notes || []
			} catch { ledgerUnreachable = true }
		}
		// WHAT THIS PROJECT'S AGENTS ARE HOLDING. The port collision (`FINDINGS.md#claim-file`)
		// happened between two agents in ONE tree, and the peer's own written port registry
		// carries the defect he named himself: *"it only catches the agents that read it."* A
		// tool somebody has to remember to type is that same registry with a JSON extension.
		// So boot asks, at the one moment every agent is guaranteed to be looking.
		//
		// SPAWNED ONLY WHEN THERE IS SOMETHING TO ASK ABOUT - the identical shape as the
		// restart notes above, and for the identical reason: a project that has never claimed
		// anything must pay one directory listing and print nothing. A row that appears in
		// every project every session is a row nobody reads.
		// TWO SESSIONS ON ONE INBOX IS MAIL LOSS, and the bus already computes it. Measured
		// 2026-09-05: `comm who` says "2 SESSIONS SHARE THIS INBOX - mail is drained by
		// whichever ends a turn FIRST, the others never see it, and the sender is still told
		// it was delivered", and THIS row said `hooks in sync - 0 pending` about the same
		// state. The tool computed it and the row everyone reads dropped it - review #6 F5's
		// defect, in the row whose whole job is to report on somebody else's machine.
		//
		// Asked of the BUS rather than re-derived here: `liveAgents` is one implementation of
		// "which claude process is which agent" and a second copy in this file is the shape
		// this project has now shipped three times. One spawn per field project per boot,
		// which is what the condition is worth: it is silent, it is live, and the sender gets
		// a success either way.
		let shared = [], stranded = [], unaddressable = [], busAnswered = false
		try {
			const w = spawnSync("node", [join(p, ".comm", "bin", "comm.mjs"), "who", "--json"],
				{ cwd: p, encoding: "utf8", timeout: 5000 })
			const ag = JSON.parse(w.stdout).agents || {}
			busAnswered = true
			// 🔴 THE THIRD STATE, and the amendment below created it (review #7 F3). `pending` is
			// a walk of every directory under .comm/inbox/; `stranded` is computed from the
			// ROSTER. When those two disagree — an agent renamed or retired while it had mail —
			// the row took the green branch and made a POSITIVE claim about that mail: "in flight
			// to a running agent". Nothing will ever drain it: `comm who` does not know the name,
			// no hook delivers it, and `install --check` reports no drift for the orphaned stub.
			// One edit of `.comm/config.json` reaches this state, and this session's own notice
			// tells field agents to make that edit.
			unaddressable = [...perDir.entries()].filter(([name, n]) => n > 0 && !Object.prototype.hasOwnProperty.call(ag, name))
				.map(([name, n]) => `${name} (${n})`)
			shared = Object.entries(ag).filter(([, v]) => ((v && v.pids) || []).length > 1)
				.map(([name, v]) => `${name} (${v.pids.length})`)
			// AMENDED 2026-09-05, on the acknowledgement count and not on an opinion. This row
			// reddened on ANY pending mail, and `field:work` was acknowledged THREE times in one
			// day with the identical sentence: their leader wrote to their `db`, `db` is running,
			// it drains at its next turn boundary. CLAUDE.md's rule is that a guard defensible
			// every time it is bypassed is already failing and the RATE is the signal.
			//
			// Mail in flight to a RUNNING agent is the bus working. Mail for an agent that is
			// NOT running waits until somebody relaunches it, and nothing else says so — that is
			// the half worth a warning, and it is the half the old row buried by warning about
			// both. Split with the answer the bus already gave for the shared-inbox check above;
			// no second spawn, and no second definition of "running".
			stranded = Object.entries(ag).filter(([, v]) => (v && v.pending) > 0 && !((v && v.pids) || []).length)
				.map(([name, v]) => `${name} (${v.pending})`)
		} catch { /* the bus not answering is already the DRIFT/STALE half of this row */ }
		let claims = [], claimDirBad = false
		let claimFiles = []
		try { claimFiles = readdirSync(join(p, ".comm", "claims")).filter((f) => f.endsWith(".json")) }
		catch (e) { if (e && e.code !== "ENOENT") claimDirBad = true }
		if (claimFiles.length) {
			try {
				const cl = spawnSync("node", [join(ROOT, "bin", "claim.mjs"), "list", "--json", "--root", p],
					{ encoding: "utf8", timeout: 5000 })
				claims = JSON.parse(cl.stdout).claims || []
			} catch { claimDirBad = true }
		}
		if (noteDirBad) notes = [{ agent: "?", age_s: null, ttl_s: null, fresh: false, unread: "dir" }]
		else if (ledgerUnreachable) notes = [{ agent: "?", age_s: null, ttl_s: null, fresh: false, unread: "ledger" }]
		const lapsedNote = notes.some((n) => !n.fresh)
		// Anything that is not plainly held is a claim somebody has to look at: a dead holder,
		// bytes nobody can read, or a record this version cannot judge.
		const deadClaim = claimDirBad || claims.some((c) => c.state !== "held") || shared.length > 0
		const bits = [
			// An unparsed non-zero exit must not borrow the confident wording of a parsed one:
			// it means the installer refused for a reason this row has not read.
			drift ? (drifted.length ? `DRIFT: ${drifted.join(", ")}` : `install --check refused (exit ${chk.status})`)
				: "hooks in sync",
			busStale === null ? `UNCOMPARED (this repo has no ${uncomparable.join(", ")} to compare against)`
				: !installed.length ? "NOTHING INSTALLED in .comm/bin"
				: busStale ? `STALE vs repo: ${staleFiles.join(", ")}`
				: `bus current (${installed.length} files)`,
			!pending ? "0 pending"
				: unaddressable.length ? `⚠ ${unaddressable.join(", ")} has mail and IS ON NO ROSTER - nothing will ever deliver it: the bus does not know the name (oldest ${age(Date.now() - oldest)})`
				: stranded.length ? `⚠ ${stranded.join(", ")} has mail and is NOT RUNNING - it waits for a relaunch (oldest ${age(Date.now() - oldest)})`
				: busAnswered ? `${pending} pending, in flight to a running agent (oldest ${age(Date.now() - oldest)})`
				: `${pending} pending (oldest ${age(Date.now() - oldest)}) - the bus could not be asked who is running`,
			last ? `last delivery ${age(Date.now() - Date.parse(last))} ago` : "no delivery logged",
			// Held is information; a holder that is GONE is a crash somebody should see, and
			// it is the state a naive claim tool turns into a lock nobody can clear.
			...(shared.length ? [`⚠ ONE INBOX, TWO SESSIONS: ${shared.join(", ")} - mail goes to whichever ends a turn first, the others never see it, and the sender is told it was delivered`] : []),
			...(claimDirBad ? [`⚠ ${claimFiles.length} resource claim(s) are here and could not be read`] : []),
			// EVERY STATE `claim.mjs read()` CAN RETURN, in ITS words. This reported two of five
			// and dropped `corrupt`, `unknown` and `unreadable` on the floor (review #7 F8) —
			// `corrupt` being the one that means something wrote into the claims directory that
			// should not have, which the tool's own property 3 calls the only evidence of the
			// writer. And it re-derived the sentence for `gone` from `state` alone, so a claim
			// the tool had itself predicted would read as gone — `holder: "self"`, warned about
			// on stderr as it was written — was announced at every session start as a crash
			// (F14). `note` comes from claim.mjs's one renderer; there is no second wording here.
			...claims.filter((c) => c.state !== "held" && c.note)
				.map((c) => `⚠ CLAIM ${c.resource}: ${c.note}`),
			...(claims.some((c) => c.state === "held")
				? [`${claims.filter((c) => c.state === "held").length} resource(s) claimed: ${claims.filter((c) => c.state === "held").map((c) => c.resource).join(", ")}`] : []),
			...notes.map((n) => n.unread === "dir" ? `⚠ ${noteFiles.length} restart note(s) are here and ${join(p, ".comm", "restart")} could not be read`
				: n.unread === "ledger" ? `⚠ ${noteFiles.length} restart note(s) are here and bin/ledger.mjs could not be asked about them`
				: n.fresh ? `◷ restart note armed for ${n.agent} (${Math.round((n.age_s || 0) / 60)}m of ${Math.round((n.ttl_s || 0) / 60)}m)`
				: `⚠ the restart note for ${n.agent} has LAPSED - its next start will score COLD`),
		]
		// `pending` no longer reddens on its own: see the amendment above. What reddens is mail
		// that is STRANDED, or a bus that could not be asked and so cannot tell the two apart.
		const mailStuck = pending > 0 && (stranded.length > 0 || unaddressable.length > 0 || !busAnswered)
		row(`field:${name}`, drift || busStale !== false ? RED : mailStuck || lapsedNote || deadClaim ? WARN : OK, bits.join(" - "))
	}
}

// -- 5b. cross-project channels: is a peer waiting on me? --------------------
/**
 * `exchange/<peer>/in|out/` is a file exchange, NOT the bus - two projects have two
 * hubs, and joining them would be the off-board coordination the hub rule exists to
 * prevent. A channel is unanswered when the newest thing they wrote is newer than the
 * newest thing I wrote.
 *
 * Deliberately STATELESS: no watermark, no read receipt, nothing to mark as seen. A
 * notification that can be consumed can be consumed by accident - which is exactly how
 * this project lost mail twice (A13, A17) and how a full boot erased the hook's source
 * record earlier today. An unanswered message here stays visible at every boot until it
 * is answered, because answering is the only thing that changes the state.
 */
{
	const root = join(ROOT, "exchange")
	let peers = []
	try {
		peers = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
	} catch {}
	for (const peer of peers) {
		const newest = (dir) => {
			let best = 0, name = null
			try {
				for (const f of readdirSync(join(root, peer, dir))) {
					if (f.startsWith(".")) continue
					const m = statSync(join(root, peer, dir, f)).mtimeMs
					if (m > best) { best = m; name = f }
				}
			} catch {}
			return { at: best, name }
		}
		const inb = newest("in"), outb = newest("out")
		if (!inb.at && !outb.at) continue
		const waiting = inb.at > outb.at
		row(`channel:${peer}`, waiting ? WARN : OK,
			waiting
				? `UNANSWERED - ${inb.name} arrived ${age(Date.now() - inb.at)} ago`
				: `answered - last reply ${age(Date.now() - outb.at)} ago` + (inb.name ? `, to ${inb.name}` : ""))
	}
}

// -- 5c. did the previous session close? ------------------------------------
/**
 * The boot and the close are one loop, and this row is where they touch. A close writes
 * a marker; every session start writes another. If a start is newer than the last close,
 * the session before this one ended without one - so whatever it knew and did not write
 * down is gone, and this boot should not assume otherwise.
 *
 * It reports rather than blocks: a session may legitimately be killed, and a boot that
 * refuses to run because the last one crashed is a boot that gets bypassed.
 */
{
	let st = {}
	try { st = JSON.parse(readFileSync(join(ROOT, ".boot-state.json"), "utf8")) } catch {}
	const closedAt = st.lastClose && Date.parse(st.lastClose.at)
	const startedAt = st.lastStart && Date.parse(st.lastStart)
	if (!closedAt) row("close", WARN, "no session has ever closed here - the protocol is new or unused")
	else if (startedAt && startedAt > closedAt)
		row("close", WARN, `the previous session did NOT close (started ${age(Date.now() - startedAt)} ago, last close ${age(Date.now() - closedAt)} ago) - anything it held and did not write down is gone`)
	else row("close", OK, `last close ${age(Date.now() - closedAt)} ago at ${st.lastClose.head || "?"}`)
}

// -- 6. the gate - run it; never infer it from a fingerprint -----------------
{
	// The fingerprint covers every input the gate READS, not only the code it lives in.
	// Review #3 R1 moved one variable to prove the gap: renaming an anchor in FINDINGS.md
	// - which A27 reads - left the fingerprint byte-identical at 817a7c78e24a while the
	// gate went red. A fingerprint that misses a gate's inputs claims a green it cannot
	// support, which is the whole failure class this project keeps finding.
	//
	// Widened 2026-09-04, and the hole was three tools wide before anyone looked: the list
	// read `bin/comm.mjs, install.mjs, test/attack.mjs`, while A29 has been executing
	// bin/ledger.mjs and bin/session-registry.mjs through the generated stub since the day
	// it was written, A32 imports bin/wake.mjs, and A34 now runs the ledger's own 34 arms.
	// Any of those could be relaxed and every --fast boot would go on printing "last green
	// on these bytes" - review #3 R1's finding, re-earned by accretion rather than by a bad
	// commit. So the set is now ENUMERATED FROM THE DIRECTORY and the exceptions are named:
	// a tool added to bin/ tomorrow is a gate input by DEFAULT. An opt-in list is a promise
	// that whoever adds the next tool will remember this line, and that promise has been
	// broken here twice (see test/attack.mjs's POINTER_SOURCES for the same lesson).
	//
	// The two exclusions are the two files CLAUDE.md already declares are not the bus: they
	// spawn, the gate does not run them, and each carries its own --prove-red. Counting them
	// would redden this row every time the boot is edited - a warning that fires for a
	// reason foreign to what it measures, which is how a row gets ignored.
	const NOT_GATE_INPUTS = new Set(["boot.mjs", "context.mjs"])
	let gateCode = []
	// WHAT COULD NOT BE READ IS PART OF THE FINGERPRINT, and part of the row. Review #6 F8
	// and F9, both raised as "what I did not check" and both real:
	//
	//   F8 — a bare `catch {}` around the enumeration. A `bin/` that cannot be listed left
	//        `gateCode` EMPTY, silently narrowing the fingerprint to install.mjs +
	//        attack.mjs + docs, while the row went on saying "last green on these bytes".
	//        The bytes it meant were a third of the ones it named. Same class as R9, and it
	//        was mine, written in the commit that widened this set to close R1's hole.
	//   F9 — the per-file `catch {}`. "File deleted" and "file present but unreadable"
	//        hashed IDENTICALLY, so removing a gate input and locking one produced the same
	//        print, and the second is the state a broken permission actually leaves.
	//
	// Both are fixed the same way, and it is the way this file already fixed R9: an
	// unreadable input CHANGES the print (so the cached green cannot survive it) and is
	// NAMED (so nobody has to guess which). The error code goes into the hash, which is what
	// separates ENOENT from EACCES.
	let fpBlind = []
	try {
		gateCode = readdirSync(join(ROOT, "bin")).filter((f) => f.endsWith(".mjs") && !NOT_GATE_INPUTS.has(f))
			.sort().map((f) => `bin/${f}`)
	} catch (e) { fpBlind.push(`bin/ could not be listed (${(e && e.code) || "unreadable"})`) }
	const fp = createHash("sha256")
	if (fpBlind.length) fp.update(Buffer.from(`\0BLIND:${fpBlind.join("|")}\0`))
	for (const rel of [...gateCode, "install.mjs", "test/attack.mjs", ...gateDocs]) {
		try { fp.update(readFileSync(join(ROOT, rel))) }
		catch (e) {
			const code = (e && e.code) || "ERR"
			fp.update(Buffer.from(`\0UNREAD:${rel}:${code}\0`))
			// A gate input that is GONE is a different fact from one that is there and shut,
			// and only the second is a machine that needs attention. Both change the print;
			// only the second is worth a sentence.
			if (code !== "ENOENT") fpBlind.push(`${rel} (${code})`)
		}
	}
	const print = fp.digest("hex").slice(0, 12)
	const statePath = join(ROOT, ".boot-state.json")
	let prev = null
	try { prev = JSON.parse(readFileSync(statePath, "utf8")) } catch {}

	if (FAST) {
		// NEVER OK. Review #3 R1: this branch could render a genuinely red gate as a tick,
		// and --fast is the path the SessionStart hook runs, so it was the verdict on
		// ~100% of boots. "Last green an hour ago on the same bytes" is evidence about the
		// PAST; the row is read as a verdict about NOW, and the header's own rule 3 forbids
		// inferring one from the other. UNKNOWN is the honest ceiling for a gate not run.
		const same = prev && prev.print === print
		const fresh = prev && Date.now() - Date.parse(prev.at) < 864e5
		// A fingerprint taken over inputs this process could not read does not get to say
		// "these bytes". It says which ones it could not see, and it drops to WARN: the
		// comparison it just made is against a print computed the same blind way, so `same`
		// is true and means nothing.
		row("gate", fpBlind.length || !prev || !same || !fresh ? WARN : UNKNOWN,
			!prev ? "never recorded green - run `node bin/boot.mjs` before touching the bus"
				: `NOT RUN (--fast) - last green ${age(Date.now() - Date.parse(prev.at))} ago` +
				  (fpBlind.length ? ` - THE FINGERPRINT IS BLIND to ${fpBlind.join(", ")}, so "these bytes" names less than it sounds like`
					: same ? " on these bytes" : " on DIFFERENT bytes"))
	} else {
		const t0 = Date.now()
		const g = spawnSync("node", [join(ROOT, "test", "attack.mjs")], { encoding: "utf8" })
		const out = `${g.stdout || ""}${g.stderr || ""}`
		// F5 (review #5): `\s` matches a NEWLINE, so under /m the blank line before
		// test/attack.mjs's summary let `^\s+✓` swallow the banner itself - the row claimed
		// 31 where the suite ran 30, and that inflated number then propagated into CLAUDE.md
		// and into an adversarial brief. A counter that counts its own summary is the "two
		// lists that had to agree" family with a list and a counter. `[^\S\n]` is whitespace
		// that is not a line break.
		const pass = (out.match(/^[^\S\n]+✓/gm) || []).length
		const fails = out.split("\n").filter((l) => /^\s+✗/.test(l))
		const secs = ((Date.now() - t0) / 1000).toFixed(1)
		if (g.status === 0 && pass > 0) {
			// A green recorded over inputs that could not be read would be a cached green
			// covering less than the row claims, consulted by every --fast boot afterwards.
			if (fpBlind.length) row("gate", WARN, `attack ${pass}/${pass} in ${secs}s - but the fingerprint is BLIND to ${fpBlind.join(", ")}; this green is NOT being recorded`)
			else row("gate", OK, `attack ${pass}/${pass} in ${secs}s`)
			// MERGE. Review #3 R2: this wrote the object wholesale and erased `sources`,
			// `lastSource` and `lastSourceAt` - the record that exists to answer whether
			// /clear reports source "clear", which decides if the reboot loop is buildable.
			// CLAUDE.md tells every session to run a full boot, so the wipe happened through
			// documented use, and the file is gitignored so there was no recovery.
			// MERGED INTO THE BYTES ON DISK, not into `prev` - `prev` was read before the gate
			// ran and is up to 26 s old by now (review #7 F2, above).
			if (!fpBlind.length) updateState((d) => ({ ...d, print, at: new Date().toISOString(), head: git("rev-parse", "--short", "HEAD"), pass }))
		} else {
			// The single inference this tool may draw - and it never suppresses a run.
			const unchanged = prev && prev.print === print
			row("gate", RED,
				`attack: ${fails.length} FAILED, ${pass} passed in ${secs}s` +
				(unchanged ? " - CODE UNCHANGED since last green: the world moved, not the test (FINDINGS.md#A20)" : ""))
			for (const f of fails.slice(0, 4)) row("", RED, f.trim().replace(/\s+/g, " ").slice(0, 150))
		}
	}
}

// -- the close ---------------------------------------------------------------
/**
 * The close protocol, and it is deliberately not a checklist.
 *
 * A checklist is satisfied by feeling satisfied. This one is satisfied by the BOOT: a
 * session is closed when a full boot - gate included - reports nothing that is not
 * either fixed or NAMED. That makes the two protocols one loop with a single source of
 * truth, and it means the close cannot drift away from what the boot measures, because
 * it has no criteria of its own.
 *
 * Three rules follow:
 *
 * 1. NO SILENT PASS. A non-green row is either resolved or acknowledged by name with a
 *    reason (`--ack <row>=<why>`). There is no flag that waves everything through.
 *
 * 2. ACKNOWLEDGEMENTS ARE COUNTED, NOT JUST RECORDED. From the owner's own standard: "a
 *    guard that is defensible every time it is bypassed is already failing - count the
 *    bypasses, not their justifications; the RATE is the signal." A row waved past
 *    repeatedly is a row that is not doing its job, and this is where a protocol
 *    amendment gets its evidence instead of its opinion.
 *
 * 3. THE CLOSE WRITES A MARKER AND EVERY SESSION START WRITES ANOTHER, so the next boot
 *    can say whether the last session ended properly. That is the only state the two
 *    protocols share, and it is one timestamp each.
 */
let closeReport = ""
let closeFailed = false
if (CLOSE) {
	const EROSION = 3
	let st = {}
	try { st = JSON.parse(readFileSync(join(ROOT, ".boot-state.json"), "utf8")) } catch {}

	// The `close` row describes the state BEFORE this run, and this run is what changes
	// it - so it reports, it does not block. Blocking on it would make every first close
	// require an acknowledgement for the condition it exists to remove, and would inflate
	// the erosion count of a row that was never the problem.
	// A close that does not carry the next move forces the next session to re-derive it -
	// which is the boot cost this whole project has been fighting, paid in judgment
	// instead of tokens. The section is written BY ME in STATUS.md, never by this tool:
	// a mechanism that authors the handoff is a plausible answer standing where a real
	// one should be, and it is the one thing I promised the other project's leader I
	// would not build.
	const statusPath = join(ROOT, "STATUS.md")
	let statusTouched = false
	try {
		const stc = st.lastClose && Date.parse(st.lastClose.at)
		statusTouched = !stc || statSync(statusPath).mtimeMs > stc
	} catch {}
	if (!nextText) {
		closeFailed = true
		closeReport = "\n  ✗ NOT CLOSED - STATUS.md carries no `## ▶ NEXT` section.\n" +
			"    Write what the next session must do FIRST, in enough detail that a session with no\n" +
			"    memory of this one can act on it without re-deriving anything.\n"
	} else if (!statusTouched) {
		closeFailed = true
		closeReport = "\n  ✗ NOT CLOSED - STATUS.md has not been touched since the last close.\n" +
			"    Either this session changed nothing, or the record does not reflect what it changed.\n"
	}

	const open = rows.filter((r) => r.label && r.label !== "close" && r.level !== OK)
	const unacked = open.filter((r) => !ACKS.has(r.label))
	const lines = []

	if (closeFailed) { /* the NEXT check already failed the close */ }
	else if (unacked.length) {
		closeFailed = true
		lines.push("  ✗ NOT CLOSED - these rows are neither fixed nor named:")
		for (const r of unacked) lines.push(`      ${r.label}  ${r.text.slice(0, 96)}`)
		lines.push("")
		lines.push("    Fix them, or name each one:  node bin/boot.mjs --close \\")
		lines.push(`      ${unacked.map((r) => `--ack ${r.label}="why this is acceptable"`).join(" \\\n      ")}`)
	} else {
		for (const r of open) lines.push(`  · acknowledged  ${r.label}: ${ACKS.get(r.label)}`)
		const head = git("rev-parse", "--short", "HEAD")
		const at = new Date().toISOString()
		// COUNTED AGAINST THE BYTES ON DISK, not against the snapshot `st` read at the top of
		// this block: review #7 F2. What the report prints is what was actually written.
		let written = {}
		const recorded = updateState((d) => {
			const c = { ...(d.ackCounts || {}) }
			for (const r of open) c[r.label] = (c[r.label] || 0) + 1
			// THE DISCHARGE (review #7 F10). An amendment zeroes the row it amended and says
			// so in the file; anything else would leave the instruction unfollowable.
			const hist = Array.isArray(d.amendments) ? [...d.amendments] : []
			for (const [label, why] of AMENDED) {
				hist.push({ row: label, why, at, head, from: c[label] || 0 })
				delete c[label]
			}
			written = c
			d.ackCounts = c
			if (hist.length) d.amendments = hist
			d.lastClose = { at, head, acked: [...ACKS.keys()], amended: [...AMENDED.keys()] }
			return d
		})
		if (!recorded) {
			closeFailed = true
			lines.length = 0
			lines.push("  ✗ NOT CLOSED - .boot-state.json could not be written.")
			lines.push("    The acknowledgements and the close timestamp did not land, so the next boot would")
			lines.push("    inherit no record of this close at all. Fix the file, then close again.")
		} else {
		for (const [label, why] of AMENDED)
			lines.push(`  ⟳ amended       ${label}: ${why} - its erosion count is cleared and the amendment is recorded`)
		// Amendment evidence. Not a suggestion to think about it - a count.
		//
		// 🔴 ONLY FOR ROWS THIS BOOT ACTUALLY PRODUCED. It read the all-time map, so a row
		// that had been amended and DELETED went on demanding an amendment at every close,
		// forever, in the loudest line of the report - an instruction nobody could discharge,
		// about a guard that no longer existed (review #7 F10). A row that cannot be
		// acknowledged again cannot be eroding.
		const alive = new Set(rows.map((r) => r.label))
		const eroding = Object.entries(written).filter(([label, n]) => n >= EROSION && alive.has(label))
		const stale = Object.keys(written).filter((label) => !alive.has(label) && written[label] >= EROSION)
		if (eroding.length) {
			lines.push("")
			lines.push("  🔴 AMEND THE PROTOCOL - these rows are being waved past, not acted on:")
			for (const [label, n] of eroding) {
				lines.push(`      ${label} acknowledged ${n}x. A row that is defensible every time it is bypassed is`)
				lines.push(`      already failing. Change what it measures, or delete it. Raising nothing is not a fix.`)
				lines.push(`      When you have: node bin/boot.mjs --close --amended ${label}="what it measures now"`)
			}
		}
		if (stale.length) lines.push(`  · ${stale.length} count(s) held for row(s) this boot does not produce (${stale.join(", ")}) - kept as history, not demanded`)
		lines.push("")
		lines.push(`  ✓ CLOSED at ${head} - the next boot inherits a tree whose every row is green or named.`)
		}
	}
	if (!closeReport) closeReport = "\n" + lines.join("\n") + "\n"
}

// -- render -----------------------------------------------------------------
if (JSONOUT) {
	console.log(JSON.stringify({ worst, rows }, null, 2))
	process.exit(worst === RED ? 1 : 0)
}
const pad = Math.max(...rows.map((r) => r.label.length))
const open = statusText.split(/^## /m).find((x) => /OPEN/.test(x.slice(0, 12)))

// Assembled once and printed once, so the recorded size IS the emitted size. Printing in
// stages and summing the parts undercounted by the newline console.log adds per call -
// small, but a budget row that under-reports its own subject fails in the one direction
// that matters.
const report =
	`\nclaude-comm boot - ${new Date().toISOString().slice(0, 10)} - ${ROOT}\n\n` +
	// The headline only. The full section is in STATUS.md, which is tier 0 and read
	// anyway - printing all of it here would put the boot's own cost back where this
	// session spent the morning removing it.
	(nextText
		? `  ▶ NEXT, from the last close:\n` +
		  nextText.split("\n\n")[0].split("\n").map((l) => "    " + l.replace(/\*\*/g, "")).join("\n") +
		  `\n    (full section: STATUS.md ## NEXT)\n\n`
		: "") +
	rows.map((r) => `  ${r.label ? MARK[r.level] : " "} ${r.label.padEnd(pad)}  ${r.text}`).join("\n") + "\n" +
	(open
		? "\n  open (STATUS.md's claim - verify before acting):\n" +
		  [...open.matchAll(/^(\d+)\.\s+\*\*(.+?)\*\*/gm)]
			  .map((m) => `    ${m[1]}. ${m[2].replace(/`/g, "").slice(0, 96)}`).join("\n") + "\n"
		: "") +
	"\n  not run here: test/selftest.mjs - it spawns real `claude -p` sessions (minutes), and its" +
	"\n  BEHAVIOUR half is reported, never gated. Run it before changing delivery.\n" + closeReport

process.stdout.write(report)

// What this report costs the session it is injected into (R10).
if (FAST) {
	const bytes = Buffer.byteLength(report)
	updateState((d) => ({ ...d, reportBytes: bytes }))
}
process.exit(closeFailed || worst === RED ? 1 : 0)

// -- the negative control ---------------------------------------------------
/**
 * Every row above is an assertion about the world, and this project's own history is
 * blunt about what an unfalsifiable one is worth: A10 spent a session asserting a
 * property true for every reachable value, and `to_agent` "looked like an audit field
 * and could not fail - and I was its first victim". So each row is DEMONSTRATED to
 * redden here, with exactly one variable moved against a fixture that is otherwise
 * byte-identical, and the boot script itself never touched.
 *
 * Each arm re-measures its own control immediately before arming, rather than reusing
 * one baseline: a control taken through different code than the arm validates nothing.
 *
 * `session` is deliberately absent. It reports what /proc says and has no pass/fail
 * semantics; it is labelled informational rather than dressed up as a gate.
 */
function proveRed() {
	const SELFFILE = fileURLToPath(import.meta.url)
	const tmp = mkdtempSync(join(tmpdir(), "comm-boot-prove-"))
	process.on("exit", () => { try { rmSync(tmp, { recursive: true, force: true }) } catch {} })
	const pkg = join(tmp, "pkg"), proj = join(tmp, "proj")
	// EVERY child inherits this, and it must be set before the first one is spawned.
	// Found by reading a real boot report minutes after the registry shipped: the ledger
	// arms run the real boot with --hook, that child's ancestor walk reaches the REAL
	// session running the control, and so the control wrote its own fixture transcript
	// into the machine's live registry under the operator's own pid. The next boot then
	// reported `pid <me> -> 44444444-....jsonl` with a green tick. A control that writes
	// into the world it measures is not a control - this repo has the same lesson written
	// down twice already (STATUS.md, the two measurement traps).
	// G6 (review #5): this suite had the belt and no braces - the override was set, and
	// nothing in the repo would have said if it stopped being. Its arms run the real
	// `boot --hook`, whose ancestor walk reaches the operator's own session, so it is the
	// suite with the most to lose. Same assertion as A31, contents-hashed for the same
	// reason (a delete and an overwrite are different shapes and only one changes a name).
	const REAL_REG = join(process.env.CLAUDE_COMM_RUNTIME || process.env.XDG_RUNTIME_DIR
		|| `/tmp/claude-comm-${process.getuid?.() ?? "nouid"}`, "claude-comm", "sessions")
	const snapReal = () => {
		try {
			return readdirSync(REAL_REG).sort()
				.map((f) => `${f}:${createHash("sha256").update(readFileSync(join(REAL_REG, f))).digest("hex").slice(0, 12)}`).join(",")
		} catch { return "<none>" }
	}
	const realBefore = snapReal()
	process.env.CLAUDE_COMM_RUNTIME = join(tmp, "runtime")

	mkdirSync(pkg)
	for (const e of ["bin", "install.mjs", "test", "CLAUDE.md", "README.md", "FINDINGS.md", "STATUS.md", "HISTORY.md", "DESIGN-autonomy.md"]) {
		if (existsSync(join(SELF, e))) cpSync(join(SELF, e), join(pkg, e), { recursive: true })
	}
	const g = (...a) => execFileSync("git", a, { cwd: pkg, stdio: "ignore" })
	g("init", "-q")
	g("config", "user.email", "boot@fixture"); g("config", "user.name", "boot")
	g("add", "-A"); g("commit", "-qm", "fixture")
	// The fixture gets a real upstream. Without one the tree row sits at warn ("no
	// upstream") before any arm fires, so the uncommitted-work arm would move a row
	// that was already yellow and prove nothing - which is exactly what the first run
	// of this control reported. A control must start where the real repo starts.
	execFileSync("git", ["init", "-q", "--bare", join(tmp, "origin.git")], { stdio: "ignore" })
	g("remote", "add", "origin", join(tmp, "origin.git"))
	g("push", "-q", "-u", "origin", "HEAD")
	const baseSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: pkg, encoding: "utf8" }).trim()

	mkdirSync(join(proj, "app", "docs"), { recursive: true })
	mkdirSync(join(proj, ".comm", "inbox"), { recursive: true })
	writeFileSync(join(proj, ".comm", "config.json"), JSON.stringify({ leader: "leader", agents: { leader: ".", app: "app" } }))
	writeFileSync(join(proj, "COORDINATION.md"), "# coordination\n")
	execFileSync("node", [join(pkg, "install.mjs"), proj], { stdio: "ignore" })

	const run = (fast = true) => {
		const a = [SELFFILE, "--json", "--root", pkg, "--field", tmp]
		if (fast) a.push("--fast")
		const r = spawnSync(process.execPath, a, { encoding: "utf8" })
		try { return JSON.parse(r.stdout) } catch { return { worst: -1, rows: [] } }
	}
	const level = (res, label) => { const r = res.rows.find((x) => x.label === label); return r ? r.level : -1 }
	const LV = { "-1": "absent", 0: "ok", 1: "unknown", 2: "warn", 3: "RED" }

	let failed = 0
	const assert = (name, pass, detail) => {
		if (!pass) failed++
		console.log(`  ${pass ? "✓" : "✗"} ${name.padEnd(34)} ${detail}`)
	}
	const arm = (name, label, want, apply, revert, fast = true) => {
		const before = level(run(fast), label)
		apply()
		const after = level(run(fast), label)
		revert()
		const pass = before < want && after === want
		if (!pass) failed++
		console.log(`  ${pass ? "✓" : "✗"} ${name.padEnd(34)} control=${LV[before]} -> armed=${LV[after]} (want ${LV[want]})`)
	}

	const swap = (p, fn) => {
		const orig = readFileSync(p, "utf8")
		return [() => writeFileSync(p, fn(orig)), () => writeFileSync(p, orig)]
	}

	console.log("\nboot negative control - one variable per arm, boot.mjs itself untouched\n")

	const [rmFindings, addFindings] = [() => g("rm", "--cached", "-q", "FINDINGS.md"), () => g("add", "FINDINGS.md")]
	arm("archive: a gated doc left untracked", "archive", RED, rmFindings, addFindings)

	const hook = join(proj, "app", ".claude", "comm-hook.mjs")
	arm("field: an agent's hook drifts", "field:proj", RED, ...swap(hook, (s) => `${s}\n// drift\n`))

	const fieldBus = join(proj, ".comm", "bin", "comm.mjs")
	arm("field: the installed bus goes stale", "field:proj", RED, ...swap(fieldBus, (s) => `${s}\n// stale\n`))

	// The same arm on an INSTRUMENT rather than the bus. It is not decoration: until
	// 2026-09-04 this row compared `comm.mjs` alone, so a stale session registry beside
	// a current bus was invisible - and a stale registry is a context sensor answering
	// for the wrong session, which is the defect the registry was built to remove.
	const fieldReg = join(proj, ".comm", "bin", "session-registry.mjs")
	arm("field: an installed INSTRUMENT goes stale", "field:proj", RED, ...swap(fieldReg, (s) => `${s}\n// stale\n`))

	// F3 — the DRIFT list must name what drifted, and NOTHING ELSE.
	//
	// Review #6: this row took "any line indented four spaces, on either stream" from
	// `install --check` to be a drifted filename. The git-tracking warning shipped in the
	// same commit prints its file list, its "… and N more" line and its fix command at that
	// indent, so the row reported nine names for one drifted file and rendered
	// `git rm -r --cached .comm/ && echo '.comm/' >> .gitignore` as a filename.
	//
	// The arm above ("an agent's hook drifts") could not see any of it: it compares LEVELS,
	// and the level was correctly RED the whole time. What was wrong was the SENTENCE. So
	// this asserts the text, and it stages the two conditions TOGETHER - one real drift, and
	// the confusable prose present - because either alone is a fixture that cannot fail.
	//
	// The POSITIVE CONTROL is the second half: it re-runs the installer directly and requires
	// the confusable prose to actually be on stderr. Without it, a fixture that quietly
	// stopped producing the warning would leave this arm green forever while asserting
	// nothing - the void-probe shape this project keeps finding in its own tests.
	{
		const pg = (...a) => execFileSync("git", a, { cwd: proj, stdio: "ignore" })
		pg("init", "-q"); pg("config", "user.email", "f@f"); pg("config", "user.name", "f")
		pg("add", "-A", "-f"); pg("commit", "-qm", "live state committed on purpose")
		const driftedHook = join(proj, "app", ".claude", "comm-hook.mjs")
		const origHook = readFileSync(driftedHook, "utf8")
		writeFileSync(driftedHook, `${origHook}\n// drift\n`)

		const chk = spawnSync(process.execPath, [join(pkg, "install.mjs"), proj, "--check"], { encoding: "utf8" })
		const proseIsThere = /LIVE BUS STATE are committed/.test(chk.stderr || "") && / {4}\.comm\//.test(chk.stderr || "")

		const rowText = (() => { const r = run(true).rows.find((x) => x.label === "field:proj"); return r ? r.text : "" })()
		// The row joins its bits with " - ", and a FILENAME contains hyphens: the first cut of
		// this arm split on `[^-]*` and read `comm-hook.mjs` as `comm`, then reported the
		// truncation as a failure of the code it was testing. Split on the separator, never
		// on the character it is made of.
		const list = /DRIFT: (.*?)(?: - |$)/.exec(rowText)
		const named = list ? list[1].trim().split(",").map((x) => x.trim()).filter(Boolean) : []
		const onlyTheHook = named.length === 1 && /comm-hook\.mjs$/.test(named[0])
		const noProse = !/git rm/.test(rowText) && !/config\.json/.test(rowText) && !/… and/.test(rowText)

		writeFileSync(driftedHook, origHook)
		rmSync(join(proj, ".git"), { recursive: true, force: true })

		if (!(onlyTheHook && noProse && proseIsThere)) failed++
		console.log(`  ${onlyTheHook && noProse && proseIsThere ? "✓" : "✗"} ${"field: DRIFT names only what drifted".padEnd(34)} ` +
			`one drifted hook + committed .comm -> DRIFT named ${JSON.stringify(named)}; ` +
			`prose leaked=${noProse ? "no" : "YES"}; installer really printed the confusable warning=${proseIsThere ? "yes (control armed)" : "NO - THIS ARM PROVED NOTHING"}`)
	}

	// TWO SESSIONS ON ONE INBOX. `comm who` has warned about this since A17; THIS row said
	// "hooks in sync - 0 pending" about the identical state, so the one condition that loses
	// mail was invisible in the report a leader reads about other people's projects.
	//
	// ONE VARIABLE: a second live session in the same agent directory. Two `sh` processes
	// named `claude` - the fixture idiom this suite already uses, with two commands in the
	// -c string so the shell cannot exec-optimise its argv[0] away and take the name with it.
	{
		const fakeC = join(proj, "claude")
		try { symlinkSync("/bin/sh", fakeC) } catch {}
		let kids = []
		arm("field: two sessions on one inbox", "field:proj", WARN,
			() => {
				for (let i = 0; i < 2; i++) kids.push(spawn(fakeC, ["-c", "sleep 30; :"], { cwd: proj, stdio: "ignore" }))
				// /proc has to have caught up before the row is computed, or this arm measures
				// the scheduler. Bounded, and it CHECKS rather than sleeping blind.
				const t0 = Date.now()
				while (Date.now() - t0 < 4000) {
					let seen = 0
					for (const k of kids) { try { if (existsSync(`/proc/${k.pid}`)) seen++ } catch {} }
					if (seen === kids.length) break
				}
			},
			() => { for (const k of kids) { try { k.kill("SIGKILL") } catch {} } kids = [] })
	}

	const msg = join(proj, ".comm", "inbox", "app", "0001-x.json")
	arm("field: mail STRANDED on an agent that is not running", "field:proj", WARN,
		() => writeFileSync(msg, JSON.stringify({ id: "0001-x", to: "app" })),
		() => rmSync(msg, { force: true }))

	// THE OTHER DIRECTION, and it is the amendment's whole point. This row used to redden on
	// ANY pending mail, and `field:work` was acknowledged THREE times in one day with the
	// same sentence - their leader wrote to their `db`, `db` is running, it drains at its
	// next turn. CLAUDE.md: a guard defensible every time it is bypassed is already failing,
	// and the rate is the signal. So mail IN FLIGHT to a live agent must leave the row green,
	// and only the arm above may redden it.
	//
	// ONE VARIABLE against that arm: the same message, the same inbox, and a live session in
	// the recipient's directory. Without this half the amendment could be reverted and every
	// gate would stay green.
	{
		const fakeD = join(proj, "claude")
		try { symlinkSync("/bin/sh", fakeD) } catch {}
		let kid = null
		const settle = () => { const t0 = Date.now(); while (Date.now() - t0 < 4000) { try { if (kid && existsSync(`/proc/${kid.pid}`)) break } catch {} } }
		writeFileSync(msg, JSON.stringify({ id: "0001-x", to: "app" }))
		kid = spawn(fakeD, ["-c", "sleep 30; :"], { cwd: join(proj, "app"), stdio: "ignore" })
		settle()
		const withLive = level(run(true), "field:proj")
		try { kid.kill("SIGKILL") } catch {}
		// The recipient is gone again: the SAME pending message must now redden, which is what
		// proves the green above came from the session and not from the row going quiet.
		const t0 = Date.now(); while (Date.now() - t0 < 2000) { if (!existsSync(`/proc/${kid.pid}`)) break }
		const withoutLive = level(run(true), "field:proj")
		rmSync(msg, { force: true })
		assert("field: mail in flight to a RUNNING agent does not redden the row",
			withLive === OK && withoutLive === WARN,
			`same message, recipient live -> ${LV[withLive]} (must stay ok); recipient gone -> ${LV[withoutLive]} (must warn)`)
	}

	const scratch = join(pkg, "uncommitted.txt")
	arm("tree: work left uncommitted", "tree", WARN,
		() => writeFileSync(scratch, "x\n"), () => rmSync(scratch, { force: true }))

	arm("tree: a commit never pushed", "tree", WARN,
		() => { writeFileSync(scratch, "x\n"); g("add", "-A"); g("commit", "-qm", "unpushed") },
		() => { g("reset", "-q", "--hard", baseSha); rmSync(scratch, { force: true }) })

	const claudeMd = join(pkg, "CLAUDE.md")
	arm("budget: tier 0 outgrows its cap", "budget", RED,
		...swap(claudeMd, (s) => s + "\n" + "x".repeat(30_000)))
	arm("budget: the tier-0 marker goes missing", "budget", WARN,
		...swap(claudeMd, (s) => s.replace(/<!--\s*boot-tier0:[^>]*-->/, "")))

	const chIn = join(pkg, "exchange", "peer", "in"), chOut = join(pkg, "exchange", "peer", "out")
	mkdirSync(chIn, { recursive: true }); mkdirSync(chOut, { recursive: true })
	writeFileSync(join(chOut, "answer.md"), "answered\n")
	arm("channel: a peer message goes unanswered", "channel:peer", WARN,
		() => writeFileSync(join(chIn, "question.md"), "asked\n"),
		() => rmSync(join(chIn, "question.md"), { force: true }))

	// A note that LAPSES costs the experiment its scarcest event - a real restart - and it
	// does so silently: the record that follows looks like an ordinary cold start. The row
	// is armed on the state that actually goes wrong, not on the presence of a note, so a
	// fresh one must leave the row green and only an expired one may redden it.
	const noteDir = join(pkg, ".comm", "restart")
	const notePath = join(noteDir, "leader.json")
	arm("ledger: a restart note left to lapse", "ledger", WARN,
		() => {
			mkdirSync(noteDir, { recursive: true })
			writeFileSync(notePath, JSON.stringify({ v: 1, at: new Date(Date.now() - 3600_000).toISOString(),
				agent: "leader", prev_session: "p", ttl_s: 900, by: "prove-red", by_pid: 1 }) + "\n")
		},
		() => rmSync(notePath, { force: true }))
	// The positive control for the arm above: the SAME note, inside its promise, must not
	// redden anything. Without this the row would pass by reddening on any note at all.
	{
		mkdirSync(noteDir, { recursive: true })
		writeFileSync(notePath, JSON.stringify({ v: 1, at: new Date().toISOString(),
			agent: "leader", prev_session: "p", ttl_s: 900, by: "prove-red", by_pid: 1 }) + "\n")
		const lv = level(run(true), "ledger")
		rmSync(notePath, { force: true })
		assert("ledger: a note inside its promise does NOT redden the row", lv === OK,
			`a note 0s old of a 900s promise -> ${LV[lv]} (must stay ok)`)
	}

	const busFile = join(pkg, "bin", "comm.mjs")
	const stamp = statSync(busFile)
	arm("status: the code outruns STATUS.md", "status", WARN,
		() => utimesSync(busFile, new Date(), new Date(Date.now() + 36e5)),
		() => utimesSync(busFile, stamp.atime, stamp.mtime))

	// The bus defect is restored in the FIXTURE while the gate stays byte-identical,
	// and the CONSTANT is left alone: raising MAX_NOTE would move the detector as well
	// as the input, which proves a gate can be broken, not that it can detect.
	arm("gate: a real bus defect (note cap)", "gate", RED,
		...swap(busFile, (s) => s.replace(/return flat\.length > MAX_NOTE[^\n]*/, "return flat")), false)

	// ---- properties review #3 showed the harness could not see ----------------
	// R1: --fast is the path every session runs, and it could render a red gate as a tick.
	// The property is not "it reddens" but "it can NEVER say OK", so it is asserted, not armed.
	{
		run(false)   // record a green on a correct tree
		const fastLevel = level(run(true), "gate")
		assert("R1 the --fast gate row is never OK", fastLevel !== OK,
			`clean tree, fresh green, same bytes -> ${LV[fastLevel]} (must not be ok)`)
		const [breakDoc, fixDoc] = swap(join(pkg, "FINDINGS.md"), (t) => t.replace(/^## `#A17`/m, "## `#A17-renamed`"))
		breakDoc()
		const after = level(run(true), "gate")
		const full = level(run(false), "gate")
		fixDoc()
		assert("R1 a gate INPUT changing moves --fast", after === WARN && full === RED,
			`one anchor renamed in FINDINGS.md -> fast=${LV[after]} full=${LV[full]}`)
	}

	// F8/F9 — an input the fingerprint COULD NOT READ is not the same as one that did not
	// change. Review #6, both raised as "what I did not check", both mine:
	//
	//   F8 — a bare `catch {}` around the `bin/` enumeration silently narrowed the print to
	//        install.mjs + attack.mjs + docs, while --fast went on saying "on these bytes".
	//   F9 — the per-file `catch {}` hashed "deleted" and "present but locked" identically.
	//
	// R1 above cannot see either: it moves a gate input's CONTENT, and both of these are
	// about inputs that could not be read at all. One variable each, against a green
	// recorded over the same tree moments earlier, and the row is restored at the end as the
	// POSITIVE CONTROL — if the claim does not come back after chmod, something other than
	// the permission moved it and neither reading means anything.
	{
		run(false)   // a green recorded over inputs this process could read
		const gateRow = () => { const r = run(true).rows.find((x) => x.label === "gate"); return r || { level: -1, text: "" } }
		const control = gateRow()
		const binDirF = join(pkg, "bin"), oneInput = join(pkg, "test", "attack.mjs")
		spawnSync("chmod", ["000", binDirF])
		const blindDir = gateRow()
		spawnSync("chmod", ["755", binDirF])
		spawnSync("chmod", ["000", oneInput])
		const blindFile = gateRow()
		spawnSync("chmod", ["644", oneInput])
		const restored = gateRow()

		const claims = (r) => / on these bytes/.test(r.text)
		const pass = claims(control) && claims(restored) &&
			blindDir.level === WARN && /BLIND to bin\//.test(blindDir.text) &&
			blindFile.level === WARN && /BLIND to test\/attack\.mjs/.test(blindFile.text)
		assert("F8/F9 an unreadable gate input is never counted as unchanged bytes", pass,
			`readable -> ${LV[control.level]} ${claims(control) ? '"on these bytes"' : "NO CLAIM (fixture never armed - root ignores chmod?)"}; ` +
			`bin/ unlistable -> ${LV[blindDir.level]} ${/BLIND to bin\//.test(blindDir.text) ? "names bin/" : "SILENT"}; ` +
			`one input locked -> ${LV[blindFile.level]} ${/BLIND to test\/attack\.mjs/.test(blindFile.text) ? "names the file" : "SILENT"}; ` +
			`permissions restored -> ${claims(restored) ? '"on these bytes" again (control)' : "STILL MOVED - something else did this"}`)
	}

	// R11, 2026-09-04. R1 above proves a gate's DOCUMENT is covered. Its CODE was not: the
	// print was taken over the bus, the installer and the gate file only, while the suite
	// has been executing bin/ledger.mjs and bin/session-registry.mjs through the generated
	// stub since A29 was written, and now runs the ledger's own 34 arms in A34. A relaxed
	// classification rule in the instrument the reboot experiment is SCORED FROM would have
	// left this print byte-identical, and every --fast boot - which is ~100 % of boots -
	// would have gone on saying "last green on these bytes". One variable: one byte in a
	// tool the gate runs and never reads as a document.
	{
		run(false)   // re-record a green on the restored tree
		const quiet = level(run(true), "gate")
		const [breakTool, fixTool] = swap(join(pkg, "bin", "ledger.mjs"), (t) => `${t}\n// one byte the gate runs\n`)
		breakTool()
		const moved = level(run(true), "gate")
		fixTool()
		assert("R11 a TOOL the gate runs is a gate input", quiet === UNKNOWN && moved === WARN,
			`same bytes -> ${LV[quiet]} ("on these bytes"); one byte in bin/ledger.mjs -> ${LV[moved]} ("DIFFERENT bytes")`)
	}

	// R2: a full boot used to overwrite the hook's source record wholesale.
	{
		const sp = join(pkg, ".boot-state.json")
		let st = {}
		try { st = JSON.parse(readFileSync(sp, "utf8")) } catch {}
		st.sources = { clear: 7 }; st.lastSource = "clear"
		writeFileSync(sp, JSON.stringify(st, null, 2))
		run(false)
		let after = {}
		try { after = JSON.parse(readFileSync(sp, "utf8")) } catch {}
		assert("R2 a full boot preserves the source record",
			after.sources && after.sources.clear === 7 && after.lastSource === "clear",
			`sources=${JSON.stringify(after.sources)} lastSource=${JSON.stringify(after.lastSource)}`)
	}

	arm("R4 an undeclared gate dependency", "archive", WARN,
		...swap(join(pkg, "test", "attack.mjs"), (t) => t.replace(/\/\/ gate-docs:.*/, "// gate-docs:") + '\nconst x = readFileSync(join(PKG, "STATUS.md"))\n'))

	// R4's OTHER DIRECTION, and it is the one that actually fired. A document named in a path
	// rooted at a FIXTURE is not a dependency on this repo's copy of it: A36 generates a
	// notice at `<throwaway>/.comm/README.md` and reads it back, and this row announced an
	// undeclared dependency on THIS repo's README.md — naming a document the gate never
	// opens, in the row whose job is to say which documents the gate opens.
	//
	// It flipped on 2026-09-05 on a commit that touched no document at all, because the
	// stripping ran over the CONCATENATION of test/*.mjs and the `/*` markers in those files
	// do not balance (they appear inside strings and regexes), so an edit anywhere moved
	// which text survived. Both halves are fixed above; without this arm only the half that
	// likes noise is held, and the narrowing could be reverted with every gate still green.
	{
		const [addFixtureRef, undo] = swap(join(pkg, "test", "attack.mjs"),
			(t) => t + '\nconst y = readFileSync(join(someFixtureRoot, ".comm", "README.md"))\n')
		addFixtureRef()
		const lv = level(run(true), "archive")
		undo()
		assert("R4b a document named in a FIXTURE path is not a dependency", lv === OK,
			`a read of <fixture>/.comm/README.md added to the suite -> ${LV[lv]} (must stay ok; ` +
			`the R4 arm above proves a PKG-rooted one still reddens it)`)
	}

	arm("R9 this repo's own bus unreadable", "field:proj", RED,
		...swap(join(pkg, "bin", "comm.mjs"), () => ""))

	// ---- the ledger row: an instrument that cannot be seen to fail is not one ----
	// The reboot ledger's whole value is that "no reboots recorded" must never be
	// producible by a broken tool, because it is indistinguishable from "no reboots
	// happened" - the shape `prove-the-probe` is named after.
	{
		const led = join(pkg, "bin", "ledger.mjs")
		arm("ledger: the instrument goes silent", "ledger", UNKNOWN,
			...swap(led, () => "syntax error ((( \n"))

		const log = join(pkg, ".comm", "handoff", "leader.log")
		arm("ledger: a line it cannot read", "ledger", WARN,
			() => { mkdirSync(dirname(log), { recursive: true }); writeFileSync(log, "{torn\n") },
			() => rmSync(log, { force: true }))

		// And the write half, which no `arm` can reach: only a --hook run records.
		const payloadIn = JSON.stringify({ source: "startup", transcript_path: "/x/11111111-2222-3333-4444-555555555555.jsonl" })
		const hookRun = spawnSync(process.execPath, [SELFFILE, "--json", "--fast", "--hook", "--root", pkg, "--field", tmp],
			{ encoding: "utf8", input: payloadIn })
		let recorded = ""
		try { recorded = readFileSync(join(pkg, ".comm", "handoff", "unnamed.log"), "utf8") } catch {}
		assert("ledger: a session start is recorded", /"event":"start"/.test(recorded) && /555555555555/.test(recorded),
			`one --hook boot -> ${recorded.split("\n").filter(Boolean).length} record(s), session id carried=${/555555555555/.test(recorded)}`)
		// The row must SAY it recorded, so a silent writer cannot hide behind a green row.
		let hookRows = []
		try { hookRows = JSON.parse(hookRun.stdout).rows } catch {}
		const lr = hookRows.find((r) => r.label === "ledger")
		assert("ledger: the row states the write happened", !!lr && /this start recorded/.test(lr.text),
			`row: ${lr ? lr.text.slice(0, 60) : "absent"}`)

		// F2 — THE SIGNAL HAS TO CROSS **HERE**, not only through the generated stub.
		//
		// Review #6: `bin/boot.mjs --hook` is this repository's ONLY recorder - it has no
		// stub, because it is not a field project - and it did not claim. So the mechanism
		// was inert in the project that owns it: a note could be armed, the ledger row would
		// print `◷ a restart note is armed`, and the SAME row would file the start as COLD
		// in the same sentence. STATUS.md's own ▶ NEXT instructed the next session to arm one
		// here and restart, which could never have worked.
		//
		// The two asserts above cannot notice, and that is the point worth keeping: they fire
		// the hook with NOTHING ARMED, so they are the control for this arm rather than a
		// test of it. A33 covers the same crossing through the stub, in a field fixture; this
		// covers the path this repo actually runs, and the two failed independently once.
		const rsHere = join(pkg, "bin", "restart-signal.mjs")
		const noteHere = join(pkg, ".comm", "restart", "unnamed.json")
		spawnSync(process.execPath, [rsHere, "arm", "--agent", "unnamed", "--root", pkg, "--quiet",
			"--prev-session", "PREV-BOOT-HOOK", "--ttl", "900", "--by", "prove-red"], { encoding: "utf8" })
		const armedHere = existsSync(noteHere)
		spawnSync(process.execPath, [SELFFILE, "--json", "--fast", "--hook", "--root", pkg, "--field", tmp],
			{ encoding: "utf8", input: JSON.stringify({ source: "startup", transcript_path: "/x/77777777-7777-7777-7777-777777777777.jsonl" }) })
		let crossedHere = null
		try {
			const ls = readFileSync(join(pkg, ".comm", "handoff", "unnamed.log"), "utf8").trim().split("\n")
			crossedHere = JSON.parse(ls[ls.length - 1])
		} catch {}
		const consumedHere = !existsSync(noteHere)
		assert("F2 a note armed in THIS repo crosses into THIS repo's ledger",
			armedHere && consumedHere && crossedHere && crossedHere.prev_session === "PREV-BOOT-HOOK" &&
			crossedHere.signal && crossedHere.signal.src === "prove-red",
			`note armed=${armedHere}; boot --hook -> prev_session=${crossedHere && crossedHere.prev_session}, ` +
			`signal=${crossedHere && JSON.stringify(crossedHere.signal)}; note consumed=${consumedHere} ` +
			`(the two asserts above fire the same hook with nothing armed: that is this arm's control)`)

		// ---- review #4 R3: the FAILING direction of this row, which was never armed ----
		const hookLevel = (input) => {
			const r = spawnSync(process.execPath, [SELFFILE, "--json", "--fast", "--hook", "--root", pkg, "--field", tmp],
				{ encoding: "utf8", input })
			try {
				const rows = JSON.parse(r.stdout).rows
				const x = rows.find((y) => y.label === "ledger")
				return { level: x ? x.level : -1, text: x ? x.text : "" }
			} catch { return { level: -1, text: "" } }
		}
		// R3(a). A payload with no `source` recorded nothing and rendered a plain tick; the
		// only difference a reader got was a missing suffix. Measured as three identical ✓
		// over 1 record and 0 records.
		const noSource = hookLevel(JSON.stringify({ transcript_path: "/x/22222222-2222-2222-2222-222222222222.jsonl" }))
		const unparseable = hookLevel("not json at all")
		assert("R3a a --hook boot that records nothing WARNS",
			noSource.level === WARN && unparseable.level === WARN,
			`no source -> ${LV[noSource.level]}; unparseable -> ${LV[unparseable.level]}`)

		// R3(b). The block's contract claimed the write "is VERIFIED by re-reading through
		// the same tool". It was not: with the handoff directory writable but not readable,
		// the append succeeded, the query returned nothing, and the row printed "0 starts"
		// and "this start recorded" in one sentence, green.
		const hd = join(pkg, ".comm", "handoff")
		mkdirSync(hd, { recursive: true })
		spawnSync("chmod", ["300", hd])
		const blind = hookLevel(JSON.stringify({ source: "startup", transcript_path: "/x/33333333-3333-3333-3333-333333333333.jsonl" }))
		spawnSync("chmod", ["755", hd])
		assert("R3b a write the re-read cannot see WARNS", blind.level === WARN && !/ - this start recorded/.test(blind.text),
			`dir writable-not-readable -> ${LV[blind.level]}: ${blind.text.slice(0, 52)}`)

		// R6. `mislabelled` and `exposureSkew` were computed, exported, rendered by the
		// ledger and dropped by the row everyone actually reads at session start.
		//
		// RENAMED, review #6 F5: this assert was titled "the row carries the ledger's own
		// caveats" and measured `mislabelled` - it could go red, and it went red for a
		// different variable than the one in its title, which is the exact failure CLAUDE.md
		// was amended about on 2026-09-04. `caveats` shipped hours later, was dropped by
		// this row, and this arm was structurally incapable of noticing. The title now names
		// the counter it moves, and the caveat half is armed separately below it.
		writeFileSync(join(hd, "leader.log"), Array.from({ length: 12 }, (_, k) =>
			JSON.stringify({ v: 1, at: new Date(Date.UTC(2026, 0, k + 1)).toISOString(), event: "start",
				agent: "SOMEONE-ELSE", session: `s${k}`, source: "startup" })).join("\n") + "\n")
		const tampered = hookLevel(JSON.stringify({ source: "startup", transcript_path: "/x/44444444-4444-4444-4444-444444444444.jsonl" }))
		assert("R6a the row carries the ledger's mislabelled counter",
			tampered.level === WARN && /naming another agent/.test(tampered.text),
			`12 rows naming another agent -> ${LV[tampered.level]}: ${/naming another agent/.test(tampered.text) ? "reported" : "DROPPED"}`)
		try { rmSync(join(pkg, ".comm", "handoff"), { recursive: true, force: true }) } catch {}

		// R6b — the half that was never armed: the VERDICT CAVEAT. Review #6 F5.
		//
		// ONE VARIABLE, and it is the variable the caveat is about: the payload's `source`.
		// `clear` puts the start in the reboot arm, which is the only condition under which
		// the ledger emits its sub-population caveat; `startup` leaves that arm empty and the
		// ledger emits none. The detector is byte-identical across both runs.
		//
		// The second half of this assert is the POSITIVE CONTROL, and it is the half that
		// makes the first half mean anything: it proves the marker is absent when the ledger
		// has no caveat to report, so a `bits.push("◈ verdict caveat")` hard-wired into the
		// row - the shape that would pass a presence-only check while carrying nothing -
		// fails here.
		const freshHandoff = () => {
			try { rmSync(hd, { recursive: true, force: true }) } catch {}
			mkdirSync(hd, { recursive: true })
		}
		freshHandoff()
		const noCaveat = hookLevel(JSON.stringify({ source: "startup", transcript_path: "/x/55555555-5555-5555-5555-555555555555.jsonl" }))
		freshHandoff()
		const withCaveat = hookLevel(JSON.stringify({ source: "clear", transcript_path: "/x/66666666-6666-6666-6666-666666666666.jsonl" }))
		const carried = /◈ verdict caveat: FINDINGS\.md#reboot-signal/.test(withCaveat.text)
		const quiet = !/verdict caveat/.test(noCaveat.text)
		assert("R6b the row carries the ledger's verdict caveats",
			carried && quiet,
			`a clear start -> caveat ${carried ? "carried with its pointer" : "DROPPED"}; ` +
			`a startup-only ledger -> ${quiet ? "no caveat printed (control armed)" : "CAVEAT PRINTED WITH NONE TO REPORT"}`)
		try { rmSync(join(pkg, ".comm", "handoff"), { recursive: true, force: true }) } catch {}
	}

	// -- the session registry: the row, and the direction it must fail in -------
	// Only a --hook run writes it, so no `arm` can reach this either. The registry is the
	// answer to FINDINGS.md#clear-blind: without it, bin/context.mjs reports a cleared
	// session's DEAD transcript with exit 0, and a self-rebooting leader is a cleared
	// session by construction.
	{
		// A fake `claude` parent, so the control has a session pid to key on whatever
		// launched the suite. Without it the row is honestly "not a session", and the
		// property would go untested on exactly the machines that run this from a script.
		// Two commands in the -c string, so the shell cannot exec-optimise itself away and
		// take the argv[0] this depends on with it.
		const fake = join(tmp, "claude")
		try { symlinkSync("/bin/sh", fake) } catch {}
		const out = join(tmp, "registry.out")
		// A REAL file: the row reads what bin/context.mjs reads, so a fixture pointing at a
		// path that does not exist is a session that has already failed. This arm's job is
		// the healthy control, and the unhealthy one is armed below it.
		const tp = join(tmp, "66666666-6666-6666-6666-666666666666.jsonl")
		writeFileSync(tp, JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 10 } } }) + "\n")
		const asSession = (runtime) => {
			spawnSync(fake, ["-c",
				`CLAUDE_COMM_RUNTIME=${runtime} ${process.execPath} ${SELFFILE} --json --fast --hook ` +
				`--root ${pkg} --field ${tmp} > ${out} 2>&1; echo done`],
				{ encoding: "utf8", input: JSON.stringify({ source: "startup", transcript_path: tp }) })
			try {
				const x = JSON.parse(readFileSync(out, "utf8")).rows.find((y) => y.label === "registry")
				return { level: x ? x.level : -1, text: x ? x.text : "" }
			} catch { return { level: -1, text: "" } }
		}

		const rt = join(tmp, "registry-rt")
		const good = asSession(rt)
		const stored = (() => {
			try {
				const d = join(rt, "claude-comm", "sessions")
				return readdirSync(d).map((f) => JSON.parse(readFileSync(join(d, f), "utf8")).transcript)
			} catch { return [] }
		})()
		assert("registry: a --hook boot records this session",
			good.level === OK && /written and re-read/.test(good.text) && stored.includes(tp),
			`row=${LV[good.level]}, on disk: ${stored.length ? stored.map((x) => basename(x)).join(",") : "NOTHING"}`)

		// ONE VARIABLE: the same run against a runtime directory it cannot write. The row
		// must say so, because a registry that silently did not write reads later as a
		// machine with no sessions on it - and the reader would refuse for a session that
		// is perfectly alive.
		const ro = join(tmp, "registry-ro")
		mkdirSync(ro, { recursive: true })
		spawnSync("chmod", ["500", ro])
		const bad = asSession(ro)
		spawnSync("chmod", ["755", ro])
		assert("registry: a write that fails WARNS",
			bad.level === WARN && /NOT RECORDED/.test(bad.text),
			`unwritable runtime dir -> ${LV[bad.level]}: ${bad.text.slice(0, 46)}`)

		// ONE VARIABLE against the healthy control above: the same successful write, to a
		// transcript that is not there. The row used to tick on the lookup alone and say
		// "bin/context.mjs can resolve this session" while context refused - a green row
		// over a dead sensor. Found on a real boot report, not by this suite, which is why
		// it is now armed.
		// TWO cases, because F4 (review #5) split them. At SessionStart the transcript is a
		// PROMISE - measured 9.1 s and 18.6 s behind the hook on real cold starts - so a
		// FRESH entry naming a file that does not exist yet is correct and must stay green.
		// An entry past the grace period naming a file that is not there is a dead sensor
		// and must warn. One variable between them: the entry's age.
		//
		// Both readings must come from the SAME live fake-claude process, in one shell
		// invocation. The first version aged the fake session's entry and then read the row
		// from a plain boot - whose ancestor is the operator's real session - so it warned
		// about the wrong pid entirely and the assert failed for a reason unrelated to what
		// it verifies.
		rmSync(tp, { force: true })
		const freshGone = asSession(join(tmp, "registry-rt2"))
		assert("registry: a FRESH entry whose transcript is not yet there stays green",
			freshGone.level === OK,
			`written seconds ago, file absent -> ${LV[freshGone.level]} (a cold start looks exactly like this)`)

		const ager = join(tmp, "age.mjs")
		writeFileSync(ager, `import { readdirSync, readFileSync, writeFileSync } from "node:fs"\n` +
			`import { join } from "node:path"\n` +
			`const d = join(process.argv[2], "claude-comm", "sessions")\n` +
			`for (const f of readdirSync(d)) {\n` +
			`  const e = JSON.parse(readFileSync(join(d, f), "utf8"))\n` +
			`  e.at = new Date(Date.now() - 600000).toISOString()\n` +
			`  writeFileSync(join(d, f), JSON.stringify(e) + "\\n")\n` +
			`}\n`)
		const rt3 = join(tmp, "registry-rt3"), out3 = join(tmp, "registry3.out")
		const tp3 = join(tmp, "77777777-7777-7777-7777-777777777777.jsonl")
		writeFileSync(tp3, JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 10 } } }) + "\n")
		spawnSync(fake, ["-c",
			`CLAUDE_COMM_RUNTIME=${rt3} ${process.execPath} ${SELFFILE} --json --fast --hook --root ${pkg} --field ${tmp} > /dev/null 2>&1; ` +
			`rm -f ${tp3}; ${process.execPath} ${ager} ${rt3}; ` +
			`CLAUDE_COMM_RUNTIME=${rt3} ${process.execPath} ${SELFFILE} --json --fast --root ${pkg} --field ${tmp} > ${out3} 2>&1; echo done`],
			{ encoding: "utf8", input: JSON.stringify({ source: "startup", transcript_path: tp3 }) })
		const agedGone = (() => {
			try {
				const x = JSON.parse(readFileSync(out3, "utf8")).rows.find((y) => y.label === "registry")
				return { level: x ? x.level : -1, text: x ? x.text : "" }
			} catch { return { level: -1, text: "" } }
		})()
		assert("registry: an AGED entry whose transcript is GONE warns",
			agedGone.level === WARN && /is GONE|does not exist/.test(agedGone.text),
			`same session, entry aged 10 min -> ${LV[agedGone.level]}: ${agedGone.text.slice(0, 52)}`)
	}

	// The close's own two refusals, which no boot row expresses.
	{
		const st2 = join(pkg, "STATUS.md")
		const orig = readFileSync(st2, "utf8")
		const closeRun = (extra = []) => spawnSync(process.execPath,
			[SELFFILE, "--close", "--root", pkg, "--field", tmp, ...extra], { encoding: "utf8" })
		writeFileSync(st2, orig.replace(/^## ▶ NEXT[\s\S]*?(?=^## )/m, ""))
		const noNext = closeRun()
		writeFileSync(st2, orig)
		assert("close refuses without a stated next move", noNext.status === 1 && /carries no `## ▶ NEXT`/.test(noNext.stdout),
			`exit=${noNext.status}`)

		writeFileSync(join(pkg, "dirty.txt"), "x\n")
		const unacked = closeRun()
		// The rows to name are DERIVED from the fixture's own boot, not listed here. Listed,
		// this arm asserted that acking `tree` closes - and the day a twelfth row was added
		// that warns in a fixture (the registry, 2026-09-04), the arm went red for a reason
		// that had nothing to do with the property it verifies. A control that has to be
		// edited whenever an unrelated row is added is a control that will be edited
		// carelessly. This is also what an operator actually does: read the report, name
		// what it names.
		const openRows = run(false).rows.filter((r) => r.label && r.label !== "close" && r.level !== OK)
		// ACK EVERY LABEL, not only the ones that were open a moment ago. A close runs its OWN
		// boot, and this arm assumed two boots seconds apart produce the same levels. They do
		// not: measured 2026-09-05, `registry` was green in the boot this list came from and
		// WARN in the close that followed, and the arm failed for a row it had never been about.
		// An acknowledgement for a row that turns out to be green costs nothing - the close only
		// counts the ones it actually waved past.
		const allRows = run(false).rows.filter((r) => r.label && r.label !== "close")
		const acked = closeRun(allRows.flatMap((r) => ["--ack", `${r.label}=fixture: deliberately ${r.label}`]))
		rmSync(join(pkg, "dirty.txt"), { force: true })
		assert("close refuses an unnamed row, accepts a named one",
			unacked.status === 1 && /NOT CLOSED/.test(unacked.stdout) && acked.status === 0 && /CLOSED at/.test(acked.stdout),
			`${openRows.length} open row(s) named [${openRows.map((r) => r.label).join(",")}]: unacked exit=${unacked.status}, acked exit=${acked.status}`)
	}

	// ══ review #7's arms ══════════════════════════════════════════════════════════════
	//
	// Five findings whose common shape is a row, a counter or a guard that nothing here
	// exercised. Each moves ONE variable against a control built by the same code.
	{
		const stateOf = () => { try { return JSON.parse(readFileSync(join(pkg, ".boot-state.json"), "utf8")) } catch { return {} } }
		const closeRun2 = (extra = []) => spawnSync(process.execPath,
			[SELFFILE, "--close", "--root", pkg, "--field", tmp, ...extra], { encoding: "utf8" })
		const touchStatus = () => { const t = new Date(); utimesSync(join(pkg, "STATUS.md"), t, t) }

		// ── F2: a completed --close erased by another session's ordinary boot ────────────
		//
		// The gate branch read `.boot-state.json` at the top of its row and wrote it back
		// AFTER the suite - up to 26 s later - so a close landing in that window said
		// `✓ CLOSED`, wrote `ackCounts` and `lastClose`, and was then silently replaced by a
		// snapshot older than itself. Two Claude sessions in one tree is the configuration
		// bin/claim.mjs was shipped for, and the reviewer watched it happen live.
		//
		// The arm carries its own positive control: it is not enough that the concurrent
		// write survives - the boot must be shown to have written AFTER it, or "survived"
		// only means "nothing wrote at all".
		{
			const sp = join(pkg, ".boot-state.json")
			const child = spawn(process.execPath, [SELFFILE, "--json", "--root", pkg, "--field", tmp],
				{ encoding: "utf8", stdio: "ignore" })
			// POLLED THROUGH /proc, NOT THROUGH `child.on("exit")`. A busy-wait blocks the event
			// loop, so the exit callback cannot run inside it and the loop would always spend its
			// whole timeout - the first version of this arm sat for 93 s per run and called it
			// waiting. The filesystem answers a blocked process; a callback does not.
			const alive = () => existsSync(`/proc/${child.pid}`)
			// Land inside the gate, which is the whole width of the window.
			const t0 = Date.now(); while (Date.now() - t0 < 3000 && alive()) {}
			const midAt = new Date().toISOString()
			const before = stateOf()
			writeFileSync(sp, JSON.stringify({ ...before, ackCounts: { "a-concurrent-close": 7 },
				lastClose: { at: midAt, head: "cafe123", acked: ["a-concurrent-close"] } }, null, 2) + "\n")
			const t1 = Date.now(); while (Date.now() - t1 < 90_000 && alive()) {}
			const after = stateOf()
			const bootWroteAfter = after.at && Date.parse(after.at) >= Date.parse(midAt)
			assert("state: a close written during the gate is not erased",
				bootWroteAfter && after.ackCounts && after.ackCounts["a-concurrent-close"] === 7 &&
				after.lastClose && after.lastClose.head === "cafe123",
				`boot wrote at ${after.at} (after the concurrent write at ${midAt}: ${bootWroteAfter} - the positive control; ` +
				`false would mean nothing wrote and "survived" proves nothing); ` +
				`ackCounts=${JSON.stringify(after.ackCounts)} lastClose.head=${after.lastClose && after.lastClose.head} (want 7 / cafe123)`)
		}

		// ── F10: the erosion counter - no reset, no arm, and it fired for dead rows ──────
		//
		// CLAUDE.md makes this count the EVIDENCE for amending the protocol, and it was the
		// only load-bearing mechanism here with nothing anywhere demonstrating it. Three
		// properties, in one fixture: it counts, the instruction can be DISCHARGED, and a row
		// this boot does not produce cannot demand anything.
		{
			writeFileSync(join(pkg, "dirty.txt"), "x\n")
			// A CLEAN SLATE, because the property is the counter's behaviour and not the
			// fixture's history: every close above this one acked whatever was open and wrote a
			// count for it, so without this the arm measures rows it never touched. (Measured:
			// it did, and the "silent after the amendment" half failed for a row this arm had
			// never named.)
			{ const st0 = stateOf(); st0.ackCounts = {}; writeFileSync(join(pkg, ".boot-state.json"), JSON.stringify(st0, null, 2) + "\n") }
			// ONE full boot for the ack list, reused: `run(false)` runs the gate, and calling it
			// per close cost four extra suite runs for a list that cannot change.
			const acks = run(false).rows.filter((r) => r.label && r.label !== "close")
				.flatMap((r) => ["--ack", `${r.label}=fixture: deliberately ${r.label}`])
			const ackAll = () => acks
			const amendLine = (out) => (out.split("\n").find((l) => /acknowledged \d+x/.test(l)) || "").trim()
			let outs = []
			for (let i = 0; i < 3; i++) { touchStatus(); outs.push(closeRun2(ackAll()).stdout || "") }
			const countsAfter3 = stateOf().ackCounts || {}
			const demanded = /AMEND THE PROTOCOL/.test(outs[2]) && !/AMEND THE PROTOCOL/.test(outs[0])
			// THE DISCHARGE. Following the instruction must clear it; before this, the only
			// way was a hand-edit of a gitignored file - an unaudited edit to the evidence.
			touchStatus()
			const amended = closeRun2([...ackAll(), "--amended", "tree=fixture: what it measures now"]).stdout || ""
			const stAfter = stateOf()
			const cleared = !(stAfter.ackCounts || {}).tree && (stAfter.amendments || []).some((a) => a.row === "tree")
			touchStatus()
			// AN AMENDMENT DISCHARGES THE ROW IT NAMES, and only that row. The first version of
			// this arm demanded that the next close print no AMEND block at all - and failed,
			// correctly, because `registry` was ALSO being acked in this fixture and had reached
			// five. "Silence" was never the property; "this row stops demanding" is.
			const quiet = closeRun2(ackAll()).stdout || ""
			const treeStillDemanded = /\btree acknowledged \d+x/.test(quiet)
			// A ROW THAT NO LONGER EXISTS. It read the all-time map, so a row amended and then
			// DELETED went on demanding an amendment at every close, forever, in the loudest
			// line of the report - an instruction that following could not discharge.
			const st = stateOf()
			st.ackCounts = { ...(st.ackCounts || {}), "a-row-that-was-deleted": 9 }
			writeFileSync(join(pkg, ".boot-state.json"), JSON.stringify(st, null, 2) + "\n")
			touchStatus()
			const withGhost = closeRun2(ackAll()).stdout || ""
			rmSync(join(pkg, "dirty.txt"), { force: true })
			const ghostSilent = !/a-row-that-was-deleted acknowledged/.test(withGhost) &&
				/a-row-that-was-deleted/.test(withGhost)   // held as history, and said so
			assert("close: the erosion count is armed, dischargeable, and does not haunt",
				demanded && (countsAfter3.tree || 0) >= 3 && cleared && !treeStillDemanded && ghostSilent,
				`3 closes acking the same rows -> tree=${countsAfter3.tree}, AMEND on the 3rd=${demanded} (not on the 1st: control); ` +
				`--amended tree -> count cleared and recorded=${cleared}, the next close no longer demands TREE=${!treeStillDemanded}` +
				`${/AMEND THE PROTOCOL/.test(quiet) ? ` (it still demands, for another row: ${amendLine(quiet)} - correct, that one was not amended)` : ""}; ` +
				`a count for a row this boot does not produce -> demanded=${/a-row-that-was-deleted acknowledged/.test(withGhost)} (want false), named as history=${/a-row-that-was-deleted/.test(withGhost)}`)
		}

		// ── a close whose record does not land is not a close ────────────────────────────
		//
		// Not one of review #7's fourteen: found by re-reading the fix for F2. `updateState`
		// inherited `writeState`'s silent catch, so a close whose write failed printed
		// `✓ CLOSED`, exited 0, and left the acknowledgements it had just counted nowhere.
		// ONE VARIABLE: the state file replaced by a directory, so the rename cannot land.
		{
			const sp = join(pkg, ".boot-state.json")
			const saved = (() => { try { return readFileSync(sp, "utf8") } catch { return null } })()
			const acks2 = run(false).rows.filter((r) => r.label && r.label !== "close")
				.flatMap((r) => ["--ack", `${r.label}=fixture: deliberately ${r.label}`])
			rmSync(sp, { force: true })
			mkdirSync(sp, { recursive: true })
			writeFileSync(join(sp, "in-the-way"), "x\n")
			touchStatus()
			const blocked = closeRun2(acks2)
			rmSync(sp, { recursive: true, force: true })
			if (saved !== null) writeFileSync(sp, saved)
			touchStatus()
			const control = closeRun2(acks2)
			assert("close: a record that does not land is not a close",
				blocked.status === 1 && /NOT CLOSED/.test(blocked.stdout) && !/✓ CLOSED/.test(blocked.stdout) &&
				control.status === 0 && /✓ CLOSED/.test(control.stdout),
				`.boot-state.json replaced by a directory -> exit ${blocked.status}, ` +
				`${/NOT CLOSED/.test(blocked.stdout) ? "refused and said why" : `WRONG: ${(blocked.stdout || "").slice(-70).trim()}`}; ` +
				`positive control, the file restored -> exit ${control.status} ${/✓ CLOSED/.test(control.stdout) ? "CLOSED" : "STILL REFUSING - the fixture did not come back"}`)
		}

		// ── F3: mail for an agent NO ROSTER accounts for ─────────────────────────────────
		//
		// `pending` is a walk of the inbox tree; `stranded` is computed from the roster. When
		// they disagree the row took the GREEN branch and made a positive claim about that
		// mail - "in flight to a running agent" - about a message nothing will ever deliver.
		// ONE VARIABLE against the STRANDED arm above: the agent's entry in config.json.
		{
			const cfgPath = join(proj, ".comm", "config.json")
			const cfg = readFileSync(cfgPath, "utf8")
			const msg2 = join(proj, ".comm", "inbox", "app", "0009-orphan.json")
			mkdirSync(dirname(msg2), { recursive: true })
			writeFileSync(msg2, JSON.stringify({ id: "0009-orphan", to: "app" }))
			const withRoster = run(true).rows.find((r) => r.label === "field:proj") || { level: -1, text: "" }
			writeFileSync(cfgPath, JSON.stringify({ leader: "leader", agents: { leader: "." } }))
			const without = run(true).rows.find((r) => r.label === "field:proj") || { level: -1, text: "" }
			writeFileSync(cfgPath, cfg)
			rmSync(msg2, { force: true })
			assert("field: mail addressed to nobody on the roster",
				/NOT RUNNING/.test(withRoster.text) && withRoster.level === WARN &&
				/ON NO ROSTER/.test(without.text) && without.level === WARN,
				`the same message, agent IN the roster -> ${LV[withRoster.level]} "${(withRoster.text.match(/⚠ [^-]*/) || [""])[0].trim().slice(0, 44)}" (control); ` +
				`agent removed from config.json -> ${LV[without.level]} ${/ON NO ROSTER/.test(without.text) ? "says it is unaddressable" : `SAID: ${without.text.slice(0, 60)}`}`)
		}

		// ── F8/F14: every claim state reaches the row, in claim.mjs's own words ──────────
		//
		// The row reported two of the five states `read()` returns and dropped `corrupt`,
		// `unknown` and `unreadable` - and it re-derived the sentence for `gone` from `state`
		// alone, announcing a claim the tool had itself predicted would read as gone
		// (`holder: "self"`) as evidence of a crash, at every session start.
		{
			const cdir = join(proj, ".comm", "claims")
			mkdirSync(cdir, { recursive: true })
			const rowNow = () => run(true).rows.find((r) => r.label === "field:proj") || { level: -1, text: "" }
			writeFileSync(join(cdir, "port:4173.json"), "not a claim at all\n")
			writeFileSync(join(cdir, "port:5555.json"), JSON.stringify({ v: 1, at: new Date().toISOString(),
				resource: "port:5555", by: "db", pid: 4194303, purpose: "pg" }) + "\n")
			writeFileSync(join(cdir, "port:6000.json"), JSON.stringify({ v: 1, at: new Date().toISOString(),
				resource: "port:6000", by: "db", pid: 4194303, start: 1, boot: "not-this-boot", holder: "self", purpose: "a short-lived command" }) + "\n")
			const seen = rowNow()
			const stillThere = existsSync(join(cdir, "port:4173.json"))
			rmSync(cdir, { recursive: true, force: true })
			assert("field: a claim boot cannot read is not silence",
				seen.level === WARN && /port:4173/.test(seen.text) && /port:5555/.test(seen.text) &&
				/nothing crashed/.test(seen.text) && stillThere,
				`corrupt+unknown+self-held planted -> ${LV[seen.level]}; names the corrupt one=${/port:4173/.test(seen.text)}, ` +
				`the unjudgeable one=${/port:5555/.test(seen.text)}, and says the self-held one is NOT a crash=${/nothing crashed/.test(seen.text)}; ` +
				`the corrupt file was left where it was by a READ=${stillThere} (a listing that moves files makes the next boot blind)`)
		}

		// ── F13: --hook writes two instruments and --root governs one ────────────────────
		//
		// The ledger damage is confined to the root you name; the registry write is not - it
		// lands on the machine, on the LIVE session, and bin/context.mjs is keyed on it. A
		// probe rooted at a throwaway checkout replaced the reviewer's own entry with a
		// scratchpad transcript path while review #7 was being written.
		//
		// THE ARM MUST NOT BE THE DEFECT: CLAUDE_COMM_RUNTIME is what the refusal keys on, so
		// it is unset for the child - and XDG_RUNTIME_DIR is pointed at a throwaway, so if the
		// refusal ever fails the damage lands in the fixture rather than on this machine.
		{
			const other = join(tmp, "other-tree")
			mkdirSync(join(other, "bin"), { recursive: true })
			cpSync(join(pkg, "bin"), join(other, "bin"), { recursive: true })
			const ledgerOf = (root) => {
				const r = spawnSync(process.execPath, [join(pkg, "bin", "ledger.mjs"), "--json", "--root", root], { encoding: "utf8" })
				try { return JSON.parse(r.stdout).starts.cold } catch { return -1 }
			}
			const env = { ...process.env, XDG_RUNTIME_DIR: join(tmp, "f13-runtime") }
			delete env.CLAUDE_COMM_RUNTIME
			const before13 = ledgerOf(other)
			const refused = spawnSync(process.execPath, [SELFFILE, "--fast", "--hook", "--json", "--root", other, "--field", tmp],
				{ encoding: "utf8", env, input: JSON.stringify({ source: "startup", transcript_path: join(tmp, "x.jsonl") }) })
			const after13 = ledgerOf(other)
			// POSITIVE CONTROL: the same command with the registry redirected, which is what
			// the arms and any honest experiment already do. It must NOT be refused.
			const allowed = spawnSync(process.execPath, [SELFFILE, "--fast", "--hook", "--json", "--root", other, "--field", tmp],
				{ encoding: "utf8", env: { ...env, CLAUDE_COMM_RUNTIME: join(tmp, "f13-runtime2") },
				  input: JSON.stringify({ source: "startup", transcript_path: join(tmp, "x.jsonl") }) })
			assert("hook: --root elsewhere without a redirected registry is refused",
				// NOT `status === 0`: a boot's exit code reports its ROWS, and a bare checkout in a
				// temp directory has red ones. The property is that the call was not REFUSED and
				// the start landed - measured, the first version of this arm demanded exit 0 and
				// failed on a healthy refusal-free run, which is an arm asserting a different
				// variable than the one in its title.
				refused.status === 2 && /governs one/.test(refused.stdout) && after13 === before13 &&
				allowed.status !== 2 && ledgerOf(other) === before13 + 1,
				`--hook --root <other> with CLAUDE_COMM_RUNTIME unset -> exit ${refused.status} (want 2), ` +
				`that tree's ledger ${before13} -> ${after13} (must not move); ` +
				`positive control, the same call with the registry redirected -> exit ${allowed.status} (any but 2), ledger -> ${ledgerOf(other)} (want ${before13 + 1})`)
		}
	}

	console.log(`\n  session: INFORMATIONAL - reports /proc, has no failing state, is not a gate`)
	// R5: the archive row said "tracked" when git had been asked nothing at all.
	{
		const nogit = join(tmp, "nogit")
		mkdirSync(nogit)
		for (const e of readdirSync(pkg)) {
			if (e === ".git") continue
			cpSync(join(pkg, e), join(nogit, e), { recursive: true })
		}
		const r = spawnSync(process.execPath, [SELFFILE, "--json", "--fast", "--root", nogit, "--field", tmp], { encoding: "utf8" })
		let res = { rows: [] }
		try { res = JSON.parse(r.stdout) } catch {}
		const lv = level(res, "archive")
		assert("R5 no git means UNKNOWN, not 'tracked'", lv === UNKNOWN,
			`archive in a directory with no repository -> ${LV[lv]}`)
	}

	assert("the control leaves the machine's real registry untouched",
		snapReal() === realBefore,
		`${REAL_REG}: ${snapReal() === realBefore ? "unchanged" : "CHANGED - this suite wrote into the world it measures"}`)

	console.log(`\n${failed ? `✗ ${failed} boot row(s) could NOT be reddened - that row is decoration` : "✓ every gating boot row demonstrated able to go red"}\n`)
	process.exit(failed ? 1 : 0)
}
