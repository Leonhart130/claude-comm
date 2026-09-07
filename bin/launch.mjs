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
if (!agent || agent.startsWith("--")) die(`usage: launch.mjs <agent> [--print]`)

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
const argv = ["@", "launch", "--type=os-window", "--keep-focus", `--cwd=${cwd}`,
	`--env=PATH=${childPath}`, `--env=CLAUDE_COMM_AGENT=${agent}`, claudeBin]

if (printOnly) {
	// Same resolution, same refusals, same argv — only the spawn is skipped, so a
	// control that uses it travels the code the real launch travels.
	console.log(JSON.stringify({ agent, cwd, node: nodeBin, claude: claudeBin, path: childPath, argv }, null, 2))
	process.exit(0)
}
const r = spawnSync("kitten", argv, { encoding: "utf8" })
if (r.status !== 0) die(`kitten @ launch failed (exit ${r.status}): ${(r.stderr || "").trim()}`)
console.log(`✓ launched '${agent}' in ${cwd}`)
console.log(`  node:   ${nodeBin}`)
console.log(`  claude: ${claudeBin}`)
console.log(`  the child's PATH was BUILT, not inherited — its hooks can find node.`)
