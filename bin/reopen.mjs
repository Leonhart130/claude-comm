#!/usr/bin/env node
/**
 * claude-comm REOPEN — mail for a closed agent its project declared: open it, once, inside the caps, minimized.
 *
 *   node .comm/bin/reopen.mjs <agent> [--root <dir>]             what wake.mjs runs, detached, from the sender's hook
 *   node .comm/bin/reopen.mjs <agent> [--root <dir>] --now       without waiting out a recent refusal: what a close runs, room having just been freed
 *   node .comm/bin/reopen.mjs <agent> [--root <dir>] --dry-run   what it would do and why: nothing opened, nobody told
 *
 *   .comm/config.json  "reopen": {"<agent>": {"model": "<m>", "effort": "<e>", "say": "<its first prompt, one line>"}}
 *                      mail that asks (not an fyi) for this agent when it is closed: the next hook in the project opens it, in a minimized
 *                      OS window, inside "caps", which must then bound it ("windows" or "availableMb"). A refusal tells the owner and the leader
 *                      once per mail waiting. .comm/reopen/<agent>.json says what happened.
 *   .comm/config.json  "reopenTiming": {"startMs": 60000, "settleMs": 8000, "retryMs": 60000, "tellMs": 5000, "lockMs": 600000}   how long a start may take, how long the next one waits for it, between two tries after a refusal, how long a burst's refusals gather into one alarm, how long the project's launch lock may stay held before somebody is told
 *
 * WHY. Work's leader, 11-08, its review of the hierarchy: 13 chiefs reopened by hand for one Monday, because a chief closed
 * between two tasks is closed when its expert reports, and mail for a closed agent waits for a person. So it wrote "a chief
 * stays open until its chain is done", which is memory held all night. Delivery does not change: the opened session's own
 * start hands it its mail, as for any start. FINDINGS.md#teams-b
 *
 * WHAT CAN GO WRONG IS A MACHINE FULL OF WINDOWS, AND EACH RULE HERE IS ONE WAY OF IT:
 *   - Inside the caps, read and acted on under the project's launch lock, held past the launch until the new session has
 *     taken its share: several closed agents get mail in ONE hook, and each read of the same free room would pass.
 *     Measured on a real session (2.1.319, Haiku): its start ran 1.2 s after the launch, busy at 2 s, 300 MB by then, flat after.
 *     Already over a cap, it refuses without queueing: a waiter costs 53 MB of its own.
 *   - ONCE for a piece of mail. A session that dies at its start leaves its mail waiting, and every later hook of every
 *     agent would open it again, a boot each. What was opened for is recorded; only NEWER mail opens it again.
 *   - An `fyi` opens nothing: it asks nothing, and a boot is the price.
 *   - A close forced over mail is not undone by that mail: whoever forced it has read the refusal.
 *   - A refusal retries at later hooks, since room comes back, and a close that frees room looks at once. It says so once per
 *     mail waiting, and a burst of them is ONE alarm: 8 closed chiefs at a full cap were 6 critical notifications in 6 s.
 *   - It gates on the effect: a window opened is not a session started (a dialog, a crash), nor one anybody can close (no mark). Told.
 *
 * Every path of a hook exits 0 on internal error; this one is detached from it, and still has nothing to break.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "node:fs"
import { join, dirname, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

if (process.argv.includes("--help")) {
	console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => /^ \*\s{2,}node \S*bin\/[\w-]+\.mjs/.test(l))
		.map((l) => l.replace(/^ \*\s+/, "").replace(/^node (\.comm\/)?bin\//, "node .comm/bin/")).join("\n"))
	process.exit(0)
}

const ARGV = process.argv.slice(2)
const agent = ARGV[0]
const opt = (f) => { const i = ARGV.indexOf(f); return i >= 0 ? ARGV[i + 1] : null }
const dryRun = ARGV.includes("--dry-run")
if (!agent || agent.startsWith("--")) { console.error("usage: reopen.mjs <agent> [--root <dir>] [--now] [--dry-run]"); process.exit(2) }
let root = resolve(opt("--root") || process.cwd())
while (!existsSync(join(root, ".comm", "config.json"))) { const up = dirname(root); if (up === root) { console.error("reopen: no .comm/ found"); process.exit(2) } root = up }
const say = (what) => { console.log(`reopen ${agent}: ${what}`) }

const HERE = dirname(fileURLToPath(import.meta.url))
const team = await import(new URL("team.mjs", import.meta.url))
const wake = await import(new URL("wake.mjs", import.meta.url))
const { lookup } = await import(new URL("session-registry.mjs", import.meta.url))
const cfg = JSON.parse(readFileSync(join(root, ".comm", "config.json"), "utf8"))
const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k)
if (!own(cfg.agents, agent) || !own(cfg.reopen, agent)) { say(`not declared in "reopen": nothing to do`); process.exit(0) }

const num = (k, d) => { const v = cfg.reopenTiming && cfg.reopenTiming[k]; return Number.isFinite(v) && v >= 0 ? v : d }
const START_MS = num("startMs", 60_000), SETTLE_MS = num("settleMs", 8000), RETRY_MS = num("retryMs", 60_000), TELL_MS = num("tellMs", 5000), LOCK_MS = num("lockMs", 10 * 60_000)
const nap = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

const dir = join(root, ".comm", "reopen"), recOf = (a) => join(dir, `${a}.json`)
// A PROJECT DELETED UNDER THIS (a test's, measured: 60 s later it re-created the folder, and told a session had died): nothing to say, and nowhere to say it.
const gone = () => !existsSync(join(root, ".comm", "config.json"))
const readRec = (a = agent) => { try { return JSON.parse(readFileSync(recOf(a), "utf8")) || {} } catch { return {} } }
const note = (o, a = agent) => { if (gone()) process.exit(0); try { mkdirSync(dir, { recursive: true }); const t = `${recOf(a)}.t${process.pid}`; writeFileSync(t, JSON.stringify({ ...readRec(a), agent: a, ...o }, null, 1) + "\n"); renameSync(t, recOf(a)) } catch {} }

// ONE of these per agent, whichever hook came first; the others have nothing to add, and each would hold 53 MB waiting.
const agentLock = dryRun ? {} : team.takeLock(join(dir, `${agent}.lock`), { waitMs: 0 })
if (!dryRun && !agentLock.ok) { say("another reopening of it is under way"); process.exit(0) }

/**
 * THE OWNER AND THE LEADER. Once per mail waiting: `told_for` is the oldest message that asks, so more mail behind it is silent, and once that one
 * has been read (opened here, by hand, or by anyone) the next refusal is a new one. A flag cleared only on an opening HERE went silent for good after a hand opened it.
 * ONE ALARM FOR A BURST: a refusal notes what it would say, one teller gathers the others until they stop coming, then one line to the owner and one bell to the leader at one file.
 * Each channel keeps its own account: a send that failed is tried again at this agent's next try, and the owner is not alarmed a second time for it.
 * The teller looks again after letting go: a refusal notes itself BEFORE it tries the lock, so either this look sees it, or that try finds the lock free.
 * A teller killed leaves `pending_tell` for the next try of anybody's. Two agents' records are merged here unlocked: a lost update needs both within a millisecond, and costs one alarm or one opening.
 */
const pendingRecs = () => { let n = []; try { n = readdirSync(dir).filter((f) => f.endsWith(".json")) } catch {} return n.map((f) => readRec(f.slice(0, -5))).filter((r) => r.pending_tell) }
function sendPending() {
	for (const t0 = Date.now(); Date.now() - t0 < 60_000; nap(100)) {
		const last = Math.max(0, ...pendingRecs().map((r) => Date.parse(r.pending_tell.at)))
		if (Date.now() - last >= TELL_MS) break
	}
	const recs = pendingRecs()
	if (!recs.length || gone()) return
	const names = recs.map((r) => r.agent), head = recs[0].pending_tell.line
	const fresh = recs.filter((r) => r.owner_for !== r.pending_tell.for)
	if (fresh.length) wake.notifyOwner(root, cfg, fresh.map((r) => r.agent).join(", "), `réouverture : ${fresh[0].pending_tell.line}`)
	const file = join(dir, "refused.md"), from = names.find((a) => a !== cfg.leader)
	let leaderTold = !from
	try {
		writeFileSync(file, `# Not reopened (${new Date().toISOString()})\n\n${recs.map((r) => `## ${r.agent}\n\n${r.pending_tell.detail}\n\nRecord: .comm/reopen/${r.agent}.json`).join("\n\n")}\n\nThe mail waits in each inbox and lands at that agent's next start. Later hooks try again unless the record says it was opened once already for this mail.\n`)
		if (from) {
			// from the root, signed: an agent whose folder is gone is one of the reasons this is sent (a cwd that does not exist ran nothing, and only the owner heard)
			const s = spawnSync(process.execPath, [join(HERE, "comm.mjs"), "send", cfg.leader, "--from", from, "--kind", "blocked", "--ref", relative(join(root, cfg.agents[from] ?? "."), file), "--note", `reopen of ${names.join(", ")}: ${head}`.slice(0, 200)],
				{ cwd: root, encoding: "utf8", timeout: 5000, env: { ...process.env, CLAUDE_COMM_AGENT: cfg.leader } })
			leaderTold = s.status === 0
			if (leaderTold) spawnSync(process.execPath, [join(HERE, "wake.mjs"), "--root", root, "--agent", cfg.leader], { cwd: root, stdio: "ignore", timeout: 10_000 })
		}
	} catch {}
	for (const r of recs) { const k = r.pending_tell.for
		note({ owner_for: k, leader_for: leaderTold ? k : null, told_for: leaderTold ? k : null, told_at: new Date().toISOString(), told: r.pending_tell.line, leader_told: leaderTold, pending_tell: null }, r.agent) }
}
function tell(line, detail) {
	if (dryRun) return
	// this process has done what it came for: the close that frees room while this gathers must find the agent free (it found "under way", and nothing looked again)
	if (agentLock.release) agentLock.release()
	const first = (team.asksFor(root, agent) || [])[0]
	// the oldest mail that asks; an inbox that cannot be read has none, so an hour's key: once for that episode, and a later one is told too
	const key = first ? (first.id || first.ts) : `no-mail-${Math.floor(Date.now() / 3600_000)}`
	if (readRec().told_for === key) return
	note({ pending_tell: { line, detail, for: key, at: new Date().toISOString() } })
	for (;;) {
		const t = team.takeLock(join(dir, "tell.lock"), { waitMs: 0 })
		if (!t.ok) return
		sendPending()
		t.release()
		if (!pendingRecs().length || gone()) return
	}
}

const asks = team.asksFor(root, agent)
if (asks === null) { tell("sa boîte de réception n'a pas pu être lue", `Its inbox could not be read, so nobody can say whether mail waits.`); say("its inbox could not be read"); process.exit(0) }
if (!asks.length) { say("nothing waiting for it asks anything (an fyi asks nothing)"); process.exit(0) }
const newest = asks[asks.length - 1].ts

// A CLOSE FORCED OVER THIS MAIL stands: `at` is when, and only what came after asks anew.
let closed = null
try { closed = JSON.parse(readFileSync(join(root, ".comm", "close", `${agent}.json`), "utf8")) } catch {}
if (closed && closed.forced && closed.at >= newest) { say(`a close was forced over this mail at ${closed.at}${closed.by ? ` by ${closed.by}` : ""}: it stands until newer mail`); process.exit(0) }

// ONCE.
const rec = readRec()
if (rec.tried && rec.tried >= newest) {
	const why = `it was opened at ${rec.opened_at} for this very mail and is closed again with the mail unread`
	tell(`rouvert une fois pour ce courrier, et de nouveau fermé sans l'avoir lu`, `${why}. It is not opened again for this mail: a session that dies at its start would otherwise take a boot at every hook. Newer mail opens it again, or a person does.`)
	say(`${why}: not again`)
	process.exit(0)
}
if (!dryRun && !ARGV.includes("--now") && rec.refused_at && Date.now() - Date.parse(rec.refused_at) < RETRY_MS) { say(`refused ${Math.round((Date.now() - Date.parse(rec.refused_at)) / 1000)} s ago: the next try is a later hook's`); process.exit(0) }

const running = (st) => !!st && st.agents[agent].pids.length > 0
if (running(team.liveState(root))) { say("already running"); process.exit(0) }

const d = cfg.reopen[agent] || {}
const argv = [join(HERE, "launch.mjs"), agent, "--reopen", "--model", String(d.model), "--effort", String(d.effort), "--prompt", String(d.say), "--os-window", "--minimized"]
// A timer's send has no kitty around it, and this may have outlived its hook's session: any kitty of this user's will do, the window is minimized.
const env = { ...process.env }
if (!env.KITTY_LISTEN_ON) { const w = wake.windows()[0]; if (w) env.KITTY_LISTEN_ON = `unix:${w.sock}` }

// The project's lock goes before anybody is told: a teller gathers for seconds, and the next in the queue is what it is gathering.
let lock = null
const letGo = () => { if (lock && lock.release) lock.release(); lock = null }
const refuse = (why) => {
	letGo()
	note({ refused: why, refused_at: new Date().toISOString() })
	tell(why.split("\n")[0].slice(0, 300), why)
	say(`refused: ${why}`)
	process.exit(1)
}
const clean = (r) => String(r.stderr || "").replace(/^✗ /, "").trim() || (r.error ? r.error.code : `launch.mjs exit ${r.status}`)
// launch.mjs's own refusals, every one of them, before queueing: --print refuses exactly as the launch does (A53). A17 is the mechanism working: whoever opened it first has it.
const checked = spawnSync(process.execPath, [...argv, "--print"], { cwd: root, encoding: "utf8", timeout: 30_000, env })
if (dryRun) { say(checked.status === 0 ? `would open it now, for ${asks.length} message(s), the newest ${newest}` : `would be refused: ${clean(checked)}`); process.exit(0) }
if (checked.status !== 0) {
	if (/already running/.test(clean(checked))) { say("already running"); process.exit(0) }
	refuse(clean(checked))
}

// THE PROJECT'S LOCK, past the launch (launch.mjs borrows it). A long queue is no refusal of this agent's, but somebody must hear of a lock held for 10 min: something is stuck.
const got = team.takeLock(join(root, ".comm", "launch.lock"), { waitMs: LOCK_MS })
if (!got.ok) {
	const by = got.holder ? ` (pid ${got.holder.pid})` : "", mins = Math.round(LOCK_MS / 60_000)
	tell(`le verrou de lancement du projet reste pris depuis ${mins} min${by}`, `The project's launch lock has been held for ${mins} min${by}: every launch here waits behind it. A later hook looks again.`)
	say("the project's launch lock stayed held: a later hook looks again")
	process.exit(0)
}
lock = got
// Read again under it: the wait may have been long, and somebody may have opened it, or it may have read its mail.
if (running(team.liveState(root))) { say("already running"); process.exit(0) }
const now = team.asksFor(root, agent)
if (!now || !now.length) { say("its mail has gone meanwhile"); process.exit(0) }
const covers = now[now.length - 1].ts

const r = spawnSync(process.execPath, argv, { cwd: root, encoding: "utf8", timeout: 60_000, env })
const why = clean(r)
// kitty answered and the window cannot be found, or no id came back: a session that went out and is perhaps not there.
// That is an opening spent, not a refusal: retried, a crash at start would open a window at every hook of every agent.
// A kitty that answered past launch.mjs's 15 s may have opened it all the same: the same, and the look below finds out.
const wentOut = /no such window is there|returned no window id|ETIMEDOUT/.test(why)
if (r.status !== 0 && !wentOut) {
	if (/already running/.test(why)) { say("already running"); process.exit(0) }
	refuse(why)
}
const window = Number((`${r.stdout}${r.stderr}`.match(/window:? (\d+)/) || [])[1]) || null
note({ tried: covers, opened_at: new Date().toISOString(), window, refused: null, refused_at: null, told_for: null, owner_for: null, leader_for: null, told_at: null, told: null, pending_tell: null, started: null })

// THE EFFECT: its own start ran (the registry has it) or its mail has left the box. Not the window: `kitten @ launch` has answered
// for a session at its trust dialog, whose default is "No, exit" (A88). Then the room it takes, before the lock goes on to the next.
const t0 = Date.now()
let pid = 0, started = false
for (; Date.now() - t0 < START_MS && !started; nap(200)) {
	if (gone()) process.exit(0)
	const st = team.liveState(root)
	pid = (st && st.agents[agent].pids[0]) || 0
	if (st && !pid && Date.now() - t0 > 3000) break   // no session in that window after 3 s: it died
	started = !!pid && (lookup(pid).ok || (() => { const left = team.asksFor(root, agent); return !!left && !left.some((m) => m.ts === covers) })())
}
if (!started) {
	const line = pid ? `fenêtre ${window} ouverte, sa session n'a pas démarré en ${Math.round(START_MS / 1000)} s (un dialogue ?)` : `fenêtre ${window} ouverte, et sa session est morte à l'instant`
	note({ started: false, gave_up_at: new Date().toISOString() })
	letGo()
	tell(line, pid ? `Window ${window} was opened and pid ${pid} is alive, but its SessionStart never ran in ${START_MS / 1000} s and its mail is still there: a dialog at its start, probably.` : `Window ${window} was opened and no session of it is alive any more. It is not opened again for this mail.`)
	say(line)
	process.exit(1)
}
note({ started: true, started_after_ms: Date.now() - t0 })
for (const t = Date.now(); Date.now() - t < SETTLE_MS && team.turnNow(pid).state !== "busy"; nap(200)) {}
nap(Math.min(SETTLE_MS, 1000))
letGo()
// A SESSION NOTHING CAN CLOSE holds its place under the caps until a person comes (an `ls` lost right after the launch, a kitty that answered late): marked here if
// that is all it lacks, since this opened it and it is its window's own process; said if not. Read three times: one blip of `ls` is no missing mark. A session already gone needs none.
const marked = (w) => w.ok && w.win.vars.CLAUDE_COMM_LAUNCHED === agent
let found = wake.resolveWindow(pid, wake.windows())
for (let i = 0; i < 2 && !marked(found); i++) { nap(250); found = wake.resolveWindow(pid, wake.windows()) }
if (!marked(found) && found.ok && found.win.shellPid === pid) {
	spawnSync("kitten", ["@", "--to", `unix:${found.win.sock}`, "set-user-vars", "--match", `id:${found.win.id}`, `CLAUDE_COMM_LAUNCHED=${agent}`], { encoding: "utf8", timeout: 5000, env })
	found = wake.resolveWindow(pid, wake.windows())
}
const st = team.liveState(root)
if (!marked(found) && st && st.agents[agent].pids.includes(pid)) {
	note({ marked: false })
	tell(`fenêtre ${window} ouverte sans sa marque : seule une personne peut la fermer`, `Pid ${pid} is up and working, but its window carries no CLAUDE_COMM_LAUNCHED mark (${found.ok ? `window ${found.win.id}` : found.why}), so neither it nor close.mjs --agent can close it: a person must, when it is done.`)
}
say(`opened in window ${window}, for ${now.length} message(s)`)
