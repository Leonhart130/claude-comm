#!/usr/bin/env node
/**
 * claude-comm LAUNCH — start an agent's session, or REFUSE. Never both.
 *
 *   node bin/launch.mjs <agent> [--print]
 *
 * WHY THIS REFUSES INSTEAD OF TRYING. `kitten @ launch` starts the child from the
 * KITTY process, so the child inherits kitty's environment — and kitty here was
 * started from a .desktop file, where nvm has never been on PATH. The session comes
 * up, returns a window id, looks completely normal, and every hook in it is dead: no
 * bus, no ledger, no registry entry, no mail at any turn boundary. That is the exact
 * silent no-op this project keeps paying for, raised to the level of a whole agent.
 * FINDINGS.md#hookless-launch.
 *
 * The published fix used to say "launch through a login shell". It is FALSE on this
 * box — nvm is loaded from ~/.zshrc, which a login shell never reads — and worse, it
 * is a PER-WORKSTATION rule dressed as a framework rule. The field leader named the
 * cost: "whoever applies your fix gets the failure the fix was meant to remove, plus
 * the conviction of having repaired it."
 *
 * So this launcher depends on NO shell profile. It resolves the runtime to absolute
 * paths itself and hands the child an environment that already works:
 *
 *   node   — process.execPath. Absolute BY CONSTRUCTION: if this file is running,
 *            a working node is running it. There is no resolution to get wrong.
 *   claude — searched on PATH and in the known install locations, then checked for
 *            executability. Unresolvable => REFUSE, and return no window id.
 *
 * Resolving `claude` alone would not have been enough, and that is the half a reader
 * skips: the hooks inside the launched session run `node`, and their node comes from
 * the CHILD's PATH. A launcher that resolves claude and lets kitty supply the
 * environment produces a session that starts and still has no bus.
 *
 * Three guard rules come from DESIGN-autonomy.md, each paid for already:
 *   - Only a name in .comm/config.json may be launched. A name from message text
 *     would be command injection wearing the bus's clothes.
 *   - Refuse to launch what is already alive (A17: two sessions, one identity).
 *   - An agent may close ITSELF, never a sibling. This tool therefore only opens.
 *     The closing verb is `bin/close.mjs`, and the CHILD invokes it.
 *
 * ── THE SPLIT (owner, 2026-09-10) ──────────────────────────────────────────────────
 *
 * *"c'est super d'ouvrir une fenetre et lancer un agent, mais ce serait aussi super de
 * pouvoir fermer celle-ci lorsqu'il a fini, sinon dans un environnement intense et
 * autonome, on risque d'avoir beaucoup de fenetres."* An autonomy design that only ever
 * opens is one that fills the screen. So the default is `--type=window` — a pane in the
 * CURRENT tab, what ctrl+shift+enter does by hand — and `--os-window` is the opt-out.
 *
 * 🔴 **The window id is now CAPTURED, and an unparseable one REFUSES.** It used to be
 * thrown away: this file checked kitten's exit status and printed success. A launch that
 * returns no id is the hookless launch in a new costume — a session that looks started
 * and is reachable by nothing — and the id is also what the user variable below is set
 * on, so losing it loses the child's ability to close itself.
 *
 * 🔴 **`CLAUDE_COMM_WINDOW` in the child's environment was DESIGNED AND CANNOT BE BUILT.**
 * DESIGN-autonomy.md's section B says to pass the id "in the child's built environment,
 * beside CLAUDE_COMM_AGENT". It does not exist yet at that moment: kitty only answers
 * with an id AFTER the child is spawned, and by then its environment is fixed. Found by
 * building it, not by reading it.
 *
 * ⇒ **The mark goes on the WINDOW instead, as a kitty user variable**, set immediately
 * after the launch and visible in `kitten @ ls`. That is strictly stronger than the
 * environment variable the design asked for, and for the reason the design itself was
 * worried about (review #8 C4): **an environment variable is inherited by every child a
 * session spawns, so a `claude -p` would carry it and could close its parent's window. A
 * user variable is attached to the window and inherited by nothing.** The trap is closed
 * by construction rather than by a cross-check that has to be remembered.
 */
import { existsSync, accessSync, constants, readFileSync } from "node:fs"
import { join, dirname, delimiter } from "node:path"
import { spawnSync } from "node:child_process"
import { homedir } from "node:os"

const die = (msg) => { console.error(`✗ ${msg}`); process.exit(1) }

// ── the runtime, resolved rather than hoped for ──────────────────────────────
const isExec = (p) => { try { accessSync(p, constants.X_OK); return true } catch { return false } }

/** Absolute path to `claude`, or null. Never returns a bare name: a bare name is
 *  what the launched process would have had to resolve itself, which is the bug. */
function resolveClaude(env = process.env) {
	const seen = (env.PATH || "").split(delimiter).filter(Boolean)
	const known = [join(homedir(), ".local", "bin"), "/usr/local/bin", "/usr/bin"]
	for (const dir of [...seen, ...known]) {
		const p = join(dir, "claude")
		if (existsSync(p) && isExec(p)) return p
	}
	return null
}

const agent = process.argv[2]
const printOnly = process.argv.includes("--print")
// Default to the split. The opt-out is a flag rather than the other way round because the
// owner named the failure that decides it: an intense session launches several agents, and
// many OS windows is the thing that goes wrong.
const osWindow = process.argv.includes("--os-window")
// 🔴 THE FIRST TURN. Reported by the `getajob` field leader 2026-09-11, after it cost his
// owner two mornings: this launcher started `claude` with NO ARGUMENTS, so the session came
// up and sat at its prompt. **The failure does not look like one** — the window is there,
// the PATH is right, the mail was delivered, `comm who` says `running` — and nothing works.
// It is STATUS item 5's third state arriving by the front door: a session that has taken no
// turn has no transcript at all, and `who` reports it exactly like a working one.
//
// `claude` takes a prompt positionally, so this is one element of argv. The CALLER decides
// the content: there is no default text here and no default in config.json, because a
// launcher that writes an agent's first instruction is a launcher with an opinion about
// the work. What it does instead is REFUSE TO BE QUIET about the consequence — see the
// closing lines, which say plainly that a promptless session will sit inert.
// ONE definition, printed by BOTH the real launch and --print. Two copies of this sentence
// would drift, and the drift would land in the mode nobody reads twice.
const NO_PROMPT_WARNING =
	`  ⚠ NO --prompt: this session will sit at its prompt and take NO TURN. 'comm who' will still say\n` +
	`    'running', and mail delivered at its start will sit in its context unread. Give it a first\n` +
	`    turn with --prompt, or type into the window yourself.`
const pi = process.argv.indexOf("--prompt")
const prompt = pi > -1 ? process.argv[pi + 1] : null
if (pi > -1 && (prompt === undefined || prompt.startsWith("--")))
	die(`--prompt needs text after it. A bare --prompt would launch a session that takes no turn,\n` +
	    `  which is the exact failure the flag exists to remove.`)
if (!agent || agent.startsWith("--")) die(`usage: launch.mjs <agent> [--prompt "<first turn>"] [--print] [--os-window]\n` +
	`  default: a pane in the CURRENT tab. --os-window opens a separate OS window instead.\n` +
	`  --prompt is what makes the new session TAKE A TURN. Without it, it sits at its prompt\n` +
	`  and does nothing, while 'comm who' reports it as running.`)

// ── the roster is the only source of a launchable name ───────────────────────
let root = process.cwd()
while (!existsSync(join(root, ".comm", "config.json"))) {
	const up = dirname(root)
	if (up === root) die(`no .comm/ found above cwd — this is not a bus project`)
	root = up
}
const cfg = JSON.parse(readFileSync(join(root, ".comm", "config.json"), "utf8"))
if (!cfg.agents[agent]) {
	die(`unknown agent '${agent}'. Known: ${Object.keys(cfg.agents).join(", ")}\n` +
	    `  A launchable name comes from .comm/config.json, never from message text.`)
}

// ── refuse to launch what is already alive (A17) ─────────────────────────────
// comm.mjs is resolved RELATIVE TO THIS FILE, never rebuilt from the project root:
// the field layout is .comm/bin/, the dev layout is bin/, and a path guessed from the
// root is wrong in one of them. Getting it wrong is not a visible error — spawnSync
// would return no stdout, the liveness test would read FALSE, and the launcher would
// cheerfully open a second session under one identity, which is the very defect this
// guard exists to prevent. So an unusable `who` REFUSES; it never means "not running".
const commBin = new URL("comm.mjs", import.meta.url).pathname
const who = spawnSync(process.execPath, [commBin, "who"], { cwd: root, encoding: "utf8" })
if (who.status !== 0 || typeof who.stdout !== "string") {
	die(`cannot ask 'comm who' whether '${agent}' is already running (exit ${who.status}) — REFUSING.\n` +
	    `  Not knowing is not the same as knowing it is down: launching now risks two sessions\n` +
	    `  under one identity (A17). Tried: ${commBin}`)
}
if (new RegExp(`^\\s*●\\s+${agent}\\s`, "m").test(who.stdout)) {
	die(`'${agent}' is already running — refusing to give one identity two sessions (A17).`)
}

// ── the refusal this file exists for ─────────────────────────────────────────
const nodeBin = process.execPath
const claudeBin = resolveClaude()
if (!claudeBin) {
	die(`cannot resolve 'claude' to an absolute path — REFUSING to launch.\n` +
	    `  A launcher that cannot find the runtime must not return a window id: the session\n` +
	    `  would start, look normal, and have no bus, no ledger and no registry entry.\n` +
	    `  FINDINGS.md#hookless-launch`)
}

// The child's PATH is BUILT, not inherited: kitty's environment is the thing that
// was wrong. node's own directory goes first so the session's hooks resolve it.
const childPath = [dirname(nodeBin), dirname(claudeBin), ...(process.env.PATH || "").split(delimiter).filter(Boolean)]
	.filter((d, i, a) => a.indexOf(d) === i).join(delimiter)
const cwd = join(root, cfg.agents[agent] ?? ".")
const argv = ["@", "launch", `--type=${osWindow ? "os-window" : "window"}`, "--keep-focus", `--cwd=${cwd}`,
	`--env=PATH=${childPath}`, `--env=CLAUDE_COMM_AGENT=${agent}`, claudeBin,
	...(prompt ? [prompt] : [])]

if (printOnly) {
	// Same resolution, same refusals, same argv — only the spawn is skipped, so a
	// control that uses it travels the code the real launch travels.
	console.log(JSON.stringify({ agent, cwd, node: nodeBin, claude: claudeBin, path: childPath, argv,
		type: osWindow ? "os-window" : "window", prompt }, null, 2))
	// 🔴 THE WARNING BELONGS HERE TOO. Reported by the `getajob` field leader 2026-09-11:
	// --print is the mode someone uses to CHECK a launch before making it, and it was the one
	// mode that omitted the consequence of launching with no first turn. An absent prompt is
	// technically visible in the argv above, which is exactly the excuse — the whole point of
	// the line is that "no turn" does not look like anything. A verification surface that is
	// quieter than the real thing is a verification surface that lies by omission.
	if (!prompt) console.error(NO_PROMPT_WARNING)
	process.exit(0)
}

// WHERE THIS SESSION IS, read BEFORE the launch. It is the only way to say afterwards
// whether the split landed in the tab the caller is sitting in, and it has to be taken
// first: after the launch the tab holds two windows and "the current one" is ambiguous.
// A launcher run from outside any kitty window resolves nothing here, which is not an
// error — it just means there is no current tab to compare against, and the check below
// says so rather than inventing one.
const wake = await import(new URL("wake.mjs", import.meta.url))
const { sessionPid } = await import(new URL("session-registry.mjs", import.meta.url))
const before = wake.windows()
const mine = wake.resolveWindow(sessionPid(), before)
const myTab = mine.ok && mine.how === "foreground process" ? mine.win : null

const r = spawnSync("kitten", argv, { encoding: "utf8" })
if (r.status !== 0) die(`kitten @ launch failed (exit ${r.status}): ${(r.stderr || "").trim()}`)

// 🔴 THE ID, OR A REFUSAL. `kitten @ launch` answers with the new window's id on stdout
// and nothing else. An unparseable answer means the launch went somewhere this process
// cannot name — and a session nothing can name is the hookless launch again: it comes up,
// looks normal, and no closer, no wake and no bell can ever reach it.
const winId = Number((r.stdout || "").trim())
if (!Number.isInteger(winId) || winId <= 0)
	die(`kitten @ launch returned no window id (stdout: ${JSON.stringify((r.stdout || "").trim())}).\n` +
	    `  The child may be running, but nothing can address it: no user variable can be set on\n` +
	    `  it, so it will never be able to close itself. REFUSING to report this as a launch.`)

// THE EFFECT, NOT THE EXIT CODE. Re-read the tree and find the id we were handed; a
// launch that reported an id for a window that is not there is the silent no-op this
// project keeps paying for, and the exit status above would not have shown it.
const after = wake.windows()
const born = after.find((w) => w.id === winId && (!myTab || w.sock === myTab.sock))
if (!born)
	die(`kitten @ launch said window ${winId}, and no such window is there.\n` +
	    `  Reported, not assumed: this was re-read from 'kitten @ ls' after the launch.`)

// THE MARK. A user variable on the window, never an environment variable — see the header:
// the environment is inherited by everything the child spawns, this is inherited by nothing.
// A failure here is NOT fatal: the session is up and working, it simply cannot close itself,
// and saying so is more useful than killing a good launch.
let marked = true, markWhy = ""
const mark = spawnSync("kitten", ["@", "--to", `unix:${born.sock}`, "set-user-vars",
	"--match", `id:${winId}`, `CLAUDE_COMM_LAUNCHED=${agent}`], { encoding: "utf8", timeout: 5000 })
if (mark.status !== 0) { marked = false; markWhy = (mark.stderr || "").trim() || `exit ${mark.status}` }
else {
	// Read it back. `set-user-vars` exiting 0 is not evidence the variable is there.
	const w = wake.windows().find((x) => x.id === winId && x.sock === born.sock)
	if (!w || w.vars.CLAUDE_COMM_LAUNCHED !== agent) { marked = false; markWhy = "set-user-vars exited 0 and the variable is not on the window" }
}

const split = !osWindow
const sameTab = myTab ? (born.sock === myTab.sock && born.tab === myTab.tab) : null
console.log(`✓ launched '${agent}' in ${cwd}`)
console.log(`  node:   ${nodeBin}`)
console.log(`  claude: ${claudeBin}`)
console.log(`  the child's PATH was BUILT, not inherited — its hooks can find node.`)
console.log(`  window: ${winId} (${split ? "split" : "os-window"})` +
	(split ? sameTab === true ? ` in this tab (${born.tab}) — verified after the fact, not assumed`
		: sameTab === false ? ` ⚠ in tab ${born.tab}, NOT the caller's tab ${myTab.tab}`
		: ` in tab ${born.tab} — no caller window to compare against, so "current tab" is unverified here`
	: ""))
console.log(marked
	? `  marked CLAUDE_COMM_LAUNCHED=${agent} on the window — this is what lets it close ITSELF (bin/close.mjs)`
	: `  ⚠ NOT marked (${markWhy}) — the session is up and fine, but it will REFUSE to close itself`)
// SAY THE CONSEQUENCE, EVERY TIME. A launch with no first turn is the failure that does not
// look like one, so the launcher that created it is the one place a reader is certain to be
// looking. This is deliberately not a refusal: an interactive session a human will type into
// is a legitimate thing to launch, and only the caller knows which this is.
console.log(prompt
	? `  first turn: ${JSON.stringify(prompt.length > 60 ? prompt.slice(0, 57) + "..." : prompt)} — it will act on this immediately`
	: NO_PROMPT_WARNING)
