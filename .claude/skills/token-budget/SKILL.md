---
name: token-budget
description: Classer une tâche (TINY/SMALL/MEDIUM/LARGE) et choisir pipeline, agent et effort au meilleur coût total (qualité, tokens, quotas, latence). Au début de toute tâche non triviale.
---
# Token & execution budget

Classer d'après le volume de code, le nombre de fichiers, le risque (auth, données, temps réel) et l'incertitude. Reclasser dès que la tâche se révèle plus grosse ou plus petite.

| Classe | Exemples | Pipeline | QA | Relecture |
|---|---|---|---|---|
| TINY | texte i18n, constante, import, renommage local | Luna → vérification | non | non |
| SMALL | bug localisé, petite fonction, petit composant | Sol → vérification | non | non |
| MEDIUM | feature ciblée, modification significative | (researcher) → Sol → vérification → `reviewer` | non | oui, une fois, sur la feature complète |
| LARGE | volumineuse, multi-fichiers liés, risquée | researcher → plan en lots → Sol par lot (Sonnet si très délicat) → vérification par lot → QA → `reviewer` → corrections | oui, feature terminée | oui, une fois |

Budget :
- Effort par défaut : medium pour Luna, Sol et Sonnet. Monter l'effort seulement après un échec ou une difficulté identifiée.
- Un agent moins cher qui échoue coûte son essai plus la reprise : choisir le meilleur coût total, pas le modèle le moins cher.
- Démarrage de Luna ou Sol : environ 15 s et des dizaines de milliers de tokens d'entrée (en grande partie en cache). Regrouper dans un seul brief plusieurs micro-tâches compatibles (même zone, sans dépendance d'ordre).
- LARGE : découper en lots vérifiables séparément, un agent par lot ; jamais deux lots en parallèle sur les mêmes fichiers.
- Travailler en place, sur `master`. Pas de worktree sauf demande de l'utilisateur.
- Un agent de plus doit apporter une valeur que la vérification déterministe n'apporte pas.
