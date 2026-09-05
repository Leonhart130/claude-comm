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
