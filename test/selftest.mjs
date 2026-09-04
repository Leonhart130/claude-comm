#!/usr/bin/env node
/**
 * claude-comm SELF-TEST — an end-to-end proof that the bus delivers, using real
 * installed hooks and real `claude -p` sessions.
 *
 *   node test/selftest.mjs              run the gate
 *   node test/selftest.mjs --prove-red  prove the gate CAN fail (negative control)
 *
 * ── WHY THIS WAS REWRITTEN, 2026-08-05 ──────────────────────────────────────
 * The previous version asserted that a sentinel token planted in a file the agent
 * was never told to read appeared in that agent's ANSWER. It went red about one
 * run in six with nothing wrong, because it measured two things at once:
 *
 *   1. did the transport inject the nudge?   — deterministic
 *   2. did the model then choose to obey it? — NOT deterministic
 *
 * ⭐ The electio leader supplied the sharper half of the diagnosis, and it is the
 * reason the fix is a split rather than a retry loop: that non-determinism is a
 * CONSEQUENCE OF THE DESIGN, not an accident. The whole point of pointer-not-
 * content is that the agent stays free to read the file or not — so a gate that
 * demands obedience measures precisely what this bus refuses to guarantee.
 *
 * A gate that reddens at random trains you to re-run it until it agrees with you,
 * which is worse than having no gate, and it also makes a GREEN run weak evidence.
 *
 * So the two questions are now separated:
 *   · TRANSPORT  — did the hook fire at the turn boundary, drain the right mail,
 *                  and log it? Fully deterministic. THIS is the gate.
 *   · BEHAVIOUR  — did the agent then read the file? Observed and REPORTED on
 *                  every run, never gated.
 *
 * --prove-red removes ONLY the hook and re-runs arm A. The mail must then survive,
 * because nothing delivered it. That control is deterministic too.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs"
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
// HERMETIC REGISTRY, before any child is spawned. This spawns REAL sessions running the
// REAL stub, which since 2026-09-04 invalidates the registry entry for the session pid it
// resolves — and from an agent-run suite that pid is the operator's own session. Same
// reason as the block at the top of test/attack.mjs, which carries the measurement.
process.env.CLAUDE_COMM_RUNTIME = mkdtempSync(join(tmpdir(), "comm-selftest-runtime-"))
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
process.on("exit", () => { try { rmSync(root, { recursive: true, force: true }) } catch {} })
log(`sentinel token  : ${TOKEN}  (exists only inside app/docs/REVIEW.md)\n`)

const inst = spawnSync(process.execPath, [join(PKG, "install.mjs"), root], { encoding: "utf8" })
if (inst.status !== 0) fail(`installer failed:\n${inst.stdout}${inst.stderr}`)
if (!existsSync(join(app, ".claude", "comm-hook.mjs"))) fail("installer did not write the hook stub")
log(`✓ installed real hooks into 2 agents`)

if (PROVE_RED) {
	// Remove ONLY the delivery mechanism. The message, the file and the token stay
	// identical — one variable moved, per the framework.
	writeFileSync(join(app, ".claude", "settings.json"), JSON.stringify({}, null, 2) + "\n")
	log(`⚑ --prove-red: hooks stripped from app/.claude/settings.json (message + file left intact)`)
}

const bus = join(root, ".comm", "bin", "comm.mjs")
const pending = (agent) => {
	try { return readdirSync(join(root, ".comm", "inbox", agent)).filter((f) => f.endsWith(".json")).length } catch { return 0 }
}
const logRows = () => {
	const p = join(root, ".comm", "log.jsonl")
	if (!existsSync(p)) return []
	return readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
}
// The prompt must NOT constrain the reply ("say exactly X, nothing else"), or it
// CONTRADICTS the instruction in REVIEW.md and the agent may honour either one.
// That made the old gate flaky in a second, independent way.
const runAgent = (label) => {
	const r = spawnSync("claude", ["-p", `Reply with the word ${label}.`, "--model", MODEL, "--permission-mode", "acceptEdits"],
		{ cwd: app, encoding: "utf8", timeout: 300000, input: "" })
	return (r.stdout || "") + (r.stderr || "")
}

// ── ARM B: negative control — no mail ───────────────────────────────────────
log(`\n── ARM B (no mail) ─────────────────────────────`)
const rowsB0 = logRows().length
const outB = runAgent("ARM_B_DONE")
const drainedB = logRows().length - rowsB0
const sawB = outB.includes(TOKEN)
log(`  TRANSPORT  log rows added: ${drainedB}   ${drainedB === 0 ? "✓ nothing delivered, as expected" : "✗ something was delivered from an empty inbox"}`)
log(`  behaviour  token present: ${sawB}   ${sawB ? "⚠ the agent read REVIEW.md unprompted" : "(absent, as expected)"}`)

// ── ARM A: mail sent by the leader ──────────────────────────────────────────
log(`\n── ARM A (leader sends a nudge) ────────────────`)
const snd = spawnSync(process.execPath, [bus, "send", "app", "--from", "leader", "--ref", "docs/REVIEW.md", "--note", "correction at end of file"],
	{ cwd: root, encoding: "utf8" })
if (snd.status !== 0) fail(`send failed:\n${snd.stdout}${snd.stderr}`)
log(`  ${snd.stdout.trim().split("\n")[0]}`)

const beforeA = pending("app")
const outA = runAgent("ARM_A_DONE")
const afterA = pending("app")
const rowA = logRows().find((m) => m.to_agent === "app" || m.to === "app")
const sawA = outA.includes(TOKEN)

// THE GATE: the transport, and nothing about what the model chose to do.
const transportOK = beforeA === 1 && afterA === 0 && !!rowA?.delivered && rowA.via === "hook" && rowA.ref === "docs/REVIEW.md"
log(`  TRANSPORT  mail ${beforeA} -> ${afterA}, logged ${rowA?.delivered ? `via=${rowA.via}` : "NOT LOGGED"}, ref=${rowA?.ref ?? "-"}`)
log(`             ${transportOK ? "✓ the hook fired at the turn boundary and delivered" : "✗ delivery did not happen"}`)
log(`  behaviour  token present: ${sawA}   ${sawA ? "the agent read the file it was pointed at" : "the agent did NOT read the file (allowed — see header)"}`)

// ── hub enforcement (pure logic, no model call) ─────────────────────────────
log(`\n── hub enforcement ─────────────────────────────`)
writeFileSync(join(root, ".comm", "config.json"), JSON.stringify({ leader: "leader", agents: { leader: ".", app: "app", other: "app" } }, null, 2))
const peer = spawnSync(process.execPath, [bus, "send", "other", "--from", "app", "--ref", "docs/REVIEW.md"], { cwd: root, encoding: "utf8" })
const refused = peer.status !== 0 && /hub-enforced/.test(peer.stdout + peer.stderr)
log(`  peer-to-peer send refused: ${refused ? "✓" : "✗"}`)

// ── verdict ─────────────────────────────────────────────────────────────────
log(`\n────────────────────────────────────────────────`)
if (PROVE_RED) {
	if (transportOK) fail(`--prove-red FAILED: the mail was still delivered with the hook removed.\n` +
		`  That means this gate does NOT measure hook delivery, and a green run proves nothing.`)
	log(`✓ --prove-red PASSED: with the hook removed the mail was never delivered`)
	log(`    mail ${beforeA} -> ${afterA} (stayed pending), log row: ${rowA ? "present" : "none"}`)
	log(`  The gate is falsifiable — a green run is therefore meaningful.`)
	process.exit(0)
}
if (!refused) fail(`hub enforcement did not refuse a peer-to-peer send`)
if (drainedB !== 0) fail(`ARM B delivered something from an EMPTY inbox — the fixture is not isolating arms.`)
if (!transportOK) fail(`ARM A transport FAILED — the hook did not deliver at the turn boundary.\n` +
	`  mail ${beforeA} -> ${afterA}, log row: ${JSON.stringify(rowA ?? null)}\n  Agent output was:\n${outA.slice(0, 800)}`)

log(`✓ PASS — transport measured end to end with real sessions and real hooks:`)
log(`    ARM A   mail drained at the turn boundary, logged via=hook, correct ref`)
log(`    ARM B   empty inbox delivered nothing`)
log(`    peer    refused → hub topology enforced`)
log(`\n  BEHAVIOUR (reported, never gated): the agent ${sawA ? "DID" : "did NOT"} read the file it was pointed at.`)
log(`  Not a failure either way — the bus sends pointers and the agent stays free to`)
log(`  act on them. Gating this is what made the old version flaky ~1 run in 6.`)
log(`\n  Now prove it can go red:  node test/selftest.mjs --prove-red`)
