# ADR 0018 — Moteur de course côté serveur

- **Statut :** accepté
- **Date :** 2026-11-08

## Contexte

L'énoncé exige un serveur autoritaire (COURSE-06) : il détient le départ, la fin, la
progression, le classement et l'application des bonus, et rejette les progressions
impossibles. La course se termine quand tous ont fini ou abandonné, ou au temps maximal
(COURSE-09) ; un joueur déconnecté reprend s'il revient dans les 30 s, sinon il abandonne
(COURSE-08). Les bots (ADR 0015) et les bonus (`src/lib/race/bonus.ts`) doivent être
branchés, et les messages réseau limités (PERF-02).

## Décision

- **Le client envoie des frappes, jamais une position.** `race:input { code, seq, keys }`
  (au plus 20 caractères). Le serveur compare chaque caractère au caractère attendu du texte
  du coureur : en mode `CORRECTION`, une frappe fausse compte une erreur sans avancer ; en
  mode `LIBRE`, elle compte une erreur et avance. Les bots passent par la même fonction.
  Le message entier est rejeté (rien n'est appliqué) si le coureur n'est pas en course, si
  la course n'a pas commencé ou si la progression est invraisemblable
  (`isPlausibleProgress` : pas de saut, 300 MPM moyens au plus).
- **Logique pure** dans `src/lib/race/engine.ts` (temps passé en paramètre, sans Socket.IO) :
  un texte par coureur (modifié par les bonus), position, frappes, erreurs, touches
  manquées, série MPM échantillonnée chaque seconde, statut
  `racing | finished | abandoned | timeout`, bonus reçus. `finalResults` applique
  `rankParticipants` (COURSE-10).
- **Exécution** dans `src/server/race-runtime.ts`, démarrée au passage en `EN_COURSE` :
  minuteries des bots (graine dérivée de la graine de course et de l'id du bot), fin
  automatique (`finishRace`) dès qu'il ne reste aucun coureur actif ou au temps maximal,
  arrêt de toutes les minuteries au `reset`, à la fermeture ou à la fin.
- **Réseau** : au plus 10 `race:input` par seconde et par socket (au-delà : `raceTooFast`) ;
  diffusion de `race:state` à la salle au plus toutes les 100 ms, seulement si l'état
  public a changé ; `race:self` (texte courant, position, erreurs, brouillard) envoyé au
  seul coureur concerné, au départ, après un bonus qui le touche et dans l'accusé de
  `room:watch` pour reprendre après un rechargement ; `race:bonus` et `race:results` à la
  salle. Aucune écriture en base pendant la course.
- **Déconnexion pendant la course** : le coureur reste dans la salle ; passé 30 s sans
  socket connecté, il abandonne (progression figée). Hors course, le départ différé de
  l'ADR 0006 est inchangé.
- **État en mémoire** (`race-memory.ts`) : une course en cours est perdue au redémarrage,
  comme le décompte (la salle revient en attente). Les résultats restent en mémoire jusqu'au
  `reset` ou à la fermeture ; leur persistance relève de RES-05.

## Conséquences

- La triche par envoi direct de positions est impossible ; un client modifié peut au mieux
  taper vite, dans la limite des 300 MPM moyens.
- Les bonus `+3` / `−3` changent la longueur du texte d'un seul coureur : la progression se
  calcule sur la longueur courante et le MPM sur les frappes correctes (BONUS-04).
- Un seul processus Node : pas de partage d'état entre plusieurs instances (suffisant pour
  Railway avec une instance).

## Alternatives écartées

- **Le client envoie sa position** : simple, mais il suffit de mentir sur la position.
- **Une diffusion par frappe** : jusqu'à 30 joueurs × 10 messages/s rediffusés à chacun,
  inutile pour une piste qui interpole.
- **Persister l'état de course en base à chaque frappe** : interdit par PERF-02 et inutile
  pour une course de quelques minutes.
