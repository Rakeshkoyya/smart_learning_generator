import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side Supabase client — used ONLY for Storage operations.
// All database queries use Prisma (see prisma.ts).
export const supabaseStorage = createClient(supabaseUrl, supabaseServiceKey);
