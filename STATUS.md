# STATUS — claude-comm, 2026-09-20 (sessions 4–21)

Design and gates are in `README.md`; **this file is only what is OPEN.** Keep it short — when it grows,
fold the settled parts into the README.

## ▶ NEXT

*(Closed 2026-09-20. Field = getajob; `work` dormant by the owner's word (`FIELDS.json`); **`lucia` installed 09-20 at
his request** - leader-only roster, never launched. `moneyMaker`'s leader not relaunched since 09-19.)*

**A - FIRST: `review/REVIEW-13.md`.** Revue #13 **LANCÉE 2026-09-20 ~04:05Z** (opus-5, effort haut, fenêtre à part)
contre `7d3e2a2..HEAD`; brief = `BRIEF-adversarial-13.md`. Elle ferme sa propre fenêtre et sonne le bus — **sa
sonnette attend dans l'inbox**. 🔴 **Si le fichier n'est pas là, la session est morte avant d'écrire : vérifie
`comm who` et le ledger AVANT de supposer qu'elle a tourné.** Un rouge ⇒ fix, bras, mutation, `.2`, réinstaller les
**SIX** arbres (lucia est nouveau). Les deux angles où je me savais faible, et qu'elle doit trancher : ai-je RÉPARÉ
les bacs de `handoff/restart --prove-red` ou FAIT TAIRE neuf bras ; et d'autres bras ont-ils la forme « mutation
masquée par une garde frère » que j'ai trouvée sur D2.

**A2 - la moitié de `review/REVIEW-12b.md` NON disposée.** Son ROUGE est corrigé, armé, publié : `2026-09-20.1`
(print `202409de44fc`), `--check`-vert dans les **six** arbres. 🔴 **`FINDINGS.md#review12b` liste les sept points
portés avec leur numéro de section — §2 la date `dormant-awake` étant celui qui paie les acks. Chacun est DÉJÀ
MESURÉ dans le rapport : prends la mesure, ne la re-dérive jamais.**

**B - `boot.mjs --hook` records with NO ownership test at all** (`boot.mjs:489`; the stub now has one). **Mesuré
pourquoi il ne peut pas simplement adopter `witnessStart` :** ses propres `--prove-red` tirent `--hook --root
<fixture>` depuis une chaîne dont l'ancêtre `claude` est la session de l'opérateur — donc ÉTRANGERS par
construction, et ses propres bras rougiraient. Il lui faut d'abord une couture de test déclarée. La prose de
`CLAUDE.md` + `review/CLAUDE.md` est la seule garde aujourd'hui.

**C - l'audit fantôme, une requête, non construite :** un start enregistré dont le `session` ne correspond à aucun
transcript sous `~/.claude/projects/` est un candidat. Base de référence sur cinq arbres : **4 non appariés, tous
≥ une semaine avant le correctif**. **Tout start non apparié daté après 2026-09-19 est un vrai candidat.**

**D - moneyMaker: adoption MESURÉE sur son transcript** (`7c449631`, 09-19, build pré-revue), en parsant les APPELS
D'OUTIL, jamais grep - le texte des skills nomme chaque commande, donc un grep compte la documentation (le reviewer
y est tombé une fois). **Introduction reçue 1× ; `Skill` : `leader-expert` + `claude-in-chrome`, PAS `claude-comm` ;
`comm.mjs inbox` 2×, spontané.** Donc la réponse au propriétaire est plus nette que « skill oui » : *il n'a jamais
chargé la skill et s'est quand même servi du bus - c'est l'INTRODUCTION qui a produit ces deux appels.* Suite depuis
`./-home-leonh-Dev-moneyMaker*/` (préfixe `./` : les dossiers commencent par `-`) quand il aura des experts.

**D2 - the MID-TURN channel EXISTS, measured with its control** (`FINDINGS.md#midturn-channel`): a `PostToolUse`
hook's `hookSpecificOutput.additionalContext` **reaches the model at the tool result**; stderr never does. Asked by
getajob's leader with a price (a brief marked AVANT read an hour late, 5 real dispatches waited). 🔴 **Transport is
not the open half - whether an agent ACTS on it is unmeasured, and `selftest` has the agent ignoring what it is
pointed at in 5 of 8 runs.** Build `--kind blocked` on it only with their FIELD count, never my bench.

**E - two AMENDMENTS demanded** (3 acks each): `field:getajob@stranded-untold:extension` et le canal, réglé 09-20.
🟢 **L'ÉVIDENCE EST ARRIVÉE et c'est elle qui bloquait :** leur leader l'écrit — *« `extension` n'a pas de travail
aujourd'hui. Il attend EXPRÈS »*, *« rien n'attend de réponse »*
(`exchange/getajob-leader/in/2026-09-19-recu-...-volontairement.md`). **La ligne gate donc sur une décision qui est
la leur et qui est juste.** L'amendement de 09-18 a déjà mis les opérations du pair en montré-non-gaté ;
`stranded-untold` gatait encore parce que le BUS avait mal informé l'envoyeur. Conçois-le avec un bras (que mesure
la ligne maintenant ?) ou supprime la cause. `FINDINGS.md#peer-state`.

**✅ CLOSED 09-20:** T1's root half, measured on this session — `FINDINGS.md#t1-root-half`.

**Carried:** A2 (a marker written when the bus RAN, not when it SHOWED - §3(c) is a second reach to it) · the
installer overwrites a `SKILL.md` it did not generate · every other stderr line of the stub reaches no model · S6 ·
getajob's `rings.jsonl` read (A62, A65) · #9 A3 · C7 · `who`'s 3rd/4th states · the restart trigger (ledger UNKNOWN) ·
C3. **Later, owner's order:** adoption (measure D) → Rust port → value, with getajob's leader.

## Where it stands

| | state |
| --- | --- |
| toolkit | `bin/comm.mjs` · `session-registry.mjs` · `ledger.mjs` · `restart-signal.mjs` · `claim.mjs` · `wake.mjs` · `exchange-bell.mjs` · `context.mjs` · `handoff.mjs` · `restart.mjs` · `launch.mjs` · `close.mjs` · `boot.mjs` · `install.mjs` · `test/` — no dependencies |
| repo | `origin` = `Leonhart130/claude-comm`. **The push is the leader's call**, delegated 2026-09-05, along with installing into field trees — do not ask again |
| **electio** | in real daily use — 26 real deliveries, both directions |
| gates | `attack` (deterministic, every case armed) · `ledger --prove-red`, now run INSIDE it · `selftest` (real sessions, not gated by boot) · `context` and `boot` controls. **Counts live in boot's output, never here** |
| boot | `node bin/boot.mjs` — every gating row armed; `--fast` is injected at session start, contract in `CLAUDE.md` |
| **ledger** | `node bin/ledger.mjs` — the reboot instrument, here AND in the field (`--root <tree>`); arms run inside `attack` as A34. Each start stores `pending`, the peer's covariate — **never inbox depth**: session #41 had an empty mailbox and the largest real queue of its last five boots. **Counts live in boot's output, never here** |
| **sensor** | `node bin/context.mjs` — pid → transcript through `bin/session-registry.mjs` (the `SessionStart` hook writes it, keyed on pid + start time + boot id); **refuses on a miss**. `FINDINGS.md#clear-blind` |
| reviews | #1–#12 **dispositioned**; **#12b disposed 2026-09-20** (its red + D2), seven points carried — `FINDINGS.md#review12b`. **#13 IS IN FLIGHT.** #5's amendment stands in `CLAUDE.md`: *a gate that CAN redden is not yet one that reddens for the property in its own title* — **#12b was its seventh instance, inside an arm the previous disposition had just written** |

## ⏭️ OPEN
1. **🔴 Latency is a mailbox, not an interrupt.** Re-derive with `node test/latency.mjs <log>`; never
   transcribe the table. 26 deliveries: leader→expert median **1462 s**, expert→leader **586 s** — mail
   lands at the recipient's *turn boundary*, so **an agent alive but idle never receives it** and `who`
   saying "running" does not mean reachable. Never call this bus real-time. A16; `HISTORY.md`.

2. **`--reply-to <id>` (threading).** Field-requested, then field-deprioritised: the substance lives in the
   file.

3. ✅ **The wake is BUILT** (`bin/wake.mjs`, A32); 09-11 its TEXT was rewritten — it gave a conduct order in
   the owner's own channel and promised a delivery it cannot keep (`FINDINGS.md#doorbell-text`). 🔴 Item 1's
   table predates it. ⚠️ A wake inside `QUIET_MS` rings nobody and nothing catches up — it prints
   `○ rung 104s ago`, which reads like success.

4. **🟢 Holding a machine resource — `bin/claim.mjs`, IN PRODUCTION**, 17 arms, A38, three field trees. It
   advises: opens nothing, kills nothing, blocks nothing. `release` refuses while the holder LIVES, and the record
   cannot tell a crash from a forgotten release. Claims live in ONE project, so a resource shared ACROSS projects is
   visible to nobody. `FINDINGS.md#claim-file`. ⭐ Their verdict, accepted as the scope: *a claim makes sharing
   visible; the first answer is not to share.*

5. **🟡 `who` reports TWO states and there are FOUR.** A leader lost **2 h 30** reading `running` for four
   sessions sitting at their prompt. ✅ `context.mjs --sessions` prints `quiet <age>` — a MEASUREMENT, never
   "at prompt". 🟢 Third: a session that has taken **no turn has no transcript at all**
   (`FINDINGS.md#no-turn-yet`) — and `launch.mjs --prompt` now stops manufacturing them. 🟢 Fourth, measured
   by the field 09-11: **CPU time separates *working* from *idle*** and `/proc` already carries it; one
   sample each, so no threshold from it. 🔴 All of it belongs in `comm who` and cannot go there — A21 forbids
   the import ⇒ an A21 amendment **and a split — both done 09-11; the states themselves are not built.**

6. **🟢 A reply must NAME what it answers** — `Answers:` in front matter on **line 1**, anchored to the first byte
   so a quotation cannot forge one. Stateless; a failed scan says `CANNOT SAY`. Contract: `exchange/README.md`.
   `FINDINGS.md#answered-mtime`. ⚠️ The row dates letters by FILENAME (C3, carried).

7. **🟢 A program launches an agent, and the agent puts its own window away.** `launch.mjs` (A46) builds the
   child's `PATH`, resolves the runtime absolutely, splits the caller's tab (`--os-window`, `--minimized` with it),
   refuses a launch it cannot name, and `--prompt` gives the new session a first turn. `close.mjs` (A51): an agent
   closes ITSELF, never a sibling. ⚠️ **`--minimized` is UNARMED** — A50 asserts only that the window lands outside
   the caller's tab, and `kitten @ ls` does not report a minimized state, so the honest arm is the `--print` argv.
   `FINDINGS.md#self-close`, `#split-raised-the-cap`.

8. **🟡 The autonomy mandate — self-launching experts, a self-rebooting leader.** Given 2026-09-04; settled
   parts in [`DESIGN-autonomy.md`](DESIGN-autonomy.md), **do not re-derive them here.** The finding that
   shapes it: the consumer's defects are **BOOT defects, not crowding defects**. 🟢 **2026-09-11 the leader
   launched, briefed and was reviewed by its own expert** — first full exercise. 🔴 **Open: a REAL restart
   arming the arm, and the trigger — ▶ NEXT 7.**

**Carried forward, still open** *(cut from ▶ NEXT 2026-09-08, not retracted)*:
- **ESLint is uncovered.** A43 stops a configured *prettier* rewriting our generated files; ESLint is the
  same shape, unarmed. `FINDINGS.md#generated-in-their-tree`.
- **The 15-minute window is untested and my own timestamps are why:** each defect is dated at its commit,
  the upper bound. Not a result.
- **The restart TTL lapsed on a human TWICE, then 3 acks on 09-13 — now ▶ NEXT A.** Try armer-gone AND not
  ancient, TTL as a backstop — `claim.mjs` already ships the (pid, start, boot) test. Not built.
- **Test debt from review #4, none of it gated:** `FINDINGS.md#test-debt`.
- **`#A20` from 2026-09-04 is still unexplained** (the 09-05 instance was fixed, `#update-signal`).
  **Run gates unfiltered.**
- **The erosion counter WAS discharged** 2026-09-08 (`from: 9`, review #8 D3). 🟢 Its design flaw — one row,
  several causes — was fixed 09-10; the stale "▶ NEXT 4" pointer here was cut 09-11, not retracted.

## ⚠️ What was NOT verified

🔴 **Moved 2026-09-20 to [`FINDINGS.md#not-verified`](FINDINGS.md#not-verified)** — tier 0 is capped in BYTES and
this register is long, stable and re-read every boot. **It did not shrink and nothing was retracted.** Read it
before claiming anything about `close.mjs` under a real agent, the registry's `GONE` wording, `--release`,
`clear`-blindness, the git guard, the crossing, `selftest`'s behaviour half, or anything non-Linux.

## Two conventions that erode silently

**Measurement traps** — a control not travelling the arms' code validates nothing; one that writes into, or
INHERITS, the world it measures is not a control. **Ten instances.** `FINDINGS.md#measurement-traps`.

**Acknowledgements amend the protocol** — `FINDINGS.md#ack-amendment`. First discharge 2026-09-08.
🟢 **A21 was amended this way on 2026-09-11**, on evidence: `FINDINGS.md#bus-split`.

**Conduct defects go in `LESSONS.md`** — *a lesson ends as an armed gate or it is a platitude.*

**Findings live in the code**, at the point they apply — *a rule whose cost you cannot see is a rule someone
will simplify away.*
