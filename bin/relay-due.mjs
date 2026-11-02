#!/usr/bin/env node
/**
 * claude-comm RELAY DUE — past its project's context threshold, an agent's turn end is held, ONCE per 25 k, until it has
 * armed its relay. The bus's Stop hook asks it, after the mail; nothing else runs it.
 *
 *   node .comm/bin/relay-due.mjs <agent> <transcript.jsonl>    what the Stop hook would say now, and why (it writes nothing)
 *
 *   .comm/config.json  "relay": {"<agent>": {"at": 140000}, "*": {"at": 150000}}
 *                      "at": the context in tokens (the model's last call: input + cache read + cache creation) past
 *                      which that agent's turn end is held until it arms relay.mjs - once per 25 k, never on a turn
 *                      a Stop hook already resumed, silent while a relay is armed for that session. "*": every agent
 *                      without an "at" of its own; "at": 0 turns it off for one agent. Beside its "say" and "guard".
 *
 * WHY THE BUS DOES IT. relay.mjs said "No trigger" (10-25): WHEN to hand over was the agent's, or its project's hook.
 * Then work's leader, for the owner (11-02 21h52, `exchange/work-leader/in/…-14-declencheur-du-relais.md`): two projects
 * already carried a copy of the same 150 k Stop hook, and the two pieces got in each other's way when they ignored each
 * other - measured 10-30, their hook blocked a turn end 3 s after the relay was armed and the relay cancelled. And the
 * same evening an expert wrote its handoff twice without arming, sure it had relayed. A guard in the bus knows the relay
 * by construction: it is silent while one is armed for THIS transcript and not finished - work's own `relaisArme` rule
 * (record `transcript` = the session's, `relayed` null, no `ended_at`, the watcher alive or armed under 5 min).
 *
 * ORDER, in the stub: the bus delivers mail first and its block wins - mail waiting makes the relay's arming refuse, and
 * the mail's turn will end again. A Stop that is a CONTINUATION (`stop_hook_active`) is never held here: whatever resumed
 * that turn is answered first, and no two hooks can loop on each other through this one. Every path is silent on an
 * internal error: a broken guard must never break a turn end.
 */
import { readFileSync, writeFileSync, mkdirSync, openSync, readSync, fstatSync, closeSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

export const STEP = 25_000
const ARMED_FRESH_MS = 5 * 60_000

/** The context of the model's LAST call in a transcript, read from its tail; null when no call carries usage. */
export function lastContext(transcript, tailBytes = 1 << 20) {
	let fd
	try {
		fd = openSync(transcript, "r")
		const size = fstatSync(fd).size, n = Math.min(size, tailBytes), buf = Buffer.alloc(n)
		readSync(fd, buf, 0, n, size - n)
		const lines = buf.toString("utf8").split("\n")
		for (let i = lines.length - 1; i >= (n < size ? 1 : 0); i--) {   // the first line of a cut tail is partial
			if (!lines[i].includes('"assistant"')) continue
			let r
			try { r = JSON.parse(lines[i]) } catch { continue }
			const u = r && r.type === "assistant" && !r.isSidechain && r.message && r.message.usage
			if (u) return (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)
		}
		return null
	} catch { return null } finally { if (fd !== undefined) try { closeSync(fd) } catch {} }
}

/** This agent's threshold: its own "at", else the project's "*", else none. 0 or not a number: none. */
export function thresholdOf(cfg, agent) {
	const r = (cfg && cfg.relay) || {}, own = r[agent], all = r["*"]
	const at = own && typeof own === "object" && "at" in own ? own.at : all && typeof all === "object" ? all.at : undefined
	return Number.isFinite(at) && at > 0 ? at : null
}

/** Is a relay armed for THIS session, and not finished? (work's `relaisArme`, the fields relay.mjs writes) */
export function armedFor(record, transcript, now = Date.now()) {
	if (!record || record.transcript !== transcript || record.relayed !== null || record.ended_at) return false
	let alive = false
	try { alive = !!record.relay_pid && readFileSync(`/proc/${record.relay_pid}/cmdline`, "utf8").includes("relay.mjs") } catch {}
	return alive || now - Date.parse(record.armed_at) < ARMED_FRESH_MS
}

/**
 * What a Stop of `agent` should do: { hold: true, reason } or { hold: false, why }. `mark` true writes the step told, and
 * holds only if it reads back, so a write that fails cannot hold every turn end.
 */
export function due({ root, cfg, agent, payload, relayBin, mark = true, now = Date.now() }) {
	const p = payload || {}, t = p.transcript_path
	const at = thresholdOf(cfg, agent)
	if (!at) return { hold: false, why: `no "at" for '${agent}' (nor "*") in .comm/config.json "relay"` }
	if (p.stop_hook_active) return { hold: false, why: "a Stop hook already resumed this turn: never held twice" }
	if (typeof t !== "string" || !t) return { hold: false, why: "the Stop gave no transcript" }
	const ctx = lastContext(t)
	if (ctx === null) return { hold: false, why: "no call of the model with usage in the transcript's tail" }
	if (ctx < at) return { hold: false, why: `context ${Math.round(ctx / 1000)} k, under ${Math.round(at / 1000)} k` }
	const dir = join(root, ".comm", "relay")
	let rec = null
	try { rec = JSON.parse(readFileSync(join(dir, `${agent}.json`), "utf8")) } catch {}
	if (armedFor(rec, t, now)) return { hold: false, why: `a relay is armed for this session (at ${rec.armed_at}) and not finished` }
	const step = at + Math.floor((ctx - at) / STEP) * STEP, dueFile = join(dir, `${agent}.due.json`)
	let told = null
	try { told = JSON.parse(readFileSync(dueFile, "utf8")) } catch {}
	if (told && told.transcript === t && told.step >= step) return { hold: false, why: `already said at ${Math.round(told.step / 1000)} k for this session; next at ${Math.round((step + STEP) / 1000)} k` }
	if (mark) {
		const at2 = new Date(now).toISOString()
		try {
			mkdirSync(dir, { recursive: true })
			writeFileSync(dueFile, JSON.stringify({ transcript: t, step, context: ctx, at: at2 }) + "\n")
			if (JSON.parse(readFileSync(dueFile, "utf8")).at !== at2) return { hold: false, why: "the step told could not be read back" }
		} catch { return { hold: false, why: "the step told could not be written" } }
	}
	return { hold: true, reason: `[claude-comm] RELAY DUE. This is from the BUS, not your owner. This session's context is ` +
		`${Math.round(ctx / 1000)} k, past '${agent}''s relay threshold (${Math.round(at / 1000)} k, .comm/config.json "relay"). ` +
		`Finish or park what is in hand, write your handoff, then arm the relay as the LAST act of this turn: node ${relayBin} ` +
		`(your first prompt and guard come from .comm/config.json; --dry-run checks them without arming). Said once per ` +
		`${STEP / 1000} k; silent while a relay is armed for this session.` }
}

// ── the CLI: what a Stop would say now, written nowhere ─────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	if (process.argv.includes("--help")) {
		console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => /^ \*\s{2,}node \S*bin\/[\w-]+\.mjs/.test(l))
			.map((l) => l.replace(/^ \*\s+/, "").replace(/^node (\.comm\/)?bin\//, "node .comm/bin/")).join("\n"))
		process.exit(0)
	}
	const [agent, transcript] = process.argv.slice(2)
	if (!agent || !transcript) { process.stderr.write("relay-due: usage: relay-due.mjs <agent> <transcript.jsonl>\n"); process.exit(2) }
	let root = process.cwd()
	for (;;) { try { readFileSync(join(root, ".comm", "config.json")); break } catch {} const up = dirname(root); if (up === root) { process.stderr.write("relay-due: no .comm/config.json at or above this folder\n"); process.exit(2) } root = up }
	const cfg = JSON.parse(readFileSync(join(root, ".comm", "config.json"), "utf8"))
	const r = due({ root, cfg, agent, payload: { transcript_path: transcript }, relayBin: join(dirname(fileURLToPath(import.meta.url)), "relay.mjs"), mark: false })
	console.log(r.hold ? `would HOLD the turn end:\n  ${r.reason}` : `would not hold: ${r.why}`)
}
