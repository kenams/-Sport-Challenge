import { DEFAULT_TIMEZONE, isValidTimezone, parseDatetimeLocal, partsToIso, toInt } from "../screens/helpers/eventTime";
import { canCancel, canRespond, canSupport, isConfirmed, posterBanner, roleOf } from "../screens/helpers/eventStatus";
import { barRatio, describeEntitlement, subscribeCta } from "../screens/helpers/proStatus";
import { buildShareMessage, buildShareText, hasShareableLink, publicEventUrl } from "../services/share";
import type { DuelEvent } from "../domain/types";

const NOW = Date.UTC(2026, 10, 1, 12, 0, 0);

describe("eventTime", () => {
  it("convertit une heure de Paris (hiver, UTC+1) en UTC", () => {
    const r = partsToIso({ year: 2026, month: 11, day: 2, hour: 20, minute: 0 }, "Europe/Paris", NOW);
    expect(r).toEqual({ ok: true, iso: "2026-11-02T19:00:00.000Z" });
  });
  it("convertit une heure de Paris en été (UTC+2)", () => {
    const now = Date.UTC(2027, 6, 1, 12, 0, 0);
    const r = partsToIso({ year: 2027, month: 7, day: 14, hour: 20, minute: 30 }, "Europe/Paris", now);
    expect(r).toEqual({ ok: true, iso: "2027-07-14T18:30:00.000Z" });
  });
  it("refuse une date passée", () => {
    const r = partsToIso({ year: 2026, month: 10, day: 1, hour: 20, minute: 0 }, DEFAULT_TIMEZONE, NOW);
    expect(r.ok).toBe(false);
  });
  it("refuse un jour inexistant, une heure invalide et des champs vides", () => {
    expect(partsToIso({ year: 2027, month: 2, day: 30, hour: 10, minute: 0 }, "Europe/Paris", NOW).ok).toBe(false);
    expect(partsToIso({ year: 2027, month: 2, day: 10, hour: 25, minute: 0 }, "Europe/Paris", NOW).ok).toBe(false);
    expect(partsToIso({ year: NaN, month: 2, day: 10, hour: 10, minute: 0 }, "Europe/Paris", NOW).ok).toBe(false);
  });
  it("valide le fuseau", () => {
    expect(isValidTimezone("Europe/Paris")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(partsToIso({ year: 2027, month: 2, day: 10, hour: 10, minute: 0 }, "Nope/Nope", NOW).ok).toBe(false);
  });
  it("analyse datetime-local et les entiers", () => {
    expect(parseDatetimeLocal("2026-11-02T20:00")).toEqual({ year: 2026, month: 11, day: 2, hour: 20, minute: 0 });
    expect(parseDatetimeLocal("")).toBeNull();
    expect(toInt("07")).toBe(7);
    expect(Number.isNaN(toInt("a"))).toBe(true);
  });
});

const base: DuelEvent = {
  id: "e1", slug: "abc", format_key: "pushups_60s", discipline: "pushups", player_a: "A", player_b: "B",
  scheduled_at: "2026-11-02T19:00:00.000Z", timezone: "Europe/Paris", status: "proposed", accepted_by_a: true, accepted_by_b: false, created_at: "",
};

describe("eventStatus", () => {
  it("seul l'adversaire qui n'a pas accepté peut répondre", () => {
    expect(canRespond(base, "B")).toBe(true);
    expect(canRespond(base, "A")).toBe(false);
    expect(canRespond(base, null)).toBe(false);
    expect(canRespond({ ...base, status: "cancelled" }, "B")).toBe(false);
  });
  it("seuls les joueurs peuvent annuler, et pas un duel terminé", () => {
    expect(canCancel(base, "A")).toBe(true);
    expect(canCancel(base, "X")).toBe(false);
    expect(canCancel({ ...base, status: "finished" }, "A")).toBe(false);
    expect(roleOf(base, "B")).toBe("player_b");
  });
  it("ne présente jamais un duel proposé comme confirmé", () => {
    expect(isConfirmed("proposed")).toBe(false);
    expect(isConfirmed("accepted")).toBe(false);
    expect(isConfirmed("scheduled")).toBe(true);
    expect(posterBanner("proposed")).toBe("Proposé, en attente d'accord");
    expect(canSupport("proposed")).toBe(false);
    expect(canSupport("scheduled")).toBe(true);
  });
});

describe("share", () => {
  const ev = {
    slug: "abc", status: "scheduled" as const, scheduled_at: "2026-11-02T19:00:00.000Z", timezone: "Europe/Paris", formatKey: "pushups_60s",
    playerA: { pseudo: "A", city: "Toulouse" }, playerB: { pseudo: "B", city: "Montauban" },
  };
  it("construit le lien public", () => {
    expect(publicEventUrl("abc", "https://immortal.app")).toBe("https://immortal.app/e/abc");
    expect(publicEventUrl("abc", "https://immortal.app/")).toBe("https://immortal.app/e/abc");
    expect(publicEventUrl("abc", "")).toBe("/e/abc");
    expect(hasShareableLink("")).toBe(false);
    expect(hasShareableLink("https://immortal.app")).toBe(true);
  });
  it("sans base, pas de lien dans le message", () => {
    expect(buildShareMessage(ev, "").url).toBeNull();
    expect(buildShareMessage(ev, "https://x.io").url).toBe("https://x.io/e/abc");
  });
  it("texte confirmé vs proposé", () => {
    const t = buildShareText(ev);
    expect(t).toContain("A (Toulouse) vs B (Montauban)");
    expect(t).toContain("Pompes 60 s");
    expect(t).toContain("Viens soutenir");
    const p = buildShareText({ ...ev, status: "proposed" });
    expect(p).toContain("en attente d'accord");
    expect(p).not.toContain("Viens soutenir");
  });
});

describe("pro", () => {
  it("le bouton d'abonnement est désactivé sauf drapeau explicite", () => {
    expect(subscribeCta(undefined).disabled).toBe(true);
    expect(subscribeCta("false").disabled).toBe(true);
    expect(subscribeCta(undefined).label).toBe("Abonnements bientôt disponibles");
    expect(subscribeCta("true").disabled).toBe(true);
  });
  it("décrit l'état du droit", () => {
    const e = (status: any) => ({ plan: "pro" as const, status, current_period_end: "2027-01-15T00:00:00Z", source: null });
    expect(describeEntitlement({ plan: "free", status: "none", current_period_end: null, source: null }, false).label).toBe("Gratuit");
    expect(describeEntitlement(e("active"), true).label).toBe("Pro actif");
    expect(describeEntitlement(e("billing_issue"), false).tone).toBe("danger");
    expect(describeEntitlement(e("expired"), false).label).toBe("Pro expiré");
    expect(describeEntitlement(e("refunded"), false).label).toBe("Pro remboursé");
  });
  it("ratio de barre borné", () => {
    expect(barRatio(5, 10)).toBe(0.5);
    expect(barRatio(0, 10)).toBe(0);
    expect(barRatio(5, 0)).toBe(0);
    expect(barRatio(20, 10)).toBe(1);
  });
});


describe("dates de duel aux changements d'heure", () => {
  const beforeSpringChange = Date.UTC(2027, 2, 20, 12, 0, 0);
  const beforeAutumnChange = Date.UTC(2027, 9, 20, 12, 0, 0);
  const beforeIndiaDate = Date.UTC(2026, 11, 20, 12, 0, 0);

  it("refuse une heure inexistante à Paris", () => {
    const result = partsToIso({ year: 2027, month: 3, day: 28, hour: 2, minute: 30 }, "Europe/Paris", beforeSpringChange);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("n'existe pas");
  });
  it("refuse une heure ambiguë à Paris", () => {
    const result = partsToIso({ year: 2027, month: 10, day: 31, hour: 2, minute: 30 }, "Europe/Paris", beforeAutumnChange);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("deux fois");
  });
  it("accepte une heure valide après le saut d'heure", () => {
    expect(partsToIso({ year: 2027, month: 3, day: 28, hour: 3, minute: 30 }, "Europe/Paris", beforeSpringChange)).toEqual({ ok: true, iso: "2027-03-28T01:30:00.000Z" });
  });
  it("gère un décalage de trente minutes sans décaler le rendez-vous", () => {
    expect(partsToIso({ year: 2027, month: 1, day: 2, hour: 20, minute: 0 }, "Asia/Kolkata", beforeIndiaDate)).toEqual({ ok: true, iso: "2027-01-02T14:30:00.000Z" });
  });
  it("refuse une chaîne avec un suffixe non valide", () => {
    expect(parseDatetimeLocal("2027-01-02T20:00garbage")).toBeNull();
  });
});

describe("cohérence de l'accès Pro", () => {
  it("ne présente pas un abonnement actif sans droit confirmé par le serveur", () => {
    const state = describeEntitlement({ plan: "pro", status: "active", current_period_end: "2026-10-01T00:00:00Z", source: "revenuecat" }, false);
    expect(state.label).toBe("Pro inactif");
    expect(state.tone).not.toBe("success");
  });
  it("ne promet pas un accès restant après expiration d'un abonnement résilié", () => {
    const state = describeEntitlement({ plan: "pro", status: "cancelled_pending", current_period_end: "2026-10-01T00:00:00Z", source: "revenuecat" }, false);
    expect(state.label).toBe("Pro résilié");
    expect(state.detail).not.toContain("Accès jusqu'au");
  });
});
