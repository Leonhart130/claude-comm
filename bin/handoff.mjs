#!/usr/bin/env node
/**
 * claude-comm HANDOFF — what survives a restart, and it is a PROOF, not a summary.
 *
 *   node bin/handoff.mjs write  --obligations <file> [--read <path>]... [--guard "<cmd>"]...
 *   node bin/handoff.mjs verify [--agent <name>] [--root <dir>]
 *   node bin/handoff.mjs --prove-red
 *
 * WHY THIS SHAPE, and it is the consumer's design rather than mine (DESIGN-autonomy.md).
 * I proposed that a handoff should "replace most of your boot read". They argued hardest
 * against exactly that: their boot read is a VERIFICATION protocol, not context recovery,
 * and a handoff that lets a rebooted session skip the source and trust a summary written
 * by a previous self is this project's signature defect, automated and scheduled.
 *
 * A mid-session reboot faces a different problem than a next-day boot: the next-day boot
 * must re-read because the world moved; the mid-session reboot must re-read only WHAT
 * moved. So the manifest carries sha256 sums. On restart `verify` re-hashes: unchanged
 * means the previous session's read stands as a verified fact ABOUT THE DISK, changed
 * means that file and only that file is read again in full. Nothing is trusted; something
 * is proved. On a quiet reboot the delta is zero files.
 *
 * ── WHERE THE READ LIST COMES FROM, and why it is two lists and not one ────────────────
 *
 * MEASURED 2026-09-10 on this session's own transcript before this file was written: 277
 * Bash calls, 0 Read calls. Under a harness that tells the agent to prefer shell tools, a
 * manifest built from `Read`/`Edit` inputs alone would have been EMPTY while the session
 * had read forty files. So:
 *
 *   observed  — pulled from the transcript: file_path inputs, AND paths mentioned in Bash
 *               commands that exist under the root. The Bash half is a HEURISTIC and is
 *               labelled as one; it over-collects (a path in a grep pattern counts) rather
 *               than under-collecting, because a file wrongly listed costs one re-read and
 *               a file wrongly omitted costs a silent stale belief.
 *   declared  — passed with --read. What the agent says it read, in its own judgement.
 *
 * Both are hashed the same way and the provenance is printed, so a reader can see which
 * claim rests on a heuristic. A file in neither list is simply not covered, and the
 * handoff says how many that might be rather than implying completeness.
 *
 * ── WHAT IT REFUSES ───────────────────────────────────────────────────────────────────
 *
 * `write` REFUSES without --obligations, and the file must be non-empty. A handoff whose
 * open-obligations section a tool could invent is prose with a checksum stapled to it, and
 * the one section no tool can derive is the one a restart actually loses. The guards are
 * RUN here, never reported: --guard "<cmd>" executes and records real stdout, because
 * `a guard that returns output is not a guard that ran` is the whole reason this file
 * exists in the form it does.
 */
import * as fsx from "node:fs"
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve, isAbsolute, basename } from "node:path"
import { createHash } from "node:crypto"
import { execFileSync, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { lookup as registryLookup, sessionPid, entries as registryEntries } from "./session-registry.mjs"

const ARGV = process.argv.slice(2)
const has = (f) => ARGV.includes(f)
const opt = (f, d = null) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d }
const all = (f) => ARGV.reduce((a, v, i) => (v === f && ARGV[i + 1] ? [...a, ARGV[i + 1]] : a), [])
const die = (m, code = 2) => { process.stderr.write(`handoff: ${m}\n`); process.exit(code) }

const ROOT = resolve(opt("--root", process.cwd()))
const sha = (p) => { try { return createHash("sha256").update(readFileSync(p)).digest("hex") } catch { return null } }

/** The agent this handoff belongs to. Asked of the bus, never guessed - the same rule the
 *  ledger follows, because a handoff filed under a name nobody resolves is a handoff for
 *  nobody. Falls back to the flag only when the bus cannot answer. */
function whoAmI() {
	const declared = opt("--agent", null)
	if (declared) return declared
	const bus = join(ROOT, ".comm", "bin", "comm.mjs")
	const local = join(resolve(fileURLToPath(new URL(".", import.meta.url))), "comm.mjs")
	for (const b of [bus, local]) {
		if (!existsSync(b)) continue
		const r = spawnSync(process.execPath, [b, "whoami"], { cwd: ROOT, encoding: "utf8" })
		if (r.status === 0 && r.stdout.trim()) return r.stdout.trim()
	}
	return null
}

const handoffPath = (agent) => join(ROOT, ".comm", "handoff", `${agent}.md`)

/** Paths this session touched, read out of its own transcript. See the header for why the
 *  Bash half exists and why it over-collects. */
function observedReads(transcript) {
	const out = new Map()
	let lines = []
	try { lines = readFileSync(transcript, "utf8").split("\n") } catch { return out }
	const add = (p, how) => {
		if (!p) return
		const abs = isAbsolute(p) ? p : join(ROOT, p)
		if (!abs.startsWith(ROOT)) return               // another project is not this handoff's business
		let st = null
		try { st = statSync(abs) } catch { return }
		if (!st.isFile()) return
		if (!out.has(abs)) out.set(abs, how)
	}
	for (const l of lines) {
		if (!l.trim()) continue
		let o
		try { o = JSON.parse(l) } catch { continue }
		const c = o && o.message && o.message.content
		if (!Array.isArray(c)) continue
		for (const b of c) {
			if (b.type !== "tool_use" || !b.input) continue
			if (typeof b.input.file_path === "string") add(b.input.file_path, "tool")
			if (typeof b.input.command === "string") {
				// HEURISTIC, and labelled as one everywhere it is printed.
				for (const tok of b.input.command.split(/[\s"'`;|&()<>]+/)) {
					if (!tok || tok.startsWith("-")) continue
					if (!/[/.]/.test(tok)) continue
					add(tok.replace(/^["']|["']$/g, ""), "shell")
				}
			}
		}
	}
	return out
}

/** State no file in the repo knows, and that a restart therefore destroys. */
function machineState() {
	const bits = []
	const git = (...a) => { try { return execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim() } catch { return "" } }
	const head = git("rev-parse", "--short", "HEAD")
	const dirty = git("status", "--porcelain")
	bits.push(`- **HEAD** \`${head || "not a git repo"}\`, working tree ${dirty ? `**${dirty.split("\n").length} uncommitted path(s)** — untouchable until they are dealt with:\n${dirty.split("\n").map((l) => `  - \`${l}\``).join("\n")}` : "clean"}`)
	const live = registryEntries().filter((e) => e.pid !== process.pid)
	bits.push(live.length
		? `- **${live.length} other live session(s)** on this machine: ${live.map((e) => `${e.agent || "?"} (pid ${e.pid})`).join(", ")} — their work is not yours to undo`
		: "- No other live session is recorded on this machine")
	try {
		const cl = spawnSync(process.execPath, [join(resolve(fileURLToPath(new URL(".", import.meta.url))), "claim.mjs"), "list", "--root", ROOT], { encoding: "utf8" })
		const t = (cl.stdout || "").trim()
		bits.push(t ? `- **Machine resources claimed here:**\n${t.split("\n").map((l) => `  - \`${l.trim()}\``).join("\n")}` : "- No machine resource is claimed in this project")
	} catch { bits.push("- Claims could not be read") }
	return bits.join("\n")
}

function cmdWrite() {
	const agent = whoAmI() || die("cannot tell which agent you are - pass --agent, or run inside an agent's directory")
	const oblPath = opt("--obligations", null)
	if (!oblPath) die("--obligations <file> is required.\n" +
		"  The open obligations are the one section no tool can derive, and they are exactly what a restart\n" +
		"  loses. A handoff a tool could write alone is prose with a checksum stapled to it.")
	if (!existsSync(oblPath)) die(`--obligations: no such file: ${oblPath}`)
	const obligations = readFileSync(oblPath, "utf8").trim()
	if (!obligations) die(`--obligations: ${oblPath} is empty - write what the next session must not lose`)

	const pid = sessionPid()
	const reg = pid ? registryLookup(pid) : { ok: false }
	const manifest = new Map()
	if (reg.ok) for (const [p, how] of observedReads(reg.transcript)) manifest.set(p, how)
	for (const d of all("--read")) {
		const abs = isAbsolute(d) ? d : join(ROOT, d)
		if (!existsSync(abs)) die(`--read: no such file: ${d}`)
		manifest.set(abs, "declared")
	}
	if (!manifest.size) die("nothing to pin: no transcript was resolvable and no --read was given.\n" +
		"  A handoff with an empty manifest proves nothing about the disk; say so with --read or fix the registry.")

	// GUARDS ARE RUN, NEVER REPORTED. "passed" is a claim; stdout is evidence.
	const guards = []
	for (const g of all("--guard")) {
		const r = spawnSync("sh", ["-c", g], { cwd: ROOT, encoding: "utf8" })
		const out = `${r.stdout || ""}${r.stderr || ""}`.trim().split("\n").slice(-6).join("\n")
		guards.push({ cmd: g, exit: r.status, out })
	}

	const rows = [...manifest.entries()].sort((a, b) => a[0].localeCompare(b[0]))
		.map(([p, how]) => ({ path: p, how, sha: sha(p) })).filter((r) => r.sha)
	const body = `# HANDOFF — ${agent}, ${new Date().toISOString()}

🔴 **This is a manifest, not a summary. Nothing here replaces reading a file — it tells you which files you
do NOT have to read again, and proves it.** Run \`node bin/handoff.mjs verify\` first: every UNCHANGED row is
a verified fact about the disk, and every CHANGED row is a file to read in full before acting.

## 1. Machine state no file knows

${machineState()}

## 2. Open obligations — the previous session's own words

${obligations}

## 3. Guards, with their output

${guards.length ? guards.map((g) => `**\`${g.cmd}\`** → exit ${g.exit}\n\n\`\`\`\n${g.out || "(no output)"}\n\`\`\``).join("\n\n") : "🔴 **None were run, and that is not the same as none passing.**"}

## 4. Read manifest — ${rows.length} file(s)

⚠️ Provenance: \`tool\` = a file_path input · \`shell\` = **a heuristic** over Bash command text, which
over-collects on purpose · \`declared\` = named by the agent. A file in none of these is simply not covered.

${rows.map((r) => `- \`${r.sha.slice(0, 16)}\`  ${r.how.padEnd(8)}  ${r.path.replace(ROOT + "/", "")}`).join("\n")}
`
	const out = handoffPath(agent)
	mkdirSync(join(ROOT, ".comm", "handoff"), { recursive: true })
	writeFileSync(out, body)
	// WRITTEN AND RE-READ. A write this process cannot see again is not a handoff, it is a
	// hope - the same rule the ledger and the registry are held to in this repo.
	const back = (() => { try { return readFileSync(out, "utf8") } catch { return "" } })()
	if (!back.includes("## 4. Read manifest")) die(`wrote ${out} and could not read it back intact`, 3)
	process.stdout.write(`✓ handoff for '${agent}' → ${out}\n  ${rows.length} file(s) pinned, ${guards.length} guard(s) run\n`)
}

function cmdVerify() {
	const agent = whoAmI() || opt("--agent", null) || die("cannot tell which agent you are - pass --agent")
	const p = handoffPath(agent)
	if (!existsSync(p)) die(`no handoff for '${agent}' at ${p}`, 1)
	const txt = readFileSync(p, "utf8")
	const rows = [...txt.matchAll(/^- `([0-9a-f]{16})`\s+(\S+)\s+(.+)$/gm)]
	if (!rows.length) die(`${p} carries no manifest rows - it cannot be verified, which is not the same as passing`, 3)
	let moved = 0, gone = 0
	const lines = []
	for (const m of rows) {
		const rel = m[3].trim(), abs = isAbsolute(rel) ? rel : join(ROOT, rel)
		const now = sha(abs)
		if (now === null) { gone++; lines.push(`  ✗ GONE      ${rel}`); continue }
		if (!now.startsWith(m[1])) { moved++; lines.push(`  ⚠ CHANGED   ${rel}  — read this one in full`) }
	}
	process.stdout.write(`handoff — ${p}\n  ${rows.length} pinned · ${rows.length - moved - gone} unchanged · ${moved} changed · ${gone} gone\n` +
		(lines.length ? lines.join("\n") + "\n" : "  every pinned file is byte-identical: the previous session's read stands\n"))
	process.exit(moved || gone ? 1 : 0)
}

const cmd = ARGV.find((a) => !a.startsWith("--"))
if (has("--prove-red")) { proveRed() }
else if (cmd === "write") cmdWrite()
else if (cmd === "verify") cmdVerify()
else die("usage: handoff.mjs write --obligations <file> [--read <p>]... [--guard \"<cmd>\"]... | verify [--agent <n>] [--root <d>]")

/**
 * Every arm moves ONE variable against a control built by the same code in the same
 * directory. The two that matter are the REFUSALS: a handoff that writes itself without
 * obligations, and a verify that says nothing when a pinned file has moved, are both
 * failures that look exactly like success.
 */
function proveRed() {
	const { mkdtempSync, rmSync, mkdirSync: mk, writeFileSync: wf } = fsx
	const dir = mkdtempSync(join(tmpdir(), "comm-handoff-prove-"))
	process.on("exit", () => { try { rmSync(dir, { recursive: true, force: true }) } catch {} })
	let failed = 0
	const check = (name, pass, detail) => {
		console.log(`  ${pass ? "✓" : "✗"} ${name.padEnd(52)} ${detail}`)
		if (!pass) failed++
	}
	const self = fileURLToPath(import.meta.url)
	const run = (args) => spawnSync(process.execPath, [self, ...args, "--root", dir, "--agent", "probe"], { encoding: "utf8", cwd: dir })
	mk(join(dir, ".comm", "handoff"), { recursive: true })
	const target = join(dir, "pinned.md")
	wf(target, "the bytes that were read\n")
	const obl = join(dir, "obligations.md")
	wf(obl, "- the next session must not lose this\n")
	const empty = join(dir, "empty.md")
	wf(empty, "   \n")

	console.log("\nhandoff negative control - one variable per arm\n")

	// 1. CONTROL. Everything below is a deviation from this one succeeding.
	const ok = run(["write", "--obligations", obl, "--read", target])
	check("a handoff with obligations and a read is written",
		ok.status === 0 && existsSync(join(dir, ".comm", "handoff", "probe.md")),
		`exit ${ok.status}, file written=${existsSync(join(dir, ".comm", "handoff", "probe.md"))}`)

	// 2. ONE VARIABLE against 1: no --obligations. The section no tool can derive.
	const noObl = run(["write", "--read", target])
	check("write REFUSES with no obligations", noObl.status !== 0 && /obligations/.test(noObl.stderr || ""),
		`exit ${noObl.status} - ${String(noObl.stderr).trim().split("\n")[0].slice(0, 58)}`)

	// 3. ONE VARIABLE: the obligations file exists and is BLANK. A file that exists is not
	//    a file that says anything, and this is the shape a scripted handoff would produce.
	const blank = run(["write", "--obligations", empty, "--read", target])
	check("write REFUSES an EMPTY obligations file", blank.status !== 0 && /empty/.test(blank.stderr || ""),
		`exit ${blank.status} - ${String(blank.stderr).trim().split("\n")[0].slice(0, 58)}`)

	// 4. POSITIVE CONTROL for the verifier: nothing has moved.
	const clean = run(["verify"])
	check("verify is silent-clean when nothing moved", clean.status === 0 && /every pinned file is byte-identical/.test(clean.stdout || ""),
		`exit ${clean.status} - ${String(clean.stdout).trim().split("\n").pop().slice(0, 52)}`)

	// 5. ONE VARIABLE against 4: one byte in a pinned file. This is the whole point of the
	//    manifest - a restart must re-read exactly this file and no other.
	wf(target, "the bytes that were read, plus one\n")
	const moved = run(["verify"])
	check("verify NAMES a pinned file that changed", moved.status !== 0 && /CHANGED/.test(moved.stdout || "") && /pinned.md/.test(moved.stdout || ""),
		`exit ${moved.status} - ${(String(moved.stdout).match(/CHANGED.*/) || ["none"])[0].slice(0, 46)}`)

	// 6. ONE VARIABLE: the file is gone rather than changed. Different shapes, and only one
	//    of them can be repaired by reading.
	rmSync(target, { force: true })
	const goneRun = run(["verify"])
	check("verify NAMES a pinned file that vanished", goneRun.status !== 0 && /GONE/.test(goneRun.stdout || ""),
		`exit ${goneRun.status} - ${(String(goneRun.stdout).match(/GONE.*/) || ["none"])[0].slice(0, 46)}`)

	// 7. A handoff that cannot be verified must not read as one that passed.
	wf(join(dir, ".comm", "handoff", "probe.md"), "# HANDOFF\n\nno manifest here\n")
	const noRows = run(["verify"])
	check("verify REFUSES a handoff with no manifest rows", noRows.status !== 0 && /cannot be verified/.test(noRows.stderr || ""),
		`exit ${noRows.status} - ${String(noRows.stderr).trim().split("\n")[0].slice(0, 52)}`)

	console.log(`\n${failed ? `✗ ${failed} handoff propert(y/ies) NOT demonstrated` : "✓ every handoff property demonstrated by a moved variable"}\n`)
	process.exit(failed ? 1 : 0)
}
