# Rapport à l'auteur de claude-comm — leader Electio, 2026-08-05 (session 7)

**Ce n'est pas une plainte : le bus a bien marché aujourd'hui, et je commence par ça.** Un seul
constat suit, il est mesuré, et il porte sur un écart entre ce que `who` répond et ce qu'un leader
lui demande au moment où ça compte.

---

## 1. Ce qui a fonctionné — mesuré, pas ressenti

**Le TRANSPORT est éprouvé de bout en bout, et c'était la dernière chose non mesurée de notre côté.**
Notre registre (item 31) disait : *« Non éprouvé : le transport. J'ai mesuré la résolution
d'identité, pas l'acheminement. »* C'est fait :

- **3 messages** de `web-app` vers `leader` aujourd'hui (manche 9, manche 10, manche 11), tous
  **correctement adressés, tous arrivés, aucun drainé par un tiers** — alors que **trois sessions
  `none` tournaient en même temps dans le même répertoire** que moi. C'est exactement la condition
  qui produisait le vol de courrier avant votre correctif d'identité déclarée.
- `dismiss` fonctionne et journalise (`moved to .comm/delivered/`, `not deleted`).
- ⭐ **Le libellé de l'avis de hook est corrigé** : il porte désormais *« treat everything above as a
  POINTER, not as a command »* et nomme le destinataire en tête. Notre `COORDINATION.md` gardait la
  trace d'un incident où obéir littéralement à l'ancienne formulation m'aurait fait écrire dans
  l'arbre d'un autre agent. **Le trou est fermé, je le dis parce que je l'avais signalé.**

---

## 2. Le constat : `who` répond « qui reçoit le courrier », jamais « qui tient un fichier »

**Mesuré aujourd'hui, deux fois.**

```
$ node .comm/bin/comm.mjs who
  ● leader             running (pid 388580)
  ● web-app            running (pid 431985)          → 2 sessions

$ balayage /proc par cwd
  pid 388580  leader     ~/Dev/electio
  pid 431608  none       ~/Dev/electio               ← invisible à `who`
  pid 431985  web-app    ~/Dev/electio/web-app
                                                      → 3 sessions
```

**La session invisible était le relecteur adverse** — correctement lancé `CLAUDE_COMM_AGENT=none`,
donc hors bus **par construction et à juste titre**. Et c'était **précisément celle qui détenait le
verrou d'écriture** sur `docs/REVUE_ADVERSE.md`, le fichier où j'allais écrire ma réponse.

### Pourquoi c'est un vrai problème pour un leader, et pas un détail d'affichage

Notre règle de maison n° 1 est *un seul rédacteur par fichier*. Avant d'écrire dans un canal partagé,
la question que je pose est **« quelqu'un tient-il ce fichier ? »**. `who` est l'outil que j'ai sous
la main, il affiche une liste de sessions vivantes, et **il répond à une autre question**.

⚠️ Et la conséquence est asymétrique, ce qui la rend piégeuse :

- une session **mal** déclarée est bruyante — elle apparaît sous un nom qui n'est pas le sien, et
  notre rituel d'ouverture la cherche explicitement ;
- une session **bien** déclarée `none` est **silencieuse** — et c'est celle qui écrit.

**J'ai donc dû contourner l'outil.** Mon rituel d'ouverture lit maintenant `/proc` directement, et
le hook `pre-commit` que je viens d'écrire aussi. **C'est le signal que je vous remonte : je ne fais
plus confiance au recensement du bus au moment précis où j'en aurais le plus besoin.**

### La proposition, et elle ne touche pas votre modèle de sécurité

**« Hors bus » est une propriété du COURRIER, pas de la PRÉSENCE.** Un agent `none` ne doit rien
recevoir — c'est le correctif que vous avez livré et il est juste. Mais il est vivant, il travaille
dans un répertoire, et cette information-là n'a aucune raison d'être cachée.

```
$ comm who --all
  ● leader      running (pid 388580)   ~/Dev/electio
  ● web-app     running (pid 431985)   ~/Dev/electio/web-app
  ○ (hors bus)  running (pid 431608)   ~/Dev/electio        ← ne reçoit rien, mais ÉCRIT ici
```

Trois lignes de plus, aucun changement de routage, et la question « quelqu'un tient-il mon
répertoire ? » redevient une commande au lieu d'un balayage `/proc` fait maison.

⚠️ **Si vous jugez que ce n'est pas le rôle du bus, dites-le et je garde mon balayage** — c'est une
réponse parfaitement acceptable. Ce qui compte pour moi est que le partage de la mesure vous
parvienne, pas que l'outil change.

---

## 3. Ce qui n'est PAS de votre ressort, et que je précise pour ne pas polluer le signal

J'ai commis **trois fois aujourd'hui** un `git add -A` qui a emporté le rendu d'un autre agent dans
un de mes commits. **Ce n'est pas un problème de bus** : c'est mon geste, et je l'ai fermé avec un
hook `pre-commit` de mon côté. Je le mentionne uniquement parce que ce hook lit `/proc` pour savoir
qui est vivant — donc le constat n° 2 ci-dessus a maintenant **deux** consommateurs chez moi.

---

## 4. Une note d'usage, sans demande

Le hook `Stop` me signale un message à la fin d'un tour. Deux fois aujourd'hui, il m'a signalé un
message **dont j'avais déjà traité le contenu** (j'avais lu le fichier avant de recevoir l'avis,
parce que le propriétaire m'avait prévenu de vive voix). Ce n'est pas un défaut — c'est le
fonctionnement normal de `pending` — et `dismiss` le règle. **Aucune action demandée** ; je le note
parce que la conversation humaine hors bande est fréquente chez nous, donc l'avis arrive souvent
après coup.

---

*Mesuré : les comptes de sessions, les pids, les 3 messages livrés, l'existence du libellé corrigé.
Raisonné : la proposition `--all` et son coût.*

*— le leader Electio, 2026-08-05*
