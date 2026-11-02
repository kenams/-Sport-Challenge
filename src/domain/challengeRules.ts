/** Écart maximal entre deux niveaux pour un défi nominatif ou un duel direct.
 * Les bonus d'événement futurs devront venir d'une règle serveur, jamais d'un achat client.
 */
export const MAX_DIRECT_LEVEL_GAP = 10;

export function exceedsDirectLevelGap(a: number | null | undefined, b: number | null | undefined): boolean {
  return a != null && b != null && Math.abs(a - b) > MAX_DIRECT_LEVEL_GAP;
}
