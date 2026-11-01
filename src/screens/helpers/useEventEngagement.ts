import { useCallback, useEffect, useState } from "react";
import { myEventSupport, myReminders, supportEvent, toggleReminder } from "../../services/api";

/** Soutien et rappel de l'utilisateur connecté pour un événement. Le serveur décide ; l'écran affiche son verdict. */
export function useEventEngagement(eventId: string | null, uid: string | null, onChanged: () => void) {
  const [supportedId, setSupportedId] = useState<string | null>(null);
  const [reminderOn, setReminderOn] = useState(false);
  const [busy, setBusy] = useState<"support" | "reminder" | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    setSupportedId(null);
    setReminderOn(false);
    if (!eventId || !uid) return;
    Promise.all([myEventSupport(), myReminders()])
      .then(([support, reminders]) => {
        if (!alive) return;
        setSupportedId(support[eventId] ?? null);
        setReminderOn(reminders.has(eventId));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [eventId, uid]);

  const support = useCallback(
    async (playerId: string) => {
      if (!eventId) return;
      setBusy("support");
      setFeedback(null);
      const result = await supportEvent(eventId, playerId);
      setBusy(null);
      if (result.error) return setFeedback({ text: result.error, error: true });
      setSupportedId(playerId);
      setFeedback({ text: "Soutien enregistré. Merci de venir encourager !", error: false });
      onChanged();
    },
    [eventId, onChanged]
  );

  const toggle = useCallback(async () => {
    if (!eventId) return;
    setBusy("reminder");
    setFeedback(null);
    const result = await toggleReminder(eventId);
    setBusy(null);
    if (result.error) return setFeedback({ text: result.error, error: true });
    const on = result.data === true;
    setReminderOn(on);
    setFeedback({ text: on ? "Rappel activé : tu seras prévenu avant le duel." : "Rappel désactivé.", error: false });
  }, [eventId]);

  return { supportedId, reminderOn, busy, feedback, support, toggle };
}
