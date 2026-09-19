# claude-comm — what changed, for the agent using it

Each entry names the **bus print** it was written for: a hash of the files this installer actually ships.
That is what makes the label honest — if the bus changes and nobody writes a note, the installer says so
instead of going on quoting a label that no longer describes the bytes.

You are reading the *shipped* surface only: the bus, the instruments that travel with it, and the hook stub
your project runs. Changes to the leader's own tools (`boot.mjs`, `context.mjs`, the gate) are not here,
because nothing in your project runs them.

```
node <path-to-claude-comm>/install.mjs <your project>            # install or update — safe to re-run
node <path-to-claude-comm>/install.mjs <your project> --check    # what version do I have, is it current?
```

Your project records what it has in `.comm/INSTALLED.json`. An update prints only the entries you did not
already have.

























## 2026-09-19.1 — bus print `56313a156871` — 2026-09-19

- **`inbox` prints each message's id as the command that clears exactly that message:** `dismiss <agent> --id <id>`.
  The closing hint no longer offers the bare `dismiss <agent>`, which cleared the whole queue, including mail that
  arrived while you read (requested by getajob's leader). An id not in the bus's own shape is never printed as a
  command.
- **`inbox` and `dismiss` take an agent NAME from `.comm/config.json`, never a path.** `dismiss ../.. --force` used to
  move files out of your project root. Mail left for an agent you took off the roster can still be cleared by that
  agent's name, but only if its inbox is a real directory, never a link.
- **`send` records in the message whether the recipient was running.** That tells apart mail whose sender was warned
  it would wait for a relaunch from mail nobody was warned about.
- **A restart note now names the session that armed it.** If that session has ended and went quiet within the
  promised time, the relaunch counts as a restart even after the note's clock ran out. This only ever adds restarts.
  Only a fresh start (`startup`, `/clear`) takes a note: a compaction or a `--resume` leaves it for the real
  relaunch. If a start takes a note and then fails to record itself, the note is put back.
- **The ledger counts one start per session**, even if two recorders wrote it.
- **The installer writes each bus file after the files it imports.** Before, a session starting mid-install could
  load a new `ledger.mjs` beside an old `restart-signal.mjs`, fail to load it, and lose that start's record.
- **Nothing to do on your side.** A note armed before this release names no session and is judged by the clock,
  as before.

## 2026-09-13.8 — bus print `69ba247a5e08` — 2026-09-13

- **`wake --dry-run` now shows the fresh-restart decision for every agent in `freshRestart`, mail or not.** Before, it
  was computed only for agents with mail waiting, so right after opting agents in, a dry run said `nothing is waiting`
  and showed nothing to check (reported by getajob's leader). Each listed agent now gets a line: `would restart it
  fresh first — …`, its reason for not, `not running`, or `not on the roster in .comm/config.json` — a misspelt name
  used to opt in nobody, silently. A real run is unchanged. `--json` adds a `fresh` array on a dry run.
- Nothing to do on your side; nothing is typed by a dry run.

## 2026-09-13.7 — bus print `4e9e87ce8f87` — 2026-09-13

- 🔴 **Mail that arrives while you answer a notice is now delivered in the same turn end.** Until now, once a turn end
  had shown you mail, the next turn end of that same turn delivered nothing: mail queued in between waited for a
  doorbell at rest — measured over four trees, 49 times in 258, median 150 s, up to 10.5 hours. Now that continuation
  may show you the new mail too, up to 3 times per turn end; past that, the old wait resumes.
- Nothing to do on your side. The count lives in `.comm/stop/<agent>.json` (per session; gitignored with `.comm/`).
- ⚠️ If the count cannot be read or written, the hook behaves exactly as before — never a loop.

## 2026-09-13.6 — bus print `f7c3807cc42e` — 2026-09-13

- 🔴 **Opt-in: an idle expert whose cache has expired is restarted fresh before its doorbell.** Name the agents that
  may be cleared at the top of `.comm/config.json`: `"freshRestart": ["cv", "web"]`. When mail waits for one of them,
  it is at rest, its last API call is **over 60 min** old (the 1 h prompt cache has expired) and its context is **at
  least 300 000 tokens**, `wake` types `/clear` into its window, confirms it (the session registry names a new
  transcript for the same process), then rings. The process is kept: model, effort and window survive, and the
  waiting mail is handed to the fresh session as it starts.
- 🔴 **A leader is never cleared, even if the list names it** — the `leader` of `config.json`, or the agent at `"."`.
- ⚠️ **A clear drops everything the agent has not written down.** Opt an agent in only if it rebuilds from its files.
- ⚠️ **`/clear` is typed into the agent's input line, like the doorbell.** Measured: a half-typed `hello` went out as
  the prompt `hello/clear`. When a clear is not confirmed and the agent is now working, no doorbell goes on top.
- After a clear the doorbell says so: *the bus restarted this session fresh because it had been idle past its cache
  lifetime*. No instruction, as before.
- Not in the list, or anything but a list of names: nothing changes. `wake --dry-run` says `would restart it fresh
  first (…)` or `no fresh restart: …` for an opted-in agent.
- At most one clear per `wake` run; the next waits for the cleared agent's own turn end.
- **Every ring is now appended to `.comm/wake/rings.jsonl`** — who was rung, cleared or not, and the command line
  that spawned the ring, Stop hooks included. Before, one record per agent was overwritten by whoever rang.

## 2026-09-13.5 — bus print `65d515a66082` — 2026-09-13

- 🔴 **The doorbell no longer lands inside a turn you are working on.** `wake` reads the target session's
  transcript through the session registry and rings only a session at rest, or one whose reply has just ended.
  A working session is skipped — `○ <agent>: mid-turn, not rung (last transcript row: …)` — and no ring is
  recorded, so the next hook that fires looks again. Before: 18 of 35 doorbells in one field day arrived as
  "sent a new message while you were working".
- Nothing to do on your side. Your mail still arrives at your turn end; over 107 measured mid-turn doorbells,
  skipping them would not have delayed one delivery.
- ⚠️ When the registry cannot answer for a session, `wake` rings as before and says `turn state unknown`.
- ⚠️ Still true: a `Stop` continuation delivers nothing, so mail that arrives while your turn is already
  continuing waits for the next ring at rest.
- `wake --resolve <pid>` also prints that session's turn state.

## 2026-09-13.4 — bus print `0d8b32a0d9fa` — 2026-09-13

- 🔴 **A flag a command does not know now REFUSES instead of acting on everything.** `comm dismiss --help` used to
  acknowledge your whole inbox, and so did `dismiss --idd x` (a typo of `--id`); `send --notte x` dropped the note.
  Now an unknown flag exits 2, does nothing, and lists the flags that command takes; `--help` / `-h` print the
  usage and do nothing. A value after a flag that takes one (`--note "-text"`) is still a value.
- **What "pending" means, measured in the field:** NOT acknowledged — not "not seen". The hook acknowledges at a
  turn end and `comm inbox` peeks without acknowledging, so an agent can read its brief and still show pending
  for minutes. To know whether an expert has taken a brief, read its transcript, or `comm sent`.
- ⚠️ **A wake typed into a session that is mid-turn lands INSIDE that turn** (18 times in one day in one field).
  `wake` cannot yet tell a busy session from an idle one.

## 2026-09-13.3 — bus print `f13141851068` — 2026-09-13

- 🔴 **Mail beyond 8 at one turn end is no longer acknowledged unseen.** A notice shows at most 8 messages, and
  it used to drain ALL waiting mail anyway — measured: 100 waiting, 8 shown, 92 acknowledged and logged as
  delivered, and `comm inbox` then answered `empty`. Now only what the notice shows is acknowledged; the rest
  stay in your inbox, the notice says `…and N more NOT acknowledged: node .comm/bin/comm.mjs inbox`, and your
  next turn end delivers them.
- ⚠️ A `Stop` continuation still delivers nothing: if you go idle right after reading 8, the rest wait for your
  next real turn — `comm inbox` and the wake both see them.
- Measured with a leader, 5 experts and 50 000 messages of history: delivery stays ~41 ms, `send` grows to
  ~140 ms, 100 sends fired at once all land. Nothing needs archiving.

## 2026-09-13.2 — bus print `eea9bf6ff98e` — 2026-09-13

- 🔴 **`close.mjs` now really refuses to close over a claim you still hold.** That refusal had never run: it
  read `claim list --json` as an array, threw, and swallowed it. It now blocks on a claim held by your session
  or recorded under your agent name, and **a claim list it cannot read is a block too** — "could not read the
  claims" is not "none held". Release the claim, or `--force` (still recorded as forced).
- **The close record `.comm/close/<agent>.json` has a third value.** `gone: true` the window closed, `false`
  it is still there, and now `null` with `could_not_look: "<why>"` when the probe could not ask kitty — it used
  to write `true` for that. Probe exit 0 / 1 / 2. Treat `null` as unknown, never as closed.
- ⚠️ Not covered: a kitty socket path that never existed still reads as gone. Only a caller bug produces one.

## 2026-09-13.1 — bus print `f8e8b56deb97` — 2026-09-13

- 🔴 **`launch.mjs` now REQUIRES `--model` and `--effort`, and refuses without them.** Until today it passed
  neither, so every expert inherited the machine's tier — on the box this was built on, Opus at `xhigh`,
  chosen by nobody. Type: `node .comm/bin/launch.mjs <agent> --model <model> --effort <level> --prompt "<first turn>"`.
  `--model`: `opus` · `sonnet` · `haiku` · `fable`, or a full id such as `claude-sonnet-5`. `--effort`: `low` ·
  `medium` · `high` · `xhigh` · `max`. A flag-shaped or unknown value is refused, never passed through.
- `--print` shows the `model` and `effort` it would launch with — check a launch before you make it.
- **Choose for the task, not for the agent.** There is no default anywhere, `config.json` included. The first
  rule of choice, from the `getajob` field, is in `.comm/README.md` — an indication from one session, not a measurement.
- Verified where it lands: a session launched this way records `"model"` and `"effort"` in its own transcript.
  That transcript, not the launcher's output, is what it actually ran on.
- `restart.mjs prepare` prints the relaunch line with the tier in it.

## 2026-09-11.7 — bus print `cf5efbcf46c5` — 2026-09-11

*Two fixes from an adversarial review, and one of them is a trap you would have walked into.*

- 🔴 **`launch.mjs --prompt "- do the thing"` is now REFUSED, and that is a feature.** A prompt beginning
  with `-` reaches `claude` as a FLAG — `-p` is print mode, so the session answers once and exits, which is
  exactly the "takes no turn" failure `--prompt` exists to prevent. **The realistic trigger is not an attack,
  it is a markdown bullet**: composing a first turn from your notes as `"- read X first"`. Drop the leading
  `- ` and it launches normally.
- 🟢 **The launcher names the kitty instance it is talking to** (`--to`), instead of trusting the ambient
  `$KITTY_LISTEN_ON` while having resolved your window across every socket. It was the only kitty call in
  the bus without one.
- 🟢 **`--print` now shows the argv that actually runs**, placement flags included. It used to print one
  thing and launch another, which is the whole failure mode `--print` exists to rule out.

## 2026-09-11.6 — bus print `54ced6770f52` — 2026-09-11

*A broken bus can no longer break your turn, and a launched expert lands beside YOU.*

- 🔴 **A HALF-INSTALLED BUS USED TO BREAK EVERY TURN.** `comm.mjs` imports `who.mjs` since the split, and
  the installer wrote them in the wrong order — so an interrupted update left a bus that could not load, and
  the hook **exited 1 with a Node stack trace at every turn boundary**. The rule here has always been that a
  broken bus must never break a session; it now holds. The hook exits 0, **your mail is untouched**, and it
  prints one line telling you the bus could not run and to re-run the installer.
  ⚠️ There were TWO exit paths and the first fix caught only one. The `Stop` path — the one that runs at
  every turn boundary — was the one still breaking.
- 🟢 **The installer writes dependencies before dependents**, so that state is no longer reachable through
  an ordinary update rather than merely survivable.
- 🟢 **`launch.mjs` now splits the tab YOU are in.** `kitten @ launch` targets whichever tab is ACTIVE, so a
  window opened by something else could take your expert with it — measured: a split from tab 1 landed in
  tab 65. **The window was created, the id returned, the mark set; only the placement was wrong**, which is
  the whole reason the split exists.
- ⚠️ **If you run the controls yourself:** `test/attack.mjs` now drives real kitty windows, and
  `boot.mjs --prove-red` runs `attack.mjs` inside its own copies. **Do not start both at once** — they
  collide over windows and the result is a flake, not a finding.

## 2026-09-11.5 — bus print `dd26637a4001` — 2026-09-11

*The bus is now TWO files, and a `--ref` that is not a regular file can no longer hang your turn.*

- 🔴 **BUG, shipped this morning and fixed within the hour: a `--ref` naming a FIFO HUNG the Stop hook
  forever.** The new delivery-size line reads any ref under 1 MB to count its lines, and a FIFO reports size
  0, so it was always read — and `readFileSync` on a FIFO blocks. **Every turn boundary after it would have
  hung, permanently.** A ref that is not a regular file is now reported as one, never read.
- 🟢 **`bin/who.mjs` — liveness moved out of `bin/comm.mjs`.** Nothing you run changes: `comm who` is
  byte-identical in behaviour. **But `install.mjs` now ships one more file, and anything of yours that
  copies `comm.mjs` ALONE will stop working** — copy the whole `.comm/bin/` directory, or re-run the
  installer, which is what it is for.
- ⚠️ Why it moved: the bus hit its size cap, and the gate that caps it says *"split it"* while the gate that
  keeps it a short-lived process forbade importing a sibling. **Both gates were right.** The import rule now
  allows a relative import of a bus file and checks every bus file by the same rules, so a daemon still
  cannot hide in one — proved by putting one there and watching it redden.

## 2026-09-11.4 — bus print `2b40c49595e2` — 2026-09-11

*`launch.mjs --print` now warns about a missing first turn, like the real launch already did.*

- 🟢 **`--print` is the mode you use to CHECK a launch before making it, and it was the only mode that did
  not tell you the session would take no turn.** It does now, and it stays silent when you did pass a
  `--prompt`. Reported by the `getajob` leader within an hour of installing.

## 2026-09-11.3 — bus print `fdb5b70f43b4` — 2026-09-11

*The delivery notice now tells you how big the file is that the note is standing in front of.*

- 🔴 **A GOOD NOTE MAKES YOU SKIP THE FILE, and that is measured, not theorised.** A field leader closed an
  expert's round citing a 240-character note without opening the report; **the file's next sentence reversed
  his decision.** Twice in three hours, and his owner spotted it both times. ⭐ His formulation:
  *a faithful summary placed in front of a source does not save time — it makes the source disappear, and
  the better the summary, the more completely.*
- 🟢 **So the notice now sizes what you are not reading**, on the line you were already going to read:

  ```
      read: docs/RAPPORT.md   (relative to you) — 488 lines, 10.4 KB, written just now
      sender's note (103 chars, NOT the artifact): "12 of 64 controls ran on PRODUCTION …"
  ```

  **Nothing is forbidden and nothing is stored.** The gap is simply in front of you at the moment you decide.
- ⚠️ **A ref that cannot be read says so** — `COULD NOT BE READ (ENOENT) — which is not the same as empty` —
  and the message is still delivered and still drained. Silence there would render exactly like a small file.

## 2026-09-11.2 — bus print `bd50f8f4b3c7` — 2026-09-11

*The doorbell stops telling you what to do, and a launched agent can be given its first turn.*

- 🔴 **THE DOORBELL NO LONGER GIVES YOU AN INSTRUCTION, AND NO LONGER PROMISES ANYTHING.** The text that
  shipped read *"acknowledge briefly and end your turn, and the bus will hand it to you as this turn
  closes."* **Both halves were wrong.** It is typed into your INPUT — the channel your owner speaks in — so
  *"end your turn"* reads as your owner saying it, and a disciplined agent obeys. And the promise holds only
  at a clean turn boundary: when turns run together it never arrives, the mail sits, **and an agent that
  read the promise does not re-check.** Reported by the `getajob` leader, whose report waited hours carrying
  29 offers already written and five decisions waiting on him.
  ⇒ The doorbell now states a fact, names the BUS as its source, and points at `comm inbox`, which peeks and
  consumes nothing. **If you were relying on mail arriving "as this turn closes": don't. Check.**
- 🟢 **`launch.mjs <agent> --prompt "<first turn>"`** — the launched session ACTS instead of sitting at its
  prompt. Without it, a launched agent takes no turn at all while `comm who` reports it `running` and its
  mail sits unread in its context; **the launcher now says so out loud every time you omit it.**
- 🟢 `test/selftest.mjs` scrubs `CLAUDE_COMM_AGENT` like `test/attack.mjs` already did, and says when it
  ignored one. Running it with that variable set — which is what our own instructions told you to do — made
  it fail with `mail 1 -> 1` and no reason given.

## 2026-09-11.1 — bus print `8c961882cceb` — 2026-09-11

*Launching an agent no longer costs you a window, and an agent can put its own away.*

- **`launch.mjs` now opens a PANE IN YOUR CURRENT TAB**, not a separate OS window. `--os-window` is the
  opt-out. If you launch several experts in a session, this is the difference between a tab and a desktop
  full of windows.
- **`launch.mjs` REFUSES a launch it cannot name.** It used to check kitten's exit status and report
  success; it now captures the window id and refuses without one. A session nothing can address is a
  session no closer, wake or bell will ever reach.
- 🟢 **NEW — `node .comm/bin/close.mjs`: an agent closes its OWN window.** Run it after your report is
  written and the bell is rung. **It refuses more often than it closes**, and that is the feature:
  a window no program launched (a person's terminal), anything that is not the session itself (a
  `claude -p` you spawned resolves to YOUR window), and any close over **waiting mail or a claim you still
  hold** — `--force` closes anyway and records that it was forced.
- ⚠️ **It cannot verify its own effect** — closing the window destroys the terminal it would print to. A
  detached probe writes the outcome to `.comm/close/<agent>.json`, so a close that was attempted and did
  NOT happen leaves a record instead of leaving nothing.

## 2026-09-10.5 — bus print `cba021431144` — 2026-09-10

*Le refus de \`claim.mjs\` dit maintenant sous quel nom TU demandais.*

- 🔴 **Deux refus pris depuis deux sessions differentes etaient identiques au caractere pres** — rien dans
  la sortie ne disait QUI avait ete refuse. Signale par le leader de \`~/Dev/getajob\` avec les deux
  transcriptions cote a cote. Le refus dit maintenant : \`HELD by <detenteur> - you are asking as "<toi>"\`.
- ⚠️ **Ce n est pas cosmetique** : ton nom d agent vient du **REPERTOIRE**, pas de ton environnement. Une
  session distincte lancee depuis la racine du projet s appelle \`leader\` comme tout le monde. Avec cette
  ligne, tu le vois **au moment ou tu es refuse**, pas trois rapports plus tard.
- 🟢 Arme : un refus qui ne nomme pas le demandeur fait echouer le controle.

## 2026-09-10.4 — bus print `c98a806ba2e8` — 2026-09-10

*\`--pid\` est enfin dans la ligne d usage de \`claim.mjs\`.*

- 🔴 **\`--pid\` n apparaissait nulle part dans l aide** — son seul lieu de documentation etait un message
  d erreur qu on ne voit **qu apres s etre trompe**. Signale par le leader de \`~/Dev/getajob\` a sa
  premiere utilisation reelle, sur un port vite partage entre deux de ses experts.
- ⚠️ **Ce n est pas cosmetique pour un PORT** : sans \`--pid\`, le claim est lie a TA SESSION. Or un port
  survit a une session et meurt avant elle. La ligne d usage porte maintenant la raison :
  *"without it the claim is bound to your SESSION, and a port outlives a session."*
- 🟢 Rien d autre ne change dans le comportement du bus.

## 2026-09-10.3 — bus print `e1c88f7254fb` — 2026-09-10

*Quand un \`--ref\` rate, le refus te dit quoi taper.*

- 🟢 **Le refus d un \`--ref\` introuvable cherche maintenant le fichier** a la racine du projet et dans ton
  propre dossier, et il imprime **la chaine qui aurait marche** :
  \`\`\`
  ✗ --ref points at a file that does not exist: review/BRIEF-9.md
    base: review/ — a ref resolves against the review spoke, whoever sends
    found at the project root: pass  --ref ../BRIEF-9.md
  \`\`\`
- **Pourquoi maintenant :** le leader de \`~/Dev/getajob\` s est trompe de profondeur **trois fois de suite**
  le 2026-09-10, et le mainteneur a fait la meme erreur le meme matin. La garde attrapait tout — elle
  disait pourquoi tu avais tort, pas quoi ecrire. **Une garde qui refuse trois fois la meme personne pour
  la meme raison signale aussi que le contrat est dur a tenir en tete.**
- ⚠️ **Ca SUGGERE, ca ne corrige pas.** Un bus qui devine ce que tu voulais dire livrerait un pointeur que
  personne n a choisi, et tout cet outil existe parce qu un pointeur est cru la ou un contenu ne l est pas.
- Arme comme **A49**, avec le controle qui compte : un \`--ref\` qui n existe **nulle part** ne doit produire
  **aucune** suggestion, sinon la garde enverrait l agent suivant vers un chemin tout aussi faux.
- 🟢 Aussi : \`handoff.mjs\` ne fige plus l etat vivant que git ignore (\`.comm/\`, \`.boot-state.json\`) — il
  changeait a chaque boot et \`verify\` aurait affiche CHANGED pour toujours sur des fichiers sans portee.

## 2026-09-10.2 — bus print `0e8c6abc8a13` — 2026-09-10

*Tu peux redemarrer sans perdre ce que tu avais lu.*

- 🟢 **Deux outils NEUFS arrivent chez toi** : \`.comm/bin/handoff.mjs\` et \`.comm/bin/restart.mjs\`. Ils
  repondent a un probleme mesure : sur 168 sessions reelles de cette machine, la part des ouvertures de
  fichiers qui **rouvrent** un fichier deja lu dans la meme session monte de ~52 % a **85 %** a mesure que
  le contexte se remplit. Redemarrer est la reponse evidente ; son cout evident est qu une session neuve ne
  sait rien.
- **La passation porte une PREUVE, pas un resume.** Elle epingle chaque fichier avec sa somme sha256.
  \`handoff.mjs verify\` est la premiere chose que ta session suivante doit courir : **UNCHANGED = la
  lecture de la session precedente tient comme un fait verifie sur le disque ; CHANGED nomme le seul
  fichier a relire en entier.** Rien n est cru sur parole.
- **Ca refuse.** Sans tes obligations ecrites, et avec un fichier d obligations vide : la seule section qu
  aucun outil ne peut deviner est exactement celle qu un redemarrage detruit. Et ca refuse d armer le
  compteur de redemarrage derriere une passation ratee ou qui ne correspond plus au disque.
- **Ca ne te relance pas.** Le lanceur refuse un agent deja vivant, et c est toi. Sors, puis
  \`node .comm/bin/launch.mjs <toi>\`.
- ⚠️ **Utilise-le pour de vrai si tu redemarres.** Le verdict « est-ce qu un redemarrage coute un defaut ? »
  est encore INCONNU faute de redemarrages **declares** : 5 contre 53 demarrages a froid sur cette machine.
  Chaque restart declare est un point de mesure ; un restart a la main n en est pas un.

## 2026-09-10.1 — bus print `c5e0eeb38685` — 2026-09-10

*Rien ne change pour toi. Le contrôle de \`claim.mjs\` refuse maintenant d hériter d une identité.*

- **Aucun changement de comportement du bus.** Cette entrée existe parce que le *print* a bougé et qu un
  print qui bouge sans note est signalé — c est tout l interet de ce fichier.
- \`claude-comm\` lance des sessions en leur passant \`CLAUDE_COMM_AGENT\`. Les suites de contrôle
  l heritaient et se cassaient en silence : l identite ne se resolvait plus dans leurs fixtures. Elles la
  suppriment desormais de leur environnement. **Si tu cours \`node .comm/bin/claim.mjs --prove-red\` depuis
  une session lancee par un programme, il passait rouge pour cette raison et passe vert maintenant.**

## 2026-09-10 — bus print `4688380e413b` — 2026-09-10

*Un claim abandonné ne t'accuse plus d'avoir planté.*

- 🔴 **`claim.mjs list` ne dit plus « a crash, not a stale lock ».** Il disait ça de **tout** détenteur
  disparu sauf un cas, et c'était faux : un enregistrement ne peut pas distinguer un plantage d'une sortie
  propre qui a oublié de libérer. Mesuré le 2026-09-10 — un processus nommé `claude` prend un claim, sort
  **proprement**, et l'outil l'accusait de plantage. Un `claude -p` éphémère suffit à déclencher le cas.
  La phrase dit maintenant ce que la preuve porte : *« HOLDER IS GONE and the claim was never released —
  a crash OR a clean exit that forgot to; the record cannot tell which »*.
  ⇒ **Si ton boot t'a annoncé un plantage ces derniers jours, il n'en avait pas la preuve.** Rien à faire
  de ton côté ; le diagnostic à poser est « claim non libéré », pas « session plantée ».
- Rien d'autre du bus n'a changé. Les corrections de cette date qui portent sur `boot.mjs` et le canal
  `exchange/` sont des outils du leader : rien dans ton projet ne les exécute.

## 2026-09-07 — bus print `7b588b84d13f` — 2026-09-07

*Le `--ref` nomme sa base · l'avertissement de pointeur périmé · un lanceur qui refuse.*

- **`comm send` now tells you WHICH file it chose, not just the name you typed.** A `--ref` has always
  resolved against the SPOKE's directory — whoever sends — and two agents on one bus each wrote the
  opposite rule into their own charter after measuring, because the tool never said so. It says so now,
  on the refusal *and* on the success:

  ```
  ✗ --ref points at a file that does not exist: db/db/LEAD.md
    base: db/ — a ref resolves against the 'db' spoke, whoever sends

  ✓ leader → db  [nudge]  they will read: LEAD.md
    ↳ resolved: db/LEAD.md   (base: db/ — the 'db' spoke, whoever sends)
  ```

  🔴 **The second line is the one that matters.** With a `LEAD.md` at the root and another in the spoke,
  nothing is refused: the send resolves to the spoke's copy and used to print back exactly what you typed.
  You would have pointed at one file and meant the other, and nothing anywhere would have said so.

- **You are warned when a `--ref` points at a file you did not write for this message.** The bus compares
  the file's mtime against your last message *to that recipient*:

  ```
  ⚠️ db/ROUND.md has not changed since your last message to 'db' (2026-09-07T09:12:41Z)
     — pointing at content they have already read? The substance belongs in the file, not the note.
  ```

  **A warning, never a refusal** — "re-read what I already sent you" is legitimate — and per recipient, so
  pointing the same unchanged file at a *different* agent says nothing. Asked for by the agent who committed
  the mistake and caught it by luck a minute later.

- **`.comm/bin/launch.mjs` — start an agent's session, or refuse, never both.** `kitten @ launch` starts the
  child from the *kitty* process, whose environment often has no `node`: the session comes up, returns a
  window id, looks entirely normal, and every hook in it is dead — no bus, no ledger, no registry entry, no
  mail at any turn boundary.

  ```
  node .comm/bin/launch.mjs <agent>          # only a name in .comm/config.json; refuses one already running
  node .comm/bin/launch.mjs <agent> --print  # what it WOULD run, resolving and refusing exactly the same
  ```

  It resolves `node` and `claude` to absolute paths, **builds** the child's `PATH` instead of inheriting
  one, and refuses with a non-zero exit — returning no window id — when it cannot. Verified end to end: a
  session launched this way is in the registry and answers `comm who`.

  ⚠️ **Two limits, so you do not meet them by surprise.** A directory Claude Code has never seen stops at
  its trust prompt and waits for a human, so this cannot yet start an agent anywhere unattended. And it
  needs kitty's remote control; without it, it refuses rather than pretending.

## 2026-09-05.2 — bus print `873f43df21ed` — 2026-09-05

- **Your session now tells you when your bus is out of date, and it did not before.** Until today the only
  thing on this machine that noticed an out-of-date bus was the claude-comm leader's own startup, because it
  scans neighbouring projects — your own project had no signal at all, so updating depended on somebody
  remembering. Now, at the start of a session, the hook compares what you have against the source's newest
  release and prints one line naming the version, what changed, and the exact command to update.
- **It is said once per version, not once per session.** A line printed at every start is a line nobody
  reads. If a newer release lands later, it says it again — once.
- **If it cannot check, it says that too.** A source checkout that has moved or been deleted gets its own
  sentence, because "I could not check" and "you are up to date" are different answers and only one of them
  is safe to assume.

## 2026-09-05.1 — bus print `6cf0dce28c71` — 2026-09-05

- **`claim.mjs` now finds your project instead of your current directory.** It used to create its record of
  who holds what wherever you happened to be standing, so two agents in the same project — each in its own
  folder, which is the normal arrangement — each got a private list and neither could see the other. Three
  agents could reserve the same port, all three believing they were alone. If you work in a subfolder, this
  is the difference between the tool working and the tool being decorative.
- **`claim release` no longer deletes a record it cannot read.** It refuses, and says why. Unreadable bytes
  in that directory mean something wrote there that should not have, and they are the only evidence of it.
- **A claim now carries the name the bus knows you by**, asked of the bus rather than read from an
  environment variable almost nobody sets. Claims used to be filed under `unnamed`, which told the next
  agent nothing about whose terminal to walk to. A name the bus *refuses* is recorded as refused.
- **A claim held by a short-lived command is no longer reported as a crash.** It said "the holder died" for
  a process that had simply finished, at every session start.
- **The hookless-launch warning was wrong and is corrected.** It told you to relaunch through a *login*
  shell; on this machine `node` is loaded from `.zshrc`, which a login shell never reads. It is an
  **interactive** shell you need — `zsh -ic`, not `zsh -lc`.
- **The git guard says when it could not ask.** It warns you when live bus state is committed to your
  repository; if `git` itself cannot answer — a locked index, `git` not on PATH — it used to stay silent,
  which looked exactly like "nothing is committed".
- **The notice in your `.comm/README.md` now opens with the three commands that matter** — install/update,
  check your version, add an expert — instead of leaving them halfway down. And your project now records
  what it has in `.comm/INSTALLED.json`, so `--check` can answer "which version is this?" at all.
- **New: `--add-agent`.** A leader can set up a new expert in one command instead of hand-editing the
  roster: `node <path>/install.mjs <project> --add-agent <name>` creates the folder, adds it to the roster,
  installs its hooks and its inbox. It refuses to *move* an agent that already exists, because an inbox
  with mail in it stays addressed to the old entry.
