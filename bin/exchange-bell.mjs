#!/usr/bin/env node
/**
 * claude-comm EXCHANGE BELL — tell a peer project's leader that a file is waiting.
 *
 *   node bin/exchange-bell.mjs --peer work-leader --ref exchange/work-leader/out/X.md
 *   node bin/exchange-bell.mjs --peer work-leader --ref ... --dry-run
 *
 * WHY THIS EXISTS, and it is not "because ringing by hand is tedious".
 *
 * `exchange/` is a file exchange, not a bus (exchange/README.md). `bin/boot.mjs` tells ME
 * when a peer has written; NOTHING tells the peer when I have. So for one evening the
 * channel ran on me typing `kitten @ send-text` by hand, three times — and the third one
 * carried a **stale number**. It said *"your note expires 20:41:59 (armed 18:26:59Z)"*
 * while the note on disk read `18:30:34Z`: the peer had re-armed twice, the file was
 * current, and I had quoted what I remembered arming. The tool I asked had answered
 * correctly; the sentence I typed had not.
 *
 * The peer caught it and quoted my own rule back at me — *"a row that speaks for another
 * tool has to read what that tool reads"* — and named the consequence exactly: **a stale
 * expiry warning is an alarm that fires when nothing is wrong**, and had he trusted it
 * over the file he would have re-armed in a panic mid-report, which is the rushed ordering
 * my previous message existed to prevent. Two mechanisms fighting each other.
 *
 * ── THE ONE PROPERTY ───────────────────────────────────────────────────────────────────
 *
 * **THE BELL CARRIES A POINTER AND NOTHING ELSE.** Not a summary, not a deadline, not a
 * count — nothing that can be true when it is composed and false when it is read. This is
 * the bus's own rule (`--ref` is required, there is no `--body`) applied to the one path
 * that had been exempt from it because a human was typing. State that goes stale cannot be
 * embedded here because there is nowhere to put it: the text is fixed, and the only
 * variable in it is a path this tool has just confirmed exists.
 *
 * Everything else is `bin/wake.mjs`'s five rules, unchanged and reused rather than
 * reimplemented — resolve by pid then send, never `--match` on a guess (it exits 0 on no
 * match); every socket, not just `$KITTY_LISTEN_ON`; no daemon; and a quiet period, which
 * is a written record consulted by the next run, not a timer.
 *
 * WHAT IT DOES NOT DO. It does not deliver: the file is the artifact and the peer reads it
 * when their turn ends. It does not know whether they read it — the channel's answer is
 * their file in `in/`, which is what boot's `channel:` row already watches.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs"
import { join, dirname, resolve, relative, isAbsolute } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { spawnSync } from "node:child_process"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const ARGV = process.argv.slice(2)
const has = (f) => ARGV.includes(f)
function opt(flag, dflt = null) {
	const i = ARGV.indexOf(flag)
	if (i === -1) return dflt
	const v = ARGV[i + 1]
	// A flag whose value was eaten by the next flag is refused, never defaulted — the same
	// rule bin/ledger.mjs learned the hard way.
	if (v === undefined || v.startsWith("--")) die(`${flag} needs a value`)
	return v
}
const die = (m) => { process.stderr.write(`exchange-bell: ${m}\n`); process.exit(64) }

// A doorbell rung twice a second is a fault. Nothing sleeps: this is a written record of
// the last ring, consulted by the next run. Same constant and same reasoning as wake.mjs.
const QUIET_MS = 120_000

const peer = opt("--peer", null)
if (!peer) die("needs --peer <name> (the directory under exchange/)")
// The peer name becomes a path segment. Contained structurally, like every other name in
// this toolkit that touches the filesystem.
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(peer) || peer.includes("..")) die(`--peer must be a plain name, got ${JSON.stringify(peer)}`)

// Where the channels live. Defaults to this checkout's `exchange/`, and is a flag because
// a gate that could only exercise this against the LIVE channel would have to write into
// the correspondence it is testing — a control that writes into the world it measures is
// not a control (FINDINGS.md#measurement-traps), and this project has met that trap three
// times in one day.
const chanDir = join(resolve(opt("--exchange", join(ROOT, "exchange"))), peer)
const outDir = join(chanDir, "out"), inDir = join(chanDir, "in")
if (!existsSync(outDir)) die(`no channel at ${outDir} — exchange/README.md has the shape`)

/**
 * Where the peer's own bus lives, DECLARED rather than guessed. `exchange/<peer>/peer.json`
 * carries `{project, agent}`; --project and --agent override it. A tool that inferred the
 * project from a name would be one rename away from ringing the wrong terminal.
 */
let decl = {}
try { decl = JSON.parse(readFileSync(join(chanDir, "peer.json"), "utf8")) } catch {}
const project = opt("--project", decl.project || null)
const agent = opt("--agent", decl.agent || null)
if (!project || !agent) die(`I do not know where ${peer} lives. Write ${join(chanDir, "peer.json")} as {"project": "/abs/path", "agent": "leader"}, or pass --project and --agent`)

// THE REF. It must exist, and it must be inside this channel's out/. A dangling pointer is
// worse than no pointer — it reads as "the reasoning is recorded elsewhere" while the
// reasoning is gone (A27/A28's rule) — and a ref outside the channel points the peer at
// something the channel does not carry.
const refArg = opt("--ref", null)
if (!refArg) die("needs --ref <file>: the artifact. There is no --body; a bell carries a pointer or it carries nothing")
const ref = resolve(isAbsolute(refArg) ? refArg : join(process.cwd(), refArg))
const inside = relative(outDir, ref)
if (inside.startsWith("..") || isAbsolute(inside)) die(`--ref must be a file inside ${outDir}, got ${ref}`)
if (!existsSync(ref)) die(`--ref does not exist: ${ref}. A bell for a file that is not there is worse than no bell`)
try { if (!statSync(ref).isFile()) die(`--ref is not a file: ${ref}`) } catch { die(`--ref cannot be read: ${ref}`) }

// The peer's pid comes from THEIR bus, asked rather than reimplemented. A second
// implementation of "which claude process is which agent" has already disagreed with the
// first twice in this project (wake.mjs, rule 2).
const bus = join(project, ".comm", "bin", "comm.mjs")
if (!existsSync(bus)) die(`no bus at ${bus} — is ${project} installed?`)
const q = spawnSync(process.execPath, [bus, "who", "--json"], { cwd: project, encoding: "utf8", timeout: 5000 })
let state = null
try { state = JSON.parse(q.stdout) } catch {}
if (!state || !state.agents || !state.agents[agent]) die(`${project}'s bus does not know an agent called ${JSON.stringify(agent)}`)
const pids = state.agents[agent].pids || []
if (!pids.length) {
	// NOT an error, and not a silent success either. Their next session start is when they
	// would see it anyway; the file is already written and is the artifact.
	process.stdout.write(`${agent} is not running in ${project} — nothing rung. The file is written and waits: ${ref}\n`)
	process.exit(3)
}

const wake = await import(pathToFileURL(join(ROOT, "bin", "wake.mjs")).href)
const wins = wake.windows()
const target = pids.map((p) => ({ pid: p, r: wake.resolveWindow(p, wins) })).find((x) => x.r.ok)
// Rule 1: a refusal that says why, never a hopeful --match. `send-text --match` exits 0
// when it matches nothing, so an unresolved bell would read exactly like one that worked.
if (!target) die(`could not resolve a kitty window for ${agent} (pid ${pids.join(", ")}): ${pids.map((p) => wake.resolveWindow(p, wins).why).join("; ")}`)

const quietFile = join(chanDir, ".last-bell.json")
let prev = null
try { prev = JSON.parse(readFileSync(quietFile, "utf8")) } catch {}
const sinceMs = prev ? Date.now() - Date.parse(prev.at) : Infinity
if (sinceMs < QUIET_MS && !has("--force")) {
	process.stdout.write(`rung ${Math.round(sinceMs / 1000)}s ago (quiet period ${QUIET_MS / 1000}s) — not ringing. --force overrides.\n`)
	process.exit(3)
}

// THE TEXT. Fixed, except for the path. Read the header: everything that is not a pointer
// is something that can be true when it is composed and false when it is read.
const TEXT = `[claude-comm] cross-project doorbell. A file is waiting for you and the file is the artifact — ` +
	`this is only the bell: ${ref} — nothing in this message is computed or current except that path, so read the file. ` +
	`Reply as a file in ${inDir} (this channel is a file exchange, not a bus).`

if (has("--dry-run")) {
	process.stdout.write(`would ring ${agent} (pid ${target.pid}) in window ${target.r.win.id} on ${target.r.win.sock} — ${target.r.how}\n  ${TEXT}\n`)
	process.exit(0)
}
const send = (t) => spawnSync("kitten", ["@", "--to", `unix:${target.r.win.sock}`, "send-text", "--match", `id:${target.r.win.id}`, t],
	{ encoding: "utf8", timeout: 5000 })
const a = send(TEXT)
if (a.status !== 0) die(`send-text failed: ${(a.stderr || "").trim().slice(0, 120)}`)
send("\r")
try { writeFileSync(quietFile, JSON.stringify({ at: new Date().toISOString(), peer, agent, pid: target.pid, ref }) + "\n") } catch {}
process.stdout.write(`● rang ${agent} (pid ${target.pid}) in window ${target.r.win.id} — ${target.r.how}\n  ref: ${ref}\n`)
