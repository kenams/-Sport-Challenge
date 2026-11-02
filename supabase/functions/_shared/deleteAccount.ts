// Orchestration de la suppression de compte, sans dépendance Deno (testée par Jest et par scripts/test-server-rules.mjs).
// Ordre voulu : fichiers vidéo -> données en base -> compte d'authentification.
// Si une étape échoue, rien de plus n'est supprimé et le joueur peut recommencer (chaque étape est rejouable).

export interface DeleteAccountDeps {
  /** Fichiers présents dans le dossier du joueur (inclut les envois jamais rattachés à une performance). */
  listFolder(userId: string): Promise<string[]>;
  removeFiles(paths: string[]): Promise<void>;
  /** Appelle delete_my_account_data() avec le jeton du joueur ; renvoie les chemins des vidéos de ses performances. */
  deleteData(): Promise<string[]>;
  deleteAuthUser(userId: string): Promise<void>;
}

export type DeleteAccountResult =
  | { ok: true; filesRemoved: number }
  | { ok: false; step: "list_files" | "remove_files" | "delete_data" | "delete_auth"; message: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteAccount(userId: string, deps: DeleteAccountDeps): Promise<DeleteAccountResult> {
  if (!UUID_PATTERN.test(userId)) return { ok: false, step: "list_files", message: "invalid_user" };
  const own = (paths: string[]) => paths.filter((p) => p.startsWith(`${userId}/`));
  let removed = new Set<string>();

  try {
    const inFolder = own(await deps.listFolder(userId));
    if (inFolder.length > 0) await deps.removeFiles(inFolder);
    removed = new Set(inFolder);
  } catch (error) {
    return { ok: false, step: "remove_files", message: (error as Error).message };
  }

  try {
    const attached = own(await deps.deleteData()).filter((p) => !removed.has(p));
    if (attached.length > 0) await deps.removeFiles(attached);
    attached.forEach((p) => removed.add(p));
  } catch (error) {
    return { ok: false, step: "delete_data", message: (error as Error).message };
  }

  try {
    await deps.deleteAuthUser(userId);
  } catch (error) {
    return { ok: false, step: "delete_auth", message: (error as Error).message };
  }
  return { ok: true, filesRemoved: removed.size };
}
