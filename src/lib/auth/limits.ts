// Limites partagées entre le serveur et les formulaires (sans dépendance Node).
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;
export const PASSWORD_MIN_LENGTH = 8;
// Limite haute : évite de hacher des entrées énormes envoyées exprès pour ralentir le serveur.
export const PASSWORD_MAX_LENGTH = 128;
