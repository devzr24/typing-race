# ADR 0015 — Moteur des bots

- **Statut :** accepté
- **Date :** 2026-11-07

## Contexte

L'énoncé demande cinq niveaux de bots (BOT-01) dont la vitesse varie pendant la course
(BOT-02), qui font des erreurs coûteuses en respectant le mode d'erreur (BOT-03), qui
subissent les bonus comme les humains (BOT-04) et dont le moteur est déterministe à partir
d'une graine pour être testable (BOT-05). Le texte d'un bot peut être allongé ou raccourci
en pleine course par un bonus (+3 / −3 mots).

## Décision

- **Logique pure** dans `src/lib/bots/` : aucun accès au réseau, à la base, à Socket.IO ni à
  React. Le serveur de course l'appellera ; le moteur ne connaît ni les salles ni le temps réel.
- **Frappe par frappe** : `createBotRunner({ level, seed, errorMode }).next(text, position)`
  renvoie la prochaine frappe `{ delayMs, correct }`, ou `null` quand la position atteint la
  fin du texte. Le texte et la position sont relus à chaque appel : un bonus qui modifie le
  texte s'applique sans recalcul. `simulateBot` simule une course entière (tests et réglages).
- **Graine** : générateur pseudo-aléatoire maison (`random.ts`), jamais `Math.random`. Pour une
  même graine et une même séquence d'appels `(text, position)`, la sortie est identique.
- **Niveaux** (`levels.ts`, MPM nets selon l'annexe A) :

  | Niveau | MPM | Erreurs |
  |---|---|---|
  | Noob | 10–20 | 12 % |
  | Débutant | 20–35 | 8 % |
  | Intermédiaire | 35–60 | 5 % |
  | Expert | 70–100 | 2 % |
  | Impossible | 140–170 | 0,5 % |

  « 140+ » est borné à 170 pour garder une plage testable.
- **Vitesse variable** : vitesse de base tirée dans la plage du niveau (marge de 10 % aux
  bornes) ; rythme propre à chaque mot (±15 %) ; ralentissement sur les mots difficiles
  (longueur, ponctuation, chiffres, majuscules, accents) ; hésitation de 1 à 3 intervalles sur
  6 % des mots ; le retard pris est ensuite résorbé sur une douzaine de frappes (accélération),
  ce qui garde le MPM final dans la plage du niveau.
- **Erreurs** : en mode « correction obligatoire », une frappe fausse n'avance pas la position
  et la frappe suivante est la correction (1,5 à 2,5 intervalles de plus) ; en mode « libre »,
  l'erreur est comptée, la position avance et la frappe coûte un demi-intervalle de plus.

## Conséquences

- Testable sans serveur : déterminisme, plages de MPM (au moins 98 % des courses de 200 à
  300 caractères dans la plage, aucune sous 90 % du minimum), taux d'erreur, deux modes,
  texte modifié en cours de route (`src/lib/bots/*.test.ts`).
- Le serveur doit planifier chaque bot avec `delayMs`, appliquer la frappe comme pour un
  humain (même calcul de progression et mêmes bonus) et s'arrêter sur `null`.
- Après un saut de position imposé par un bonus, la suite de frappes diffère de celle d'une
  course sans bonus ; elle reste reproductible pour la même séquence d'événements.

## Alternatives écartées

- **Courbe de progression précalculée** (position en fonction du temps) : simple, mais
  incompatible avec un texte modifié par un bonus et peu réaliste pour les erreurs.
- **Vitesse constante avec bruit** : refusée par BOT-02.
- **`Math.random`** : rend les tests non reproductibles (BOT-05).
