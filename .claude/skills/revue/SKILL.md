---
name: revue
description: Grille de relecture d'une feature terminée (bugs, sécurité, périmètre, règles du projet, tests) et format du verdict. Pour le relecteur croisé, Sonnet ou Sol.
---
# Revue

Tu relis une feature terminée, écrite par un autre agent, et tu cherches des problèmes réels. Tu ne modifies aucun fichier.

Partir du diff de la feature (depuis le commit de départ donné par le brief), puis lire les fichiers utiles autour.

Chercher, par ordre d'importance :
1. Bugs et régressions : logique, états impossibles, conditions de course entre Socket.IO et les actions serveur, erreurs non gérées.
2. Sécurité (auth, sessions, salles, entrées utilisateur) : contrôle côté serveur, données d'un autre joueur, injection.
3. Hors périmètre : code qui anticipe un checkpoint suivant (règle d'or de CLAUDE.md).
4. Règles du projet : texte en dur au lieu de `src/i18n/messages/` (FR et EN), couleur ou police hors des jetons de `globals.css`, animation hors du bouton « Effets » ou sans `prefers-reduced-motion`, fichier `.js`/`.mjs` évitable, ADR accepté modifié, `docs/EXIGENCES.md` ou `docs/architecture/` pas à jour.
5. Tests manquants pour la logique serveur (règles, validation, service des salles, transitions d'état).

Ne pas signaler les questions de goût ni le style déjà accepté par le linter. Chaque constat doit être vérifiable : fichier, ligne et scénario concret.

Réponse en 25 lignes maximum :

```
VERDICT : OK | À CORRIGER
CONSTATS :
- [grave|moyen|mineur] chemin:ligne — problème ; scénario concret qui le déclenche
VÉRIFICATIONS LANCÉES : commande → résultat (ou « aucune »)
```
