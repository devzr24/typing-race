# ADR 0008 — Migrations appliquées au démarrage du serveur sur Railway

- **Statut :** accepté
- **Date :** 2026-10-07

## Contexte

Les migrations Prisma devaient être appliquées par le `preDeployCommand` de `railway.json`.
En pratique, la migration `rooms` n'a jamais été appliquée en production : `/api/health`
montrait les migrations `init` et `auth` (appliquées depuis un poste de développement) mais
aucune trace de `rooms`, pas même un échec. Le pre-deploy ne s'exécutait donc pas, sans que
la cause soit visible depuis le dépôt. Résultat : la création de salle renvoyait une erreur 500.

## Décision

- `server.ts` lance `prisma migrate deploy` **au démarrage**, avant d'accepter des requêtes,
  quand il tourne en production sur Railway (`RAILWAY_ENVIRONMENT` défini, `src/server/migrate.ts`).
- Si une migration échoue, le serveur s'arrête avec le code 1 : la nouvelle version n'est pas mise en ligne.
- Le `preDeployCommand` est retiré de `railway.json` : un seul mécanisme.
- Le healthcheck Railway passe sur `/api/health`, qui vérifie l'accès à la base : une version
  qui ne peut pas joindre PostgreSQL n'est jamais mise en ligne.

## Conséquences

- Les migrations ne dépendent plus d'un réglage Railway invisible depuis le code.
- `npm start` en local ne migre pas (pas de `RAILWAY_ENVIRONMENT`) : on garde `prisma migrate dev`.
- Avec plusieurs instances, chacune lancerait `migrate deploy` ; Prisma les sérialise par un verrou
  consultatif. Nous n'avons qu'une instance (ADR 0002).
- Le démarrage est un peu plus long (quelques secondes).

## Alternatives écartées

- **Garder le pre-deploy** : ne s'exécutait pas, et la cause n'est pas visible depuis le dépôt.
- **Migrer à la main depuis un poste** : le port public de la base est bloqué sur le réseau de l'équipe,
  et c'est une étape facile à oublier.
