---
name: task-handoff
description: Format des briefs (orchestrateur → agent), des comptes rendus (agent → orchestrateur) et des transferts entre agents, avec le contexte minimal.
---
# Task handoff

## Brief (orchestrateur → agent)
```
OBJECTIF : 1-2 phrases, résultat vérifiable
CONTEXTE : fichiers/fonctions (chemin:ligne), interfaces utiles, décisions déjà prises
CONTRAINTES : hors périmètre, ce qu'il ne faut pas toucher
VÉRIFICATION : commande(s) à lancer
```
Contexte minimal : des pointeurs (chemin, symbole) plutôt que des copies, des extraits d'erreur plutôt que des logs entiers. Jamais la conversation, le dépôt complet ni des analyses entières. Un agent à qui il manque une information le signale ; on complète alors.

Pour un transfert entre agents, ajouter : ÉTAT ACTUEL, MODIFICATIONS FAITES, TESTS LANCÉS, ERREURS RESTANTES.

## Compte rendu (agent → orchestrateur), 15 lignes maximum
```
STATUT : OK | PARTIEL | ÉCHEC
FAIT : ce qui a changé, en une ou deux phrases
FICHIERS : chemin — nature du changement
VÉRIFICATION : commande → résultat
RESTE / RISQUES : seulement si non vide
DÉCISION REQUISE : seulement si bloqué
```
Pas de diff complet (l'orchestrateur lance `git diff` si besoin), pas de récit de la démarche.
