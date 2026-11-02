#!/usr/bin/env node
/**
 * claude-comm PAIRS — two experts the LEADER lets write to each other directly, until a time it set.
 *
 *   node .comm/bin/pair.mjs <a> <b> --for 2h --ref <file>       LEADER ONLY: open it (--for <n>m or <n>h, at most 24h)
 *   node .comm/bin/pair.mjs <a> <b> --close                      end it now; their next send to each other is refused
 *   node .comm/bin/pair.mjs                                      every pair, open or closed, and how many messages it logged
 *
 * `--ref` is the file saying WHY and ON WHAT, read from the FIRST expert's folder - as `comm send <a> --ref` reads it.
 * Each expert is rung by the bus, pointing at it. `--force`: the file is not written yet (as `send --force`).
 *
 * WHY. work's leader, 2026-11-01 01h20 (`exchange/work-leader/in/…-12-canal-entre-deux-experts.md`), for the owner:
 * *"Je pense que ce serait bien qu'il y ait cette capacité sur Claude-comm"*. `recherche` analysed sites one by one,
 * `automatisation` scripted the mechanical gestures of that analysis; each "your script misses on this site" → fix →
 * rerun went through the leader, and each cost a leader turn (its whole window re-read) and waited for that turn's end.
 *
 * WHAT STAYS OF THE STAR (README.md "Topology is enforced, not documented"): nothing coordinates off the board. So a pair
 * is CLOSED BY DEFAULT and the bus refuses expert-to-expert as before; only the leader opens one, for two named experts,
 * with a file; it ENDS BY ITSELF; and every message in it is delivered, logged and marked `(pair)` in `comm log` - the
 * leader reads it when it chooses, and is not rung for it (a ring would start its turn and spend its budget). A pair
 * coordinates work; a decision, a change to the spec or a question for the owner still goes to the leader. The bus's
 * check reads `.comm/pairs.json`, and a file it cannot read is NO pair: it fails closed. FINDINGS.md#pairs
 *
 * Nothing here delivers anything: the two bells are `comm.mjs send`, run from the leader's folder, so every rule of a
 * send holds (the ref must exist, it is re-expressed for each reader, notes are cut at 240). Identity is `comm.mjs
 * whoami`'s. The ref is checked by the FIRST bell before anything is written; the pair is written after the second.
 */
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs"
import { join, dirname, resolve, relative } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

// --help: this header's usage lines and NOTHING else - no write, no bell (A92). The field's .comm/README.md is generated
// from the same lines, so the two cannot disagree.
if (process.argv.includes("--help")) {
	console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => /^ \*\s{2,}node \S*bin\/[\w-]+\.mjs/.test(l))
		.map((l) => l.replace(/^ \*\s+/, "").replace(/^node (\.comm\/)?bin\//, "node .comm/bin/")).join("\n"))
	process.exit(0)
}

const ARGV = process.argv.slice(2)
const die = (m, code = 2) => { process.stderr.write(`pair: ${m}\n`); process.exit(code) }
const opt = (f) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] !== undefined ? ARGV[i + 1] : null }
const KNOWN = new Set(["--for", "--ref", "--close", "--force"]), VALUED = new Set(["--for", "--ref"])
const unknown = ARGV.filter((a, i) => a.startsWith("-") && !KNOWN.has(a) && !VALUED.has(ARGV[i - 1]))
if (unknown.length) die(`unknown flag ${unknown.join(" ")} - nothing was done. pair.mjs --help`)
const names = ARGV.filter((a, i) => !a.startsWith("-") && !VALUED.has(ARGV[i - 1]))

const BUS = join(dirname(fileURLToPath(import.meta.url)), "comm.mjs")
let root = resolve(process.cwd())
while (!existsSync(join(root, ".comm", "config.json"))) { const up = dirname(root); if (up === root) die("no .comm/config.json at or above this folder"); root = up }
const cfg = JSON.parse(readFileSync(join(root, ".comm", "config.json"), "utf8"))
const agents = cfg.agents || {}, leader = cfg.leader
const FILE = join(root, ".comm", "pairs.json")
let all = {}
try { const p = JSON.parse(readFileSync(FILE, "utf8")); if (p && typeof p === "object") all = p } catch {}
const isOpen = (p) => !!p && Date.parse(p.until) > Date.now()
const hm = (iso) => { const t = new Date(iso); return isNaN(t) ? String(iso) : t.toTimeString().slice(0, 5) + (t.toDateString() === new Date().toDateString() ? "" : ` on ${t.toDateString()}`) }

if (!names.length) {
	let log = ""
	try { log = readFileSync(join(root, ".comm", "log.jsonl"), "utf8") } catch {}
	const keys = Object.keys(all)
	if (!keys.length) console.log(`no pair: every message has '${leader}' at one end`)
	for (const k of keys) console.log(`  ${k}  ${isOpen(all[k]) ? "OPEN until" : "closed at"} ${hm(all[k].until)}  ${log.split(`"pair":"${k}"`).length - 1} message(s) logged  ref: ${String(all[k].ref).slice(0, 200)}`)
	process.exit(0)
}

const me = spawnSync(process.execPath, [BUS, "whoami"], { cwd: process.cwd(), encoding: "utf8" }).stdout.trim()
if (me !== leader) die(`only '${leader}' opens or closes a pair - you are '${me || "(no agent here)"}'. Ask it, with a file: node .comm/bin/comm.mjs send ${leader} --ref <file>`)
const [a, b] = names
for (const x of [a, b]) if (!x || x === leader || !Object.prototype.hasOwnProperty.call(agents, x))
	die(`a pair is two EXPERTS of this roster, not '${x ?? ""}': pair.mjs <expert> <expert> --for <n>m|<n>h --ref <file>`)
if (a === b || names.length > 2) die(a === b ? `'${a}' cannot pair with itself` : `a pair is TWO experts, not ${names.length}`)
const k = [a, b].sort().join("+")
const save = () => { const tmp = `${FILE}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(all, null, 1) + "\n"); renameSync(tmp, FILE) }

if (ARGV.includes("--close")) {
	if (!isOpen(all[k])) { console.log(`no pair open between '${a}' and '${b}' - nothing to close`); process.exit(0) }
	all[k] = { ...all[k], until: new Date().toISOString(), closed_by: me }
	save()
	console.log(`✓ pair ${k} closed: '${a}' and '${b}' write to ${leader} again (neither is rung; their next send to each other says so)`)
	process.exit(0)
}

const f = /^(\d+)(m|h)$/.exec(opt("--for") || ""), ms = f ? Number(f[1]) * (f[2] === "h" ? 3600_000 : 60_000) : 0
if (!ms || ms > 24 * 3600_000) die(`--for is how long the pair stays open, at most 24h: --for 90m, --for 2h - it ends by itself; open it again when needed`)
const ref = opt("--ref")
if (!ref) die(`--ref is required: the file saying why the pair is open and on what, read from '${a}''s folder`)
const until = new Date(Date.now() + ms).toISOString()
const note = (o) => `pair with '${o}' open until ${hm(until)}: send to each other directly; a decision, a spec change or a question for the owner still comes to ${leader}`
const bell = (to, r, force) => spawnSync(process.execPath, [BUS, "send", to, "--ref", r, "--kind", "nudge", "--note", note(to === a ? b : a), ...(force ? ["--force"] : [])], { cwd: process.cwd(), encoding: "utf8" })
// the ref as `send <b>` must be given it to name the SAME file: from b's folder
const refPath = relative(root, resolve(root, agents[a], ref))
const r1 = bell(a, ref, ARGV.includes("--force"))
if (r1.status !== 0) die(`nothing opened - the bell to '${a}' was refused:\n${(r1.stderr || r1.stdout).trim()}`, 1)
const r2 = bell(b, relative(resolve(root, agents[b]), resolve(root, refPath)), true)
if (r2.status !== 0) die(`'${a}' was rung but the bell to '${b}' was refused, so nothing is open - tell '${a}':\n${(r2.stderr || r2.stdout).trim()}`, 1)
all[k] = { a, b, until, ref: refPath, opened_by: me, opened_at: new Date().toISOString() }
save()
console.log(`✓ pair ${k} open until ${hm(until)} - '${a}' and '${b}' each rung, pointing at ${refPath}\n` +
	`  every message between them: node .comm/bin/comm.mjs log (marked "(pair)") · end it early: pair.mjs ${a} ${b} --close`)
