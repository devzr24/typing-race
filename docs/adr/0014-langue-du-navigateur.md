# ADR 0014 — Langue du navigateur par défaut

- **Statut :** accepté
- **Date :** 2026-11-07
- **Remplace :** ADR 0009, seulement pour la langue par défaut (français fixe). Le reste de l'ADR 0009 s'applique toujours.

## Contexte

I18N-02 demande que la langue par défaut soit celle du navigateur. L'ADR 0009 affichait le
français à toute personne sans cookie `lang`.

## Décision

- Ordre de priorité : cookie `lang` valide, puis en-tête `Accept-Language`, puis le français (`DEFAULT_LOCALE`).
- `localeFromAcceptLanguage` (`src/i18n/accept-language.ts`) est une fonction pure : elle respecte
  les poids `q`, compare la sous-étiquette principale (`fr-CA` → `fr`) et ignore les entrées malformées,
  `*` et les langues non prises en charge.
- Le choix fait avec le sélecteur reste mémorisé dans le cookie et l'emporte toujours.
- Playwright fixe `locale: "fr-FR"` : les tests visent les textes français, et un test e2e dédié
  vérifie un navigateur en anglais.

## Conséquences

- Une première visite s'affiche dans la langue du navigateur, toujours rendue côté serveur (pas de flash).
- Un lien partagé s'affiche dans la langue du navigateur de celui qui l'ouvre, s'il n'a pas de cookie.

## Alternatives écartées

- **Écrire le cookie à la première visite** : inutile, l'en-tête est envoyé à chaque requête.
- **Bibliothèque de négociation (`negotiator`, `@formatjs/intl-localematcher`)** : une dépendance pour quelques lignes.
