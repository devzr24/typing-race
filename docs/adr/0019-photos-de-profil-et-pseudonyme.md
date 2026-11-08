# ADR 0019 — Photos de profil et pseudonyme d'affichage

- **Statut :** accepté
- **Date :** 2026-11-08

## Contexte

Un utilisateur inscrit doit pouvoir téléverser une photo (JPEG, PNG, WebP, 2 Mo au plus,
validés côté serveur, image redimensionnée avant l'affichage — AUTH-04, SEC-02) et modifier
son pseudonyme d'affichage (AUTH-05). Le système de fichiers de Railway est éphémère : il
est effacé à chaque déploiement.

## Décision

- **Validation** : taille vérifiée avant lecture complète ; type réel déterminé par les
  octets magiques (JPEG, PNG, WebP), jamais par l'extension ni le type annoncé.
- **Redimensionnement serveur avec `sharp`** (déjà installé par Next.js pour l'optimisation
  d'images, désormais dépendance directe) : carré de 256 px, réencodé en WebP, métadonnées
  supprimées, décodage limité à 24 millions de pixels contre les « bombes » d'images.
- **Stockage en base** dans la table `UserAvatar` (octets, type, date), une ligne par
  utilisateur ; servie par `/api/avatars/[userId]` avec `Content-Type` fixé,
  `X-Content-Type-Options: nosniff` et une URL versionnée (`?v=`) mise en cache.
  `User.image` pointe vers cette URL.
- **Pseudonyme d'affichage** dans `User.name` (3 à 20 caractères, mêmes règles que le pseudo
  invité), affiché partout sous la forme `name ?? username`. Il est refusé s'il est égal,
  sans tenir compte de la casse, au nom d'utilisateur d'un autre inscrit. Le JWT est relu en
  base (`trigger: "update"`) après la modification : pas de reconnexion nécessaire.
- Les invités n'ont ni photo ni pseudonyme modifiable (AUTH-03).

## Conséquences

- Les photos survivent aux déploiements sans service de stockage externe ; au plus environ
  20 Ko par utilisateur en base.
- Un pseudonyme n'est pas unique : deux personnes peuvent s'afficher sous le même nom, comme
  les invités. Seule l'usurpation d'un nom d'utilisateur existant est bloquée.

## Alternatives écartées

- **Disque local** : effacé par Railway à chaque déploiement.
- **Stockage objet (S3, etc.)** : un service externe de plus à configurer pour quelques Ko.
- **Redimensionnement dans le navigateur seulement** : le serveur doit de toute façon
  revalider ; un client modifié enverrait l'image d'origine.
