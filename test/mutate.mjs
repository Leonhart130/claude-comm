#!/usr/bin/env node
/**
 * claude-comm MUTATION RUNNER — does each gate redden for the property in its own title?
 *
 *   node test/mutate.mjs <mutants.json> [--jobs N]     baseline + every mutant, N suites at a time
 *   node test/mutate.mjs --baselines N [--jobs N]      N unmodified suites: the parallelism control
 *
 * <mutants.json> is `[{ "name", "file", "find", "replace" }, ...]`. `file` is relative to the repo, `find` is the
 * source bytes EXACTLY as they sit in the file - in `install.mjs` the stub is a template literal, so its `${` is
 * written `\${` there, and a mutant must say so. Nothing is escaped for you: a runner that rewrote its input would
 * be one more thing between the mutant you meant and the one that ran.
 *
 * WHY IT EXISTS (2026-09-27). Every disposition here ends with a mutation table, and every one was run by a
 * scratch script, one suite after another: nine runs, ~15 min, on one core of twelve (`attack` is 51 s wall for
 * 47 s of CPU). The owner asked for faster tests that stay reliable. Parallel is the speed; these are the reliability:
 *
 *   · THE BASELINE RUNS WITH THE MUTANTS, in the same batch, under the same load. If it is not green, no mutant's
 *     result means anything and the report says VOID - a red that the load produced would read as a red the mutant
 *     produced. `--baselines N` is the control for the parallelism itself: measured 4 wide, 4/4 green (FINDINGS.md
 *     #review13, "one control run" - repeat it before trusting a wider N).
 *   · A MUTANT THAT DOES NOT APPLY IS REFUSED, never run. `find` must match exactly once; zero is an inert probe
 *     (the suite would be green for a mutation that never happened), two is an ambiguous one.
 *   · A MUTANT THAT LEAVES THE SUITE GREEN IS THE FINDING, and is printed as SURVIVED - never as a pass.
 *
 * Each run is a copy of the TRACKED tree as it is on disk now (uncommitted edits included, untracked files not), in
 * its own temporary directory. The suite finds everything relative to its own file, so a copy is a whole world.
 */
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, statSync, rmSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { spawn, execFileSync } from "node:child_process"
import { tmpdir, availableParallelism } from "node:os"
import { fileURLToPath } from "node:url"

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(k); return i === -1 ? d : args[i + 1] }
const jobs = Math.max(1, Number(opt("--jobs", 2)) || 2)
const baselines = Number(opt("--baselines", 0)) || 0
const specPath = args.find((a, i) => !a.startsWith("--") && !["--jobs", "--baselines"].includes(args[i - 1]))

if (!specPath && !baselines) {
	console.error("✗ usage: node test/mutate.mjs <mutants.json> [--jobs N]   |   node test/mutate.mjs --baselines N [--jobs N]")
	process.exit(2)
}
if (jobs > availableParallelism()) console.error(`⚠ --jobs ${jobs} is more than this machine's ${availableParallelism()} cores`)

let mutants = []
if (specPath) {
	try { mutants = JSON.parse(readFileSync(specPath, "utf8")) } catch (e) { console.error(`✗ ${specPath}: ${e.message}`); process.exit(2) }
	if (!Array.isArray(mutants) || !mutants.every((m) => m && m.name && m.file && typeof m.find === "string" && typeof m.replace === "string")) {
		console.error(`✗ ${specPath} must be an array of { name, file, find, replace }`); process.exit(2)
	}
}

// Refuse BEFORE anything runs: a batch with one inert mutant in it would still print a table that looks complete.
const inert = []
for (const m of mutants) {
	let src = ""
	try { src = readFileSync(join(REPO, m.file), "utf8") } catch { inert.push(`${m.name}: ${m.file} cannot be read`); continue }
	const n = src.split(m.find).length - 1
	if (n !== 1) inert.push(`${m.name}: 'find' matches ${n} time(s) in ${m.file} (want exactly 1)`)
	else if (m.find === m.replace) inert.push(`${m.name}: 'replace' is identical to 'find'`)
}
if (inert.length) { console.error("✗ refused - these mutants would not mutate anything they name:\n  " + inert.join("\n  ")); process.exit(2) }

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: REPO }).toString().split("\0").filter(Boolean)
const work = mkdtempSync(join(tmpdir(), "comm-mutate-"))
const copyTree = (dest) => {
	for (const f of tracked) {
		const src = join(REPO, f)
		if (!existsSync(src) || !statSync(src).isFile()) continue
		mkdirSync(dirname(join(dest, f)), { recursive: true })
		copyFileSync(src, join(dest, f))
	}
}

const runs = [
	...Array.from({ length: Math.max(baselines, specPath ? 1 : 0) }, (_, i) => ({ name: baselines ? `baseline-${i + 1}` : "baseline", baseline: true })),
	...mutants,
]
const t0 = Date.now()
const results = []
const runOne = (r) => new Promise((done) => {
	const dir = join(work, r.name.replace(/[^\w.-]/g, "_"))
	copyTree(dir)
	if (!r.baseline) {
		const p = join(dir, r.file)
		writeFileSync(p, readFileSync(p, "utf8").replace(r.find, () => r.replace))
	}
	const start = Date.now()
	let out = ""
	const child = spawn(process.execPath, ["test/attack.mjs"], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] })
	child.stdout.on("data", (d) => { out += d })
	child.stderr.on("data", (d) => { out += d })
	child.on("close", (code) => {
		const reds = out.split("\n").filter((l) => /^\s*✗ A\d+/.test(l)).map((l) => l.trim())
		const ran = /all adversarial checks passed|adversarial check\(s\) FAILED/.test(out)
		writeFileSync(join(work, `${r.name.replace(/[^\w.-]/g, "_")}.txt`), out)
		results.push({ ...r, code, reds, ran, secs: Math.round((Date.now() - start) / 1000) })
		rmSync(dir, { recursive: true, force: true })
		done()
	})
})
const queue = [...runs]
await Promise.all(Array.from({ length: Math.min(jobs, runs.length) }, async () => { while (queue.length) await runOne(queue.shift()) }))

const order = new Map(runs.map((r, i) => [r.name, i]))
results.sort((a, b) => order.get(a.name) - order.get(b.name))
const base = results.filter((r) => r.baseline)
const baseGreen = base.length > 0 && base.every((r) => r.ran && r.code === 0 && r.reds.length === 0)
console.log(`\n${runs.length} suite run(s), ${jobs} at a time, ${Math.round((Date.now() - t0) / 1000)} s wall - full output of each in ${work}\n`)
for (const r of results) {
	const tag = r.baseline ? (r.ran && r.code === 0 && !r.reds.length ? "✓ green" : `✗ NOT GREEN (exit ${r.code})`)
		: !r.ran ? `✗ DID NOT FINISH (exit ${r.code}) - the suite never printed its verdict`
		: r.reds.length ? `✓ reddened: ${r.reds.map((l) => l.match(/A\d+/)[0]).join(", ")}` : "🔴 SURVIVED - the suite is green with this mutant in it"
	console.log(`  ${r.name.padEnd(28)} ${String(r.secs).padStart(4)} s  ${tag}`)
}
if (!baseGreen) {
	console.log(`\n✗ VOID: the baseline is not green under this load, so no mutant's result above means anything. Re-run with fewer --jobs.`)
	process.exit(1)
}
const survived = results.filter((r) => !r.baseline && r.ran && !r.reds.length)
console.log(survived.length ? `\n🔴 ${survived.length} mutant(s) survived - each is an unarmed property.` : `\n✓ baseline green; every mutant reddened something. Read WHICH arm and WHICH row before calling it armed.`)
process.exit(survived.length || results.some((r) => !r.baseline && !r.ran) ? 1 : 0)
