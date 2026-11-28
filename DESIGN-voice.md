# L'outil vocal : le périmètre, avant de construire

*Rédigé le 2026-11-28 avec le propriétaire. Rien n'est construit. Ce fichier fixe ce que l'outil fera, ce qu'il ne fera pas,
et ce qu'il faut mesurer avant d'écrire le code. On se lance quand tout ce qui est marqué « à décider » est tranché.*

## Le besoin

Parler à un agent Claude sans être devant le PC, avec le casque sans fil (Razer BlackShark V2 Pro, dongle USB : c'est la sortie
et le micro par défaut de la machine). Le premier usage : cuisiner avec un agent. Il faut pouvoir lui parler, entendre sa
réponse, réagir, et continuer la conversation.

**Déjà choisi :** un **mot d'appel** (seule une phrase qui commence par lui est envoyée), et **tout en local** (rien ne quitte le
PC pour la voix : la reconnaissance et la synthèse sont locales. **Mais ce que l'agent reçoit part chez Anthropic, comme tout
message tapé à un agent Claude** (la revue du plan, F2 : « rien ne quitte le PC » était faux). **Ajouté par le propriétaire le 2026-11-28 :** l'outil sert **à n'importe quel agent**, pas seulement à la cuisine (le leader
de work, celui de ce dépôt…), avec **un nom vocal par agent**, qu'il règle lui-même. Et le casque porte jusqu'à la cuisine.

## Ce qui existe déjà, mesuré le 2026-11-28

- **Claude Code a une dictée intégrée** (`/voice`), mais il faut tenir ou taper la barre d'espace. Elle ne marche pas loin du
  clavier. Et l'audio part chez Anthropic pour être transcrit, par un modèle que la doc ne nomme pas, qu'aucun autre outil ne
  peut appeler. **Non retenue** ; elle reste disponible devant le PC. Whisper a rendu les deux phrases du propriétaire mot pour
  mot (plus bas).
- **Claude Code ne lit pas ses réponses à voix haute.** Mais son hook `Stop` reçoit le texte de la réponse
  (`last_assistant_message`, dans la doc officielle des hooks), et le stub du bus traite déjà le `Stop`. C'est la prise pour la
  lecture.
- **Le bus sait taper un message dans la fenêtre d'un agent** sans écraser un brouillon ni taper pendant un tour (`wake.mjs`,
  ses règles 1 à 8). C'est la prise pour envoyer tes phrases.
- **La machine** : une RTX 2080 de 8 Go presque vide (la reconnaissance y tourne sans prendre la RAM de work). PipeWire.
  Aucun moteur de reconnaissance ni de synthèse installé, à part `spd-say` (une voix robotique).

## La boucle (v1)

1. **Le micro écoute** en continu. Un détecteur de parole découpe les phrases.
2. **Chaque phrase est transcrite localement** (Whisper, sur la carte graphique, en français).
3. **Si elle commence par le nom vocal d'un agent inscrit**, un petit son confirme qu'elle est entendue, et le reste de la phrase
   est tapé dans la fenêtre de CET agent, précédé de `[vocal]`. Sinon, elle est jetée sur-le-champ : ni enregistrée, ni écrite
   nulle part.
   **La fenêtre de suite :** pendant 20 s après la fin d'une réponse lue, une phrase sans nom part au même agent, comme dans une
   conversation. Passé ce délai, il faut redire le nom. Réglable, et désactivable. **Un nom en tête gagne toujours** : « Work, … »
   dit dans la fenêtre de suite du chef part à work, et la fenêtre de suite passe à work.
4. **L'agent répond.** Au `Stop`, sa réponse est nettoyée pour l'oreille (sans markdown, sans liens, sans blocs de code) et lue
   dans le casque par une voix française locale (Piper). **Chaque agent peut avoir sa voix**, pour savoir qui parle. **Une
   réponse longue est lue par morceaux** : les premières phrases, puis « je continue ? » ; « oui » ou « la suite » (sans le nom,
   dans la fenêtre de suite) lit la suite, « non » s'arrête là.
5. **Pendant la lecture, le micro n'envoie rien** : l'agent ne s'entend pas lui-même.

**Un seul micro, plusieurs agents.** Tu dis (ou tu tapes) « lance le micro » dans la fenêtre d'un agent. L'écoute démarre si
elle ne tourne pas déjà, et cet agent s'y inscrit, sous son nom vocal et sur SA fenêtre, comme il arme son relais. Un deuxième
agent s'inscrit de la même façon, depuis sa fenêtre. Seule une fenêtre inscrite peut recevoir une phrase : jamais une autre.

**Le nom vocal est celui du propriétaire, pas celui de l'agent** (le propriétaire, le 2026-11-28 : un agent peut se renommer,
« alimentation » par exemple, et il veut continuer à l'appeler « Chef »). Il est choisi à l'inscription, retenu **par dossier**
(le dossier d'un agent ne change pas quand il se renomme), et un agent peut en avoir plusieurs (« Chef », « Cuistot »). Il se
change à la voix (« Chef, je t'appelle Cuistot ») ou en le demandant à l'agent. Court de préférence (« Chef », « Work »,
« Toolbox ») : on le dit à chaque phrase hors de la fenêtre de suite. Deux agents inscrits ne peuvent pas porter le même nom, et
un nom trop proche d'un autre est refusé à l'inscription.

**La pause et l'arrêt.** « Chef, pause » : plus rien n'est envoyé à cet agent, l'écoute attend seulement « Chef, reprends ».
On ne se coupe donc jamais soi-même loin du PC. **L'arrêt complet** se fait au clavier, ou tout seul après un temps sans
parole (deux heures, réglable), pour rendre la mémoire. **Le bouton de coupure du micro du casque** reste l'interrupteur sûr :
micro coupé, rien n'arrive au PC.

## Les commandes à la voix (traitées sur place, jamais envoyées à l'agent)

| tu dis | ce qui se passe |
| --- | --- |
| « Chef, répète » | la dernière réponse est relue |
| « Chef, stop » | la lecture en cours s'arrête (à condition que l'écho le permette, voir les mesures) |
| « Chef, minuteur dix minutes » | un minuteur local, qui sonne et le dit à la fin (« le minuteur de dix minutes est fini ») |
| « Chef, pause » / « Chef, reprends » | plus rien n'est envoyé à cet agent / de nouveau |
| « Chef, parle plus lentement » / « plus vite » | le débit de sa voix d'un cran (0,05), retenu pour cet agent, entre 0,75 et 1,2 |
| « Chef, vitesse normale » | le débit choisi au départ |
| « Chef, voix de Pierre » / « voix de Jessica » | sa voix change aussitôt (un même modèle : rien à recharger), retenue |
| « Chef, passe en 0,85 » (ou « débit », « vitesse ») | ce débit-là, retenu - en chiffres ou en mots, quoi que Whisper écrive : « 0,85 », « 0.85 », « zéro quatre-vingt-cinq » |
| « Chef, plus fort » / « moins fort » | le volume de sa voix, retenu pour cet agent |
| « Qui écoute ? » | la liste des agents inscrits et de leurs noms, lue |

Le minuteur est local exprès : un agent Claude n'a pas d'horloge qui sonne pendant que tu cuisines. Une commande ne vaut que si elle est **toute** la phrase :
« Chef, explique plus lentement la cuisson » part chez l'agent, comme n'importe quelle question.

## Ce que l'agent fait de son côté

**Ses réglages, demandés avec tes mots.** « Je préfère quand c'est Pierre, et un peu moins vite » : l'agent comprend et règle sa
propre voix avec une commande de l'outil (`voice.mjs set --voice pierre --rate 0.85`), puis répond avec elle. Les phrases
courtes du tableau ci-dessus font la même chose sans passer par lui. Les réglages sont retenus par agent.

Une règle dans son skill : un message qui commence par `[vocal]` vient d'une personne qui écoute sans regarder. Il répond en
phrases courtes, une étape à la fois, sans tableau ni code ni liste longue. Il écrit les quantités en toutes lettres (« deux
cents grammes ») et finit par ce qu'il attend (« dis-moi quand c'est fait »).

## Hors du périmètre v1

- Qu'un agent passe la parole à un autre à la voix (« Chef, demande à Work… ») : chacun reçoit seulement ce qui commence par
  son nom.
- Le téléphone, ou le PC à distance.
- Un moteur de mot d'appel dédié : le mot est reconnu dans le texte de Whisper. C'est plus simple, mais toute parole passe par
  la carte graphique.
- Couper la parole à l'agent pendant qu'il parle, si la mesure de l'écho dit non (voir plus bas).

## Les ressources

Whisper reste en mémoire tant que l'outil tourne : il occupe de la mémoire vidéo (1,5 à 3 Go selon le modèle), et de la RAM pour
le processus (à mesurer, probablement autour de 1 Go). Piper prend environ 100 Mo. L'outil tourne dans `agents.slice` avec un
plafond, et il est annoncé à work, comme mes portes. Téléchargements : environ 2 Go une fois (le modèle Whisper et ses
bibliothèques CUDA), plus environ 60 Mo par voix Piper.

## Les risques, et ce qui les tient

- **Une phrase mal comprise part chez l'agent** (« Chef, enlève le sel » entendu « …ajoute le sel »). Ce qui le tient : un son
  différent pour « entendu » et pour « envoyé ». La phrase transcrite est aussi visible dans la fenêtre. Et l'agent peut te
  relire ce qu'il a compris quand c'est important.
- **L'agent a ses outils et ses permissions** : une phrase vocale peut lui faire lancer une commande. Ce qui le tient : un agent
  de cuisine dans son propre dossier, sans rien de dangereux à portée.
- **Une conversation dans la cuisine** : seules les phrases qui commencent par le mot d'appel partent. Le reste est jeté sans
  être écrit.
- **L'agent occupé quand tu parles** : la règle du bus s'applique, rien n'est tapé pendant un tour. La phrase attend, et un son
  te dit qu'elle attend.

## À mesurer avant d'écrire le code

1. ~~La portée du casque jusqu'à la cuisine~~ : elle y va, dit le propriétaire.
2. **Whisper sur la RTX 2080** : la latence pour une phrase de 5 s (modèles `large-v3-turbo` et `medium`), et la justesse en
   français avec du bruit de cuisine (hotte, eau qui coule). **Mesuré le 2026-11-28, premier essai** (`large-v3-turbo`, int8,
   10 s de la voix du propriétaire, sans bruit) : « Chef, combien de temps pour cuire les pâtes ? » et « Work ? Où en es-tu ? »,
   justes, les deux noms reconnus en tête. **1,45 s** pour transcrire 10 s, 4 s de chargement une fois. **1,65 Gio de RAM**
   résidente (le pic de son scope) : c'est lourd sur cette machine. Un modèle plus petit, ou un autre moteur, est à comparer.
   Le niveau du micro est bas (-20 dB en crête, gain du PC à 100 %), et Whisper s'en accommode.
3. **L'écho** : la voix lue dans le casque revient-elle dans le micro ? Ça décide si « Chef, stop » peut couper une lecture.
4. **La RAM et la VRAM** de Whisper résident, pour l'arranger avec work.
5. **La voix** : trois voix Piper françaises, à te faire écouter (une par agent, peut-être).
6. **Les noms** : Whisper reconnaît-il « Chef », « Work », « Toolbox » en début de phrase, et sans les confondre ?
7. **Les nombres** : comment Whisper écrit « passe en 0,85 » et « minuteur dix minutes » dits par le propriétaire.

## À décider

- ~~Les noms vocaux~~ : **« Chef », « Work », « Toolbox »** au départ, changeables (le propriétaire, 2026-11-28).
- ~~La fenêtre de suite~~ : **20 s** (le propriétaire, 2026-11-28). **À revoir après la revue du plan (F2)** : partout, ou
  seulement pour le chef (work et ce dépôt peuvent agir) ?
- **Les permissions du chef** : le limiter à parler, chercher sur le web et lire son dossier (rien d'autre à portée d'une phrase
  mal comprise), ou le laisser tel quel ?
- ~~La RAM~~ : **1,65 Gio acceptés** par le propriétaire tant que l'outil tourne ; work prévenu au premier vrai lancement.
- ~~L'agent de cuisine~~ : il existe, dans son propre dossier, **sans le bus**. Il faut y installer le bus (un seul agent) et
  que le propriétaire redémarre sa session dans la même fenêtre (`/exit` puis `claude --continue`) pour qu'elle charge les hooks.
  **Accordé et fait le 2026-11-28** (le bus, un seul agent ; une règle de confidentialité pour son chemin). **Reste : le
  redémarrage de sa session**, par le propriétaire, quand elle n'est pas occupée.
- ~~La voix~~ : **les deux, Jessica et Pierre** (un même modèle), **Jessica au départ**, changeables à la voix (le propriétaire,
  2026-11-28). ~~Le débit de départ~~ : **0,85** (`--length-scale` 1,176 dans Piper).
- **Le temps sans parole** avant l'arrêt automatique.

## Ce que la revue du plan a changé (`exchange/REVIEW-voice-design-1.md`, 2026-11-28)

Verdict : **construire après ces changements**. L'architecture tient (la reconnaissance locale, le nom en tête, la frappe par la
bibliothèque de `wake.mjs`, la réponse prise au `Stop`). Ces corrections priment sur le texte plus haut.

1. **La réponse lue (F1).** On ne lit qu'**un seul `Stop` par phrase vocale** : le premier, quand `stop_hook_active` est faux, et
   seulement si la dernière vraie ligne d'utilisateur du tour est exactement le texte que l'outil a tapé. Ça écarte les sonnettes,
   les suites de courrier, les relais et ce que tu tapes au PC. Le texte de la réponse s'assemble comme le fait déjà l'outil de work
   `derniere-reponse.mjs` (repris, pas réécrit) : `last_assistant_message` est absent quand la réponse précède un outil. Si ce `Stop`
   a bloqué pour du courrier, une seule phrase fixe suit (« Chef a aussi reçu du courrier »).
2. **La fenêtre de suite (F2)** : une télé, une autre personne ou l'écho de l'agent auraient la même autorité que toi. **À
   décider par le propriétaire** (plus bas). Quel que soit son choix : 2 phrases sans nom au plus, jamais pendant la lecture ni
   juste après, un seuil de niveau (la voix près du micro, pas la pièce), et, pour un agent qui peut agir (work, ce dépôt), une
   confirmation par le nom avant tout acte irréversible.
3. **Chaque panne s'entend (F3).** Un son et une phrase pour : l'écoute qui meurt, Whisper en erreur, une erreur d'API ou une limite
   d'usage (le hook `StopFailure`), un dialogue de permission ou une question de l'agent (`Notification`), une frappe refusée. Et si
   le casque décroche : PipeWire bascule sur les haut-parleurs et le micro du PC. L'outil le voit et se met en pause, au lieu de
   parler à la pièce.
4. **Les minuteurs survivent à l'écoute (F4)** : chacun est un minuteur `systemd-run --user --on-active`, et redit à voix haute à
   sa pose (« minuteur de dix minutes posé »).
5. **La frappe (F5)** suit **toutes** les règles de `wake.mjs` (9 et 10 comprises) et les limites du relais : une ligne, sans
   antislash, 800 caractères au plus, sinon refusé et dit. Le préfixe `[vocal] ` reste. Un texte vocal resté dans une case est
   effacé par l'outil lui-même, jamais laissé aux autres.
6. **Une phrase qui attend a une borne (F6)** : 60 s. Passé ce délai, elle n'est pas envoyée et l'outil le dit. Ce que fait Claude
   Code d'un message tapé pendant un tour est à mesurer : s'il le garde en file proprement, on tape tout de suite.
7. **L'écoute a son propre service (F7)**, avec son plafond de mémoire et `Restart=on-failure`, hors de `agents.slice` (l'enveloppe
   des tests, où elle prendrait un tiers et serait la première tuée).
8. **L'écho (F8)** : l'écoute reprend une fois la lecture vidée, plus une marge. Une phrase entendue qui reprend la dernière
   réponse lue est jetée. Et le skill ne fait plus finir chaque réponse par « dis-moi… ».
9. **Une phrase mal comprise (F9)** : l'agent commence sa réponse par ce qu'il a compris, en quelques mots (« Pour les pâtes : … »).
   Loin du PC, c'est la seule vérification possible.
10. **Le lien à la fenêtre (F10)** est revérifié avant chaque phrase (le registre : pid, démarrage, transcription). La règle
    `[vocal]` est réinjectée à chaque démarrage de session d'un agent inscrit, pour survivre à un `/clear`.
11. **Le coût pour les autres agents (F11)** : un seul `stat` dans le `Stop` du stub pour un agent qui n'est pas en voix. Le passage
    de la réponse se fait par un fichier déposé, jamais par un tube ou une socket, qui bloquerait la fin de tour d'un agent si
    l'écoute était morte.
12. **Les pièges de lecture (F12)** : renommer exige une phrase explicite (« Chef, ton nom vocal est Cuistot ») et une confirmation.
    Un nom seul répond « oui ? ». Un « euh » avant le nom est toléré. Une commande ne vaut que si elle est la phrase entière.
13. **Rien sur le disque (F13)** : pas de journal de ce qui est entendu, pas de vidage mémoire du processus, le texte passé par
    fichier ou par l'entrée standard, jamais en argument (lisible dans `/proc`). L'enregistrement d'essai du propriétaire a été
    effacé le 2026-11-28.

**À mesurer en construisant** : la liste en fin de `REVIEW-voice-design-1.md` (l'écho, la perte du casque, Whisper sur le bruit, le
bouton de coupure du micro, ce que Claude Code fait d'un message tapé pendant un tour…).
