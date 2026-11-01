import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

/** Id de l'utilisateur connecté (null si visiteur) ; `ready` devient vrai une fois la session lue. */
export function useSessionUser(): { uid: string | null; ready: boolean } {
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setUid(data.session?.user?.id ?? null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setReady(true);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setUid(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return { uid, ready };
}
