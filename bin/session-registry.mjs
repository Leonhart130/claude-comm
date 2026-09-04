#!/usr/bin/env node
/**
 * claude-comm SESSION REGISTRY - which transcript is a pid writing NOW.
 *
 *   node bin/session-registry.mjs          list what this machine has recorded
 *
 * Written because the obvious answer was wrong, silently, with exit 0.
 * `bin/context.mjs` resolved pid -> transcript through the descriptor a session holds
 * on `/tmp/claude-<uid>/<slug>/<uuid>/`, and that uuid names the session the PROCESS
 * WAS LAUNCHED AS - permanently. A `/clear` mints a new session and a new transcript,
 * the process keeps the old scratch directory open, and the sensor then reports a DEAD
 * session's final context as if it were the live one (`FINDINGS.md#clear-blind`).
 *
 * A self-rebooting leader IS a cleared session by construction, and its pre-clear
 * context is large by definition - so the trigger would have re-fired at once and the
 * agent would have rebooted forever, looking from outside exactly like the feature
 * working.
 *
 * MEASURED, not assumed: the SessionStart hook is handed the LIVE session's
 * `transcript_path`. This repo's own ledger carries the proof - at 10:41:04 on
 * 2026-09-04 a `clear` start was recorded as session `57ede2e1` while that same
 * process's scratch directory still named `803208db`. The hook sees the live session.
 * Nothing else on this machine does, which is why this file exists at all.
 *
 * Four properties, each of them a way this could have been built wrong:
 *
 * 1. KEYED BY (pid, start time, boot id) - NEVER BY pid ALONE. Pids are recycled, and a
 *    recycled pid answering confidently would be the identical failure this file exists
 *    to remove. Start time alone is not enough either: it is measured in ticks since
 *    BOOT, so across a reboot a pid could carry the same pair honestly. Any mismatch is
 *    a MISS.
 *
 * 2. IT LIVES WHERE PIDS LIVE, not where projects do. A pid is a machine-global name; a
 *    per-project registry would look the same pid up in whichever project the reader
 *    happened to be standing in. `$XDG_RUNTIME_DIR` is user-private, is tmpfs, and is
 *    emptied at logout - the exact lifetime of the pids it keys.
 *
 * 3. ONE FILE PER PID, not one shared JSON. `FINDINGS.md#clear-blind` decided
 *    `sessions.json`; the REASON it gave was about location, and that is kept exactly.
 *    The layout differs because a shared file is read-modify-write, and "two interleaved
 *    writers lose one update" is already an open, unmeasured risk on this repo's own
 *    `.boot-state.json` (STATUS.md, what was NOT verified). Here a lost update means a
 *    session that cannot be resolved at all, and the whole value of this thing is that
 *    unresolvable stays rare. A per-pid file has no merge to lose.
 *
 * 4. A MISS REFUSES. The reader never falls back to the scratch-directory resolution
 *    this replaces. That answer is plausible, in range, and wrong - strictly worse than
 *    no answer, because a loop cannot tell it from a good one. Refusal it can.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, renameSync, statSync } from "node:fs"
import { join, basename } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * The boot id changes on every boot, and a pid's start time is ticks since THAT boot.
 * Without it, `/tmp` surviving a reboot (which is not guaranteed either way) could let a
 * stale entry match a fresh process on both pid and start time. Three lines to close a
 * class of wrong answer.
 */
const BOOT_ID = (() => {
	try { return readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim() || null } catch { return null }
})()

/**
 * `CLAUDE_COMM_RUNTIME` is a TEST SEAM and nothing else: the negative controls must build
 * their own registry rather than write into the machine's, exactly as `CLAUDE_COMM_PROJECTS`
 * does for transcripts. The `/tmp` fallback keeps the tool usable where `XDG_RUNTIME_DIR`
 * is unset (a bare `su`, a cron shell); property 1 is what makes that safe rather than
 * merely convenient.
 */
export function registryDir() {
	const base = process.env.CLAUDE_COMM_RUNTIME || process.env.XDG_RUNTIME_DIR
	if (base) return join(base, "claude-comm", "sessions")
	const uid = typeof process.getuid === "function" ? process.getuid() : "nouid"
	return `/tmp/claude-comm-${uid}/sessions`
}

/**
 * Field 22 of /proc/<pid>/stat. The comm field is parenthesised and may contain spaces
 * and parens itself, so the split starts after the LAST ')' - the same idiom boot.mjs
 * uses for ppid. After that slice, index 0 is field 3, so starttime is index 19.
 */
export function startTimeOf(pid) {
	try {
		const s = readFileSync(`/proc/${pid}/stat`, "utf8")
		const f = s.slice(s.lastIndexOf(")") + 2).split(" ")
		if (f.length <= 19) return null
		const t = Number(f[19])
		return Number.isFinite(t) && t >= 0 ? t : null
	} catch { return null }
}

/**
 * The nearest ancestor that IS the session, by argv[0]. Walk up, do not match the whole
 * chain: on this box the session's argv is exactly `claude`, its parent is the shell and
 * its grandparent kitty, so a chain match would also match kitty and init.
 *
 * ONE implementation, deliberately. It was written twice already - boot's row 1 and
 * context's own-session path - and the field hook stub was about to make three. An
 * identity rule with three copies is an identity rule that will disagree with itself,
 * and this project has already paid for that once: `whoami` in the bus exists because
 * two ways of naming an agent produced two different answers and the log recorded the
 * wrong one. The registry is this rule's natural home, because a registry keyed on a pid
 * is the thing that has to agree with everyone about which pid that is.
 */
export function sessionPid(from = process.pid) {
	const ppidOf = (pid) => {
		try {
			const st = readFileSync(`/proc/${pid}/stat`, "utf8")
			return Number(st.slice(st.lastIndexOf(")") + 2).split(" ")[1]) || 0
		} catch { return 0 }
	}
	const argv0 = (pid) => {
		try { return basename(readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0")[0] || "") } catch { return "" }
	}
	let pid = from
	for (let i = 0; i < 12 && pid > 1; i++) {
		if (argv0(pid) === "claude") return pid
		pid = ppidOf(pid)
	}
	return 0
}

/** Read one entry, or null. Never throws - a corrupt entry is a miss, not a crash. */
function readEntry(p) {
	try { return JSON.parse(readFileSync(p, "utf8")) } catch { return null }
}

/**
 * Drop entries whose process is gone, was replaced, or predates this boot.
 *
 * The registry is unbounded otherwise: one file per session ever started, in a tmpfs.
 * A `.tmp-` leftover is only removed once it is a minute old - a younger one may belong
 * to a writer that is between `writeFileSync` and `renameSync` right now, and deleting
 * that would make an honest write fail.
 */
function prune(dir) {
	let names = []
	try { names = readdirSync(dir) } catch { return }
	for (const n of names) {
		const p = join(dir, n)
		const m = n.match(/^(\d+)\.json$/)
		if (!m) {
			if (!/\.tmp-\d+$/.test(n)) continue
			try { if (Date.now() - statSync(p).mtimeMs > 60_000) unlinkSync(p) } catch {}
			continue
		}
		const r = readEntry(p)
		const pid = Number(m[1])
		if (r && r.pid === pid && r.boot === BOOT_ID && startTimeOf(pid) === r.start) continue
		try { unlinkSync(p) } catch {}
	}
}

/**
 * Record pid -> transcript. Called ONLY from the SessionStart hook, because that is the
 * only caller holding the live session's path on authority rather than by inference.
 * Every failure returns a reason: a registry that silently did not write would read,
 * later, as a machine with no sessions on it.
 */
export function record({ pid, transcript, agent, source }) {
	if (!pid) return { ok: false, why: "no session pid could be resolved - nothing to key an entry on" }
	if (!transcript) return { ok: false, why: "the hook payload carried no transcript_path" }
	if (!BOOT_ID) return { ok: false, why: "no /proc boot id - a stale entry could not be told from a live one" }
	const start = startTimeOf(pid)
	if (start === null) return { ok: false, why: `/proc/${pid}/stat is unreadable - the (pid, start) pair cannot be built` }
	const dir = registryDir()
	try {
		mkdirSync(dir, { recursive: true, mode: 0o700 })
		const rec = { v: 1, pid, start, boot: BOOT_ID, transcript,
			agent: agent || null, source: source || null, at: new Date().toISOString() }
		const p = join(dir, `${pid}.json`)
		const tmp = `${p}.tmp-${process.pid}`
		writeFileSync(tmp, JSON.stringify(rec) + "\n", { mode: 0o600 })
		renameSync(tmp, p)
		prune(dir)
		return { ok: true, path: p, transcript }
	} catch (e) {
		return { ok: false, why: `${dir}: ${(e && e.message) || e}` }
	}
}

/**
 * Resolve a pid. Every non-answer says WHY, because the caller's only correct response
 * to a miss is to refuse, and a refusal a person cannot act on is a dead end.
 */
export function lookup(pid) {
	if (!pid) return { ok: false, why: "no pid to look up" }
	const dir = registryDir()
	const raw = readEntry(join(dir, `${pid}.json`))
	if (!raw) {
		// `why` is one line because a boot row renders it; `hint` is the part a person
		// needs and a row does not, so the two are separate fields rather than one long
		// sentence that gets truncated in the place it matters least.
		return { ok: false, why: `pid ${pid} is not in the session registry`,
			hint: "the SessionStart hook never recorded it - a session older than the registry, or a hook that did not run" }
	}
	if (raw.pid !== pid) return { ok: false, why: `the registry entry filed under pid ${pid} names pid ${raw.pid}` }
	if (raw.boot !== BOOT_ID) return { ok: false, why: `the entry for pid ${pid} was written before the last reboot - that pid is not this process` }
	const start = startTimeOf(pid)
	if (start === null) return { ok: false, why: `pid ${pid} is not running` }
	if (start !== raw.start) {
		return { ok: false, why: `pid ${pid} started at tick ${start}, the registry entry at ${raw.start} - ` +
			`the pid was RECYCLED, so this is a miss and not an answer` }
	}
	if (!raw.transcript) return { ok: false, why: `the registry entry for pid ${pid} carries no transcript` }
	return { ok: true, transcript: raw.transcript, agent: raw.agent, source: raw.source, at: raw.at }
}

/** Every live entry, newest first - for a person asking what this machine thinks it has. */
export function entries() {
	const dir = registryDir()
	let names = []
	try { names = readdirSync(dir) } catch { return [] }
	const out = []
	for (const n of names) {
		const m = n.match(/^(\d+)\.json$/)
		if (!m) continue
		const r = lookup(Number(m[1]))
		if (r.ok) out.push({ pid: Number(m[1]), ...r })
	}
	return out.sort((a, b) => (a.at < b.at ? 1 : -1))
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
	const live = entries()
	console.log(`session registry: ${registryDir()}`)
	if (!live.length) console.log("  (no live sessions recorded - it is written by the SessionStart hook)")
	for (const e of live) console.log(`  pid ${String(e.pid).padEnd(8)} ${basename(e.transcript)}  ${e.source || "?"}  ${e.agent || "?"}  ${e.at}`)
}
