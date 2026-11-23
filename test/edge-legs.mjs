#!/usr/bin/env node
/**
 * A128's legs - AN EDGE THAT SAYS HOW MANY LINES IT HIDES (Claude Code 2.1.330, `FINDINGS.md#more-edge`).
 *
 *   node test/edge-legs.mjs <path/to/bin/wake.mjs>     every leg, `name=true|false`; exit 1 when one is false
 *
 * Imported by test/attack.mjs (A128), which passes its own tree's wake.mjs; run alone against another tree's - the release
 * before the fix, a mutant - to see which legs redden. Pure: no window, no kitty, no session.
 *
 * WHAT HAPPENED. 2.1.330 (here 11-21 17:49) writes the count of hidden lines INTO the box's edge - `─── ↑ 4 more ───` on top,
 * `─── ↓ 4 more ───` at the bottom - and the row under a `↑` has no `❯`. The reader found no box: a bell typed into an idle
 * agent's box was never sent (no Enter without seeing it) and never seen again by the look that erases the bus's own text.
 * Work's 84-89: five agents in two hours on 11-22/23, the owner the first to see it.
 *
 * THE LEGS, each moving one variable with the reader byte-identical:
 *   · `real*`: the screens 2.1.330 drew (captured 11-23, `kitten @ get-text --ansi --add-cursor --add-wrap-markers`, a 51x13
 *     pane, Haiku, named and not), read as the field reads them. Red before the fix: "no input box", "no lower edge".
 *   · `drawn330*` beside `drawnOld*`: ONE fake box that draws either form, put through the real typeAndProve and eraseOwn. The
 *     old form is the positive control - green before the fix and after - so a red `drawn330` leg is the form, not the harness.
 *   · `narrow*`: what the fix must NOT accept - an arrow outside a rule, an arrow on the wrong edge, an edge that says lines are
 *     hidden over rows that look empty, a cursor on a shown row's first cell while the start is out of view.
 */
import { pathToFileURL } from "node:url"
import { resolve, join } from "node:path"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { SCREENS_2_1_330 as SC } from "./edge-screens.mjs"

const fast = { shownMs: 120, takenMs: 120, nap: 5, landMs: 120, answerMs: 50 }
const wrapAt = (t, w) => { const o = []; for (let i = 0; i < t.length; i += w) o.push(t.slice(i, i + w)); return o }

export function edgeLegs(wk) {
	const N = wk.NUDGE, legs = {}
	const read = (screen) => wk.cursorCounts(wk.promptAtRest(screen), true)   // the alternate screen, as every Claude Code window here
	const own = (r) => !!r && r.typed === true && !!wk.busText(r.text, { hidden: wk.mayHide(r) })
	// ── the screens 2.1.330 drew ──
	for (const [k, t, h] of [["", SC.tail, SC.head], ["Named", SC.namedTail, SC.namedHead]]) {
		const a = read(t), b = read(h)
		legs[`real${k}TailIsTheBusOwn`] = a.ok === false && a.typed === true && a.rows === 3 && a.hiddenAbove === 4 && a.cursorAtStart === false && wk.mayHide(a) && own(a) && wk.shows(a, N) && !wk.startOf(a, N)
		legs[`real${k}HeadIsItsStart`] = b.ok === false && b.typed === true && b.rows === 3 && b.hiddenBelow === 4 && b.hiddenAbove === undefined && b.cursorAtStart === true && wk.startOf(b, N)
	}
	// a count of two digits (two bells, `↑ 11 more`): the field's boxes hid 10 and more - a reader of one digit was the defect again
	const tw = read(SC.twice)
	legs.realTwoDigitCount = tw.typed === true && tw.hiddenAbove === 11 && wk.mayHide(tw) && own(tw)
	// the cursor inside the text (`↑ 8 more` over `↓ 3 more`): neither its start nor its end in view
	const md = read(SC.middle)
	legs.realMiddleShowsNeitherEnd = md.typed === true && md.hiddenAbove === 8 && md.hiddenBelow === 3 && md.cursorAtStart === false && !wk.startOf(md, N + " " + N) && !wk.shows(md, N + " " + N)
	// THE ERASER ON THAT BOX: the end first, judged before any press. Its end shows somebody's words after the bells: one Ctrl+E,
	// no Ctrl+U - beside its control, the same box whose end is the bells': erased (the review of #more-edge, its harness D)
	const eraseMiddle = (endText) => { const keys = []; let atEnd = false
		const endScreen = ["out", `─── ↑ 13 more ${"─".repeat(70)}`, ...endText.map((x) => "  " + x), "─".repeat(84)].map((l) => l + "\r").join("\n") + `\x1b[?25h\x1b[5;${3 + endText.at(-1).length}H\x1b[?12h\n`
		const e = wk.eraseOwn(() => atEnd ? (keys.filter((k) => k === "\x15").length >= 1 ? { ok: true } : read(endScreen)) : read(SC.middle), (t) => { keys.push(t); if (t === "\x05") atEnd = true; return { status: 0, stderr: "" } },
			(t, s) => !!wk.busText(t, { hidden: wk.mayHide(s) }), { pressMs: 1, answerMs: 30 })
		return { e, keys } }
	const theirs = eraseMiddle(["need to know whether it is still waiting, `comm", "inbox` tells you and consumes nothing.", "merci, je regarde ce que tu dis"])
	const ours = eraseMiddle(["boundary, which may not be this one. If you", "need to know whether it is still waiting, `comm", "inbox` tells you and consumes nothing."])
	legs.realMiddleEndJudgedFirst = theirs.keys.join("|") === "\x05" && theirs.e.erased === false && ours.keys[0] === "\x05" && ours.keys.includes("\x15")
	// lines STILL hidden below after the Ctrl+E (a text with a newline: Ctrl+E ends one line): a draft's, left alone - and said so, not
	// called a stall ("does not answer its keys" sends its reader to the wrong place)
	{ const keys = []
		const e = wk.eraseOwn(() => read(SC.middle.replace("↓ 3 more", keys.length ? "↓ 2 more" : "↓ 3 more").replace("↑ 8 more", keys.length ? "↑ 9 more" : "↑ 8 more")),
			(t) => { keys.push(t); return { status: 0, stderr: "" } }, (t, s) => !!wk.busText(t, { hidden: wk.mayHide(s) }), { pressMs: 1, answerMs: 30 })
		legs.realMiddleStillHiddenIsLeft = keys.join("|") === "\x05" && e.erased === false && !e.stalled && /still hidden below/.test(e.why || "") }
	// control: the same session's empty box is at rest before the fix and after
	legs.realEmptyAtRest = read(SC.empty).ok === true && read(SC.namedEmpty).ok === true
	// ── one fake box, either form ──
	// `form`: "330" writes the hidden counts into the edges and drops the `❯` under a `↑`; "old" draws bare rules and the `❯` on the
	// first row shown. Everything else is the same box: `cap` rows shown, the end in view, Ctrl+A shows the start, Ctrl+E the end,
	// Ctrl+U takes the last line, Enter submits all. The cursor where Claude Code puts it: the first text cell after Ctrl+A, else the
	// end of the last row shown. Rows are 1-based screen rows: "out" 1, the top edge 2, the first row shown 3.
	const W = 90
	const box = (form, lines, { cap = 3, width = 80 } = {}) => ({ lines, keys: [], atStart: false, submitted: [],
		screen() {
			const n = this.lines.length
			if (!n) return ["out", "─".repeat(W), "❯ \x1b[22;2mTry \"fake\"\x1b[22m", "─".repeat(W), "  ⏵⏵ auto mode on"].map((l) => l + "\r").join("\n") + "\x1b[?25h\x1b[3;3H\x1b[?12h\n"
			const shown = this.atStart ? this.lines.slice(0, cap) : this.lines.slice(-cap)
			const up = this.atStart ? 0 : Math.max(0, n - cap), down = this.atStart ? Math.max(0, n - cap) : 0
			const edge = (arrow, k) => form === "330" && k ? `─── ${arrow} ${k} more ${"─".repeat(W - 10 - String(k).length)}` : "─".repeat(W)
			const rows = shown.map((x, i) => (i === 0 && (form !== "330" || !up) ? "❯ " : "  ") + x)
			const cur = this.atStart ? [3, 3] : [2 + shown.length, 3 + shown.at(-1).length]
			return ["out", edge("↑", up), ...rows, edge("↓", down)].map((l) => l + "\r").join("\n") + `\x1b[?25h\x1b[${cur[0]};${cur[1]}H\x1b[?12h\n`
		},
		read() { return read(this.screen()) },
		send(t) {
			this.keys.push(t)
			if (t === "\x15") { if (!this.atStart) this.lines.pop() }
			else if (t === "\x01" || t === "\x05") this.atStart = t === "\x01"
			else if (t === "\r") { if (this.lines.length) { this.submitted.push(this.lines.join("")); this.lines = []; this.atStart = false } }
			else this.lines = wrapAt(this.atStart ? t + this.lines.join("") : this.lines.join("") + t, width)
			return { status: 0, stderr: "" }
		} })
	for (const form of ["330", "Old"]) {
		const f = form === "Old" ? "old" : "330"
		let b = box(f, []), r = wk.typeAndProve(() => b.read(), (t) => b.send(t), N, fast)
		legs[`drawn${form}BellIsRung`] = r.taken === true && r.headSeen === true && b.keys.join("|") === `${N}|\x01|\r` && b.submitted.length === 1 && b.submitted[0] === N
		b = box(f, ["yes "]); r = wk.typeAndProve(() => b.read(), (t) => b.send(t), N, fast)
		legs[`drawn${form}WordsInFrontKeepTheirEnter`] = r.taken === false && !b.keys.includes("\r") && b.submitted.length === 0
		legs[`drawn${form}WordsInFrontAreSeen`] = r.mixed === true
		// the field's state: a bell left in the box. Read as the bus's own, then erased - the watcher's path in wakeAgent
		b = box(f, wrapAt(N, 80))
		const seen = b.read(), e = own(seen) ? wk.eraseOwn(() => b.read(), (t) => b.send(t), (t, s) => !!wk.busText(t, { hidden: wk.mayHide(s) }), { pressMs: 1, answerMs: 0 }) : { erased: false }
		legs[`drawn${form}LeftBellIsErased`] = own(seen) && e.erased === true && b.lines.length === 0 && b.read().ok === true
		// words a person typed in front of a bell left there: never erased, never sent
		b = box(f, wrapAt(`please keep this line, it is mine. ${N}`, 80))
		const seenW = b.read(), eW = own(seenW) ? wk.eraseOwn(() => b.read(), (t) => b.send(t), (t, s) => !!wk.busText(t, { hidden: wk.mayHide(s) }), { pressMs: 1, answerMs: 0 }) : { erased: false }
		legs[`drawn${form}WordsAboveABellAreKept`] = eW.erased !== true && b.lines.join("").startsWith("please keep this line, it is mine.") && b.submitted.length === 0
	}
	// ── what the fix must not accept ──
	const R = "─".repeat(W), scr = (...l) => l.map((x) => x + "\r").join("\n")
	const noBox = (r) => r.ok === false && !r.typed
	// a scroll hint outside a rule - a menu's, a list's - over a text row and a rule: no box
	legs.narrowArrowOutsideARule = noBox(read(scr("out", "  ↑ 3 more", "  some text of a menu", R)))
	// the down arrow on the TOP edge, over a `❯` row: no box; the up arrow as the LOWER edge: no lower edge
	legs.narrowDownArrowIsNoTop = noBox(read(scr("out", `─── ↓ 4 more ${"─".repeat(70)}`, "❯ hello there", R)))
	legs.narrowUpArrowIsNoBottom = noBox(read(scr("out", `─── ↑ 4 more ${"─".repeat(70)}`, "  hello there", `─── ↑ 2 more ${"─".repeat(70)}`)))
	// an edge that says lines are hidden above is never an empty box: a blank row, a dim row
	const blankUnder = read(scr("out", `─── ↑ 2 more ${"─".repeat(70)}`, "  ", R)), dimUnder = read(scr("out", `─── ↑ 2 more ${"─".repeat(70)}`, "\x1b[22;2mTry \"x\"\x1b[22m", R))
	// (the property only - not at rest; a reader that sees no box at all holds it too, and is no box's reader to redden here)
	legs.narrowHiddenIsNeverEmpty = blankUnder.ok === false && dimUnder.ok === false
	// fewer than 3 rows under an edge that says lines are hidden: still a box that hides its start
	const two = read(scr("out", `─── ↑ 5 more ${"─".repeat(70)}`, "  the end of a long", "  text, two rows of it", R))
	legs.narrowTwoRowsUnderAnArrowMayHide = two.typed === true && two.rows === 2 && two.hiddenAbove === 5 && wk.mayHide(two)
	// the cursor on the first cell of the first row SHOWN, with lines above it: that cell is not the start (Ctrl+A on a text with a
	// newline goes to the start of ITS line)
	const midStart = read(scr("out", `─── ↑ 2 more ${"─".repeat(70)}`, "  second line of a draft", "  and its third", "  and a fourth", R) + "\x1b[?25h\x1b[3;3H\x1b[?12h\n")
	legs.narrowCursorUnderAnArrowIsNoStart = midStart.typed === true && midStart.hiddenAbove === 2 && midStart.cursorAtStart === false
	// a named session's title after the count, as 2.1.330 draws it, and a bare old title: both top edges
	const titled = read(scr("out", `─── ↑ 4 more ${"─".repeat(40)} my-agent ─`, "  the end of it", "  two", "  three", R))
	legs.narrowTitleAfterTheCount = titled.typed === true && titled.hiddenAbove === 4
	// AT COLUMN 0 ONLY (the review of #more-edge): a 2.1.330 capture pasted into a person's draft, the box showing all it holds - the
	// indented edge is their text, not the box's, and nothing in it is the bus's; and quoted above a bash prompt (`!`, no `❯`): no box
	const draft = read(scr("out", R, "❯ look at this screen, the bell stayed:", `  ─── ↑ 4 more ${"─".repeat(40)}`, "  boundary, which may not be this one. If you", "  need to know whether it is still waiting, `comm", "  inbox` tells you and consumes nothing.", R))
	legs.narrowIndentedEdgeIsText = draft.typed === true && draft.hiddenAbove === undefined && /^look at this screen/.test(draft.text) && !own(draft)
	legs.narrowIndentedEdgeOverABashPromptIsNoBox = noBox(read(scr("out", `  ─── ↑ 4 more ${"─".repeat(40)}`, "  inbox` tells you and consumes nothing.", R, "! git push origin main", R)))
	// an edge that says lines are hidden BELOW is never an empty box either: a blank row, a dim one over it
	const dBlank = read(scr("out", R, "❯ ", `─── ↓ 2 more ${"─".repeat(70)}`)), dDim = read(scr("out", R, "❯ \x1b[22;2mTry \"x\"\x1b[22m", `─── ↓ 2 more ${"─".repeat(70)}`))
	legs.narrowHiddenBelowIsNeverEmpty = dBlank.ok === false && dDim.ok === false
	// an edge is a rule to its end: words after the dashes, or no rule left of the arrow, are no edge
	legs.narrowEdgeEndsInARule = noBox(read(scr("out", `─── ↑ 4 more ${"─".repeat(30)} and some words`, "  the end of it", "  two", "  three", R)))
	legs.narrowRuleLeftOfTheArrow = noBox(read(scr("out", `↑ 4 more ${"─".repeat(70)}`, "  the end of it", "  two", "  three", R)))
	// one row under a `↑`, one hidden line, a title with a space: each the count, each `mayHide`, the cursor at a first cell no start
	const one = read(scr("out", `─── ↑ 3 more ${"─".repeat(70)}`, "  the last row of a long text", R))
	legs.narrowOneRowUnderAnArrow = one.typed === true && one.rows === 1 && one.hiddenAbove === 3 && wk.mayHide(one)
	const oneHid = read(scr("out", `─── ↑ 1 more ${"─".repeat(70)}`, "  second line", "  third line", R) + "\x1b[?25h\x1b[3;3H\x1b[?12h\n")
	legs.narrowOneHiddenLine = oneHid.hiddenAbove === 1 && wk.mayHide(oneHid) && oneHid.cursorAtStart === false
	const spaced = read(scr("out", `─── ↑ 4 more ${"─".repeat(30)} my agent ─`, "  the end of it", "  two", "  three", R))
	legs.narrowTitleWithASpace = spaced.typed === true && spaced.hiddenAbove === 4
	// under a `↑`, a reading that READS like the start is not it: no `startOf` (the cursor not counted - a window not on the alternate screen)
	const like = wk.promptAtRest(scr("out", `─── ↑ 1 more ${"─".repeat(70)}`, ...wrapAt(N, 80).slice(0, 3).map((x) => "  " + x), R))
	legs.narrowNoStartUnderAnArrow = like.typed === true && like.hiddenAbove === 1 && !wk.startOf(like, N)
	// THE ENTER ALONE never on a box whose END an edge says is hidden - beside its control, the same whole bell, its end in view
	const enterAlone = (lower) => { const root = mkdtempSync(join(tmpdir(), "comm-edge-legs-")), keys = []
		try {
			const screen = () => keys.includes("\r") ? { ok: true } : read(scr("out", R, "❯ " + N.slice(0, 160), "  " + N.slice(160), lower))
			const r = wk.wakeAgent(root, "e", 6128, { wins: [{ sock: "/tmp/kitty-edge-legs", id: 128, shellPid: 1, fg: [6128] }], turn: { state: "idle", why: "a128" },
				sendText: (_w, t) => { keys.push(t); return { status: 0, stderr: "" } }, screen })
			return { r, keys }
		} finally { rmSync(root, { recursive: true, force: true }) } }
	const hiddenEnd = enterAlone(`─── ↓ 2 more ${"─".repeat(70)}`), endInView = enterAlone(R)
	legs.narrowNoEnterAloneOverAHiddenEnd = !hiddenEnd.keys.includes("\r") && hiddenEnd.r.sent === false && endInView.r.resubmitted === true && endInView.keys.join("") === "\r"
	return legs
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
	const wk = await import(pathToFileURL(resolve(process.argv[2] || new URL("../bin/wake.mjs", import.meta.url).pathname)).href)
	let legs
	try { legs = edgeLegs(wk) } catch (e) { console.log(`THREW: ${e.message}`); process.exit(2) }
	for (const [k, v] of Object.entries(legs)) console.log(`${v ? "✓" : "✗"} ${k}`)
	process.exit(Object.values(legs).every(Boolean) ? 0 : 1)
}
