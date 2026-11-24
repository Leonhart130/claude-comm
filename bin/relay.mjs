#!/usr/bin/env node
/**
 * Claude Toolbox RELAY — a session hands over to a fresh copy of ITSELF, in its own window, with nobody at the keyboard.
 *
 *   node .comm/bin/relay.mjs --guard "<cmd>"                     after THIS turn: /clear, then the agent's first prompt
 *   node .comm/bin/relay.mjs --guard "<cmd>" --say "<prompt>"    the first prompt given here, not by .comm/config.json
 *   node .comm/bin/relay.mjs --guard "<a>" --guard "<b>"         all of them AND the config's must pass: a flag adds
 *   node .comm/bin/relay.mjs --dry-run [--guard "<cmd>"]...      every check, the screen read now; nothing armed
 *   node .comm/bin/relay.mjs --cancel                            disarm a relay armed in this session
 *   node .comm/bin/relay.mjs --reap <root>                       a watcher gone without a word: its record says so, owner and leader told
 *
 *   .comm/config.json  "relay": {"leader": "hey leader expert", "app": {"say": "<prompt>", "guard": "<cmd>"}}
 *                      the first prompt each agent's fresh session is given; "guard": a command that must exit 0 too;
 *                      "handoff": the handoff declared (relay-guard.mjs, its header), checked as one more guard
 *   .comm/relay/<agent>.json                                     the intent, then every step and its outcome
 *   .comm/relay/<agent>.err                                      the watcher's stderr, one run's: a crash's stack lands here
 *   .comm/relay/<agent>.log.jsonl                                every relay of it that did NOT happen, whoever ended it
 *   .comm/relay/<agent>.died.md                                  what the leader is sent when a watcher died without a word
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
 * (Everything from the screen read of step 4 to the first prompt is under the window's keyboard, wake.mjs's rule 9; the bus's
 * own text found in the box is erased, and a box a person or a dialog holds is looked at again every `box.retryMs`, the owner
 * told past `box.notifyAfterMs`, the relay refused only at `box.maxMs` - and any refusal tells the owner, because an idle session
 * has no Stop hook left to read it. FINDINGS.md#left-in-the-box.)
 *
 * 1. AT THE ARMING, in the agent's own turn: who it is (the registry, never the cwd), its window (as its FOREGROUND
 *    process, never by ancestry - see close.mjs's header), the first prompt, and the GUARDS - commands that exit 0 only
 *    when the handoff is written. **No guard, no relay**: a /clear on faith is the loss this repo's first rule exists to
 *    prevent (*what survives a restart is what was written down*). And NO MAIL WAITING: the Stop hook would hand it over
 *    and resume the turn, which cancels (step 2). Then a detached watcher, and the turn goes on.
 * 2. THE TURN THAT ASKED ENDS, then 2 s with nothing after it - close.mjs's wait, now wake's `awaitTurnEnd` (A89).
 *    Anything else first - a prompt, an Esc, mail delivered at the Stop - CANCELS, and the record says why.
 * 3. THE GUARDS AGAIN: the turn may have gone on writing after the arming.
 * 4. THE SCREEN: the input box at rest and EMPTY (`promptAtRest`). The transcript says whether a TURN runs; only the
 *    screen says whether a PERSON has typed - and a half-typed line plus `/clear` is SUBMITTED as one prompt (09-13).
 * 5. `/clear`, PROVED: the registry names a new transcript for the same pid (the SessionStart hook writes it).
 * 6. THE SCREEN AGAIN, then the first prompt, PROVED: a user row carrying exactly it, in the NEW transcript. Its Enter
 *    goes once the box SHOWS the prompt: a long text and its Enter in one read are a paste, and nothing is submitted.
 *
 * NOTHING IS RETRIED BLIND. A step that cannot be proved stops the relay where it is, says so in the record, and leaves
 * the session as it stands: `send-text` exits 0 doing nothing (kitty-remote-control), so a blind second try is a guess
 * typed twice into somebody's window. ONE exception, read before it is typed: the prompt left WHOLE and ALONE in the box
 * 3 s after its Enter gets the Enter alone, once - that box holds nothing but the relay's own words (wake's rule 8).
 *
 * ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * - **No trigger HERE.** WHEN to hand over is the agent's, its project's hook, or since 2026-11-02.3 the bus's own:
 *   an "at" in .comm/config.json "relay" holds the turn end past it until this is armed (relay-due.mjs, its header).
 *   The ledger still says UNKNOWN on whether a reboot costs a defect (restart.mjs's header): this makes a declared
 *   handover cost nobody's attention. Each one is a start with source "clear", which the ledger counts in the reboot arm.
 * - **No memory back.** `/clear` returns no RSS (DESIGN-autonomy.md, measured 09-04): this frees the CONTEXT. A process
 *   grown fat is relaunched (launch.mjs), which is the rare path.
 * - **No other session.** It acts on the window its caller is the foreground process of, and on nothing else.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readlinkSync, readdirSync, renameSync, appendFileSync, openSync, closeSync, unlinkSync, realpathSync } from "node:fs"
import { join, dirname, resolve, basename, relative } from "node:path"
import { constants as osConstants } from "node:os"
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
// The box drew a 270-character prompt 57-68 ms after it was typed (11-02, a real session); the prompt was taken 252 ms
// after its Enter (10-25). 5 s for the first: a loaded kitty answered a screen read in ~1.5 s (11-02, six suites at
// once). An Enter still not taken after 3 s, with the prompt whole in the box, was lost.
const SHOWN_MS = 5000, ENTER_LOST_MS = 3000
const BOX_BACK_MS = 20_000   // a dialog over the box after its Ctrl+A: how long the relay waits for the box, to take its prompt back out

const wake = await import(new URL("wake.mjs", import.meta.url))
const { sessionPid, lookup } = await import(new URL("session-registry.mjs", import.meta.url))

// ── A RELAY THAT DID NOT HAPPEN LEAVES ITS RECORD, WHOEVER ENDS IT (work's letter 93, 2026-11-23) ─────────────────
// A field expert armed at 04:57:50Z, its turn ended 12 s later, and nothing came: at 05:4x its record still said `relayed:
// null`, no `ended_at`, the watcher's pid gone. It slept 46 min until its chief rang it. What killed the watcher can no
// longer be read: its stderr went to "ignore", and the next relay, at 13:11Z, wrote its own record over this one. Measured
// over that field's transcripts since 11-01: 2 654 armings, 2 615 relayed, and this the one silence that long since 11-08.
// So: a record is written WHOLE (`writeRecord`: a reader never sees a truncated one). Every record that ends without a relay
// is appended to `<agent>.log.jsonl` by whoever ends it (`logEnd`). The watcher runs under a KEEPER, a `sh` that waits for it
// and, if it ended without writing its end, reports how (`--kept`: its exit code or its signal) at once - nobody else need
// be awake (FINDINGS.md#relay-death, the review's F2). And the hook stub's Stop reaps what the keeper could not (`--reap`).
// The reaper, the keeper, `--cancel` and an arming that replaces a watcher share ONE lock per record (`takeLock`).
// 🔴 NOT A SIGNAL HANDLER IN THE WATCHER: it waits synchronously (Atomics.wait, spawnSync), so a JS handler would never run -
// and installing one replaces the default action, so `--cancel`'s SIGTERM would stop nothing. A signal is the keeper's to see.
const writeRecord = (p, o) => { const t = `${p}.${process.pid}.tmp`; writeFileSync(t, JSON.stringify(o, null, 1) + "\n"); renameSync(t, p) }
const logPathOf = (recordPath) => recordPath.replace(/\.json$/, ".log.jsonl")
const errPathOf = (recordPath) => recordPath.replace(/\.json$/, ".err")
const LOG_MAX = 512 * 1024
/** Append one line, after cutting the file to its newer half (in BYTES, on a line) past LOG_MAX; a torn last line is closed first. */
function appendBounded(lp, line, max = LOG_MAX) {
	try {
		const b = readFileSync(lp)
		if (b.length > max) { const from = b.indexOf(10, b.length - max / 2); writeFileSync(lp, from < 0 ? Buffer.alloc(0) : b.subarray(from + 1)) }
		else if (b.length && b[b.length - 1] !== 10) line = `\n${line}`
	} catch {}
	try { appendFileSync(lp, line) } catch {}
}
const logEnd = (recordPath, rec) => appendBounded(logPathOf(recordPath), JSON.stringify({ ...rec, logged_at: now() }) + "\n")
/** Does the log already hold this end (its arming's `armed_at`, its `ended_at`)? */
const endLogged = (recordPath, rec) => {
	try {
		return readFileSync(logPathOf(recordPath), "utf8").split("\n").some((l) => {
			if (!l) return false
			try { const o = JSON.parse(l); return o.armed_at === rec.armed_at && o.ended_at === rec.ended_at } catch { return false }
		})
	} catch { return false }
}
/** Is `pid` this record's watcher - or its keeper, which waits for it - alive? Its command line says so: a pid recycled by
 *  another process, or another record's watcher, is not one. */
const isWatcher = (pid, recordPath) => {
	if (!Number.isInteger(pid) || pid <= 0) return false
	try { const c = readFileSync(`/proc/${pid}/cmdline`, "utf8"); return c.includes("--after-turn") && c.includes(recordPath) } catch { return false }
}
/** The record's one lock, stale past a minute (its holder killed mid-way). `waitMs`: how long to wait for a live holder. */
const lockOf = (recordPath) => `${recordPath}.reap`
function takeLock(recordPath, waitMs = 0) {
	const lock = lockOf(recordPath), until = Date.now() + waitMs
	for (let i = 0; i < 2000; i++) {
		try { writeFileSync(lock, String(process.pid), { flag: "wx" }); return true } catch (e) { if (e.code !== "EEXIST") return false }
		try { if (Date.now() - statSync(lock).mtimeMs >= 60_000) { unlinkSync(lock); continue } } catch {}
		if (Date.now() >= until) return false
		nap(50)
	}
	return false
}
// only a lock this process holds: one broken as stale and taken by another is that other's (the second review, F4b)
const dropLock = (recordPath) => { try { if (readFileSync(lockOf(recordPath), "utf8") === String(process.pid)) unlinkSync(lockOf(recordPath)) } catch {} }
/** Stop a live watcher WITH its keeper - their process group, which the keeper leads - so the keeper reports no death that was
 *  asked for. A watcher armed before the keeper existed leads its own group: the same call stops it. */
function killWatcher(pid, recordPath) {
	let pg = 0
	try { const s = readFileSync(`/proc/${pid}/stat`, "utf8"); pg = Number(s.slice(s.lastIndexOf(")") + 2).split(" ")[2]) || 0 } catch {}
	if (pg > 1 && pg !== process.pid && isWatcher(pg, recordPath)) process.kill(-pg, "SIGTERM")
	else process.kill(pid, "SIGTERM")
}
// The arming writes the watcher's pid before it returns; a watcher's first act notes it again. 30 s is far past both.
const REAP_AFTER_MS = 30_000
/** A record nobody will ever end: not relayed, not ended, armed long enough ago, and no watcher of it alive. */
const orphaned = (rec, recordPath, at = Date.now()) => !!rec && rec.relayed == null && !rec.ended_at && typeof rec.armed_at === "string" &&
	at - Date.parse(rec.armed_at) > REAP_AFTER_MS && !isWatcher(rec.relay_pid, recordPath)
/** Does the session that armed it still run? A `claude` at that pid: a reboot or a logout takes both, and then nobody is waiting. */
const sessionLives = (pid) => {
	if (!Number.isInteger(pid) || pid <= 0) return false
	try { return basename(readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0")[0] || "") === "claude" } catch { return false }
}
const NOTHING = { en: "nothing was typed", fr: "rien n'a été tapé" }
/** How far a record says it got (`phase`, noted as each starts) and what was typed (`keys_sent`, noted BEFORE each new kind of
 *  key goes - the review's F4: a watcher dead between two writes leaves what it typed). A record from before both: its fields. */
function reached(rec) {
	const at = (k) => (rec[k] ? ` (${rec[k]})` : "")
	const where = rec.phase ? `while ${rec.phase}${at("phase_at")}`
		: rec.prompt ? "after the first prompt's Enter" : rec.clear ? "after the /clear" : rec.box_wait_since ? `while it waited for the box${at("box_wait_since")}`
		: rec.turn_ended_at ? `after the turn that armed it ended${at("turn_ended_at")}` : "before the turn that armed it ended"
	const k = rec.keys_sent && Array.isArray(rec.keys_sent.kinds) ? rec.keys_sent : null
	const kinds = k ? k.kinds : []
	const typed = k ? (!kinds.length ? NOTHING
		: kinds.includes("prompt") ? (k.enter_after_prompt ? { en: "/clear and the first prompt were typed and an Enter pressed after it: the fresh session may be at work", fr: "le /clear et sa phrase sont partis, la session neuve travaille peut-être" }
			: { en: "/clear was typed, then the first prompt with no Enter after it: it may sit in the box", fr: "le /clear est parti, sa phrase est peut-être restée dans la saisie" })
		: kinds.includes("/clear") ? (rec.clear && rec.clear.cleared ? { en: "/clear was typed and taken: a fresh session waits, its first prompt never typed", fr: "le /clear est parti, la session neuve attend sans sa phrase" }
			: { en: "/clear was typed, not proved taken", fr: "le /clear a été tapé, sans preuve qu'il est parti" })
		: { en: `nothing of its own was typed; keys were sent to erase the bus's text from the box (${kinds.join(", ")})`, fr: "rien de lui n'a été tapé ; des touches ont effacé un texte du bus" })
		: rec.prompt ? { en: "/clear and the first prompt were typed and its Enter pressed: the fresh session may be at work", fr: "le /clear et sa phrase sont partis, la session neuve travaille peut-être" }
		: rec.clear && rec.clear.typed ? (rec.clear.cleared ? { en: "/clear was typed and taken: a fresh session waits, its first prompt never typed", fr: "le /clear est parti, la session neuve attend sans sa phrase" }
			: { en: "/clear was typed, not proved taken", fr: "le /clear a été tapé, sans preuve qu'il est parti" })
		: rec.box_wait_since ? { en: "nothing was typed, as far as its record says (it waited for its box)", fr: "rien n'a été tapé, d'après son enregistrement" }
		: NOTHING
	return { where, typed }
}

const argv0 = (pid) => { try { return basename(readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0")[0] || "") } catch { return "" } }
const ppidOf = (pid) => {
	try { const st = readFileSync(`/proc/${pid}/stat`, "utf8"); return Number(st.slice(st.lastIndexOf(")") + 2).split(" ")[1]) || 0 } catch { return 0 }
}
/** Each guard run in the agent's folder: [] when all passed, else what failed. */
function runGuards(guards, cwd) {
	const failed = []
	for (const g of guards) {
		const r = spawnSync("sh", ["-c", g], { cwd, encoding: "utf8", timeout: GUARD_MS })
		if (r.status !== 0) failed.push(`\`${g}\` ${r.error ? `did not finish (${r.error.code})` : `exit ${r.status}`}${(r.stderr || "").trim() ? `: ${(r.stderr || "").trim().split("\n")[0].slice(0, 160)}` : ""}`)
	}
	return failed
}
const screenOf = (sock, id) => spawnSync("kitten", ["@", "--to", `unix:${sock}`, "get-text", "--ansi", "--add-cursor", "--add-wrap-markers", "--match", `id:${id}`], { encoding: "utf8", timeout: 5000 })
const sendTo = (sock, id) => (text) => spawnSync("kitten", ["@", "--to", `unix:${sock}`, "send-text", "--match", `id:${id}`, text], { encoding: "utf8", timeout: 5000 })
/** The screen's verdict, or why it could not be read: NOT KNOWING IS NOT "AT REST". */
function atRest(sock, id, alt) {
	const s = screenOf(sock, id)
	if (s.status !== 0 || s.error) return { ok: false, why: `the screen could not be read (kitten @ get-text ${s.error ? s.error.code : `exit ${s.status}`})` }
	return { ...wake.cursorCounts(wake.promptAtRest(s.stdout), alt), tail: s.stdout.replace(/\x1b\[[0-9;:?]*[ ]?[A-Za-z]/g, "").replace(/\r/g, "").split("\n").filter((l) => l.trim()).slice(-6) }
}
/** Has the transcript gained, past `from`, a row that says a turn ran? A row still being written is read on the next look. */
function grewBusy(transcript, from) {
	let tail = ""
	try { tail = readFileSync(transcript).subarray(from).toString("utf8") } catch { return false }
	for (const l of tail.split("\n")) {
		if (!l) continue
		let r
		try { r = JSON.parse(l) } catch { continue }
		if (wake.rowVerdict(r) === "busy") return true
	}
	return false
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
	// stderr is `<agent>.err` (the arming opens it): what a death prints is kept there, and the reaper quotes it
	try { st = JSON.parse(readFileSync(statePath, "utf8")) } catch (e) { process.stderr.write(`relay watcher ${process.pid}: its record ${statePath} cannot be read (${e.code || e.message}) - nothing done\n`); process.exit(2) }
	process.stderr.write(`relay watcher ${process.pid} for '${st.agent}', armed ${st.armed_at}, started ${now()}\n`)
	// ONLY ONTO ITS OWN ARMING'S RECORD: once a new arming has written over it (this watcher cancelled itself, and the agent armed
	// again before its last notes), a note would land in the new relay's record (the second review of #relay-death, F1)
	// NEVER OVER A RECORD IT CANNOT READ (the third review, F2): a torn read (comm.mjs's `mark()`, a watcher of the release before:
	// both write in place) was written over as `{intent_unreadable}`, its armed_at and transcript gone - no Stop, keeper or reaper
	// could ever tell of that relay again. Read again, 20 ms apart, for 100 ms; still torn, nothing is written (`unwritten` says why).
	let unwritten = null
	const note = (o) => {
		let prev = null
		for (let i = 0; i < 6; i++) {
			try { prev = JSON.parse(readFileSync(statePath, "utf8")); break } catch (e) {
				prev = null
				if (i < 5) { try { process.stderr.write(`relay watcher ${process.pid}: its record cannot be read (${e.code || e.name}) - again in 20 ms\n`) } catch {} nap(20) }
			}
		}
		if (!prev || typeof prev !== "object") { unwritten = "its record could not be read"; return null }
		if (prev.armed_at !== st.armed_at) { unwritten = "its record is another arming's now"; return null }
		const next = { ...prev, ...o }
		try { writeRecord(statePath, next) } catch {}
		return next
	}
	let held = null, cfgNow = null
	const rootOf = dirname(dirname(dirname(statePath)))
	try { cfgNow = JSON.parse(readFileSync(join(rootOf, ".comm", "config.json"), "utf8")) } catch {}
	// 🔴 A REFUSAL FROM AN IDLE SESSION REACHES NOBODY INSIDE IT: its turn is over, so no Stop hook will ever read this record.
	// A field's leader slept nine hours on one (11-08, FINDINGS.md#left-in-the-box). So every refusal also leaves the window.
	// `ending`: its end is being written. A throw from here on (the owner's line, say) is not a crash of the relay, and must not
	// write over the true reason (the review's F3: a guard's NUL byte threw in notifyOwner, and the refusal became "crashed").
	let ending = false
	const stop = ({ tell, tellOwner, ...o }, code = 1) => {
		ending = true
		const end = { ...o, relayed: false, relay_pid: null, ended_at: now() }
		const ended = note(end)
		// LOGGED EVEN WHEN NOT WRITTEN (the third review, F4): every relay that does not happen is logged - here from what this
		// watcher knows, `unwritten` saying why its record does not hold it
		logEnd(statePath, ended || { ...st, ...end, unwritten })
		// `tell`: what he may read when `refused` quotes the box. Never what is in it: this leaves the window.
		const line = o.refused ? `son relais n'a pas eu lieu : ${tell || o.refused}` : tellOwner || null
		if (line) note({ owner_told: wake.notifyOwner(rootOf, cfgNow, st.agent, line) })
		process.exit(code)
	}
	process.on("exit", () => { if (held) held.release() })
	// A THROW ANYWHERE BELOW IS A REFUSAL, said like one: the record, the owner, the agent's next Stop. Before this, a throw printed
	// its stack into "ignore" and left `relayed: null` for good. What it had typed is read off the record, not assumed.
	process.on("uncaughtException", (e) => {
		const stack = String((e && e.stack) || e)
		try { process.stderr.write(`relay watcher ${process.pid} CRASHED at ${now()}${ending ? " (its end already written)" : ""}:\n${stack}\n`) } catch {}
		if (ending) process.exit(70)
		let rec = st
		try { rec = JSON.parse(readFileSync(statePath, "utf8")) } catch {}
		const r = reached(rec)
		try {
			stop({ refused: `its watcher crashed ${r.where} (${stack.split("\n")[0].slice(0, 200)}) - ${r.typed.en}; its stack: .comm/relay/${basename(errPathOf(statePath))}`,
				crashed: { at: now(), error: stack.slice(0, 2000) }, tell: `son veilleur a planté (${r.typed.fr})` }, 70)
		} catch {}
		process.exit(70)
	})
	// WHERE IT IS, noted as each step starts: what a death leaves to read (`reached`)
	const phase = (p, more = {}) => note({ phase: p, phase_at: now(), ...more })
	phase("waiting for the turn that armed it to end", { relay_pid: process.pid })
	const me = st.session
	// 2. the turn that asked, and nothing after it
	const w = wake.awaitTurnEnd({ pid: me, transcript: st.transcript, offset: st.armed_offset, lookup, graceMs: GRACE_MS, maxMs: AFTER_TURN_MAX_MS, what: "relay" })
	if (w.cancel) stop({ cancelled: `${w.cancel} - nothing was typed; arm it again at the end of the turn that is running now` })
	if (w.gone) stop({ cancelled: "the session exited before its turn ended - nothing was typed" })
	if (w.abandoned) stop({ cancelled: `the turn did not end within ${AFTER_TURN_MAX_MS / 60_000} min - nothing was typed into a working session` })
	phase("checking its guards and its window", { turn_ended: "the turn that asked for the relay ended", turn_ended_at: now() })
	// 3. the handoff, proved again
	const failed = runGuards(st.guards, st.cwd)
	if (failed.length) stop({ refused: `a guard failed at the moment of the relay, so the handoff is not proved: ${failed.join("; ")} - nothing was typed` })
	// the window: still this session's, as its foreground process
	const r = wake.resolveWindow(me, wake.windows())
	if (!r.ok || r.how !== "foreground process" || r.win.id !== st.window || r.win.sock !== st.sock)
		stop({ refused: `window ${st.window} no longer runs this session as its foreground process (${r.ok ? `${r.how}, window ${r.win.id}` : r.why}) - nothing was typed` })
	// 4. nobody has typed, no dialog is open, and the transcript agrees the session rests
	// 🔴 RULE 9 OF wake.mjs: everything from this read to the first prompt is under the window's keyboard, so no bell lands
	// between the /clear and the prompt; and the bus's OWN text in the box is the bus's to clear (a field's leader, 11-08:
	// two bells in its box refused this relay twice, then its timer's ring, and it slept until the owner came back).
	// EVERY KEY IS NOTED BEFORE IT GOES - each new kind, and the first Enter after the prompt (the review's F4): what it typed is
	// then on record whatever kills it between two writes. Through this one function: the eraser and the /clear are handed it.
	const rawSend = sendTo(st.sock, st.window), keysSent = { kinds: [], enter_after_prompt: false }
	const kindOf = (t) => t === "\r" ? "Enter" : t === "\x01" ? "Ctrl+A" : t === "\x05" ? "Ctrl+E" : t === "\x15" ? "Ctrl+U" : t === "/clear" ? "/clear" : t === st.say ? "prompt" : "text"
	const send = (t) => {
		const k = kindOf(t)
		let fresh = false
		if (!keysSent.kinds.includes(k)) { keysSent.kinds.push(k); fresh = true }
		if (k === "Enter" && keysSent.kinds.includes("prompt") && !keysSent.enter_after_prompt) { keysSent.enter_after_prompt = true; fresh = true }
		if (fresh) note({ keys_sent: { kinds: [...keysSent.kinds], enter_after_prompt: keysSent.enter_after_prompt } })
		return rawSend(t)
	}
	// `alt` from THIS run's window list, never the arming's: a session can leave the alternate screen (`/tui default`), and on the
	// main one a cursor counts for nothing (the twenty-first review)
	const alt = r.win.alt === true
	const read = () => atRest(st.sock, st.window, alt)
	const rules = wake.boxRules(cfgNow), waitFrom = Date.now()
	let scr = null, told = false, waited = false, size = 0, boxWaitSince = null
	try { size = statSync(st.transcript).size } catch {}
	for (;;) {
		held = wake.holdKeyboard({ sock: st.sock, id: st.window }, `the relay of ${st.agent}`)
		if (held.ok) {
			scr = read()
			const own = !scr.ok && scr.typed === true && wake.busText(scr.text, { hidden: wake.mayHide(scr) })
			if (own) {
				const e = wake.eraseOwn(read, send, (t, s) => !!wake.busText(t, { hidden: wake.mayHide(s) }))
				note({ erased_own: { at: now(), bells: own.bells, cut: own.cut, erased: e.erased, presses: e.presses, ...(e.why ? { why: e.why } : {}) } })
				// presses still pending: never another erase on top of them, every retry for 12 h (the twenty-eighth review: 9 queued, 7 rows)
				if (e.stalled) stop({ refused: `its box does not answer its keys (${e.why}) - nothing more typed` })
				scr = read()
			}
			// AFTER A WAIT a /clear must not land on somebody. A box emptied may be a person between two sentences, so it must be free
			// twice in a row; and a window with the owner's focus is not free at all (a relay can be hours old by now).
			if (scr.ok && waited) {
				let focus = true
				try { focus = wake.windowHasFocus(JSON.parse(spawnSync("kitten", ["@", "--to", `unix:${st.sock}`, "ls"], { encoding: "utf8", timeout: 5000 }).stdout), st.window) } catch {}
				if (focus) { scr = { ok: false, why: "its window has the focus: somebody may be reading it, and what comes next is a /clear" }; waited = true }
			}
			if (scr.ok && !waited) break
			if (scr.ok && waited === "free") break
			waited = scr.ok ? "free" : true
			held.release()
		} else { scr = { ok: false, why: `${held.holder} is typing into this window right now` }; waited = true }
		held = null
		if (!boxWaitSince) { boxWaitSince = now(); phase("waiting for its box", { box_wait_since: boxWaitSince }) }
		// The handoff, proved again after a wait, OUTSIDE the hold and BEFORE the look that lets the /clear go: nobody may start typing
		// unseen during a guard, and a slow guard does not age the hold.
		if (waited === "free") {
			const stale = runGuards(st.guards, st.cwd)
			if (stale.length) stop({ refused: `a guard failed after the wait for the box, so the handoff is not proved: ${stale.join("; ")} - nothing was typed` })
		}
		const spent = Date.now() - waitFrom
		const safeWhy = scr.typed ? "du texte est sur sa ligne de saisie" : scr.why
		if (!scr.ok && spent >= rules.maxMs) stop({ refused: `the prompt is not at rest: ${scr.why} - nothing was typed${spent >= 60_000 ? ` (looked for ${Math.round(spent / 60_000)} min)` : ""}`, screen: scr.tail, tell: safeWhy })
		if (!told && !scr.ok && spent >= rules.notifyAfterMs) {
			told = true
			note({ waiting_for_the_box: safeWhy, owner_told: wake.notifyOwner(rootOf, cfgNow, st.agent, `son relais attend depuis ${Math.round(spent / 60_000)} min : ${safeWhy}`) })
		}
		nap(Math.min(rules.retryMs, Math.max(50, rules.maxMs - spent)))
		// A wait is only worth it for the session it was armed in: a turn taken meanwhile is new work the handoff does not cover. Told
		// outside the window: that turn's Stop may already have passed, and it believes it is armed.
		if (grewBusy(st.transcript, size)) stop({ cancelled: "the session took a turn while the relay waited for its box - nothing was typed; arm it again at the end of the turn that is running now", tellOwner: "son relais est annulé : la session a repris pendant qu'il attendait sa ligne de saisie" })
		const h = lookup(me)
		if (h.ok && h.transcript !== st.transcript) stop({ cancelled: "the session moved to a new transcript (a /clear) while the relay waited for its box - nothing was typed", tellOwner: "son relais est annulé : la session a été vidée pendant qu'il attendait" })
		try { process.kill(me, 0) } catch { stop({ cancelled: "the session exited while the relay waited for its box - nothing was typed" }) }
	}
	const turn = wake.readTurn(me, lookup)
	if (turn.state !== "idle") stop({ refused: `the session reads ${turn.state} (${turn.why}) - nothing was typed` })
	// 5. /clear, proved by the registry
	phase("typing the /clear")
	const c = wake.clearFresh(me, lookup, send, CLEAR_CONFIRM_MS)
	note({ clear: { at: now(), typed: c.typed, cleared: c.cleared, why: c.why } })
	if (!c.cleared) {
		// ITS OWN WORD, TYPED SECONDS AGO BY THIS PROCESS UNDER THE KEYBOARD: left there, it blocks every later bell
		const e = c.typed ? wake.eraseOwn(read, send, (t) => wake.sameText(t, "/clear")) : null
		stop({ refused: `${c.why} - the first prompt was NOT typed`, typed: c.typed ? ["/clear"] : [], ...(e && e.presses ? { erased_own: { erased: e.erased, presses: e.presses } } : {}) })
	}
	const fresh = lookup(me)
	phase("waiting for its box after the /clear", { new_transcript: fresh.ok ? fresh.transcript : null })
	// 6. the prompt box back and empty, then the first prompt, proved by the new transcript
	let ready = null
	for (const until = Date.now() + READY_MS; Date.now() < until; nap(250)) { ready = atRest(st.sock, st.window, alt); if (ready.ok) break }
	if (!ready || !ready.ok) stop({ refused: `cleared, but the prompt did not come back at rest within ${READY_MS / 1000} s (${ready ? ready.why : "never read"}) - the first prompt was NOT typed; the session is fresh and waits`, screen: ready && ready.tail })
	phase("typing the first prompt")
	const a = send(st.say)
	if (a.status !== 0) stop({ refused: `cleared, but the first prompt could not be typed (send-text exit ${a.status}) - the session is fresh and waits` })
	// 🔴 THE ENTER WAITS UNTIL THE BOX SHOWS THE PROMPT. A long text and its Enter read in ONE chunk are a paste: the Enter
	// joins the text and nothing is submitted - measured 11-02 on 2.1.316, 270 characters + `\r` in one write left whole
	// in the box 3/3 (FINDINGS.md#enter-in-the-paste). Two writes usually reach it as two reads; a loaded machine can hand
	// them over as one (a field's relay, 11-02 03h16: its prompt whole in the box, the expert inert 15 h). Once the
	// box draws the prompt, its bytes were read, and the Enter is a key of its own.
	// 🔴 NEVER AN ENTER ON A PROMPT NOT SEEN (the tenth review of #hidden-head). Words in the box that are not the prompt are somebody's:
	// no Enter, as wake's bell does. No box at all within SHOWN_MS (a dialog, an unreadable screen), or the prompt never drawn whole:
	// no Enter either - "not shown in time: typed as before" pressed it into a dialog, and a paste not drawn in 5 s swallows its Enter.
	// The prompt stays in the box, said; a person sends it.
	// A dialog over the box before any reading gets BOX_BACK_MS for the box to come back, as one after the Ctrl+A does; once a box is
	// seen, SHOWN_MS from then (the eleventh review: 5 s here against 20 s there)
	// The CURRENT reading decides: an empty box read before the prompt was drawn cut the dialog's 20 s to 5 (the twelfth review).
	let shown = null, capped = null, theirs = false, noBoxNow = false
	const t = Date.now()
	for (let until = t + SHOWN_MS; Date.now() < until; nap(40)) {
		const s = atRest(st.sock, st.window, alt)
		// a box of 3 lines or more may hide lines above even a prompt shown whole: its start is asked for too (the thirteenth review)
		if (wake.shows(s, st.say)) { shown = Date.now() - t; capped = !wake.sameText(s.text, st.say) || wake.mayHide(s); break }
		noBoxNow = !s.ok && !s.typed
		if (noBoxNow) until = Math.max(until, Math.min(t + BOX_BACK_MS, Date.now() + SHOWN_MS))
		if (s.typed && s.text && s.text.trim() && !wake.pieceOf(s, st.say)) { theirs = true; break }
	}
	if (shown === null) stop({ refused: `cleared and the first prompt typed, but ${theirs ? "somebody's words are in the box with it" : !noBoxNow ? `the box never showed it whole within ${SHOWN_MS / 1000} s` : `no box was seen within ${BOX_BACK_MS / 1000} s (a dialog?)`} - no Enter pressed; the prompt stays in the box, a person submits or clears it; look at window ${st.window}`, typed: ["/clear", "prompt"] })
	// A BOX THAT HIDES ITS START shows the prompt's end: Ctrl+A brings its start into view, and words a person typed in front of it
	// stop the Enter, as wake's bell does (FINDINGS.md#hidden-head). The cursor stays there: an Enter there submits it all.
	// `atStart`: the cursor was SENT there, seen or not - it goes back to the end before any erase (the third review of #hidden-head)
	let atStart = false
	if (capped) {
		send("\x01")
		atStart = true
		// the relay's own SHOWN_MS, not wake's 1.5 s: a loaded kitty redraws slowly, and "unseen" now refuses (the tenth review)
		let h = wake.startInView(read, st.say, SHOWN_MS)
		// NO BOX after the Ctrl+A (a dialog): no key into it. The prompt is behind it, the handoff with it: the box back within
		// BOX_BACK_MS (blank rows are a frame between two, read on) and showing the prompt, the start check again, as if no dialog had
		// come. Showing anything else where the prompt starts: somebody's words (the seventh, eighth and ninth reviews of #hidden-head).
		if (h === "nobox") {
			let back = null
			for (const until = Date.now() + BOX_BACK_MS; Date.now() < until; nap(500)) { const s = read(); if (s.ok || (s.typed && s.text)) { back = s; break } }
			if (back && (wake.startOf(back, st.say) || wake.shows(back, st.say))) { send("\x01"); h = wake.startInView(read, st.say, SHOWN_MS) }
			else if (back && back.ok) h = "gone"
			else if (back && back.typed) h = "theirs"
			note({ prompt_box_back: { at: now(), back: !!back, check: h } })
		}
		// ONLY A START SEEN GOES ON. "Unseen" is a Ctrl+A that showed nothing: another version's, or a dialog that took it and was gone
		// before the box was read again - and words typed in front would go with the handoff (the ninth review). A relay is ONE prompt a
		// person can send: it stays in the box and the refusal says so. (Wake's bell rings unseen: rung again and again, and a bell that
		// never rings is the field's loop.) The cursor back to the end first, only into a box read to hold text - never into a dialog:
		// that is where it was before this relay's Ctrl+A, the prompt having been typed at it.
		if (h !== "start") {
			const b = read()
			if (b.typed && b.text && b.text.trim()) send("\x05")
			const what = h === "theirs" ? "somebody's words are in front of it"
				: h === "unlanded" ? "its Ctrl+A did not land (the cursor stayed elsewhere)"
				: h === "gone" ? "it left the box when its start was asked for"
				: h === "nobox" ? "the box went away when its start was asked for (a dialog?)"
				: "its start could not be brought into view (Ctrl+A showed nothing)"
			stop({ refused: `cleared and the first prompt typed, but its box hides its start and ${what} - no Enter pressed;${h === "gone" ? "" : " the prompt stays in the box, a person submits or clears it;"} look at window ${st.window}`, typed: ["/clear", "prompt"] })
		}
		note({ prompt_start: { at: now(), seen: true } })
	}
	send("\r")
	phase("proving its prompt was taken", { prompt: { at: now(), shown_ms: shown } })
	const t0 = Date.now()
	let again = null
	for (; Date.now() - t0 < TAKEN_MS; nap(250)) {
		const h = lookup(me)
		if (h.ok && taken(h.transcript, st.say)) {
			note({ relayed: true, relay_pid: null, said_at: now(), taken_ms: Date.now() - t0, transcript_now: h.transcript })
			process.exit(0)
		}
		// AND WHEN IT IS LOST ANYWAY: its OWN prompt, whole and alone, still in the box - the Enter alone, ONCE, as wake's
		// rule 8 does for its own bell. That box holds nothing anybody else wrote; anything more in it, or an empty one, gets
		// nothing. The field's question, 11-02: a lone `\r` then submitted 3/3.
		if (!again && Date.now() - t0 >= ENTER_LOST_MS) {
			const s = atRest(st.sock, st.window, alt)
			if (wake.shows(s, st.say) || (atStart && wake.startOf(s, st.say))) { send("\r"); again = now(); note({ enter_again_at: again }) }
		}
	}
	// Whatever it was, the prompt does not stay in the box: a fresh session at rest with an empty box can still be rung.
	// a box that hides its start shows the prompt's end, then slices of it as each press brings a hidden line down: `pieceOf`.
	// The cursor at the prompt's start, Ctrl+U would take nothing: back to its end first - only into a box READ to show the prompt's
	// start, never blind 15 s after an Enter that may have started a turn and a dialog (the fourth review of #hidden-head)
	// and a moment for the box to redraw: a reading from before the key made the erase stop at its first press (the ninth review)
	if (atStart && wake.startOf(read(), st.say)) { send("\x05"); nap(300) }
	const left = wake.eraseOwn(read, send, (t, s) => wake.shows(s, st.say) || (wake.mayHide(s) && wake.pieceOf(s, st.say)), { own: st.say })
	if (left.presses) note({ erased_own: { erased: left.erased, presses: left.presses } })
	stop({ refused: `cleared and the first prompt typed${again ? `, its Enter pressed again at ${again} on the prompt left whole in the box,` : ","} but no user row carrying it reached the new transcript within ${TAKEN_MS / 1000} s - look at window ${st.window}` })
}

// ── THE KEEPER AND THE REAPER: a watcher gone without writing its end (work's 93) ──────────────────────────────────
// The KEEPER is the watcher's parent, a `sh` the arming starts: when the watcher ends it runs `relay.mjs --kept <record> <rc>`,
// which reports at once - with how it ended: an exit code, or the signal (rc > 128) - if the record was left open. Nothing else
// need be awake (the review's F2: a leader whose relay died at night, its experts idle, was seen by nobody). The REAPER,
// `relay.mjs --reap <root>`, is the backstop for a keeper gone too (the whole group killed, a logout): the hook stub starts it
// at any agent's Stop when a record looks orphaned. Both end the record as a refusal (so the agent hears it at its next Stop,
// comm.mjs's untoldRelay, if its session is still the one that armed it), tell the owner, and send the LEADER a `blocked`
// letter at a file of its own - an idle expert with a dead relay is otherwise found only by somebody looking. Under the
// record's one lock, the record read again under it. A record whose SESSION is gone too (a reboot, a logout) is closed and
// logged, and nobody told: nobody waits on it. Nothing is retried: what the watcher typed is only what its record says.
const SIGNAMES = Object.fromEntries(Object.entries(osConstants.signals).map(([k, v]) => [v, k]))
const reapLog = (root, o) => appendBounded(join(root, ".comm", "relay", "reap.log"), JSON.stringify({ at: now(), pid: process.pid, ...o }) + "\n", 256 * 1024)
const FENCE = "`".repeat(3)
function reapOne(root, cfg, agent, recordPath, by, { quiet = false, how = null, waitMs = 0, armedAt = null } = {}) {
	if (!takeLock(recordPath, waitMs)) return null
	try {
		let rec = null
		try { rec = JSON.parse(readFileSync(recordPath, "utf8")) } catch { return null }
		// the keeper knows its watcher ended; the reaper must see it gone, and long enough after the arming
		// the KEEPER's own arming's record, never the next one's: its watcher may have ended itself cleanly a moment before the agent
		// armed again (the second review, F1: the new, live relay ended as "exited 1", the owner and the leader told, the agent's Stop
		// resumed - which cancelled the live one)
		if (how ? !(rec && rec.relayed == null && !rec.ended_at && armedAt && rec.armed_at === armedAt) : !orphaned(rec, recordPath)) return null
		let err = ""
		try { err = readFileSync(errPathOf(recordPath), "utf8").split("\n").filter((l) => l.trim()).slice(-8).join("\n").slice(-1500) } catch {}
		const r = reached(rec), seen = now(), gone = !sessionLives(rec.session)
		const out = { ...rec, relayed: false, relay_pid: null, ended_at: seen,
			refused: gone ? `its session (pid ${rec.session ?? "?"}) is gone, and its watcher with it - nobody waits on this relay`
				: `its watcher (pid ${rec.relay_pid ?? "none"}) ${how || "is gone"} and wrote nothing about why, ${r.where} - ${r.typed.en}. Nothing was retried`,
			died: { seen_at: seen, by, pid: rec.relay_pid ?? null, ...(how ? { how } : {}), ...(err ? { stderr: err } : {}), ...(gone ? { session_gone: true } : {}) } }
		writeRecord(recordPath, out)
		logEnd(recordPath, out)
		if (quiet || gone) return out
		// the owner's line carries nothing from the record but its window: `how` is ours, the rest fixed text
		const howFr = how ? `, ${how.replace(/^was killed by signal/, "tué par le signal").replace(/^exited (\S+) without writing its end/, "sorti en $1")}` : ""
		const told = { owner: wake.notifyOwner(root, cfg, agent, `son relais est mort sans un mot${howFr} (${r.typed.fr}) - fenêtre ${rec.window ?? "?"}`) }
		// THE LEADER, as reopen.mjs tells it of a refusal: a file of its own (the record is rewritten by the next arming), a
		// `blocked` letter signed by the agent - only the leader may sign for another, so it is sent as the leader - and a ring.
		if (cfg.leader && agent !== cfg.leader && rosterHas(cfg, cfg.leader)) {
			const file = recordPath.replace(/\.json$/, ".died.md")
			try {
				writeFileSync(file, `# The relay of ${agent} died without a word\n\n` +
					`Armed at ${rec.armed_at}, window ${rec.window ?? "?"}, session pid ${rec.session ?? "?"}. Its watcher, pid ${rec.relay_pid ?? "none"}, ` +
					`${how || "is gone"} and wrote nothing about why. Seen at ${seen} (${by}).\n\n` +
					`- **How far it got**, from its record: ${r.where}.\n- **What that left in its window**: ${r.typed.en}.\n` +
					`- **Its stderr**, last lines: ${err ? `\n\n${FENCE}\n${err.split(FENCE).join("'''")}\n${FENCE}\n` : "nothing.\n"}\n` +
					`Nothing was retried. If its session is still the one that armed it (no /clear since), it hears this at its next Stop; it is ` +
					`idle until something rings it - mail does, and it can arm its relay again. Its record: \`.comm/relay/${agent}.json\`; every ` +
					`relay of it that did not happen, this one included: \`.comm/relay/${agent}.log.jsonl\` (this file holds the latest death only).\n`)
				const s = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "comm.mjs"), "send", cfg.leader, "--from", agent, "--kind", "blocked",
					"--ref", relative(join(root, cfg.agents[agent] ?? "."), file), "--note", `the relay of ${agent} died without a word, ${r.where}: ${r.typed.en}`.slice(0, 200)],
					{ cwd: root, encoding: "utf8", timeout: 5000, env: { ...process.env, CLAUDE_COMM_AGENT: cfg.leader } })
				told.leader = s.status === 0 ? "sent" : `send exit ${s.status}: ${String(s.stderr || "").trim().split("\n")[0].slice(0, 160)}`
				if (s.status === 0) spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "wake.mjs"), "--root", root, "--agent", cfg.leader], { cwd: root, stdio: "ignore", timeout: 10_000 })
			} catch (e) { told.leader = `not sent: ${e.message}` }
		}
		// only onto the record it ended: a new arming could not have written its own meanwhile (it takes this lock), but say so in code
		try { const n = JSON.parse(readFileSync(recordPath, "utf8")); if (n.armed_at === out.armed_at && n.ended_at === out.ended_at) writeRecord(recordPath, { ...n, died: { ...out.died, told } }) } catch {}
		return out
	} finally { dropLock(recordPath) }
}
const rosterHas = (cfg, agent) => !!cfg && !!cfg.agents && typeof cfg.agents === "object" && Object.hasOwn(cfg.agents, agent)
if (ARGV[0] === "--kept") {
	const recordPath = ARGV[1] || "", rc = Number(ARGV[2]), armedAt = ARGV[3] || ""
	let rec = null
	try { rec = JSON.parse(readFileSync(recordPath, "utf8")) } catch { process.exit(0) }
	// it wrote its end - the common case - or the record is another arming's now
	if (!rec || rec.relayed != null || rec.ended_at || rec.armed_at !== armedAt) process.exit(0)
	const root = dirname(dirname(dirname(recordPath)))
	let cfg = null
	try { cfg = JSON.parse(readFileSync(join(root, ".comm", "config.json"), "utf8")) } catch {}
	const agent = basename(recordPath, ".json")
	const how = rc > 128 ? `was killed by signal ${rc - 128}${SIGNAMES[rc - 128] ? ` (${SIGNAMES[rc - 128]})` : ""}` : `exited ${Number.isFinite(rc) ? rc : "?"} without writing its end`
	let r = null
	try { if (rosterHas(cfg, agent)) r = reapOne(root, cfg, agent, recordPath, "its keeper, the moment it ended", { how, waitMs: 5000, armedAt }) } catch {}
	reapLog(root, { by: "keeper", agent, rc, did: r ? "ended it" : "nothing" })
	process.exit(0)
}
if (ARGV[0] === "--reap") {
	let root = ARGV[1] || ""
	try { root = realpathSync(root) } catch { process.exit(0) }
	let cfg = null
	try { cfg = JSON.parse(readFileSync(join(root, ".comm", "config.json"), "utf8")) } catch { process.exit(0) }
	const dir = join(root, ".comm", "relay")
	let names = []
	try { names = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.endsWith(".due.json")) } catch { process.exit(0) }
	const by = opt("--by", "a Stop hook"), did = []
	for (const f of names) {
		const agent = f.slice(0, -5)
		if (!rosterHas(cfg, agent)) continue
		try {
			const r = reapOne(root, cfg, agent, join(dir, f), by)
			if (r) { did.push(agent); console.log(`relay: ${agent}'s relay armed at ${r.armed_at} died without a word - its record says so now${r.died.session_gone ? " (its session is gone too: nobody told)" : ", the owner and the leader are told"}`) }
		} catch {}
	}
	// one line a run, whatever it did: a reaper started for nothing shows as "nothing" (the review's F5)
	reapLog(root, { by: "reaper", did: did.length ? did : "nothing" })
	process.exit(0)
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
// WHY THE REGISTRY DOES NOT KNOW IT, when the disk can say: a session started before the bus's hooks were written never
// ran their SessionStart (a field leader, 10-30, installed the bus from inside its own session and read only "not in
// the registry"). The stub's mtime against the session's start, both measured; an upgrade rewrites the stub too, and
// the same restart is the cure either way.
function beforeHooks() {
	try {
		const st = readFileSync(`/proc/${me}/stat`, "utf8"), ticks = Number(st.slice(st.lastIndexOf(")") + 2).split(" ")[19])
		const started = (Number(/^btime (\d+)/m.exec(readFileSync("/proc/stat", "utf8"))[1]) + ticks / 100) * 1000
		const stub = statSync(join(readlinkSync(`/proc/${me}/cwd`), ".claude", "comm-hook.mjs")).mtimeMs
		const hm = (t) => new Date(t).toTimeString().slice(0, 8)
		return stub > started ? `\n  This session started at ${hm(started)}; the bus's hook stub here was written at ${hm(stub)}, after it. ` +
			`Claude Code reads its hooks when a session starts, so this one has none of the bus's: no SessionStart (no registry ` +
			`entry), no Stop (no mail handed over). Restart it once - /exit, then claude in the same folder - and the relay works.` : ""
	} catch { return "" }
}
if (!hit.ok) die(`the session registry cannot name this session's transcript (${hit.why}), so neither the end of this turn nor the /clear could be proved - nothing armed${beforeHooks()}`)
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
	return rec && isWatcher(rec.relay_pid, recordPath) ? Number(rec.relay_pid) : null
}
if (has("--cancel")) {
	if (!liveWatcher()) die(`nothing is armed for '${agent}' - no live relay in ${recordPath}`, 1)
	// UNDER THE RECORD'S LOCK, the kill and the write: no reaper or keeper reads it between them (the review's F1)
	if (!takeLock(recordPath, 3000)) die(`the relay of '${agent}' is being ended by somebody else right now - read ${recordPath}`, 4)
	let rec = {}, pid = liveWatcher(), why = null
	try { rec = JSON.parse(readFileSync(recordPath, "utf8")) } catch {}
	if (!pid || rec.relayed != null || rec.ended_at) why = `it ended on its own a moment ago: ${rec.relayed ? "relayed" : rec.refused || rec.cancelled || "see its record"}`
	else try { killWatcher(pid, recordPath) } catch (e) { why = `the armed relay (pid ${pid}) could not be stopped: ${e.code || e.message}` }
	if (why) { dropLock(recordPath); die(why, 4) }
	// what it typed, read AFTER the kill: a key it sent between the first read and the kill is on record by now (the second review, F4a)
	try { rec = JSON.parse(readFileSync(recordPath, "utf8")) } catch {}
	// told_at: the agent cancelled it itself, so its Stop hook has nothing to tell it (comm.mjs, untoldRelay)
	const t = reached(rec).typed
	try { const out = { ...rec, relay_pid: null, relayed: false, cancelled: `relay.mjs --cancel - ${t.en}`, ended_at: now(), told_at: now() }; writeRecord(recordPath, out); logEnd(recordPath, out) } catch {}
	dropLock(recordPath)
	console.log(`relay: cancelled - the relay of '${agent}' (pid ${pid}) was stopped; ${t === NOTHING ? "nothing was typed" : t.en}`)
	process.exit(0)
}
/** What a LIVE watcher of this record is doing, to an arming, BY ITS PHASE: "waiting" for its box (it is replaced: "already armed"
 *  would be the lie the agent ends its turn on, and it cancels at its next look); "typing" - any phase after its box: the /clear,
 *  the prompt, its proof, or one this code does not know (refused, exit 4, never killed); else "armed" - its turn not ended, or its
 *  guards being checked: as the release before said. 🔴 NOT "checking its guards and its window" replaced (round 6's F2 did): its
 *  first look may be erasing the bus's own text under its hold, up to 35 s, and was killed there (the eighth review, F1). That
 *  "already armed" is a lie when its turn has ended - the release before's, NAMED, with the kill mid-erase of a watcher waiting
 *  for its box (the release before's too) and a watcher of ANOTHER live session of this agent replaced (F4): their cure is the
 *  watcher's own note of its /clear under the record's lock (STATUS ▶ NEXT). A watcher of the release before notes no phase: as
 *  that release judged it.
 *  🔴 Not `box_wait_since` alone: written once, never cleared, a watcher typing its /clear was killed as "waiting for its box" -
 *  since 2026-11-08.1 (the fifth review, F1). Not who holds the keyboard either: a waiting watcher holds it a moment at every
 *  LOOK, and an arming that met one was refused and the relay lost (the sixth review, F1; the gate's A95 and A114a, red under
 *  load at 11-24 01h34). Every phase is in the watcher below. */
const ARMED = ["waiting for the turn that armed it to end", "checking its guards and its window"]
const liveState = (rec) => rec.phase == null ? (rec.box_wait_since ? "waiting" : "armed")
	: ARMED.includes(rec.phase) ? "armed" : rec.phase === "waiting for its box" ? "waiting" : "typing"
// its own window, or ANOTHER live session's of this agent (the ninth review, F3: "this session is being cleared" was false there)
const typingNow = (rec) => rec.session != null && Number(rec.session) !== me
	? `the relay armed before by ANOTHER session of '${agent}' (pid ${rec.session}) is past its box, relaying its window right now (${rec.phase || "?"}) - nothing armed: two sessions share this agent's name; close one`
	: `the relay armed before is past its box, relaying this window right now (${rec.phase || "?"}) - nothing armed: ` +
		`this session is being cleared and given its first prompt; if that does not come, arm again in a moment`
let replacing = null
if (!has("--dry-run") && liveWatcher()) {
	let live = null
	try { live = JSON.parse(readFileSync(recordPath, "utf8")) } catch {}
	const s0 = live ? liveState(live) : "armed"
	if (s0 === "typing") die(typingNow(live), 4)
	if (s0 === "armed") {
		console.log(`relay: already armed for '${agent}' - it runs after this turn; \`relay.mjs --cancel\` disarms it`)
		process.exit(0)
	}
	// IT WAS WAITING FOR ITS BOX, AND THIS IS A NEW TURN: that watcher will see this turn at its next look and cancel. "Already armed"
	// would be a lie the agent ends its turn on. This arming replaces it, with its own guards and this turn's end - and stops it only
	// once every check below has passed: a refusal after the kill left it orphaned, and the reaper then told the owner, the leader and
	// the agent of a death this arming had caused (the review's F1). Refused, the old one goes on, and cancels at its next look.
	replacing = liveWatcher()
}

// the first prompt and the guards: the flags, then the project's word for this agent. A --say replaces the config's; a
// --guard only ADDS to its guards - a flag the agent types never removes the proof its project asks for (A95 flagguard)
const conf = cfg.relay && cfg.relay[agent]
const say = opt("--say", typeof conf === "string" ? conf : conf && typeof conf.say === "string" ? conf.say : null)
const confGuards = conf && typeof conf === "object" ? [].concat(conf.guard || []).filter((g) => typeof g === "string") : []
// A DECLARED HANDOFF IS A GUARD (2026-11-05, relay-guard.mjs's header): the project says once what its handoff is, and the
// bus checks it here and again before the /clear - no script of its own to copy from one project to the next.
const sq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`
const declGuard = conf && typeof conf === "object" && conf.handoff !== undefined
	? [`${sq(process.execPath)} ${sq(fileURLToPath(new URL("relay-guard.mjs", import.meta.url)))} --agent ${sq(agent)}`] : []
const guards = [...all("--guard"), ...confGuards, ...declGuard]
const cfgFile = join(root, ".comm", "config.json")
if (!say || !say.trim()) die(`no first prompt for '${agent}': pass --say "<what the fresh session is told first>", or add it once to ${cfgFile}:\n` +
	`    "relay": {"${agent}": "${agent === (cfg.leader || "leader") ? "hey leader expert" : "<the sentence that resumes this agent's work>"}"}`)
if (/[\r\n]/.test(say)) die(`the first prompt must be ONE line: a newline typed into the prompt submits it half-way`)
// Claude Code shows a text over 800 characters typed at once as `[Pasted text #1]` (2.1.325's own code, `S9=800`): the relay could
// never see its prompt, and refuses one it cannot see (the eleventh review of #hidden-head). Point at a file instead.
// kitten's send-text reads its text for backslash escapes ("\n" would be typed as a newline and submit it half-way)
if (say.includes("\\")) die(`the first prompt holds a backslash: kitten's send-text reads it as an escape, so the prompt typed would not be the prompt written - write it without one`)
if (say.length > 800) die(`the first prompt is ${say.length} characters: over 800, Claude Code collapses it into "[Pasted text]" and the relay cannot see it to press its Enter - write the details in a file and name the file in a short prompt`)
if (!guards.length) die(`no guard: pass --guard "<a command that exits 0 only when your handoff is written>" (repeatable), or add\n` +
	`    "relay": {"${agent}": {"say": ${JSON.stringify(say)}, "guard": "<cmd>"}}  to ${cfgFile}\n` +
	`  - or declare the handoff itself there, and the bus checks it: "handoff": {"file": "<it>", "written": 30} (relay-guard.mjs --help).\n` +
	`  A relay with nothing proving the handoff is a /clear on faith: what survives it is only what was written down.`)
// MAIL ALREADY WAITING CANCELS IT, ALWAYS: this turn's Stop hook hands the mail over, the turn resumes, and a resumed turn
// cancels the relay (step 2). A field's leader lost one so on 10-26, armed early in a busy turn; the record said
// "cancelled" and nobody else knew. Refused here, while the agent can still act on it - a dry run included.
let waiting = 0
try { waiting = readdirSync(join(root, ".comm", "inbox", agent)).filter((f) => f.endsWith(".json")).length } catch {}
if (waiting) die(`${waiting} message(s) wait for '${agent}' - this turn's Stop hook would hand them over, the turn would resume, and that ` +
	`cancels a relay: nothing armed.\n  Read them (node .comm/bin/comm.mjs inbox names each file), dismiss them once read ` +
	`(node .comm/bin/comm.mjs dismiss), then arm again as this turn's last act.`, 5)
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
	const scr = atRest(r.win.sock, r.win.id, r.win.alt)
	console.log(JSON.stringify({ ...state, would_arm: true, screen_now: scr.ok ? "at rest, empty" : scr.why }, null, 1))
	process.exit(0)
}
mkdirSync(dirname(recordPath), { recursive: true })
// THE RECORD'S LOCK from here to the new record: the old one is ended and the new one written with no reaper, keeper or --cancel
// reading between. Not had within 3 s (a reaper telling the leader of a death): armed all the same - it holds no live watcher.
const locked = takeLock(recordPath, 3000)
// THE RECORD THIS ONE REPLACES. One that ended was logged by whoever ended it. A watcher waiting for its box is stopped NOW, its
// record ended as cancelled and logged; one nobody ended - its watcher dead without a word (no 30 s wait here: a live one said
// "already armed" above) - is logged, and said to the agent, before it is written over.
let before = null, previously = ""
try { before = JSON.parse(readFileSync(recordPath, "utf8")) } catch {}
// "ALREADY ARMED", DECIDED AGAIN UNDER THE LOCK (the third review, F6): the test above reads unlocked, and a second arming in one
// session, or a torn read, could find no watcher there while one ran. Written over without a kill, that watcher ran blind - its
// notes, `relayed: true` among them, refused as another arming's. A live watcher of this record that is not the one replaced stays.
// One waiting for its box is replaced, as the unlocked test does: "already armed" would be the lie the agent ends its turn on, and
// that watcher then cancels at its next look (the fourth review, F4). One that left its wait since the unlocked read - typing its
// /clear now - is refused, never killed (the fifth review, F1). Every check of this arming has passed by here.
if (before && before.relayed == null && !before.ended_at && isWatcher(before.relay_pid, recordPath)) {
	const s1 = liveState(before)
	if (s1 === "waiting") replacing = Number(before.relay_pid)
	else {
		dropLock(recordPath)
		if (s1 === "typing") die(typingNow(before), 4)
		console.log(`relay: already armed for '${agent}' - it runs after this turn; \`relay.mjs --cancel\` disarms it`)
		process.exit(0)
	}
}
if (before && before.relayed == null && !before.ended_at) {
	// 🔴 NO KEYBOARD HOLD, NO WAIT, across the kill (rounds 5-7): a hold and a 4 s wait for the watcher's look, added to close the
	// microsecond between this test and the kill, lost the relay on a long look and held the record's lock past another arming's
	// 3 s - two armings armed at once, a watcher blind (the seventh review, F1, F2). The microsecond stays, NAMED: it is what every
	// release since 2026-11-08.1 had for the whole of the /clear's typing. Its cure is the watcher's, not the arming's: before it
	// types, under its own hold, it reads its record still its arming's (STATUS, next).
	if (replacing && isWatcher(replacing, recordPath)) {
		try { killWatcher(replacing, recordPath) } catch {}
		// what it typed, read AFTER the kill, as --cancel does (the third review, F3: a key noted between the read and the kill was lost)
		try { const n = JSON.parse(readFileSync(recordPath, "utf8")); if (n && n.armed_at === before.armed_at) before = n } catch {}
		// and if that read says it ENDED on its own a moment before the kill - relayed, even - its end stands: never "replaced" over it.
		// A watcher killed AS it ended was killed before its own log row (the fourth review, F1: the end kept here, then written over
		// by the new record, was in no record and no log) - so a relay that did not happen is logged on its behalf, once.
		if (before.relayed == null && !before.ended_at) {
			const out = { ...before, relayed: false, relay_pid: null, ended_at: now(), cancelled: `replaced by a new arming while it waited for its box - ${reached(before).typed.en}`, told_at: now() }
			writeRecord(recordPath, out); logEnd(recordPath, out)
		} else if (before.relayed === false && !endLogged(recordPath, before)) {
			logEnd(recordPath, { ...before, logged_by: "the arming that replaced it - its watcher was killed as it ended" })
		}
	} else if (!isWatcher(before.relay_pid, recordPath)) {
		let err = ""
		try { err = readFileSync(errPathOf(recordPath), "utf8").split("\n").filter((l) => l.trim()).slice(-8).join("\n").slice(-1500) } catch {}
		const r = reached(before)
		logEnd(recordPath, { ...before, relayed: false, relay_pid: null, ended_at: now(), refused: `its watcher (pid ${before.relay_pid ?? "none"}) is gone and wrote nothing about why, ${r.where} - ${r.typed.en}`,
			died: { seen_at: now(), by: "its own next arming", pid: before.relay_pid ?? null, ...(err ? { stderr: err } : {}) } })
		previously = `\n  ⚠ Your previous relay (armed ${before.armed_at}) died without a word, ${r.where} - ${r.typed.en}. Logged: ${logPathOf(recordPath)}`
	}
}
// ITS STDERR IS KEPT, one run's worth: a death prints there, and the keeper quotes it (before, "ignore" - work's 93)
let errFd = "ignore"
try { errFd = openSync(errPathOf(recordPath), "w") } catch {}
writeRecord(recordPath, state)
// THE KEEPER: a `sh` that waits for the watcher - its parent, so it alone knows how it ended - and, if it ended without writing its
// end, runs `--kept` with the exit code (128 + the signal for a kill). It leads their process group: `killWatcher` stops both.
// `$3`, the arming's own `armed_at`: `--kept` ends that arming's record and no other
const KEEPER = `"$0" "$1" --after-turn "$2"; rc=$?; exec "$0" "$1" --kept "$2" "$rc" "$3"`
const watcher = spawn("sh", ["-c", KEEPER, process.execPath, fileURLToPath(import.meta.url), recordPath, state.armed_at], { detached: true, stdio: ["ignore", "ignore", errFd] })
if (typeof errFd === "number") try { closeSync(errFd) } catch {}
watcher.unref()
// the keeper's pid is written HERE, before this returns, so a second relay.mjs in the same turn sees it (A89's lesson); its command
// line carries `--after-turn` and this record's path, as the watcher's does, until the watcher ends
writeRecord(recordPath, { ...state, relay_pid: watcher.pid || null })
if (locked) dropLock(recordPath)
console.log(`relay: armed - ${GRACE_MS / 1000} s after THIS turn ends, window ${r.win.id} gets /clear, then: ${say}\n` +
	`  Guards checked now and again just before: ${guards.length}. Write your last answer, then end your turn.\n` +
	`  Anything that starts another turn first cancels it (\`relay.mjs --cancel\` does too). Every step lands in ${recordPath}.${previously}`)
