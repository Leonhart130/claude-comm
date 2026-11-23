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
	// ── A BOX OF LOGICAL LINES (the second review of #more-edge: its model, taken whole) ──
	// Ctrl+E ends ONE logical line, Ctrl+A starts one, Ctrl+U takes from the cursor's row start to the cursor; the view keeps the
	// cursor's row in the middle, clamped (2.1.330's `getViewportStartLine`, read in its binary by the review). A model, not a capture:
	// it carries what the real screens above cannot, a cursor inside a text of several lines. `looks`: the watcher's looks, one after another.
	const LW = 60
	const lineBox = ({ text, off, width = 56, cap = 3, alt = true }) => {
		const bx = { text, off, keys: [] }
		const rowsOf = () => { const rows = []; let base = 0; for (const l of bx.text.split("\n")) { if (!l.length) rows.push({ s: base, e: base }); for (let i = 0; i < l.length; i += width) rows.push({ s: base + i, e: base + Math.min(l.length, i + width) }); base += l.length + 1 } return rows }
		const curRow = (rows) => { let r = 0; rows.forEach((x, i) => { if (bx.off >= x.s && bx.off <= x.e) r = i }); return r }
		bx.screen = () => {
			if (!bx.text) return ["out", "─".repeat(LW), "❯ \x1b[22;2mTry \"x\"\x1b[22m", "─".repeat(LW)].map((l) => l + "\r").join("\n") + "\x1b[?25h\x1b[3;3H\x1b[?12h\n"
			const rows = rowsOf(), n = rows.length, cr = curRow(rows), c = Math.min(cap, n), start = Math.max(0, Math.min(cr - Math.floor(c / 2), n - c))
			const edge = (arrow, k) => k ? `─── ${arrow} ${k} more ${"─".repeat(LW - 10 - String(k).length)}` : "─".repeat(LW)
			const shown = rows.slice(start, start + c).map((x, i) => (start === 0 && i === 0 ? "❯ " : "  ") + bx.text.slice(x.s, x.e))
			return ["out", edge("↑", start), ...shown, edge("↓", n - start - c)].map((l) => l + "\r").join("\n") + `\x1b[?25h\x1b[${3 + cr - start};${3 + bx.off - rows[cr].s}H\x1b[?12h\n`
		}
		bx.read = () => wk.cursorCounts(wk.promptAtRest(bx.screen()), alt)
		bx.send = (t) => { bx.keys.push(t); const rows = rowsOf(), cr = rows[curRow(rows)], nl = bx.text.indexOf("\n", bx.off), le = nl < 0 ? bx.text.length : nl
			if (t === "\x05") bx.off = le; else if (t === "\x01") bx.off = bx.text.lastIndexOf("\n", bx.off - 1) + 1
			else if (t === "\x15") { bx.text = bx.text.slice(0, cr.s) + bx.text.slice(bx.off); bx.off = cr.s }
			return { status: 0, stderr: "" } }
		return bx
	}
	const looks = (bx, k) => { const out = []; for (let i = 0; i < k; i++) { const r0 = bx.read(); out.push(own(r0) ? wk.eraseOwn(bx.read, bx.send, (t, s) => !!wk.busText(t, { hidden: wk.mayHide(s) }), { pressMs: 1, answerMs: 40 }) : { notOurs: true }) } return out }
	const untouched = (bx, text) => !bx.keys.includes("\x15") && bx.text === text
	// a bell, a blank line, a person's line - the cursor left at the start (a hook killed after its Ctrl+A): look after look, no press
	// and NEVER "stalled" - its Ctrl+E ends the bell's line and the rest stays below (the review's S1; cursor counted and not)
	for (const alt of [true, false]) {
		const t = N + "\n\nmerci, je regarde", bx = lineBox({ text: t, off: 0, alt }), r = looks(bx, 2)
		legs[`lineBellThenWordsNoStall${alt ? "" : "Uncounted"}`] = untouched(bx, t) && r.every((x) => x.erased !== true && !x.stalled)
	}
	// a person's words after the bell on its line, the cursor moved up into the bell: one Ctrl+E, the end read, left alone (S2)
	for (const alt of [true, false]) {
		const t = N + " wait, do not send this yet", bx = lineBox({ text: t, off: 130, alt }), [r] = looks(bx, 1)
		// (split: the property apart from the reading - a reader that saw no box keeps the words too, and must not redden "kept")
		legs[`lineWordsAfterTheBellKept${alt ? "" : "Uncounted"}`] = untouched(bx, t) && r.erased !== true
		legs[`lineWordsAfterTheBellEndReadFirst${alt ? "" : "Uncounted"}`] = bx.keys.join("|") === "\x05"
	}
	// its control: the bell alone, the cursor inside it, not counted - erased (S3)
	{ const bx = lineBox({ text: N, off: 130, alt: false }), [r] = looks(bx, 1); legs.lineBellAloneErased = r.erased === true && bx.text === "" }
	// ONE line hidden below - a person's - and the cursor inside the bell: the end first, no Ctrl+U before it was read
	{ const t = N + "\nmerci", bx = lineBox({ text: t, off: 234 }), first = bx.read(), [r] = looks(bx, 1)
		legs.lineOneHiddenBelowIsReadFirst = first.hiddenBelow === 1 && bx.keys[0] === "\x05" && untouched(bx, t) && r.erased === false }
	// ONE line still hidden after the Ctrl+E (two bells, a newline between - all of it the bus's as far as it shows): left alone, not
	// pressed into an end never read, and not called stalled on the next look either
	{ const t = N + "\n" + N.slice(0, 100), bx = lineBox({ text: t, off: 0 }), r = looks(bx, 2)
		// (and ONE Ctrl+E a look, no more: each one moves the cursor of whoever is writing there)
		legs.lineOneStillHiddenIsLeft = untouched(bx, t) && r.every((x) => x.erased !== true && !x.stalled) && bx.keys.join("|") === "\x05|\x05" }
	// the cursor at the start of a text ALL in view: its Ctrl+E moves only the cursor, and that is its answer - not a stall
	{ const bx = lineBox({ text: N.slice(0, 100), off: 0 }), [r] = looks(bx, 1); legs.lineCursorOnlyAnswerIsNoStall = bx.read().ok === true && r.erased === true && !r.stalled }
	// A COUNT DRAWN A FRAME AFTER ITS ROWS (the second review of #more-edge, its model taken whole): each key lands 150 ms after the one
	// before, and for `gap` ms after it lands the top edge still shows the count from before. A person's line hidden above the bell. The
	// count is no press landed: the line is kept - beside its control, the count drawn with its rows (gap 0).
	// ON A CLOCK THAT READS ADVANCE, `perRead` ms a reading, never the machine's (the third review: on wall time the bad code passed at
	// 60, 120, 160 and 250 ms a read - a loaded machine let it through). Every wait in eraseOwn is Date.now(): stubbed here, for this
	// call only, so the outcome is a function of the readings alone - and run at five costs a read: the bad code (the counts in the
	// comparison) reddens at 20, 30 and 40 ms a read, 3 runs in 3; at 60 and 90 the gap spans under two readings and it passes there.
	const lateCount = (gap, perRead) => {
		const Wd = 56, RR = "─".repeat(70), mine = "please keep this line, it is mine, do not touch it now.."
		const realNow = Date.now
		let clock = realNow.call(Date)
		const lb = { lines: wrapAt(mine + N, Wd), queue: [], lastAt: -1e9, stale: 0 }
		const settle = (now) => { while (lb.queue.length && lb.queue[0].at <= now) { const k = lb.queue.shift(); lb.stale = Math.max(0, lb.lines.length - 3); if (k.t === "\x15") lb.lines.pop(); lb.lastAt = k.at } }
		const screen = () => { clock += perRead; const now = clock; settle(now)
			if (!lb.lines.length) return ["out", RR, "❯ \x1b[22;2mTry \"x\"\x1b[22m", RR].map((l) => l + "\r").join("\n") + "\x1b[?25h\x1b[3;3H\x1b[?12h\n"
			const n = lb.lines.length, up = Math.max(0, n - 3), shown = lb.lines.slice(-3), count = now - lb.lastAt < gap ? lb.stale : up
			const top = count ? `─── ↑ ${count} more ${"─".repeat(56)}` : RR
			return ["out", top, ...shown.map((x, i) => (i === 0 && !count ? "❯ " : "  ") + x), RR].map((l) => l + "\r").join("\n") + `\x1b[?25h\x1b[${2 + shown.length};${3 + shown.at(-1).length}H\x1b[?12h\n` }
		const send = (t) => { const last = lb.queue.length ? lb.queue.at(-1).at : Math.max(clock, lb.lastAt); lb.queue.push({ t, at: Math.max(clock, last) + 150 }); return { status: 0 } }
		Date.now = () => clock
		try { wk.eraseOwn(() => read(screen()), send, (t, s) => !!wk.busText(t, { hidden: wk.mayHide(s) }), { pressMs: 1, answerMs: 120 }) }
		finally { Date.now = realNow }
		settle(clock + 60_000)   // every queued key lands
		return lb.lines.join("").startsWith(mine)
	}
	legs.lateCountFrameTakesNoLine = [20, 30, 40, 60, 90].every((p) => lateCount(100, p) && lateCount(0, p))
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
	// A FLICKER ON THE `↓` PATH (the third review): after its Ctrl+E, one frame shows the cursor at the start (a frame caught mid-render,
	// the twenty-eighth review of #hidden-head), then the box unchanged, then the end. The flicker is no answer: the end is read, judged
	// the bus's, and the look erases - it does not give the look up. By read index, not time.
	{ const dn = `─── ↓ 3 more ${"─".repeat(70)}`, up = `─── ↑ 3 more ${"─".repeat(70)}`
		const before = scr("out", R, "❯ " + N.slice(0, 56), "  " + N.slice(56, 112), "  " + N.slice(112, 168), dn) + "\x1b[?25h\x1b[4;20H\x1b[?12h\n"
		const flickF = before.replace("\x1b[4;20H", "\x1b[3;3H")
		const endv = scr("out", up, "  " + N.slice(168, 224), "  " + N.slice(224, 280), "  " + N.slice(280), R) + `\x1b[?25h\x1b[5;${3 + N.slice(280).length}H\x1b[?12h\n`
		const empty = scr("out", R, "❯ ", R) + "\x1b[?25h\x1b[3;3H\x1b[?12h\n"
		const keys = []; let after = 0
		const e = wk.eraseOwn(() => keys.includes("\x15") ? read(empty) : !keys.length ? read(before) : read(++after === 1 ? flickF : after === 2 ? before : endv),
			(t) => { keys.push(t); return { status: 0, stderr: "" } }, (t, st) => !!wk.busText(t, { hidden: wk.mayHide(st) }), { pressMs: 1, answerMs: 200 })
		legs.lineFlickerIsNoAnswer = e.erased === true && keys[0] === "\x05" && keys.includes("\x15") }
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
