/**
 * Build a Postgres ILIKE pattern for a literal pseudo search.
 * Backslash is escaped first because it is Postgres' default LIKE escape
 * character; percent and underscore are then treated as ordinary characters.
 */
export function playerSearchPattern(query: string): string | null {
  const value = query.trim();
  if (value.length < 2) return null;
  const literal = value.replace(/[\\%_]/g, "\\$&");
  return `%${literal}%`;
}
