#!/usr/bin/env node
/**
 * claude-comm BOX, REAL - the bus's own text left in a box, replayed on a real Claude Code session.
 *
 *   node test/box-real.mjs                    this repo's bus, every scenario
 *   node test/box-real.mjs --repo <dir>       another checkout's bus: the control, run on the code BEFORE the fix it must redden
 *   node test/box-real.mjs --only s1,s4       those scenarios
 *
 * WHY IT EXISTS, beside A111-A115. Those arms draw the box with a fake, and a fake only knows what was measured. This is the
 * measurement again, end to end, with the installed bus: a real session (Haiku, one minimized OS window, a throwaway folder
 * under a trusted parent, no plugin and no MCP server so it takes nobody's Telegram bot, STATUS 1b), two bells whose Enter was
 * lost in its box, then wake, the timer's ring, the relay, an expert, the agents' footer. A person's words are the witness on every
 * path. FINDINGS.md#left-in-the-box
 *
 * NOT A GATE, like selftest: it spends a little real usage, about 3 min. Reported, never gated. Each scenario first proves its
 * own box was drawn as it says, so a scenario that could not start reads UNARMED, never as a pass.
 */
import { spawn, spawnSync } from "node:child_process"
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { homedir } from "node:os"
import { fileURLToPath, pathToFileURL } from "node:url"

const ARGV = process.argv.slice(2)
const opt = (f, d = null) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] !== undefined ? ARGV[i + 1] : d }
const REPO = resolve(opt("--repo", join(dirname(fileURLToPath(import.meta.url)), "..")))
const ONLY = opt("--only", null)
const wants = (s) => !ONLY || ONLY.split(",").includes(s)
const wake = await import(pathToFileURL(join(REPO, "bin", "wake.mjs")).href)
const { promptAtRest, NUDGE: N } = wake
const squash = (s) => String(s).replace(/\s+/g, "")
const SOCK = (process.env.KITTY_LISTEN_ON || "").replace(/^unix:/, "")
if (!SOCK) { console.log("box-real: not inside kitty (no KITTY_LISTEN_ON) - nothing was run"); process.exit(2) }
const nap = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const log = (...a) => console.log(new Date().toISOString().slice(11, 21), ...a)
const results = []
const verdict = (name, pass, detail) => { results.push({ name, pass }); log(pass === null ? "· UNARMED" : pass ? "✓" : "✗", name, "-", detail) }

const root = join(homedir(), "Dev", `.probe-box-${process.pid}`)
const told = join(root, "told.txt")
mkdirSync(join(root, ".comm"), { recursive: true })
mkdirSync(join(root, "helper"), { recursive: true })
writeFileSync(join(root, "helper", "NOTE.md"), "Nothing to do: this is a test note. Dismiss it and stop.\n")
writeFileSync(join(root, ".comm", "config.json"), JSON.stringify({ leader: "leader", agents: { leader: ".", helper: "helper" },
	box: { retryMs: 1500, notifyAfterMs: 3000, maxMs: 90000 }, notify: ["sh", "-c", 'printf "%s\\n" "$1" >> "$0"', told] }, null, 1))
const inst = spawnSync(process.execPath, [join(REPO, "install.mjs"), root], { encoding: "utf8", timeout: 60000 })
log("installed the bus of", REPO, "- exit", inst.status)
const bus = join(root, ".comm", "bin", "comm.mjs"), wakeBin = join(root, ".comm", "bin", "wake.mjs"), relayBin = join(root, ".comm", "bin", "relay.mjs")
const off = Object.fromEntries(["telegram", "supabase", "vercel", "context7", "frontend-design"].map((p) => [`${p}@claude-plugins-official`, false]))
const launched = spawnSync("kitten", ["@", "--to", `unix:${SOCK}`, "launch", "--type=os-window", "--os-window-state=minimized", "--keep-focus", `--cwd=${root}`,
	// through an INTERACTIVE shell, as launch.mjs starts every agent: node lives under nvm, and a session without it runs no hook
	process.env.SHELL || "zsh", "-ic", 'exec "$@"', "box-real", "claude", "--model", "claude-haiku-5-5", "--effort", "low", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--settings", JSON.stringify({ enabledPlugins: off }), "--allowedTools", "Bash,Agent",
	"--append-system-prompt", "This is a test of a message bus. Answer in one short word. When a message asks you to run a command, run exactly that command with Bash, once, then end your turn. Do nothing else."], { encoding: "utf8", timeout: 10000 })
const id = Number(launched.stdout)
const ks = (...a) => spawnSync("kitten", ["@", "--to", `unix:${SOCK}`, ...a], { encoding: "utf8", timeout: 5000 })
const send = (t) => ks("send-text", "--match", `id:${id}`, t)
const screen = () => ks("get-text", "--ansi", "--match", `id:${id}`).stdout || ""
const rest = () => promptAtRest(screen())
const allText = (s) => (s.ok ? "" : s.text || "")

let code = 0
try {
	if (!(id > 0)) throw new Error(`no window: ${launched.stderr}`)
	let r
	for (const u = Date.now() + 40000; Date.now() < u; nap(500)) { r = rest(); if (r.ok) break }
	if (!r.ok) throw new Error(`never at rest: ${r.why}\n${screen().replace(/\x1b\[[0-9;:]*m/g, "").split("\n").slice(-20).join("\n")}`)
	nap(3000)
	const lsw = JSON.parse(ks("ls").stdout).flatMap((o) => o.tabs).flatMap((t) => t.windows).find((w) => w.id === id)
	const pid = (lsw.foreground_processes || []).map((p) => p.pid).find((p) => { try { return readFileSync(`/proc/${p}/cmdline`, "utf8").split("\0").some((x) => /claude/.test(x)) } catch { return false } })
	const kids = spawnSync("sh", ["-c", `pgrep -P ${pid} -a | grep -v 'git ' | cut -c1-100`], { encoding: "utf8" }).stdout.trim()
	log(`session pid ${pid}; its children besides git: ${kids || "none"}; no telegram server=${!/telegram/i.test(kids)}`)
	const rec = () => { try { return JSON.parse(readFileSync(join(homedir(), ".claude/sessions", `${pid}.json`), "utf8")) } catch { return {} } }
	const txDir = join(homedir(), ".claude/projects", root.replace(/[^A-Za-z0-9]/g, "-"))
	const tx = () => join(txDir, `${rec().sessionId}.jsonl`)
	const parse = (f) => { let t = ""; try { t = readFileSync(f, "utf8") } catch {}; return t.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean) }
	const textOf = (e) => { const c = e.message?.content; return typeof c === "string" ? c : Array.isArray(c) ? c.map((x) => x.text || "").join("") : "" }
	// no turn yet, no folder yet (`#no-turn-yet`): that is no rows, not a failure
	const userRows = () => { let fl = []; try { fl = readdirSync(txDir) } catch {}; return fl.filter((n) => n.endsWith(".jsonl")).flatMap((n) => parse(join(txDir, n))).filter((e) => e.type === "user" && !e.isMeta).map(textOf).filter(Boolean) }
	const bellRows = () => userRows().filter((s) => s.includes("[claude-comm] doorbell"))
	const turnEnds = () => parse(tx()).filter((e) => e.type === "system" && e.subtype === "turn_duration").length
	const idle = (ms = 60000) => { // the runtime's own word, then two reads apart: never the box
		for (const u = Date.now() + ms; Date.now() < u; nap(500)) { const s = rec().status; if (s === "idle") { nap(1500); if (rec().status === "idle") return true } }
		return false
	}
	const env = (agent) => ({ ...process.env, CLAUDE_COMM_AGENT: agent })
	const mail = () => spawnSync(process.execPath, [bus, "send", "leader", "--ref", "NOTE.md", "--note", "box-real"], { cwd: join(root, "helper"), encoding: "utf8", env: env("helper") }).status === 0
	const dismiss = () => spawnSync(process.execPath, [bus, "dismiss", "leader"], { cwd: root, encoding: "utf8", env: env("leader") }).status
	const noQuiet = () => rmSync(join(root, ".comm", "wake", "leader.json"), { force: true })
	const ring = () => { const o = spawnSync(process.execPath, [wakeBin, "--root", root, "--agent", "leader", "--json"], { cwd: root, encoding: "utf8", timeout: 30000, env: { ...process.env, CLAUDE_COMM_AGENT: "" } }); try { return JSON.parse(o.stdout).results.find((x) => x.agent === "leader") || { why: "no result" } } catch { return { why: `no answer: ${(o.stderr || "").slice(0, 100)}` } } }
	const emptyBox = () => { for (let i = 0; i < 30; i++) { if (rest().ok) return true; send("\x15"); nap(250) } return false }
	const twoBellsLeft = () => { send(`${N}${N}\r\r`); nap(1500); const s = rest(); return s.typed === true && squash(s.text) === squash(N + N) }
	const settle = () => { idle(); dismiss(); noQuiet(); emptyBox(); nap(800) }

	if (wants("s1")) {   // the field's night: two bells whose Enter was lost, mail waiting, a ring
		settle()
		const armed = twoBellsLeft(), before = bellRows().length, sent = mail()
		if (!armed || !sent) verdict("s1 two bells left in the box, then a ring (wake, or the field's timer)", null, `box as drawn=${armed}, mail=${sent}: ${allText(rest()).slice(0, 80)}`)
		else {
			const res = ring(); nap(2500)
			const after = bellRows().slice(before)
			verdict("s1 two bells left in the box, then a ring (wake, or the field's timer)", res.sent === true && rest().ok === true && after.length === 1,
				`ring: ${res.sent ? `sent${res.resubmitted ? ", Enter only" : ""}` : `REFUSED: ${res.why}`}; box now ${rest().ok ? "empty" : "NOT empty"}; rows carrying a bell ${after.length}`)
		}
	}
	if (wants("s2")) {   // the witness: a person's words are never touched, and the same box emptied is rung
		settle()
		send("bonjour je voul"); nap(800)
		const armed = rest().typed === true && squash(rest().text) === "bonjourjevoul", before = bellRows().length, sent = mail()
		if (!armed || !sent) verdict("s2 a person's words in the box", null, `box as drawn=${armed}, mail=${sent}`)
		else {
			const res = ring(); nap(1500)
			const kept = rest().typed === true && squash(rest().text) === "bonjourjevoul"
			const noBell = bellRows().length === before
			// the refused ring started --until-rung (wake's rule 10): nobody rings now, and the emptied box must be rung by it
			emptyBox()
			let rung = false
			for (const u = Date.now() + 12000; Date.now() < u && !rung; nap(250)) rung = bellRows().length === before + 1
			verdict("s2 a person's words in the box", res.sent === false && kept && noBell && rung,
				`refused=${res.sent === false} (${String(res.why).slice(0, 60)}), words intact=${kept}, no bell=${noBell}; emptied, then rung by the ring that kept looking=${rung}`)
		}
	}
	if (wants("s3")) {   // a cut bell: erased, and one clean bell instead
		settle()
		send(N.slice(0, 150)); nap(800)
		const armed = rest().typed === true && squash(rest().text) === squash(N.slice(0, 150)), before = bellRows().length, sent = mail()
		if (!armed || !sent) verdict("s3 a cut bell in the box", null, `box as drawn=${armed}, mail=${sent}`)
		else {
			// a hook never erases (its 10 s could kill it half-way): the ring that keeps looking does, then types one clean bell
			const res = ring()
			for (const u = Date.now() + 20000; Date.now() < u && bellRows().length === before; nap(250)) {}
			nap(1500)
			const after = bellRows().slice(before)
			verdict("s3 a cut bell in the box", res.stays === true && after.length === 1 && squash(after[0]) === squash(N) && rest().ok === true,
				`the hook's ring: ${res.stays ? "left it, as it must" : `${res.sent ? "sent" : `refused: ${res.why}`}`}; then rows ${after.length}, whole bell=${after.length === 1 && squash(after[0]) === squash(N)}`)
		}
	}
	if (wants("s4")) {   // two real rings at once on an empty box: one bell
		settle()
		const before = bellRows().length, sent = mail()
		const race = await Promise.all([0, 6].map((d) => new Promise((res) => setTimeout(() => {
			const c = spawn(process.execPath, [wakeBin, "--root", root, "--agent", "leader", "--json"], { cwd: root, stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, CLAUDE_COMM_AGENT: "" } })
			let o = ""; c.stdout.on("data", (x) => { o += x }); c.on("exit", () => { try { res(JSON.parse(o).results.find((x) => x.agent === "leader")) } catch { res(null) } })
		}, d))))
		nap(3000)
		const after = bellRows().slice(before), bells = after.reduce((a, s) => a + (s.match(/\[claude-comm\] doorbell/g) || []).length, 0)
		verdict("s4 two rings 6 ms apart on an empty box", sent && bells === 1 && rest().ok === true, `sent by ${race.filter((x) => x && x.sent).length}; bells submitted ${bells} in ${after.length} row(s); the other said: ${(race.find((x) => x && !x.sent) || {}).why || "-"}`)
	}
	if (wants("s7")) {   // the agents' footer, on the real thing: sub-agents at work under an idle leader
		settle()
		send('Use the Agent tool 7 times in one message, each with run_in_background true, subagent_type general-purpose, model haiku, and the prompt "Run the shell command sleep 90, then reply done." Then end your turn.'); nap(300); send("\r")
		let shape = null, at = null, status = null
		const ended = turnEnds()
		// the turn's end in the TRANSCRIPT: the runtime's status does not say "idle" while sub-agents run
		for (const u = Date.now() + 75000; Date.now() < u; nap(500)) {
			const lines = screen().replace(/\x1b\[[0-9;:]*m/g, "").split("\n")
			if (turnEnds() > ended && lines.some((l) => /◯/.test(l))) { nap(1500); at = rest(); status = rec().status; shape = screen().replace(/\x1b\[[0-9;:]*m/g, "").split("\n").filter((l) => l.trim()).slice(-11); break }
		}
		if (!shape) verdict("s7 the box under the agents' footer", null, `no footer drawn at rest: ${screen().replace(/\x1b\[[0-9;:]*m/g, "").split("\n").filter((l) => l.trim()).slice(-4).join(" / ")}`.slice(0, 300))
		else {
			log("  its last lines:\n" + shape.map((l) => `    ${l.slice(0, 90)}`).join("\n"))
			const before = bellRows().length
			noQuiet(); mail()
			const res = ring(); nap(2500)
			verdict("s7 the box under the agents' footer", at.ok === true && res.sent === true && bellRows().length === before + 1, `read at rest=${at.ok === true} (${at.why || "ok"}); the runtime says ${status}; a ring: ${res.sent ? "sent" : `REFUSED: ${res.why}`}`)
		}
		// they end by themselves: their sleep is 90 s, and this session closes with the rest
	}
	const relayScenario = (name, fill, after) => {
		settle()
		const say = `box-real ${name} resumes`
		const started = turnEnds()
		const asked = `Run exactly this command with Bash, then end your turn: node .comm/bin/relay.mjs --guard true --say "${say}"`
		send(asked); nap(300); send("\r")
		const recPath = join(root, ".comm", "relay", "leader.json")
		let armed = false
		const was = (() => { try { return statSync(recPath).mtimeMs } catch { return 0 } })()
		for (const u = Date.now() + 60000; Date.now() < u && !armed; nap(200)) { try { armed = statSync(recPath).mtimeMs > was } catch {} }
		if (!armed) {
			const said = parse(tx()).slice(-12).map((e) => { const c = e.message?.content; return Array.isArray(c) ? c.map((x) => x.type === "text" ? x.text : x.type === "tool_use" ? `TOOL ${JSON.stringify(x.input).slice(0, 90)}` : x.type === "tool_result" ? `RESULT ${JSON.stringify(x.content).slice(0, 240)}` : "").join(" ") : "" }).filter(Boolean).slice(-4).join(" | ")
			return { unarmed: `the relay was not armed; last rows: ${said}; screen: ${screen().replace(/\x1b\[[0-9;:]*m/g, "").split("\n").filter((l) => l.trim()).slice(-8).join(" / ")}`.slice(0, 900) }
		}
		fill()
		let rel = null
		for (const u = Date.now() + 120000; Date.now() < u; nap(500)) { try { rel = JSON.parse(readFileSync(recPath, "utf8")) } catch {}; if (after) after(rel); if (rel && rel.relayed !== null && !rel.relay_pid) break }
		nap(2000)
		return { rel, say, took: userRows().some((s) => s.trim() === say) }
	}
	if (wants("s5")) {   // the relay, with two bells in its box when its turn ends
		const x = relayScenario("s5", () => send(`${N}${N}`))
		if (x.unarmed) verdict("s5 a relay with two bells in its box", null, x.unarmed)
		else verdict("s5 a relay with two bells in its box", x.rel.relayed === true && x.took && !!x.rel.erased_own, `relayed=${x.rel.relayed}, its prompt in the new transcript=${x.took}, erased=${JSON.stringify(x.rel.erased_own || null)}${x.rel.refused ? `; REFUSED: ${x.rel.refused}` : ""}`)
	}
	if (wants("s6")) {   // the relay, with a person's words in its box: it waits, tells, and goes when they are gone
		let emptied = false
		const x = relayScenario("s6", () => send("bonjour je voul"), (rel) => { if (!emptied && rel && rel.waiting_for_the_box) { emptied = true; send("\x15") } })
		let t = ""
		try { t = readFileSync(told, "utf8") } catch {}
		if (x.unarmed) verdict("s6 a relay with a person's words in its box", null, x.unarmed)
		else verdict("s6 a relay with a person's words in its box", x.rel.relayed === true && x.took && emptied && /attend depuis/.test(t) && !/bonjour/.test(t),
			`waited and told=${emptied}, relayed=${x.rel.relayed}, its prompt taken=${x.took}, the owner's line kept the words out=${!/bonjour/.test(t)}${x.rel.refused ? `; REFUSED: ${x.rel.refused}` : ""}`)
	}
	if (wants("s8")) {   // the same stranded box on an EXPERT's real session: the owner's words were "ni toi, ni un de tes agents"
		const ex = spawnSync("kitten", ["@", "--to", `unix:${SOCK}`, "launch", "--type=os-window", "--os-window-state=minimized", "--keep-focus", `--cwd=${join(root, "helper")}`,
			process.env.SHELL || "zsh", "-ic", 'exec "$@"', "box-real", "claude", "--model", "claude-haiku-5-5", "--effort", "low", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--settings", JSON.stringify({ enabledPlugins: off }),
			"--append-system-prompt", "This is a test of a message bus. Answer in one short word."], { encoding: "utf8", timeout: 10000 })
		const eid = Number(ex.stdout)
		const eScreen = () => ks("get-text", "--ansi", "--match", `id:${eid}`).stdout || ""
		const eSend = (t) => ks("send-text", "--match", `id:${eid}`, t)
		try {
			let r2
			for (const u = Date.now() + 40000; Date.now() < u; nap(500)) { r2 = promptAtRest(eScreen()); if (r2.ok) break }
			nap(4000)
			eSend(`${N}${N}\r\r`); nap(1500)
			const s = promptAtRest(eScreen())
			const armed = s.typed === true && squash(s.text) === squash(N + N)
			const sent = spawnSync(process.execPath, [bus, "send", "helper", "--ref", "NOTE.md", "--note", "box-real"], { cwd: root, encoding: "utf8", env: env("leader") }).status === 0
			if (!armed || !sent) verdict("s8 two bells left in an EXPERT's box, then a ring", null, `box as drawn=${armed}, mail=${sent}`)
			else {
				const o = spawnSync(process.execPath, [wakeBin, "--root", root, "--agent", "helper", "--json"], { cwd: root, encoding: "utf8", timeout: 30000, env: { ...process.env, CLAUDE_COMM_AGENT: "" } })
				let res = {}
				try { res = JSON.parse(o.stdout).results.find((x) => x.agent === "helper") || {} } catch {}
				nap(2500)
				const emptied = promptAtRest(eScreen()).ok === true
				verdict("s8 two bells left in an EXPERT's box, then a ring", res.sent === true && emptied, `ring: ${res.sent ? `sent${res.resubmitted ? ", Enter only" : ""}` : `REFUSED: ${res.why}`}; box now ${emptied ? "empty" : "NOT empty"}`)
			}
		} finally { if (eid > 0) ks("close-window", "--match", `id:${eid}`) }
	}
	log(`\n${results.filter((x) => x.pass === true).length} passed, ${results.filter((x) => x.pass === false).length} failed, ${results.filter((x) => x.pass === null).length} unarmed - Claude Code ${rec().version}, the bus of ${REPO}`)
	code = results.every((x) => x.pass === true) ? 0 : 1
} catch (e) { log("ABORT", e.message); code = 2 }
finally {
	if (id > 0) ks("close-window", "--match", `id:${id}`)
	nap(500)
	rmSync(root, { recursive: true, force: true })
	rmSync(join(homedir(), ".claude/projects", root.replace(/[^A-Za-z0-9]/g, "-")), { recursive: true, force: true })
	log("window closed, folder removed:", !existsSync(root))
}
process.exit(code)
