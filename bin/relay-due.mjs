#!/usr/bin/env node
/**
 * claude-comm RELAY DUE — past its project's context threshold, an agent is told to hand over: after a tool call, as
 * ADVICE (RELAY SOON), and at its turn's end by a HOLD (RELAY DUE) until it has armed its relay. Each once per 25 k. The
 * bus's hook stub asks it - after the mail at a Stop, after the usage note after a tool; nothing else runs it.
 *
 *   node .comm/bin/relay-due.mjs <agent> <transcript.jsonl>    what each hook would say now, and why (it writes nothing)
 *
 *   .comm/config.json  "relay": {"<agent>": {"at": 140000}, "*": {"at": 150000}}
 *                      "at": the context in tokens (the model's last call: input + cache read + cache creation) past
 *                      which that agent is told after a tool call, and its turn end is held until it arms relay.mjs -
 *                      each once per 25 k; the hold never on a turn a Stop hook already resumed; both silent while a
 *                      relay is armed for that session. "*": every agent without an "at" of its own; "at": 0 turns it
 *                      off for one agent. Beside its "say" and "guard". Adding or removing one: re-run install.mjs -
 *                      an agent with an "at" has its PostToolUse hear every tool, the others Bash alone. With a
 *                      "handoff" declared (relay-guard.mjs), both name its "file" and its "how" to the agent.
 *
 * WHY THE BUS DOES IT. relay.mjs said "No trigger" (10-25): WHEN to hand over was the agent's, or its project's hook.
 * Then work's leader, for the owner (11-02 21h52, `exchange/work-leader/in/…-14-declencheur-du-relais.md`): two projects
 * already carried a copy of the same 150 k Stop hook, and the two pieces got in each other's way when they ignored each
 * other - measured 10-30, their hook blocked a turn end 3 s after the relay was armed and the relay cancelled. And the
 * same evening an expert wrote its handoff twice without arming, sure it had relayed. A guard in the bus knows the relay
 * by construction: it is silent while one is armed for THIS transcript and not finished - work's own `relaisArme` rule
 * (record `transcript` = the session's, `relayed` null, no `ended_at`, the watcher alive or armed under 5 min).
 *
 * THE MIDDLE OF A TURN (2026-11-02.4, work's 23h02 letter, `…-17-seuils-poses.md`): its overflows came MID-turn - an
 * expert relayed at 180 k, then at 297 k, in the middle of a file; turns often run past 60 k - where a Stop never looks.
 * So after every tool of an agent with an "at" (the installer widens its PostToolUse matcher to "*" for it alone: one
 * short process per tool call is a cost nobody else pays), the same reading gives ADVICE, never a block. Its step is kept
 * under its own key in the same file: a notice does not silence the hold, which stays the backstop for the agent that
 * read the advice and ended its turn unarmed; a hold does silence the notice at its step (it was told more firmly).
 *
 * ORDER, in the stub: the bus delivers mail first and its block wins - mail waiting makes the relay's arming refuse, and
 * the mail's turn will end again. A Stop that is a CONTINUATION (`stop_hook_active`) is never held here: whatever resumed
 * that turn is answered first, and no two hooks can loop on each other through this one. Every path is silent on an
 * internal error: a broken guard must never break a turn end.
 */
import { readFileSync, writeFileSync, mkdirSync, openSync, readSync, fstatSync, closeSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

export const STEP = 25_000
const ARMED_FRESH_MS = 5 * 60_000

/**
 * The context of the model's LAST call in a transcript, read from its tail; null when no call carries usage. A tail
 * with no call in it is read again twice as far back, up to the whole file - work's choice in its own copy (L1): one
 * line bigger than the tail (an image read, a long tool result) must not read as "no call" and leave the agent untold.
 */
export function lastContext(transcript, tailBytes = 1 << 20) {
	let fd
	try {
		fd = openSync(transcript, "r")
		const size = fstatSync(fd).size
		for (let want = tailBytes; ; want *= 2) {
			const n = Math.min(size, want), buf = Buffer.alloc(n)
			readSync(fd, buf, 0, n, size - n)
			const lines = buf.toString("utf8").split("\n")
			for (let i = lines.length - 1; i >= (n < size ? 1 : 0); i--) {   // the first line of a cut tail is partial
				if (!lines[i].includes('"assistant"')) continue
				let r
				try { r = JSON.parse(lines[i]) } catch { continue }
				const u = r && r.type === "assistant" && !r.isSidechain && r.message && r.message.usage
				if (u) return (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)
			}
			if (n >= size) return null
		}
	} catch { return null } finally { if (fd !== undefined) try { closeSync(fd) } catch {} }
}

/** What both hooks add when the agent's handoff is declared: its file, its procedure, and the check that says what is missing. */
function handoffLine(cfg, agent, relayBin) {
	const c = cfg && cfg.relay && cfg.relay[agent], d = c && typeof c === "object" ? c.handoff : null
	if (!d || typeof d !== "object" || typeof d.file !== "string" || !d.file.trim()) return ""
	const how = typeof d.how === "string" && d.how.trim() && !/[\r\n]/.test(d.how) ? d.how.trim().slice(0, 200) : ""
	return ` Your handoff, as your project declares it: ${d.file.trim()}${how ? ` - how: ${how}` : ""}; ` +
		`node ${join(dirname(relayBin), "relay-guard.mjs")} says what is still missing.`
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
 * Who this stub speaks for, cheaply: the one agent whose folder IS the stub's, when no session declares itself; else the
 * bus's own `comm.mjs whoami` (one implementation of identity; the cheap path is its directory rule, for one agent).
 * Run after every tool of an agent with an "at", so a spawn is avoided where it can be. null: nobody.
 */
export function agentOf({ root, cfg, agentRoot, bus }) {
	const here = Object.keys((cfg && cfg.agents) || {}).filter((a) => resolve(root, cfg.agents[a]) === agentRoot)
	if (!String(process.env.CLAUDE_COMM_AGENT ?? "").trim() && here.length === 1) return here[0]
	const w = spawnSync(process.execPath, [bus, "whoami", "--agent-root", agentRoot], { encoding: "utf8" })
	return w.status === 0 ? String(w.stdout).trim() || null : null
}

/** The shared reading of both hooks: past the threshold and not armed, or why not. */
function reading({ root, cfg, agent, payload, now }) {
	const t = (payload || {}).transcript_path
	const at = thresholdOf(cfg, agent)
	if (!at) return { why: `no "at" for '${agent}' (nor "*") in .comm/config.json "relay"` }
	if (typeof t !== "string" || !t) return { why: "the hook gave no transcript" }
	const ctx = lastContext(t)
	if (ctx === null) return { why: "no call of the model with usage in the transcript's tail" }
	if (ctx < at) return { why: `context ${Math.round(ctx / 1000)} k, under ${Math.round(at / 1000)} k` }
	const dir = join(root, ".comm", "relay")
	let rec = null
	try { rec = JSON.parse(readFileSync(join(dir, `${agent}.json`), "utf8")) } catch {}
	if (armedFor(rec, t, now)) return { why: `a relay is armed for this session (at ${rec.armed_at}) and not finished` }
	const dueFile = join(dir, `${agent}.due.json`)
	let told = null
	try { told = JSON.parse(readFileSync(dueFile, "utf8")) } catch {}
	if (told && told.transcript !== t) told = null
	return { t, at, ctx, step: at + Math.floor((ctx - at) / STEP) * STEP, dir, dueFile, told }
}
/** Writes this step under `key`, keeping the other hook's; true only if it reads back. */
function markStep(r, key, now) {
	const stamp = new Date(now).toISOString()
	try {
		mkdirSync(r.dir, { recursive: true })
		writeFileSync(r.dueFile, JSON.stringify({ ...(r.told || {}), transcript: r.t, [key]: r.step, context: r.ctx, at: stamp }) + "\n")
		return JSON.parse(readFileSync(r.dueFile, "utf8")).at === stamp
	} catch { return false }
}
const k = (n) => `${Math.round(n / 1000)} k`

/**
 * What a Stop of `agent` should do: { hold: true, reason } or { hold: false, why }. `mark` true writes the step told, and
 * holds only if it reads back, so a write that fails cannot hold every turn end. A NOTICE given at this step mid-turn
 * does not silence it: the hold is the backstop for the agent that read the advice and ended its turn unarmed.
 */
export function due({ root, cfg, agent, payload, relayBin, mark = true, now = Date.now() }) {
	if ((payload || {}).stop_hook_active) return { hold: false, why: "a Stop hook already resumed this turn: never held twice" }
	const r = reading({ root, cfg, agent, payload, now })
	if (r.why) return { hold: false, why: r.why }
	if (r.told && r.told.step >= r.step) return { hold: false, why: `already held at ${k(r.told.step)} for this session; next at ${k(r.step + STEP)}` }
	if (mark && !markStep(r, "step", now)) return { hold: false, why: "the step told could not be written" }
	return { hold: true, reason: `[claude-comm] RELAY DUE. This is from the BUS, not your owner. This session's context is ` +
		`${k(r.ctx)}, past '${agent}''s relay threshold (${k(r.at)}, .comm/config.json "relay"). ` +
		`Finish or park what is in hand, write your handoff, then arm the relay as the LAST act of this turn: node ${relayBin} ` +
		`(your first prompt and guard come from .comm/config.json; --dry-run checks them without arming).${handoffLine(cfg, agent, relayBin)} Said once per ` +
		`${STEP / 1000} k; silent while a relay is armed for this session.` }
}

/**
 * After a tool call, past the threshold: ADVICE in the model's context, never a block - work's measurement (11-02 23h02):
 * its overflows come in the MIDDLE of a turn (180 k, then 297 k, mid-file), where a Stop never looks. { say, text } or
 * { say: false, why }. Once per step, and never at a step the Stop already held (the agent was told more firmly).
 */
export function notice({ root, cfg, agent, payload, relayBin, mark = true, now = Date.now() }) {
	const r = reading({ root, cfg, agent, payload, now })
	if (r.why) return { say: false, why: r.why }
	if (r.told && Math.max(r.told.step || 0, r.told.notice || 0) >= r.step) return { say: false, why: `already said at ${k(Math.max(r.told.step || 0, r.told.notice || 0))} for this session` }
	if (mark && !markStep(r, "notice", now)) return { say: false, why: "the step told could not be written" }
	return { say: true, text: `[claude-comm] RELAY SOON. This is from the BUS, not your owner. This session's context is ` +
		`${k(r.ctx)}, past '${agent}''s relay threshold (${k(r.at)}). Finish or park the task in hand - start no other - then ` +
		`write your handoff and arm the relay as the LAST act of this turn: node ${relayBin}.${handoffLine(cfg, agent, relayBin)} Until it is armed, this turn's ` +
		`end will be held. Said once per ${STEP / 1000} k.` }
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
	const n = notice({ root, cfg, agent, payload: { transcript_path: transcript }, relayBin: join(dirname(fileURLToPath(import.meta.url)), "relay.mjs"), mark: false })
	console.log(`at the turn's end: ${r.hold ? `would HOLD it:\n  ${r.reason}` : `would not hold: ${r.why}`}\n` +
		`after a tool call: ${n.say ? `would SAY:\n  ${n.text}` : `would say nothing: ${n.why}`}`)
}
