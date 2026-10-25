#!/usr/bin/env node
/**
 * claude-comm WHO — which sessions are alive, and what state each one is really in.
 *
 * Split out of comm.mjs 2026-09-11 (A22 and A21 contradicted each other at the cap; A21 checks this file
 * transitively): liveness reads the MACHINE, not the mailbox. `FINDINGS.md#bus-split`.
 * 🔴 DEPENDENCIES FLOW ONE WAY: comm.mjs passes `whoami`, `findRoot`, `clock`, `pending` in - one
 * implementation of "which process is which agent" (a second one disagreed twice in a day, review #5 F7, G7).
 */
import { readdirSync, readFileSync, readlinkSync, statSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"

// ── liveness: which experts are actually running right now? ─────────────────
// Reads /proc, never a registry: a registry says what was LAUNCHED, /proc says
// what is ALIVE, and those differ exactly when it matters. FINDINGS.md#liveness
export function liveAgents(root, cfg, { whoami, findRoot, clock }) {
	const out = {}
	// Off-bus sessions by the agent directory they occupy; non-enumerable, so Object.entries(live) keeps its meaning.
	const offBus = {}
	// EVERY live session in the tree: "off bus" is a property of the MAIL, not of the PRESENCE. FINDINGS.md#A23
	const tree = []
	const finish = () => {
		Object.defineProperty(out, "offBus", { value: offBus, enumerable: false })
		Object.defineProperty(out, "tree", { value: tree, enumerable: false })
		return out
	}
	let pids = []
	try { pids = readdirSync("/proc").filter((p) => /^\d+$/.test(p)) } catch { return finish() }
	for (const pid of pids) {
		let cmd = ""
		try { cmd = readFileSync(`/proc/${pid}/cmdline`, "utf8") } catch { continue }
		if (!/(^|\/|\0)claude(\0|$)/.test(cmd)) continue
		let cwd = ""
		try { cwd = readlinkSync(`/proc/${pid}/cwd`) } catch { continue }
		// Each process's OWN declaration, so `who` reports what the hook will
		// actually do for that session rather than what our cwd implies.
		let declared = null, env = []
		try {
			env = readFileSync(`/proc/${pid}/environ`, "utf8").split("\0")
			const hit = env.find((e) => e.startsWith("CLAUDE_COMM_AGENT="))
			if (hit) declared = hit.slice("CLAUDE_COMM_AGENT=".length).trim() || null
		} catch { /* not readable — fall back to cwd, same as before */ }
		const who = whoami(root, cfg, cwd, declared)
		// Scoped by the SAME test as the declaration (A20), so this cannot become a
		// second, laxer definition of "in this project" that drifts from the first.
		const home = findRoot(cwd)
		if (home && resolve(home) === resolve(root)) tree.push({ pid: Number(pid), cwd, declared, agent: who })
		// An off-bus session is not nothing: an EXPORTED CLAUDE_COMM_AGENT takes the agent off the bus while
		// `sent` says "lands when relaunched" - false, mail queued forever. FINDINGS.md#A19
		if (!who) {
			if (declared) {
				const inDir = whoami(root, cfg, cwd, null)
				if (inDir) (offBus[inDir] ||= []).push({ pid, declared })
			}
			continue
		}
		let started = ""
		// Local, via clock(): this decides armed-vs-not against the hook file's
		// mtime. In UTC a stale session reads as freshly started. FINDINGS.md#A26
		try { started = clock(statSync(`/proc/${pid}`).mtime, true) } catch {}
		;(out[who] ||= []).push({ pid: Number(pid), since: started, turn: turnOf(pid, env) })
	}
	return finish()
}

// A live session's TURN — "running" says nothing about it, and mail lands at a turn END: `send`
// promised one to an idle session and the mail sat 6 min until a hand wake (`FINDINGS.md#idle-send`).
// The runtime keeps it, <config>/sessions/<pid>.json `status` (#native-path) — believed only when
// its `procStart` is THIS process's start tick, or a reused pid reads a dead session. Every miss
// says why, never a guess (LESSONS form E).
export function turnOf(pid, env) {
	const val = (k) => (env.find((e) => e.startsWith(`${k}=`)) || "").slice(k.length + 1)
	const dir = val("CLAUDE_CONFIG_DIR") || (val("HOME") && join(val("HOME"), ".claude"))
	if (!dir) return { state: null, why: env.length ? "no HOME in its environment" : "its environment could not be read" }
	let rec, tick
	try { rec = JSON.parse(readFileSync(join(dir, "sessions", `${pid}.json`), "utf8")) }
	catch (e) { return { state: null, why: e.code === "ENOENT" ? "its runtime keeps no record of it" : "its runtime record is unreadable" } }
	try { const st = readFileSync(`/proc/${pid}/stat`, "utf8"); tick = st.slice(st.lastIndexOf(") ") + 2).split(" ")[19] } catch {}
	if (!tick || String(rec?.procStart) !== tick) return { state: null, why: `its runtime record is for process start ${rec?.procStart}, not ${tick}` }
	// `waiting` = a dialog is open (a permission prompt by default; read in the 2.1.283 binary, review #15 §8): a person
	// must answer it, and a ring would type into it (#bell-into-typing) - so `send` prints no ring for it.
	if (rec.status === "waiting") return { state: null, waiting: true, why: `it is WAITING on ${rec.waitingFor || "a dialog"} - a person must answer it` }
	if (rec.status !== "busy" && rec.status !== "idle") return { state: null, status: String(rec.status), why: `its runtime says '${rec.status}'` }
	return { state: rec.status, at: Number(rec.statusUpdatedAt) || null }
}

/** The `who` command, exactly as it rendered inside the bus. */
export function renderWho(root, cfg, me, rest, { liveAgents: live_, pending }) {
	const live = live_(root, cfg)
	// `--json` so the WAKE asks this one implementation instead of scanning /proc again (review #5 F7, G7).
	if (rest.includes("--json")) {
		const out = { root, leader: cfg.leader, you: me || null, agents: {} }
		for (const id of Object.keys(cfg.agents)) {
			out.agents[id] = { pids: (live[id] || []).map((x) => x.pid), pending: pending(root, id).msgs.length }
		}
		console.log(JSON.stringify(out))
		return
	}
	console.log(`project: ${root}\nleader:  ${cfg.leader}\nyou:     ${me || "(not inside a known agent directory)"}\n`)
	for (const id of Object.keys(cfg.agents)) {
		const l = live[id]
		const n = pending(root, id).msgs.length
		// `since` answers "old enough to predate the hooks, i.e. deaf?". Local, dated when not today.
		const started = l?.[0]?.since ? ` since ${l[0].since}` : ""
		// THE TURN, not just "running" (atlas, 09-25: an expert waited 53 min for a bell nobody rang, shown `running`
		// with an empty inbox). turnOf's verdict, rendered for ONE session only - several share an inbox, warned below.
		const t = l?.length === 1 ? l[0].turn : null
		const turn = !t ? "" : t.state === "busy" ? " · working" : t.state === "idle" ? ` · IDLE${t.at ? ` ${Math.max(0, Math.round((Date.now() - t.at) / 60000))} min` : ""}`
			: t.waiting ? " · WAITING on a dialog" : t.status ? ` · ${t.status} (its runtime's word)` : " · turn ?"
		const off = live.offBus?.[id]
		// Name the declared value only when they AGREE. Reading `off[0]` alone
		// reports N sessions under a value most of them do not have.
		// FINDINGS.md#A25 Gated by A25.
		const names = off ? [...new Set(off.map((s) => s.declared))] : []
		const many = l && l.length > 1 ? `  ⚠ ${l.length} SESSIONS SHARE THIS INBOX`
			: !l && off ? `  ⚠ ${off.length} session(s) here declared OFF-BUS (CLAUDE_COMM_AGENT=${names.length === 1 ? names[0] : names.join(", ")})` : ""
		console.log(`  ${l ? "●" : "○"} ${id.padEnd(18)} ${(l ? `running (pid ${l.map((x) => x.pid).join(",")})${started}${turn}` : "not running").padEnd(40)}${n ? `${n} pending` : ""}${many}`)
	}
	// WHO RECEIVES MAIL is not WHO HOLDS THIS DIRECTORY: a `none` reviewer is invisible to the first and
	// holds the write lock. Walk live.tree, NOT the off-bus map, keyed by agent directory. FINDINGS.md#A23
	const others = (live.tree || []).filter((s) => !s.agent)
	if (others.length) {
		if (rest.includes("--all")) {
			for (const s of others) {
				const tag = s.declared ? `off bus (${s.declared})` : "off bus"
				console.log(`  ○ ${tag.padEnd(18)} ${`running (pid ${s.pid})`.padEnd(40)}${s.cwd}`)
			}
		} else {
			console.log(`\n  ⚠ ${others.length} other live session(s) in this tree receive no mail — but they are`)
			console.log(`    WRITING somewhere in it. Run 'who --all' to see where.`)
		}
	}
	// The condition that used to be silent, and the one that loses mail:
	// whichever session ends a turn first drains the inbox, the rest never see
	// it, and the sender is told ✓ delivered. FINDINGS.md#A17
	const shared = Object.entries(live).filter(([, v]) => v.length > 1)
	if (shared.length) {
		console.log(`\n  ⚠ ${shared.map(([id, v]) => `'${id}' has ${v.length} live sessions`).join("; ")}.`)
		console.log(`    Mail is drained by whichever ends a turn FIRST — the others never see it,`)
		console.log(`    and the sender is still told it was delivered.`)
		// TWO FIXES, the durable one FIRST: its own directory needs nothing typed and keeps its own inbox
		// (measured 09-05, FINDINGS.md#bus-notes); the env var is for two sessions sharing one directory.
		const pad = Math.max(cfg.leader.length, 4)
		console.log(`    Fix, and the first one needs nothing typed at launch:`)
		console.log(`      give the second session its OWN directory and add it to .comm/config.json,`)
		console.log(`      then start it there — it keeps its own inbox and can still write to '${cfg.leader}'.`)
		console.log(`    Or declare identity per session, which is the only way when the directory is shared:`)
		console.log(`      CLAUDE_COMM_AGENT=${String(cfg.leader).padEnd(pad)} claude   # the one that should get the mail`)
		console.log(`      CLAUDE_COMM_AGENT=${"none".padEnd(pad)} claude   # off the bus: receives nothing AND cannot send`)
	}
	const corrupt = existsSync(join(root, ".comm", "corrupt")) ? readdirSync(join(root, ".comm", "corrupt")).length : 0
	if (corrupt) console.log(`\n  ⚠ ${corrupt} corrupt message file(s) in .comm/corrupt/`)
	console.log(`\n  ● running   ○ not running (mail waits for it)`)
	return
}
