# Utilisation de l'IA

L'énoncé exige que le nom et le logo viennent de l'étudiant, sans IA (DES-01, DES-02) : ils ne
font pas partie du travail confié aux agents. Le code a été produit avec des agents ; chaque
changement passe par une branche, une pull request, la CI (lint, types, Vitest, build,
Playwright) et une relecture.

## Agents et outils

| Outil | Rôle |
|---|---|
| **Claude Code** (Claude Opus) | orchestrateur : comprend la demande, la situe dans l'énoncé, découpe, rédige les briefs, vérifie, tranche les constats de relecture, écrit les ADR et la documentation, fait les commits et les pull requests. Code lui-même seulement les très petites corrections. |
| **Codex** (« Sol », via `.claude/scripts/delegate.ts`) | développeur principal : écrit les features à partir d'un brief court, avec leurs tests. |
| Claude Sonnet (sous-agent `reviewer`) | relit le code écrit par Codex (relecture croisée : jamais l'auteur). |
| Claude Sonnet (sous-agent `sonnet-dev`) | relève de Codex si son quota est épuisé ; son code est alors relu par Codex. |
| Claude Haiku (sous-agent `researcher`) | exploration du code et de la documentation des librairies ; ne code pas. |
| Playwright, axe, Lighthouse | vérification réelle : parcours de bout en bout, accessibilité, performance, captures. |

## Fichiers d'instructions (commités)

- [`CLAUDE.md`](../CLAUDE.md) : règle d'or (ne coder que ce que le checkpoint demande), contraintes
  techniques, interface (aucun texte ni couleur en dur), ADR, commits, branches, déploiement.
- [`AGENTS.md`](../AGENTS.md) : avertissement Next.js 16 (lire la documentation locale avant de coder).
- [`.claude/workflow/orchestrator.md`](../.claude/workflow/orchestrator.md) : boucle de travail,
  choix de l'agent, relecture croisée, développement en parallèle, pipelines.
- [`.claude/agents/`](../.claude/agents/) : `researcher`, `reviewer`, `sonnet-dev`.
- [`.claude/skills/`](../.claude/skills/) : `minimal-patch`, `revue`, `task-handoff`,
  `token-budget`, `verification`.
- [`.claude/scripts/delegate.ts`](../.claude/scripts/delegate.ts) : pont vers Codex (délégation,
  relecture, quota).

## Trois situations où l'IA s'est trompée

### 1. Une course qui ne se termine jamais

Le moteur de course écrit par Codex abandonnait bien un joueur déconnecté depuis 30 s, mais pas un
joueur qui quittait la salle ou qui était expulsé pendant la course. Ce coureur restait « en
course » pour toujours : sans temps maximal, la salle ne passait jamais en résultats. Le même lot
ouvrait une transaction Postgres avec verrou (`SELECT … FOR UPDATE`) à chaque paquet de frappes,
soit jusqu'à 300 verrous par seconde à 30 joueurs.
**Détection** : relecture croisée par Sonnet (scénario « B quitte, A finit, la salle reste
bloquée ») et lecture du chemin `race:input`.
**Correction** : abandon du coureur dans le départ volontaire et l'expulsion, départ de la salle
après l'abandon pour déconnexion (transfert d'hôte), validation des frappes entièrement en mémoire,
limite de débit par joueur et non par onglet ; tests ajoutés pour chaque cas.

### 2. Un pseudonyme enregistré mais pas affiché

Pour le changement de pseudonyme sans reconnexion, Codex réécrivait le jeton de session puis
rafraîchissait la page côté serveur ; les tests unitaires passaient. Le test de bout en bout, lancé
sur une base PostgreSQL locale jetable, montrait pourtant l'ancien nom dans l'en-tête. Ma première
correction (un `refresh()` dans l'action serveur) échouait aussi : ce rendu lit encore les cookies
de la requête entrante, donc l'ancien jeton.
**Détection** : test Playwright et instantané de la page (nouveau nom dans le profil, ancien dans
l'en-tête).
**Correction** : `router.refresh()` côté client après l'enregistrement : une nouvelle requête qui
porte le nouveau cookie. Le même test a ensuite révélé une photo non affichée (double
optimisation d'image) et un sélecteur de test fragile, corrigés à leur tour.

### 3. Des optimisations de performance déclarées, mais non mesurées

Pour la fluidité à 30 coureurs, Codex a appliqué des optimisations plausibles (isolation CSS,
mémoïsation) et les a déclarées faites ; la mesure réelle (Chromium, processeur ralenti ×4) donnait
5 images par seconde. Dans la même passe, il avait remplacé l'animation du glitch du logo par une
image fixe, contrairement à la consigne de préserver la direction artistique.
**Détection** : mesure par bissection (masquer une partie de la page, remesurer) : d'abord la
piste, puis la zone de frappe (un élément par caractère, re-rendu à chaque touche), puis la route
animée et les transitions des marqueurs ; le glitch a été relevé par la relecture croisée.
**Correction** : texte rendu par segments, MPM affiché à 2 Hz, effets figés pendant la course,
animation du logo rétablie. L'objectif de 50 images/s n'est toujours pas atteint avec la piste à
l'écran dans ce cadre de mesure : l'exigence PERF-03 est déclarée **partielle** avec les chiffres,
et le test correspondant est marqué `fixme` plutôt que d'abaisser son seuil.

## Façon de travailler avec les agents

Ce qui a fonctionné :

- **Des briefs courts et vérifiables** (fichiers concernés, critères d'acceptation, tests attendus)
  plutôt que de longues explications.
- **La relecture croisée** : l'agent qui relit n'est jamais celui qui a écrit ; chaque relecture a
  trouvé au moins un vrai défaut.
- **La vérification réelle avant de croire un compte rendu** : « tests verts » ne voulait pas dire
  « fonctionne » (cas 2 et 3). Les mesures et les tests de bout en bout tranchent.
- **L'honnêteté de la matrice** : une exigence non atteinte reste « partielle », avec ce qui manque.

> **À compléter par l'étudiant** : réflexion personnelle (ce que j'ai appris, ce que je referais
> autrement, la part de mon jugement dans les décisions).
