import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { plaidRequest } from "../_shared/plaid.ts";
import { requireUser } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const { user } = await requireUser(req);
    const webhook = Deno.env.get("PLAID_WEBHOOK_URL") || undefined;
    const payload: Record<string, unknown> = {
      client_name: "Budget Tracker",
      country_codes: ["US"],
      language: "en",
      products: ["transactions"],
      user: { client_user_id: user.id },
    };

    if (webhook) payload.webhook = webhook;

    const data = await plaidRequest("/link/token/create", payload);
    return jsonResponse({ link_token: data.link_token, expiration: data.expiration });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unable to create Plaid Link token." }, 400);
  }
});
