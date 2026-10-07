# Matrice des exigences

Priorité : **E** = essentielle, **S** = souhaitable, **F** = facultative (cahier des charges).
Statut : **fait**, **partiel** (une partie livrée, le reste prévu), **prévu** (pas commencé).
Tests : `*.test.ts` = tests unitaires (Vitest) ; `e2e/…` = tests de bout en bout (Playwright).

Mise à jour : 2026-10-07.

## Authentification

| ID | Exigence | Prio. | Statut | Fichiers | Tests |
|---|---|---|---|---|---|
| AUTH-01 | Connexion GitHub / Discord | E | fait | `src/auth.ts`, `src/app/login/` | `src/lib/auth/username.test.ts` (noms et suffixes) ; parcours OAuth vérifié manuellement |
| AUTH-02 | Compte nom d'utilisateur unique + mot de passe, sans courriel ; pas de mot de passe oublié ni MFA | E | fait | `src/auth.ts`, `src/lib/auth/`, `src/app/register/` | `src/lib/auth/password.test.ts`, `src/lib/auth/username.test.ts` |
| AUTH-03 | Invité anonyme avec statistiques de fin de course | E | partiel : invité fait ; statistiques prévues | `src/auth.ts` (fournisseur `guest`), `src/lib/auth/guest.ts` | `src/lib/auth/username.test.ts` ; `e2e/room.spec.ts` |
| AUTH-04 | Nom et photo temporaires d'invité, statistiques de séance | S | partiel : pseudo temporaire fait ; photo et statistiques prévues | `src/app/login/login-forms.tsx` | `e2e/room.spec.ts` |

## Salles (lobby)

| ID | Exigence | Prio. | Statut | Fichiers | Tests |
|---|---|---|---|---|---|
| LOBBY-01 | Création et configuration d'un lobby ; hôte participant ou spectateur | E | partiel : création faite ; configuration et mode spectateur prévus | `src/lib/rooms/`, `src/app/home-actions.tsx` | `src/lib/rooms/service.test.ts` ; `e2e/room.spec.ts` |
| LOBBY-02 | Rejoindre : salle publique, code, lien privé unique | E | partiel : code fait ; publique et lien privé prévus | `src/lib/rooms/code.ts`, `src/lib/rooms/service.ts` | `src/lib/rooms/code.test.ts`, `src/lib/rooms/service.test.ts` ; `e2e/room.spec.ts` |
| LOBBY-03 | Matchmaking | E | prévu | — | — |
| LOBBY-04 | Minimum 2 participants ; au moins 30 joueurs | E | prévu | — | — |
| LOBBY-05 | Relancer / fermer la salle | E | prévu | [machine à états](architecture/machine-a-etats.md) | — |
| LOBBY-06 | Transfert d'hôte | E | fait (automatique au départ, au plus ancien) | `src/lib/rooms/service.ts`, `src/server/room-socket.ts` | `src/lib/rooms/service.test.ts` |
| LOBBY-07 | Donner le lobby (transfert manuel) | S | prévu | — | — |

## Course

| ID | Exigence | Prio. | Statut | Fichiers | Tests |
|---|---|---|---|---|---|
| RACE-01 | Même texte pour tous en temps réel, positions en direct | E | prévu (temps réel Socket.IO en place) | `src/server/` | — |
| RACE-02 | Indicateur de dépassement | E | prévu | — | — |
| RACE-03 | Timer | E | prévu | — | — |
| RACE-04 | Détection d'inactivité | S | prévu | — | — |
| RACE-05 | Reconnexion automatique | E | partiel : reconnexion Socket.IO + délai de grâce de 30 s dans le lobby | `src/app/room/[code]/room-view.tsx`, `src/server/room-socket.ts` | `e2e/room.spec.ts` (arrivée/départ en direct) |
| RACE-06 | Abandon et déconnexion | E | prévu (départ du lobby déjà géré) | — | — |

## Texte, bots, bonus

| ID | Exigence | Prio. | Statut | Fichiers | Tests |
|---|---|---|---|---|---|
| TEXT-01 à TEXT-04 | Personnalisation du texte et modes d'erreurs | E | prévu | — | — |
| TEXT-05 | Aide « comment taper » | F | prévu | — | — |
| BOT-01 à BOT-03 | Bots | E | prévu | — | — |
| BONUS-01 à BONUS-03 | Bonus | E | prévu | — | — |

## Statistiques

| ID | Exigence | Prio. | Statut | Fichiers | Tests |
|---|---|---|---|---|---|
| STAT-01 | Résultats / podium | E | prévu | [modèle prévu](architecture/modele-de-donnees.md#prévu-non-créé-en-base) | — |
| STAT-02 | Heat map | E | prévu | — | — |
| STAT-03 | Historique | E | prévu | — | — |
| STAT-04 | Trophées | F | prévu | — | — |

## Interface

| ID | Exigence | Prio. | Statut | Fichiers | Tests |
|---|---|---|---|---|---|
| UI-01 | Bilingue, thèmes, responsive | E | partiel : FR/EN et thèmes faits ; mise en page responsive simple, pas encore vérifiée sur mobile | `src/i18n/`, `src/components/preferences.tsx`, `src/app/globals.css` | `src/i18n/messages.test.ts` ; `e2e/room.spec.ts` (langue et thème) |
| UI-02 | Direction artistique | E | prévu (jetons de couleur/police prêts dans `globals.css`) | `src/app/globals.css` | — |
| UI-03 | Nom et logo réalisés sans IA | E | prévu (nom provisoire dans `src/i18n/messages/`) | — | — |
| UI-04 | Mode daltonien | F | prévu | — | — |

## Technique

| ID | Exigence | Prio. | Statut | Fichiers | Tests |
|---|---|---|---|---|---|
| TECH-01 | React / Next.js / TypeScript / Tailwind / PostgreSQL | E | fait | `package.json`, `prisma/` | toute la suite |
| TECH-02 | Hébergement HTTPS | E | fait (Railway) | `railway.json`, `server.ts`, [ADR 0001](adr/0001-hebergement-railway.md) | `/api/health` ; `E2E_BASE_URL=… npm run test:e2e` |
| TECH-03 | Tests, CI, GitHub, documentation | E | partiel : tests, pipeline et docs en place ; exécution du pipeline sur GitHub à confirmer | `.github/workflows/ci.yml`, `e2e/`, `docs/` | 71 tests unitaires, 4 tests de bout en bout |
