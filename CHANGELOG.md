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
