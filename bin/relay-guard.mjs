#!/usr/bin/env node
/**
 * claude-comm RELAY GUARD — is this agent's handoff written? Checked from what its project DECLARES, so a project needs
 * no script of its own; relay.mjs runs it as one more guard for every agent with a declaration.
 *
 *   node .comm/bin/relay-guard.mjs                    this session's agent: each check, exit 0 only if all pass
 *   node .comm/bin/relay-guard.mjs --agent <name>     that agent's (relay.mjs names it; a leader may check an expert's)
 *
 *   .comm/config.json  "relay": {"<agent>": {"handoff": {"file": "notes/BOARD.md", "committed": 30, "clean": ["notes"]}}}
 *                      what that agent's written handoff is, from its folder: "file" (required) exists; "has": a regex
 *                      it contains; "first": {"of": "<regex>", "is": "<regex>"} - the first line matching "of" matches
 *                      "is" too (a journal that must OPEN on a handoff); "written": minutes - the file changed that
 *                      recently; "committed": minutes - git's last commit of it is that recent; "clean": git paths with
 *                      no uncommitted tracked change; "how": where the procedure is written, said with RELAY SOON and
 *                      RELAY DUE. Beside the agent's "say" and "at".
 *
 * WHY THE BUS DOES IT. The owner, 2026-11-05: "claude-comm est devenu une toolbox [...] je veux que ce soit toi qui gères
 * tous les outils" - about the handoff tool a field built. Measured that day: the trigger it carried (a 150 k Stop hook,
 * `relais-150k.mjs`) had been copied from one field to a second and a third, each copy differing only in its messages, and
 * its guard (`garde-relais.sh`) existed in FOUR versions, the youngest copied 40 min before. Every guard checked the same
 * few things in its own words: a file that opens on a handoff heading, committed recently, the notes clean. So those
 * checks are declared once here; what is no primitive (a heading bound to the open session's number, a project's own
 * close check) stays a "guard" command of the project's, which relay.mjs still runs beside this one.
 *
 * Exit 0: every check passes. 1: one failed - the first stderr line names it (what relay.mjs reports). 2: no
 * declaration for that agent, or one that cannot be read - each fault named. It writes nothing.
 */
import { readFileSync, statSync, existsSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const KEYS = ["file", "has", "first", "written", "committed", "clean", "how"]

/** The faults of a declaration, [] when it can be checked. */
export function faults(d) {
	if (!d || typeof d !== "object" || Array.isArray(d)) return [`"handoff" must be an object such as {"file": "notes/BOARD.md"}`]
	const f = [], rx = (k, v) => { if (typeof v !== "string" || !v) return f.push(`"${k}" must be a non-empty regex string`); try { new RegExp(v, "m") } catch (e) { f.push(`"${k}" is not a regex: ${e.message}`) } }
	for (const k of Object.keys(d)) if (!KEYS.includes(k)) f.push(`unknown key "${k}" (known: ${KEYS.join(", ")})`)
	if (typeof d.file !== "string" || !d.file.trim()) f.push(`"file" is required: the handoff's path, from the agent's folder`)
	if ("has" in d) rx("has", d.has)
	if ("first" in d) {
		if (!d.first || typeof d.first !== "object" || Array.isArray(d.first)) f.push(`"first" must be {"of": "<regex>", "is": "<regex>"}`)
		else { for (const k of Object.keys(d.first)) if (k !== "of" && k !== "is") f.push(`unknown key "first.${k}" (known: of, is)`); rx("first.of", d.first.of); rx("first.is", d.first.is) }
	}
	for (const k of ["written", "committed"]) if (k in d && !(Number.isFinite(d[k]) && d[k] > 0)) f.push(`"${k}" must be a number of minutes above 0`)
	if ("clean" in d && !(Array.isArray(d.clean) && d.clean.length && d.clean.every((p) => typeof p === "string" && p.trim())))
		f.push(`"clean" must be a list of git paths, such as ["notes", "CLAUDE.md"]`)
	if ("how" in d && (typeof d.how !== "string" || !d.how.trim() || /[\r\n]/.test(d.how) || d.how.length > 200)) f.push(`"how" must be one line of at most 200 characters`)
	return f
}

/** The declaration for `agent`, or undefined. */
export const declared = (cfg, agent) => { const c = cfg && cfg.relay && cfg.relay[agent]; return c && typeof c === "object" && !Array.isArray(c) ? c.handoff : undefined }

const git = (cwd, args) => spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", timeout: 10_000 })
const ago = (ms) => `${Math.max(0, Math.round(ms / 60_000))} min ago`
const cut = (s, n = 70) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Every check of the declaration, in order: [{ check, ok, says }]. `dir` is the agent's folder. */
export function checks(d, dir, now = Date.now()) {
	const out = [], at = (check, ok, says) => out.push({ check, ok, says })
	const path = resolve(dir, d.file)
	let text = null
	try { if (statSync(path).isFile()) text = readFileSync(path, "utf8") } catch {}
	at("file", text !== null, text !== null ? `${d.file} is there` : `${d.file} does not exist (from ${dir})`)
	if (text !== null && d.has) {
		const ok = new RegExp(d.has, "m").test(text)
		at("has", ok, ok ? `${d.file} contains /${cut(d.has, 40)}/` : `${d.file} does not contain /${cut(d.has, 40)}/`)
	}
	if (text !== null && d.first) {
		const of = new RegExp(d.first.of), is = new RegExp(d.first.is)
		const line = text.split("\n").find((l) => of.test(l))
		at("first", line !== undefined && is.test(line), line === undefined ? `no line of ${d.file} matches /${cut(d.first.of, 40)}/`
			: is.test(line) ? `${d.file} opens on "${cut(line.trim(), 60)}"` : `${d.file} opens on "${cut(line.trim(), 50)}", which is not /${cut(d.first.is, 30)}/`)
	}
	// TWO KEYS, NOT ONE RULE: measured on the day it was written, one field's expert guards "written in the last 30 min"
	// and its leader "committed in the last 30 min" - and git tracks the expert's file. A rule choosing by "tracked or
	// not" judged that expert by a commit of 3 h ago while it had written its handoff 14 min before.
	if (text !== null && d.written) {
		const m = statSync(path).mtimeMs
		at("written", now - m <= d.written * 60_000, `${d.file} written ${ago(now - m)} (${d.written} allowed)`)
	}
	if (text !== null && d.committed) {
		const g = git(dirname(path), ["log", "-1", "--format=%ct", "--", path]), t = Number(String(g.stdout || "").trim()) * 1000
		at("committed", g.status === 0 && t > 0 && now - t <= d.committed * 60_000, g.status !== 0 ? `git log failed: ${cut(String(g.stderr || g.error || "").trim().split("\n")[0], 60)}`
			: t > 0 ? `${d.file} committed ${ago(now - t)} (${d.committed} allowed)` : `${d.file} was never committed`)
	}
	if (d.clean) {
		const s = git(dir, ["status", "--porcelain", "-uno", "--", ...d.clean])
		const dirty = String(s.stdout || "").split("\n").filter((l) => l.trim())
		at("clean", s.status === 0 && !dirty.length, s.status !== 0 ? `git status failed in ${dir}: ${cut(String(s.stderr || s.error || "").trim().split("\n")[0], 60)}`
			: dirty.length ? `uncommitted: ${cut(dirty.slice(0, 3).map((l) => l.trim()).join(", "), 80)}${dirty.length > 3 ? ` (+${dirty.length - 3})` : ""}` : `${d.clean.join(" ")}: nothing uncommitted`)
	}
	return out
}

// ── the CLI ──────────────────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	const argv = process.argv.slice(2)
	if (argv.includes("--help")) {
		console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => /^ \*\s{2,}node \S*bin\/[\w-]+\.mjs/.test(l))
			.map((l) => l.replace(/^ \*\s+/, "").replace(/^node (\.comm\/)?bin\//, "node .comm/bin/")).join("\n"))
		process.exit(0)
	}
	const die = (m, code = 2) => { process.stderr.write(`relay-guard: ${m}\n`); process.exit(code) }
	for (const a of argv) if (a.startsWith("--") && a !== "--agent") die(`unknown option ${a} (known: --agent <name>, --help)`)
	const i = argv.indexOf("--agent")
	if (i >= 0 && (!argv[i + 1] || argv[i + 1].startsWith("--"))) die("--agent needs a name")
	let root = process.cwd()
	while (root && !existsSync(join(root, ".comm", "config.json"))) { const up = dirname(root); root = up === root ? null : up }
	if (!root) die(`no .comm/config.json above ${process.cwd()}`)
	let cfg
	try { cfg = JSON.parse(readFileSync(join(root, ".comm", "config.json"), "utf8")) } catch (e) { die(`.comm/config.json does not parse: ${e.message}`) }
	let agent = i >= 0 ? argv[i + 1] : null
	if (!agent) {
		const w = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "comm.mjs"), "whoami"], { encoding: "utf8" })
		agent = w.status === 0 ? String(w.stdout).trim() : ""
		if (!agent) die("this session is no agent of the bus here - name one: --agent <name>")
	}
	if (!cfg.agents || !Object.prototype.hasOwnProperty.call(cfg.agents, agent)) die(`'${agent}' is not on the roster in ${join(root, ".comm", "config.json")}`)
	const d = declared(cfg, agent)
	if (d === undefined) die(`no "handoff" for '${agent}' in .comm/config.json "relay" - declare one, such as\n` +
		`    "relay": {"${agent}": {"handoff": {"file": "notes/BOARD.md", "committed": 30}}}`)
	const f = faults(d)
	if (f.length) die(`the "handoff" of '${agent}' cannot be checked:\n  · ${f.join("\n  · ")}`)
	const res = checks(d, resolve(root, cfg.agents[agent] || "."))
	const bad = res.filter((r) => !r.ok)
	if (bad.length) process.stderr.write(`handoff not written: ${bad[0].check} - ${bad[0].says}${bad.length > 1 ? ` (+${bad.length - 1} more)` : ""}\n`)
	console.log(`relay-guard: '${agent}' - handoff ${d.file}${d.how ? ` (how: ${d.how})` : ""}\n` +
		res.map((r) => `  ${r.ok ? "✓" : "✗"} ${r.check.padEnd(7)} ${r.says}`).join("\n") +
		`\nrelay-guard: ${bad.length ? `NOT WRITTEN - ${bad.length} check(s) failed` : "written"}`)
	process.exit(bad.length ? 1 : 0)
}
