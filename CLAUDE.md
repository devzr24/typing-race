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
- `src/lib/rooms/` — salles : codes, service (créer/rejoindre/quitter/transfert d'hôte), stockage
  Prisma et en mémoire (tests), actions serveur, événements Socket.IO typés.
- `src/server/` — côté Socket.IO : identité tirée du cookie Auth.js, abonnements aux salles,
  départs différés ; `realtime.ts` partage l'instance Socket.IO avec les actions de Next.
- `src/app/room/[code]` — page de salle (liste des participants en direct).
- `src/i18n/` — langues (ADR 0009) : `messages/fr.ts` (référence) et `en.ts`, `format()`,
  `errorText()`, lecture des cookies `lang`/`theme`.
- `src/app/globals.css` — SEUL endroit des couleurs, polices et effets visuels (direction artistique Keyclue, ADR 0010).
- `src/components/effects.tsx`, `clue-network.tsx` — intro, slogan tapé, réseau d'indices, boutons Son / Effets.
- `docs/adr/` — décisions d'architecture (ADR). Toute nouvelle décision structurante = nouvel ADR.

## Interface

- **Aucun texte en dur** dans les composants : tout passe par `src/i18n/messages/` (FR et EN).
  Les validations et actions renvoient des codes d'erreur (`ErrorCode`), jamais des phrases.
- **Aucune couleur ni police en dur** : uniquement les jetons de `globals.css` (palette Keyclue) :
  `neon` (boutons principaux), `cyan` (indices, progression), `alert` (erreurs), `ink` (texte),
  `night` (fond), `card` (cartes), `steel` (lettre courante, avatars, route), `mist` (texte secondaire),
  `line` (bordures) ; polices `font-logo`, `font-display`, `font-sans`, `font-mono`.
- Texte sur fond `neon` : couleur `night`. Boutons : `primaryButtonClass` / `heroButtonClass` / `buttonClass`.
- Ne pas inventer de choix visuels : la direction artistique est celle de l'utilisateur ; ne rien ajouter sans sa demande.
- Tout effet animé passe par le bouton « Effets » (classe `fx-off`) et respecte `prefers-reduced-motion`.

## Documentation

- `docs/matrice-des-exigences.md` : mettre à jour le statut, les fichiers et les tests de chaque
  exigence touchée, à chaque checkpoint.
- `docs/architecture/` : modèle de données (Mermaid `erDiagram`) et machine à états de la salle
  (`stateDiagram`) ; les mettre à jour avec toute migration ou nouvelle transition.

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

Configuré dans `railway.json` : build `npm run build`, puis `npm start`. Au démarrage sur
Railway, `server.ts` applique les migrations (`prisma migrate deploy`) avant d'écouter (ADR 0008).
Healthcheck : `/api/health` (version, accès base, état des migrations).
Node fixé par `engines` (24.x). Le serveur écoute sur `0.0.0.0` et le `PORT` fourni par Railway.

Au démarrage en production, `server.ts` s'arrête (code 1, message explicite) si `DATABASE_URL`
ou `AUTH_SECRET` manque, ainsi que `AUTH_URL` sur Railway (`src/server/env.ts`).

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
