#!/usr/bin/env node
/**
 * claude-comm TEAM — what "teams" in .comm/config.json means for one agent, in one sentence.
 *
 *   node .comm/bin/team.mjs                      what is yours: who you lead, who you work for, who you write to with no pair
 *   node .comm/bin/team.mjs --agent-root <dir>   the same for the agent whose stub is there (what the start message prints)
 *
 *   .comm/config.json  "teams": {"<chief>": ["<expert>", ...]}   a chief and its experts, the chiefs, the experts of one team write with no pair
 *
 * Nothing when the agent is in no team and leads none, or the project declares none. It writes nothing and rings nobody.
 * Out of comm.mjs because the bus is capped at one Read call (A22) and only a start message needs these sentences. FINDINGS.md#teams
 */
import { readFileSync, existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { teams, headsOf, teamFaults } from "./comm.mjs"

if (process.argv.includes("--help")) {
	console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => /^ \*\s{2,}node \S*bin\/[\w-]+\.mjs/.test(l))
		.map((l) => l.replace(/^ \*\s+/, "").replace(/^node (\.comm\/)?bin\//, "node .comm/bin/")).join("\n"))
	process.exit(0)
}

/** The sentences for agent `a`: empty when none applies. */
export function roleOf(cfg, a) {
	const t = teams(cfg)
	if (!t) return ""
	const own = (k) => Object.prototype.hasOwnProperty.call(t, k)
	if (a === cfg.leader) return `This project has teams: ${Object.keys(t).map((h) => `${h} (${t[h].join(", ")})`).join("; ")}. A chief writes to its experts and to the other chiefs without you: carry an order to its chief, and read their reports.`
	const hs = headsOf(cfg, a), lead = own(a), bits = []
	if (lead) bits.push(`You LEAD a team: ${t[a].join(", ")}. Write to them, and to the other chiefs (${Object.keys(t).filter((h) => h !== a).join(", ") || "none"}), with no pair; you may open a pair for one of your experts.`)
	if (hs.length) bits.push(`You work for ${hs.map((h) => `'${h}'`).join(" and ")}: write directly to them and to your team (${[...new Set(hs.flatMap((h) => t[h]))].filter((x) => x !== a).join(", ") || "nobody else"}).`)
	if (lead || hs.length) bits.push("Report with `send @asker --kind done`: it reaches the one who waits on your work, else your chief, else the leader; if several wait it says so, and you name one. A question is `--kind blocked`: a `done` closes the request.")
	return bits.join(" ")
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const i = process.argv.indexOf("--agent-root"), at = resolve(i > 0 && process.argv[i + 1] ? process.argv[i + 1] : process.cwd())
	let root = at
	while (!existsSync(join(root, ".comm", "config.json"))) { const up = dirname(root); if (up === root) process.exit(0); root = up }
	let cfg
	try { cfg = JSON.parse(readFileSync(join(root, ".comm", "config.json"), "utf8")) } catch { process.exit(0) }
	const f = teamFaults(cfg)
	if (f.length) console.log(`"teams" is IGNORED, so this project is a star: ${f.join("; ")}`)
	// identity is the bus's to say (comm.mjs whoami), the one place it is resolved
	const w = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "comm.mjs"), "whoami", "--agent-root", at], { cwd: at, encoding: "utf8", timeout: 5000 })
	const line = w.status === 0 ? roleOf(cfg, String(w.stdout).trim()) : ""
	if (line) console.log(line)
}
