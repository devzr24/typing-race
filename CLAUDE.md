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
- `docs/adr/` — décisions d'architecture (ADR). Toute nouvelle décision structurante = nouvel ADR.

## Commandes

- `npm run dev` — serveur de développement (`tsx server.ts`).
- `npm run build` — `prisma generate` puis `next build`.
- `npm start` — production (`NODE_ENV=production tsx server.ts`), utilisé par Railway.
- `npm run db:migrate:deploy` — applique les migrations (`prisma migrate deploy`).
- `npm run lint` — ESLint.
- `npm test` — Vitest.

## Déploiement (Railway)

Configuré dans `railway.json` : build `npm run build`, puis avant chaque mise en ligne
`npm run db:migrate:deploy` (pre-deploy), puis `npm start`. Node fixé par `engines` (24.x).
Le serveur écoute sur `0.0.0.0` et le `PORT` fourni par Railway.

## Variables d'environnement

Voir `.env.example`. `.env` n'est jamais commité.
