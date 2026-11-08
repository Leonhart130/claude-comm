#!/usr/bin/env node
/**
 * claude-comm TEAMS, REAL - who launches, who closes, and a closed chief reopened by its mail, on real Claude Code sessions.
 *
 *   node test/teams-real.mjs                    this repo's bus, every scenario in order (each builds on the last)
 *   node test/teams-real.mjs --repo <dir>       another checkout's bus
 *
 * WHY IT EXISTS, beside A119-A123. Those arms use a process named `claude`, a fake kitten for the reopenings: a fake only knows
 * what was measured. This is the measurement: a throwaway project under a trusted parent (no trust dialog), a real leader started
 * BY HAND through a shell that stays (so it is NOT its window's process, the shape close.mjs's own test cannot answer), a real
 * chief and a real expert that launch.mjs opened, real hooks, a real kitty, Haiku at low effort, no plugin and no MCP server (it
 * takes nobody's Telegram bot, STATUS 1b), every OS window minimized.
 *
 * NOT A GATE, like selftest and box-real: it spends a little real usage, about 5 min, and opens 3-4 minimized windows. Reported,
 * never gated. A scenario whose start could not be drawn reads UNARMED, never as a pass.
 */
import { spawnSync } from "node:child_process"
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { homedir } from "node:os"
import { fileURLToPath, pathToFileURL } from "node:url"

const ARGV = process.argv.slice(2)
const opt = (f, d = null) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] !== undefined ? ARGV[i + 1] : d }
const REPO = resolve(opt("--repo", join(dirname(fileURLToPath(import.meta.url)), "..")))
const wake = await import(pathToFileURL(join(REPO, "bin", "wake.mjs")).href)
const SOCK = (process.env.KITTY_LISTEN_ON || "").replace(/^unix:/, "")
if (!SOCK) { console.log("teams-real: not inside kitty (no KITTY_LISTEN_ON) - nothing was run"); process.exit(2) }
const nap = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const log = (...a) => console.log(new Date().toISOString().slice(11, 21), ...a)
const results = []
const verdict = (name, pass, detail) => { results.push({ name, pass }); log(pass === null ? "· UNARMED" : pass ? "✓" : "✗", name, "-", detail) }

const root = join(homedir(), "Dev", `.probe-teams-${process.pid}`)
const told = join(root, "told.txt")
const AGENTS = { leader: ".", chief: "chief", worker: "worker", other: "other" }
for (const d of Object.values(AGENTS)) mkdirSync(join(root, d, d === "." ? ".comm" : ""), { recursive: true })
for (const d of ["chief", "worker", "other", "."]) writeFileSync(join(root, d, "NOTE.md"), "Nothing to do: this is a test note. Stop.\n")
const off = Object.fromEntries(["telegram", "supabase", "vercel", "context7", "frontend-design"].map((p) => [`${p}@claude-plugins-official`, false]))
const SYS = "This is a test of a message bus. Answer in one short word. When a message asks you to run a command, run exactly that command with Bash, once, then end your turn. Do nothing else: never read files, never reply on the bus unless asked."
const ARGS = ["--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--settings", JSON.stringify({ enabledPlugins: off }), "--allowedTools", "Bash", "--append-system-prompt", SYS]
const SAY = "Nothing to do, this is a test: end your turn."
const baseCfg = { leader: "leader", agents: AGENTS, teams: { chief: ["worker", "other"] },
	launch: Object.fromEntries(["chief", "worker", "other"].map((a) => [a, { args: ARGS }])),
	reopen: { chief: { model: "haiku", effort: "low", say: SAY } }, caps: { windows: 9 }, notify: ["sh", "-c", 'printf "%s\\n" "$1" >> "$0"', told] }
const setCfg = (o) => writeFileSync(join(root, ".comm", "config.json"), JSON.stringify(o, null, 1))
setCfg(baseCfg)
const inst = spawnSync(process.execPath, [join(REPO, "install.mjs"), root], { encoding: "utf8", timeout: 60000 })
log("installed the bus of", REPO, "- exit", inst.status)
const bin = (t) => join(root, ".comm", "bin", t)
const ks = (...a) => spawnSync("kitten", ["@", "--to", `unix:${SOCK}`, ...a], { encoding: "utf8", timeout: 5000 })
const whoJson = () => { try { return JSON.parse(spawnSync(process.execPath, [bin("comm.mjs"), "who", "--json"], { cwd: root, encoding: "utf8", env: { ...process.env, CLAUDE_COMM_AGENT: "" } }).stdout).agents } catch { return null } }
const pidOf = (a) => (whoJson()?.[a]?.pids || [])[0] || 0
const windows = () => JSON.parse(ks("ls").stdout).flatMap((o) => o.tabs).flatMap((t) => t.windows)
const winOf = (pid) => windows().find((w) => w.pid === pid || (w.foreground_processes || []).some((p) => p.pid === pid))
const rec = (pid) => { try { return JSON.parse(readFileSync(join(homedir(), ".claude/sessions", `${pid}.json`), "utf8")) } catch { return {} } }
const idle = (pid, ms = 90000) => { for (const u = Date.now() + ms; Date.now() < u; nap(500)) { if (rec(pid).status === "idle") { nap(1500); if (rec(pid).status === "idle") return true } } return false }
const prompt = (id, text) => { ks("send-text", "--match", `id:${id}`, text); nap(400); ks("send-text", "--match", `id:${id}`, "\r") }
const until = (f, ms = 60000) => { for (const u = Date.now() + ms; Date.now() < u; nap(250)) { const v = f(); if (v) return v } return null }
const inbox = (a) => { try { return readdirSync(join(root, ".comm", "inbox", a)).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(root, ".comm", "inbox", a, f), "utf8"))) } catch { return [] } }
const json = (...p) => { try { return JSON.parse(readFileSync(join(root, ...p), "utf8")) } catch { return null } }
const rss = (pid) => { try { return Math.round(Number(readFileSync(`/proc/${pid}/status`, "utf8").match(/^VmRSS:\s+(\d+)/m)[1]) / 1024) } catch { return 0 } }
const transcriptsOf = (dir) => { const d = join(homedir(), ".claude/projects", dir.replace(/[^A-Za-z0-9]/g, "-")); try { return readdirSync(d).filter((f) => f.endsWith(".jsonl")).map((f) => readFileSync(join(d, f), "utf8")).join("\n") } catch { return "" } }

const opened = new Set()
let code = 0
let leaderId = 0
try {
	// THE LEADER, STARTED BY HAND: through a shell that stays, so the window's process is the shell and the session its child.
	leaderId = Number(ks("launch", "--type=os-window", "--os-window-state=minimized", "--keep-focus", `--cwd=${root}`, process.env.SHELL || "zsh", "-ic",
		`claude --model claude-haiku-5-5 --effort low ${ARGS.map((a) => `'${a}'`).join(" ")}; :`).stdout)
	if (!(leaderId > 0)) throw new Error("no leader window")
	opened.add(leaderId)
	const lp = until(() => pidOf("leader"), 40000)
	if (!lp) throw new Error("the leader never appeared in who")
	until(() => wake.promptAtRest(ks("get-text", "--ansi", "--match", `id:${leaderId}`).stdout || "").ok, 40000)
	nap(3000)
	const lw = winOf(lp)
	log(`leader pid ${lp}, window ${leaderId}, the window's own process ${lw && lw.pid}: hand-started=${!!lw && lw.pid !== lp}`)
	const runIn = (id, pid, cmd) => { idle(pid); prompt(id, `Run exactly this command with Bash, then end your turn: ${cmd}`) }
	const launchCmd = (a, first) => `node ${a === "worker" || a === "other" ? "../" : ""}.comm/bin/launch.mjs ${a} --model haiku --effort low --prompt "${first}" --os-window --minimized`

	// r1: the hand-started leader launches a chief; the request opens
	runIn(leaderId, lp, launchCmd("chief", SAY))
	const cp = until(() => pidOf("chief"), 60000)
	const chiefWin = cp ? until(() => winOf(cp), 5000) : null
	if (chiefWin) opened.add(chiefWin.id)
	// launch.mjs marks the window after kitty answers, and `who` sees the session before that: read the mark when launch has finished, the request is written last
	const cAsked = until(() => existsSync(join(root, ".comm", "asked", "chief", "leader")), 15000)
	const cMark = cp ? (winOf(cp) || { user_vars: {} }).user_vars.CLAUDE_COMM_LAUNCHED : null
	verdict("r1 a hand-started leader launches a chief, whose first turn opens a request", !!cp && !!cAsked && cMark === "chief", `chief pid ${cp}, marked=${cMark}, asked=${!!cAsked}`)

	// r2: a real chief launches its own expert
	let wp = 0, workerWin = null
	if (cp) {
		idle(cp)
		runIn(chiefWin.id, cp, `node .comm/bin/launch.mjs worker --model haiku --effort low --prompt "${SAY}" --os-window --minimized`.replace(".comm", "../.comm"))
		wp = until(() => pidOf("worker"), 60000) || 0
		workerWin = wp ? until(() => winOf(wp), 5000) : null
		if (workerWin) opened.add(workerWin.id)
		const wAsked = until(() => existsSync(join(root, ".comm", "asked", "worker", "chief")), 15000)
		verdict("r2 a real chief launches its own expert", !!wp && !!wAsked, `worker pid ${wp}, asked by the chief=${!!wAsked}`)
	} else verdict("r2 a real chief launches its own expert", null, "no chief")

	// r3: the expert tries a colleague: refused, nothing opened, and it reads why
	if (wp) {
		idle(wp)
		runIn(workerWin.id, wp, `node ../.comm/bin/launch.mjs other --model haiku --effort low --prompt "${SAY}" --os-window --minimized`)
		nap(8000); idle(wp)
		const tx = transcriptsOf(join(root, "worker"))
		verdict("r3 a real expert launching a colleague is refused", !pidOf("other") && /neither the leader nor a chief/.test(tx), `other running=${!!pidOf("other")}, the refusal in its transcript=${/neither the leader nor a chief/.test(tx)}`)
	} else verdict("r3 a real expert launching a colleague is refused", null, "no worker")

	// r4: the chief closes its expert at rest: the window gone, the record by name, its own request withdrawn
	if (wp && cp) {
		idle(wp); idle(cp)
		runIn(chiefWin.id, cp, `node ../.comm/bin/close.mjs --agent worker`)
		const gone = until(() => !windows().some((w) => w.id === workerWin.id), 45000)
		const r = until(() => { const x = json(".comm", "close", "worker.json"); return x && x.gone !== null ? x : null }, 15000)
		if (gone) opened.delete(workerWin.id)
		// kitty's window goes first, the session a moment later: how long is measured, not assumed
		const t4 = Date.now(), dead = until(() => !pidOf("worker"), 15000), lag = Date.now() - t4
		const withdrawn = until(() => !existsSync(join(root, ".comm", "asked", "worker", "chief")), 15000)
		verdict("r4 a real chief closes its expert at rest", !!gone && !!r && r.by === "chief" && r.gone === true && !!dead && !!withdrawn, `window gone=${!!gone}, record by=${r && r.by}, gone=${r && r.gone}, its session gone ${lag} ms later=${!!dead}, its request withdrawn=${!!withdrawn}`)
	} else verdict("r4 a real chief closes its expert at rest", null, "no chief or no worker")

	// r5: THE DEAREST. The chief closes itself; the leader's real send; the sender's real hook reopens it, minimized; its mail lands
	if (cp) {
		idle(cp)
		// the report that closes the request (a close with mail waiting would refuse)
		runIn(chiefWin.id, cp, `node ../.comm/bin/close.mjs`)
		const gone = until(() => !windows().some((w) => w.id === chiefWin.id), 60000)
		if (gone) opened.delete(chiefWin.id)
		until(() => !pidOf("chief"), 10000)
		idle(lp)
		const t0 = Date.now()
		runIn(leaderId, lp, `node .comm/bin/comm.mjs send chief --ref NOTE.md --note r5`)
		const np = until(() => pidOf("chief"), 90000)
		const openedAfter = Date.now() - t0
		let newWin = null, rssAt = [], busyAfter = null
		if (np) {
			newWin = until(() => winOf(np), 5000)
			if (newWin) opened.add(newWin.id)
			const t1 = Date.now()
			for (const u = t1 + 25000; Date.now() < u; nap(1000)) {
				rssAt.push(`${Math.round((Date.now() - t1) / 1000)}s:${rss(np)}`)
				if (busyAfter === null && rec(np).status === "busy") busyAfter = Date.now() - t1
				if (Date.now() - t1 > 12000 && rec(np).status === "idle") break
			}
		}
		const r = until(() => { const x = json(".comm", "reopen", "chief.json"); return x && x.started !== null && x.started !== undefined ? x : null }, 70000)
		const tx = transcriptsOf(join(root, "chief"))
		verdict("r5 a closed chief is reopened by the leader's real send, and its mail lands", !!gone && !!np && !!r && r.started === true && !inbox("chief").length && tx.includes(SAY),
			`closed itself=${!!gone}; reopened pid ${np} ${Math.round(openedAfter / 1000)} s after the send was asked; record started=${r && r.started} after ${r && r.started_after_ms} ms; inbox empty=${!inbox("chief").length}; say in its transcript=${tx.includes(SAY)}; first busy after ${busyAfter} ms; RSS ${rssAt.slice(0, 16).join(" ")} MB`)

		// r6: it is at rest with the bus's bell left in its box: the leader closes it, a real inert window
		if (np && newWin) {
			idle(np)
			ks("send-text", "--match", `id:${newWin.id}`, wake.NUDGE); nap(1200)
			const box = wake.promptAtRest(ks("get-text", "--ansi", "--match", `id:${newWin.id}`).stdout || "")
			const armed = box.typed === true && !!wake.busText(box.text)
			if (!armed) verdict("r6 an inert window: the bus's bell left in its box, closed by the leader", null, `box as drawn: ${JSON.stringify(box).slice(0, 120)}`)
			else {
				runIn(leaderId, lp, `node .comm/bin/close.mjs --agent chief`)
				const g2 = until(() => !windows().some((w) => w.id === newWin.id), 45000)
				const x = until(() => { const y = json(".comm", "close", "chief.json"); return y && y.by === "leader" && y.gone !== null ? y : null }, 15000)
				if (g2) opened.delete(newWin.id)
				verdict("r6 an inert window: the bus's bell left in its box, closed by the leader", !!g2 && !!x && x.gone === true && /bell/.test(x.box_held || ""), `window gone=${!!g2}, by=${x && x.by}, box_held=${x && x.box_held}`)
			}
		} else verdict("r6 an inert window: the bus's bell left in its box, closed by the leader", null, "no reopened chief")

		// r7: the caps refuse a real reopening: told once, the leader's session rung at a file; room comes back, it opens
		until(() => !pidOf("chief"), 10000)
		idle(lp)
		setCfg({ ...baseCfg, caps: { windows: 1 }, reopenTiming: { retryMs: 0 } })
		rmSync(told, { force: true }); rmSync(join(root, ".comm", "reopen"), { recursive: true, force: true })
		runIn(leaderId, lp, `node .comm/bin/comm.mjs send chief --ref NOTE.md --note r7`)
		const refused = until(() => { const x = json(".comm", "reopen", "chief.json"); return x && x.refused ? x : null }, 60000)
		const toldLines = () => { try { return readFileSync(told, "utf8").split("\n").filter(Boolean) } catch { return [] } }
		until(() => toldLines().length, 15000)
		nap(4000); idle(lp, 60000)
		const leaderTx = transcriptsOf(root)
		const leaderHeard = /reopen of chief/.test(leaderTx) || inbox("leader").some((m) => m.from === "chief")
		const stillClosed = !pidOf("chief")
		const t1Lines = toldLines().length
		setCfg({ ...baseCfg, caps: { windows: 4 }, reopenTiming: { retryMs: 0 } })
		// a later hook of anybody's: the leader takes a turn
		idle(lp); prompt(leaderId, "Answer with one word: ok")
		const np2 = until(() => pidOf("chief"), 90000)
		if (np2) { const w = until(() => winOf(np2), 5000); if (w) opened.add(w.id) }
		verdict("r7 the caps refuse a real reopening: told once, the leader's session hears it, room comes back and it opens", !!refused && stillClosed && t1Lines === 1 && leaderHeard && !!np2,
			`refused=${refused && refused.refused.slice(0, 70)}; owner told ${t1Lines}x; the leader heard=${leaderHeard}; stayed closed=${stillClosed}; reopened after room came back=${!!np2}`)
	} else for (const n of ["r5", "r6", "r7"]) verdict(`${n}`, null, "no chief")

	log(`\n${results.filter((x) => x.pass === true).length} passed, ${results.filter((x) => x.pass === false).length} failed, ${results.filter((x) => x.pass === null).length} unarmed - Claude Code ${rec(lp).version}, the bus of ${REPO}`)
	code = results.every((x) => x.pass === true) ? 0 : 1
} catch (e) { log("ABORT", e.message); code = 2 }
finally {
	// every window this opened, by id and by what is left of the roster
	for (const w of windows()) if (opened.has(w.id) || (w.cwd || "").startsWith(root)) ks("close-window", "--match", `id:${w.id}`)
	nap(800)
	// a reopening still waiting on a session: gone before the folder is, or it answers into a folder deleted under it
	until(() => !spawnSync("pgrep", ["-f", `${root}/.comm/bin/reopen`], { encoding: "utf8" }).stdout.trim(), 75000)
	for (const d of Object.values(AGENTS)) rmSync(join(homedir(), ".claude/projects", join(root, d === "." ? "" : d).replace(/[^A-Za-z0-9]/g, "-")), { recursive: true, force: true })
	rmSync(root, { recursive: true, force: true })
	log("windows closed, folder removed:", !existsSync(root))
}
process.exit(code)
