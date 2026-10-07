# ADR 0004 — Authentification avec Auth.js

- **Statut :** accepté
- **Date :** 2026-10-07

## Contexte

Exigences du client :

- **AUTH-01** : connexion avec GitHub et Discord ; nom d'utilisateur et photo viennent du compte.
- **AUTH-02** : compte classique nom d'utilisateur unique + mot de passe haché, **sans courriel**,
  sans « mot de passe oublié » ni MFA.
- **AUTH-03** : participation sans compte, en invité avec un pseudo temporaire.

Le cours impose Auth.js avec l'adaptateur Prisma.

## Décision

- **Auth.js v5** (`next-auth@5`, seule version prévue pour l'App Router) avec `@auth/prisma-adapter`.
  L'adaptateur ne déclare pas encore Prisma 7 : un `overrides` npm ciblé l'aligne sur notre version.
- **Sessions JWT** (cookie chiffré avec `AUTH_SECRET`) : Auth.js n'autorise pas les sessions en base
  avec un fournisseur par mot de passe. Les tables `Session` et `VerificationToken` ne sont donc pas créées.
- **Modèles** : `User` (nom unique, hachage optionnel, nom d'affichage, photo) et `Account`
  (lien GitHub/Discord). Les jetons d'accès OAuth ne sont pas conservés : on n'appelle pas ces API.
- **Aucun courriel stocké**, y compris pour GitHub/Discord (scopes réduits à `read:user` et `identify`).
  Conséquence voulue : pas de liaison automatique de comptes par courriel.
- **Mot de passe** : 8 à 128 caractères, haché avec **scrypt** (module `crypto` de Node,
  paramètres OWASP N=2^17, r=8, p=1, sel aléatoire, comparaison en temps constant).
- **Nom d'utilisateur** : 3 à 24 caractères, `a-z`, chiffres, `_`, `-`, commence par une lettre ou
  un chiffre, stocké en minuscules (unicité insensible à la casse).
- **Invités** : fournisseur `guest` qui ne crée rien en base ; le pseudo (choisi ou `invite-XXXX`)
  et `isGuest: true` vivent uniquement dans le jeton de session.
- **Proxy Railway** : `trustHost: true` dans la configuration.

## Conséquences

- Pas de dépendance native à compiler (scrypt est intégré à Node).
- Une session ne peut pas être révoquée côté serveur avant son expiration (limite des JWT).
- Un même joueur qui se connecte avec GitHub puis Discord obtient deux comptes distincts.
- Les pseudos d'invités ne sont pas réservés : un invité peut porter le nom d'un inscrit (affiché « invité »).
- Les secrets (`AUTH_SECRET`, identifiants OAuth) vivent dans `.env` et dans Railway, jamais dans le code.

## Alternatives écartées

- **Sessions en base** : incompatibles avec la connexion par mot de passe dans Auth.js.
- **bcrypt / argon2** : dépendances natives (compilation sous Windows et sur Railway) pour un gain nul ici.
- **Stocker les invités en base** : inutile tant qu'aucune donnée ne doit leur survivre.
- **Better Auth / Lucia / solution maison** : Auth.js est imposé par le cours.
