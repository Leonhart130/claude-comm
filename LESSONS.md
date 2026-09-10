# LEÇONS — claude-comm, registre de conduite

🔴 **Une leçon avec une étiquette de prix. Sans prix, c'est une platitude et ça n'entre pas ici.**

⭐ **Et une leçon ne se termine pas en prose : elle se termine en garde armée.** *« Knowing the rule does
not protect you. Running a control does. »* — `~/Dev/selflo-project/LESSONS.md` §1, via
`~/Dev/work/notes/LESSONS.md`. C'est déjà la règle de `CLAUDE.md` pour tout amendement de protocole :
**preuve, changement gardé, bras. Jamais un paragraphe.**

**Créé le 2026-09-10**, sur le constat du propriétaire qu'il n'y avait ici aucun protocole d'apprentissage
de mes erreurs — sur le modèle de `~/Dev/work/notes/LESSONS.md` (§1–§132, créé le 2026-09-05 à sa
consigne). En français comme son modèle : ce document est lu par le propriétaire et par moi.

🔴 **Tier 2 — à la demande, JAMAIS au boot.** Le tier 0 est plafonné en OCTETS et était à 85 % le jour où
ce fichier est né. Ce qui monte en tier 0, c'est au maximum une ligne qui pointe ici.

---

## 🔴 LE CATALOGUE PAR FORME — à lire AVANT d'agir, pas après avoir échoué

**Un incident ne se reconnaît pas d'avance ; une forme, si.** Le catalogue démarre à cinq formes parce que
cinq sont ce que je peux **sourcer** — chacune renvoie à une mesure ou à un commentaire de code de ce
dépôt, aucune n'est une intuition. `FINDINGS.md` (25 défauts) est le gisement des suivantes.

| # | La forme | À quoi ça ressemble sur le moment | source |
| --- | --- | --- | --- |
| 🔴 **A** | 🔴 **L'AUTEUR EST EXEMPTÉ DE SA PROPRE RÈGLE** | J'écris le lanceur vérifié, sur le bus, à l'épreuve des hooks morts — et mon dépôt est le seul de la machine sans `.comm/`, donc le lanceur ne peut pas lancer dans le dossier où il vit. **Tout ce que je livre marche ; simplement jamais sur moi** | **§1** |
| 🔴 **B** | 🔴 **LE BRAS ROUGIT, MAIS PAS POUR LA PROPRIÉTÉ DE SON TITRE** | Un bras qui affirme un refus et mesure un manque au registre ; un instantané qui compare des noms de fichiers quand le dégât est un écrasement | `CLAUDE.md`, amendé le 2026-09-04 : **cinq trouvailles sur sept d'une passe de revue portaient sur les bras, pas sur le code** |
| 🔴 **C** | 🔴 **JE PARAPHRASE L'ÉTAT AU LIEU DE LE MESURER** | Le fichier d'état disait vert pendant qu'un bus 4 commits en retard tournait sur le terrain. **Même forme le 2026-09-10 : j'ai lu une tranche `sed` de `STATUS.md` et parlé d'après le résumé du boot** | `CLAUDE.md` · **§1** |
| 🔴 **D** | 🔴 **UNE LIGNE NOMME AUTRE CHOSE QUE CE QU'ELLE A MESURÉ** | La ligne terrain affichait « HOOK DRIFT » alors que ce qui avait changé était un `.gitignore` : elle envoyait le lecteur inspecter des hooks parfaits | `bin/boot.mjs`, commentaire du 2026-09-04 : *« a row that names something other than what it measured is this project's signature defect »* |
| 🔴 **E** | 🔴 **UN BALAYAGE QUI ÉCHOUE REND LE MÊME RÉSULTAT QU'UN BALAYAGE VIDE** | `catch {}` nu, retour `{at:0}` : un dossier illisible est indiscernable d'un dossier vide, et la ligne **disparaît** au lieu de crier | mesuré le 2026-09-10, `bin/boot.mjs:1011-1023` — à un appel de distance du même défaut corrigé le 09-08 |
| 🔴 **F** | 🔴 **J'AJOUTE DE LA CONFIANCE LÀ OÙ IL FALLAIT DE LA PREUVE** | Un pair écrit noir sur blanc *« je ne l'ai pas couru avec deux sessions réelles, donc je ne l'écris pas comme mesuré »*. Je lui réponds que son trou est plus petit qu'il ne croit — **sans une mesure de plus.** ⚠️ **Ça se propage** : la question qu'il avait laissée ouverte à raison a été fermée chez lui, puis SUPPRIMÉE de mon propre fichier d'état | **§2** |
| 🔴 **G** | 🔴 **JE CITE UN NOM QUI N'EXISTE PAS, ET LE FOND EST JUSTE** | `stateOf` contre `holderState`. Comme la conclusion tenait, rien ne l'a contredite — **et le pair ne POUVAIT pas vérifier ce que je lui affirmais.** Une citation fausse dans un raisonnement juste est un cul-de-sac qu'on ne voit pas | **§2** |
| 🔴 **J** | 🔴 **JE CONCLUS « NON REPRODUCTIBLE » D'UNE SONDE QUI NE POUVAIT PAS SE DÉCLENCHER** | Trois invocations du hook `Stop`, toutes sorties en 0 — **et toutes avec une boîte vide**, alors que le signal n'apparaît QUE lorsqu'un message est livré. J'ai mesuré une inbox vide et je l'ai écrit comme un mystère, dans `STATUS.md` et dans un message de commit | **§5** |
| 🔴 **I** | 🔴 **JE GATE SUR LE CODE DE SORTIE D'UN ENVELOPPEUR** | `systemd-run --scope` rend **exit 0** pendant que la suite qu'il enveloppe écrit `✗ 8 lignes non rougies`. Treize minutes de contrôle qui se lisaient vertes. **Même forme que `kitten @ send-key`** : sortir 0 sans rien dire de ce qu'on a enveloppé | **§4** |
| 🔴 **H** | 🔴 **JE CONCLUS « ABSENT » SUR UN AFFICHAGE QUE J'AI MOI-MÊME TRONQUÉ** | `grep … \| head -5` sur un fichier dont la section est ligne 126 : j'annonce deux fois au propriétaire qu'il manque une section qui était écrite, complète, meilleure que ce que je proposais | **§3** |

---

## §1 — J'ai bâti le bus et laissé mon propre dépôt hors du bus. Il a fallu qu'il me le redise, trois jours après l'avoir écrit.

**Le 2026-09-10.** Il me demande de lancer la revue adversariale #8. Je réponds que je peux, et je lance un
**sous-agent en processus** — pas une session. Puis il demande : *« tu peux utiliser claude comm pour ouvrir
une fenêtre kitty et boot un agent ? c'est plus efficace non ? »*

Mesuré alors, et pas avant : `~/Dev/claude-comm` **n'a pas de `.comm/config.json`**. La ligne `session` de
mon propre boot l'imprime à chaque démarrage — `not on any roster here - off the bus` — **en vert**, depuis
des semaines. `bin/launch.mjs` refuse tout nom absent d'un roster : donc le lanceur que j'ai écrit, vérifié,
armé (A46) et installé dans **deux** arbres de terrain ne peut pas lancer un agent **dans le dossier où il
vit**. Et `review/` n'existe pas : la ligne `STATUS.md` *« no real adversarial review has ever run from
review/ »* était portée depuis des jours sans que personne remarque qu'elle voulait dire **le dossier est
absent**.

### Le mécanisme

**Une exemption d'auteur est invisible de l'intérieur, parce que tout ce que je livre marche.** Les hooks
marchent, le lanceur marche, les claims marchent — chez les autres. Il n'y a aucun moment où ça casse chez
moi, puisque je ne l'utilise pas. Et la ligne qui aurait dû hurler imprimait un `✓` : *off the bus* était
traité comme un **fait neutre** alors que c'est, pour ce dépôt précis, le défaut central.

⚠️ **Et la règle existait déjà, écrite par lui, le 2026-09-07, dans `~/Dev/work/CLAUDE.md` §7 :**
*« il ne faut pas que j'aie à rappeler à qui que ce soit que l'outil existe et qu'il doit être utilisé »*.
J'ai grepé ce fichier **le jour même** de cette leçon, et j'en ai cité la ligne 139 sans lire la 137.
C'est la forme **C** dans le même geste.

### Ce que ça a coûté

- **Une donnée de ledger jetée.** `bin/ledger.mjs` est l'instrument de reboot ; son verdict reste `UNKNOWN`
  jusqu'à 10 démarrages par bras (11 cold + 5 reboot au moment d'écrire). Un démarrage réel de reviewer est
  un point de mesure gratuit. Un sous-agent n'en donne **aucun**. La question ouverte n°8 attend cet
  instrument, et je viens de la faire attendre un tour de plus.
- **J'ai dû écrire à la main la liste de lecture et les règles de sécurité du reviewer** au lieu de le
  laisser **booter** — c'est-à-dire reproduire à la main, en un prompt, ce que le tier 0 fait correctement à
  chaque session. Vingt minutes plus tôt, il venait précisément de me prendre à ne pas avoir booté.
- **Aucun artefact.** Le rapport d'un sous-agent meurt avec ma session ; une vraie session m'écrit une
  lettre avec un `--ref` et la correspondance reste dans `exchange/`.
- **Il a payé deux fois la même consigne** : écrite le 09-07, redite le 09-10.

### La règle

**L'outil que je livre, je le fais tourner sur moi d'abord.** Avant de recommander un mécanisme, je demande
à quoi il ressemble appliqué à ce dépôt. Et **quand une capacité me manque pour mon propre usage, cette
absence est le premier bug, pas une note de bas de page.**

### 🔴 Le contrôle — c'est ça qui protège, pas la règle ci-dessus

`bin/boot.mjs` imprime déjà l'état exact (`not on any roster here - off the bus`). **Il l'imprime en vert.**
⇒ **la ligne `session` doit passer `⚠` quand `ROOT` n'a pas de `.comm/config.json`**, avec un bras qui arme
l'échec interdit — roster présent ⇒ vert, roster absent ⇒ jaune — et un contrôle positif.

**Non fait au moment d'écrire, et pourquoi :** `bin/boot.mjs` est la cible principale de la revue #8 qui
tourne, et un changement de ce fichier coûte un re-passage de contrôle de ~13 minutes. **À faire dès que #8
a rendu**, avec l'installation du bus ici (`node install.mjs . --add-agent review=review`, mesuré
non-destructif pour le hook de boot existant le 2026-09-10 sur copie jetable). Tant que la garde n'est pas
armée, cette leçon est une platitude, et c'est ce fichier qui le dit.

---

## §2 — Un pair avait refusé d'écrire « mesuré ». Je lui ai répondu que son trou était plus petit, sans une mesure de plus — et c'est revenu supprimer la ligne chez moi.

**Le 2026-09-08.** Le leader de `~/Dev/work` m'écrit sur `bin/claim.mjs`. Il fait lui-même l'argument de
code — le verdict de vivacité lit `pid` + `start` + `boot` quelle que soit la façon dont l'enregistrement a
été écrit — **puis il refuse explicitement d'en conclure une mesure** : *« je ne l'ai pas couru avec deux
sessions réelles, et je ne l'écris donc pas comme mesuré »*.

Je lui réponds que son trou déclaré est plus petit qu'il ne croit, en citant `stateOf`, *« qui lit
`rec.boot`/`rec.pid`/`rec.start` et jamais `holder` »*. **Deux défauts dans une seule phrase serviable :**

1. `stateOf` **n'existe pas** dans `bin/claim.mjs`. La fonction s'appelle `holderState` (`:112`). Le seul
   `stateOf` du dépôt est un utilitaire de test dans `bin/boot.mjs` qui lit `.boot-state.json` — aucun
   rapport. **Un pair qui aurait voulu vérifier n'aurait rien trouvé.**
2. Le fond était juste — `holderState` ne lit effectivement jamais `holder` — **et n'apportait aucune
   preuve neuve.** Il avait déjà cet argument. Ce que j'ai ajouté, c'est de la confiance.

### Ce que ça a coûté

- **Chez lui :** une mesure qu'il avait laissée ouverte à raison, refermée sur mon autorité.
- **Chez moi, et c'est le prix réel :** en réécrivant `STATUS.md` le 09-08 j'ai **supprimé** la ligne
  *« `#claim-file` entre deux VRAIS agents. Les bras le couvrent ; deux sessions vivantes non »* et je l'ai
  remplacée par *« son trou déclaré est plus petit qu'il ne croit et le code le dit »*. `FINDINGS.md:1090`
  n'a jamais cessé de dire le contraire. **La revue #8 en a fait sa pire trouvaille sur huit cibles**, et
  son mot est juste : *le conseil n'a pas ajouté de preuve, il a ajouté de la confiance.*
- **Et le vrai trou était ailleurs :** review #8 C6 — un détenteur `holder:"session"` sorti **proprement**
  est rapporté comme un crash. C'est exactement la variable qu'il n'avait pas testée, et ma réponse l'a
  envoyé regarder autre chose.

### La règle

**Quand un pair refuse d'appeler une chose mesurée, la seule réponse admissible est une mesure — ou le
silence.** Un raisonnement de code de plus ne change pas le statut de sa question, et venant du mainteneur
il a le poids d'une preuve sans en être une. ⭐ **Et je ne cite jamais un nom que je n'ai pas ouvert dans le
fichier :** une citation fausse portée par une conclusion juste ne rencontre aucune contradiction.

### 🔴 Le contrôle

Aucun contrôle n'existe et **je ne prétends pas qu'il en existe un** : c'est de la conduite, pas du code, et
la seule garde disponible est `FINDINGS.md` qui a tenu bon pendant que `STATUS.md` dérivait. ⇒ **le contrôle
est la contradiction elle-même : aucun élément ne quitte `STATUS.md` tant que `FINDINGS.md` le contredit.**
Armable, non armé, et nommé comme tel — la revue #8 D3 note qu'aucune garde ne lit le CONTENU de `STATUS.md`.

---

## §3 — J'ai annoncé deux fois une section manquante, sur un affichage que j'avais tronqué moi-même.

**Le 2026-09-10.** J'installe le bus dans `~/Dev/getajob` et je veux savoir si son `CLAUDE.md` dit à l'agent
que le bus existe. Je cours `grep -i 'comm\|bus' CLAUDE.md | head -5`, je vois cinq lignes qui parlent d'autre
chose, et j'écris au propriétaire : *« rien = le gap »*. Je le lui redis dans le message suivant, avec une
proposition de trois lignes à ajouter.

La section `## 7. Le bus — claude-comm` est à la **ligne 126**. Elle est complète, elle porte ses consignes
datées, et elle est meilleure que ce que je proposais — elle distingue déjà « eux le module, moi le
registre » et interdit à un expert d'interroger le propriétaire directement.

### Le mécanisme

**`head -5` n'est pas une mesure d'absence, c'est une mesure de mes cinq premières lignes.** Le `grep`
n'a pas menti : il a rendu des correspondances, et je les ai coupées avant d'atteindre la bonne. C'est la
forme I du registre de `~/Dev/work` — *je compte un affichage fait pour l'œil, et il abrège* — sauf que
cette fois c'est moi qui ai posé le couteau.

### Ce que ça a coûté

Un feu vert retenu pour rien pendant deux tours, sur un projet qu'il venait de déclarer prioritaire, et une
proposition de modifier **son** fichier sur un diagnostic faux.

### La règle

**Une conclusion d'ABSENCE ne se tire jamais d'une sortie tronquée.** `grep -c`, ou la sortie entière, ou
rien. Et la même règle qu'en §2 : je n'écris pas « absent » sans avoir ouvert le fichier à l'endroit où la
chose devrait être.

### 🔴 Le contrôle

`grep -c` avant `grep | head` quand la question est « est-ce que ça existe ». Un compte ne se tronque pas.

---

## §4 — Treize minutes de contrôle se lisaient vertes, et c'est l'enveloppeur qui mentait.

**Le 2026-09-10.** Je lance le contrôle sous plafond mémoire, comme ma propre note de machine le recommande.
La notification de fin annonce **exit code 0**. La dernière ligne du journal, elle, dit
`✗ 8 boot row(s) could NOT be reddened - that row is decoration`. **Huit bras cassés derrière un zéro.**

### Le mécanisme

`systemd-run --scope` rapporte le statut de la portée, pas celui du processus qu'elle contient. Rien n'en
prévient, et zéro est exactement ce qu'on attend d'un contrôle qui passe. ⚠️ **Et c'est moi qui recommande
cette commande**, dans ma propre note de machine : le piège est installé dans mon outillage, pas rencontré
par accident.

### Ce que ça a coûté

Rien, parce que j'ai lu le journal. **Mais le prix potentiel était un commit sur un contrôle rouge**, et la
seule chose qui l'a évité est une habitude, pas une garde. C'est exactement ce que décrit la phrase de
selflo : *knowing the rule does not protect you.*

### La règle

**Un enveloppeur n'a pas de verdict à donner.** On lit la dernière ligne de la suite, jamais le code de
sortie de ce qui l'a lancée. Identique à `kitten @ send-key`, qui sort 0 sans avoir rien envoyé.

### 🔴 Le contrôle

Note de machine corrigée. **La garde réelle serait de ne jamais lancer ce contrôle autrement que par un
script qui relit sa dernière ligne. Non écrit — et nommé comme non écrit**, parce que l'absence d'un
contrôle est un défaut du rapport, pas un blanc.

---

## §5 — J'ai écrit « je ne reproduis pas » trois fois, sur une sonde qui ne pouvait pas parler.

**Le 2026-09-10.** La session `review` que je viens de lancer affiche `Stop hook error occurred`. Je lance
le stub trois fois — nu, avec le payload, puis avec la ligne de commande exacte de sa configuration et son
`CLAUDE_PROJECT_DIR`. **Exit 0, aucune sortie, à chaque fois.** J'écris dans `STATUS.md` : *« observée et non
expliquée »*, et je le répète dans un message de commit poussé sur origin.

Une heure plus tard, le même message apparaît dans MA session — sur le tour où le bus m'a livré le rapport
du reviewer. **C'est le mécanisme de livraison lui-même** : le hook bloque pour que la notice atteigne
l'agent, et le harnais rend un hook bloquant comme une erreur.

### Le mécanisme

**Mes trois sondes avaient toutes une boîte vide.** Le signal n'existe QUE quand un message est livré.
J'ai donc mesuré trois fois « pas de courrier » et je l'ai écrit comme « pas de défaut trouvé ». ⚠️ **Le
silence d'une sonde n'est une preuve que si on l'a d'abord fait parler** — et cette règle est déjà dans ma
mémoire, sous le nom *prove-the-probe*. La connaître ne m'a pas protégé.

### Ce que ça a coûté

Une fausse énigme publiée deux fois : dans le fichier d'état que la prochaine session lit en entier, et dans
l'historique git. Elle aurait envoyé quelqu'un chercher un défaut de hook qui n'existe pas. ⭐ **Et le coût
symétrique, plus grave, est celui que j'ai évité de justesse : si la sonde avait « marché » par accident,
j'aurais publié un défaut inexistant avec la même assurance.**

### La règle

**Avant d'écrire « je ne reproduis pas », je fais parler la sonde une fois dans les conditions où le signal
DOIT apparaître.** Pas de contrôle positif ⇒ pas de résultat négatif, seulement une absence de mesure. Et
je préfère « non mesuré » à « non reproductible » : les deux mots ne disent pas la même chose.

### 🔴 Le contrôle

Aucun, et c'est intrinsèque : c'est un jugement sur une méthode, pas une propriété du code. **Ce qui s'en
approche : toute ligne de `STATUS.md` disant « non reproductible » doit nommer le contrôle positif qui a
fait parler la sonde.** Non armé, nommé comme non armé.
