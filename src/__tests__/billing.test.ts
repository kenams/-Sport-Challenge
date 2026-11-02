import { createCheckoutSession, createPortalSession, validatedOrigin, type CheckoutDeps } from "../../supabase/functions/_shared/billing";

const USER = "123e4567-e89b-42d3-a456-426614174000";
const KEY = "fake_secret_for_tests_only_123456";

function makeDeps(over: Partial<CheckoutDeps> = {}, reply: { status?: number; body?: unknown; throws?: boolean } = {}) {
  const calls: Array<{ url: string; init: any }> = [];
  const logs: Array<Record<string, unknown>> = [];
  const deps: CheckoutDeps = {
    config: { secretKey: KEY, priceMonthly: "price_month_1", priceAnnual: "price_year_1", webBaseUrl: "https://immortal.example/app/" },
    fetch: (async (url: string, init: any) => {
      calls.push({ url, init });
      if (reply.throws) throw new Error(`boom ${KEY}`);
      return new Response(JSON.stringify(reply.body ?? { url: "https://checkout.stripe.com/c/pay/cs_test_1" }), { status: reply.status ?? 200 });
    }) as any,
    log: (entry) => logs.push(entry),
    isPro: async () => false,
    findCustomerId: async () => null,
    ...over,
  };
  return { deps, calls, logs };
}
const form = (call: { init: any }) => new URLSearchParams(call.init.body as string);

describe("createCheckoutSession", () => {
  it("refuse un plan inconnu, y compris un price_id fourni par le client", async () => {
    const { deps, calls } = makeDeps();
    for (const plan of ["weekly", "price_month_1", "", undefined, null, 5, { a: 1 }, "MONTHLY"]) {
      const result = await createCheckoutSession({ userId: USER, plan }, deps);
      expect(result).toEqual({ ok: false, status: 400, error: "invalid_plan" });
    }
    expect(calls).toHaveLength(0);
  });

  it("refuse un utilisateur absent ou invalide", async () => {
    const { deps, calls } = makeDeps();
    expect(await createCheckoutSession({ userId: null, plan: "monthly" }, deps)).toEqual({ ok: false, status: 401, error: "not_authenticated" });
    expect(await createCheckoutSession({ userId: "pas-un-uuid", plan: "monthly" }, deps)).toMatchObject({ status: 401 });
    expect(calls).toHaveLength(0);
  });

  it("refuse si le joueur est déjà Pro", async () => {
    const { deps, calls } = makeDeps({ isPro: async () => true });
    expect(await createCheckoutSession({ userId: USER, plan: "annual" }, deps)).toEqual({ ok: false, status: 409, error: "already_pro" });
    expect(calls).toHaveLength(0);
  });

  it("construit exactement la requête Stripe attendue (mensuel)", async () => {
    const { deps, calls } = makeDeps();
    const result = await createCheckoutSession({ userId: USER, email: "a@b.test", plan: "monthly" }, deps);
    expect(result).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers.Authorization).toBe(`Bearer ${KEY}`);
    const f = form(calls[0]);
    expect(f.get("mode")).toBe("subscription");
    expect(f.get("line_items[0][price]")).toBe("price_month_1");
    expect(f.get("line_items[0][quantity]")).toBe("1");
    expect(f.get("client_reference_id")).toBe(USER);
    expect(f.get("subscription_data[metadata][user_id]")).toBe(USER);
    expect(f.get("success_url")).toBe("https://immortal.example/Pro?checkout=success");
    expect(f.get("cancel_url")).toBe("https://immortal.example/Pro?checkout=cancel");
    expect(f.get("customer_email")).toBe("a@b.test");
    expect(f.has("customer")).toBe(false);
  });

  it("utilise le prix annuel pour le plan annuel", async () => {
    const { deps, calls } = makeDeps();
    await createCheckoutSession({ userId: USER, plan: "annual" }, deps);
    expect(form(calls[0]).get("line_items[0][price]")).toBe("price_year_1");
  });

  it("réutilise le client Stripe connu au lieu de l'e-mail", async () => {
    const { deps, calls } = makeDeps({ findCustomerId: async () => "cus_ABC123" });
    await createCheckoutSession({ userId: USER, email: "a@b.test", plan: "monthly" }, deps);
    const f = form(calls[0]);
    expect(f.get("customer")).toBe("cus_ABC123");
    expect(f.has("customer_email")).toBe(false);
  });

  it("ignore un identifiant client malformé", async () => {
    const { deps, calls } = makeDeps({ findCustomerId: async () => "cus_x&mode=payment" });
    await createCheckoutSession({ userId: USER, plan: "monthly" }, deps);
    expect(form(calls[0]).has("customer")).toBe(false);
  });

  it("refuse (503) quand la configuration est absente ou invalide, sans appeler Stripe", async () => {
    for (const config of [
      { secretKey: "", priceMonthly: "price_m", priceAnnual: "price_a", webBaseUrl: "https://x.example" },
      { secretKey: KEY, priceMonthly: "", priceAnnual: "price_a", webBaseUrl: "https://x.example" },
      { secretKey: KEY, priceMonthly: "prod_nope", priceAnnual: "price_a", webBaseUrl: "https://x.example" },
      { secretKey: KEY, priceMonthly: "price_m", priceAnnual: "price_a", webBaseUrl: "javascript:alert(1)" },
      { secretKey: KEY, priceMonthly: "price_m", priceAnnual: "price_a", webBaseUrl: "http://evil.example" },
      { secretKey: KEY, priceMonthly: "price_m", priceAnnual: "price_a", webBaseUrl: "" },
    ]) {
      const { deps, calls } = makeDeps({ config });
      expect(await createCheckoutSession({ userId: USER, plan: "monthly" }, deps)).toEqual({ ok: false, status: 503, error: "billing_unavailable" });
      expect(calls).toHaveLength(0);
    }
  });

  it("renvoie une erreur propre sans fuite quand Stripe répond en erreur", async () => {
    const { deps, logs } = makeDeps({}, { status: 400, body: { error: { type: "invalid_request_error", code: "resource_missing", message: `No such price; key ${KEY} user a@b.test` } } });
    const result = await createCheckoutSession({ userId: USER, email: "a@b.test", plan: "monthly" }, deps);
    expect(result).toEqual({ ok: false, status: 502, error: "stripe_error" });
    expect(JSON.stringify(result)).not.toContain("No such price");
    expect(logs).toEqual([{ source: "billing", path: "/v1/checkout/sessions", status: 400, type: "invalid_request_error", code: "resource_missing" }]);
    expect(JSON.stringify(logs)).not.toContain(KEY);
    expect(JSON.stringify(logs)).not.toContain("a@b.test");
  });

  it("gère un Stripe injoignable sans journaliser la clé", async () => {
    const { deps, logs } = makeDeps({}, { throws: true });
    expect(await createCheckoutSession({ userId: USER, plan: "monthly" }, deps)).toEqual({ ok: false, status: 502, error: "stripe_error" });
    expect(JSON.stringify(logs)).not.toContain(KEY);
  });

  it("refuse une réponse sans URL valide ou en http hors essai local", async () => {
    for (const body of [{}, { url: "javascript:alert(1)" }, { url: "http://evil.example/pay" }, { url: 5 }]) {
      const { deps } = makeDeps({}, { body });
      expect(await createCheckoutSession({ userId: USER, plan: "monthly" }, deps)).toMatchObject({ ok: false, error: "stripe_error" });
    }
  });

  it("n'écrit la clé dans aucun journal, en succès comme en échec", async () => {
    const ok = makeDeps();
    await createCheckoutSession({ userId: USER, plan: "monthly" }, ok.deps);
    const ko = makeDeps({}, { status: 401, body: { error: { type: "authentication_error", message: `Invalid API Key provided: ${KEY}` } } });
    const result = await createCheckoutSession({ userId: USER, plan: "monthly" }, ko.deps);
    expect(JSON.stringify([ok.logs, ko.logs, result])).not.toContain(KEY);
  });
});

describe("validatedOrigin", () => {
  it("n'accepte que https (ou http local) sans identifiants et ne garde que l'origine", () => {
    expect(validatedOrigin("https://immortal.example/chemin?x=1")).toBe("https://immortal.example");
    expect(validatedOrigin("http://localhost:8099")).toBe("http://localhost:8099");
    expect(validatedOrigin("http://127.0.0.1:8099/")).toBe("http://127.0.0.1:8099");
    expect(validatedOrigin("https://user:pw@immortal.example")).toBeNull();
    expect(validatedOrigin("ftp://x.example")).toBeNull();
    expect(validatedOrigin("n'importe quoi")).toBeNull();
    expect(validatedOrigin(undefined)).toBeNull();
  });
});

describe("createPortalSession", () => {
  it("refuse sans utilisateur", async () => {
    const { deps, calls } = makeDeps();
    expect(await createPortalSession({ userId: null }, deps)).toEqual({ ok: false, status: 401, error: "not_authenticated" });
    expect(calls).toHaveLength(0);
  });

  it("refuse un joueur sans client Stripe connu", async () => {
    const { deps, calls } = makeDeps();
    expect(await createPortalSession({ userId: USER }, deps)).toEqual({ ok: false, status: 409, error: "no_customer" });
    expect(calls).toHaveLength(0);
  });

  it("crée la session du portail pour le client connu, avec retour sur la même origine", async () => {
    const { deps, calls } = makeDeps({ findCustomerId: async () => "cus_ABC123" }, { body: { url: "https://billing.stripe.com/p/session/x" } });
    expect(await createPortalSession({ userId: USER }, deps)).toEqual({ ok: true, url: "https://billing.stripe.com/p/session/x" });
    expect(calls[0].url).toBe("https://api.stripe.com/v1/billing_portal/sessions");
    const f = form(calls[0]);
    expect(f.get("customer")).toBe("cus_ABC123");
    expect(f.get("return_url")).toBe("https://immortal.example/Pro?portal=return");
  });

  it("renvoie une erreur propre sans fuite si Stripe refuse (portail non activé)", async () => {
    const { deps, logs } = makeDeps({ findCustomerId: async () => "cus_ABC123" }, { status: 400, body: { error: { type: "invalid_request_error", message: `config ${KEY}` } } });
    const result = await createPortalSession({ userId: USER }, deps);
    expect(result).toEqual({ ok: false, status: 502, error: "stripe_error" });
    expect(JSON.stringify(logs)).not.toContain(KEY);
  });

  it("refuse (503) sans configuration", async () => {
    const { deps } = makeDeps({ config: { secretKey: "", priceMonthly: "", priceAnnual: "", webBaseUrl: "https://x.example" }, findCustomerId: async () => "cus_1" });
    expect(await createPortalSession({ userId: USER }, deps)).toMatchObject({ status: 503 });
  });
});
