#!/usr/bin/env node
/**
 * claude-comm TURN CORPUS — does wake's reading of a turn still agree with Claude Code?
 *
 *   node test/turn-corpus.mjs [projects-dir]      default ~/.claude/projects
 *
 * NOT a gate: its input is whatever transcripts this machine happens to hold. It runs the
 * SHIPPED `turnState` from bin/wake.mjs — never a copy, which would drift from what rings —
 * over every transcript, in FILE order (what a reader holds at the instant it rings), against
 * three verdicts Claude Code wrote down itself:
 *
 *   · a typed prompt row                         the session was at rest
 *   · an attachment/queued_command               it arrived while a turn ran
 *   · a queue-operation enqueue, and its outcome absorbed mid-turn is the harm
 *
 * Exit 1 when a typed input that met a running turn reads ringable: that is a doorbell typed
 * into work. A resting prompt read busy is reported and tolerated — it costs a later ring.
 *
 * THE CONTROL moves one variable: the same reader, the same corpus, with the two turn-starters
 * learned on 2026-09-13 hidden (a `!` shell command, a usage-limit resume). It must find
 * interrupting misreads, or this corpus cannot tell a good reader from the one before it, and
 * the verdict says so. Re-run when the CLI moves: its row vocabulary is not a contract.
 * FINDINGS.md#wake-mid-turn
 */
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { turnState } from "../bin/wake.mjs"

const textOf = (c) => typeof c === "string" ? c : !Array.isArray(c) ? "" : c.map((x) => x.type === "text" ? x.text
	: x.type !== "tool_result" ? "" : typeof x.content === "string" ? x.content
	: Array.isArray(x.content) ? x.content.map((y) => y.text || "").join("") : "").join("")
const isTR = (c) => Array.isArray(c) && c.some((x) => x.type === "tool_result")
const NOT_A_PROMPT = /^\s*(<command-name>|<command-message>|<local-command-|<bash-input>|<bash-stdout>|<bash-stderr>|\[Request interrupted)/
const isPrompt = (r) => r.type === "user" && !r.isMeta && !r.isSidechain && !r.isCompactSummary && !isTR(r.message?.content) &&
	/\S/.test(textOf(r.message?.content)) && !NOT_A_PROMPT.test(textOf(r.message?.content))
const STARTER = (r) => r.type === "user" && (r.isMeta
	? /^\s*(You can continue now|Your claude\.ai usage limit has reset)/.test(textOf(r.message?.content))
	: /^\s*<bash-(input|stdout|stderr)>/.test(textOf(r.message?.content)))

function measure(dir, hideStarters) {
	const m = { files: 0, versions: new Set(), t1: 0, t1busy: [], t2: 0, t2ring: [], t3: 0, t3typed: [], t3internal: [] }
	let projects = []
	try { projects = readdirSync(dir) } catch (e) { console.error(`turn-corpus: cannot read ${dir} (${e.code})`); process.exit(2) }
	for (const d of projects) {
		let names = []
		try { names = readdirSync(join(dir, d)).filter((f) => f.endsWith(".jsonl")) } catch { continue }
		for (const f of names) {
			let raw
			try { raw = readFileSync(join(dir, d, f), "utf8") } catch { continue }
			m.files++
			const rows = []
			for (const l of raw.split("\n")) {
				if (!l) continue
				try {
					const r = JSON.parse(l)
					if (r.version) m.versions.add(r.version)
					rows.push(hideStarters && STARTER(r) ? { ...r, type: "hidden-by-control" } : r)
				} catch {}
			}
			const where = (r) => `${r.timestamp} ${d.slice(0, 44)}/${f.slice(0, 8)}`
			const pending = []
			let close = 0   // nothing before the last closed turn can decide, so the reader starts there
			for (let i = 0; i < rows.length; i++) {
				const r = rows[i]
				const here = () => turnState(rows.slice(close, i)).state
				if (isPrompt(r)) { m.t1++; if (here() === "busy") m.t1busy.push(where(r)) }
				if (r.type === "attachment" && r.attachment?.type === "queued_command") {
					m.t2++
					const s = here()
					if (s !== "busy") m.t2ring.push(`${where(r)} read ${s}`)
				}
				if (r.type === "queue-operation") {
					if (r.operation === "enqueue") pending.push({ s: here(), at: where(r), internal: /^\s*<task-notification>/.test(String(r.content || "")) })
					else for (const e of r.operation === "popAll" ? pending.splice(0) : pending.splice(0, 1)) {
						m.t3++
						if (r.operation === "remove" && /absorbed/.test(String(r.reason || "")) && e.s !== "busy")
							(e.internal ? m.t3internal : m.t3typed).push(`${e.at} read ${e.s}`)
					}
				}
				if (r.type === "system" && r.subtype === "turn_duration" && !r.isSidechain) close = i
			}
		}
	}
	return m
}

const dir = process.argv[2] || join(homedir(), ".claude", "projects")
const real = measure(dir, false)
const control = measure(dir, true)
const v = [...real.versions].sort()
const list = (xs) => xs.slice(0, 15).map((x) => `      ${x}`).join("\n") + (xs.length > 15 ? `\n      …and ${xs.length - 15} more` : "")

console.log(`turn-corpus: ${real.files} transcripts under ${dir}, CLI ${v[0] || "?"} … ${v.at(-1) || "?"}\n`)
console.log(`  typed at rest (a prompt row)        ${String(real.t1).padStart(6)}   read busy: ${real.t1busy.length}  — a skip there costs a later ring`)
if (real.t1busy.length) console.log(list(real.t1busy))
console.log(`  queued mid-turn (queued_command)    ${String(real.t2).padStart(6)}   read ringable: ${real.t2ring.length}  — a ring there interrupts`)
if (real.t2ring.length) console.log(list(real.t2ring))
console.log(`  queue outcomes                      ${String(real.t3).padStart(6)}   absorbed while read ringable: ${real.t3typed.length} typed, ` +
	`${real.t3internal.length} internal (<task-notification>, measured to start no turn)`)
if (real.t3typed.length) console.log(list(real.t3typed))

const bad = real.t2ring.length + real.t3typed.length
const reddens = control.t2ring.length + control.t3typed.length
console.log(`\n  CONTROL, the same reader with the 2026-09-13 turn-starters hidden: ${reddens} interrupting misread(s)`)
if (bad) console.log(`\n✗ the shipped turnState reads ${bad} running turn(s) as ringable on this corpus`)
else if (reddens) console.log(`\n✓ no running turn reads ringable, and the control proves this corpus could have said otherwise`)
else console.log(`\n? no running turn reads ringable — but the control found nothing either, so this corpus cannot tell`)
process.exit(bad ? 1 : 0)
