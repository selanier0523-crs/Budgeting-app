const plaidHosts: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

export type SuggestedImport = {
  suggested_type: "expense" | "income" | "reimbursement" | "transfer" | "savings" | "unknown";
  suggested_category: string;
};

export function getPlaidBaseUrl() {
  const env = (Deno.env.get("PLAID_ENV") || "sandbox").toLowerCase();
  return plaidHosts[env] || plaidHosts.sandbox;
}

export async function plaidRequest(path: string, body: Record<string, unknown>) {
  const clientId = Deno.env.get("PLAID_CLIENT_ID");
  const secret = Deno.env.get("PLAID_SECRET");

  if (!clientId || !secret) {
    throw new Error("Plaid is not configured. Add PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV=sandbox to Supabase Edge Function secrets.");
  }

  const response = await fetch(`${getPlaidBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, secret, ...body }),
  });
  const data = await response.json();

  if (!response.ok) {
    const message = data?.error_message || data?.display_message || data?.error_code || "Plaid request failed.";
    throw new Error(message);
  }

  return data;
}

export function suggestImport(transaction: Record<string, any>): SuggestedImport {
  const primary = transaction.personal_finance_category?.primary || "";
  const detailed = transaction.personal_finance_category?.detailed || "";
  const merchant = `${transaction.merchant_name || ""} ${transaction.name || ""}`.toLowerCase();
  const amount = Number(transaction.amount || 0);

  if (primary === "TRANSFER_IN" || primary === "TRANSFER_OUT" || primary === "LOAN_PAYMENTS") {
    return { suggested_type: "transfer", suggested_category: "Other" };
  }

  if (amount < 0) {
    if (primary === "INCOME") return { suggested_type: "income", suggested_category: "Paycheck" };
    if (/(venmo|cash app|zelle|paypal)/i.test(merchant)) {
      return { suggested_type: "reimbursement", suggested_category: "Paid back by someone" };
    }
    return { suggested_type: "income", suggested_category: "Other" };
  }

  const categoryMap: Record<string, string> = {
    FOOD_AND_DRINK: "Food",
    TRANSPORTATION: "Gas/Transportation",
    ENTERTAINMENT: "Entertainment",
    RENT_AND_UTILITIES: "Necessities",
    GENERAL_MERCHANDISE: "Other",
    MEDICAL: "Necessities",
    PERSONAL_CARE: "Necessities",
    TRAVEL: "Entertainment",
  };

  return {
    suggested_type: detailed.includes("TRANSFER") ? "transfer" : "expense",
    suggested_category: categoryMap[primary] || "Other",
  };
}

export function normalizePlaidAmount(amount: number) {
  return Math.abs(Number(amount || 0));
}
