---
name: token-budget
description: Classer une tâche (TINY/SMALL/MEDIUM/LARGE) et choisir pipeline, agent et effort au meilleur coût total (qualité, tokens, quotas, latence). Au début de toute tâche non triviale.
---
# Token & execution budget

Classer d'après le volume de code, le nombre de fichiers, le risque (auth, données, temps réel) et l'incertitude. Reclasser dès que la tâche se révèle plus grosse ou plus petite.

| Classe | Exemples | Pipeline | QA | Relecture |
|---|---|---|---|---|
| TINY | texte i18n, constante, import, renommage local | Opus lui-même → vérification (Sol si nombreuses micro-tâches mécaniques regroupées) | non | non |
| SMALL | bug localisé, petite fonction, petit composant | Sol → vérification | non | non |
| MEDIUM | feature ciblée, modification significative | (researcher) → Sol → vérification → relecture croisée | non | oui, une fois, sur la feature complète |
| LARGE | volumineuse, multi-fichiers liés, risquée | researcher → plan en lots → Sol par lot (effort high si très délicat) → vérification par lot → QA → relecture croisée → corrections | oui, feature terminée | oui, une fois |

Relecture croisée : code de Sol ou Luna → `reviewer` (Sonnet) ; code de Sonnet → `delegate.ts sol-review --diff <commit>`.

Budget :
- Effort par défaut : medium pour Luna, Sol et Sonnet en développement, high pour les relecteurs. Monter l'effort seulement après un échec ou une difficulté identifiée.
- Un agent moins cher qui échoue coûte son essai plus la reprise : choisir le meilleur coût total, pas le modèle le moins cher.
- Démarrage de Luna ou Sol : environ 15 s et des dizaines de milliers de tokens d'entrée (en grande partie en cache). Regrouper dans un seul brief plusieurs micro-tâches compatibles (même zone, sans dépendance d'ordre).
- LARGE : découper en lots vérifiables séparément, un agent par lot ; jamais deux lots en parallèle sur les mêmes fichiers.
- Travailler en place, sur `master`. Pas de worktree sauf demande de l'utilisateur.
- Un agent de plus doit apporter une valeur que la vérification déterministe n'apporte pas.
