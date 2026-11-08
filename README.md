# Keyclue

[![CI](https://github.com/devzr24/typing-race/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/devzr24/typing-race/actions/workflows/ci.yml)

Courses de dactylographie multijoueurs en temps réel — projet de session du cours Web V.
On crée une salle, on invite des amis ou des bots, et tout le monde tape le même texte : la piste
montre la progression de chacun en direct, des bonus aident les retardataires, et les résultats
(podium, graphiques, records) sont conservés dans l'historique.

**Production :** https://typing-race-production-4a76.up.railway.app

**Comptes de démonstration** (créés par le seed, partagés, sans privilège) :

| Nom d'utilisateur | Mot de passe |
|---|---|
| `demo` | `TypingRace-demo-2026!` |
| `demo2` | `TypingRace-demo-2026!` |

## Captures

| Accueil | Salle d'attente |
|---|---|
| ![Accueil en thème foncé](docs/captures/accueil.png) | ![Salle avec bots et configuration](docs/captures/salle.png) |

| Course | Résultats |
|---|---|
| ![Zone de frappe, bonus et piste](docs/captures/course.png) | ![Podium, classement, MPM dans le temps, touches manquées](docs/captures/resultats.png) |

| Historique | Profil | Thème clair |
|---|---|---|
| ![Historique paginé](docs/captures/historique.png) | ![Statistiques personnelles](docs/captures/profil.png) | ![Accueil en thème clair](docs/captures/accueil-clair.png) |

## Fonctionnalités

- **Comptes** : GitHub, Discord, nom d'utilisateur + mot de passe, ou invité avec un pseudo ;
  photo de profil (JPEG, PNG, WebP, 2 Mo) et pseudonyme d'affichage modifiables.
- **Salles** : code de 6 caractères, visibilité publique / sur code / privée, liens d'invitation à
  usage unique, capacité de 2 à 30, expulsion, transfert d'hôte, explorateur des salles publiques
  en direct et partie rapide.
- **Configuration** en direct : langue (FR/EN), extrait cohérent ou mots aléatoires, longueur,
  complexité, ponctuation, chiffres, majuscules, accents, caractères imposés ou exclus, temps
  maximal, mode d'erreur, bonus, bots (cinq niveaux).
- **Course** : décompte synchronisé, zone de frappe avec retour immédiat (coller désactivé), MPM et
  précision en direct, piste interpolée, abandon confirmé, reprise après rechargement, bonus de
  remontée (−3 mots, +3 mots au meneur, brouillard). Le serveur valide chaque frappe.
- **Résultats** : podium, tableau complet, évolution du MPM de tous les participants, clavier des
  touches manquées, record personnel ; historique paginé et page de profil avec statistiques.
- **Interface** en français et en anglais (langue du navigateur par défaut), thème système / clair
  / foncé, utilisable au clavier (lien d'évitement, focus visible), effets désactivables.

## Technologies

Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS 4, PostgreSQL + Prisma 7
(`@prisma/adapter-pg`), Auth.js 5, Socket.IO sur un serveur Node personnalisé (`server.ts`, même
port que Next.js), Zod, sharp, motion, Vitest, Playwright + axe, GitHub Actions, hébergement
Railway. Aucun service temps réel externe.

## Installation locale

Prérequis : Node.js 24, Docker (pour PostgreSQL).

```bash
npm install
```

```bash
docker compose up -d --wait
```

```bash
cp .env.example .env
```

Remplir `.env` (voir ci-dessous), avec la base de `docker-compose.yml` :

```
DATABASE_URL="postgresql://dev:dev@localhost:5432/typing_race?schema=public"
```

```bash
npx prisma migrate dev
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Le site est sur http://localhost:3000 (port enregistré pour les retours OAuth GitHub/Discord).
Les données restent dans le volume `db-data` : `docker compose down` arrête la base,
`docker compose down -v` l'efface.

## Variables d'environnement

Modèle commenté : [`.env.example`](.env.example). `.env` n'est jamais commité.

| Variable | Rôle | Requise |
|---|---|---|
| `DATABASE_URL` | connexion PostgreSQL utilisée par Prisma | oui |
| `AUTH_SECRET` | secret de chiffrement des sessions Auth.js (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) | oui |
| `PORT` | port du serveur (3000 en local ; fourni par Railway) | non |
| `AUTH_URL` | adresse publique du site, **production seulement** (derrière le proxy Railway) | en production |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | application OAuth GitHub | pour GitHub |
| `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET` | application OAuth Discord | pour Discord |

En production, le serveur refuse de démarrer si `DATABASE_URL`, `AUTH_SECRET` ou (sur Railway)
`AUTH_URL` manque.

## Tests

| Commande | Rôle |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | types des routes Next puis `tsc --noEmit` |
| `npm test` | tests unitaires Vitest (logique des salles, de la course, des bots, des bonus, validation, sécurité) |
| `npm run build` puis `npm run test:e2e` | tests de bout en bout Playwright : parcours complets, course contre un bot, résultats, profil, audits d'accessibilité axe dans les deux thèmes |

Les tests de bout en bout démarrent eux-mêmes le serveur de production sur le port 3100 ; ils
demandent une base migrée (`DATABASE_URL`) et `AUTH_SECRET`. Ils utilisent la connexion par nom
d'utilisateur et mot de passe (pas d'OAuth). Contre un site en ligne :
`E2E_BASE_URL=https://typing-race-production-4a76.up.railway.app npm run test:e2e`.

La CI (GitHub Actions) lance lint, types, tests unitaires, build et tests de bout en bout avec un
PostgreSQL jetable sur chaque pull request.

## Autres commandes

| Commande | Rôle |
|---|---|
| `npm start` | serveur de production (`NODE_ENV=production tsx server.ts`), utilisé par Railway |
| `npm run db:migrate:deploy` | applique les migrations (`prisma migrate deploy`) |
| `npm run db:seed` | corpus de textes et comptes de démonstration (relançable) |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — vue d'ensemble, modèle de données, machine à états, flux temps réel, bots
- [Matrice des exigences](docs/EXIGENCES.md) — statut de chaque exigence de l'énoncé, fichiers et tests
- [Décisions d'architecture (ADR)](docs/adr/)
- [Utilisation de l'IA](docs/IA.md)
- [CLAUDE.md](CLAUDE.md) et [AGENTS.md](AGENTS.md) — instructions des agents et conventions du projet
