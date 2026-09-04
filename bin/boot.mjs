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
import { readFileSync, writeFileSync, renameSync, existsSync, readdirSync, statSync, utimesSync, mkdtempSync, mkdirSync, cpSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname, resolve, basename } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"

const ARGV = process.argv.slice(2)
const has = (f) => ARGV.includes(f)
const opt = (f, d) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d }

const SELF = dirname(dirname(fileURLToPath(import.meta.url)))
const ROOT = resolve(opt("--root", SELF))
// Field installs are found beside this repo rather than from a hardcoded list: the
// framework's shape is "one project per directory", and a list would go stale in the
// one direction that matters — a project installed and then forgotten.
const FIELD = resolve(opt("--field", dirname(ROOT)))
const FAST = has("--fast")
const JSONOUT = has("--json")

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
 * question rather than leaving it open. It does NOT make the read-modify-write pair
 * atomic - two interleaved boots can still lose one update - and that is stated rather
 * than papered over: the record it protects is a counter, and losing a count is
 * recoverable where losing the file is not.
 */
function writeState(obj) {
	try {
		const sp = join(ROOT, ".boot-state.json")
		const tmp = `${sp}.tmp-${process.pid}`
		writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n")
		renameSync(tmp, sp)
	} catch {}
}

let statusText = ""
let gateDocs = []   // documents the gate suite declares it reads; feeds the fingerprint (R1)

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
		try {
			const sp = join(ROOT, ".boot-state.json")
			let st = {}
			try { st = JSON.parse(readFileSync(sp, "utf8")) } catch {}
			st.sources = st.sources || {}
			st.sources[payload.source] = (st.sources[payload.source] || 0) + 1
			st.lastSource = payload.source
			st.lastSourceAt = new Date().toISOString()
			writeFileSync(sp, JSON.stringify(st, null, 2) + "\n")
		} catch {}
	}
}

// -- 1. session identity, read the way every other scanner reads it ----------
{
	const ppidOf = (pid) => {
		try {
			const s = readFileSync(`/proc/${pid}/stat`, "utf8")
			return Number(s.slice(s.lastIndexOf(")") + 2).split(" ")[1]) || 0
		} catch { return 0 }
	}
	const argv0 = (pid) => {
		try { return basename(readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0")[0] || "") } catch { return "" }
	}
	// Walk to the NEAREST ancestor that is the session itself. Measured on this box:
	// the session's argv is exactly `claude`, its parent is the shell, its grandparent
	// kitty. Matching the whole chain instead would also match kitty and init.
	let pid = process.pid, session = 0
	for (let i = 0; i < 12 && pid > 1; i++) {
		if (argv0(pid) === "claude") { session = pid; break }
		pid = ppidOf(pid)
	}
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
	const declared = env ? (env.get("CLAUDE_COMM_AGENT") || "").trim() : ""
	const kitty = (env && env.get("KITTY_LISTEN_ON") || "").match(/kitty-(\d+)/)
	const where = session ? `/proc/${session}` : "no claude ancestor"
	const src = payload && payload.source ? ` - started: ${payload.source}` : ""
	row("session", OK,
		`${declared ? `declared "${declared}"` : "no CLAUDE_COMM_AGENT - off the bus"} (${where})` +
		`${kitty ? ` - kitty win ${kitty[1]}` : ""}${src}`)
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
	try {
		for (const f of readdirSync(join(ROOT, "test"))) {
			if (f.endsWith(".mjs")) gateProse += readFileSync(join(ROOT, "test", f), "utf8")
		}
	} catch {}
	// Strip comments before looking for a dependency, in A21's idiom and for its reason:
	// PROSE about a document must not redden a check about reading one. Measured on the
	// first run of this detector - `test/latency.mjs` says "STATUS.md's latency table is
	// this project's flagship" in a header comment, and the row went yellow claiming an
	// undeclared gate dependency that does not exist. A check that fires for a reason
	// foreign to what it claims is how a row gets ignored.
	gateSrc = gateProse.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
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
		if (!gated && gateSrc.includes(f)) undeclared.push(f)
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
		row("budget", missing.length ? RED : total > TIER0_BUDGET ? RED : total > TIER0_BUDGET * 0.85 ? WARN : OK,
			missing.length
				? `tier 0 names ${missing.join(", ")}, which do not exist`
				: `tier 0 is ${total} B of ${TIER0_BUDGET} (${pct}%) across ${names.join(" + ")}` +
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
	const repoBus = sha(join(ROOT, "bin", "comm.mjs"))
	for (const p of projects) {
		const name = basename(p)
		const chk = spawnSync("node", [join(ROOT, "install.mjs"), p, "--check"], { encoding: "utf8" })
		const drift = chk.status !== 0
		// Checked independently of the installer's own count: the installed bus is the
		// file the hooks actually execute, and it going stale is a defect this project
		// has already shipped twice without noticing.
		// R9: a null repoBus used to DISABLE the comparison, so the row printed the
		// reassuring "bus current" having compared nothing - a void probe standing behind
		// a working one, since the installer happens to fail on the same condition.
		const busStale = repoBus === null ? null : sha(join(p, ".comm", "bin", "comm.mjs")) !== repoBus
		let pending = 0, oldest = 0
		const ibx = join(p, ".comm", "inbox")
		try {
			for (const a of readdirSync(ibx)) {
				let files = []
				try { files = readdirSync(join(ibx, a)) } catch { continue }
				for (const f of files) {
					if (!f.endsWith(".json")) continue
					pending++
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
		const bits = [
			drift ? "HOOK DRIFT" : "hooks in sync",
			busStale === null ? "BUS UNCOMPARED (this repo's own bus is unreadable)" : busStale ? "BUS STALE vs repo" : "bus current",
			pending ? `${pending} pending (oldest ${age(Date.now() - oldest)})` : "0 pending",
			last ? `last delivery ${age(Date.now() - Date.parse(last))} ago` : "no delivery logged",
		]
		row(`field:${name}`, drift || busStale !== false ? RED : pending ? WARN : OK, bits.join(" - "))
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

// -- 6. the gate - run it; never infer it from a fingerprint -----------------
{
	// The fingerprint covers every input the gate READS, not only the code it lives in.
	// Review #3 R1 moved one variable to prove the gap: renaming an anchor in FINDINGS.md
	// - which A27 reads - left the fingerprint byte-identical at 817a7c78e24a while the
	// gate went red. A fingerprint that misses a gate's inputs claims a green it cannot
	// support, which is the whole failure class this project keeps finding.
	const fp = createHash("sha256")
	for (const rel of ["bin/comm.mjs", "install.mjs", "test/attack.mjs", ...gateDocs]) {
		try { fp.update(readFileSync(join(ROOT, rel))) } catch {}
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
		row("gate", !prev || !same || !fresh ? WARN : UNKNOWN,
			!prev ? "never recorded green - run `node bin/boot.mjs` before touching the bus"
				: `NOT RUN (--fast) - last green ${age(Date.now() - Date.parse(prev.at))} ago` +
				  (same ? " on these bytes" : " on DIFFERENT bytes"))
	} else {
		const t0 = Date.now()
		const g = spawnSync("node", [join(ROOT, "test", "attack.mjs")], { encoding: "utf8" })
		const out = `${g.stdout || ""}${g.stderr || ""}`
		const pass = (out.match(/^\s+✓/gm) || []).length
		const fails = out.split("\n").filter((l) => /^\s+✗/.test(l))
		const secs = ((Date.now() - t0) / 1000).toFixed(1)
		if (g.status === 0 && pass > 0) {
			row("gate", OK, `attack ${pass}/${pass} in ${secs}s`)
			// MERGE. Review #3 R2: this wrote the object wholesale and erased `sources`,
			// `lastSource` and `lastSourceAt` - the record that exists to answer whether
			// /clear reports source "clear", which decides if the reboot loop is buildable.
			// CLAUDE.md tells every session to run a full boot, so the wipe happened through
			// documented use, and the file is gitignored so there was no recovery.
			writeState({ ...(prev || {}), print, at: new Date().toISOString(), head: git("rev-parse", "--short", "HEAD"), pass })
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
	rows.map((r) => `  ${r.label ? MARK[r.level] : " "} ${r.label.padEnd(pad)}  ${r.text}`).join("\n") + "\n" +
	(open
		? "\n  open (STATUS.md's claim - verify before acting):\n" +
		  [...open.matchAll(/^(\d+)\.\s+\*\*(.+?)\*\*/gm)]
			  .map((m) => `    ${m[1]}. ${m[2].replace(/`/g, "").slice(0, 96)}`).join("\n") + "\n"
		: "") +
	"\n  not run here: test/selftest.mjs - it spawns real `claude -p` sessions (minutes), and its" +
	"\n  BEHAVIOUR half is reported, never gated. Run it before changing delivery.\n"

process.stdout.write(report)

// What this report costs the session it is injected into (R10).
if (FAST) {
	let st = {}
	try { st = JSON.parse(readFileSync(join(ROOT, ".boot-state.json"), "utf8")) } catch {}
	st.reportBytes = Buffer.byteLength(report)
	writeState(st)
}
process.exit(worst === RED ? 1 : 0)

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

	const msg = join(proj, ".comm", "inbox", "app", "0001-x.json")
	arm("field: mail sits undelivered", "field:proj", WARN,
		() => writeFileSync(msg, JSON.stringify({ id: "0001-x", to: "app" })),
		() => rmSync(msg, { force: true }))

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

	arm("R9 this repo's own bus unreadable", "field:proj", RED,
		...swap(join(pkg, "bin", "comm.mjs"), () => ""))

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

	console.log(`\n${failed ? `✗ ${failed} boot row(s) could NOT be reddened - that row is decoration` : "✓ every gating boot row demonstrated able to go red"}\n`)
	process.exit(failed ? 1 : 0)
}
