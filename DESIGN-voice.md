# L'outil vocal : le périmètre, avant de construire

*Rédigé le 2026-11-28 avec le propriétaire. Rien n'est construit. Ce fichier fixe ce que l'outil fera, ce qu'il ne fera pas,
et ce qu'il faut mesurer avant d'écrire le code. On se lance quand tout ce qui est marqué « à décider » est tranché.*

## Le besoin

Parler à un agent Claude sans être devant le PC, avec le casque sans fil (Razer BlackShark V2 Pro, dongle USB : c'est la sortie
et le micro par défaut de la machine). Le premier usage : cuisiner avec un agent. Il faut pouvoir lui parler, entendre sa
réponse, réagir, et continuer la conversation.

**Déjà choisi :** un **mot d'appel** (seule une phrase qui commence par lui est envoyée), et **tout en local** (rien ne quitte le
PC). **Ajouté par le propriétaire le 2026-11-28 :** l'outil sert **à n'importe quel agent**, pas seulement à la cuisine (le leader
de work, celui de ce dépôt…), avec **un nom vocal par agent**, qu'il règle lui-même. Et le casque porte jusqu'à la cuisine.

## Ce qui existe déjà, mesuré le 2026-11-28

- **Claude Code a une dictée intégrée** (`/voice`), mais il faut tenir ou taper la barre d'espace. Elle ne marche pas loin du
  clavier. Et l'audio part chez Anthropic pour être transcrit. **Non retenue.**
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
   conversation. Passé ce délai, il faut redire le nom. Réglable, et désactivable.
4. **L'agent répond.** Au `Stop`, sa réponse est nettoyée pour l'oreille (sans markdown, sans liens, sans blocs de code) et lue
   dans le casque par une voix française locale (Piper). **Chaque agent peut avoir sa voix**, pour savoir qui parle.
5. **Pendant la lecture, le micro n'envoie rien** : l'agent ne s'entend pas lui-même.

**Un seul micro, plusieurs agents.** Tu dis (ou tu tapes) « lance le micro » dans la fenêtre d'un agent. L'écoute démarre si
elle ne tourne pas déjà, et cet agent s'y inscrit, sous son nom vocal et sur SA fenêtre, comme il arme son relais. Un deuxième
agent s'inscrit de la même façon, depuis sa fenêtre. Seule une fenêtre inscrite peut recevoir une phrase : jamais une autre.

**Le nom vocal** se règle par agent, dans le `.comm/config.json` de son projet (ou au lancement). Il est court de préférence
(« Chef », « Work », « Toolbox ») : on le dit à chaque phrase hors de la fenêtre de suite. Un nom plus long marche aussi. Deux
agents inscrits ne peuvent pas avoir le même nom, et un nom trop proche d'un autre est refusé à l'inscription.

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
| « Chef, débit zéro quatre-vingt-cinq » | ce débit-là, retenu |
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
   français avec du bruit de cuisine (hotte, eau qui coule).
3. **L'écho** : la voix lue dans le casque revient-elle dans le micro ? Ça décide si « Chef, stop » peut couper une lecture.
4. **La RAM et la VRAM** de Whisper résident, pour l'arranger avec work.
5. **La voix** : trois voix Piper françaises, à te faire écouter (une par agent, peut-être).
6. **Les noms** : Whisper reconnaît-il « Chef », « Work », « Toolbox » en début de phrase, et sans les confondre ?

## À décider

- **Les noms vocaux** de tes agents. « Chef » pour la cuisine. Pour les autres, court de préférence (voir plus haut).
- **La fenêtre de suite** : 20 s, plus, moins, ou pas du tout.
- **L'agent** : un agent de cuisine dans son propre dossier (recommandé, pour les permissions), ou n'importe quel agent ?
- ~~La voix~~ : **les deux, Jessica et Pierre** (un même modèle), **Jessica au départ**, changeables à la voix (le propriétaire,
  2026-11-28). **Reste à trancher : le débit de départ** (0,85, 0,90 ou 1).
- **Le temps sans parole** avant l'arrêt automatique.
