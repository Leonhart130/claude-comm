#!/usr/bin/env node
/**
 * claude-comm WHO — which sessions are alive, and what state each one is really in.
 *
 * SPLIT OUT OF bin/comm.mjs, 2026-09-11, and not for tidiness. Two gates disagreed:
 * **A22 went red at 48 370 B saying "split it or cut it", and A21's import allowlist made
 * a split impossible** — it permits `node:*` only, so `comm.mjs` could not import a sibling.
 * The amendment allows a relative import of a BUS file and applies A21's own checks to that
 * file TRANSITIVELY, so the property A21 protects (the bus cannot become a daemon) is
 * unchanged while the remedy A22 names becomes available. `FINDINGS.md#bus-split`.
 *
 * And the seam was chosen by an OPEN ITEM, not by size: STATUS open item 5 has said since
 * 2026-09-08 that `who` reports two states where there are more, and that the missing ones
 * "cannot go there — A21 forbids the bus that import ⇒ an A21 amendment AND a split". This
 * is that split. Liveness is the part of the bus that reads the machine rather than the
 * mailbox, so it is the part that keeps wanting imports the bus must not have.
 *
 * 🔴 DEPENDENCIES FLOW ONE WAY. This file imports nothing from `comm.mjs`; `comm.mjs`
 * imports from here and passes `whoami`, `findRoot`, `clock` and `pending` in. A circular
 * import would work in Node and would be a trap for the next reader, and there is exactly
 * one implementation of "which claude process is which agent" either way — which is the
 * property review #5 (F7, G7) was bitten by twice in one day.
 */
import { readdirSync, readFileSync, readlinkSync, statSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"

// ── liveness: which experts are actually running right now? ─────────────────
// Reads /proc, never a registry: a registry says what was LAUNCHED, /proc says
// what is ALIVE, and those differ exactly when it matters. FINDINGS.md#liveness
export function liveAgents(root, cfg, { whoami, findRoot, clock }) {
	const out = {}
	// Off-bus sessions, keyed by the agent whose directory they occupy.
	// Non-enumerable, so `live[agent]` and the shared-inbox scan over
	// Object.entries(live) keep exactly their old meaning.
	const offBus = {}
	// EVERY live session in the tree, on the bus or not: "off bus" is a property
	// of the MAIL, not of the PRESENCE. A `none` session receives nothing, but it
	// is alive and writing somewhere. FINDINGS.md#A23
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
		let declared = null
		try {
			const env = readFileSync(`/proc/${pid}/environ`, "utf8")
			const hit = env.split("\0").find((e) => e.startsWith("CLAUDE_COMM_AGENT="))
			if (hit) declared = hit.slice("CLAUDE_COMM_AGENT=".length).trim() || null
		} catch { /* not readable — fall back to cwd, same as before */ }
		const who = whoami(root, cfg, cwd, declared)
		// Scoped by the SAME test as the declaration (A20), so this cannot become a
		// second, laxer definition of "in this project" that drifts from the first.
		const home = findRoot(cwd)
		if (home && resolve(home) === resolve(root)) tree.push({ pid: Number(pid), cwd, declared, agent: who })
		// An off-bus session is not an agent, but it is not nothing either: report it
		// as "not running" and an EXPORTED CLAUDE_COMM_AGENT takes the real agent off
		// the bus while `who` says "not running" and `sent` says "lands when
		// relaunched" — both false, mail queued forever. FINDINGS.md#A19
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
		;(out[who] ||= []).push({ pid: Number(pid), since: started })
	}
	return finish()
}


/** The `who` command, exactly as it rendered inside the bus. */
export function renderWho(root, cfg, me, rest, { liveAgents: live_, pending }) {
	const live = live_(root, cfg)
	// `--json` exists so the WAKE does not have to scan /proc a second time.
	// "Which claude process is which agent" already has one implementation, right
	// here, and this project has now been bitten twice in one day by a second one
	// disagreeing with it (F7, G7 of review #5). A program asking that question gets
	// the same answer a person does, from the same call.
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
		// `since` was collected and never rendered. It is the field that answers
		// "is this session old enough to predate the hooks, i.e. deaf?", which
		// otherwise has to be dug out of `ps`. Local time, dated when not today.
		const started = l?.[0]?.since ? ` since ${l[0].since}` : ""
		const off = live.offBus?.[id]
		// Name the declared value only when they AGREE. Reading `off[0]` alone
		// reports N sessions under a value most of them do not have.
		// FINDINGS.md#A25 Gated by A25.
		const names = off ? [...new Set(off.map((s) => s.declared))] : []
		const many = l && l.length > 1 ? `  ⚠ ${l.length} SESSIONS SHARE THIS INBOX`
			: !l && off ? `  ⚠ ${off.length} session(s) here declared OFF-BUS (CLAUDE_COMM_AGENT=${names.length === 1 ? names[0] : names.join(", ")})` : ""
		console.log(`  ${l ? "●" : "○"} ${id.padEnd(18)} ${(l ? `running (pid ${l.map((x) => x.pid).join(",")})${started}` : "not running").padEnd(40)}${n ? `${n} pending` : ""}${many}`)
	}
	// `who` answers WHO RECEIVES MAIL; a leader about to write a shared file is
	// asking WHO HOLDS THIS DIRECTORY. A correctly-declared `none` reviewer is
	// invisible to the first question and is the one holding the write lock.
	// ⚠️ Walk live.tree, NOT the off-bus map: that map is keyed by AGENT
	// DIRECTORY, so a session in `scripts/` — owned by no agent — stays
	// invisible, which is exactly when the question is asked. FINDINGS.md#A23
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
		// TWO FIXES, and the durable one is FIRST. Identity here comes from where a
		// session stands, so a second agent with its own directory needs nothing typed
		// at launch and keeps its own inbox — measured 2026-09-05: a turn ended in the
		// leader's folder took the leader's mail (1 -> 0), the same turn ended in the
		// reviewer's folder left it (1 -> 1), and the reviewer could still write to the
		// leader with no variable at all. The env var stays because it is the only
		// per-session channel when two sessions must share one directory.
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
