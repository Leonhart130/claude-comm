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
 *
 * REVIEW #15 §4, measured both ways, and each is now refused rather than trusted:
 *   · EVERY copy is made before the FIRST suite starts, and `find` is re-counted IN the copy. Copies used to be made
 *     as each run started, so a tracked edit mid-batch made a comment-only mutant read "✓ reddened: A79", exit 0 -
 *     an unarmed property reported armed. A checkout that changes during the batch is still reported at the end.
 *   · A suite that did not FINISH is never a survivor. An abort printed "✗ … FAILED and 3 never ran", which counted
 *     as finished, found no `✗ A<n>` line and printed "SURVIVED - the suite is green". Now: DID NOT FINISH.
 *   · `--timeout <s>` per suite (default 900): a mutant that hangs the suite no longer hangs the runner.
 *   · ⚠ A50/A51/A53 split and close kitty panes in the CALLER's tab; FINDINGS.md#split-lands-in-the-active-tab says
 *     they are deterministic only when nothing else runs them. N wide, they run N at once: green 4/4, 6/6 and 9/9
 *     so far - three samples, not a property.
 */
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, statSync, rmSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { spawn, execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { tmpdir, availableParallelism } from "node:os"
import { fileURLToPath } from "node:url"

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(k); return i === -1 ? d : args[i + 1] }
const jobs = Math.max(1, Number(opt("--jobs", 2)) || 2)
const timeoutS = Math.max(60, Number(opt("--timeout", 900)) || 900)
const baselines = Number(opt("--baselines", 0)) || 0
const specPath = args.find((a, i) => !a.startsWith("--") && !["--jobs", "--baselines", "--timeout"].includes(args[i - 1]))

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
const dirOf = (r) => join(work, r.name.replace(/[^\w.-]/g, "_"))
const treeHash = () => { const h = createHash("sha256"); for (const f of tracked) { try { h.update(f); h.update(readFileSync(join(REPO, f))) } catch {} } return h.digest("hex") }
// ALL COPIES FIRST, then the hash of what they were copied from: every run measures the same tree.
const before = treeHash()
for (const r of runs) {
	copyTree(dirOf(r))
	if (r.baseline) continue
	const p = join(dirOf(r), r.file), src = readFileSync(p, "utf8"), n = src.split(r.find).length - 1
	if (n !== 1) { console.error(`✗ refused - ${r.name}: 'find' matches ${n} time(s) in the COPY of ${r.file} (the tree moved after the check)`); rmSync(work, { recursive: true, force: true }); process.exit(2) }
	writeFileSync(p, src.replace(r.find, () => r.replace))
}
const results = []
const runOne = (r) => new Promise((done) => {
	const dir = dirOf(r)
	const start = Date.now()
	let out = "", timedOut = false
	const child = spawn(process.execPath, ["test/attack.mjs"], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] })
	const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL") }, timeoutS * 1000)
	child.stdout.on("data", (d) => { out += d })
	child.stderr.on("data", (d) => { out += d })
	child.on("close", (code) => {
		clearTimeout(timer)
		const lines = out.split("\n")
		const reds = lines.filter((l) => /^\s*✗ A\d+/.test(l)).map((l) => l.trim())
		// Any other red a suite can print (a drain check, a registry guard) - not its closing summary lines.
		const otherReds = lines.filter((l) => /^\s*✗ (?!A\d+)/.test(l) && !/adversarial check\(s\) FAILED|NEVER REPORTED|SUITE ABORTED/.test(l)).map((l) => l.trim())
		const passed = /all adversarial checks passed/.test(out)
		const ran = !timedOut && (passed || (/adversarial check\(s\) FAILED/.test(out) && !/SUITE ABORTED|never ran|NEVER REPORTED/.test(out)))
		writeFileSync(join(work, `${r.name.replace(/[^\w.-]/g, "_")}.txt`), out)
		results.push({ ...r, code, reds, otherReds, passed, ran, timedOut, secs: Math.round((Date.now() - start) / 1000) })
		rmSync(dir, { recursive: true, force: true })
		done()
	})
})
const queue = [...runs]
await Promise.all(Array.from({ length: Math.min(jobs, runs.length) }, async () => { while (queue.length) await runOne(queue.shift()) }))

const order = new Map(runs.map((r, i) => [r.name, i]))
results.sort((a, b) => order.get(a.name) - order.get(b.name))
const base = results.filter((r) => r.baseline)
const baseGreen = base.length > 0 && base.every((r) => r.ran && r.passed && r.code === 0 && r.reds.length === 0 && r.otherReds.length === 0)
console.log(`\n${runs.length} suite run(s), ${jobs} at a time, ${Math.round((Date.now() - t0) / 1000)} s wall - full output of each in ${work}\n`)
for (const r of results) {
	const tag = r.baseline ? (r.ran && r.passed && r.code === 0 && !r.reds.length && !r.otherReds.length ? "✓ green" : `✗ NOT GREEN (exit ${r.code})`)
		: !r.ran ? `✗ DID NOT FINISH (exit ${r.code}${r.timedOut ? `, killed after ${timeoutS} s` : ""}) - aborted or hung: not a verdict either way`
		: r.reds.length || r.otherReds.length ? `✓ reddened: ${[...r.reds.map((l) => l.match(/A\d+/)[0]), ...r.otherReds.map((l) => `"${l.slice(2, 40)}"`)].join(", ")}`
		: r.passed && r.code === 0 ? "🔴 SURVIVED - the suite is green with this mutant in it"
		: `✗ UNCLASSIFIED (exit ${r.code}) - finished, nothing red, not green: read its output`
	console.log(`  ${r.name.padEnd(28)} ${String(r.secs).padStart(4)} s  ${tag}`)
}
if (!baseGreen) {
	console.log(`\n✗ VOID: the baseline is not green under this load, so no mutant's result above means anything. Re-run with fewer --jobs.`)
	process.exit(1)
}
if (treeHash() !== before) console.log(`\n⚠ the checkout CHANGED during this batch: every result above describes the tree as it was at the start (all copies were made then).`)
const survived = results.filter((r) => !r.baseline && r.ran && r.passed && r.code === 0 && !r.reds.length && !r.otherReds.length)
console.log(!mutants.length ? `\n✓ ${base.length}/${base.length} unmodified suites green, ${jobs} at a time - the parallelism control, nothing more`
	: survived.length ? `\n🔴 ${survived.length} mutant(s) survived - each is an unarmed property.`
	: results.some((r) => !r.baseline && !(r.reds.length || r.otherReds.length)) ? `\n✗ some mutant(s) have NO verdict (did not finish, or unclassified) - nothing is proved for them.`
	: `\n✓ baseline green; every mutant reddened something. Read WHICH arm and WHICH row before calling it armed.`)
process.exit(survived.length || results.some((r) => !r.baseline && (!r.ran || (!r.reds.length && !r.otherReds.length && !(r.passed && r.code === 0)))) ? 1 : 0)
