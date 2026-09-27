#!/usr/bin/env node
/**
 * claude-comm LEAK CHECK — no private word reaches a public commit.
 *
 *   node bin/leak-check.mjs --tree [<commit>]      the tracked files on disk (and their paths), or <commit>'s tree
 *   node bin/leak-check.mjs --staged               what the next commit would carry (pre-commit, pre-merge-commit)
 *   node bin/leak-check.mjs --message <file|->     a commit or tag message (commit-msg; `-` reads stdin)
 *   node bin/leak-check.mjs --commits [<range>]    EVERY commit in <range> (default HEAD): the raw commit object
 *                                                  (author, committer, message), every path and every blob of its tree
 *   node bin/leak-check.mjs --ref <name>           a branch or tag name
 *   node bin/leak-check.mjs --all-cached           --tree + --commits since the last CLEAN scan (boot, every start);
 *                                                  the mark lives in .git/, keyed on HEAD and on the list itself
 *   node bin/leak-check.mjs --install-hooks        pre-commit, pre-merge-commit, commit-msg, pre-push
 *   node bin/leak-check.mjs --hooks-dir            where git runs this repo's hooks (worktrees, core.hooksPath)
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

const git = (args, cwd, input) => execFileSync("git", args, { cwd, encoding: input === undefined ? "utf8" : "utf8", input, maxBuffer: 512 * 1024 * 1024 })
const gitBuf = (args, cwd, input) => execFileSync("git", args, { cwd, input, maxBuffer: 512 * 1024 * 1024 })

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

/** Many blobs in ONE `git cat-file --batch`, not one spawn each. */
function readBlobs(shas, cwd) {
	const map = new Map()
	if (!shas.length) return map
	const buf = gitBuf(["cat-file", "--batch"], cwd, shas.join("\n") + "\n")
	let at = 0
	while (at < buf.length) {
		const nl = buf.indexOf(10, at)
		const [sha, type, size] = buf.slice(at, nl).toString("utf8").split(" ")
		if (type === "missing") { at = nl + 1; continue }
		const n = Number(size), start = nl + 1
		map.set(sha, buf.slice(start, start + n).toString("utf8"))
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
		return scanEntries(paths.map((p) => ({ path: p, read: () => git(["show", `:${p}`], cwd) })), rules)
	}
	if (mode === "--tree" && !arg) {
		const top = git(["rev-parse", "--show-toplevel"], cwd).trim()
		return scanEntries(git(["ls-files", "-z"], cwd).split("\0").filter(Boolean).map((p) => ({ path: p, read: () => readFileSync(join(top, p), "utf8") })), rules)
	}
	if (mode === "--tree" || mode === "--commits") {
		const commits = mode === "--tree" ? [git(["rev-parse", `${arg}^{commit}`], cwd).trim()]
			: git(["rev-list", ...(arg ? arg.split(/\s+/) : ["HEAD"])], cwd).split("\n").filter(Boolean)
		const out = [], seen = new Set(), pending = []
		for (const c of commits) {
			if (mode === "--commits") for (const h of scan(git(["cat-file", "commit", c], cwd), rules)) out.push(`${c.slice(0, 7)} commit object:${h.line} (rule ${h.rule})`)
			for (const rec of git(["ls-tree", "-r", "-z", c], cwd).split("\0").filter(Boolean)) {
				const tab = rec.indexOf("\t"), [, type, sha] = rec.slice(0, tab).split(" "), path = rec.slice(tab + 1)
				for (const h of scan(path, rules)) out.push(`${c.slice(0, 7)} ${shown(path, rules, sha)} - the PATH itself (rule ${h.rule})`)
				if (type === "blob" && !seen.has(sha)) { seen.add(sha); pending.push({ c, sha, path }) }
			}
		}
		const blobs = readBlobs(pending.map((p) => p.sha), cwd)
		for (const p of pending) {
			const text = blobs.get(p.sha) || ""
			if (text.includes("\0")) continue
			for (const h of scan(text, rules)) out.push(`${p.c.slice(0, 7)} ${shown(p.path, rules, p.sha)}:${h.line} (rule ${h.rule})`)
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

function installHooks(cwd) {
	const dir = hooksDir(cwd), me = fileURLToPath(import.meta.url)
	mkdirSync(dir, { recursive: true })
	const hook = (name, body) => { writeFileSync(join(dir, name), `#!/bin/sh\n# written by bin/leak-check.mjs --install-hooks\n${body}\n`); chmodSync(join(dir, name), 0o755) }
	hook("pre-commit", `exec node "${me}" --staged`)
	hook("pre-merge-commit", `exec node "${me}" --staged`)
	hook("commit-msg", `exec node "${me}" --message "$1"`)
	// Per pushed ref: both ref NAMES, an annotated tag's own message, then EVERY commit of the pushed range - not the tip.
	// A remote tip unknown here is not a range bound: everything reachable from the pushed commit is scanned instead.
	hook("pre-push", [
		"z=0000000000000000000000000000000000000000",
		"while read lref lsha rref rsha; do",
		"  [ \"$lsha\" = \"$z\" ] && continue",
		`  node "${me}" --ref "$lref" || exit 1`,
		`  node "${me}" --ref "$rref" || exit 1`,
		`  if [ "$(git cat-file -t "$lsha")" = tag ]; then git cat-file tag "$lsha" | node "${me}" --message - || exit 1; fi`,
		"  if [ \"$rsha\" = \"$z\" ] || ! git cat-file -e \"$rsha^{commit}\" 2>/dev/null; then range=\"$lsha\"; else range=\"$rsha..$lsha\"; fi",
		`  node "${me}" --commits "$range" || exit 1`,
		"done",
	].join("\n"))
	return dir
}

function main() {
	const [mode, arg] = process.argv.slice(2)
	const cwd = process.cwd()
	if (mode === "--install-hooks") { console.log(`✓ pre-commit, pre-merge-commit, commit-msg, pre-push written to ${installHooks(cwd)}`); return }
	if (mode === "--hooks-dir") { console.log(hooksDir(cwd)); return }
	const { armed, rules, why, invalid } = loadRules()
	if (!armed) {
		console.error(`✗ leak-check NOT ARMED: ${why}. Nothing was checked.`)
		process.exit(invalid ? 4 : 3)
	}
	let hits
	const stdin = arg === "-" ? readFileSync(0, "utf8") : ""
	try { hits = check(mode, arg, { cwd, rules, stdin }) } catch (e) { console.error(`✗ leak-check FAILED (${mode}): ${String(e.message).split("\n")[0]}`); process.exit(2) }
	if (hits.length) {
		console.error(`✗ leak-check: ${hits.length} private word(s) - this must not reach the public repo:\n  ${hits.slice(0, 40).join("\n  ")}${hits.length > 40 ? `\n  … ${hits.length - 40} more` : ""}`)
		process.exit(1)
	}
	console.log(`✓ leak-check ${mode}: ${rules.length} rule(s), nothing matched`)
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) main()
