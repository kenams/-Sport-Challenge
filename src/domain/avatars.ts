/** Avatars statiques publics ; leurs identifiants sont validés côté serveur avant écriture du profil. */
export const AVATAR_BASE_URL = "https://immortal-arena.vercel.app/avatars/library";

export const AVATAR_OPTIONS = [
  { id: "locks", label: "Locks longues" },
  { id: "black-curls", label: "Boucles naturelles" },
  { id: "blonde", label: "Cheveux blonds" },
  { id: "brown-curls", label: "Boucles brunes" },
  { id: "south-asian-woman", label: "Ondulations" },
  { id: "south-asian-man", label: "Barbe courte" },
  { id: "east-asian-man", label: "Cheveux courts" },
  { id: "east-asian-woman", label: "Cheveux longs" },
  { id: "north-african-man", label: "Boucles courtes" },
] as const;

export type AvatarId = (typeof AVATAR_OPTIONS)[number]["id"];
export function avatarUrl(id: AvatarId): string {
  return AVATAR_BASE_URL + "/" + id + ".jpg";
}
