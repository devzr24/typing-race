@AGENTS.md

# Typing Race — projet scolaire (cours Web V)

Plateforme de courses de dactylographie multijoueurs en temps réel.

## Règle d'or

**On n'implémente que ce que le checkpoint en cours demande.** Pas d'anticipation :
si une fonctionnalité (course, statistiques, bots, authentification, salles…) n'est pas
explicitement demandée par le checkpoint, on ne la code pas, même partiellement.

## Contraintes non négociables

- **Next.js (App Router) + React**, **TypeScript uniquement** : aucun fichier `.js`/`.mjs`
  quand une version `.ts` est possible (`next.config.ts`, `eslint.config.ts`, `prisma.config.ts`…).
- **Tailwind CSS** pour le style.
- **PostgreSQL + Prisma** (Prisma 7, adaptateur `@prisma/adapter-pg`).
- **Hébergement Railway** (HTTPS automatique, déploiement à chaque push).
- **Temps réel fait maison** : Socket.IO sur le serveur Node personnalisé `server.ts`,
  qui sert aussi Next.js sur le même port. **Aucun service temps réel externe**
  (pas de Pusher, Ably, Supabase Realtime, etc.).

## Structure

- `server.ts` — serveur HTTP unique : Next.js + Socket.IO, port lu depuis `PORT`.
- `src/app/` — pages (App Router).
- `src/server/` — code exécuté côté serveur Node (config, plus tard : logique Socket.IO).
- `src/lib/prisma.ts` — instance unique de Prisma Client.
- `prisma/schema.prisma` — schéma de la base ; client généré dans `src/generated/prisma` (ignoré par Git).
- `src/auth.ts` — configuration Auth.js (GitHub, Discord, nom d'utilisateur + mot de passe, invité).
- `src/lib/auth/` — règles de validation, hachage scrypt, actions serveur des formulaires.
- `src/app/login`, `src/app/register` — pages de connexion et d'inscription.
- `docs/adr/` — décisions d'architecture (ADR). Toute nouvelle décision structurante = nouvel ADR.

## ADR

- Un ADR **accepté ne se modifie jamais**. Si une décision change, on écrit un **nouvel ADR**
  qui remplace l'ancien ; le nouvel ADR l'indique dans son en-tête (« Remplace : ADR XXXX »).
- Numérotation continue (`0001`, `0002`…), format court : contexte, décision, conséquences,
  alternatives écartées.

## Commandes

- `npm run dev` — serveur de développement (`tsx server.ts`).
- `npm run build` — `prisma generate` puis `next build`.
- `npm start` — production (`NODE_ENV=production tsx server.ts`), utilisé par Railway.
- `npm run db:migrate:deploy` — applique les migrations (`prisma migrate deploy`).
- `npm run lint` — ESLint.
- `npm test` — Vitest.

## Déploiement (Railway)

Production : https://typing-race-production-4a76.up.railway.app (redéployé à chaque push sur `master`).

Configuré dans `railway.json` : build `npm run build`, puis avant chaque mise en ligne
`npm run db:migrate:deploy` (pre-deploy), puis `npm start`. Node fixé par `engines` (24.x).
Le serveur écoute sur `0.0.0.0` et le `PORT` fourni par Railway.

`AUTH_URL` (production seulement) : définie dans Railway avec l'URL de production. Derrière le
proxy Railway, l'application reçoit `localhost:8080` comme hôte ; sans `AUTH_URL`, Auth.js
enverrait cette adresse comme retour OAuth. Ne pas la définir en local.

## Variables d'environnement

Voir `.env.example`. `.env` n'est jamais commité. Aucun secret dans le code.
En local, le serveur doit tourner sur le port 3000 : c'est l'adresse de retour OAuth enregistrée.

## Commits

- Format **Conventional Commits** : `type(portée): description courte en français`.
- Types : `feat`, `fix`, `docs`, `test`, `ci`, `chore`, `refactor`, `style`.
- Portées : `auth`, `lobby`, `room`, `db`, `deploy`, `i18n`, `theme`, `ui`, `ci`, `adr`.
- Un commit par étape logique ; première ligne de moins de 72 caractères.
- Toujours montrer `git status` avant de commiter.
- Ne jamais commiter `.env`.
- Ne pousser que sur demande explicite.
