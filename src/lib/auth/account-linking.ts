/** Seul un utilisateur OAuth fraîchement créé peut recevoir son premier compte. */
export function canLinkAccount(passwordHash: string | null, accountCount: number): boolean {
  return passwordHash === null && accountCount === 0;
}
