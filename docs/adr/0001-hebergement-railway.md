# ADR 0001 — Hébergement sur Railway

- **Statut :** accepté
- **Date :** 2026-10-07

## Contexte

L'application doit être accessible en ligne en HTTPS. Elle utilise un serveur Node
personnalisé (`server.ts`) qui garde des connexions WebSocket ouvertes en permanence
(Socket.IO), ainsi qu'une base PostgreSQL.

## Décision

Héberger l'application et la base PostgreSQL sur **Railway**. Railway construit le projet
(`npm run build`) puis le lance (`npm start`) à chaque push sur la branche principale,
fournit le port via `PORT` et la base via `DATABASE_URL`.

URL de production : https://typing-race-production-4a76.up.railway.app

## Conséquences

- HTTPS automatique et déploiement continu sans configuration supplémentaire.
- Processus Node qui tourne en continu : compatible avec les WebSockets et un serveur personnalisé.
- Base PostgreSQL gérée dans le même projet Railway.
- Le serveur doit lire `PORT` depuis l'environnement (fait dans `src/server/config.ts`).
- Les secrets sont configurés dans Railway, jamais dans le dépôt.

## Alternatives écartées

- **Vercel :** fonctions serverless, ne supporte pas un serveur personnalisé ni des WebSockets persistants.
- **VPS auto-géré (ex. DigitalOcean) :** HTTPS, déploiement et base à configurer à la main ; trop de maintenance pour un projet scolaire.
- **Render / Fly.io :** viables, mais Railway est imposé par le cours.
