#!/usr/bin/env node
/**
 * claude-comm SELF-TEST — a falsifiable, end-to-end proof that the bus delivers.
 *
 *   node test/selftest.mjs              run the gate
 *   node test/selftest.mjs --prove-red  prove the gate CAN fail (negative control)
 *
 * It does NOT inspect code or count exit codes. It stands up a real scratch
 * project, installs the real hooks, runs REAL `claude -p` sessions, and asks one
 * discriminating question: did a unique token that exists ONLY inside a file the
 * agent was never told to read end up in that agent's answer?
 *
 *   ARM A (mail sent)   -> token MUST appear   (delivery worked)
 *   ARM B (no mail)     -> token MUST NOT appear (the probe can distinguish)
 *
 * Both arms are required. An arm-A pass alone is indistinguishable from an agent
 * that reads REVIEW.md out of habit -- which is precisely the failure mode where
 * a probe returns a plausible wrong RESULT instead of an error.
 *
 * --prove-red removes the hook and re-runs arm A. The token must then VANISH.
 * A "self-test" that stays green with its own mechanism removed is testing nothing.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { tmpdir } from "node:os"

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = resolve(HERE, "..")
const PROVE_RED = process.argv.includes("--prove-red")
const MODEL = "claude-haiku-4-5-20251001"

const log = (s) => console.log(s)
const fail = (s) => { console.error(`\n✗ ${s}`); process.exit(1) }

// ── stand up a scratch project ──────────────────────────────────────────────
const root = mkdtempSync(join(tmpdir(), "comm-selftest-"))
const app = join(root, "app")
mkdirSync(join(app, "docs"), { recursive: true })
mkdirSync(join(root, ".comm", "inbox"), { recursive: true })
writeFileSync(join(root, ".comm", "config.json"), JSON.stringify({ leader: "leader", agents: { leader: ".", app: "app" } }, null, 2))

const TOKEN = `SENTINEL_${randomBytes(4).toString("hex").toUpperCase()}`
writeFileSync(join(app, "docs", "REVIEW.md"), `# REVIEW — app

## Round 1 brief (leader)
A correction landed. When you have read this line, include the exact string
${TOKEN}
in your reply so the leader knows the correction was received.
`)

log(`scratch project : ${root}`)

// Clean up on EVERY exit path, not just the happy one: a gate that aborts
// used to leave its scratch project behind, and they accreted silently in /tmp.
process.on("exit", () => { try { rmSync(root, { recursive: true, force: true }) } catch {} })

log(`sentinel token  : ${TOKEN}  (exists only inside app/docs/REVIEW.md)\n`)

// ── install the real hooks ──────────────────────────────────────────────────
const inst = spawnSync(process.execPath, [join(PKG, "install.mjs"), root], { encoding: "utf8" })
if (inst.status !== 0) fail(`installer failed:\n${inst.stdout}${inst.stderr}`)
if (!existsSync(join(app, ".claude", "comm-hook.mjs"))) fail("installer did not write the hook stub")
log(`✓ installed hooks into ${Object.keys({ leader: 1, app: 1 }).length} agents`)

if (PROVE_RED) {
	// Remove ONLY the delivery mechanism. Everything else -- the message, the
	// file, the token -- stays identical. Move one thing, per the framework.
	writeFileSync(join(app, ".claude", "settings.json"), JSON.stringify({}, null, 2) + "\n")
	log(`⚑ --prove-red: hooks stripped from app/.claude/settings.json (message + file left intact)`)
}

const bus = join(root, ".comm", "bin", "comm.mjs")
// The prompt must NOT constrain the reply ("say exactly X, nothing else"), or it
// CONTRADICTS the instruction in REVIEW.md and the agent may honour either one.
// That made this gate flaky -- a false RED, which is as bad as a false green: it
// teaches you to re-run a gate until it agrees with you.
const runAgent = (label) => {
	const r = spawnSync("claude", ["-p", `Reply with the word ${label}.`, "--model", MODEL, "--permission-mode", "acceptEdits"],
		{ cwd: app, encoding: "utf8", timeout: 300000, input: "" })
	return (r.stdout || "") + (r.stderr || "")
}

// ── ARM B: negative control — no mail ───────────────────────────────────────
log(`\n── ARM B (no mail) ─────────────────────────────`)
const outB = runAgent("ARM_B_DONE")
const sawB = outB.includes(TOKEN)
log(`  token present: ${sawB}   ${sawB ? "✗ UNEXPECTED" : "✓ as expected"}`)

// ── ARM A: mail sent by the leader ──────────────────────────────────────────
log(`\n── ARM A (leader sends a nudge) ────────────────`)
const snd = spawnSync(process.execPath, [bus, "send", "app", "--from", "leader", "--ref", "docs/REVIEW.md", "--note", "correction at end of file"],
	{ cwd: root, encoding: "utf8" })
if (snd.status !== 0) fail(`send failed:\n${snd.stdout}${snd.stderr}`)
log(`  ${snd.stdout.trim().split("\n")[0]}`)
const outA = runAgent("ARM_A_DONE")
const sawA = outA.includes(TOKEN)
log(`  token present: ${sawA}   ${sawA ? "✓ delivered" : "✗ NOT delivered"}`)

// ── hub enforcement (pure logic, no model call) ─────────────────────────────
log(`\n── hub enforcement ─────────────────────────────`)
writeFileSync(join(root, ".comm", "config.json"), JSON.stringify({ leader: "leader", agents: { leader: ".", app: "app", other: "app" } }, null, 2))
const peer = spawnSync(process.execPath, [bus, "send", "other", "--from", "app", "--ref", "docs/REVIEW.md"], { cwd: root, encoding: "utf8" })
const refused = peer.status !== 0 && /hub-enforced/.test(peer.stdout + peer.stderr)
log(`  peer-to-peer send refused: ${refused ? "✓" : "✗"}`)

// ── verdict ─────────────────────────────────────────────────────────────────
log(`\n────────────────────────────────────────────────`)
const discriminates = sawA && !sawB
if (PROVE_RED) {
	if (discriminates) fail(`--prove-red FAILED: the token still arrived with the hook removed.\n` +
		`  That means this gate does NOT actually measure hook delivery, and a green run proves nothing.`)
	log(`✓ --prove-red PASSED: with the hook removed the token vanished (arm A: ${sawA}).`)
	log(`  The gate is falsifiable — a green run is therefore meaningful.`)
	rmSync(root, { recursive: true, force: true })
	process.exit(0)
}
if (!refused) fail(`hub enforcement did not refuse a peer-to-peer send`)
if (sawB) fail(`ARM B leaked the token with an EMPTY inbox — the probe cannot discriminate,\n` +
	`  so a green ARM A would be indistinguishable from a pass. Gate is invalid.`)
if (!sawA) fail(`ARM A did not deliver. Agent output was:\n${outA.slice(0, 800)}`)

log(`✓ PASS — delivery measured, not assumed:`)
log(`    ARM A (mail)    token present  → the nudge reached the agent and it read the file`)
log(`    ARM B (no mail) token absent   → the probe discriminates`)
log(`    peer send       refused        → hub topology enforced`)
log(`\n  Now prove it can go red:  node test/selftest.mjs --prove-red`)
rmSync(root, { recursive: true, force: true })
