#!/usr/bin/env node
/**
 * claude-comm RESTART — a declared restart, in the one order that survives.
 *
 *   node bin/restart.mjs prepare --obligations <file> [--read <p>]... [--guard "<cmd>"]...
 *   node bin/restart.mjs --prove-red
 *
 * WHY A THIRD TOOL RATHER THAN TWO CALLS BY HAND. `handoff.mjs` writes what survives and
 * `restart-signal.mjs` arms the note that makes the next start score as a REBOOT instead
 * of a COLD one. Doing both is not the point: doing them IN THIS ORDER is, and it is the
 * consumer's own finding, in their words — *"reboot-then-write is not a smaller version of
 * write-then-reboot; it is the crash we already survived once"*. A tool that enforces the
 * order and refuses when either half fails is the difference between a restart and a loss.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ────────────────────────────────────────────────
 *
 * **It does not relaunch.** `bin/launch.mjs` refuses to start an agent that is already
 * alive (A17: two sessions on one inbox, one of them draining the other's mail), and the
 * caller here IS that live agent. So the last step belongs to the caller: this prints the
 * exact command and stops. Automating it would mean either weakening A17 or having a tool
 * assert something about its caller's future — that it is about to exit — which nothing
 * can verify. **A step named and not taken is honest; a step taken on an unverifiable
 * assumption is the failure this repo keeps paying for.**
 *
 * ── AND WHY THERE IS NO TRIGGER HERE ──────────────────────────────────────────────────
 *
 * Measured 2026-09-10 on 168 real sessions: the share of file-opens that re-open a file
 * already read rises monotonically to 85%, and is ALREADY 52-59% by the second decile.
 * The design proposed that as a threshold-free trigger; this corpus refuses that reading —
 * the curve has no knee, so any trigger from it carries a number. And the ledger still
 * says UNKNOWN on whether a reboot costs a defect at all (it needs 10 declared restarts
 * per arm and has far fewer). **Shipping an automatic trigger before that verdict would be
 * automating a decision whose value is unmeasured.** This tool exists to make the declared
 * restart correct and countable, so the arm fills with real data and the verdict arrives.
 */
import { readFileSync, existsSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ARGV = process.argv.slice(2)
const has = (f) => ARGV.includes(f)
const opt = (f, d = null) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d }
const all = (f) => ARGV.reduce((a, v, i) => (v === f && ARGV[i + 1] ? [...a, ARGV[i + 1]] : a), [])
const die = (m, code = 2) => { process.stderr.write(`restart: ${m}\n`); process.exit(code) }
const ROOT = resolve(opt("--root", process.cwd()))

function agentName() {
	const declared = opt("--agent", null)
	if (declared) return declared
	for (const b of [join(ROOT, ".comm", "bin", "comm.mjs"), join(HERE, "comm.mjs")]) {
		if (!existsSync(b)) continue
		const r = spawnSync(process.execPath, [b, "whoami"], { cwd: ROOT, encoding: "utf8" })
		if (r.status === 0 && r.stdout.trim()) return r.stdout.trim()
	}
	return null
}

function prepare() {
	const agent = agentName() || die("cannot tell which agent you are - pass --agent, or run inside an agent's directory")
	const obl = opt("--obligations", null)
	if (!obl) die("--obligations <file> is required - it is what handoff.mjs refuses without, and for the same reason")

	// 1. THE HANDOFF FIRST. If this fails, nothing else may happen: an armed note with no
	//    handoff behind it is a restart that will score as measured and arrive empty.
	const hArgs = ["write", "--obligations", obl, "--root", ROOT, "--agent", agent]
	for (const r of all("--read")) hArgs.push("--read", r)
	for (const g of all("--guard")) hArgs.push("--guard", g)
	const h = spawnSync(process.execPath, [join(HERE, "handoff.mjs"), ...hArgs], { encoding: "utf8", cwd: ROOT })
	process.stdout.write(h.stdout || "")
	if (h.status !== 0) die(`the handoff FAILED (exit ${h.status}) - nothing was armed.\n${(h.stderr || "").trim()}`, 3)

	// 2. RE-READ IT. handoff.mjs checks its own write; this checks the artifact independently,
	//    because the next session is going to act on it and neither of us will be here.
	const v = spawnSync(process.execPath, [join(HERE, "handoff.mjs"), "verify", "--root", ROOT, "--agent", agent], { encoding: "utf8", cwd: ROOT })
	if (v.status !== 0) die(`the handoff was written and does not verify against the disk:\n${(v.stdout || v.stderr || "").trim()}\n` +
		`  Something changed under it between writing and reading. Fix that before restarting.`, 3)

	// 3. ONLY NOW the note. Its TTL is a backstop, not the mechanism: the next start claims it.
	const prev = opt("--prev-session", null)
	const nArgs = ["arm", "--agent", agent, "--root", ROOT, "--ttl", opt("--ttl", "1800"), "--by", "restart.mjs"]
	if (prev) nArgs.push("--prev-session", prev)
	const n = spawnSync(process.execPath, [join(HERE, "restart-signal.mjs"), ...nArgs], { encoding: "utf8", cwd: ROOT })
	if (n.status !== 0) die(`the handoff is written but the restart note could NOT be armed (exit ${n.status}).\n` +
		`${(n.stderr || "").trim()}\n  Restarting now would score COLD and the trial would be lost.`, 3)

	// 4. PROVE THE NOTE IS THERE. `peek` reads what the next start will read.
	const p = spawnSync(process.execPath, [join(HERE, "restart-signal.mjs"), "peek", "--agent", agent, "--root", ROOT], { encoding: "utf8", cwd: ROOT })
	if (p.status !== 0 || !/\S/.test(p.stdout || "")) die(`the note was armed and cannot be read back (exit ${p.status}) - do not restart on it`, 3)

	process.stdout.write(
		`✓ armed: the next start of '${agent}' will score as a REBOOT, not a cold start\n` +
		`  ${(p.stdout || "").trim().split("\n")[0]}\n\n` +
		`  The last step is yours, and this tool will not take it: launch.mjs refuses an agent\n` +
		`  that is already alive (A17), and you are it. Exit, then:\n\n` +
		`      node ${join(HERE, "launch.mjs")} ${agent}\n\n` +
		`  Or relaunch by hand in this project. The next session reads:\n` +
		`      node ${join(HERE, "handoff.mjs")} verify\n`)
}

if (has("--prove-red")) proveRed()
else if (ARGV.find((a) => !a.startsWith("--")) === "prepare") prepare()
else die(`usage: restart.mjs prepare --obligations <file> [--read <p>]... [--guard "<cmd>"]...`)

/**
 * Every arm moves ONE variable. The two that matter are ORDER and REFUSAL: a note armed
 * behind a failed handoff is the exact failure this tool exists to prevent, and it is
 * invisible afterwards - the next start scores a reboot and finds nothing.
 */
function proveRed() {
	const dir = mkdtempSync(join(tmpdir(), "comm-restart-prove-"))
	process.on("exit", () => { try { rmSync(dir, { recursive: true, force: true }) } catch {} })
	let failed = 0
	const check = (name, pass, detail) => { console.log(`  ${pass ? "✓" : "✗"} ${name.padEnd(50)} ${detail}`); if (!pass) failed++ }
	const self = fileURLToPath(import.meta.url)
	const run = (args) => spawnSync(process.execPath, [self, ...args, "--root", dir, "--agent", "probe"], { encoding: "utf8", cwd: dir })
	const notePath = join(dir, ".comm", "restart", "probe.json")
	mkdirSync(join(dir, ".comm", "handoff"), { recursive: true })
	const target = join(dir, "pinned.md"); writeFileSync(target, "bytes\n")
	const obl = join(dir, "obl.md"); writeFileSync(obl, "- do not lose this\n")
	const empty = join(dir, "empty.md"); writeFileSync(empty, "  \n")

	console.log("\nrestart negative control - one variable per arm\n")

	const ok = run(["prepare", "--obligations", obl, "--read", target])
	check("a prepared restart writes the handoff AND arms the note",
		ok.status === 0 && existsSync(join(dir, ".comm", "handoff", "probe.md")) && existsSync(notePath),
		`exit ${ok.status}, handoff=${existsSync(join(dir, ".comm", "handoff", "probe.md"))}, note=${existsSync(notePath)}`)

	// ONE VARIABLE: the handoff cannot be written. The note must NOT be armed behind it.
	try { rmSync(notePath, { force: true }) } catch {}
	const bad = run(["prepare", "--obligations", empty, "--read", target])
	check("a FAILED handoff arms no note",
		bad.status !== 0 && !existsSync(notePath),
		`exit ${bad.status}, note armed anyway=${existsSync(notePath)} (this is the order the tool exists for)`)

	// ONE VARIABLE: no obligations at all.
	const noObl = run(["prepare", "--read", target])
	check("prepare REFUSES without obligations", noObl.status !== 0 && /obligations/.test(noObl.stderr || ""),
		`exit ${noObl.status} - ${String(noObl.stderr).trim().split("\n")[0].slice(0, 46)}`)

	// ONE VARIABLE: a pinned file moves between the write and the verify. The tool must
	// refuse rather than arm a note over a handoff that no longer describes the disk.
	const moved = spawnSync(process.execPath, [self, "prepare", "--obligations", obl, "--read", target,
		"--root", dir, "--agent", "probe", "--guard", `printf x >> ${target}`], { encoding: "utf8", cwd: dir })
	check("a handoff that stopped matching the disk arms no note",
		moved.status !== 0 && /does not verify/.test(moved.stderr || ""),
		`exit ${moved.status} - ${String(moved.stderr).trim().split("\n")[0].slice(0, 46)}`)

	console.log(`\n${failed ? `✗ ${failed} restart propert(y/ies) NOT demonstrated` : "✓ every restart property demonstrated by a moved variable"}\n`)
	process.exit(failed ? 1 : 0)
}
