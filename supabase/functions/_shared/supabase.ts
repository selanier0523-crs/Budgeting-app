import { createClient } from "npm:@supabase/supabase-js@2";

function readJsonSecret(name: string, fallbackName: string) {
  const direct = Deno.env.get(fallbackName);
  if (direct) return direct;

  const raw = Deno.env.get(name);
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw);
    return parsed.default || Object.values(parsed)[0] || "";
  } catch {
    return "";
  }
}

export function getSupabaseClients(req: Request) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = readJsonSecret("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secretKey = readJsonSecret("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization") || "";

  if (!url || !publishableKey || !secretKey) {
    throw new Error("Supabase function secrets are not available.");
  }

  return {
    supabase: createClient(url, publishableKey, {
      global: { headers: { Authorization: authorization } },
    }),
    supabaseAdmin: createClient(url, secretKey),
  };
}

export async function requireUser(req: Request) {
  const clients = getSupabaseClients(req);
  const { data, error } = await clients.supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Sign in before using bank imports.");
  }

  return { ...clients, user: data.user };
}
