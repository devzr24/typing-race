# ADR 0013 — Corpus et comptes de démonstration chargés au démarrage

- **Statut :** accepté
- **Date :** 2026-11-07

## Contexte

L'énoncé (TECH-04) demande un script de seed créant des données de démonstration : corpus de
textes, utilisateurs et historique. Le corpus n'est pas qu'une démonstration : sans lui, aucune
course ne peut être générée en production (CONF-03). Le README doit aussi fournir un compte de
démonstration utilisable sur l'URL de production.

## Décision

- Corpus en fichiers TypeScript versionnés (`prisma/corpus/`) : extraits du domaine public
  (`Passage`, 20 par langue, attribution et source Project Gutenberg en commentaire) et mots
  courants (`Word`, environ 1000 par langue, rang de fréquence approximatif).
- Seed `prisma/seed.ts` déclaré dans `prisma.config.ts`, lancé par `npm run db:seed`. Il est
  **idempotent** : upsert des extraits par `slug`, `createMany` sans doublon pour les mots,
  comptes `demo` et `demo2` créés seulement s'ils n'existent pas (jamais écrasés).
- Sur Railway, `server.ts` lance le seed **au démarrage, juste après les migrations**
  (même condition que l'[ADR 0008](0008-migrations-au-demarrage.md)). Contrairement aux migrations,
  un échec du seed est journalisé sans arrêter le démarrage : le corpus déjà en base reste utilisable,
  et une panne passagère de la base ne doit pas empêcher la mise en ligne.
- Les extraits sont normalisés pour être tapables sur un clavier ordinaire : apostrophes et guillemets
  droits, tirets simples, `...` au lieu de `…`, sans espaces insécables. Les lettres accentuées restent.
- Le mot de passe des comptes de démonstration est une constante publique (`prisma/corpus/load.ts`),
  destinée au README : ces comptes n'ont aucun privilège.

## Conséquences

- Une base neuve (production, CI, poste local) a toujours le corpus nécessaire aux courses.
- Modifier le corpus = modifier les fichiers et redéployer ; les extraits existants sont mis à jour.
  Les mots, eux, ne sont jamais mis à jour : un mot retiré reste en base, et un rang modifié
  dans les fichiers n'est pas répercuté. Toute modification de la liste de mots passera par une
  migration de données.
- Un compte `demo` ou `demo2` déjà inscrit par quelqu'un d'autre n'est pas écrasé : le mot de
  passe du README ne fonctionnerait alors pas pour ce compte.
- Les comptes de démonstration sont partagés : n'importe qui peut s'y connecter, et leurs futures
  statistiques et leur historique ne prouvent rien. Un compte supprimé est recréé au démarrage suivant.
- Démarrage un peu plus long (quelques secondes pour environ 2000 lignes).
- L'historique de démonstration attend les tables de résultats (RES-05) : TECH-04 reste partiel.

## Alternatives écartées

- **Seed lancé à la main** sur la production : étape facile à oublier, et le port public de la base
  est bloqué sur le réseau de l'équipe (ADR 0008).
- **Corpus inséré par une migration SQL** : illisible, et toute correction de texte demanderait une
  nouvelle migration.
- **Mot de passe de démonstration dans une variable d'environnement** : il doit de toute façon
  figurer dans le README ; une variable de plus à configurer pour aucun gain de sécurité.
