# ADR 0017 — Accès aux salles : visibilité, invitations, expulsion et partie rapide

- **Statut :** accepté
- **Date :** 2026-11-07

## Contexte

L'énoncé (SALLE-03 à SALLE-10, JOIN-02, JOIN-03, SEC-01) exige trois visibilités, des liens d'invitation
à usage unique liés à une adresse IP, une capacité, une seule salle par personne, l'expulsion, un transfert
d'hôte limité aux humains connectés, une protection du code contre la force brute, un explorateur en direct
et une partie rapide. Le schéma (migration `20261107180000_salles_config_acces`) contient déjà les tables
`RoomInvite` et `RoomBan` et la contrainte `RoomParticipant.key` unique.

## Décision

- **Jeton d'invitation** : 32 octets de `crypto.randomBytes` (256 bits) encodés en base64url, montrés une
  seule fois à l'hôte. Seule l'empreinte SHA-256 est stockée : une fuite de la base ne donne aucun lien
  valide. Entrée par `/invite/<jeton>`.
- **Liaison à l'IP** : à la première utilisation, le lien enregistre la clé, le nom et l'IP de la personne ;
  ensuite seule cette IP est acceptée, et la même personne peut revenir avec le lien. L'IP est lue comme
  dans l'ADR 0012 (dernière valeur de `X-Forwarded-For` ajoutée par le proxy Railway).
- **Révocation** : expulser une personne révoque les liens qu'elle a utilisés et l'inscrit dans `RoomBan` ;
  supprimer la salle supprime ses liens (cascade), donc aucun lien ne survit à la fermeture.
- **Une salle par personne** : garantie par la contrainte unique en base ; l'erreur est traduite en un code
  qui porte la salle actuelle, et l'interface propose de la quitter avant d'entrer.
- **Capacité** : de 2 à 30 ; les bots comptent, les spectateurs non. Une salle pleine accepte encore des
  spectateurs.
- **Code de salle** : 10 tentatives par minute et par IP, avec le limiteur en mémoire de l'ADR 0012,
  vérifié avant toute lecture en base.
- **Explorateur** : canal Socket.IO `lobby` ; le serveur y diffuse la liste des salles publiques à chaque
  changement (création, entrée, départ, configuration, état, suppression).
- **Partie rapide** : salle publique joignable, non pleine et sans bannissement de la personne, avec le moins
  de places libres ; à égalité, la plus ancienne.
- **Transfert d'hôte** : au plus ancien humain ayant encore un socket ouvert dans la salle, jamais à un bot
  (complète l'ADR 0006, dont le délai de grâce de 30 s est conservé).

## Conséquences

- Le limiteur et la présence des sockets sont en mémoire : valables tant que l'application tourne sur une
  seule instance Railway, ce qui est le cas.
- Le jeton en clair n'étant pas stocké, l'hôte ne peut pas recopier un ancien lien : il en génère un autre.
- Deux personnes derrière la même IP (même réseau) peuvent utiliser le lien de l'autre si elles l'obtiennent :
  limite acceptée par l'énoncé, qui fixe la liaison à l'IP.
- Le bannissement porte sur l'identité (id de l'utilisateur ou clé d'invité) : un invité expulsé qui ouvre
  une nouvelle session d'invité obtient une nouvelle identité. Bannir aussi l'IP aurait exclu toute une
  classe ou un réseau partagé.
- Avec « quitter ma salle actuelle », la salle visée est validée avant de quitter l'ancienne : un refus
  laisse la personne où elle était.

## Alternatives écartées

- **Stocker le jeton en clair** : plus simple pour le recopier, mais une lecture de la base suffirait à entrer
  dans toutes les salles privées.
- **Limiteur dans Redis ou Postgres** : inutile avec une seule instance ; ajouterait un service ou des
  écritures à chaque tentative.
- **Rafraîchir l'explorateur par interrogation périodique** : charge inutile et retard ; Socket.IO est déjà là.
