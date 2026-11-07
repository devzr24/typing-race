export const MAX_CHARACTERS_PER_MESSAGE = 20;
export const MAX_AVERAGE_MPM = 300;

export function netMpm(correctCharacters: number, elapsedMs: number): number {
  return elapsedMs <= 0 ? 0 : (correctCharacters / 5) / (elapsedMs / 60_000);
}

export function grossMpm(totalCharacters: number, elapsedMs: number): number {
  return netMpm(totalCharacters, elapsedMs);
}

// Sans frappe, aucune erreur : précision de 100 %.
export function accuracy(correctKeystrokes: number, totalKeystrokes: number): number {
  return totalKeystrokes === 0 ? 100 : (correctKeystrokes / totalKeystrokes) * 100;
}

// La longueur inclut les espaces et les modifications des bonus.
export function progress(validatedCharacters: number, textLength: number): number {
  return textLength <= 0 ? 0 : Math.max(0, Math.min(1, validatedCharacters / textLength));
}

// Positions entières, aucun recul, au plus 20 caractères/message et 300 MPM moyens.
// En cas de rejet, le serveur ne fait pas avancer la position de référence.
export function isPlausibleProgress({ prevPosition, newPosition, raceElapsedMs, textLength }: {
  prevPosition: number;
  newPosition: number;
  raceElapsedMs: number;
  textLength: number;
}): boolean {
  if (![prevPosition, newPosition, textLength].every(Number.isSafeInteger)
    || !Number.isFinite(raceElapsedMs) || raceElapsedMs < 0
    || prevPosition < 0 || newPosition < prevPosition || newPosition > textLength) return false;
  const delta = newPosition - prevPosition;
  return delta <= MAX_CHARACTERS_PER_MESSAGE
    && (newPosition <= MAX_CHARACTERS_PER_MESSAGE
      || (raceElapsedMs > 0 && netMpm(newPosition, raceElapsedMs) <= MAX_AVERAGE_MPM));
}
