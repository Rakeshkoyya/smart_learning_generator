import { createClient } from "@supabase/supabase-js";

// Use SUPABASE_URL (server-side only, NOT baked into the bundle at build time).
// NEXT_PUBLIC_SUPABASE_URL is inlined by Next.js at build time and would be
// the placeholder value when building the Docker image without build args.
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;;

// Server-side Supabase client with service role for DB and storage operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Alias for backwards compatibility
export const supabaseStorage = supabase;
