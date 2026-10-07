# ADR 0006 — Salles par code, départs et transfert d'hôte

- **Statut :** accepté
- **Date :** 2026-10-07

## Contexte

LOBBY-01 et LOBBY-02 : un utilisateur connecté ou invité crée une salle (il en devient l'hôte) ;
les autres la rejoignent avec un code court, dicté en classe. La liste des participants est
mise à jour en direct. Il faut décider ce qui arrive quand l'hôte part, et ce que « partir » veut
dire alors qu'un rechargement de page coupe la connexion Socket.IO.

## Décision

- **Code** : 6 caractères parmi `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (sans 0/O, 1/I/L), tiré avec
  le générateur cryptographique de Node ; unicité vérifiée avant création et garantie par une
  contrainte d'unicité (nouveau tirage en cas de collision). La saisie accepte minuscules,
  espaces et tirets.
- **Transfert d'hôte** (décision de l'équipe) : quand l'hôte quitte la salle, le rôle passe
  **automatiquement au participant arrivé le plus tôt** (`joinedAt` le plus ancien).
- **Quitter** = bouton « Quitter la salle », ou déconnexion Socket.IO sans retour pendant
  **30 secondes** (délai de grâce). Un rechargement de page ou une courte coupure ne fait donc
  pas perdre sa place ni son rôle d'hôte ; la ligne `RoomParticipant` est conservée et le
  participant se réabonne à la reconnexion.
- **Salle vide** : supprimée (son code redevient libre).
- **Arrivée** : uniquement avec le code saisi sur l'accueil. Ouvrir `/room/CODE` sans faire
  partie de la salle affiche un message : les liens privés et les salles publiques viendront plus tard.
- **État** : `EN_ATTENTE` à la création ; `EN_COURSE` et `TERMINEE` sont déjà dans l'énumération
  pour la future machine à états. On ne rejoint qu'une salle `EN_ATTENTE`.
- **Concurrence** : chaque arrivée ou départ verrouille la ligne de la salle
  (`SELECT … FOR UPDATE` dans une transaction) ; deux départs simultanés ne peuvent pas
  désigner deux hôtes.
- **Redémarrage du serveur** : les minuteries de départ sont recréées pour tous les participants
  enregistrés ; ceux qui ne se reconnectent pas dans le délai sont retirés.

## Conséquences

- L'ordre d'arrivée est la seule règle : prévisible et facile à expliquer en classe.
- Un participant qui ferme l'onglet reste affiché jusqu'à 30 secondes.
- Les minuteries vivent dans le processus : cohérent avec une seule instance (ADR 0002).

## Alternatives écartées

- **Hôte choisi au hasard** ou **par vote** : imprévisible, ou trop lourd pour un salon d'attente.
- **Fermer la salle au départ de l'hôte** : tous les autres perdraient leur place.
- **Départ immédiat à la déconnexion** : un simple rechargement ferait perdre la place et le rôle d'hôte.
- **Codes plus longs ou avec 0/O/1/I** : plus difficiles à dicter et à recopier.
