import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { normalizePlaidAmount, plaidRequest, suggestImport } from "../_shared/plaid.ts";
import { requireUser } from "../_shared/supabase.ts";

function accountNameById(accounts: Array<Record<string, any>>) {
  return Object.fromEntries(accounts.map((account) => [account.plaid_account_id, account.name || account.official_name || "Connected account"]));
}

function toImportRow(userId: string, transaction: Record<string, any>, accountNames: Record<string, string>) {
  const suggestion = suggestImport(transaction);
  const personalFinance = transaction.personal_finance_category || {};

  return {
    user_id: userId,
    plaid_transaction_id: transaction.transaction_id,
    plaid_account_id: transaction.account_id || "",
    account_name: accountNames[transaction.account_id] || "",
    date: transaction.date,
    authorized_date: transaction.authorized_date || null,
    name: transaction.name || "",
    merchant_name: transaction.merchant_name || "",
    amount: normalizePlaidAmount(transaction.amount),
    iso_currency_code: transaction.iso_currency_code || "USD",
    is_pending: Boolean(transaction.pending),
    plaid_category_primary: personalFinance.primary || "",
    plaid_category_detailed: personalFinance.detailed || "",
    suggested_type: suggestion.suggested_type,
    suggested_category: suggestion.suggested_category,
    final_type: suggestion.suggested_type,
    final_category: suggestion.suggested_category,
    raw: transaction,
  };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const { supabaseAdmin, user } = await requireUser(req);
    const { data: items, error: itemError } = await supabaseAdmin
      .from("budget_plaid_items")
      .select("id, plaid_item_id, plaid_access_token, sync_cursor")
      .eq("user_id", user.id);

    if (itemError) throw itemError;
    if (!items || items.length === 0) return jsonResponse({ synced: 0, added: 0, modified: 0, removed: 0, message: "No connected bank accounts yet." });

    const { data: accounts, error: accountError } = await supabaseAdmin
      .from("budget_plaid_accounts")
      .select("plaid_account_id, name, official_name")
      .eq("user_id", user.id);

    if (accountError) throw accountError;

    const names = accountNameById(accounts || []);
    let addedCount = 0;
    let modifiedCount = 0;
    let removedCount = 0;

    for (const item of items) {
      let cursor = item.sync_cursor || undefined;
      let nextCursor = cursor;
      let hasMore = true;

      while (hasMore) {
        const syncData = await plaidRequest("/transactions/sync", {
          access_token: item.plaid_access_token,
          cursor,
          count: 100,
        });

        const added = syncData.added || [];
        const modified = syncData.modified || [];
        const removed = syncData.removed || [];
        const allTransactions = [...added, ...modified];
        const ids = allTransactions.map((transaction: Record<string, any>) => transaction.transaction_id);

        const existingByPlaidId: Record<string, Record<string, any>> = {};
        if (ids.length > 0) {
          const { data: existingRows, error: existingError } = await supabaseAdmin
            .from("budget_imported_transactions")
            .select("plaid_transaction_id, approval_status")
            .eq("user_id", user.id)
            .in("plaid_transaction_id", ids);

          if (existingError) throw existingError;
          for (const row of existingRows || []) existingByPlaidId[row.plaid_transaction_id] = row;
        }

        const rowsToUpsert = allTransactions
          .filter((transaction: Record<string, any>) => existingByPlaidId[transaction.transaction_id]?.approval_status !== "approved")
          .filter((transaction: Record<string, any>) => existingByPlaidId[transaction.transaction_id]?.approval_status !== "rejected")
          .map((transaction: Record<string, any>) => toImportRow(user.id, transaction, names));

        if (rowsToUpsert.length > 0) {
          const { error: upsertError } = await supabaseAdmin.from("budget_imported_transactions").upsert(rowsToUpsert, {
            onConflict: "user_id,plaid_transaction_id",
            ignoreDuplicates: false,
          });
          if (upsertError) throw upsertError;
        }

        if (removed.length > 0) {
          const removedIds = removed.map((transaction: Record<string, any>) => transaction.transaction_id).filter(Boolean);
          const { error: removedError } = await supabaseAdmin
            .from("budget_imported_transactions")
            .update({ approval_status: "rejected" })
            .eq("user_id", user.id)
            .eq("approval_status", "pending")
            .in("plaid_transaction_id", removedIds);
          if (removedError) throw removedError;
        }

        addedCount += added.length;
        modifiedCount += modified.length;
        removedCount += removed.length;
        nextCursor = syncData.next_cursor;
        cursor = nextCursor;
        hasMore = Boolean(syncData.has_more);
      }

      await supabaseAdmin
        .from("budget_plaid_items")
        .update({ sync_cursor: nextCursor || null })
        .eq("id", item.id);
    }

    return jsonResponse({ synced: items.length, added: addedCount, modified: modifiedCount, removed: removedCount });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unable to sync Plaid transactions." }, 400);
  }
});
