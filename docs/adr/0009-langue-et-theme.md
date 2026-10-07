# ADR 0009 — Langue (FR/EN) et thème (clair/foncé) mémorisés par cookie

- **Statut :** accepté
- **Date :** 2026-10-07

## Contexte

UI-01 : site bilingue français/anglais (français par défaut) et thème clair/foncé (thème du
système par défaut), avec un choix mémorisé et aucun flash au chargement. La direction
artistique (couleurs, polices, nom) viendra plus tard : il faut un seul endroit à modifier.

## Décision

- **Traductions** : deux fichiers TypeScript, `src/i18n/messages/fr.ts` (référence) et `en.ts`.
  Le type `Messages` impose les mêmes clés ; un test vérifie clés et `{variables}`.
  Pas de bibliothèque d'i18n : quelques dizaines de textes et une fonction `format()` suffisent.
- **Erreurs** : les validations et actions renvoient des **codes** (`roomNotFound`…), traduits
  à l'affichage (`errorText`) ; le serveur ne produit plus de phrases.
- **Choix mémorisé** dans des cookies (`lang`, `theme`, un an), écrits par des actions serveur.
  Pas de préfixe de langue dans les URL.
- **Thème** : sans cookie, `color-scheme: light dark` suit le système ; un choix explicite pose la
  classe `light` ou `dark` sur `<html>`, **rendue côté serveur** depuis le cookie : pas de flash, pas de script.
- **Couleurs et polices** : définies une seule fois dans le bloc `@theme` de `src/app/globals.css`,
  chaque couleur avec `light-dark(clair, foncé)`. Valeurs neutres provisoires. Les composants
  n'utilisent que ces jetons (`bg-background`, `text-muted`, `border-border`…), plus de couleurs en dur.
  Police : pile système (la police Geist du modèle Next.js est retirée).
- **Rendu** : l'option `cacheComponents` de Next.js est désactivée. Avec elle, lire un cookie dans
  la mise en page racine (pour `lang` et le thème) est interdit hors `<Suspense>` ; toutes les pages
  dépendent déjà de la session et de la langue, le rendu dynamique classique est plus simple.

## Conséquences

- Ajouter une langue = un fichier de traduction + une entrée dans `LOCALES`.
- Changer la direction artistique = modifier le bloc `@theme`, sans toucher aux composants.
- Les pages sont rendues à chaque requête (pas de pré-rendu statique) : sans impact à notre échelle.
- Une URL ne précise pas la langue : un lien partagé s'affiche dans la langue de celui qui l'ouvre.

## Alternatives écartées

- **Langue dans l'URL (`/fr/…`, `/en/…`)** : restructure toutes les routes et les redirections
  (Auth.js, actions serveur) pour un gain nul ici.
- **next-intl / i18next** : dépendance et configuration pour un besoin couvert en quelques lignes.
- **Thème via localStorage et script en tête de page** : nécessite un script bloquant pour éviter
  le flash ; le cookie rendu côté serveur l'évite.
