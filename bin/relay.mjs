#!/usr/bin/env node
/**
 * claude-comm RELAY — a session hands over to a fresh copy of ITSELF, in its own window, with nobody at the keyboard.
 *
 *   node .comm/bin/relay.mjs --guard "<cmd>"                     after THIS turn: /clear, then the agent's first prompt
 *   node .comm/bin/relay.mjs --guard "<cmd>" --say "<prompt>"    the first prompt given here, not by .comm/config.json
 *   node .comm/bin/relay.mjs --dry-run [--guard "<cmd>"]...      every check, the screen read now; nothing armed
 *   node .comm/bin/relay.mjs --cancel                            disarm a relay armed in this session
 *
 *   .comm/config.json  "relay": {"leader": "hey leader expert", "app": {"say": "<prompt>", "guard": "<cmd>"}}
 *   .comm/relay/<agent>.json                                     the intent, then every step and its outcome
 *
 * WHY THIS EXISTS. The owner, 2026-10-25, through a field leader that hands over at ~150 k tokens and needed him at the
 * keyboard each time (`/clear`, then "hey leader expert"): *"ce truc de se clear et se relancer a l'air très important
 * […] faut que le truc soit adapté à toi en tant que leader expert […] Et il faut également que ça marche bien pour les
 * experts."* The same field measured the cost of his absence: a session that ran on 2 h past its close, at a 386 k median.
 *
 * ── HOW, and every part of it was already measured here ─────────────────────────────────────────────────────────
 *
 * The restart is `/clear` TYPED INTO THE SESSION'S OWN WINDOW (DESIGN-autonomy.md): the process stays, so its model, its
 * effort, its window, its env and its socket stay (measured 09-13, wake rule 7), and no second session ever shares the
 * inbox (A17). In order, each step recorded in .comm/relay/<agent>.json before the next:
 *
 * 1. AT THE ARMING, in the agent's own turn: who it is (the registry, never the cwd), its window (as its FOREGROUND
 *    process, never by ancestry - see close.mjs's header), the first prompt, and the GUARDS - commands that exit 0 only
 *    when the handoff is written. **No guard, no relay**: a /clear on faith is the loss this repo's first rule exists to
 *    prevent (*what survives a restart is what was written down*). Then a detached watcher, and the turn goes on.
 * 2. THE TURN THAT ASKED ENDS, then 2 s with nothing after it - close.mjs's wait, now wake's `awaitTurnEnd` (A89).
 *    Anything else first - a prompt, an Esc, mail delivered at the Stop - CANCELS, and the record says why.
 * 3. THE GUARDS AGAIN: the turn may have gone on writing after the arming.
 * 4. THE SCREEN: the input box at rest and EMPTY (`promptAtRest`). The transcript says whether a TURN runs; only the
 *    screen says whether a PERSON has typed - and a half-typed line plus `/clear` is SUBMITTED as one prompt (09-13).
 * 5. `/clear`, PROVED: the registry names a new transcript for the same pid (the SessionStart hook writes it).
 * 6. THE SCREEN AGAIN, then the first prompt, PROVED: a user row carrying exactly it, in the NEW transcript.
 *
 * NOTHING IS RETRIED. A step that cannot be proved stops the relay where it is, says so in the record, and leaves the
 * session as it stands: `send-text` exits 0 doing nothing (kitty-remote-control), so a blind second try is a guess typed
 * twice into somebody's window.
 *
 * ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * - **No trigger.** WHEN to hand over is the agent's, or its project's hook (the field's is a Stop hook at 150 k). The
 *   ledger still says UNKNOWN on whether a reboot costs a defect (restart.mjs's header): this makes a declared handover
 *   cost nobody's attention. Each one is a start with source "clear", which the ledger counts in the reboot arm.
 * - **No memory back.** `/clear` returns no RSS (DESIGN-autonomy.md, measured 09-04): this frees the CONTEXT. A process
 *   grown fat is relaunched (launch.mjs), which is the rare path.
 * - **No other session.** It acts on the window its caller is the foreground process of, and on nothing else.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readlinkSync } from "node:fs"
import { join, dirname, resolve, basename } from "node:path"
import { spawnSync, spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

// --help: this header's usage lines and NOTHING else - no window, no mail, no write (A92). The field's .comm/README.md is
// generated from the same lines, so the two cannot disagree (the owner, 2026-10-24: docs every user can trust are current).
if (process.argv.includes("--help")) {
	console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => /^ \*\s{2,}node \S*bin\/[\w-]+\.mjs/.test(l))
		.map((l) => l.replace(/^ \*\s+/, "").replace(/^node (\.comm\/)?bin\//, "node .comm/bin/")).join("\n"))
	process.exit(0)
}

const ARGV = process.argv.slice(2)
const has = (f) => ARGV.includes(f)
const opt = (f, d = null) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] !== undefined ? ARGV[i + 1] : d }
const all = (f) => ARGV.reduce((a, v, i) => (v === f && ARGV[i + 1] !== undefined ? [...a, ARGV[i + 1]] : a), [])
const die = (m, code = 2) => { process.stderr.write(`relay: ${m}\n`); process.exit(code) }
const nap = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const now = () => new Date().toISOString()

const GRACE_MS = 2000, AFTER_TURN_MAX_MS = 30 * 60_000
// Measured 2026-10-25 on a real session: the registry named the new transcript within a second of the Enter; 09-13: 560 ms.
// The prompt box was back at once. These bounds are what a relay waits before saying it could not prove a step.
const CLEAR_CONFIRM_MS = 10_000, READY_MS = 15_000, TAKEN_MS = 15_000, GUARD_MS = 30_000

const wake = await import(new URL("wake.mjs", import.meta.url))
const { sessionPid, lookup } = await import(new URL("session-registry.mjs", import.meta.url))

const argv0 = (pid) => { try { return basename(readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0")[0] || "") } catch { return "" } }
const ppidOf = (pid) => {
	try { const st = readFileSync(`/proc/${pid}/stat`, "utf8"); return Number(st.slice(st.lastIndexOf(")") + 2).split(" ")[1]) || 0 } catch { return 0 }
}
/** Each guard run in the agent's folder: [] when all passed, else what failed. */
function runGuards(guards, cwd) {
	const failed = []
	for (const g of guards) {
		const r = spawnSync("sh", ["-c", g], { cwd, encoding: "utf8", timeout: GUARD_MS })
		if (r.status !== 0) failed.push(`\`${g}\` ${r.error ? `did not finish (${r.error.code})` : `exit ${r.status}`}${(r.stderr || "").trim() ? `: ${(r.stderr || "").trim().split("\n")[0].slice(0, 80)}` : ""}`)
	}
	return failed
}
const screenOf = (sock, id) => spawnSync("kitten", ["@", "--to", `unix:${sock}`, "get-text", "--ansi", "--match", `id:${id}`], { encoding: "utf8", timeout: 5000 })
const sendTo = (sock, id) => (text) => spawnSync("kitten", ["@", "--to", `unix:${sock}`, "send-text", "--match", `id:${id}`, text], { encoding: "utf8", timeout: 5000 })
/** The screen's verdict, or why it could not be read: NOT KNOWING IS NOT "AT REST". */
function atRest(sock, id) {
	const s = screenOf(sock, id)
	if (s.status !== 0 || s.error) return { ok: false, why: `the screen could not be read (kitten @ get-text ${s.error ? s.error.code : `exit ${s.status}`})` }
	return { ...wake.promptAtRest(s.stdout), tail: s.stdout.replace(/\x1b\[[0-9;:]*m/g, "").split("\n").filter((l) => l.trim()).slice(-6) }
}
/** Did the session take `text` as a prompt? A user row carrying exactly it, in `transcript`. */
function taken(transcript, text) {
	let raw = ""
	try { raw = readFileSync(transcript, "utf8") } catch { return false }
	for (const l of raw.split("\n")) {
		if (!l.includes('"user"')) continue
		let r
		try { r = JSON.parse(l) } catch { continue }
		if (r.type !== "user" || r.isMeta || r.isSidechain) continue
		const c = r.message?.content
		const t = typeof c === "string" ? c : Array.isArray(c) ? c.map((x) => (x.type === "text" ? x.text : "")).join("") : ""
		if (t.trim() === text.trim()) return true
	}
	return false
}

// ── THE WATCHER: detached, outlives the turn that armed it, and writes everything it does ─────────────────────────
if (ARGV[0] === "--after-turn") {
	const statePath = ARGV[1]
	let st
	try { st = JSON.parse(readFileSync(statePath, "utf8")) } catch { process.exit(2) }
	const note = (o) => {
		let prev
		try { prev = JSON.parse(readFileSync(statePath, "utf8")) } catch { prev = { intent_unreadable: true } }
		try { writeFileSync(statePath, JSON.stringify({ ...prev, ...o }, null, 1) + "\n") } catch {}
	}
	const stop = (o, code = 1) => { note({ ...o, relayed: false, relay_pid: null, ended_at: now() }); process.exit(code) }
	note({ relay_pid: process.pid })
	const me = st.session
	// 2. the turn that asked, and nothing after it
	const w = wake.awaitTurnEnd({ pid: me, transcript: st.transcript, offset: st.armed_offset, lookup, graceMs: GRACE_MS, maxMs: AFTER_TURN_MAX_MS, what: "relay" })
	if (w.cancel) stop({ cancelled: `${w.cancel} - nothing was typed; arm it again at the end of the turn that is running now` })
	if (w.gone) stop({ cancelled: "the session exited before its turn ended - nothing was typed" })
	if (w.abandoned) stop({ cancelled: `the turn did not end within ${AFTER_TURN_MAX_MS / 60_000} min - nothing was typed into a working session` })
	note({ turn_ended: "the turn that asked for the relay ended", turn_ended_at: now() })
	// 3. the handoff, proved again
	const failed = runGuards(st.guards, st.cwd)
	if (failed.length) stop({ refused: `a guard failed at the moment of the relay, so the handoff is not proved: ${failed.join("; ")} - nothing was typed` })
	// the window: still this session's, as its foreground process
	const r = wake.resolveWindow(me, wake.windows())
	if (!r.ok || r.how !== "foreground process" || r.win.id !== st.window || r.win.sock !== st.sock)
		stop({ refused: `window ${st.window} no longer runs this session as its foreground process (${r.ok ? `${r.how}, window ${r.win.id}` : r.why}) - nothing was typed` })
	// 4. nobody has typed, no dialog is open, and the transcript agrees the session rests
	const scr = atRest(st.sock, st.window)
	if (!scr.ok) stop({ refused: `the prompt is not at rest: ${scr.why} - nothing was typed`, screen: scr.tail })
	const turn = wake.readTurn(me, lookup)
	if (turn.state !== "idle") stop({ refused: `the session reads ${turn.state} (${turn.why}) - nothing was typed` })
	// 5. /clear, proved by the registry
	const send = sendTo(st.sock, st.window)
	const c = wake.clearFresh(me, lookup, send, CLEAR_CONFIRM_MS)
	note({ clear: { at: now(), typed: c.typed, cleared: c.cleared, why: c.why } })
	if (!c.cleared) stop({ refused: `${c.why} - the first prompt was NOT typed`, typed: c.typed ? ["/clear"] : [] })
	const fresh = lookup(me)
	note({ new_transcript: fresh.ok ? fresh.transcript : null })
	// 6. the prompt box back and empty, then the first prompt, proved by the new transcript
	let ready = null
	for (const until = Date.now() + READY_MS; Date.now() < until; nap(250)) { ready = atRest(st.sock, st.window); if (ready.ok) break }
	if (!ready || !ready.ok) stop({ refused: `cleared, but the prompt did not come back at rest within ${READY_MS / 1000} s (${ready ? ready.why : "never read"}) - the first prompt was NOT typed; the session is fresh and waits`, screen: ready && ready.tail })
	const a = send(st.say)
	if (a.status !== 0) stop({ refused: `cleared, but the first prompt could not be typed (send-text exit ${a.status}) - the session is fresh and waits` })
	send("\r")
	const t0 = Date.now()
	for (; Date.now() - t0 < TAKEN_MS; nap(250)) {
		const h = lookup(me)
		if (h.ok && taken(h.transcript, st.say)) {
			note({ relayed: true, relay_pid: null, said_at: now(), taken_ms: Date.now() - t0, transcript_now: h.transcript })
			process.exit(0)
		}
	}
	stop({ refused: `cleared and the first prompt typed, but no user row carrying it reached the new transcript within ${TAKEN_MS / 1000} s - look at window ${st.window}` })
}

// ── THE ARMING, inside the agent's own turn ──────────────────────────────────────────────────────────────────────
const me = sessionPid()
if (!me) die(`this is not running inside a claude session (no 'claude' ancestor of pid ${process.pid}) - there is no session here to relay`)
// 🔴 A SESSION RELAYS ITSELF, NEVER THE ONE THAT SPAWNED IT. A `claude -p` started by a session is that session's
// descendant and sits in its window: by ancestry, or even in its foreground list (close.mjs's header, review #8 C4), it
// would resolve to the REAL session's window, and the /clear would land there. The real one has no claude above it.
for (let p = ppidOf(me), i = 0; p > 1 && i < 32; p = ppidOf(p), i++)
	if (argv0(p) === "claude") die(`REFUSING: session ${me} runs inside another claude session (pid ${p}) - a subprocess relays nobody; only the session the window runs may relay itself`)
let cmd = []
try { cmd = readFileSync(`/proc/${me}/cmdline`, "utf8").split("\0") } catch {}
if (cmd.includes("-p") || cmd.includes("--print")) die(`REFUSING: session ${me} is a 'claude -p' run - it has no prompt to type into`)
const hit = lookup(me)
if (!hit.ok) die(`the session registry cannot name this session's transcript (${hit.why}), so neither the end of this turn nor the /clear could be proved - nothing armed`)
const agent = hit.agent
if (!agent) die(`the registry entry for session ${me} names no agent - nothing armed`)
let cwd = null
try { cwd = readlinkSync(`/proc/${me}/cwd`) } catch {}
let root = cwd
while (root && !existsSync(join(root, ".comm", "config.json"))) { const up = dirname(root); root = up === root ? null : up }
if (!root) die(`no project above this session's folder (${cwd}): no .comm/config.json - nothing armed`)
let cfg = {}
try { cfg = JSON.parse(readFileSync(join(root, ".comm", "config.json"), "utf8")) } catch (e) { die(`.comm/config.json does not parse (${e.message}) - nothing armed`) }
if (!cfg.agents || !(agent in cfg.agents)) die(`'${agent}' is not on the roster in ${join(root, ".comm", "config.json")} - nothing armed`)
const recordPath = join(root, ".comm", "relay", `${agent}.json`)
const liveWatcher = () => {
	let rec = null
	try { rec = JSON.parse(readFileSync(recordPath, "utf8")) } catch { return null }
	const pid = rec && rec.relay_pid
	let c = ""
	try { c = readFileSync(`/proc/${pid}/cmdline`, "utf8") } catch { return null }
	return pid && c.includes("--after-turn") && c.includes(recordPath) ? Number(pid) : null
}
if (has("--cancel")) {
	const pid = liveWatcher()
	if (!pid) die(`nothing is armed for '${agent}' - no live relay in ${recordPath}`, 1)
	try { process.kill(pid) } catch (e) { die(`the armed relay (pid ${pid}) could not be stopped: ${e.code || e.message}`, 4) }
	try { writeFileSync(recordPath, JSON.stringify({ ...JSON.parse(readFileSync(recordPath, "utf8")), relay_pid: null, relayed: false,
		cancelled: "relay.mjs --cancel - nothing was typed", ended_at: now() }, null, 1) + "\n") } catch {}
	console.log(`relay: cancelled - the relay of '${agent}' (pid ${pid}) was stopped; nothing will be typed`)
	process.exit(0)
}
if (!has("--dry-run") && liveWatcher()) {
	console.log(`relay: already armed for '${agent}' - it runs after this turn; \`relay.mjs --cancel\` disarms it`)
	process.exit(0)
}

// the first prompt and the guards: the flags, then the project's word for this agent
const conf = cfg.relay && cfg.relay[agent]
const say = opt("--say", typeof conf === "string" ? conf : conf && typeof conf.say === "string" ? conf.say : null)
const confGuards = conf && typeof conf === "object" ? [].concat(conf.guard || []).filter((g) => typeof g === "string") : []
const guards = [...all("--guard"), ...confGuards]
const cfgFile = join(root, ".comm", "config.json")
if (!say || !say.trim()) die(`no first prompt for '${agent}': pass --say "<what the fresh session is told first>", or add it once to ${cfgFile}:\n` +
	`    "relay": {"${agent}": "${agent === (cfg.leader || "leader") ? "hey leader expert" : "<the sentence that resumes this agent's work>"}"}`)
if (/[\r\n]/.test(say)) die(`the first prompt must be ONE line: a newline typed into the prompt submits it half-way`)
if (!guards.length) die(`no guard: pass --guard "<a command that exits 0 only when your handoff is written>" (repeatable), or add\n` +
	`    "relay": {"${agent}": {"say": ${JSON.stringify(say)}, "guard": "<cmd>"}}  to ${cfgFile}.\n` +
	`  A relay with nothing proving the handoff is a /clear on faith: what survives it is only what was written down.`)
const failed = runGuards(guards, cwd)
if (failed.length) die(`a guard failed, so the handoff is not proved - nothing armed:\n  · ${failed.join("\n  · ")}`, 3)

const r = wake.resolveWindow(me, wake.windows())
if (!r.ok) die(`session ${me} is in no kitty window this user can see: ${r.why}`)
if (r.how !== "foreground process") die(`REFUSING: session ${me} reaches window ${r.win.id} only as "${r.how}", not as its foreground process - that is what a subprocess of the real session looks like`)
let offset
try { offset = statSync(hit.transcript).size } catch (e) { die(`this session's transcript cannot be read (${e.code}) - nothing armed`) }
const state = { agent, session: me, cwd, window: r.win.id, sock: r.win.sock, transcript: hit.transcript, armed_offset: offset,
	say, guards, armed_at: now(), relay_pid: null, relayed: null }

if (has("--dry-run")) {
	const scr = atRest(r.win.sock, r.win.id)
	console.log(JSON.stringify({ ...state, would_arm: true, screen_now: scr.ok ? "at rest, empty" : scr.why }, null, 1))
	process.exit(0)
}
mkdirSync(dirname(recordPath), { recursive: true })
writeFileSync(recordPath, JSON.stringify(state, null, 1) + "\n")
const watcher = spawn(process.execPath, [fileURLToPath(import.meta.url), "--after-turn", recordPath], { detached: true, stdio: "ignore" })
watcher.unref()
// the watcher's pid is written HERE, before this returns, so a second relay.mjs in the same turn sees it (A89's lesson)
writeFileSync(recordPath, JSON.stringify({ ...state, relay_pid: watcher.pid || null }, null, 1) + "\n")
console.log(`relay: armed - ${GRACE_MS / 1000} s after THIS turn ends, window ${r.win.id} gets /clear, then: ${say}\n` +
	`  Guards checked now and again just before: ${guards.length}. Write your last answer, then end your turn.\n` +
	`  Anything that starts another turn first cancels it (\`relay.mjs --cancel\` does too). Every step lands in ${recordPath}.`)
