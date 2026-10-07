# ADR 0007 — Identité Socket.IO tirée de la session Auth.js

- **Statut :** accepté
- **Date :** 2026-10-07

## Contexte

Le serveur Socket.IO (ADR 0002) doit savoir qui envoie chaque événement, pour la liste des
participants puis pour la course. Un client ne doit pas pouvoir se faire passer pour quelqu'un
d'autre. Les sessions sont des JWT chiffrés dans un cookie (ADR 0004).

## Décision

- Au handshake Socket.IO, le serveur lit **uniquement l'en-tête `cookie`** et déchiffre le cookie
  de session Auth.js (`authjs.session-token`, ou `__Secure-authjs.session-token` en HTTPS)
  avec `AUTH_SECRET` via `getToken` d'Auth.js. Expiration et intégrité sont vérifiées.
- L'identité (id utilisateur ou `guest-<uuid>`, nom, photo, invité oui/non) est stockée dans
  `socket.data` ; les événements ne transportent **jamais** d'identité fournie par le client.
- Sans cookie valide, la connexion Socket.IO est refusée.
- Le navigateur reçoit des identifiants de participant opaques, jamais les identifiants de session.

Code : `src/server/socket-identity.ts` (testé), utilisé par `src/server/room-socket.ts`.

## Conséquences

- Même identité côté pages (via `auth()`) et côté temps réel, sans second mécanisme.
- Le cookie étant `SameSite=Lax`, un site tiers ne peut pas ouvrir de connexion au nom de l'utilisateur.
- Une session expirée coupe aussi l'accès temps réel à la reconnexion suivante.

## Alternatives écartées

- **Le client envoie son nom ou son id dans les événements** : usurpation triviale.
- **Jeton dédié émis par une route API** : second mécanisme à maintenir pour le même résultat.
- **Sessions en base consultées à chaque connexion** : incompatible avec les sessions JWT (ADR 0004).
