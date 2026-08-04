# Retour d'usage — leader Electio, après une journée complète sur le bus

**Qui écrit :** l'agent *leader* du projet Electio (`~/Dev/electio`), en binôme avec un expert
`web-app` et, en fin de journée, un relecteur adverse. **24 messages** dans le log, dans les deux
sens, sur ~20 heures de session.

**Tout ce qui suit est mesuré**, sauf les demandes de fonctionnalités, qui sont évidemment des
souhaits. Je nomme aussi mes propres erreurs d'usage : deux des trois frictions que j'ai vécues
venaient de moi, pas de l'outil.

---

## Ce qui marche, et qui compte plus que le reste

**Aucun message perdu sur 24.** Livraison en fin de tour quand l'agent tourne, au `SessionStart`
quand il est arrêté. J'ai vérifié les deux chemins dans la journée.

⭐ **La meilleure décision de conception est la contrainte `--ref` obligatoire et l'absence de
`--body`.** Un message ne peut que *pointer vers un fichier*. Je ne l'ai pas seulement constatée :
**je l'ai adoptée comme règle dans mes propres documents**, parce que le raisonnement tient au-delà
de la sécurité. Deux raisons, la seconde étant la plus intéressante :

1. Un message porteur d'instructions est refusé comme injection de prompt — l'agent récepteur ne
   peut pas distinguer son leader d'un attaquant. Correct.
2. ⭐ **Ça garde la paternité propre.** Une manche écrite par l'expert reste une affirmation sur ce
   que *lui* a vérifié. Si j'avais pu injecter du texte, la frontière entre « ce qu'il a mesuré » et
   « ce que je lui ai soufflé » aurait disparu — et sur un projet dont toute la valeur est la
   traçabilité, c'est exactement ce qu'il ne faut pas perdre.

Le durcissement anti-injection (lot plafonné, note aplatie à une ligne, 240 caractères) n'a jamais
gêné : la substance doit être dans le fichier de toute façon.

`who` avec la détection de vie par `/proc` a été utile plusieurs fois — notamment pour savoir si je
pouvais écrire dans l'arbre de l'expert sans violer la règle « un seul rédacteur par arbre ».

---

## Mes erreurs, pas les vôtres — je les mets en premier

**Je n'ai jamais utilisé `dismiss` de la journée.** Résultat : j'ai lu des messages avec `inbox`,
agi dessus, puis le hook `Stop` me les a re-signalés **en bloquant ma fin de tour** — deux fois, pour
des messages déjà traités. À chaque fois j'ai dû re-vérifier l'état du dépôt pour découvrir qu'il n'y
avait rien de neuf.

**La cause est chez moi :** le `COORDINATION.md` de mon projet ne documentait que **4 des 6
commandes** — `who`, `send`, `inbox`, `log` — en omettant précisément `dismiss`. J'ai lu ces
quatre-là et jamais l'aide complète. Corrigé de mon côté.

⚠️ **Mais il reste une leçon transférable pour l'outil :** la sortie de `inbox` ne mentionne pas
`dismiss`, et la notification du hook non plus. Un agent qui découvre le bus par ces deux surfaces —
c'est-à-dire le cas normal — n'apprend jamais qu'un accusé de réception existe. **Une ligne dans la
sortie de `inbox` (« *N en attente — `comm dismiss` après avoir agi* ») aurait effacé toute ma
journée de friction.** C'est la modification la moins chère de cette liste et probablement la plus
rentable.

---

## La vraie limite, et elle est structurelle

**La livraison est en fin de tour, jamais un réveil.** C'est documenté, et je ne le signale pas comme
un bug — mais la conséquence pratique mérite d'être écrite noir sur blanc :

> **Un agent vivant mais au repos ne reçoit jamais son courrier.**

Vécu deux fois. Mon expert avait 2 puis 3 messages en attente pendant de longues minutes, session
vivante (`pid` visible dans `who`), sans jamais les voir — parce qu'il n'était dans aucun tour. J'ai
dû dire au propriétaire : *« il ne les verra que quand vous le relancerez »*.

⇒ **Le bus supprime le propriétaire comme relais de contenu, mais pas comme mécanisme de réveil.**
C'est une vraie avancée — il ne recopie plus mes phrases — mais il reste dans la boucle pour toute
communication qui doit arriver *maintenant*. Si le socket kitty évoqué dans vos notes devient
possible, c'est ce qu'il débloquerait.

---

## Trois fonctionnalités qui me manquent — vérifiées absentes de la CLI

Par ordre de ce qui me coûterait le moins de temps demain.

### 1. Une ligne d'aide dans `inbox` (voir plus haut)
Coût quasi nul, aurait supprimé ma seule friction récurrente.

### 2. Visibilité côté EXPÉDITEUR — `comm sent`

Aujourd'hui j'envoie une notification et **je ne sais jamais si elle a été lue**. J'ai dû l'inférer
en regardant les commits de l'expert. Dans un modèle en étoile, le leader écrit des briefs dont il
doit savoir s'ils ont atterri — c'est la différence entre « il n'a pas encore répondu » et « il n'a
jamais reçu ». `log` montre les envois, pas leur sort.

```
comm sent
  → 2026-08-04T18:52  web-app  [nudge] docs/REVIEW.md   ✓ délivré 19:03
  → 2026-08-04T22:41  web-app  [nudge] docs/REVIEW.md   ⧗ en attente (agent au repos)
```

### 3. Un fil — `--reply-to <id>`

Ma journée est faite de triplets *brief → manche → verdict*, six fois de suite. Le fichier
`REVIEW.md` sait que ce sont des fils ; le bus non. Un identifiant de réponse rendrait `log` lisible
comme une conversation, et permettrait de répondre « à quel brief cette manche répond-elle ? » sans
lire le fichier.

*(Je n'ai pas de quatrième demande. J'ai cherché — l'outil fait ce qu'il annonce.)*

---

## La question du propriétaire : est-ce que ça entrave mon processus ?

**Non, et l'inverse est vrai.** Le bus a changé deux choses concrètes dans ma journée :

- Il a supprimé le propriétaire comme **relais de contenu**. Avant, une correction de ma part devait
  transiter par lui, avec la déperdition que ça suppose. Maintenant j'écris dans le fichier et je
  sonne ; l'expert lit **la source**, pas ma paraphrase.
- ⭐ **Il a rendu possible la relecture adverse**, qui a trouvé **20 défauts en deux passes dans mon
  propre code** — dont un oracle qui passait au vert sans jamais joindre l'institution qu'il prétend
  interroger. Sans un canal où un agent frais peut rendre un rapport et me le signaler, cette
  pratique serait restée une bonne intention dans un document.

Le seul coût réel a été mes deux tours perdus sur le hook, et c'était mon erreur de lecture de la
doc.

**Une remarque de conception, pour finir.** Votre choix de faire du bus une *sonnette* et non un
*canal* est ce qui le rend utilisable dans un projet qui exige la traçabilité. Un bus qui transporte
du contenu aurait produit exactement ce que ce projet passe ses journées à combattre : des
affirmations dont on ne sait plus qui les a mesurées. Ne le changez pas si on vous demande un
`--body`.

*— leader Electio, 2026-08-04*
