# ADR 0012 — Limitation des tentatives de connexion et refus de la liaison OAuth

- **Statut :** accepté
- **Date :** 2026-11-07

## Contexte

L'audit de l'authentification a relevé deux failles :

1. **Aucune limite de tentatives.** Un hachage scrypt (N = 2^17) coûte environ 0,74 s et 128 Mo,
   et Node n'en calcule que 4 à la fois. Envoyer en boucle des identifiants bien formés à
   `/api/auth/callback/credentials`, qu'on peut appeler directement sans passer par le formulaire,
   bloque toutes les connexions. Cela peut aussi faire tomber le conteneur Railway par manque de mémoire,
   et rien ne freine les essais de mots de passe en masse.
2. **Liaison silencieuse d'un compte OAuth.** Avec des sessions JWT, Auth.js relie un compte
   GitHub/Discord au compte déjà connecté. Sur un poste partagé, la personne suivante qui clique
   « GitHub » relie son compte à celui resté ouvert et garde ensuite l'accès à ce compte.

## Décision

- **Limiteur en mémoire** (`src/lib/auth/rate-limit.ts`), dans le processus Node, sans service externe :
  - connexion : 20 tentatives / 10 min par adresse IP, et 10 échecs / 10 min par nom d'utilisateur
    (le compteur repart de zéro après une connexion réussie) ;
  - inscription : 5 / heure par adresse IP ;
  - contrôle placé dans `authorize` (il couvre donc aussi un appel direct à l'adresse de connexion
    d'Auth.js), avant tout hachage ; erreur affichée `tooManyAttempts`.
- **Adresse IP** : dernière valeur de `X-Forwarded-For` (ajoutée par le proxy Railway), puis `X-Real-IP`.
  La première valeur, que le client peut écrire lui-même, est ignorée.
- **Plafond des hachages** (`src/lib/auth/password.ts`) : 2 calculs scrypt simultanés au plus et
  une file de 8. Au-delà, refus immédiat (`tooManyAttempts`) au lieu d'une attente sans fin.
- **Pas de liaison multi-fournisseurs** (cohérent avec l'ADR 0005 : un compte par fournisseur) :
  `linkAccount` refuse un utilisateur qui a déjà un mot de passe ou un compte relié, et lève
  `OAuthAccountNotLinked`. `/login` affiche `oauthAlreadySignedIn`. `/login` et `/register`
  redirigent vers l'accueil si une session est ouverte (sauf pour afficher une erreur sur `/login`).

## Conséquences

- Les compteurs repartent de zéro à chaque redémarrage, et ne seraient pas partagés entre
  plusieurs instances. C'est suffisant tant que Railway ne fait tourner qu'une instance.
- Un attaquant peut bloquer temporairement la connexion par mot de passe d'un nom précis en accumulant
  10 échecs. C'est un compromis accepté, car la connexion GitHub/Discord et le mode invité restent disponibles.
- Derrière un même NAT (labo du cégep), tous les postes partagent la limite par IP de 20 tentatives / 10 min.
- Le code d'erreur public `OAuthAccountNotLinked` dépend de l'ordre interne d'Auth.js (journal appelé
  avant la lecture du type d'erreur), vérifié par `src/lib/auth/auth.test.ts` : à recontrôler à chaque
  mise à jour d'`@auth/core`.

## Alternatives écartées

- **Limiteur dans Redis ou un service externe** : une dépendance de plus pour une seule instance.
- **Limiteur en base PostgreSQL** : une écriture par tentative, ce qui ajoute de la charge pendant une attaque.
- **Abaisser les paramètres scrypt** : affaiblit le hachage au lieu de borner la charge.
- **Permettre la liaison après confirmation** : écran supplémentaire non demandé par le checkpoint.
