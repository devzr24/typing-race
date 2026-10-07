# ADR 0003 — Prisma + PostgreSQL

- **Statut :** accepté
- **Date :** 2026-10-07

## Contexte

L'application devra stocker des données relationnelles : utilisateurs, salles, résultats de courses.
On veut un accès typé depuis TypeScript et des migrations versionnées.

## Décision

Utiliser **PostgreSQL** comme base et **Prisma 7** comme ORM, avec le générateur `prisma-client`
(client généré dans `src/generated/prisma`) et l'adaptateur `@prisma/adapter-pg`.
L'URL de connexion est lue depuis `DATABASE_URL` (`prisma.config.ts` et `src/lib/prisma.ts`).

## Conséquences

- Requêtes typées automatiquement à partir de `prisma/schema.prisma`.
- Migrations versionnées dans `prisma/migrations` (`prisma migrate`).
- Il faut relancer `prisma generate` après chaque changement de schéma (le build le fait).
- Il faut une base PostgreSQL pour le développement local (Docker ou base Railway).

## Alternatives écartées

- **SQLite :** simple en local, mais différent de la base de production et mal adapté à Railway.
- **MongoDB :** les données sont relationnelles ; pas d'intérêt ici.
- **Drizzle / Kysely :** viables, mais Prisma est imposé par le cours.
- **SQL brut avec `pg` :** pas de typage automatique ni d'outil de migration.
