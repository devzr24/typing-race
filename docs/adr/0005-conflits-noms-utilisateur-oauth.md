# ADR 0005 — Conflits de noms d'utilisateur à la connexion GitHub/Discord

- **Statut :** accepté
- **Date :** 2026-10-07

## Contexte

Le nom d'utilisateur est unique (ADR 0004). À la première connexion GitHub ou Discord, on reprend
le nom du compte externe, qui peut déjà être pris : par un compte classique, ou par quelqu'un qui
a le même nom sur l'autre plateforme. Discord accepte aussi des caractères que nous refusons (le point).

## Décision

Décision de l'équipe : **ajouter un suffixe numérique** quand le nom est pris.

1. Le nom externe est normalisé selon nos règles : minuscules, caractères interdits remplacés par `-`,
   tirets en double fusionnés, `_`/`-` retirés en début et fin, 24 caractères maximum,
   complété par `_` s'il fait moins de 3 caractères, `joueur` s'il est vide.
2. Si ce nom est libre, il est utilisé. Sinon on essaie `nom-2`, `nom-3`, etc.
   La base est raccourcie pour que le nom suffixé tienne en 24 caractères.
3. Si deux inscriptions simultanées visent le même nom, la contrainte d'unicité de la base
   rejette la seconde, qui recommence avec le suffixe suivant.

Le suffixe n'est appliqué **qu'aux comptes GitHub/Discord**. À l'inscription classique, un nom
déjà pris est refusé avec le message « Ce nom d'utilisateur est déjà pris. »

Code : `findAvailableUsername` et `usernameFromProvider` dans `src/lib/auth/username.ts`,
appelées par `createUser` dans `src/auth.ts`.

## Conséquences

- La connexion GitHub/Discord ne bloque jamais à cause d'un nom déjà pris.
- Le nom affiché peut différer du nom GitHub/Discord (`alex-2`), sans que l'utilisateur l'ait choisi.
- Le nom est fixé à la création du compte : un changement ultérieur sur GitHub/Discord n'est pas repris.

## Alternatives écartées

- **Refuser la connexion et demander un autre nom** : ajoute un écran et casse la connexion en un clic.
- **Suffixe aléatoire (`alex-7f3a`)** : moins lisible ; l'équipe a choisi un suffixe numérique.
- **Préfixe par fournisseur (`gh-alex`)** : alourdit tous les noms, même sans conflit.
