#!/usr/bin/env node
/**
 * claude-comm RESOURCE CLAIMS — the thing an agent is HOLDING, written down.
 *
 *   node bin/claim.mjs take <resource> --purpose "what for" [--force]
 *   node bin/claim.mjs list [--json]
 *   node bin/claim.mjs release <resource>
 *
 * WHY THIS FILE EXISTS. Two agents in ONE project root collided over a port on
 * 2026-09-04 and killed each other's dev servers. **The failure is not transport**, which
 * is why a bigger bus would not have prevented it: both had a hub, both were reachable,
 * and neither could see the other, because nothing in this toolkit has ever had a concept
 * of a thing an agent is HOLDING. `bin/comm.mjs` knows senders and refs; it does not know
 * a port, a socket or a server exists.
 *
 * The `~/Dev/work` leader measured what makes it expensive, and it is not the collision:
 * **three of his applications declared port 4173, and two agents started in parallel would
 * each have read the result as a broken test rather than a port conflict** — so both would
 * have searched in the wrong place, separately, for as long as it took. A conflict that
 * announces itself is cheap. This one does not.
 *
 * 2026-09-05: he reported three agents and SIX ports scheduled (PostgREST 54331, GoTrue
 * 54332, dev 5174/5175, preview 4174/4175). `FINDINGS.md#claim-file` said "deliberately not
 * next — a second collision would outrank the current plan; a near-miss does not." That
 * line is superseded by his table, not by impatience: the condition it named is met.
 *
 * ── THREE PROPERTIES, each of them a way to build this wrong ─────────────────────────────
 *
 * 1. A STALE CLAIM IS DIAGNOSABLE, NEVER AUTHORITATIVE. The holder's identity is in the
 *    file, so a reader can see the process is gone — and a claim whose holder is gone is
 *    EVIDENCE OF A CRASH, not a lock that outlived the thing that took it. A naive version
 *    blocks everybody forever on the first agent that dies, which is the one state this
 *    ships with an arm for.
 *
 *    Identity is (pid, start time, boot id), NEVER pid alone — `bin/session-registry.mjs`
 *    property 1, and the same reason: pids are recycled, and a recycled pid answering
 *    "held" confidently is exactly the wrong answer this file exists to prevent. That
 *    resolution is IMPORTED rather than rewritten; it has been written twice in this repo
 *    already and a third copy is how two lists start disagreeing.
 *
 * 2. IT ADVISES, IT DOES NOT ENFORCE. Nothing here opens a port, kills a process or blocks
 *    a call. A mutex that every agent can delete is a promise the filesystem does not make,
 *    and writing one would put a guarantee in the design that the mechanism cannot keep.
 *    What it buys is that a collision becomes DIAGNOSABLE in one command instead of looking
 *    like a broken test.
 *
 * 3. BYTES IT CANNOT READ ARE SET ASIDE, NEVER DROPPED. Identical to
 *    `bin/restart-signal.mjs` property 3 and for the identical reason: an unreadable claim
 *    means something wrote here that should not have, and deleting it destroys the only
 *    evidence of the writer. Review #6 F6 was this rule applied to one branch and not its
 *    neighbour, so it is stated once here and applied to every refusal.
 *
 * NOT THE BUS. It imports one sibling and, on `take` only, spawns the bus ONCE to ask who
 * the caller is — because the alternative was a third rule for identity in a repository
 * whose stated rule is that there is one (review #7 F11). It is a short-lived process over a
 * directory of small files. The file is the artifact; there is no daemon, no transport and
 * nothing to keep in sync.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync, unlinkSync, existsSync, mkdtempSync, rmSync, chmodSync } from "node:fs"
import { join, dirname, resolve, sep } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { startTimeOf, bootId, sessionPid } from "./session-registry.mjs"

const SCHEMA = 1
const ARGV = process.argv.slice(2)
const has = (f) => ARGV.includes(f)
const opt = (flag, dflt = null) => {
	const i = ARGV.indexOf(flag)
	if (i === -1) return dflt
	const v = ARGV[i + 1]
	// A flag whose value was eaten by the next flag is refused, never defaulted — the rule
	// bin/ledger.mjs learned the hard way and every tool here now shares.
	if (v === undefined || v.startsWith("--")) die(`${flag} needs a value`)
	return v
}
const EX_USAGE = 64, EX_HELD = 3, EX_IO = 65
const die = (m, code = EX_USAGE) => { process.stderr.write(`claim: ${m}\n`); process.exit(code) }

/**
 * A RESOURCE NAME BECOMES A FILENAME, so it is contained structurally rather than trusted —
 * the same boundary rule as agent names in `bin/ledger.mjs` and `bin/restart-signal.mjs`,
 * duplicated rather than imported because each file guards its own filesystem edge.
 *
 * `:` is allowed where those two forbid it, because the names people actually want are
 * `port:4173` and `socket:pg`. It is an ordinary character in a POSIX filename; `/` and
 * `..` are what must not get through, and they do not.
 */
const RESOURCE_OK = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/
export const safeResource = (r) => typeof r === "string" && RESOURCE_OK.test(r) && !r.includes("..")

export function claimsDir(root) { return join(resolve(root), ".comm", "claims") }
export function claimPath(root, resource) {
	if (!safeResource(resource)) return null
	return join(claimsDir(root), `${resource}.json`)
}

/**
 * Is the process named by this record still the process that wrote it?
 *
 * Three ways to be gone, and none of them may read as held:
 *   · the pid is not running at all;
 *   · the pid is running but started at a different time — RECYCLED, a different program;
 *   · the machine rebooted, so "ticks since boot" is not comparable at all.
 *
 * A record written before this file carried `start`/`boot` cannot be judged on them, and is
 * reported as `unknown` rather than as either answer. Guessing "held" would block everyone
 * on an old file; guessing "gone" would hand somebody else a live port.
 */
export function holderState(rec) {
	const pid = Number(rec && rec.pid)
	if (!Number.isFinite(pid) || pid <= 0) return "unknown"
	if (rec.start === undefined || rec.boot === undefined) return "unknown"
	if (rec.boot !== bootId()) return "gone"
	const st = startTimeOf(pid)
	if (st === null) return "gone"
	return st === rec.start ? "held" : "gone"
}

/** Set bytes aside under a name nothing claims, and report where they went. */
function setAside(p, why) {
	const aside = `${p}.${why}.${Date.now()}`
	try { renameSync(p, aside) } catch { return null }
	return aside
}

/**
 * Read one claim. `{ state, rec, path, setAside? }` — `state` is derived here and NEVER
 * stored, so the rule that decides "gone" can be corrected later and every file ever
 * written is re-read under it (`bin/ledger.mjs` property 1, same reason).
 */
export function read(root, resource, { mayMove = true } = {}) {
	const p = claimPath(root, resource)
	if (!p) return { state: "invalid", path: null }
	let text
	try { text = readFileSync(p, "utf8") }
	catch (e) {
		// ENOENT is "nobody is holding it", the common and correct case. Anything else is a
		// claim that may be sitting right there, and reporting it as free is the comfortable
		// lie this toolkit refuses everywhere else.
		if (e && e.code === "ENOENT") return { state: "free", path: p }
		return { state: "unreadable", path: p, why: (e && e.message) || String(e) }
	}
	let rec = null
	try { rec = JSON.parse(text) } catch {}
	if (!rec || typeof rec !== "object" || rec.v !== SCHEMA) {
		// A READ THAT MOVES FILES IS NOT A READ (review #7 F8). `list` is what `bin/boot.mjs`
		// spawns at every session start of every field project, and it renamed corrupt records
		// out from under the directory listing that had just gated the spawn - so the row said
		// nothing, and the second boot could not even see the file to say nothing about. Only
		// the verbs that must take the path (`take`, `release`) set bytes aside; a reader
		// reports them where they are.
		return { state: "corrupt", path: p, setAside: mayMove ? setAside(p, "corrupt") : null, why: "not a claim this version can read" }
	}
	return { state: holderState(rec), rec, path: p }
}

function allClaims(root) {
	const dir = claimsDir(root)
	let names = []
	try { names = readdirSync(dir).filter((f) => f.endsWith(".json")).sort() }
	catch { return [] }
	return names.map((f) => {
		const resource = f.slice(0, -5)
		return { resource, ...read(root, resource, { mayMove: false }) }
	})
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────

/**
 * WHERE THE CLAIMS DIRECTORY IS — and the first version of this line was
 * `resolve(opt("--root", process.cwd()))`, which is the defect review #7 F1 measured.
 *
 * cwd is where the AGENT stands, not where the project is, and five of the six agents in
 * `~/Dev/work` live in subdirectories. Each got its own `.comm/claims/` and none could see
 * the others: three agents, three holders of `port:4173`, three exit-0s, and the leader's
 * boot counting one. A tool whose entire value is that two agents look at the SAME file may
 * not choose that file from the caller's cwd.
 *
 * The bus has walked UP for `.comm/config.json` since its first commit (`comm.mjs`'s
 * findRoot) and answers correctly from the very directory that split this. So this walks up
 * too — from `--root` when given, from cwd otherwise.
 *
 * `--root` remains a starting point rather than a licence: `bin/boot.mjs` passes a project
 * root (found immediately) and the arms below pass a scratch directory that is not a project
 * at all (honoured as given, because it is explicit). What is refused is the implicit case
 * with no project above it — creating a claims directory there is how the registry splits
 * silently, and silence is the whole failure.
 */
function findRoot(start) {
	let dir = resolve(start)
	for (;;) {
		if (existsSync(join(dir, ".comm", "config.json"))) return dir
		const up = dirname(dir)
		if (up === dir) return null
		dir = up
	}
}
const ROOT_FLAG = opt("--root", null)
const ROOT = findRoot(ROOT_FLAG || process.cwd()) || (ROOT_FLAG ? resolve(ROOT_FLAG) : null)
const requireRoot = () => {
	if (!ROOT) die(`no project at or above ${process.cwd()} carries .comm/config.json.\n` +
		`  A claims directory created here would be invisible to every other agent — which is the one\n` +
		`  thing this tool exists to prevent. cd into the project, or pass --root <project>.`)
}

/**
 * Positional arguments, with the value-taking flags' values excluded.
 *
 * The list of BOOLEAN flags is explicit rather than inferred. The first version guessed —
 * "a token after a flag is that flag's value unless the flag is --force or --json" — which
 * is a rule that silently swallows the resource name the day somebody adds a third boolean.
 * A guess in an argument parser is how `claim take port:4173 --force` loses its resource.
 */
const BOOLEAN_FLAGS = new Set(["--force", "--json", "--quiet", "--prove-red"])
function positional(n) {
	const out = []
	for (let i = 0; i < ARGV.length; i++) {
		const a = ARGV[i]
		if (a.startsWith("--")) { if (!BOOLEAN_FLAGS.has(a)) i++; continue }
		out.push(a)
	}
	return out[n]
}
// THE VERB IS A POSITIONAL, resolved by the parser that knows which flags take values.
// It was `ARGV.find((a) => !a.startsWith("--"))` — the guess the comment above rejects,
// nine lines from the comment rejecting it (review #7 F12). `claim --root R take x` died
// with a usage error while `claim take x --root R` worked, and a flag value that happened
// to read `release` would have dispatched the destructive verb.
const verb = positional(0) || ""

/**
 * Is this claim held by ME? "Me" is the SESSION, not this command — a second `claim take`
 * from the same agent must refresh its own claim rather than refuse it, and the two run in
 * different processes. Compared against the CLI's own pid too, for the `holder: "self"` case.
 */
function isMine(rec) {
	if (!rec) return false
	const sp = sessionPid()
	return rec.pid === process.pid || (sp && rec.pid === sp)
}

/**
 * THE ONE RENDERER. `bin/boot.mjs` printed its own sentence for the same record and keyed on
 * `state` alone, so a claim whose `holder` is `"self"` — the pid of a command that has since
 * exited, exactly as this tool predicted on stderr when it wrote it — was reported to the
 * next agent at every session start as `a crash, not a stale lock` (review #7 F14). The
 * record has carried the field that tells them apart since the day it shipped; no reader
 * read it. Two readers with two sentences is how they start disagreeing, so there is one,
 * it is exported, and `list --json` carries its answer to boot rather than boot re-deriving.
 */
export function verdict(c) {
	switch (c.state) {
		case "held": return { mark: "●", note: "" }
		case "gone": return c.rec && c.rec.holder === "self"
			? { mark: "✗", note: "the COMMAND that took this has exited - no session ever held it and nothing crashed; --pid names the process that does" }
			: { mark: "✗", note: "HOLDER IS GONE: a crash, not a stale lock" }
		case "corrupt": return { mark: "?", note: c.setAside
			? `bytes this version cannot read, SET ASIDE at ${c.setAside} - something wrote here that should not have`
			: `BYTES THIS VERSION CANNOT READ, still at ${c.path} - something wrote here that should not have` }
		case "unreadable": return { mark: "?", note: `COULD NOT BE READ (${c.why}) - it may be live, and nothing here has touched it` }
		case "unknown": return { mark: "?", note: "holder CANNOT BE JUDGED (no start time, or written before this machine rebooted)" }
		case "free": return { mark: "·", note: "not claimed" }
		default: return { mark: "?", note: c.state }
	}
}

function describe(c) {
	// A name the bus did not confirm is printed as such: `by` is the one field that tells the
	// next agent whose terminal to walk to, and review #7 F11 found it reading "unnamed" for
	// every claim taken in the field's ordinary configuration.
	const src = c.rec && c.rec.by_source && c.rec.by_source !== "bus" ? ` [name ${c.rec.by_source}, unconfirmed]` : ""
	const who = c.rec ? `${c.rec.by || "someone"}${src} (pid ${c.rec.pid})` : "an unreadable record"
	const what = c.rec && c.rec.purpose ? ` for ${JSON.stringify(c.rec.purpose)}` : ""
	const when = c.rec && c.rec.at ? ` since ${c.rec.at}` : ""
	return `${who}${what}${when}`
}

/**
 * WHOSE NAME GOES IN `by`, and why this file asks the bus instead of answering itself.
 *
 * It read `--agent`, then `CLAUDE_COMM_AGENT`, then `"unnamed"` — a THIRD rule for identity
 * in a repository whose stated rule is that there is one (`CLAUDE.md`: *an agent name comes
 * from `.comm/config.json`, never from message text*). In the field's normal configuration
 * nobody exports that variable, so every claim taken by an agent the bus can name perfectly
 * well recorded `unnamed` (review #7 F11) — in the one field that tells the next agent whose
 * terminal to walk to.
 *
 * So it asks the bus, the same way the generated hook stub does: `comm.mjs whoami
 * --agent-root <cwd>`. That costs one short-lived spawn on `take` only; `list` and `release`
 * ask nobody. A `--agent` that CONTRADICTS the bus is refused rather than believed, which is
 * the rule `comm send` already enforces on `--from` (A6) — identity is not a thing to type.
 */
function busName() {
	const commPath = join(dirname(fileURLToPath(import.meta.url)), "comm.mjs")
	if (!existsSync(commPath)) return null
	const r = spawnSync(process.execPath, [commPath, "whoami", "--agent-root", process.cwd()],
		{ encoding: "utf8", timeout: 5000 })
	// Exit 1 is "no agent resolves here" and is a legitimate answer, not a failure: this
	// command is often run from a directory that is on no roster. Either way the fallback
	// below records WHERE the name came from, so no reader has to assume.
	if (r.status !== 0) return null
	const name = String(r.stdout || "").trim()
	return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name) ? name : null
}

function take() {
	requireRoot()
	const resource = positional(1)
	if (!resource) die("take needs a resource name, e.g. `take port:4173 --purpose \"vite dev server\"`")
	if (!safeResource(resource)) die(`a resource name must match ${RESOURCE_OK} and contain no "..", got ${JSON.stringify(resource)}`)
	const purpose = opt("--purpose", null)
	// A claim with no purpose is a lock, and this is not a lock. The whole value is that the
	// next agent reads WHY the thing is held and can decide; "held by pid 4242" tells them
	// nothing they can act on.
	if (!purpose) die("take needs --purpose: a claim nobody can read the reason for is a lock, and this does not lock anything")

	const cur = read(ROOT, resource)
	if (cur.state === "unreadable") die(`${cur.path} could not be read (${cur.why}) — refusing rather than overwriting a claim that may be live`, EX_IO)
	if (cur.state === "corrupt") {
		process.stderr.write(`claim: the record at ${cur.path} was not readable and was set aside at ${cur.setAside} — taking the resource\n`)
	}
	if (cur.state === "held" && !isMine(cur.rec) && !has("--force")) {
		process.stdout.write(`HELD by ${describe(cur)}\n  nothing has been changed. This is advice, not a lock: --force takes it over and says so.\n`)
		process.exit(EX_HELD)
	}
	if (cur.state === "gone") {
		// THE STATE THIS TOOL EXISTS FOR. Not "the lock expired" — the holder crashed, and
		// that is a fact worth printing rather than a condition to clear silently. Unless the
		// record says `holder: "self"`, in which case nothing crashed: the tool itself wrote a
		// claim held by a command it knew would exit (review #7 F14). Same renderer as `list`.
		process.stderr.write(`claim: ${resource} was claimed by ${describe(cur)} — ${verdict(cur).note}. Taking it.\n`)
	}
	if (cur.state === "unknown") {
		process.stderr.write(`claim: ${resource} carries a record whose holder cannot be judged (no start time or written before a reboot). Taking it, and saying so rather than guessing either way.\n`)
	}
	if (cur.state === "held" && has("--force") && !isMine(cur.rec)) {
		process.stderr.write(`claim: FORCING ${resource} away from ${describe(cur)} — that process is alive and does not know.\n`)
	}

	// WHOSE PID GOES IN THE FILE, and the first version of this got it exactly wrong.
	//
	// It recorded `process.pid` — the pid of THIS CLI, which exits milliseconds later. Every
	// claim therefore read as "HELD BY A DEAD PROCESS: a crash" within one second of being
	// taken, and the boot row said so about a resource nobody had crashed on. Six arms were
	// green while it did this: not one of them took a claim THROUGH the CLI and then read it
	// back, they all wrote fixture records with a pid chosen by the test. The measurement
	// that caught it was running the tool for real against a field project.
	//
	// The holder is whatever will still be alive while the resource is held:
	//   · `--pid <n>` when the caller knows it — a dev server, a container, a socket owner;
	//   · otherwise the SESSION, resolved by the one implementation this repo has of "which
	//     process is the agent" (`bin/session-registry.mjs`), because "this agent is holding
	//     port 4173" outlives every command the agent runs;
	//   · and if neither can be resolved, the CLI's own pid with `holder: "self"` recorded,
	//     so a reader can see the claim will read as gone immediately rather than wonder.
	const explicitPid = opt("--pid", null)
	let holderPid = null, holderKind = null
	if (explicitPid !== null) {
		holderPid = Number(explicitPid)
		if (!Number.isFinite(holderPid) || holderPid <= 0) die(`--pid must be a positive number, got ${JSON.stringify(explicitPid)}`)
		if (startTimeOf(holderPid) === null) die(`--pid ${holderPid} is not running — a claim for a dead holder is the state this tool reports, not one it writes`)
		holderKind = "explicit"
	} else {
		const sp = sessionPid()
		if (sp && startTimeOf(sp) !== null) { holderPid = sp; holderKind = "session" }
		else { holderPid = process.pid; holderKind = "self" }
	}
	if (holderKind === "self" && !has("--quiet")) {
		process.stderr.write(`claim: no agent session could be resolved, so this claim is held by the pid of this command (${holderPid}) and will read as GONE as soon as it exits. Pass --pid <n> for the process that actually holds ${resource}.\n`)
	}

	const declaredName = opt("--agent", null)
	const declaredEnv = (process.env.CLAUDE_COMM_AGENT || "").trim() || null
	const asked = busName()
	if (declaredName && asked && declaredName !== asked)
		die(`--agent ${JSON.stringify(declaredName)}, but the bus says this directory is ${JSON.stringify(asked)} — a claim's name is asked, never typed`)
	// A NAME THE BUS WAS ASKED ABOUT AND REFUSED is not the same as a name nobody could
	// check, and writing the first as if it were the second is review #7 F4's defect — the
	// declared-but-refused state read as honoured — reproduced one file over. `comm.mjs`
	// answers nothing for a CLAUDE_COMM_AGENT that is not in the roster (a typo, or a
	// deliberate off-bus declaration), so when a bus is present here and still could not
	// name us, the record says so and so does stderr.
	const busIsHere = !!(ROOT && existsSync(join(ROOT, ".comm", "config.json")))
	const typed = declaredName || declaredEnv
	const by = asked || typed || "unnamed"
	const by_source = asked ? "bus"
		: !typed ? "none"
		: busIsHere ? "refused-by-bus"
		: declaredName ? "flag" : "env"
	if (by_source === "refused-by-bus" && !has("--quiet"))
		process.stderr.write(`claim: the bus in ${ROOT} does not know ${JSON.stringify(by)}, so this claim records a name it REFUSED rather than one it confirmed. The next reader is told.\n`)

	const rec = {
		v: SCHEMA, at: new Date().toISOString(), resource,
		by, by_source,
		pid: holderPid, start: startTimeOf(holderPid), boot: bootId(), holder: holderKind,
		purpose,
	}
	const p = claimPath(ROOT, resource)
	try {
		mkdirSync(dirname(p), { recursive: true })
		const tmp = `${p}.tmp.${process.pid}`
		writeFileSync(tmp, JSON.stringify(rec) + "\n")
		renameSync(tmp, p)
	} catch (e) { die(`cannot write ${p}: ${(e && e.code) || e}`, EX_IO) }
	if (!has("--quiet")) process.stdout.write(`claimed ${resource} -> ${p}\n  ${JSON.stringify(rec)}\n`)
}

function list() {
	requireRoot()
	// `who` and `note` travel in the JSON so that bin/boot.mjs, the reader that prints this at
	// every session start, renders THIS answer instead of deriving a second one from `state`.
	const cs = allClaims(ROOT).map((c) => ({ ...c, ...verdict(c), who: describe(c) }))
	if (has("--json")) { process.stdout.write(JSON.stringify({ root: ROOT, claims: cs }) + "\n"); return }
	if (!cs.length) { process.stdout.write(`no claims in ${claimsDir(ROOT)}\n`); return }
	for (const c of cs) process.stdout.write(`  ${c.mark} ${c.resource.padEnd(20)} ${c.who}${c.note ? `  <- ${c.note}` : ""}\n`)
}

function release() {
	requireRoot()
	const resource = positional(1)
	if (!resource) die("release needs a resource name")
	if (!safeResource(resource)) die(`a resource name must match ${RESOURCE_OK}, got ${JSON.stringify(resource)}`)
	const cur = read(ROOT, resource)
	if (cur.state === "free") { process.stdout.write(`${resource} was not claimed\n`); process.exit(0) }
	// PROPERTY 3, IN THE BRANCH IT WAS MISSING FROM. `take` refuses to overwrite bytes it
	// cannot read; `release` unlinked them — and because the record was unreadable, `isMine`
	// was false, `state` was never "held", and the --force this file calls its one destructive
	// act was never asked for either (review #7 F6). Review #6 F6 was this same rule applied
	// to one branch and not its neighbour, in the file whose header cites review #6 F6.
	if (cur.state === "unreadable")
		die(`${cur.path} could not be read (${cur.why}) — refusing to delete a claim that may be live. Move it aside by hand if you mean to.`, EX_IO)
	if (cur.state === "corrupt") {
		// read() has already moved the bytes; there is nothing left to unlink, and printing
		// "released" would claim an action nobody took on a claim nobody could read.
		process.stdout.write(`${resource} carried bytes this version cannot read; they were SET ASIDE at ${cur.setAside} and the resource is now free\n`)
		process.exit(0)
	}
	if (cur.state === "unknown" && !has("--force"))
		die(`${resource} carries a record whose holder cannot be judged (no start time, or written before this machine rebooted) — it may be live, and deleting it destroys the only evidence of who wrote it. --force if you mean it.`, EX_HELD)
	// Releasing SOMEBODY ELSE's live claim is the one destructive thing here, so it is the
	// one thing that needs saying out loud rather than doing quietly.
	if (cur.state === "held" && !isMine(cur.rec) && !has("--force"))
		die(`${resource} is held by ${describe(cur)} and that process is alive — --force if you mean it`, EX_HELD)
	try { unlinkSync(cur.path) } catch (e) { die(`cannot remove ${cur.path}: ${(e && e.code) || e}`, EX_IO) }
	if (!has("--quiet")) process.stdout.write(`released ${resource}\n`)
}

// ── negative control ───────────────────────────────────────────────────────────────
/**
 * Every arm moves ONE variable against a control built in the same directory by the same
 * code. The third is the one `FINDINGS.md#claim-file` named in advance as the state a naive
 * implementation gets wrong, and the fourth is the one it did not: a recycled pid.
 */
function proveRed() {
	const dir = mkdtempSync(join(tmpdir(), "comm-claim-prove-"))
	process.on("exit", () => { try { rmSync(dir, { recursive: true, force: true }) } catch {} })
	let failed = 0
	const check = (name, pass, detail) => {
		console.log(`  ${pass ? "✓" : "✗"} ${name.padEnd(56)} ${detail}`)
		if (!pass) failed++
	}
	const self = fileURLToPath(import.meta.url)
	const run = (args) => spawnSync(process.execPath, [self, ...args, "--root", dir], { encoding: "utf8" })
	const write = (resource, rec) => {
		mkdirSync(claimsDir(dir), { recursive: true })
		writeFileSync(join(claimsDir(dir), `${resource}.json`), JSON.stringify(rec) + "\n")
	}
	const base = (over) => ({ v: SCHEMA, at: new Date().toISOString(), resource: "port:4173",
		by: "other", pid: process.pid, start: startTimeOf(process.pid), boot: bootId(),
		purpose: "vite dev server", ...over })

	console.log("\nclaim negative control - one variable per arm\n")

	// 1. CONTROL: a free resource. Every other arm is a deviation from this, and a tool that
	//    refused here would be unusable rather than careful.
	const free = run(["take", "port:4173", "--purpose", "dev server", "--quiet"])
	check("a free resource is taken", free.status === 0 && existsSync(join(claimsDir(dir), "port:4173.json")),
		`exit ${free.status}, file written=${existsSync(join(claimsDir(dir), "port:4173.json"))}`)

	// 2. ONE VARIABLE against 1: somebody else's pid, and that pid is ALIVE (this suite's
	//    own). It must refuse, name the holder, and change nothing.
	write("port:4174", base({ resource: "port:4174" }))
	const before = readFileSync(join(claimsDir(dir), "port:4174.json"), "utf8")
	const held = run(["take", "port:4174", "--purpose", "mine now", "--quiet"])
	const untouched = readFileSync(join(claimsDir(dir), "port:4174.json"), "utf8") === before
	check("a live holder refuses, and nothing is changed",
		held.status === EX_HELD && /HELD by/.test(held.stdout) && /vite dev server/.test(held.stdout) && untouched,
		`exit ${held.status} (want ${EX_HELD}), names the purpose=${/vite dev server/.test(held.stdout)}, file untouched=${untouched}`)

	// 3. THE ARM THE DESIGN NAMED IN ADVANCE: the holder is DEAD. A naive implementation
	//    blocks everybody forever here. It must be taken, and the crash must be REPORTED —
	//    silently clearing it would throw away the only evidence that a process died.
	//    Pid 2^22-1 is above every pid_max this can meet and is not in use.
	write("port:4175", base({ resource: "port:4175", pid: 4194303, start: 1 }))
	const dead = run(["take", "port:4175", "--purpose", "taking over", "--quiet"])
	check("a claim whose holder is GONE is taken, and the crash is reported",
		dead.status === 0 && /GONE/.test(dead.stderr) && /crash/.test(dead.stderr),
		`exit ${dead.status}, said GONE=${/GONE/.test(dead.stderr)}, called it a crash rather than a stale lock=${/crash/.test(dead.stderr)}`)

	// 4. THE ONE THE DESIGN DID NOT NAME: a RECYCLED pid. The pid is alive — it is this very
	//    process — and the start time says it is a different program than the one that wrote
	//    the claim. ONE VARIABLE against arm 2, which is byte-identical but for `start`.
	//    Reading this as "held" would block on a pid that belongs to somebody else entirely.
	write("port:4176", base({ resource: "port:4176", start: (startTimeOf(process.pid) || 0) + 12345 }))
	const recycled = run(["take", "port:4176", "--purpose", "after recycling", "--quiet"])
	check("a RECYCLED pid does not read as a live holder",
		recycled.status === 0 && /GONE/.test(recycled.stderr),
		`same live pid as arm 2, start time moved by 12345 ticks -> exit ${recycled.status} (want 0), reported gone=${/GONE/.test(recycled.stderr)}`)

	// 5. Property 3, and review #6 F6's lesson applied before the fact: bytes this cannot
	//    read are set aside, never deleted.
	mkdirSync(claimsDir(dir), { recursive: true })
	writeFileSync(join(claimsDir(dir), "port:4177.json"), "not json at all\n")
	const corrupt = run(["take", "port:4177", "--purpose", "over the rubble", "--quiet"])
	const aside = readdirSync(claimsDir(dir)).filter((f) => f.startsWith("port:4177.json.corrupt."))
	let asideBytes = ""
	try { asideBytes = readFileSync(join(claimsDir(dir), aside[0]), "utf8") } catch {}
	check("bytes it cannot read are set aside, never dropped",
		corrupt.status === 0 && aside.length === 1 && /not json at all/.test(asideBytes),
		`exit ${corrupt.status}, set aside=${aside.length}, original bytes survived=${/not json at all/.test(asideBytes)}`)

	// 6. It ADVISES. --force must work and must say so — a tool that could never take over
	//    would be a lock, which property 2 says this is not.
	const forced = run(["take", "port:4174", "--purpose", "forced", "--force", "--quiet"])
	check("--force takes a live claim over, loudly",
		forced.status === 0 && /FORCING/.test(forced.stderr),
		`exit ${forced.status}, announced=${/FORCING/.test(forced.stderr)}`)

	// 7. THE ARM THAT WAS MISSING, and reality found the defect before it did.
	//
	//    Arms 1-6 all WROTE fixture records with a pid the test chose. Not one of them took a
	//    claim through the CLI and then read it back — so `take` recording `process.pid`, the
	//    pid of a command that exits milliseconds later, left all six green while every real
	//    claim read as "HELD BY A DEAD PROCESS: a crash" within one second of being taken.
	//    It was caught by running the tool against a live field project, which is the only
	//    reason it is not still there.
	//
	//    So: take it the way a person does, then ask the way a reader does.
	const round = run(["take", "port:5173", "--purpose", "round trip", "--quiet"])
	let back = null
	try { back = JSON.parse(run(["list", "--json"]).stdout).claims.find((c) => c.resource === "port:5173") } catch {}
	check("a claim taken through the CLI still reads as HELD afterwards",
		round.status === 0 && back && back.state === "held",
		`take -> exit ${round.status}; read back -> state=${back && back.state} (want held), ` +
		`holder=${back && back.rec && back.rec.holder} (the CLI's own pid would be "self" and would read gone)`)

	// 8. A claim is never WRITTEN for a holder that is already dead. Reporting a dead holder
	//    is this tool's job (arm 3); recording one is manufacturing the evidence.
	const deadPid = run(["take", "port:5174", "--purpose", "for a corpse", "--pid", "4194303", "--quiet"])
	check("a claim for an already-dead --pid is refused, not written",
		deadPid.status !== 0 && !existsSync(join(claimsDir(dir), "port:5174.json")),
		`exit ${deadPid.status} (want non-zero), file written=${existsSync(join(claimsDir(dir), "port:5174.json"))}`)

	// ── the arms review #7 found missing, and one of them found the headline ──────────
	//
	// Arms 1-8 all pass `--root <tmpdir>` explicitly, so not one of them ever exercised root
	// RESOLUTION — the same fixture blind spot that hid the pid defect, one layer out: the
	// arms chose the root the way they had chosen the pid. Everything below runs the CLI the
	// way an agent does, from a cwd, with no --root at all.

	// Two directories that ARE one project, and two that are not: the deviation is the
	// positive control, and it is what the old code did to every project.
	const proj = join(dir, "proj")
	mkdirSync(join(proj, ".comm"), { recursive: true })
	mkdirSync(join(proj, "app"), { recursive: true })
	mkdirSync(join(proj, "api"), { recursive: true })
	writeFileSync(join(proj, ".comm", "config.json"),
		JSON.stringify({ leader: "leader", agents: { leader: ".", app: "app", api: "api" } }))
	const runIn = (cwd, args, env) => spawnSync(process.execPath, [self, ...args],
		{ cwd, encoding: "utf8", env: { ...process.env, ...(env || {}) } })
	const claimJsons = (under) => {
		const out = []
		const walk = (d) => {
			for (const e of readdirSync(d, { withFileTypes: true })) {
				const q = join(d, e.name)
				if (e.isDirectory()) walk(q)
				else if (e.name.endsWith(".json") && dirname(q).endsWith(`${sep}claims`)) out.push(q)
			}
		}
		try { walk(under) } catch {}
		return out
	}

	// 9. THE HEADLINE (review #7 F1). Two agents standing in two subdirectories of ONE
	//    project must contend. The first holder is this suite's own pid — alive, and not the
	//    session — so the second take is somebody else's claim rather than a refresh.
	const a9first = runIn(join(proj, "app"), ["take", "port:4173", "--purpose", "vite dev server", "--pid", String(process.pid), "--quiet"])
	const a9second = runIn(join(proj, "api"), ["take", "port:4173", "--purpose", "mine too", "--quiet"])
	const a9files = claimJsons(proj)
	check("two agents in one project's subdirectories CONTEND",
		a9first.status === 0 && a9second.status === EX_HELD && a9files.length === 1,
		`app/ take exit ${a9first.status}, api/ take exit ${a9second.status} (want ${EX_HELD}), ` +
		`claim files under the project: ${a9files.length} (want 1) -> ${a9files.map((f) => f.slice(proj.length + 1)).join(", ") || "none"}`)

	//    POSITIVE CONTROL for 9: the same two commands where the two directories really are
	//    two projects. Two files, two exit-0s — the shape the assertion above forbids, proving
	//    it is not vacuous. This is exactly what the shipped tool did for ONE project.
	const two = join(dir, "two")
	for (const sub of ["a", "b"]) {
		mkdirSync(join(two, sub, ".comm"), { recursive: true })
		writeFileSync(join(two, sub, ".comm", "config.json"), JSON.stringify({ leader: "leader", agents: { leader: "." } }))
	}
	const c1 = runIn(join(two, "a"), ["take", "port:4173", "--purpose", "x", "--pid", String(process.pid), "--quiet"])
	const c2 = runIn(join(two, "b"), ["take", "port:4173", "--purpose", "y", "--pid", String(process.pid), "--quiet"])
	const cFiles = claimJsons(two)
	check("  positive control: two real projects do NOT contend",
		c1.status === 0 && c2.status === 0 && cFiles.length === 2,
		`exits ${c1.status}/${c2.status} (want 0/0), claim files: ${cFiles.length} (want 2) - the arm above can see this shape`)

	// 10. Nowhere is not a project. Creating `.comm/claims/` in an arbitrary directory is the
	//     silent split itself, so the answer is a refusal that says where to stand.
	const nowhere = mkdtempSync(join(tmpdir(), "comm-claim-nowhere-"))
	process.on("exit", () => { try { rmSync(nowhere, { recursive: true, force: true }) } catch {} })
	const orphan = runIn(nowhere, ["take", "port:4173", "--purpose", "nowhere", "--quiet"])
	const madeDir = existsSync(join(nowhere, ".comm"))
	const explicit = runIn(nowhere, ["take", "port:4173", "--purpose", "explicit", "--root", nowhere, "--quiet"])
	check("no project above cwd REFUSES, and an explicit --root still works",
		orphan.status !== 0 && !madeDir && /config\.json/.test(orphan.stderr) && explicit.status === 0,
		`implicit exit ${orphan.status} (want non-zero), created .comm/=${madeDir} (want false); ` +
		`positive control --root exit ${explicit.status} (want 0)`)

	// 11. Property 3 in `release` (review #7 F6): zero of arms 1-8 exercised release at all,
	//     and it destroyed the bytes `take` refuses to touch.
	const rel = join(claimsDir(dir), "port:4178.json")
	write("port:4178", base({ resource: "port:4178" }))
	let chmodWorked = true
	try { chmodSync(rel, 0o000); readFileSync(rel, "utf8"); chmodWorked = false } catch {}
	const relBad = run(["release", "port:4178"])
	const survived = existsSync(rel)
	try { chmodSync(rel, 0o644) } catch {}
	const relOk = run(["release", "port:4178", "--force"])
	check("release REFUSES bytes it cannot read, and still releases bytes it can",
		chmodWorked && relBad.status !== 0 && survived && relOk.status === 0 && !existsSync(rel),
		chmodWorked
			? `unreadable: exit ${relBad.status} (want non-zero), file survived=${survived}; readable: exit ${relOk.status}, removed=${!existsSync(rel)}`
			: "SKIPPED-AS-FAILURE: chmod 000 was still readable (running as root?), so this arm proved nothing")

	// 12. A `holder: "self"` claim is a prediction this tool MADE and warned about on stderr;
	//     reporting it back as evidence of a crash is a false alarm at every session start
	//     (review #7 F14). One variable: the `holder` field, same dead pid, same everything.
	write("port:4179", base({ resource: "port:4179", pid: 4194303, start: 1, holder: "self" }))
	write("port:4180", base({ resource: "port:4180", pid: 4194303, start: 1, holder: "session" }))
	const listed = run(["list"]).stdout
	const selfLine = listed.split("\n").find((l) => l.includes("port:4179")) || ""
	const sessLine = listed.split("\n").find((l) => l.includes("port:4180")) || ""
	check("a dead SELF-held claim is not reported as a crash",
		/nothing crashed/.test(selfLine) && !/a crash/.test(selfLine) && /a crash/.test(sessLine),
		`holder:"self" -> ${JSON.stringify(selfLine.trim().slice(-60))}; ` +
		`positive control holder:"session" says crash=${/a crash/.test(sessLine)}`)

	// 13. The verb is a positional, not the first token that is not a flag (review #7 F12).
	//     Two shapes the old resolver got wrong: a flag BEFORE the verb, and a flag value that
	//     happens to spell the destructive verb.
	const flagFirst = run(["--purpose", "dev", "take", "port:4181"])
	const valueIsAVerb = run(["take", "port:4182", "--purpose", "release", "--quiet"])
	check("the verb survives a leading flag and a value that spells one",
		flagFirst.status === 0 && existsSync(join(claimsDir(dir), "port:4181.json")) &&
		valueIsAVerb.status === 0 && existsSync(join(claimsDir(dir), "port:4182.json")),
		`--purpose dev take ... -> exit ${flagFirst.status}, written=${existsSync(join(claimsDir(dir), "port:4181.json"))}; ` +
		`--purpose release -> exit ${valueIsAVerb.status}, written=${existsSync(join(claimsDir(dir), "port:4182.json"))} (a release dispatch would have unlinked it)`)

	// 14. The name is ASKED, not typed (review #7 F11). In the field's ordinary configuration
	//     nobody exports CLAUDE_COMM_AGENT, so `by` read `unnamed` for every claim taken by an
	//     agent the bus can name exactly — in the one field that tells the next agent whose
	//     terminal to walk to. Three states, one variable each.
	const askedTake = runIn(join(proj, "app"), ["take", "port:5555", "--purpose", "asked", "--pid", String(process.pid), "--quiet"])
	const recOf = (root, r) => { try { return JSON.parse(readFileSync(join(claimsDir(root), `${r}.json`), "utf8")) } catch { return null } }
	const askedRec = recOf(proj, "port:5555")
	check("`by` is the bus's answer where the bus can answer",
		askedTake.status === 0 && askedRec && askedRec.by === "app" && askedRec.by_source === "bus",
		`in proj/app -> by=${askedRec && askedRec.by} source=${askedRec && askedRec.by_source} (want app/bus; the shipped version recorded "unnamed" here)`)

	//     ONE VARIABLE: a declaration the roster does not contain. `comm.mjs whoami` refuses
	//     it — which is the bus REFUSING a name, not a bus that could not be reached — and a
	//     record that stored it as if it were a name would be F4's defect one file over.
	const lieTake = runIn(join(proj, "api"), ["take", "port:5556", "--purpose", "lying", "--pid", String(process.pid)],
		{ CLAUDE_COMM_AGENT: "a-lie" })
	const lieRec = recOf(proj, "port:5556")
	check("a name the bus REFUSED is recorded as refused, and said out loud",
		lieRec && lieRec.by_source === "refused-by-bus" && /does not know/.test(lieTake.stderr),
		`CLAUDE_COMM_AGENT=a-lie in proj/api -> source=${lieRec && lieRec.by_source} (want refused-by-bus), stderr warned=${/does not know/.test(lieTake.stderr)}`)

	//     POSITIVE CONTROL: the same lie where there is no bus to refuse it. Nothing was
	//     asked, so nothing was refused, and the record says `env` — a different answer from
	//     the same environment, which is what proves the arm above is measuring the bus.
	const noBus = runIn(dir, ["take", "port:5557", "--purpose", "off the bus", "--root", dir, "--quiet"], { CLAUDE_COMM_AGENT: "a-lie" })
	const noBusRec = recOf(dir, "port:5557")
	const forged = runIn(join(proj, "app"), ["take", "port:5558", "--purpose", "typed", "--agent", "leader", "--quiet"])
	check("  positive control: off the bus it is `env`, and a contradicting --agent is refused",
		noBus.status === 0 && noBusRec && noBusRec.by === "a-lie" && noBusRec.by_source === "env" && forged.status !== 0,
		`no config.json above -> by=${noBusRec && noBusRec.by} source=${noBusRec && noBusRec.by_source} (want a-lie/env); ` +
		`--agent leader while the bus says app -> exit ${forged.status} (want non-zero)`)

	console.log(`\n${failed ? `✗ ${failed} claim propert(y/ies) NOT demonstrated` : "✓ every claim property demonstrated by a moved variable"}\n`)
	process.exit(failed ? 1 : 0)
}

// DISPATCH LAST, and that is not style. Function declarations hoist and `const` does not,
// so a dispatch at the top ran `positional()` before `BOOLEAN_FLAGS` existed and every verb
// died with a ReferenceError - caught by this file's own arms on their first run, all six
// red at once, which is what a suite is for.
if (has("--prove-red")) proveRed()
else if (verb === "take") take()
else if (verb === "list") list()
else if (verb === "release") release()
else die("usage: claim.mjs take <resource> --purpose <why> | list | release <resource>  [--root <dir>]")
