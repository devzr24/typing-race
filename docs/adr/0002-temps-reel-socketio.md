# ADR 0002 — Temps réel fait maison avec Socket.IO

- **Statut :** accepté
- **Date :** 2026-10-07

## Contexte

Les courses multijoueurs exigent d'envoyer en direct la progression de chaque joueur aux
autres. Le cours impose un temps réel fait maison, sans service externe.

## Décision

Utiliser **Socket.IO** attaché au même serveur HTTP que Next.js, dans un serveur Node
personnalisé `server.ts`. Next.js sert les pages ; Socket.IO intercepte les requêtes
`/socket.io/`. Un seul processus, un seul port.

## Conséquences

- On contrôle entièrement le protocole et l'état des courses côté serveur.
- Reconnexion automatique et repli sur le long polling fournis par Socket.IO.
- On ne peut plus utiliser `next start` ni le mode `output: "standalone"` : on démarre avec `tsx server.ts`.
- L'état en mémoire vit dans un seul processus : un passage à plusieurs instances demanderait un adaptateur (ex. Redis), hors du périmètre actuel.

## Alternatives écartées

- **Services externes (Pusher, Ably, Supabase Realtime, Firebase) :** interdits par le cours.
- **WebSocket natif (`ws`) :** plus bas niveau ; il faudrait recoder la reconnexion, les salles et les accusés de réception.
- **Server-Sent Events / polling :** communication à sens unique ou trop lente pour une course.
- **Serveur Socket.IO séparé :** deux services et deux ports à déployer, plus CORS à gérer.
