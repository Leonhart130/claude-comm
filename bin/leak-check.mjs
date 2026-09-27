#!/usr/bin/env node
/**
 * claude-comm LEAK CHECK — no private word reaches a public commit.
 *
 *   node bin/leak-check.mjs --tree [<commit>]      every file (and path) in the index, or in <commit>'s tree
 *   node bin/leak-check.mjs --staged               what the next commit would add (pre-commit hook)
 *   node bin/leak-check.mjs --message <file>       a commit message (commit-msg hook)
 *   node bin/leak-check.mjs --history [<range>]    every commit message in <range> (default HEAD)
 *   node bin/leak-check.mjs --install-hooks        pre-commit, commit-msg, and a pre-push that runs --history on the
 *                                                  pushed range and --tree on the pushed commit
 *
 * WHY (2026-09-27). This public repo carried a private project's name in 105 lines of 15 files and 35 commit messages,
 * plus a home path, for three weeks - written by me, one measured field note at a time. The owner had it deleted and
 * rebuilt. `FINDINGS.md#leak-check`.
 *
 * THE WORDS ARE NEVER IN THE REPO. A list of forbidden words committed here would publish them; a list of their hashes
 * would too (a seven-letter word falls to a brute force in minutes). So the list lives OUTSIDE any repo:
 * `$CLAUDE_COMM_PRIVATE_WORDS`, else `~/.config/claude-comm/private-words` - one case-insensitive JS regex per line,
 * `#` comments. Absent, the check says NOT ARMED and exits 3: silence must never read as clean (LESSONS form E).
 * A match prints the file and line and which rule number matched, never the matched text.
 */
import { readFileSync, writeFileSync, existsSync, chmodSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

export function loadRules(path = process.env.CLAUDE_COMM_PRIVATE_WORDS || join(process.env.HOME || "", ".config", "claude-comm", "private-words")) {
	if (!existsSync(path)) return { armed: false, path, rules: [] }
	const rules = []
	for (const line of readFileSync(path, "utf8").split("\n")) {
		const t = line.trim()
		if (!t || t.startsWith("#")) continue
		rules.push(new RegExp(t, "i"))
	}
	return { armed: rules.length > 0, path, rules }
}

/** Every hit in `text`, as { line, rule } - rule is the 1-based rule number, never the matched text. */
export function scan(text, rules) {
	const hits = []
	const lines = String(text).split("\n")
	for (let i = 0; i < lines.length; i++) rules.forEach((re, k) => { if (re.test(lines[i])) hits.push({ line: i + 1, rule: k + 1 }) })
	return hits
}

const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })

function scanBlobs(cwd, paths, show, rules) {
	const out = []
	for (const p of paths) {
		let text = ""
		try { text = show(p) } catch { continue }
		if (text.includes("\0")) continue
		for (const h of scan(text, rules)) out.push(`${p}:${h.line} (rule ${h.rule})`)
		if (scan(p, rules).length) out.push(`${p} - the PATH itself`)
	}
	return out
}

export function check(mode, arg, { cwd = process.cwd(), rules }) {
	if (mode === "--tree" && arg) {
		const paths = git(["ls-tree", "-r", "-z", "--name-only", arg], cwd).split("\0").filter(Boolean)
		return scanBlobs(cwd, paths, (p) => git(["show", `${arg}:${p}`], cwd), rules)
	}
	// --tree reads the tracked files from DISK (one spawn, not one per file: boot runs this at every start); --staged
	// reads the index, which is what the commit will carry.
	if (mode === "--tree") {
		const top = git(["rev-parse", "--show-toplevel"], cwd).trim()
		return scanBlobs(cwd, git(["ls-files", "-z"], cwd).split("\0").filter(Boolean), (p) => readFileSync(join(top, p), "utf8"), rules)
	}
	if (mode === "--staged") {
		const paths = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], cwd).split("\0").filter(Boolean)
		return scanBlobs(cwd, paths, (p) => git(["show", `:${p}`], cwd), rules)
	}
	if (mode === "--message") return scan(readFileSync(arg, "utf8"), rules).map((h) => `commit message:${h.line} (rule ${h.rule})`)
	if (mode === "--history") {
		const out = []
		for (const rec of git(["log", "--format=%H%x00%B%x01", arg || "HEAD"], cwd).split("\x01")) {
			const [sha, body] = rec.replace(/^\n/, "").split("\0")
			if (!sha) continue
			for (const h of scan(body || "", rules)) out.push(`${sha.slice(0, 7)} message:${h.line} (rule ${h.rule})`)
		}
		return out
	}
	throw new Error(`unknown mode ${mode}`)
}

function main() {
	const [mode, arg] = process.argv.slice(2)
	const cwd = process.cwd()
	if (mode === "--install-hooks") {
		const top = git(["rev-parse", "--show-toplevel"], cwd).trim(), dir = join(top, ".git", "hooks"), me = fileURLToPath(import.meta.url)
		mkdirSync(dir, { recursive: true })
		const hook = (name, body) => { writeFileSync(join(dir, name), `#!/bin/sh\n# written by bin/leak-check.mjs --install-hooks\n${body}\n`); chmodSync(join(dir, name), 0o755) }
		hook("pre-commit", `exec node "${me}" --staged`)
		hook("commit-msg", `exec node "${me}" --message "$1"`)
		// pre-push reads "<local ref> <local sha> <remote ref> <remote sha>" lines; scan each new range and its tip tree.
		hook("pre-push", `z=0000000000000000000000000000000000000000\nwhile read lref lsha rref rsha; do\n  [ "$lsha" = "$z" ] && continue\n  if [ "$rsha" = "$z" ]; then range="$lsha"; else range="$rsha..$lsha"; fi\n  node "${me}" --history "$range" || exit 1\n  node "${me}" --tree "$lsha" || exit 1\ndone`)
		console.log(`✓ pre-commit, commit-msg, pre-push written to ${dir}`)
		return
	}
	const { armed, path, rules } = loadRules()
	if (!armed) {
		console.error(`✗ leak-check NOT ARMED: no private word list at ${path} (one regex per line). Nothing was checked.`)
		process.exit(3)
	}
	let hits
	try { hits = check(mode, arg, { cwd, rules }) } catch (e) { console.error(`✗ leak-check: ${e.message}`); process.exit(2) }
	if (hits.length) {
		console.error(`✗ leak-check: ${hits.length} private word(s) - this must not reach the public repo:\n  ${hits.slice(0, 40).join("\n  ")}${hits.length > 40 ? `\n  … ${hits.length - 40} more` : ""}`)
		process.exit(1)
	}
	console.log(`✓ leak-check ${mode}: ${rules.length} rule(s), nothing matched`)
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) main()
