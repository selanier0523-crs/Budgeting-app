import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://hlalowrwiflvvajdtymv.supabase.co";
export const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_MM6-dTiAtcg4npt3kCRqmQ_jeQzVtDg";

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
