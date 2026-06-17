import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { plaidRequest } from "../_shared/plaid.ts";
import { requireUser } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const { publicToken, institutionName = "" } = await req.json();
    if (!publicToken) return jsonResponse({ error: "Missing public_token from Plaid Link." }, 400);

    const { supabaseAdmin, user } = await requireUser(req);
    const exchange = await plaidRequest("/item/public_token/exchange", { public_token: publicToken });
    const accessToken = exchange.access_token;
    const itemId = exchange.item_id;

    await supabaseAdmin.from("budget_plaid_items").upsert(
      {
        user_id: user.id,
        plaid_item_id: itemId,
        plaid_access_token: accessToken,
        institution_name: institutionName,
      },
      { onConflict: "user_id,plaid_item_id", ignoreDuplicates: false },
    );

    const accountsData = await plaidRequest("/accounts/get", { access_token: accessToken });
    const accounts = (accountsData.accounts || []).map((account: Record<string, unknown>) => ({
      user_id: user.id,
      plaid_item_id: itemId,
      plaid_account_id: account.account_id,
      name: account.name || "",
      official_name: account.official_name || "",
      type: account.type || "",
      subtype: account.subtype || "",
      mask: account.mask || "",
    }));

    if (accounts.length > 0) {
      await supabaseAdmin.from("budget_plaid_accounts").upsert(accounts, {
        onConflict: "user_id,plaid_account_id",
        ignoreDuplicates: false,
      });
    }

    return jsonResponse({ item_id: itemId, accounts_imported: accounts.length });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unable to connect bank account." }, 400);
  }
});
