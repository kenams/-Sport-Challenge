import { deleteAccount, type DeleteAccountDeps } from "../../supabase/functions/_shared/deleteAccount";

const USER = "123e4567-e89b-42d3-a456-426614174000";
const OTHER = "223e4567-e89b-42d3-a456-426614174000";

function makeDeps(over: Partial<DeleteAccountDeps> = {}) {
  const calls: string[] = [];
  const removed: string[][] = [];
  const deps: DeleteAccountDeps = {
    listFolder: async () => {
      calls.push("list");
      return [`${USER}/a.mp4`, `${USER}/orphan.mp4`, `${OTHER}/intrus.mp4`];
    },
    removeFiles: async (paths) => {
      calls.push("remove");
      removed.push(paths);
    },
    deleteData: async () => {
      calls.push("data");
      return [`${USER}/a.mp4`, `${USER}/b.mp4`, `${OTHER}/intrus2.mp4`];
    },
    deleteAuthUser: async () => {
      calls.push("auth");
    },
    ...over,
  };
  return { deps, calls, removed };
}

describe("deleteAccount", () => {
  it("supprime les fichiers, puis les données, puis le compte, dans cet ordre", async () => {
    const { deps, calls } = makeDeps();
    const result = await deleteAccount(USER, deps);
    expect(result).toEqual({ ok: true, filesRemoved: 3 });
    expect(calls).toEqual(["list", "remove", "data", "remove", "auth"]);
  });

  it("ne touche jamais aux fichiers d'un autre joueur", async () => {
    const { deps, removed } = makeDeps();
    await deleteAccount(USER, deps);
    expect(removed.flat().every((p) => p.startsWith(`${USER}/`))).toBe(true);
  });

  it("n'efface pas deux fois un fichier déjà supprimé", async () => {
    const { deps, removed } = makeDeps();
    await deleteAccount(USER, deps);
    expect(removed.flat().filter((p) => p.endsWith("a.mp4"))).toHaveLength(1);
  });

  it("s'arrête si la suppression des fichiers échoue : ni données ni compte touchés", async () => {
    const { deps, calls } = makeDeps({
      removeFiles: async () => {
        throw new Error("storage down");
      },
    });
    const result = await deleteAccount(USER, deps);
    expect(result).toMatchObject({ ok: false, step: "remove_files" });
    expect(calls).not.toContain("data");
    expect(calls).not.toContain("auth");
  });

  it("s'arrête si les données ne partent pas : le compte reste utilisable pour recommencer", async () => {
    const { deps, calls } = makeDeps({
      deleteData: async () => {
        throw new Error("db down");
      },
    });
    expect(await deleteAccount(USER, deps)).toMatchObject({ ok: false, step: "delete_data" });
    expect(calls).not.toContain("auth");
  });

  it("signale l'échec de suppression du compte d'authentification", async () => {
    const { deps } = makeDeps({
      deleteAuthUser: async () => {
        throw new Error("auth down");
      },
    });
    expect(await deleteAccount(USER, deps)).toMatchObject({ ok: false, step: "delete_auth" });
  });

  it("refuse un identifiant invalide sans rien appeler", async () => {
    const { deps, calls } = makeDeps();
    expect(await deleteAccount("../../etc", deps)).toMatchObject({ ok: false });
    expect(calls).toEqual([]);
  });
});
