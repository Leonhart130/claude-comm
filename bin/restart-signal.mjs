#!/usr/bin/env node
/**
 * claude-comm RESTART SIGNAL — the one thing that survives a restart.
 *
 *   node bin/restart-signal.mjs arm --agent leader --prev-session <id> [--ttl 900]
 *   node bin/restart-signal.mjs peek  [--agent leader]      read, do NOT consume
 *   node bin/restart-signal.mjs claim [--agent leader]      read AND consume (one-shot)
 *
 * WHY THIS FILE EXISTS. `bin/ledger.mjs` asks whether the fifteen minutes after a restart
 * cost us a defect, and it cannot answer, because at the `SessionStart` hook a relaunch
 * and a cold start are THE SAME EVENT. Measured 2026-09-04: the `~/Dev/work` leader was
 * restarted deliberately by his owner — the cleanest reboot available — and the ledger
 * filed it as cold, because `prev_session` was null because nothing carried it across.
 * The reboot arm was not under-filled, it was UNREACHABLE. `FINDINGS.md#reboot-signal`.
 *
 * The fix is his, and it is the cheap one: THE RESTARTING PARTY KNOWS IT IS A RESTART, so
 * let it say so. This file is that saying-so, as a file on disk — the project's own rule
 * (`the file is the artifact`) applied to its own lifecycle.
 *
 * ── FOUR PROPERTIES, each of them a way this could produce a confident wrong number ──
 *
 * 1. IT IS ONE-SHOT, ENFORCED BY THE FILESYSTEM AND NOT BY CARE. `claim()` renames before
 *    it reads. `rename` is atomic, so of two sessions starting at the same instant exactly
 *    one gets the signal and the other gets nothing. A read-then-unlink would give BOTH of
 *    them a reboot, which is the failure that inflates the arm being measured — the arm
 *    this whole mechanism exists to fill. Cheap to get wrong, invisible afterwards.
 *
 * 2. IT CARRIES ITS OWN EXPIRY AND DOES NOT APPLY IT. This is the mechanism's one real
 *    weakness: a signal armed for a restart THAT NEVER HAPPENS waits on disk and mislabels
 *    whatever start comes next. So the armer declares how long its promise is good for,
 *    `claim()` reports the age it measured, and `classify()` in the ledger — one function,
 *    correctable later, re-read over every record ever written — decides. Storing
 *    "this was fresh" here would freeze today's guess into the data (ledger property 1).
 *
 * 3. A SIGNAL THIS FILE REFUSES IS SET ASIDE, NEVER DROPPED. An unparseable signal means
 *    something wrote here that should not have, and a silent `catch {}` would turn that
 *    into a reboot recorded as a cold start — the exact hole this file was built to close.
 *    Widened 2026-09-05 (review #6 F6) from "cannot read" to "refuses", because the
 *    property was written about the parser and the WRITER is what it is really about: a
 *    note whose `agent` disagrees with the filename it was found under is a stronger claim
 *    that somebody wrote here who should not have, and that branch was deleting it. Both
 *    refusals now leave the bytes behind — `.corrupt.<ts>` and `.mismatch.<ts>` — and both
 *    report the path they left them at.
 *
 * 4. AN AGENT NAME BECOMES A FILENAME, so it is contained structurally, not trusted. Same
 *    rule, same regex, same reason as `bin/ledger.mjs`.
 *
 * WHAT THIS FILE DOES NOT DO. It does not restart anything, and it does not know how. It
 * is the note the restarter leaves; who leaves it — a human hand, a `handoff`, a future
 * self-reboot — is that party's business, and every one of them is a liar this file cannot
 * detect. What it CAN do is make the lie visible downstream: `by` and `by_pid` say who
 * claimed to be restarting, and the age says whether the restart plausibly followed.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SCHEMA = 1
// A default, and named as one. A restart driven by a program takes seconds; one driven by
// a human hand — which is every restart this project has actually observed — takes as long
// as the human takes. Be exact about what this bounds, in the ~/Dev/work leader's words:
// **it does not bound staleness on disk, it bounds how long a human may take.** Two sessions
// with identical hygiene land in different arms because one owner answered a message faster.
// That is a real cost of this design, it is not fixable by choosing a bigger number, and it
// is why `arm` is cheap to re-run: the fix is to arm LAST, not to promise longer. 15 minutes is generous enough for the second and short enough that a
// signal abandoned at the end of a workday is dead by morning. The armer overrides it, the
// record stores it, and the ledger applies it: three places to correct this, none of them
// a number frozen into data.
const DEFAULT_TTL_S = 900

// An agent name becomes a FILENAME. Identical to bin/ledger.mjs's rule, deliberately
// duplicated rather than imported: each file guards its own filesystem boundary, and a
// shared helper is one refactor away from being relaxed for a caller that is not this one.
const AGENT_OK = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
export const safeAgent = (a) => typeof a === "string" && AGENT_OK.test(a) && !a.includes("..")

/** `<root>/.comm/restart/` — beside the handoff, in the same gitignored live-state territory. */
export function signalDir(root) {
	return join(resolve(root), ".comm", "restart")
}
export function signalPath(root, agent) {
	if (!safeAgent(agent)) return null
	return join(signalDir(root), `${agent}.json`)
}

/**
 * Leave the note. Returns {ok, path} or {ok:false, why} — it never throws, because its
 * callers are a hook and a session about to die, and neither may be broken by an
 * instrument. A failed arm is a reboot that files as cold: bad data, not a bad session.
 */
export function arm({ root, agent, prevSession = null, ttlS = DEFAULT_TTL_S, by = null, byPid = process.pid, at = null }) {
	try {
		if (!safeAgent(agent)) return { ok: false, why: `agent must match ${AGENT_OK} — it becomes a filename` }
		const ttl = Number(ttlS)
		// A ttl of 0, NaN or -1 would silently mean "never fresh", i.e. an armed signal that
		// can never be honoured: a mechanism that reports success and measures nothing.
		if (!Number.isFinite(ttl) || ttl <= 0) return { ok: false, why: `--ttl must be a positive number of seconds, got ${JSON.stringify(ttlS)}` }
		const p = signalPath(root, agent)
		mkdirSync(dirname(p), { recursive: true })
		const rec = {
			v: SCHEMA,
			at: at || new Date().toISOString(),
			agent,
			// The predecessor's id, not a boolean. A flag would say "a restart happened"; this
			// says WHICH session was restarted, which is the field `prev_session` has always
			// had and always been null, and it is checkable against that session's own records.
			prev_session: prevSession || null,
			ttl_s: ttl,
			by: by || null,
			by_pid: byPid,
		}
		// Atomic publish: a reader must never meet a half-written signal. Same idiom as
		// .boot-state.json, for the same reason.
		const tmp = `${p}.${process.pid}.${Date.now()}.tmp`
		writeFileSync(tmp, JSON.stringify(rec) + "\n")
		renameSync(tmp, p)
		return { ok: true, path: p, record: rec }
	} catch (e) {
		return { ok: false, why: (e && e.message) || String(e) }
	}
}

function parseSignal(text) {
	const d = JSON.parse(text)
	if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error("not an object")
	return d
}

/** Age in seconds, or null when the stamp is unusable. Never negative-by-clamping: a
 *  signal stamped in the FUTURE is evidence of a clock or a forgery, and clamping it to 0
 *  would hand it the freshest possible reading. It is returned as it measured. */
function ageOf(rec, now) {
	const t = Date.parse(rec && rec.at)
	if (!Number.isFinite(t)) return null
	return (now - t) / 1000
}

/**
 * Read WITHOUT consuming. For an operator, a report, a boot row — never for recording,
 * because a peek is exactly the read that lets two sessions both call themselves reboots.
 */
export function peek({ root, agent, now = Date.now() }) {
	const p = signalPath(root, agent)
	if (!p) return { ok: false, why: "unsafe agent name" }
	try {
		if (!existsSync(p)) return { ok: true, signal: null }
		const rec = parseSignal(readFileSync(p, "utf8"))
		return { ok: true, signal: rec, age_s: ageOf(rec, now) }
	} catch (e) {
		return { ok: false, why: (e && e.message) || String(e) }
	}
}

/**
 * Take the note, once. Returns:
 *   { ok:true, signal:null }                      nothing was waiting
 *   { ok:true, signal:{...}, age_s }              this caller got it; nobody else can
 *   { ok:false, why, setAside }                   something was there and was unreadable
 *
 * The rename is the whole mechanism. Everything after it is bookkeeping on a file only
 * this process can still see.
 */
export function claim({ root, agent, now = Date.now(), pid = process.pid }) {
	const p = signalPath(root, agent)
	if (!p) return { ok: false, why: "unsafe agent name" }
	const mine = `${p}.claimed.${pid}.${now}`
	try {
		renameSync(p, mine)
	} catch (e) {
		// ENOENT is the overwhelmingly common case: no restart was signalled. Anything else
		// (a permission failure, a directory in the way) is a signal that may still be
		// sitting there, and reporting it as "nothing waiting" is the comfortable lie.
		if (e && e.code === "ENOENT") return { ok: true, signal: null }
		return { ok: false, why: (e && e.message) || String(e) }
	}
	let text = ""
	try {
		text = readFileSync(mine, "utf8")
	} catch (e) {
		return { ok: false, why: `the signal was claimed but could not be read (${(e && e.message) || e})` }
	}
	let rec = null
	try {
		rec = parseSignal(text)
	} catch (e) {
		// Property 3. Keep the bytes, under a name nothing claims, so the next operator can
		// see what wrote here. Deleting them would erase the only evidence of the writer.
		const aside = `${p}.corrupt.${now}`
		try { renameSync(mine, aside) } catch {}
		return { ok: false, why: `the restart signal was unreadable (${(e && e.message) || e})`, setAside: aside }
	}
	// A signal addressed to somebody else must not be honoured just because it was found in
	// this agent's file. The filename is the address; `agent` inside is the writer's claim
	// about it, and a disagreement is either tampering or a writer bug.
	//
	// CHECKED BEFORE THE UNLINK — review #6 F6. It ran AFTER it, so the one branch that
	// means "somebody wrote here who should not have" destroyed `by`, `by_pid` and the whole
	// note, while the weaker branch above — bytes this file merely cannot parse — sets them
	// aside under `.corrupt.<ts>`. Property 3 is written for the WRITER, not for the parser:
	// a note that names another agent is a stronger instance of the same thing, and it was
	// the only case where nothing survived to be looked at. Demonstrated by the reviewer:
	// claim refused with exit 65 and `.comm/restart/` was empty afterwards.
	//
	// The one-shot property is untouched: the rename above already took the file out of the
	// claimable path, so setting it aside cannot hand it to a second claimer.
	if (rec.agent && rec.agent !== agent) {
		const aside = `${p}.mismatch.${now}`
		try { renameSync(mine, aside) } catch {}
		return { ok: false, why: `the signal in ${agent}.json names agent ${JSON.stringify(rec.agent)}`, mismatch: true, setAside: aside }
	}
	try { unlinkSync(mine) } catch { /* consumed either way: the rename already took it */ }
	return { ok: true, signal: rec, age_s: ageOf(rec, now) }
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────

const ARGV = process.argv.slice(2)
const has = (f) => ARGV.includes(f)
function opt(flag, dflt = null) {
	const i = ARGV.indexOf(flag)
	if (i === -1) return dflt
	const v = ARGV[i + 1]
	// A flag whose value was eaten by the next flag must be refused, never defaulted:
	// `--agent --root x` would otherwise arm a signal for an agent called "--root".
	if (v === undefined || v.startsWith("--")) {
		process.stderr.write(`restart-signal: ${flag} needs a value\n`)
		process.exit(64)
	}
	return v
}

/** Same resolution order as the ledger: --root, then an upward search for .comm/, then this checkout. */
function rootDir() {
	const explicit = opt("--root", null)
	if (explicit) return resolve(explicit)
	let dir = process.cwd()
	for (;;) {
		if (existsSync(join(dir, ".comm"))) return dir
		const up = dirname(dir)
		if (up === dir) break
		dir = up
	}
	return dirname(dirname(fileURLToPath(import.meta.url)))
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const verb = ARGV[0]
	const root = rootDir()
	const agent = opt("--agent", process.env.CLAUDE_COMM_AGENT || null)
	if (!["arm", "peek", "claim"].includes(verb || "")) {
		process.stderr.write("usage: restart-signal.mjs arm|peek|claim --agent <name> [--prev-session <id>] [--ttl <s>] [--by <who>] [--root <dir>]\n")
		process.exit(64)
	}
	if (!agent) {
		process.stderr.write("restart-signal: needs --agent (or CLAUDE_COMM_AGENT)\n")
		process.exit(64)
	}
	if (verb === "arm") {
		const r = arm({ root, agent, prevSession: opt("--prev-session", null), ttlS: opt("--ttl", DEFAULT_TTL_S), by: opt("--by", "hand") })
		if (!r.ok) { process.stderr.write(`restart-signal: ${r.why}\n`); process.exit(65) }
		if (!has("--quiet")) process.stdout.write(`armed ${r.path}\n  ${JSON.stringify(r.record)}\n`)
		process.exit(0)
	}
	const r = verb === "peek" ? peek({ root, agent }) : claim({ root, agent })
	if (!r.ok) { process.stderr.write(`restart-signal: ${r.why}${r.setAside ? ` (set aside at ${r.setAside})` : ""}\n`); process.exit(65) }
	process.stdout.write(JSON.stringify(r.signal === null ? { signal: null } : { signal: r.signal, age_s: r.age_s }) + "\n")
	// A missing signal is not an error, but it is not a success either: exit 3 lets a shell
	// tell "no restart was signalled" from "a restart was signalled" without parsing JSON.
	process.exit(r.signal === null ? 3 : 0)
}
