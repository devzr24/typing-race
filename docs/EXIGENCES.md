# Matrice de traçabilité des exigences

Identifiants : ceux de l'énoncé « Web V — Travail de session ».
Statut : **complet**, **partiel** (une partie livrée, le reste à faire), **non fait**.
Tests : `*.test.ts` = tests unitaires (Vitest) ; `e2e/…` = tests de bout en bout (Playwright).

Mise à jour : 2026-11-08.

## Bilan

| Statut | Nombre |
|---|---|
| Complet | 38 |
| Partiel | 31 |
| Non fait | 21 |
| **Total** | **90** |

## 3. Contraintes techniques

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| TECH-01 | complet | `package.json`, `src/app/` | toute la suite | Next.js 16 (App Router) et React 19. |
| TECH-02 | complet | `tsconfig.json`, `eslint.config.ts` | CI : `npm run lint`, `npm run typecheck` | Aucun fichier `.js`/`.jsx` suivi par Git ; `strict: true`. `no-explicit-any` et `ban-ts-comment` sont en erreur par héritage de `eslint-config-next/typescript` (recommandé de typescript-eslint) ; aucun `any`, `@ts-ignore` ni `@ts-expect-error` dans le code écrit à la main. Le client Prisma généré (`src/generated/`, ignoré par Git et par ESLint) en contient. |
| TECH-03 | complet | `src/app/globals.css` | — | Tailwind CSS 4. |
| TECH-04 | partiel | `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`, `prisma/corpus/` | `src/server/migrate.test.ts`, `src/server/corpus.test.ts`, `src/server/seed.test.ts` | PostgreSQL + Prisma 7, migrations versionnées et appliquées au démarrage (ADR 0008). Seed idempotent (`npm run db:seed`, lancé au démarrage sur Railway, ADR 0013) : 20 extraits du domaine public et environ 1000 mots par langue, comptes de démonstration `demo` et `demo2`. **Manque** : historique de démonstration (attend les tables de résultats, RES-05). |
| TECH-05 | partiel | `railway.json`, `server.ts` | `/api/health` | Déployé en HTTPS sur Railway : https://typing-race-production-4a76.up.railway.app. **Écart** : Railway est une plateforme hébergée (PaaS), pas un VPS. Choix à faire valider par l'enseignant ou à remplacer par un VPS (ADR 0001). |
| TECH-06 | complet | `server.ts`, `src/server/room-socket.ts`, `src/server/realtime.ts`, `src/server/race-runtime.ts` | `e2e/room.spec.ts`, `src/server/race-runtime.test.ts` | Socket.IO sur le serveur Node (ADR 0002), participants et progression de course diffusés ; événements de course typés et entrées validées par Zod. |
| TECH-07 | complet | `src/lib/auth/schemas.ts`, `src/lib/rooms/schemas.ts`, `src/i18n/schemas.ts` | `src/lib/auth/schemas.test.ts`, `src/lib/rooms/schemas.test.ts`, `src/i18n/schemas.test.ts` | Zod 4 sur toutes les entrées actuelles : actions serveur (authentification, salles, langue et thème), `authorize` des fournisseurs `credentials` et `guest`, message Socket.IO `room:watch`, code de salle dans l'URL (`/room/[code]`). Les schémas renvoient des codes `ErrorCode`. Seule route API maison : `/api/health`, sans entrée. Chaque nouvelle entrée devra avoir son schéma. |
| TECH-08 | complet | — | — | Aucun service externe payant. GitHub et Discord OAuth sont gratuits ; les frais Railway sont à la charge de l'étudiant. |
| TECH-09 | complet | `.github/workflows/ci.yml` | exécutions vertes sur GitHub Actions | Chaque push sur `master` et chaque PR : lint, `tsc --noEmit`, tests unitaires, build, tests de bout en bout. |
| TECH-10 | complet | `.env.example`, `.gitignore` | `src/server/env.test.ts` | `.env` n'est jamais commité ; le serveur s'arrête si une variable obligatoire manque en production. |

## 4. Identité visuelle et design

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| DES-01 | partiel | `src/i18n/messages/` | — | Nom « Keyclue » utilisé dans l'interface. **Manque** : `docs/DEMARCHE-CREATIVE.md` (noms envisagés, raison du choix, vérification d'originalité). |
| DES-02 | non fait | — | — | Aucun logo ; le favicon (`src/app/favicon.ico`) est celui de Next.js par défaut. Croquis à joindre à la démarche créative. |
| DES-03 | partiel | `docs/adr/0010-direction-artistique-keyclue.md`, `src/app/globals.css` | — | Palette et typographies définies (ADR 0010). **Manque** : moodboard de 3 à 5 références dans `docs/DEMARCHE-CREATIVE.md`. |
| DES-04 | partiel | `src/app/globals.css`, `src/components/effects.tsx`, `src/components/clue-network.tsx`, `src/components/motion-effects.tsx` | `e2e/room.spec.ts` | Direction artistique propre, sans shadcn/ui ni émojis (icônes Lucide). **Manque** : la piste de progression comme élément signature (une piste existe, `race-track.tsx`, mais sobre ; à affirmer avec la direction artistique). |
| DES-05 | complet | `src/components/preferences.tsx`, `src/app/layout.tsx`, `src/i18n/server.ts` | `e2e/room.spec.ts` (langue et thème) | Choix système / clair / sombre ; système par défaut. Le thème est lu dans un cookie et appliqué au rendu serveur : aucun flash au chargement (ADR 0009). |
| DES-06 | partiel | pages de `src/app/`, `src/app/room/[code]/typing-zone.tsx` | captures Playwright (vérification manuelle) | Sous 768 px avec pointer: coarse : message clavier physique recommandé à la place de la zone, piste conservée. Reste : validation visuelle sur téléphone. |

## 5.2 Comptes et profil

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| AUTH-01 | complet | `src/auth.ts`, `src/app/login/`, `src/app/register/`, `src/lib/auth/` | `src/lib/auth/username.test.ts`, `src/lib/auth/password.test.ts`, `src/lib/auth/account-linking.test.ts`, `src/lib/auth/auth.test.ts` | GitHub, Discord, et nom d'utilisateur + mot de passe (ADR 0004, 0005). Parcours OAuth vérifié manuellement. Un compte GitHub/Discord n'est jamais relié à une session déjà ouverte ; `/login` et `/register` redirigent une personne connectée (ADR 0012). |
| AUTH-02 | complet | `src/auth.ts` (fournisseur `guest`), `src/lib/auth/schemas.ts`, `src/app/login/login-forms.tsx` | `src/lib/auth/schemas.test.ts`, `src/lib/auth/auth.test.ts`, `e2e/room.spec.ts` | Pseudo obligatoire de 3 à 20 caractères, vérifié dans l'action et dans le fournisseur Auth.js ; session d'invité dans le cookie signé d'Auth.js. |
| AUTH-03 | partiel | `src/components/avatar.tsx`, `src/lib/rooms/actions.ts`, `src/app/home-actions.tsx`, `src/lib/race/persist.ts`, `src/app/races/[id]/page.tsx` | `src/lib/rooms/service.test.ts`, `src/lib/race/persist.test.ts`, `src/app/races/[id]/page.test.ts`, `e2e/room.spec.ts` | Un invité ne peut pas créer de salle ; avatar = initiale. Résultats invités sans userId, accès aux courses persistées refusé aux invités. **Partiel** : liste d'historique à venir (HIST-01). |
| AUTH-04 | non fait | — | — | Seule la photo fournie par GitHub/Discord est affichée ; pas de téléversement. |
| AUTH-05 | non fait | — | — | — |
| AUTH-06 | non fait | — | — | Pas de page de profil. |

## 5.3 Salles et visibilité

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| SALLE-01 | complet | `src/lib/rooms/service.ts`, `src/lib/rooms/actions.ts`, `src/app/home-actions.tsx`, `src/app/room/[code]/room-view.tsx`, `prisma/migrations/20261106120000_room_spectator/` | `src/lib/rooms/service.test.ts`, `e2e/room.spec.ts` | Création réservée aux utilisateurs connectés ; le créateur devient l'hôte et choisit d'être participant (par défaut) ou spectateur (`RoomParticipant.isSpectator`), visible en direct dans la salle. Les spectateurs ne pourront pas taper : à appliquer avec la course (COURSE-05). |
| SALLE-02 | complet | `src/lib/rooms/code.ts`, `src/lib/rooms/code-generator.ts` | `src/lib/rooms/code.test.ts` | 6 caractères, alphabet sans 0/O/1/I/L, générateur cryptographique, unicité en base. |
| SALLE-03 | complet | `src/lib/rooms/service.ts`, `src/app/room/[code]/room-configuration.tsx` | `src/lib/rooms/access.test.ts` | Publique (explorateur, partie rapide, code), sur code (code ou lien), privée (lien seulement : le code seul est refusé) (ADR 0017). |
| SALLE-04 | complet | `src/lib/rooms/service.ts`, `src/lib/rooms/prisma-store.ts`, `src/app/invite/[token]/page.tsx`, `src/app/room/[code]/room-view.tsx` | `src/lib/rooms/access.test.ts` | Jeton de 256 bits, seule l'empreinte SHA-256 est stockée ; usage unique lié à l'IP et à la personne, qui peut revenir ; révoqué à l'expulsion ; supprimé avec la salle. Le lien ne peut être copié qu'à sa création (jeton non stocké, ADR 0017) ; le statut reste visible ensuite. |
| SALLE-05 | complet | `src/lib/rooms/service.ts`, `src/lib/rooms/schemas.ts` | `src/lib/rooms/access.test.ts` | Capacité 2 à 30 ; les bots comptent, les spectateurs non ; une salle pleine accepte encore des spectateurs. |
| SALLE-06 | complet | `prisma/schema.prisma` (`RoomParticipant.key` unique), `src/lib/rooms/service.ts`, `src/app/home-actions.tsx` | `src/lib/rooms/access.test.ts`, `src/lib/rooms/service.test.ts` | Contrainte en base ; l'interface propose de quitter la salle actuelle, qui n'est quittée qu'une fois la salle visée validée. Deuxième onglet : pas de doublon. |
| SALLE-07 | complet | `src/lib/rooms/service.ts`, `src/server/room-socket.ts`, `src/app/room/[code]/room-view.tsx` | `src/lib/rooms/access.test.ts`, `src/server/room-socket.test.ts` | Expulsion d'un participant ou d'un spectateur : bannissement (`RoomBan`), liens révoqués, sockets retirés. Limite : un invité expulsé qui recrée une session d'invité obtient une nouvelle identité. |
| SALLE-08 | complet | `src/lib/rooms/service.ts`, `src/server/room-socket.ts` | `src/lib/rooms/service.test.ts`, `src/lib/rooms/access.test.ts` | Au plus ancien humain connecté (participant ou spectateur), jamais un bot ; sinon la salle est fermée (ADR 0006, 0017). |
| SALLE-09 | complet | `src/lib/rooms/service.ts` | `src/lib/rooms/access.test.ts` | Entrée seulement en attente ou aux résultats ; un membre qui se reconnecte reste accepté. |
| SALLE-10 | complet | `src/lib/rooms/code-rate-limit.ts`, `src/lib/rooms/actions.ts` | `src/lib/rooms/code-rate-limit.test.ts` | 10 tentatives par minute et par IP, avant toute lecture en base ; un membre qui recharge sa salle ne consomme pas de tentative (ADR 0012, 0017). |

## 5.4 Rejoindre une course

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| JOIN-01 | complet | `src/app/page.tsx`, `src/app/home-actions.tsx` | `e2e/room.spec.ts` | Champ de code sur la page d'accueil ; message clair si le code n'existe pas. |
| JOIN-02 | complet | `src/app/salles/`, `src/server/realtime.ts`, `src/server/room-socket.ts` | `src/lib/rooms/access.test.ts`, `e2e/room.spec.ts` | Salles publiques avec participants/capacité, langue, complexité, hôte et état ; filtres langue et complexité ; canal Socket.IO `lobby` mis à jour en direct. |
| JOIN-03 | complet | `src/lib/rooms/service.ts` (`quickJoin`), `src/app/home-actions.tsx` | `src/lib/rooms/access.test.ts`, `e2e/room.spec.ts` | Salle la plus proche de sa capacité, égalité → la plus ancienne. Aucune : connecté → message et proposition de créer une salle publique par défaut ; invité → état vide et message. |

## 5.5 Configuration de la course

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| CONF-01 | complet | `src/lib/rooms/schemas.ts`, `src/lib/rooms/service.ts`, `src/app/room/[code]/room-configuration.tsx` | `src/lib/rooms/race.test.ts`, `e2e/room.spec.ts` | Aucun temps maximal ou de 30 à 600 s (Zod) ; à la fin du temps, la salle passe en RESULTATS. |
| CONF-02 | complet | `src/lib/rooms/schemas.ts`, `src/lib/rooms/service.ts`, `src/app/room/[code]/room-configuration.tsx`, `src/lib/text/load.ts` | `src/lib/rooms/race.test.ts`, `e2e/room.spec.ts` | Français ou anglais, indépendant de la langue de l'interface. |
| CONF-03 | complet | `src/lib/rooms/schemas.ts`, `src/lib/rooms/service.ts`, `src/app/room/[code]/room-configuration.tsx`, `src/lib/text/generate.ts`, `src/lib/text/complexity.ts`, `src/lib/text/load.ts`, `docs/adr/0016-generation-du-texte.md` | `src/lib/text/generate.test.ts`, `src/lib/text/load.test.ts` | Cohérent : passages du corpus en base (`Passage`) ; aléatoire : mots du dictionnaire en base (`Word`). |
| CONF-04 | complet | `src/lib/rooms/schemas.ts`, `src/lib/rooms/service.ts`, `src/app/room/[code]/room-configuration.tsx`, `src/lib/text/generate.ts` | `src/lib/rooms/race.test.ts`, `e2e/room.spec.ts`, `src/lib/text/generate.test.ts`, `src/lib/text/load.test.ts` | De 10 à 200 mots ; le texte contient exactement ce nombre de mots. |
| CONF-05 | complet | `src/lib/text/generate.ts`, `src/lib/text/complexity.ts`, `src/lib/text/load.ts`, `docs/adr/0016-generation-du-texte.md` | `src/lib/text/generate.test.ts`, `src/lib/text/load.test.ts` | Critères chiffrés (ADR 0016). Aléatoire : facile = rang de fréquence ≤ 300 et ≤ 6 lettres, moyen = rang ≤ 700 et ≤ 9 lettres, difficile = tout le dictionnaire, ≥ 4 lettres, tirage pondéré vers les mots longs et rares. Cohérent : score de passage (longueur moyenne des mots, part de caractères non alphabétiques) avec seuils par langue, au moins 2 passages par niveau (vérifié par test). |
| CONF-06 | complet | `src/lib/rooms/schemas.ts`, `src/lib/rooms/service.ts`, `src/app/room/[code]/room-configuration.tsx`, `src/lib/text/generate.ts` | `src/lib/text/generate.test.ts`, `src/lib/text/load.test.ts` | Ponctuation, nombres, majuscules et accents (français) activables ; appliqués aux deux modes (insertion en aléatoire, retrait en cohérent). |
| CONF-07 | complet | `src/lib/rooms/schemas.ts`, `src/lib/rooms/service.ts`, `src/app/room/[code]/room-configuration.tsx`, `src/lib/text/generate.ts`, `docs/adr/0016-generation-du-texte.md` | `src/lib/text/generate.test.ts`, `src/lib/text/load.test.ts` | Texte aléatoire : aucun mot ne contient un caractère exclu ; chaque mot contient au moins un caractère inclus (casse et accents ignorés) ; moins de 20 mots candidats → erreur affichée à l'hôte. Mode cohérent : option ignorée (comportement documenté, ADR 0016). |
| CONF-08 | complet | `src/lib/rooms/schemas.ts`, `src/lib/race/engine.ts`, `src/app/room/[code]/room-configuration.tsx`, `src/app/room/[code]/typing-zone.tsx` | `src/lib/rooms/race.test.ts`, `src/lib/race/engine.test.ts`, `e2e/room.spec.ts`, `src/lib/race/typing-state.test.ts`, `e2e/race.spec.ts` (CI, non exécuté localement) | Modes correction et libre appliqués au serveur et à la prédiction locale ; erreurs visibles, correction sans retour arrière. |
| CONF-09 | complet | `src/lib/rooms/schemas.ts`, `src/lib/race/engine.ts`, `src/app/room/[code]/room-configuration.tsx` | `src/lib/rooms/race.test.ts`, `src/lib/race/engine.test.ts`, `e2e/room.spec.ts` | Bonus activés ou non par l'hôte ; ce réglage contrôle effectivement l'allocation pendant la course. |
| CONF-10 | complet | `src/lib/rooms/schemas.ts`, `src/lib/rooms/service.ts`, `src/app/room/[code]/room-configuration.tsx`, `src/lib/rooms/prisma-store.ts` (`RoomBot`) | `src/lib/rooms/race.test.ts`, `e2e/room.spec.ts` | L'hôte ajoute un bot avec son niveau (nom généré côté serveur, refus si la capacité est atteinte) ou le retire ; bots listés avec un badge et leur niveau. |
| CONF-11 | complet | `src/app/room/[code]/room-configuration.tsx`, `src/lib/rooms/schemas.ts` | `src/lib/rooms/access.test.ts`, `e2e/room.spec.ts` | Visibilité et capacité réglées par l’hôte en attente ou aux résultats, diffusées en direct. |
| CONF-12 | complet | `src/lib/rooms/schemas.ts`, `src/lib/rooms/service.ts`, `src/app/room/[code]/room-configuration.tsx`, `src/server/room-socket.ts` | `src/lib/rooms/race.test.ts`, `e2e/room.spec.ts` | Configuration et bots diffusés à toute la salle par `room:update` à chaque changement ; formulaire en lecture seule pour les non-hôtes. Modifiable seulement en attente ou sur les résultats. |

## 5.6 Déroulement d'une course

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| COURSE-01 | complet | `src/lib/rooms/state-machine.ts`, `src/lib/rooms/service.ts`, `src/server/race-runtime.ts`, `docs/architecture/machine-a-etats.md` | `src/lib/rooms/state-machine.test.ts`, `src/lib/rooms/race.test.ts`, `src/server/race-runtime.test.ts` | Décompte serveur de 3 s ; passage EN_COURSE → RESULTATS quand tous sont arrivés ou abandonnés, ou au temps maximal. Au redémarrage, les courses interrompues reviennent en attente. |
| COURSE-02 | complet | `src/lib/rooms/state-machine.ts`, `src/lib/rooms/service.ts`, `src/server/room-socket.ts` | `src/lib/rooms/state-machine.test.ts`, `src/lib/rooms/race.test.ts`, `e2e/room.spec.ts` | Lancement par l'hôte seulement si au moins 2 participants non spectateurs, bots compris, dont au moins 1 humain ; bouton désactivé avec la raison sinon. |
| COURSE-03 | complet | `src/lib/rooms/service.ts`, `src/lib/race/engine.ts`, `src/server/race-runtime.ts`, `src/app/room/[code]/room-view.tsx`, `src/app/room/[code]/typing-zone.tsx` | `src/lib/rooms/race.test.ts`, `src/lib/race/engine.test.ts`, `src/server/race-runtime.test.ts`, `e2e/room.spec.ts` | Texte individuel fourni par race:self ; zone activée en course, temps local corrigé par serverNow. Parcours Playwright ajouté pour la CI. |
| COURSE-04 | complet | `src/lib/race/engine.ts`, `src/server/room-socket.ts`, `src/app/room/[code]/typing-zone.tsx` | `src/lib/race/engine.test.ts`, `src/server/race-runtime.test.ts`, `src/lib/race/typing-state.test.ts`, `e2e/race.spec.ts` (CI, non exécuté localement) | Zone accessible, caractères validés/erronés/courants, prédiction immédiate puis autorité des acks ; paste, drop et beforeinput insertFromPaste refusés. Tests de rendu pur et parcours CI. |
| COURSE-05 | complet | `src/lib/race/engine.ts`, `src/server/race-runtime.ts`, `src/app/room/[code]/race-track.tsx` | `src/server/race-runtime.test.ts`, `e2e/race.spec.ts` (CI) | Piste avec avatar, bot identifié, progression, MPM et statut ; bordure locale, interpolation CSS 120 ms et lignes memo. Spectateurs : piste seule. |
| COURSE-06 | complet | `src/lib/race/metrics.ts`, `src/lib/race/engine.ts`, `src/server/race-runtime.ts`, `src/server/room-socket.ts`, `src/app/room/[code]/typing-zone.tsx` | `src/lib/race/metrics.test.ts`, `src/lib/race/engine.test.ts`, `src/server/race-runtime.test.ts`, `src/lib/race/typing-state.test.ts`, `e2e/race.spec.ts` (CI, non exécuté localement) | Le client transmet uniquement seq et keys ; réconciliation des acks, MPM net et précision calculés avec metrics.ts. |
| COURSE-07 | complet | `src/server/room-socket.ts`, `src/server/race-runtime.ts`, `src/lib/race/engine.ts`, `src/app/room/[code]/typing-zone.tsx` | `src/lib/race/engine.test.ts`, `src/server/race-runtime.test.ts` | Confirmation dans un dialogue natif accessible avant race:abandon ; saisie figée puis résultat provisoire et piste. |
| COURSE-08 | partiel | `src/server/room-socket.ts`, `src/lib/rooms/race-memory.ts`, `src/server/race-runtime.ts`, `src/app/room/[code]/typing-zone.tsx` | `src/server/race-runtime.test.ts`, `e2e/room.spec.ts`, `src/lib/race/typing-state.test.ts`, `e2e/race.spec.ts` (CI, non exécuté localement) | room:watch initialise la zone avec self ; à la reconnexion, tampon abandonné et nouvelle base serveur. Séquence initialisée à l’horloge pour dépasser celle d’avant rechargement. **Manque** : la reprise après rechargement n'est vérifiée par aucun test de bout en bout. |
| COURSE-09 | complet | `src/lib/race/engine.ts`, `src/server/race-runtime.ts`, `src/lib/rooms/service.ts` | `src/lib/race/engine.test.ts`, `src/server/race-runtime.test.ts` | Fin automatique (`finishRace`) dès qu'aucun coureur n'est encore en course (arrivés, abandons, départs, expulsions, déconnexions de plus de 30 s), même sans temps maximal, ou au temps maximal (les coureurs restants passent « temps écoulé »). |
| COURSE-10 | complet | `src/lib/race/ranking.ts`, `src/lib/race/engine.ts`, `src/lib/rooms/service.ts`, `src/components/race-results.tsx` | `src/lib/race/ranking.test.ts`, `src/lib/race/engine.test.ts`, `src/server/race-runtime.test.ts`, `e2e/race.spec.ts` (non exécuté localement) | Classement final : arrivés par temps, timeout par progression, puis abandons par progression figée. Statistiques diffusées, affichées et conservées en mémoire jusqu'au reset/close. |
| COURSE-11 | complet | `src/app/room/[code]/room-view.tsx`, `src/lib/rooms/service.ts` | `src/lib/rooms/race.test.ts` | En résultats : hôte = nouvelle course / fermer ; autres restent (comportement par défaut) ou quittent. Configuration et participants conservés. |

## 5.7 Bots

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| BOT-01 | complet | `src/lib/bots/levels.ts`, `src/server/race-runtime.ts`, `docs/adr/0015-moteur-des-bots.md` | `src/lib/bots/engine.test.ts`, `src/server/race-runtime.test.ts` | Cinq niveaux existants exécutés par minuteries serveur ; Impossible borné à 170 MPM (ADR 0015). |
| BOT-02 | complet | `src/lib/bots/engine.ts`, `src/server/race-runtime.ts` | `src/lib/bots/engine.test.ts`, `src/server/race-runtime.test.ts` | Rythme, difficultés et hésitations du moteur existant appliqués par les minuteries serveur. |
| BOT-03 | complet | `src/lib/bots/engine.ts`, `src/lib/race/engine.ts`, `src/server/race-runtime.ts` | `src/lib/bots/engine.test.ts`, `src/lib/race/engine.test.ts`, `src/server/race-runtime.test.ts` | Même validation et comptage que les humains ; mode d'erreur de la salle transmis au moteur des bots. |
| BOT-04 | complet | `src/lib/bots/engine.ts`, `src/lib/race/engine.ts`, `src/server/race-runtime.ts`, `src/app/room/[code]/race-track.tsx` | `src/lib/bots/engine.test.ts`, `src/lib/race/engine.test.ts`, `src/server/race-runtime.test.ts` | Bonus serveur identiques pour bots et humains ; piste avec Avatar, icône Bot et libellé traduit. |
| BOT-05 | complet | `src/lib/bots/random.ts`, `src/server/race-runtime.ts` | `src/lib/bots/random.test.ts`, `src/lib/bots/engine.test.ts`, `src/lib/race/engine.test.ts` | Graine de course conservée en mémoire, graine de bot dérivée de celle-ci et de son id ; aucun `Math.random`. |

## 5.8 Bonus de remontée

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| BONUS-01 | complet | `src/lib/race/bonus.ts`, `src/lib/race/engine.ts` | `src/lib/race/bonus.test.ts`, `src/lib/race/engine.test.ts` | Allocation après avancée serveur ; checkpoints stricts 25/50/75 %, une fois chacun, au plus trois bonus par retardataire, tirage déterministe à graine. |
| BONUS-02 | complet | `src/lib/race/bonus.ts`, `src/lib/race/engine.ts`, `src/server/race-runtime.ts`, `src/app/room/[code]/typing-zone.tsx` | `src/lib/race/bonus.test.ts`, `src/lib/race/engine.test.ts`, `src/server/race-runtime.test.ts` | Texte individuel mis à jour par race:self ; brouillard sur les mots suivants pendant fogUntil, remplacé par une opacité statique avec fx-off ou réduction des mouvements. |
| BONUS-03 | partiel | `src/lib/rooms/events.ts`, `src/server/race-runtime.ts`, `src/app/room/[code]/race-track.tsx`, `src/app/room/[code]/typing-zone.tsx` | `src/server/race-runtime.test.ts` | Badge temporaire sur bénéficiaire et cible ; annonce aria-live polite chez la cible, traductions FR/EN. **Manque** : l'affichage des annonces n'est couvert par aucun test (un bonus ne se déclenche pas de façon reproductible en e2e). |
| BONUS-04 | complet | `src/lib/race/bonus.ts`, `src/lib/race/engine.ts`, `src/lib/race/metrics.ts` | `src/lib/race/bonus.test.ts`, `src/lib/race/engine.test.ts`, `src/lib/race/metrics.test.ts` | Progression sur longueur courante, MPM sur frappes correctes ; préfixe validé et dernier mot non terminé préservés, textes terminés inchangés. |

## 5.9 Résultats et statistiques

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| RES-01 | complet | `src/components/race-results.tsx` | `e2e/race.spec.ts` (étendu, non exécuté localement) | Podium des trois premiers, avatars, noms et MPM. |
| RES-02 | complet | `src/components/race-results.tsx`, `src/i18n/messages/` | `e2e/race.spec.ts` (étendu, non exécuté localement) | Classement complet ; métriques, durées et nombres formatés avec Intl en FR/EN. |
| RES-03 | complet | `src/components/race-results.tsx`, `src/lib/race/results-visuals.ts` | `src/lib/race/results-visuals.test.ts` | SVG commun, axes gradués, motifs distincts, légende et résumé ; clavier AZERTY/QWERTY avec intensités et comptes accessibles. |
| RES-04 | complet | `src/lib/race/persist.ts`, `src/components/race-results.tsx` | `src/lib/race/persist.test.ts` | Record strict au-dessus du meilleur MPM précédent (une première course n'est pas un record battu), courses terminées uniquement, indiqué au joueur local. |
| RES-05 | complet | `prisma/schema.prisma`, `prisma/migrations/20261108120000_resultats/`, `src/lib/race/persist.ts`, `src/server/race-runtime.ts` | `src/lib/race/persist.test.ts`, `src/server/race-runtime.test.ts` | Une transaction finale dédupliquée si au moins un inscrit coureur ; invités/bots sans userId ; résultats diffusés sans attendre l'écriture, une nouvelle tentative après 2 s, puis échec journalisé sans casser la salle. |

## 5.10 Historique

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| HIST-01 | non fait | — | — | — |
| HIST-02 | partiel | `src/app/races/[id]/page.tsx`, `src/components/race-results.tsx` | `src/app/races/[id]/page.test.ts`, `e2e/race.spec.ts` (étendu, non exécuté localement) | Réaffichage complet réservé aux inscrits participants (sinon 404), métadonnées i18n ; navigation depuis l'historique paginé dans la feature suivante. |

## 5.11 Internationalisation

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| I18N-01 | complet | `src/i18n/messages/fr.ts`, `src/i18n/messages/en.ts` | `src/i18n/messages.test.ts` | Libellés, erreurs (codes `ErrorCode`) et métadonnées des pages (`generateMetadata`) en FR et EN (ADR 0009). |
| I18N-02 | complet | `src/components/preferences.tsx`, `src/i18n/server.ts`, `src/i18n/accept-language.ts` | `src/i18n/accept-language.test.ts`, `e2e/langue.spec.ts`, `e2e/room.spec.ts` (langue et thème) | Sélecteur dans l'en-tête de toutes les pages, choix conservé dans un cookie. Sans cookie, la langue suit `Accept-Language`, puis le français (ADR 0014). |
| I18N-03 | partiel | `src/i18n/format.ts`, `src/components/race-results.tsx` | `e2e/race.spec.ts` (non exécuté localement) | Résultats : nombres, pourcentages et durées via Intl selon FR/EN ; dates de l'historique à venir. |

## 6.1 Tests

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| TEST-01 | partiel | `src/**/*.test.ts` | 179 tests unitaires (21 fichiers) | Couvre l'authentification (dont limitation des tentatives et refus de liaison OAuth), les schémas Zod, les codes, le service de salles, la configuration serveur, la langue, l'intégrité du corpus et le seed. Les logiques à venir (course, bots, bonus, MPM) devront être testées. |
| TEST-02 | partiel | `e2e/room.spec.ts`, `playwright.config.ts` | 5 tests de bout en bout | Inscription puis création de salle, arrivée et départ en direct, refus de création pour un invité, code inexistant, langue et thème. |
| TEST-03 | partiel | `e2e/room.spec.ts` | — | Aucun test n'utilise OAuth. L'hôte s'inscrit avec un nom d'utilisateur + mot de passe ; le joueur qui rejoint est un invité. |

## 6.2 Performance

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| PERF-01 | non fait | — | — | Lighthouse pas encore mesuré sur la page d'accueil. |
| PERF-02 | complet | `src/server/race-runtime.ts`, `src/server/room-socket.ts`, `src/app/room/[code]/typing-zone.tsx`, `src/lib/race/input-batcher.ts` | `src/server/race-runtime.test.ts`, `src/lib/race/input-batcher.test.ts` | Tampon client : au plus un paquet de 20 caractères toutes les 100 ms, ordre et séquence croissante ; serveur inchangé. Tests à fausses minuteries. |
| PERF-03 | partiel | `src/app/room/[code]/race-track.tsx` | — | Piste : transition CSS transform et lignes memo, aucun rendu React par image. Reste : mesurer le budget ≥ 50 images/s à 30 coureurs, processeur ×4. |

## 6.3 Accessibilité

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| A11Y-01 | partiel | `src/app/globals.css` | — | Palette choisie pour le contraste ; aucun audit WCAG AA mesuré dans les deux thèmes. |
| A11Y-02 | partiel | `src/components/site-header.tsx`, pages de `src/app/` | — | `<header>`, `<main>`, `<h1>`/`<h2>`, `<button>` et `<a>` utilisés. **Manque** : `<nav>` et `<footer>`. |
| A11Y-03 | partiel | `src/components/form-field.tsx`, `src/components/avatar.tsx` | — | Champs de formulaire avec libellé. Les avatars ont `alt=""` (décoratifs, le nom est affiché à côté) ; à revoir quand d'autres images seront ajoutées (logo, photos). |
| A11Y-04 | partiel | `src/app/globals.css` | — | Éléments natifs accessibles au clavier ; indicateur de focus et parcours complet non vérifiés. |

## 6.4 Sécurité

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| SEC-01 | complet | `src/lib/rooms/service.ts`, `src/server/room-socket.ts`, `src/lib/rooms/schemas.ts`, `src/app/invite/[token]/page.tsx` | `src/lib/rooms/race.test.ts`, `src/lib/rooms/access.test.ts` | Lancer, configurer, ajouter ou retirer un bot, nouvelle course et fermer, générer des liens, expulser, régler visibilité et capacité : session relue côté serveur, hôte vérifié sous verrou, état de la salle vérifié, commandes validées par Zod. |
| SEC-02 | non fait | — | — | Pas de téléversement (voir AUTH-04). |
| SEC-03 | complet | `src/lib/auth/password.ts`, `src/lib/auth/rate-limit.ts`, `src/auth.ts` | `src/lib/auth/password.test.ts`, `src/lib/auth/password-concurrency.test.ts`, `src/lib/auth/rate-limit.test.ts`, `src/lib/auth/actions.test.ts` | scrypt avec sel aléatoire, comparaison à temps constant, hachage factice pour les noms inconnus ; aucun mot de passe journalisé. Limitation des tentatives (connexion par IP et par nom, inscription par IP) et plafond de 2 hachages simultanés (ADR 0012). |

## Livrables de la remise finale (section 8)

| Livrable | Statut | Notes |
|---|---|---|
| Dépôt GitHub et historique régulier | partiel | https://github.com/devzr24/typing-race. Accès de l'enseignant à confirmer ; commits à poursuivre régulièrement. |
| URL de production | complet | https://typing-race-production-4a76.up.railway.app |
| `README.md` | partiel | PostgreSQL via Docker Compose (`docker-compose.yml`), comptes de démonstration et commande de seed. Manque : captures d'écran. |
| `docs/ARCHITECTURE.md` | partiel | Version initiale : vue d'ensemble, modèle de données, machine à états, ADR temps réel, flux temps réel actuels et prévus, approche prévue pour les bots. Manque pour la remise finale : ADR sur les bots, flux de course réels. |
| `docs/EXIGENCES.md` | complet | Ce fichier. |
| `docs/DEMARCHE-CREATIVE.md` | non fait | Voir DES-01 à DES-03. |
| `docs/IA.md` | non fait | `CLAUDE.md` et `AGENTS.md` sont déjà commités. |

## Choix documentés (ambiguïtés, section 2.2)

- **Hébergement (TECH-05)** : Railway plutôt qu'un VPS (ADR 0001). HTTPS et déploiement à chaque push sont automatiques. Écart à faire valider.
- **Temps réel (TECH-06)** : Socket.IO sur le même serveur Node que Next.js, sans service externe (ADR 0002).
- **Transfert d’hôte (SALLE-08)** : à l’humain connecté présent depuis le plus longtemps (participant ou spectateur, jamais un bot), après un délai de grâce de 30 s en cas de déconnexion (ADR 0006).
