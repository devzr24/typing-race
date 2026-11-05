---
name: verification
description: Vérifier un changement avec les commandes du projet (lint, types, Vitest, Playwright) avant toute relecture par un LLM. Après chaque implémentation.
---
# Verification

Utiliser d'abord le contrôle le moins cher capable de valider correctement le changement ; ne pas lancer automatiquement la suite complète quand une vérification ciblée suffit.

Dans l'ordre, en s'arrêtant à ce qui est pertinent :
1. types : `npm run typecheck` ;
2. lint : `npx eslint <fichiers modifiés>` (tout le projet : `npm run lint`) ;
3. tests ciblés : `npx vitest run <fichier de test>` ;
4. suite complète `npm test` seulement si le changement est transversal (salles, auth, Socket.IO, Prisma) ;
5. parcours de bout en bout `npm run test:e2e` pour une feature visible terminée ;
6. build `npm run build` seulement si la config, Prisma ou le serveur a changé ;
7. `git diff --stat` puis `git diff` et `git status` : périmètre conforme au brief, aucun fichier parasite (`.env`, client Prisma généré).

TINY ou SMALL : si ces étapes démontrent que la tâche est réussie, pas de relecture par LLM. MEDIUM ou LARGE : la relecture a lieu une seule fois, sur la feature terminée.
Un échec de vérification retourne au développeur initial avec l'erreur exacte (extrait court).
Ne jamais déclarer terminé sans avoir exécuté au moins une vérification réelle ou signalé qu'aucune n'existe.
