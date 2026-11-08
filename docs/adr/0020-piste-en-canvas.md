# ADR 0020 — Piste de course dessinée dans un canvas, sans interpolation

- **Statut :** accepté
- **Date :** 2026-11-08
- **Complète :** ADR 0011 (budget d'animation), pour la piste de course seulement

## Contexte

PERF-03 demande une piste fluide à 30 participants dans le budget de l'ADR 0011 (≥ 50 images/s,
processeur ralenti ×4). Les marqueurs étaient 30 éléments DOM déplacés par `transform` à chaque
`race:state` (10 Hz) : 35–41 images/s sans GPU, 41–48 avec. Les mêmes mesures, marqueurs masqués,
donnaient plus de 50 : le coût venait des marqueurs.

## Décision

- Les points des coureurs sont dessinés dans **un seul `<canvas>`** posé sur la liste
  (`aria-hidden`, sans pointeur), sur le fil principal, une fois par état reçu : on n'efface que
  l'ancien disque. Lignes, avatars, noms, %, MPM, statut et barres restent en DOM ; la liste reste
  l'équivalent textuel pour les lecteurs d'écran. Couleur lue sur le canvas (`text-cyan`, la
  valeur calculée résout `light-dark()`), relue au changement de thème.
- **Pas d'interpolation** entre deux états : redessiner à chaque image coûte 13 à 18 images/s
  (33–37 sans GPU, 35–52 instable avec). Un coureur avance d'environ un pixel par état.
- Le test `e2e/perf.spec.ts` mesure avec la composition GPU activée (`--enable-gpu`), comme dans
  un navigateur ordinaire ; Chromium headless la désactive par défaut.

## Conséquences

- Mesures (build de production, 29 bots, souris en mouvement, CPU ×4) : **51,7–54,7** images/s
  avec le GPU (20 passages sur 20 au-dessus de 50), 49–50 sans GPU.
- COURSE-05 : le déplacement est saccadé à 10 Hz au lieu d'être interpolé ; choix assumé pour tenir le budget.
- Le canvas ne suit pas `prefers-reduced-motion` : rien n'y est animé entre deux états.
- Sa résolution est plafonnée à environ 8 M pixels (longue liste sur un téléphone à DPR 3 : limite
  de taille des canvas de Safari) ; il est remesuré quand le DPR change.
- Le réglage `--use-angle=d3d11` du test est propre à Windows (machine de mesure) ; ailleurs, Chromium l'ignore.

## Alternatives écartées (mesurées)

- **Canvas avec interpolation** sur le fil principal : 33–35 images/s sans GPU.
- **`OffscreenCanvas` dans un Worker** (même canvas unique, interpolé) : 35–37. Le Worker qui ne
  dessine rien atteint ≥ 50 : le coût est la recomposition du calque à chaque image, pas le dessin.
- **Un canvas par barre**, dessinés par un Worker : 32–36 interpolé, 44–45 sans interpolation.
- **Canvas à résolution ×0,25** : 31–33 ; le nombre de pixels n'est pas en cause.
