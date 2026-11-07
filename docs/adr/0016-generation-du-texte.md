# ADR 0016 — Génération du texte

- **Statut :** accepté
- **Date :** 2026-11-07

## Contexte

CONF-02 à CONF-07 demandent un texte français ou anglais, cohérent ou aléatoire,
de longueur exacte, avec complexité et options mesurables. Le corpus et le
dictionnaire existent en base ; la génération doit être reproductible sans base.

## Décision

- Logique pure dans `src/lib/text/`, graine Mulberry32 réutilisée des bots.
  `loadRaceText` lit uniquement la langue et le mode demandés via Prisma, avec
  ordre stable (rang puis valeur pour les mots, slug pour les passages).
- Aléatoire : FACILE = rang ≤ 300 et longueur ≤ 6 ; MOYEN = rang ≤ 700 et
  longueur ≤ 9 ; DIFFICILE = tout rang, longueur ≥ 4, poids = longueur × rang.
  Les longueurs comptent les points de code Unicode. Tirages avec remise.
- Cohérent : score = nombre de lettres Unicode / nombre de mots + 10 × part
  de caractères non alphabétiques parmi les caractères hors espaces. Mesure sur
  le passage original, avant options ; chiffres et ponctuation augmentent le score.

  | Langue | FACILE | MOYEN | DIFFICILE | Passages actuels par niveau |
  |---|---|---|---|---|
  | FR | score ≤ 5,2 | 5,2 < score ≤ 5,8 | score > 5,8 | 5 / 9 / 6 |
  | EN | score ≤ 4,4 | 4,4 < score ≤ 4,7 | score > 4,7 | 7 / 8 / 5 |

  Seuils par langue pour tenir compte des longueurs différentes ; les tests lisent
  le corpus source et imposent au moins deux passages par langue et niveau.
  Tirage uniforme par graine, puis enchaînement si nécessaire (sans répétition
  immédiate lorsqu'un autre passage existe), découpe aux premiers `wordCount` mots.
- Ponctuation aléatoire : probabilité par mot 8 % / 16 % / 24 %, virgule ou point
  équiprobables. Nombres : probabilité 10 %, entier de 0 à 999 remplaçant un mot.
  Majuscules activées : première lettre en début de texte et après un point.
  Désactivées : tout en minuscules. En cohérent, conserver les majuscules originales
  si activées, retirer la ponctuation si désactivée, retirer les mots contenant des
  chiffres si nombres désactivés. Aucun ajout artificiel dans le corpus.
- Accents désactivés en FR : NFD puis retrait des marques diacritiques ; aucun
  effet en EN. Apostrophes et traits d'union restent dans leur mot si ponctuation
  activée ; leur retrait fusionne les fragments du même mot.
- CONF-07 uniquement en aléatoire : normaliser mots et filtres sans casse ni
  accents ; aucun caractère exclu, au moins un caractère imposé par mot si renseigné.
  Moins de 20 candidats après tous les filtres : `NOT_ENOUGH_WORDS`. Les décorations
  respectent aussi ces filtres : nombre accolé si un nombre seul ne satisfait pas
  includeChars, ajout omis s'il viole excludeChars. En cohérent, include/exclude ignorés.
- Aucun passage exploitable après langue, complexité et options : `NO_PASSAGE`.
  Chaque succès contient exactement le nombre demandé d'unités séparées par un
  espace unique, sans espace final. La configuration de salle valide la longueur.

## Conséquences

Tests sans base : déterminisme, longueurs, seuils, pondération, options, filtres,
échecs et chargeur Prisma simulé. Les seuils restent fixes lors d'un ajout au corpus ;
le test de répartition signale un corpus insuffisant. La complexité est un indicateur
de frappe, pas une évaluation linguistique ; la concaténation peut changer de sujet.

## Alternatives écartées

- Classement relatif par quantiles : niveaux instables lors des ajouts au corpus.
- Génération par modèle distant : coût, latence et reproductibilité insuffisante.
- Filtrer include/exclude en cohérent : détruirait les phrases du corpus.
- `Math.random` : sorties non reproductibles.
