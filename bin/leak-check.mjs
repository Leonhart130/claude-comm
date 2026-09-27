#!/usr/bin/env node
/**
 * claude-comm LEAK CHECK — no private word reaches a public commit.
 *
 *   node bin/leak-check.mjs --tree [<commit>]      the tracked files on disk (and their paths), or <commit>'s tree
 *   node bin/leak-check.mjs --staged               what the next commit would carry (pre-commit, pre-merge-commit)
 *   node bin/leak-check.mjs --message <file|->     a commit or tag message (commit-msg; `-` reads stdin)
 *   node bin/leak-check.mjs --commits [<range>]    every OBJECT in <range> (default HEAD) - `rev-list --objects`: each
 *                                                  commit and tag raw (author, message), every path, every blob
 *   node bin/leak-check.mjs --ref <name>           a branch or tag name
 *   node bin/leak-check.mjs --all-cached           --tree + --commits since the last CLEAN scan (boot, every start);
 *                                                  the mark lives in .git/, keyed on HEAD and on the list itself
 *   node bin/leak-check.mjs --install-hooks        pre-commit, pre-merge-commit, commit-msg, pre-push
 *   node bin/leak-check.mjs --hooks-dir            where git runs this repo's hooks (worktrees, core.hooksPath)
 *   node bin/leak-check.mjs --hooks-check          the four hooks, byte for byte against what --install-hooks writes
 *
 * WHY (2026-09-27). This public repo carried a private project's name in 105 lines of 15 files and 35 commit messages,
 * plus a home path, for three weeks - written by me, one measured field note at a time. The owner had the GitHub repo
 * deleted and rebuilt from a rewritten history. `FINDINGS.md#leak-check`.
 *
 * THE WORDS ARE NEVER IN THE REPO. A list committed here would publish them; a list of their hashes would too (a
 * seven-letter word falls to a brute force of its SHA-256 in minutes). The list lives OUTSIDE any repo:
 * `$CLAUDE_COMM_PRIVATE_WORDS`, else `~/.config/claude-comm/private-words` - one case-insensitive JS regex per line,
 * `#` comments. Absent or empty: NOT ARMED, exit 3 - silence must never read as clean (LESSONS form E).
 * A hit prints WHERE and the rule NUMBER, never the matched text - and a path that matches is itself masked.
 *
 * REVIEW #16 (`FINDINGS.md#review16`), each measured, each closed here: the push read only the pushed TIP, so a word in
 * a commit that a later commit removed went public; a binary's NAME was never read; the refusal printed a matching path;
 * ref names and annotated-tag messages were never read; merges run `pre-merge-commit`, not `pre-commit`.
 */
import { readFileSync, writeFileSync, existsSync, chmodSync, mkdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { execFileSync, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"

export function loadRules(path = process.env.CLAUDE_COMM_PRIVATE_WORDS || join(process.env.HOME || "", ".config", "claude-comm", "private-words")) {
	if (!existsSync(path)) return { armed: false, path, rules: [], why: `no private word list at ${path}` }
	const rules = [], bad = []
	readFileSync(path, "utf8").split("\n").map((l) => l.trim()).filter((t) => t && !t.startsWith("#")).forEach((t, k) => {
		try { rules.push(new RegExp(t, "i")) } catch { bad.push(k + 1) }
	})
	if (bad.length) return { armed: false, path, rules: [], invalid: bad, why: `rule(s) ${bad.join(", ")} of ${path} are not valid regular expressions` }
	if (!rules.length) return { armed: false, path, rules, why: `${path} holds no rule (only blanks or comments)` }
	return { armed: true, path, rules }
}

/** Every hit in `text`, as { line, rule } - rule is the 1-based rule number, never the matched text. */
export function scan(text, rules) {
	const hits = []
	const lines = String(text).split("\n")
	for (let i = 0; i < lines.length; i++) rules.forEach((re, k) => { if (re.test(lines[i])) hits.push({ line: i + 1, rule: k + 1 }) })
	return hits
}

// git's own stderr is CAPTURED, never inherited: it prints paths and arguments in clear, above the masked report (review
// #17 §2, measured with a gitlink named after the word: "fatal: bad object :<the path>").
const git = (args, cwd, input) => execFileSync("git", args, { cwd, encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 512 * 1024 * 1024 })
const gitBuf = (args, cwd, input) => execFileSync("git", args, { cwd, input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 512 * 1024 * 1024 })
/** Text of a file or blob: UTF-16 by its BOM (PowerShell's `>` writes it; its NULs read as binary), else UTF-8. */
const decode = (buf) => buf[0] === 0xff && buf[1] === 0xfe ? buf.slice(2).toString("utf16le")
	: buf[0] === 0xfe && buf[1] === 0xff ? Buffer.from(buf.slice(2)).swap16().toString("utf16le") : buf.toString("utf8")

/** A path shown in a report: itself, unless it matches a rule - then masked, with the blob that carries it. */
const shown = (p, rules, blob = "") => {
	const h = scan(p, rules)
	return h.length ? `<a path matching rule ${h[0].rule}${blob ? `, blob ${blob.slice(0, 7)}` : ""}>` : p
}

/** Scan `entries` = [{ path, read() }]: the PATH first (a binary's name counts), then the content if it is text. */
function scanEntries(entries, rules, prefix = "") {
	const out = []
	for (const e of entries) {
		const p = shown(e.path, rules, e.blob)
		for (const h of scan(e.path, rules)) out.push(`${prefix}${p} - the PATH itself (rule ${h.rule})`)
		let text
		try { text = e.read() } catch { continue }
		if (text.includes("\0")) continue
		for (const h of scan(text, rules)) out.push(`${prefix}${p}:${h.line} (rule ${h.rule})`)
	}
	return out
}

/** Many objects in ONE `git cat-file --batch`, not one spawn each: sha -> { type, buf }. */
function readObjects(shas, cwd) {
	const map = new Map()
	const uniq = [...new Set(shas)]
	if (!uniq.length) return map
	const buf = gitBuf(["cat-file", "--batch"], cwd, uniq.join("\n") + "\n")
	let at = 0
	while (at < buf.length) {
		const nl = buf.indexOf(10, at)
		const [sha, type, size] = buf.slice(at, nl).toString("utf8").split(" ")
		if (type === "missing") { at = nl + 1; continue }
		const n = Number(size), start = nl + 1
		map.set(sha, { type, buf: buf.slice(start, start + n) })
		at = start + n + 1
	}
	return map
}

export function hooksDir(cwd) {
	const top = git(["rev-parse", "--show-toplevel"], cwd).trim()
	let custom = ""
	try { custom = git(["config", "core.hooksPath"], cwd).trim() } catch {}
	if (custom) return resolve(top, custom.replace(/^~(?=\/)/, process.env.HOME || "~"))
	return resolve(top, git(["rev-parse", "--git-common-dir"], cwd).trim(), "hooks")
}

export function check(mode, arg, { cwd = process.cwd(), rules, stdin = "" }) {
	if (mode === "--ref") return scan(arg || "", rules).map((h) => `a ref name (rule ${h.rule})`)
	if (mode === "--message") {
		const text = arg === "-" ? stdin : readFileSync(arg, "utf8")
		return scan(text, rules).map((h) => `message:${h.line} (rule ${h.rule})`)
	}
	if (mode === "--staged") {
		const paths = git(["diff", "--cached", "--name-only", "--diff-filter=ACMRT", "-z"], cwd).split("\0").filter(Boolean)
		return scanEntries(paths.map((p) => ({ path: p, read: () => decode(gitBuf(["show", `:${p}`], cwd)) })), rules)
	}
	if (mode === "--tree" && !arg) {
		const top = git(["rev-parse", "--show-toplevel"], cwd).trim()
		return scanEntries(git(["ls-files", "-z"], cwd).split("\0").filter(Boolean).map((p) => ({ path: p, read: () => decode(readFileSync(join(top, p))) })), rules)
	}
	// THE OBJECTS, NOT THE COMMITS (review #17 §1). `rev-list <range>` lists commits only, and a tag pointing at a blob, a
	// tree or another tag has none: nothing was read and the tool said "nothing matched". `rev-list --objects` lists what
	// git sends - commits, trees with their paths, blobs, and every tag of a chain - and a single tip that yields NOTHING
	// is an error, never a clean scan (form E).
	if (mode === "--tree" || mode === "--commits") {
		const spec = mode === "--tree" ? [`${arg}^{tree}`] : (arg ? arg.split(/\s+/) : ["HEAD"])
		const lines = git(["rev-list", "--objects", ...spec], cwd).split("\n").filter(Boolean)
		if (!lines.length && !spec.some((x) => x.includes("..") || x.startsWith("^"))) throw new Error("the range names no object - nothing was read")
		const objs = lines.map((l) => { const i = l.indexOf(" "); return i < 0 ? { sha: l, path: "" } : { sha: l.slice(0, i), path: l.slice(i + 1) } })
		const out = [], pathOf = new Map()
		for (const o of objs) {
			if (o.path && !pathOf.has(o.sha)) pathOf.set(o.sha, o.path)
			if (o.path) for (const h of scan(o.path, rules)) out.push(`${shown(o.path, rules, o.sha)} - the PATH itself (rule ${h.rule})`)
		}
		const read = readObjects(objs.map((o) => o.sha), cwd)
		for (const [sha, { type, buf }] of read) {
			// EVERY NAME IN EVERY TREE: rev-list prints one path per OBJECT, so a second file with the same content under a
			// name carrying the word was never listed - measured, A85's "file NAME pushed" case. The tree holds all names.
			if (type === "tree") {
				for (let at = 0; at < buf.length;) {
					const sp = buf.indexOf(32, at), nul = buf.indexOf(0, sp)
					const name = buf.slice(sp + 1, nul).toString("utf8")
					for (const h of scan(name, rules)) out.push(`<a name matching rule ${h.rule}, in tree ${sha.slice(0, 7)}> - the PATH itself (rule ${h.rule})`)
					at = nul + 1 + sha.length / 2   // the entry's own id: 20 bytes in a SHA-1 repo, 32 in a SHA-256 one
				}
				continue
			}
			const text = decode(buf)
			if (type === "blob" && text.includes("\0")) continue
			const where = type === "blob" ? shown(pathOf.get(sha) || `blob ${sha.slice(0, 7)}`, rules, sha) : `${sha.slice(0, 7)} ${type} object`
			for (const h of scan(text, rules)) out.push(`${where}:${h.line} (rule ${h.rule})`)
		}
		return out
	}
	if (mode === "--history") return check("--commits", arg, { cwd, rules })
	if (mode === "--all-cached") {
		// A new rule re-reads ALL history: the mark is keyed on the list's own content, never on its mtime.
		const top = git(["rev-parse", "--show-toplevel"], cwd).trim()
		const mark = resolve(top, git(["rev-parse", "--git-path", "leak-check-clean"], cwd).trim())
		const key = createHash("sha256").update(rules.map((r) => r.source).join("\n")).digest("hex").slice(0, 16)
		const head = git(["rev-parse", "HEAD"], cwd).trim()
		let since = ""
		try {
			const [h, k] = readFileSync(mark, "utf8").trim().split(" ")
			if (k === key && spawnSync("git", ["merge-base", "--is-ancestor", h, head], { cwd }).status === 0) since = h
		} catch {}
		const hits = [...check("--tree", "", { cwd, rules }), ...(since === head ? [] : check("--commits", since ? `${since}..${head}` : head, { cwd, rules }))]
		if (!hits.length) writeFileSync(mark, `${head} ${key}\n`)
		return hits
	}
	throw new Error(`unknown mode ${mode}`)
}

/** The four hooks, exactly as installed - also what `--hooks-check` compares against, byte for byte. */
export function hookBodies(me = fileURLToPath(import.meta.url)) {
	const h = (body) => `#!/bin/sh\n# written by bin/leak-check.mjs --install-hooks\n${body}\n`
	return {
		"pre-commit": h(`exec node "${me}" --staged`),
		"pre-merge-commit": h(`exec node "${me}" --staged`),
		"commit-msg": h(`exec node "${me}" --message "$1"`),
		// Per pushed ref: the REMOTE ref's name (the local one does not leave), then every OBJECT of the pushed range.
		// A remote tip unknown here is not a bound: everything reachable from the pushed object is read instead.
		"pre-push": h([
			"z=0000000000000000000000000000000000000000",
			"while read lref lsha rref rsha; do",
			"  [ \"$lsha\" = \"$z\" ] && continue",
			`  node "${me}" --ref "$rref" || exit 1`,
			"  if [ \"$rsha\" = \"$z\" ] || ! git cat-file -e \"$rsha\" 2>/dev/null; then range=\"$lsha\"; else range=\"$rsha..$lsha\"; fi",
			`  node "${me}" --commits "$range" || exit 1`,
			"done",
		].join("\n")),
	}
}

function installHooks(cwd) {
	const dir = hooksDir(cwd)
	mkdirSync(dir, { recursive: true })
	for (const [name, body] of Object.entries(hookBodies())) { writeFileSync(join(dir, name), body); chmodSync(join(dir, name), 0o755) }
	return dir
}

/** Which hooks are missing or differ from what --install-hooks writes now (an old version, a dead path, a comment). */
export function hooksCheck(cwd) {
	const dir = hooksDir(cwd)
	return { dir, bad: Object.entries(hookBodies()).filter(([name, body]) => { try { return readFileSync(join(dir, name), "utf8") !== body } catch { return true } }).map(([n]) => n) }
}

function main() {
	const [mode, arg] = process.argv.slice(2)
	const cwd = process.cwd()
	if (mode === "--install-hooks") { console.log(`✓ pre-commit, pre-merge-commit, commit-msg, pre-push written to ${installHooks(cwd)}`); return }
	if (mode === "--hooks-dir") { console.log(hooksDir(cwd)); return }
	if (mode === "--hooks-check") {
		const { dir, bad } = hooksCheck(cwd)
		if (bad.length) { console.error(`✗ leak-check: ${bad.join(", ")} missing or not as --install-hooks writes them, in ${dir}`); process.exit(1) }
		console.log(`✓ leak-check: the four hooks are current in ${dir}`); return
	}
	const { armed, rules, why, invalid } = loadRules()
	if (!armed) {
		console.error(`✗ leak-check NOT ARMED: ${why}. Nothing was checked.`)
		process.exit(invalid ? 4 : 3)
	}
	let hits
	const stdin = arg === "-" ? readFileSync(0, "utf8") : ""
	// FAILED names the mode and git's exit status - never git's message or arguments, which may carry the word.
	try { hits = check(mode, arg, { cwd, rules, stdin }) } catch (e) {
		const why = e.status !== undefined && e.status !== null ? `git exited ${e.status}` : /nothing was read/.test(e.message) ? "the range names no object - nothing was read" : (e.code || "error")
		console.error(`✗ leak-check FAILED (${mode}): ${why}`); process.exit(2)
	}
	if (hits.length) {
		console.error(`✗ leak-check: ${hits.length} private word(s) - this must not reach the public repo:\n  ${hits.slice(0, 40).join("\n  ")}${hits.length > 40 ? `\n  … ${hits.length - 40} more` : ""}`)
		process.exit(1)
	}
	console.log(`✓ leak-check ${mode}: ${rules.length} rule(s), nothing matched`)
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) main()
