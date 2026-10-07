# Typing Race

[![CI](https://github.com/devzr24/typing-race/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/devzr24/typing-race/actions/workflows/ci.yml)

Plateforme de courses de dactylographie multijoueurs en temps réel — projet scolaire (cours Web V).
Nom, palette et polices provisoires : la direction artistique viendra plus tard.

**Production :** https://typing-race-production-4a76.up.railway.app

Déjà disponible : connexion GitHub / Discord / nom d'utilisateur ou en invité, salles rejointes
par code avec liste des participants en temps réel, site en français et en anglais, thème clair et foncé.

## Pile technique

Next.js (App Router) + React + TypeScript, Tailwind CSS, PostgreSQL + Prisma, Auth.js,
Socket.IO sur un serveur Node personnalisé (`server.ts`), hébergement Railway.

## Lancer en local

Prérequis : Node.js 24, une base PostgreSQL.

```bash
npm install
cp .env.example .env        # puis remplir les valeurs (voir les commentaires du fichier)
npx prisma migrate dev      # crée les tables dans la base de DATABASE_URL
npm run dev                 # http://localhost:3000
```

Le port 3000 est celui enregistré pour les retours OAuth GitHub/Discord.

Base locale jetable avec Docker (facultatif) :

```bash
docker run -d --name typing-race-db -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=typing_race -p 5432:5432 postgres:17
# DATABASE_URL="postgresql://dev:dev@localhost:5432/typing_race?schema=public"
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement (Next.js + Socket.IO) |
| `npm run build` | client Prisma + build Next.js |
| `npm start` | serveur de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | vérification TypeScript |
| `npm test` | tests unitaires (Vitest) |
| `npm run test:e2e` | tests de bout en bout (Playwright ; après `npm run build`, base migrée, `AUTH_SECRET` défini) |

Pour lancer les tests de bout en bout contre un site en ligne :
`E2E_BASE_URL=https://typing-race-production-4a76.up.railway.app npm run test:e2e`.

## Documentation

- [Matrice des exigences](docs/matrice-des-exigences.md) — état de chaque exigence du cahier des charges
- [Modèle de données](docs/architecture/modele-de-donnees.md) — tables actuelles et prévues
- [Machine à états d'une salle](docs/architecture/machine-a-etats.md)
- [Décisions d'architecture (ADR)](docs/adr/) — de l'hébergement aux migrations et à la langue
- [CLAUDE.md](CLAUDE.md) — contraintes du projet et conventions (commits, ADR, interface)
